"""
RAG-based Evaluation Service (BATCH VERSION)
Evaluates student answers using Pinecone context retrieval and a SINGLE Gemini API call.
"""

from typing import List, Dict, Optional
from datetime import datetime
import logging
import json
import re

from app.db.mongo import mongodb
from app.services.gemini_service import gemini_service
from app.services.rag_service import rag_service
from app.services.topic_question_bank_service import topic_question_bank_service

logger = logging.getLogger(__name__)

# Subject name normalization to fix typos
SUBJECT_CORRECTIONS = {
    "mathematicss": "Maths",
    "mathematic": "Maths",
    "mathematics": "Maths",
    "maths": "Maths",
    "math": "Maths",
    "science": "Science",
    "sciences": "Science",
    "english": "English",
    "hindi": "Hindi",
    "history": "History",
    "geography": "Geography",
    "civics": "Civics",
    "economics": "Economics",
    "physics": "Physics",
    "chemistry": "Chemistry",
    "biology": "Biology",
}


def normalize_subject(subject: str) -> str:
    """Normalize subject name to fix typos and ensure correct namespace lookup."""
    if not subject:
        return subject
    lower = subject.lower().strip()
    # Check for known corrections
    if lower in SUBJECT_CORRECTIONS:
        return SUBJECT_CORRECTIONS[lower]
    # Also check if lowercase version is in corrections
    for key, value in SUBJECT_CORRECTIONS.items():
        if key in lower:
            return value
    # Default: capitalize properly
    return subject.strip().title()


