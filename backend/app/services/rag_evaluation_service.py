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


class RAGEvaluationService:
    """
    Service for evaluating student answers using RAG with BATCH processing.
    
    Key Improvement: Uses a SINGLE Gemini API call to evaluate ALL questions together,
    instead of one call per question. This reduces API usage from N+2 calls to just 1 call.
    """
    
    SESSIONS_COLLECTION = "test_sessions"
    
    async def evaluate_test_session(
        self,
        session_id: str,
        student_id: str,
        class_level: int,
        subject: str,
        chapter_number: int,
        topic_id: str,
        topic_name: str,
        questions: List[Dict],
        answers: List[Dict]
    ) -> Dict:
        """
        Evaluate a complete test session using SINGLE batch API call.
        """
        logger.info(f"📊 Evaluating test session {session_id} for student {student_id}")
        
        # Build Q&A pairs
        qa_pairs = self._build_qa_pairs(questions, answers)
        
        if not qa_pairs:
            return self._empty_result(session_id)
        
        # Retrieve context from Pinecone ONCE for all questions
        context = await self._get_topic_context(class_level, subject, chapter_number, topic_name)
        
        # BATCH EVALUATE ALL QUESTIONS IN ONE GEMINI CALL
        evaluations = await self._batch_evaluate_all_answers(
            qa_pairs=qa_pairs,
            context=context,
            class_level=class_level,
            subject=subject,
            topic_name=topic_name
        )
        
        # Calculate scores
        total_score = 0
        correct_count = 0
        max_possible = len(evaluations) * 10  # Max 10 per question
        
        for e in evaluations:
            total_score += e.get("score", 0)
            if e.get("is_correct", False):
                correct_count += 1
        
        # Calculate percentage score correctly (capped at 100%)
        percentage_score = min(round((total_score / max_possible) * 100, 1) if max_possible > 0 else 0, 100)
        
        # Generate feedback based on score (no extra API call)
        overall_feedback = self._generate_feedback_without_api(
            percentage_score=percentage_score,
            correct_count=correct_count,
            total_questions=len(questions),
            topic_name=topic_name,
            evaluations=evaluations,
            subject=subject,
            chapter_number=chapter_number
        )
        
        # Identify weak areas
        weak_areas = self._identify_weak_areas(evaluations)
        
        # Update student performance
        try:
            await topic_question_bank_service.update_student_performance(
                student_id=student_id,
                class_level=class_level,
                subject=subject,
                chapter_number=chapter_number,
                topic_id=topic_id,
                topic_name=topic_name,
                score=percentage_score,
                questions_attempted=len(questions),
                correct_count=correct_count
            )
        except Exception as e:
            logger.warning(f"Could not update student performance: {e}")
        
        # Save session results
        await self._save_session_results(
            session_id=session_id,
            student_id=student_id,
            score=percentage_score,
            evaluations=evaluations,
            overall_feedback=overall_feedback,
            weak_areas=weak_areas,
            subject=subject,
            chapter_number=chapter_number,
            topic_name=topic_name,
            total_questions=len(questions),
            correct_count=correct_count
        )
        
        logger.info(f"✅ Evaluation complete: {percentage_score}% ({correct_count}/{len(questions)} correct)")
        
        return {
            "session_id": session_id,
            "score": percentage_score,
            "total_questions": len(questions),
            "correct_answers": correct_count,
            "evaluations": evaluations,
            "feedback": overall_feedback["summary"],
            "strengths": overall_feedback["strengths"],
            "improvements": overall_feedback["improvements"],
            "topics_to_review": weak_areas,
            "topics_to_study": overall_feedback.get("topics_to_study", []),
            "subject": subject,
            "chapter_number": chapter_number,
            "topic_name": topic_name,
            "completed_at": datetime.utcnow().isoformat()
        }
    
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
                "difficulty": q.get("difficulty", "medium")
            })
        
        return pairs
    
    async def _get_topic_context(
        self,
        class_level: int,
        subject: str,
        chapter_number: int,
        topic_name: str
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
            
            questions_section += f"""
**Q{i+1}:** {qa["question"]}
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
                    
                    if result:
                        evaluations.append({
                            "question_id": qa["question_id"],
                            "question_text": qa["question"],
                            "student_answer": qa["answer"],
                            "is_correct": result.get("is_correct", False),
                            "score": min(10, max(0, result.get("score", 0))),
                            "max_score": 10,
                            "feedback": result.get("feedback", ""),
                            "correct_answer": result.get("correct_answer", qa.get("expected_answer", ""))
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
            "correct_answer": qa.get("expected_answer", "Please refer to the textbook.")
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
        """Generate overall feedback WITHOUT an additional API call."""
        
        # Analyze correct/incorrect
        correct_qs = [e for e in evaluations if e.get("is_correct")]
        incorrect_qs = [e for e in evaluations if not e.get("is_correct")]
        
        # Extract specific topics from incorrect questions for targeted review
        weak_topics = []
        for e in incorrect_qs:
            q_text = e.get("question_text", "")[:100]
            if q_text:
                weak_topics.append(q_text)
        
        # Build chapter reference
        chapter_ref = f"{subject} Chapter {chapter_number}" if subject and chapter_number else topic_name
        
        # Special case: 0% score - complete failure
        if percentage_score == 0 or correct_count == 0:
            return {
                "summary": f"📚 You need to study '{topic_name}' in {chapter_ref} more carefully. None of the answers were correct. Please read the chapter thoroughly before attempting again.",
                "strengths": ["You attempted the test", "You've identified what you need to study"],
                "improvements": [
                    f"Read {chapter_ref} completely from the textbook",
                    f"Focus on understanding '{topic_name}' concepts step by step",
                    "Take notes while reading",
                    "Ask your teacher if you have doubts",
                    "Try again after studying"
                ],
                "topics_to_study": weak_topics[:5],
                "encouragement": "📖 Don't worry! Go back to your textbook, study the chapter carefully, and try again. You'll improve!"
            }
        
        if percentage_score >= 80:
            return {
                "summary": f"🌟 Excellent performance on '{topic_name}'! You scored {percentage_score}% with {correct_count}/{total_questions} correct. Outstanding understanding demonstrated!",
                "strengths": ["Strong conceptual understanding", "Clear and accurate answers", "Good application of concepts"],
                "improvements": ["Continue practicing to maintain excellence", "Try more challenging problems"],
                "topics_to_study": [],
                "encouragement": "🌟 Amazing work! Keep up the excellent performance!"
            }
        elif percentage_score >= 60:
            return {
                "summary": f"👍 Good effort on '{topic_name}'! You scored {percentage_score}% with {correct_count}/{total_questions} correct. You're on the right track.",
                "strengths": ["Basic understanding present", "Attempted all questions", "Some concepts well understood"],
                "improvements": [
                    f"Review the incorrect answers in {chapter_ref}",
                    "Practice more problems on weak areas",
                    "Focus on the topics listed below"
                ],
                "topics_to_study": weak_topics[:3],
                "encouragement": "👍 Good job! With more practice, you'll improve even more!"
            }
        elif percentage_score >= 40:
            return {
                "summary": f"💪 Keep practicing '{topic_name}'! You scored {percentage_score}% with {correct_count}/{total_questions} correct. Focus on understanding the basics.",
                "strengths": ["Showed effort and attempted the test", "Some concepts understood"],
                "improvements": [
                    f"Review {chapter_ref} thoroughly",
                    "Focus on basic concepts first",
                    "Practice step by step",
                    "Study the specific topics listed below"
                ],
                "topics_to_study": weak_topics[:4],
                "encouragement": "💪 Don't give up! Learning takes time. Keep practicing!"
            }
        else:
            return {
                "summary": f"📚 More practice needed on '{topic_name}'. You scored {percentage_score}% with {correct_count}/{total_questions} correct. Please review {chapter_ref} and try again.",
                "strengths": ["Attempted the test", "Identified areas for improvement"],
                "improvements": [
                    f"Read {chapter_ref} from your textbook carefully",
                    f"Start with basic definitions in '{topic_name}'",
                    "Ask for help if needed",
                    "Take notes while studying",
                    "Study the questions you got wrong (listed below)"
                ],
                "topics_to_study": weak_topics[:5],
                "encouragement": "📚 Every expert was once a beginner. Review the chapter and try again!"
            }
    
    def _identify_weak_areas(self, evaluations: List[Dict]) -> List[str]:
        """Identify topics/areas where student needs improvement."""
        weak_areas = []
        
        for e in evaluations:
            if not e.get("is_correct") and e.get("score", 10) < 5:
                q = e.get("question_text", "").lower()
                if "what is" in q or "define" in q:
                    weak_areas.append("Basic definitions and concepts")
                elif "explain" in q or "describe" in q:
                    weak_areas.append("Detailed explanations")
                elif "compare" in q or "difference" in q:
                    weak_areas.append("Comparisons and distinctions")
                elif "why" in q or "how" in q:
                    weak_areas.append("Reasoning and understanding")
                elif "example" in q or "application" in q:
                    weak_areas.append("Practical applications")
                elif "calculate" in q or "formula" in q:
                    weak_areas.append("Numerical problems and formulas")
                else:
                    weak_areas.append("General understanding")
        
        return list(set(weak_areas))[:5]
    
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
        correct_count: int = 0
    ):
        """Save test session results to MongoDB."""
        try:
            collection = mongodb.db[self.SESSIONS_COLLECTION]
            
            await collection.update_one(
                {"session_id": session_id},
                {"$set": {
                    "status": "completed",
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
                }}
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