class RAGEvaluationService:
    """
    Service for evaluating student answers using RAG with BATCH processing.
    
    Key Improvement: Uses a SINGLE Gemini API call to evaluate ALL questions together,
    instead of one call per question. This reduces API usage from N+2 calls to just 1 call.
    """
    
    SESSIONS_COLLECTION = "test_sessions"
    
    async def evaluate_test_session(
        self,
        session_data: Optional[Dict] = None,
        # Legacy/Support args
        session_id: str = None,
        student_id: str = None,
        class_level: int = 10,
        subject: str = "",
        chapter_number: int = 1,
        topic_id: str = "",
        topic_name: str = "",
        questions: List[Dict] = None,
        answers: List[Dict] = None
    ) -> Dict:
        """
        Evaluate a complete test session.
        Can accept either a full 'session_data' dict (from test.py) or individual args (from assessment_service.py).
        """
        # 1. Unpack session_data if provided
        if session_data:
            session_id = session_data.get("session_id")
            student_id = session_data.get("student_id")
            class_level = session_data.get("class_level", 10)
            subject = session_data.get("subject", "")
            chapter_number = session_data.get("chapter", 1) # Note: 'chapter' vs 'chapter_number'
            topic_id = session_data.get("topic_id", "")
            topic_name = session_data.get("topic_name", "")
            questions = session_data.get("questions_served", [])
            answers = session_data.get("answers", [])
        
        logger.info(f"📊 Evaluating test session {session_id} for student {student_id}")
        
        # Normalize subject name to fix typos like "Mathematicss"
        subject = normalize_subject(subject)
        logger.info(f"Subject normalized to: {subject}")
        
        # 📚 ENRICHMENT: Fetch correct answers from DB for QB tests (if missing)
        # QB questions don't have 'answer', 'expected_answer', 'correct_option' in questions_served
        questions_to_enrich = []
        for q in questions:
            # check if vital answer keys are missing
            if not any(k in q for k in ["expected_answer", "correct_option", "answer"]) and q.get("question_id"):
                 questions_to_enrich.append(q["question_id"])
        
        if questions_to_enrich:
             logger.info(f"Fetching details for {len(questions_to_enrich)} QB questions from DB")
             try:
                 # Fetch native question objects
                 db_questions = await mongodb.db.questions.find(
                     {"_id": {"$in": [ObjectId(qid) for qid in questions_to_enrich]}}
                 ).to_list(length=len(questions_to_enrich))
                 
                 db_map = {str(doc["_id"]): doc for doc in db_questions}
                 
                 # Enrich existing question objects in-place
                 for q in questions:
                     qid = q.get("question_id")
                     if qid in db_map:
                         db_q = db_map[qid]
                         # Inject answer data
                         q["expected_answer"] = db_q.get("correct_answer") or db_q.get("answer")
                         q["correct_option"] = db_q.get("correct_option") # For MCQ
                         q["keywords"] = db_q.get("keywords", [])
                         q["answer"] = db_q.get("answer") # Legacy field support
                         
                         # Handle MCQ Options if missing text/is_correct
                         if db_q.get("options") and not q.get("options"):
                             q["options"] = db_q.get("options")
                         
                         # Ensure question text if missing
                         if not q.get("question") and not q.get("question_text"):
                             q["question"] = db_q.get("question") or db_q.get("text")

             except Exception as e:
                 logger.error(f"Error enriching QB questions: {e}")

        # Build Q&A pairs
        qa_pairs = self._build_qa_pairs(questions, answers)
        
        if not qa_pairs:
            return self._empty_result(session_id)
        
        # Split into objective (MCQ/fillup) and subjective (short_answer/long_answer/two_mark)
        objective_pairs = []
        subjective_pairs = []
        for qa in qa_pairs:
            q_type = (qa.get("question_type") or "").lower()
            if q_type in ("mcq", "fillup", "fill_up", "fill-up", "fill_in_the_blank"):
                # Ensure we have correct_option for MCQs
                if "mcq" in q_type and not qa.get("correct_option"):
                     # Try to find it in options if structure differs
                     for opt in qa.get("options", {}).values(): 
                         pass

                objective_pairs.append(qa)
            else:
                subjective_pairs.append(qa)
        
        logger.info(f"Auto-evaluating {len(objective_pairs)} objective Qs, {len(subjective_pairs)} subjective Qs pending staff review")
        
        # Auto-evaluate objective questions (no Gemini)
        auto_evaluations = self._auto_evaluate_objective(objective_pairs)
        
        # Evaluate subjective questions using Gemini 2.5 Flash
        subjective_evaluations = []
        if subjective_pairs:
            logger.info(f"Sending {len(subjective_pairs)} subjective questions to Gemini for evaluation")
            
            # Get context for RAG
            context = await self._get_topic_context(
                class_level=class_level,
                subject=subject,
                chapter_number=chapter_number,
                topic_id=topic_id,
                topic_name=topic_name
            )
            
            # Batch evaluate
            subjective_evaluations = await self._batch_evaluate_all_answers(
                qa_pairs=subjective_pairs,
                context=context,
                class_level=class_level,
                subject=subject,
                topic_name=topic_name
            )
        
        # Combine evaluations (order by question_number)
        all_evaluations = auto_evaluations + subjective_evaluations
        
        # Sort by question number to maintain order
        all_evaluations.sort(key=lambda x: x.get("question_number", 0))
        
        # Determine overall evaluation status
        evaluation_status = "completed"
        
        # Calculate scores
        total_score = 0
        correct_count = 0
        max_possible = 0
        
        for e in all_evaluations:
            # Ensure safe numeric conversion
            score = float(e.get("score", 0))
            max_score = float(e.get("max_score", 1))
            
            total_score += score
            max_possible += max_score
            
            # Mark as correct if > 60% marks obtained
            if max_score > 0 and (score / max_score) >= 0.6:
                correct_count += 1
                e["is_correct"] = True
            else:
                e["is_correct"] = False
        
        # Calculate percentage
        percentage = min(round((total_score / max_possible) * 100, 1) if max_possible > 0 else 0, 100)
        
        # Generate detailed feedback
        overall_feedback = {
            "summary": f"You scored {total_score}/{max_possible} ({percentage}%). {correct_count}/{len(all_evaluations)} answers were correct/satisfactory.",
            "strengths": [],
            "improvements": [],
            "topics_to_study": [],
            "encouragement": "Keep practicing!" if percentage < 70 else "Great job!"
        }
        
        # Collect strengths and improvements from individual evaluations
        for e in all_evaluations:
            fb = e.get("feedback", "")
            if e.get("is_correct"):
                if len(overall_feedback["strengths"]) < 3:
                    overall_feedback["strengths"].append(f"Q{e.get('question_number', '?')}: {fb}")
            else:
                if len(overall_feedback["improvements"]) < 3:
                    overall_feedback["improvements"].append(f"Q{e.get('question_number', '?')}: {fb}")
        
        # Add specific topic feedback from wrong answers
        wrong_topics = list(set(e.get("topic", "") for e in all_evaluations if not e.get("is_correct") and e.get("topic")))
        if wrong_topics:
            overall_feedback["improvements"] = [f"Review '{t}'" for t in wrong_topics[:5]]
        
        # Identify weak areas
        weak_areas = self._identify_weak_areas(all_evaluations)
        
        # Calculate topic analytics
        topic_analytics = self._calculate_topic_analytics(questions, all_evaluations)
        
        # Update student performance
        try:
            await topic_question_bank_service.update_student_performance(
                student_id=student_id,
                class_level=class_level,
                subject=subject,
                chapter_number=chapter_number,
                topic_id=topic_id,
                topic_name=topic_name,
                score=percentage,
                questions_attempted=len(questions),
                correct_count=correct_count
            )
        except Exception as e:
            logger.warning(f"Could not update student performance: {e}")
        
        # Save session results with evaluation_status
        await self._save_session_results(
            session_id=session_id,
            student_id=student_id,
            score=percentage,
            evaluations=all_evaluations,
            overall_feedback=overall_feedback,
            weak_areas=weak_areas,
            subject=subject,
            chapter_number=chapter_number,
            topic_name=topic_name,
            total_questions=len(questions),
            correct_count=correct_count,
            topic_analytics=topic_analytics,
            evaluation_status=evaluation_status
        )
        
        logger.info(f"Evaluation complete: {percentage}% ({correct_count}/{len(all_evaluations)} correct), status={evaluation_status}")
        
        return {
            "session_id": session_id,
            "score": percentage,
            "total_questions": len(questions),
            "correct_answers": correct_count,
            "evaluations": all_evaluations,
            "feedback": overall_feedback["summary"],
            "strengths": overall_feedback["strengths"],
            "improvements": overall_feedback["improvements"],
            "topics_to_review": weak_areas,
            "topics_to_study": overall_feedback.get("topics_to_study", []),
            "topic_analytics": topic_analytics,
            "evaluation_status": evaluation_status,
            "subject": subject,
            "chapter_number": chapter_number,
            "topic_name": topic_name,
            "completed_at": datetime.utcnow().isoformat()
        }
    
    def _auto_evaluate_objective(self, qa_pairs: List[Dict]) -> List[Dict]:
        """
        Auto-evaluate MCQ and Fill-up questions with simple if/else logic.
        No Gemini API calls needed.
        """
        evaluations = []
        
        for qa in qa_pairs:
            q_type = (qa.get("question_type") or "").lower()
            student_answer = (qa.get("answer") or "").strip()
            marks = qa.get("marks", 1)
            
            if q_type == "mcq":
                # MCQ: Compare student answer against correct option(s)
                correct_option = (qa.get("correct_option") or "").strip()
                expected = (qa.get("expected_answer") or "").strip()
                
                # Support multiple correct answers (pipe-separated)
                correct_answers = []
                if correct_option:
                    correct_answers = [a.strip().lower() for a in correct_option.split("|") if a.strip()]
                if not correct_answers and expected:
                    correct_answers = [a.strip().lower() for a in expected.split("|") if a.strip()]
                
                student_lower = student_answer.lower()
                is_correct = student_lower in correct_answers if correct_answers else False
                
                # Also check if student selected the option letter (A/B/C/D)
                if not is_correct and qa.get("options"):
                    options = qa["options"]
                    if isinstance(options, dict):
                        # options = {"A": "val1", "B": "val2", ...}
                        for key, value in options.items():
                            if value.strip().lower() in correct_answers:
                                if student_lower == key.lower() or student_lower == value.strip().lower():
                                    is_correct = True
                                    break
                    elif isinstance(options, list):
                        for i, opt in enumerate(options):
                            if opt.strip().lower() in correct_answers:
                                letter = chr(65 + i)  # A, B, C, D
                                if student_lower == letter.lower() or student_lower == opt.strip().lower():
                                    is_correct = True
                                    break
                
                evaluations.append({
                    "question_id": qa["question_id"],
                    "question_text": qa["question"],
                    "student_answer": student_answer,
                    "is_correct": is_correct,
                    "score": marks if is_correct else 0,
                    "max_score": marks,
                    "feedback": "Correct!" if is_correct else f"Incorrect. The correct answer is: {correct_option or expected}",
                    "correct_answer": correct_option or expected,
                    "topic": qa.get("topic", ""),
                    "evaluation_status": "auto_evaluated"
                })
            
            elif q_type in ("fillup", "fill_up", "fill-up", "fill_in_the_blank"):
                # Fill-up: Case-insensitive comparison against acceptable answers
                expected = (qa.get("expected_answer") or "").strip()
                correct_option = (qa.get("correct_option") or "").strip()
                
                # Build list of acceptable answers (pipe-separated)
                acceptable_answers = []
                answer_source = correct_option or expected
                if answer_source:
                    acceptable_answers = [a.strip().lower() for a in answer_source.split("|") if a.strip()]
                
                student_lower = student_answer.lower().strip()
                
                # Check exact match (case-insensitive, trimmed)
                is_correct = student_lower in acceptable_answers if acceptable_answers else False
                
                # Also check with minor variations (remove extra spaces, periods, etc.)
                if not is_correct and student_lower:
                    cleaned_student = re.sub(r'[.\s]+$', '', student_lower).strip()
                    for acc in acceptable_answers:
                        cleaned_acc = re.sub(r'[.\s]+$', '', acc).strip()
                        if cleaned_student == cleaned_acc:
                            is_correct = True
                            break
                
                evaluations.append({
                    "question_id": qa["question_id"],
                    "question_text": qa["question"],
                    "student_answer": student_answer,
                    "is_correct": is_correct,
                    "score": marks if is_correct else 0,
                    "max_score": marks,
                    "feedback": "Correct!" if is_correct else f"Incorrect. Acceptable answer(s): {answer_source}",
                    "correct_answer": answer_source,
                    "topic": qa.get("topic", ""),
                    "evaluation_status": "auto_evaluated"
                })
        
        return evaluations
    
    def _build_qa_pairs(self, questions: List[Dict], answers: List[Dict]) -> List[Dict]:
        """Match questions with answers."""
        answer_map = {a.get("question_id") or a.get("question_number"): a.get("answer", "") for a in answers}
        
        pairs = []
        for i, q in enumerate(questions):
            q_id = q.get("question_id") or q.get("question_number") or str(i + 1)
            pairs.append({
                "question_id": q_id,
                "question_number": i + 1,
                "question": q.get("question_text", ""),
                "answer": answer_map.get(q_id, ""),
                "expected_answer": q.get("expected_answer"),
                "keywords": q.get("keywords", []),
                "marks": q.get("marks", 10),
                "difficulty": q.get("difficulty", "medium"),
                "question_type": q.get("question_type", ""),
                "correct_option": q.get("correct_option", ""),
                "options": q.get("options", {}),
                "topic": q.get("topic") or q.get("topic_name", "")
            })
        
        return pairs
    
    async def _get_topic_context(
        self,
        class_level: int,
        subject: str,
        chapter_number: int,
        topic_name: str,
        topic_id: str = None
    ) -> str:
        """Retrieve relevant context from Pinecone for the topic."""
        try:
            context = rag_service.retrieve_chapter_context(
                class_level=class_level,
                subject=subject,
                chapter=chapter_number,
                max_chunks=15
            )
            
            if context:
                logger.info(f"Retrieved context for {topic_name} (Class {class_level} {subject} Ch.{chapter_number})")
                return context[:15000]  # Limit context size
            else:
                logger.warning(f"No context found for {topic_name}")
                return ""
            
        except Exception as e:
            logger.error(f"Error retrieving context: {e}")
            return ""
    
    async def _batch_evaluate_all_answers(
        self,
        qa_pairs: List[Dict],
        context: str,
        class_level: int,
        subject: str,
        topic_name: str
    ) -> List[Dict]:
        """
        Evaluate ALL answers in a SINGLE Gemini API call.
        This is the key optimization - instead of N calls, we make just 1.
        """
        
        # Build the batch prompt with all Q&A pairs
        questions_section = ""
        for i, qa in enumerate(qa_pairs):
            answer_text = qa["answer"].strip() if qa["answer"] else "(No answer provided)"
            expected = qa.get("expected_answer", "Not provided")
            keywords = ", ".join(qa.get("keywords", [])) if qa.get("keywords") else "Not specified"
            q_type = qa.get("question_type", "")
            
            # Add question type specific info
            type_info = ""
            if q_type == "mcq":
                correct_opt = qa.get("correct_option", "")
                options = qa.get("options", {})
                options_str = ", ".join([f"{k}: {v}" for k, v in options.items()]) if options else ""
                type_info = f"\n- Type: MCQ (Options: {options_str})\n- Correct Option: {correct_opt}"
                type_info += f"\n- NOTE: Student selected option '{answer_text}'. Mark 10/10 if it matches correct option '{correct_opt}', else 0/10."
            elif q_type == "fillup":
                type_info = f"\n- Type: Fill in the Blank\n- NOTE: Check if student's answer matches or is close to the expected answer. Exact match or minor variation = 10/10."
            else:
                type_info = f"\n- Type: Short Answer ({qa.get('marks', 2)} marks)"
            
            questions_section += f"""
**Q{i+1}:** {qa["question"]}{type_info}
- Student's Answer: {answer_text}
- Expected Answer: {expected}
- Keywords: {keywords}

"""
        
        # Context section
        context_section = ""
        if context and len(context.strip()) > 100:
            context_section = f"""
**TEXTBOOK CONTEXT FOR REFERENCE:**
{context[:8000]}

"""
        else:
            context_section = "**NOTE:** No textbook context available. Evaluate based on expected answers and general knowledge.\n\n"
        
        prompt = f"""You are evaluating a Class {class_level} {subject} student's test on "{topic_name}".

{context_section}

**QUESTIONS AND ANSWERS TO EVALUATE:**
{questions_section}

**EVALUATION INSTRUCTIONS:**
For each question (Q1 to Q{len(qa_pairs)}):
1. Check if the student's answer is correct based on expected answer and textbook context
2. Score each answer out of 10:
   - 8-10: Correct and comprehensive
   - 6-7: Mostly correct with minor gaps
   - 4-5: Partially correct
   - 1-3: Incorrect or very incomplete  
   - 0: No answer or completely wrong
3. Provide brief constructive feedback

**OUTPUT FORMAT (JSON array):**
[
  {{"q": 1, "is_correct": true/false, "score": 0-10, "feedback": "brief feedback", "correct_answer": "the correct answer"}},
  {{"q": 2, "is_correct": true/false, "score": 0-10, "feedback": "brief feedback", "correct_answer": "the correct answer"}},
  ...
]

Be fair and encouraging. Output ONLY the JSON array, nothing else."""

        try:
            response = gemini_service.generate_response(prompt)
            
            # Parse JSON array
            json_match = re.search(r'\[.*\]', response, re.DOTALL)
            if json_match:
                results = json.loads(json_match.group())
                
                # Map results back to evaluations
                evaluations = []
                for i, qa in enumerate(qa_pairs):
                    # Find matching result
                    result = next((r for r in results if r.get("q") == i + 1), None)
                    
                    question_marks = float(qa.get("marks", 2))
                    
                    if result:
                        # Scale score from 10 to question marks
                        gemini_score = float(result.get("score", 0))
                        scaled_score = (gemini_score / 10.0) * question_marks
                        scaled_score = round(scaled_score, 1)
                        
                        evaluations.append({
                            "question_number": qa.get("question_number", 0),
                            "question_id": qa["question_id"],
                            "question_text": qa["question"],
                            "student_answer": qa["answer"],
                            "is_correct": result.get("is_correct", False),
                            "score": scaled_score,
                            "max_score": question_marks,
                            "feedback": result.get("feedback", ""),
                            "correct_answer": result.get("correct_answer", qa.get("expected_answer", "")),
                            "topic": qa.get("topic", ""),
                            "evaluation_status": "completed"
                        })
                    else:
                        # Fallback for missing result
                        evaluations.append(self._fallback_evaluation(qa))
                
                return evaluations
            
            logger.warning("Could not parse batch evaluation response, using fallback")
            return [self._fallback_evaluation(qa) for qa in qa_pairs]
            
        except Exception as e:
            logger.error(f"Batch evaluation error: {e}")
            # Return fallback evaluations based on expected answers
            return [self._fallback_evaluation(qa) for qa in qa_pairs]
    
    def _fallback_evaluation(self, qa: Dict) -> Dict:
        """Generate fallback evaluation when API fails."""
        answer = qa.get("answer", "").strip()
        expected = qa.get("expected_answer", "").lower()
        keywords = qa.get("keywords", [])
        
        # Simple keyword matching fallback
        score = 0
        is_correct = False
        
        if answer:
            answer_lower = answer.lower()
            # Check keyword matches
            matches = sum(1 for kw in keywords if kw.lower() in answer_lower)
            if matches >= len(keywords) * 0.7:
                score = 7
                is_correct = True
            elif matches > 0:
                score = 4 + matches
                is_correct = score >= 6
            elif expected and any(word in answer_lower for word in expected.split()[:5]):
                score = 5
        
        return {
            "question_id": qa["question_id"],
            "question_text": qa["question"],
            "student_answer": qa["answer"],
            "is_correct": is_correct,
            "score": min(10, score),
            "max_score": 10,
            "feedback": "Answer evaluated. Review the correct answer for more detail." if score > 0 else "No answer provided.",
            "correct_answer": qa.get("expected_answer", "Please refer to the textbook."),
            "topic": qa.get("topic", "")
        }
    
    def _generate_feedback_without_api(
        self,
        percentage_score: float,
        correct_count: int,
        total_questions: int,
        topic_name: str,
        evaluations: List[Dict],
        subject: str = "",
        chapter_number: int = 0
    ) -> Dict:
        """Generate specific, topic-aware feedback using Gemini for targeted recommendations."""
        
        # Analyze correct/incorrect with topic details
        correct_qs = [e for e in evaluations if e.get("is_correct")]
        incorrect_qs = [e for e in evaluations if not e.get("is_correct")]
        
        # Extract specific topics from incorrect questions
        weak_topic_details = []
        for e in incorrect_qs:
            q_text = e.get("question_text", "")[:150]
            topic = e.get("topic", "")
            feedback = e.get("feedback", "")
            if q_text:
                weak_topic_details.append({
                    "question": q_text,
                    "topic": topic,
                    "score": e.get("score", 0),
                    "feedback": feedback
                })
        
        # Extract topics from correct questions 
        strong_topic_details = []
        for e in correct_qs:
            topic = e.get("topic", "")
            if topic and topic not in [s.get("topic") for s in strong_topic_details]:
                strong_topic_details.append({"topic": topic, "score": e.get("score", 0)})
        
        # Build chapter reference
        chapter_ref = f"{subject} Chapter {chapter_number}" if subject and chapter_number else topic_name
        
        # Use Gemini to generate specific, targeted feedback
        try:
            weak_details_str = ""
            if weak_topic_details:
                weak_details_str = "\n".join([
                    f"- Q: \"{d['question'][:100]}\" (Topic: {d['topic'] or 'Unknown'}, Score: {d['score']}/10, Feedback: {d['feedback'][:80]})"
                    for d in weak_topic_details[:8]
                ])
            
            strong_details_str = ""
            if strong_topic_details:
                strong_details_str = "\n".join([
                    f"- Topic: {d['topic'] or 'General'} (Score: {d['score']}/10)"
                    for d in strong_topic_details[:5]
                ])
            
            feedback_prompt = f"""You are a helpful teacher analyzing a Class 10 {subject} student's test performance on "{topic_name}" from {chapter_ref}.

**Test Results:** {correct_count}/{total_questions} correct ({percentage_score}%)

**Questions the student got WRONG:**
{weak_details_str or "None"}

**Topics the student got RIGHT:**
{strong_details_str or "None"}

Generate SPECIFIC, ACTIONABLE feedback. Do NOT give generic advice like "study more" or "take notes". 
Instead, mention EXACT topics, concepts, formulas, grammar rules, or chapter sections the student needs to work on.

**OUTPUT FORMAT (JSON):**
{{
  "summary": "One sentence summary mentioning specific areas (e.g., 'You struggled with tenses and metaphors but excelled at comprehension')",
  "strengths": ["Specific strength 1 mentioning exact topic/concept", "Specific strength 2"],
  "improvements": ["Specific area 1 with exact topic (e.g., 'Practice converting fractions to decimals')", "Specific area 2 (e.g., 'Review the water cycle diagram in Section 3.2')", "Specific area 3"],
  "topics_to_study": ["Exact topic 1 (e.g., 'Past Perfect Tense usage')", "Exact topic 2 (e.g., 'Photosynthesis - Light Reaction')"]
}}

Be encouraging but SPECIFIC. Output ONLY the JSON object."""

            response = gemini_service.generate_response(feedback_prompt, max_output_tokens=2000)
            
            # Parse JSON response
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                # Clean common JSON issues
                json_str = json_match.group()
                json_str = re.sub(r',\s*([}\]])', r'\1', json_str)
                feedback_data = json.loads(json_str)
                
                # Add encouragement based on score
                if percentage_score >= 80:
                    encouragement = "🌟 Amazing work! Keep up the excellent performance!"
                elif percentage_score >= 60:
                    encouragement = "👍 Good job! With focused practice on the areas mentioned, you'll improve even more!"
                elif percentage_score >= 40:
                    encouragement = "💪 Don't give up! Focus on the specific topics listed above and try again!"
                else:
                    encouragement = "Review the specific topics mentioned above and practice them. You'll get better!"
                
                return {
                    "summary": feedback_data.get("summary", f"You scored {percentage_score}% on {topic_name}"),
                    "strengths": feedback_data.get("strengths", ["Attempted the test"]),
                    "improvements": feedback_data.get("improvements", [f"Review {chapter_ref}"]),
                    "topics_to_study": feedback_data.get("topics_to_study", []),
                    "encouragement": encouragement
                }
            
        except Exception as e:
            logger.warning(f"Gemini feedback generation failed, using fallback: {e}")
        
        # Fallback: Use topic names from wrong questions for specific feedback
        weak_topic_names = list(set(d.get("topic", "") for d in weak_topic_details if d.get("topic")))
        strong_topic_names = list(set(d.get("topic", "") for d in strong_topic_details if d.get("topic")))
        
        # Build specific improvements from actual wrong topics
        specific_improvements = []
        for topic in weak_topic_names[:4]:
            specific_improvements.append(f"Review and practice '{topic}' from {chapter_ref}")
        if not specific_improvements:
            specific_improvements = [f"Review all concepts in {chapter_ref}"]
        
        # Build specific strengths from correct topics
        specific_strengths = []
        for topic in strong_topic_names[:3]:
            specific_strengths.append(f"Good understanding of '{topic}'")
        if not specific_strengths:
            specific_strengths = ["Attempted the test"]
        
        if percentage_score >= 80:
            return {
                "summary": f"🌟 Excellent! You scored {percentage_score}% on '{topic_name}'. " + (f"Strong in: {', '.join(strong_topic_names[:2])}." if strong_topic_names else "Outstanding understanding!"),
                "strengths": specific_strengths,
                "improvements": specific_improvements if weak_topic_names else ["Continue practicing to maintain excellence"],
                "topics_to_study": weak_topic_names[:3],
                "encouragement": "🌟 Amazing work! Keep up the excellent performance!"
            }
        elif percentage_score >= 60:
            return {
                "summary": f"👍 Good effort on '{topic_name}'! You scored {percentage_score}%. " + (f"Focus on: {', '.join(weak_topic_names[:2])}." if weak_topic_names else "Keep practicing!"),
                "strengths": specific_strengths,
                "improvements": specific_improvements,
                "topics_to_study": weak_topic_names[:4],
                "encouragement": "👍 Good job! With focused practice, you'll improve even more!"
            }
        elif percentage_score >= 40:
            return {
                "summary": f"💪 Keep going on '{topic_name}'! You scored {percentage_score}%. " + (f"Work on: {', '.join(weak_topic_names[:3])}." if weak_topic_names else "Review the chapter."),
                "strengths": specific_strengths,
                "improvements": specific_improvements,
                "topics_to_study": weak_topic_names[:5],
                "encouragement": "💪 Don't give up! Focus on the specific topics and try again!"
            }
        else:
            return {
                "summary": f"More practice needed on '{topic_name}'. You scored {percentage_score}%. " + (f"Start with: {', '.join(weak_topic_names[:2])}." if weak_topic_names else f"Review {chapter_ref} carefully."),
                "strengths": specific_strengths,
                "improvements": specific_improvements,
                "topics_to_study": weak_topic_names[:5],
                "encouragement": "Every expert was once a beginner. Review the topics and try again!"
            }
    
    def _calculate_topic_analytics(self, questions: List[Dict], evaluations: List[Dict]) -> Dict:
        """
        Calculate topic-level performance analytics.
        Groups questions by topic and calculates scores for each.
        """
        topic_performance = {}
        
        # Match questions with evaluations and group by topic
        for i, q in enumerate(questions):
            topic_id = q.get("topic_id")
            topic_name = q.get("topic_name") or q.get("topic", "General")
            
            # If no topic info, use chapter-level
            if not topic_id or not topic_name:
                topic_id = "chapter_general"
                topic_name = topic_name or "General Concepts"
            
            if not topic_id:
                topic_id = topic_name.lower().replace(" ", "_")
            
            # Initialize topic if not seen
            if topic_id not in topic_performance:
                topic_performance[topic_id] = {
                    "topic_id": topic_id,
                    "topic_name": topic_name,
                    "total_questions": 0,
                    "correct_answers": 0,
                    "total_score": 0,
                    "max_score": 0,
                    "questions": []
                }
            
            # Find matching evaluation
            eval_item = None
            if i < len(evaluations):
                eval_item = evaluations[i]
            else:
                # Try to match by question_id
                question_id = q.get("question_id")
                if question_id:
                    eval_item = next((e for e in evaluations if e.get("question_id") == question_id), None)
            
            if eval_item:
                topic_performance[topic_id]["total_questions"] += 1
                topic_performance[topic_id]["correct_answers"] += 1 if eval_item.get("is_correct") else 0
                topic_performance[topic_id]["total_score"] += eval_item.get("score", 0)
                topic_performance[topic_id]["max_score"] += eval_item.get("max_score", 10)
                topic_performance[topic_id]["questions"].append({
                    "question_number": i + 1,
                    "is_correct": eval_item.get("is_correct"),
                    "score": eval_item.get("score", 0)
                })
        
        # Calculate percentages and categorize
        topics_list = []
        strong_topics = []
        weak_topics = []
        
        for topic_id, data in topic_performance.items():
            if data["max_score"] > 0:
                percentage = round((data["total_score"] / data["max_score"]) * 100, 1)
            else:
                percentage = 0
            
            topic_summary = {
                "topic_id": topic_id,
                "topic_name": data["topic_name"],
                "total_questions": data["total_questions"],
                "correct_answers": data["correct_answers"],
                "score_percentage": percentage,
                "questions_detail": data["questions"]
            }
            
            topics_list.append(topic_summary)
            
            # Categorize topics
            if percentage >= 70:
                strong_topics.append({"name": data["topic_name"], "score": percentage})
            elif percentage < 50:
                weak_topics.append({"name": data["topic_name"], "score": percentage})
        
        # Sort topics by score
        topics_list.sort(key=lambda x: x["score_percentage"], reverse=True)
        strong_topics.sort(key=lambda x: x["score"], reverse=True)
        weak_topics.sort(key=lambda x: x["score"])
        
        return {
            "topics": topics_list,
            "strong_topics": strong_topics,
            "weak_topics": weak_topics,
            "total_topics_covered": len(topics_list)
        }
    
    def _identify_weak_areas(self, evaluations: List[Dict]) -> List[str]:
        """Identify specific topics/areas where student needs improvement using actual topic names."""
        weak_areas = []
        
        for e in evaluations:
            if not e.get("is_correct") and e.get("score", 10) < 5:
                # Use actual topic name if available
                topic = e.get("topic", "")
                if topic and topic not in weak_areas:
                    weak_areas.append(topic)
                else:
                    # Fallback: extract key concept from question text
                    q = e.get("question_text", "").strip()
                    if q and len(q) > 10:
                        # Take the first meaningful portion as area description
                        short_q = q[:80] + "..." if len(q) > 80 else q
                        weak_areas.append(short_q)
        
        return list(dict.fromkeys(weak_areas))[:5]  # Deduplicate, keep order
    
    async def _save_session_results(
        self,
        session_id: str,
        student_id: str,
        score: float,
        evaluations: List[Dict],
        overall_feedback: Dict,
        weak_areas: List[str],
        subject: str = "",
        chapter_number: int = 0,
        topic_name: str = "",
        total_questions: int = 0,
        correct_count: int = 0,
        topic_analytics: Dict = None,
        evaluation_status: str = "completed"
    ):
        """Save test session results to MongoDB."""
        try:
            collection = mongodb.db[self.SESSIONS_COLLECTION]
            
            update_data = {
                "status": "completed",
                "evaluation_status": evaluation_status,
                "score": score,
                "subject": subject,
                "chapter_number": chapter_number,
                "topic_name": topic_name,
                "total_questions": total_questions,
                "correct_count": correct_count,
                "evaluation_details": evaluations,
                "overall_feedback": overall_feedback,
                "topics_to_review": weak_areas,
                "completed_at": datetime.utcnow()
            }
            
            # Add topic analytics if provided
            if topic_analytics:
                update_data["topic_analytics"] = topic_analytics
            
            await collection.update_one(
                {"session_id": session_id},
                {"$set": update_data}
            )
            logger.info(f"Saved session results for {session_id}")
        except Exception as e:
            logger.error(f"Error saving session results: {e}")
    
    def _empty_result(self, session_id: str) -> Dict:
        """Return empty result for failed evaluation."""
        return {
            "session_id": session_id,
            "score": 0,
            "total_questions": 0,
            "correct_answers": 0,
            "evaluations": [],
            "feedback": "No answers to evaluate.",
            "strengths": [],
            "improvements": ["Please answer the questions"],
            "topics_to_review": [],
            "completed_at": datetime.utcnow().isoformat()
        }


# Global instance
rag_evaluation_service = RAGEvaluationService()
