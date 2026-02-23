"""
Topic Question Bank Service
Generates and stores questions by topic during PDF embedding.
Serves pre-generated questions for tests to minimize LLM API calls.
"""

from typing import List, Dict, Optional, Tuple
from datetime import datetime
from bson import ObjectId
import logging
import json
import re
import uuid

from app.db.mongo import mongodb
from app.services.gemini_service import gemini_service
from app.services.rag_service import rag_service
from app.models.topic_questions import (
    TopicQuestion, Topic, ChapterQuestionBank,
    StudentTopicPerformance, StudentSubjectProgress, TestSession
)

logger = logging.getLogger(__name__)

class TopicQuestionBankService:
    """
    Service for managing topic-based question bank.
    
    Key Features:
    1. Extract topics from chapter content during PDF processing
    2. Generate comprehensive questions for each topic
    3. Store questions in MongoDB for reuse across all students
    4. Serve pre-generated questions for tests
    5. Track student performance by topic
    """
    
    QUESTION_BANK = "topic_question_bank"
    STUDENT_TOPIC_PERFORMANCE = "student_topic_performance"
    STUDENT_SUBJECT_PROGRESS = "student_subject_progress"
    TEST_SESSIONS = "test_sessions"
    
    QUESTIONS_PER_TOPIC = 15
    DIFFICULTY_DISTRIBUTION = {"easy": 5, "medium": 6, "hard": 4}
    
    def __init__(self):
        self.gemini = gemini_service
    
    async def extract_topics_from_content(
        self,
        content: str,
        class_level: int,
        subject: str,
        chapter_number: int,
        chapter_name: str
    ) -> List[Dict]:
        """
        Extract topics from chapter content using LLM.
        Called during PDF processing/embedding.
        
        Returns list of topics with page ranges.
        """
        logger.info(f"Extracting topics from {subject} Ch.{chapter_number}: {chapter_name}")
        
        prompt = f"""Analyze this textbook chapter content and identify ALL distinct topics/concepts.

**Content from Class {class_level} {subject}, Chapter {chapter_number}: {chapter_name}**

{content[:15000]}

**TASK:** Extract all major topics/concepts covered in this chapter.

**For each topic, provide:**
1. Topic Name (clear, concise)
2. Brief Description (1-2 sentences)
3. Approximate page range (e.g., "1-3", "4-7")
4. Key concepts covered

**OUTPUT FORMAT (JSON array):**
[
  {{
    "topic_name": "Introduction to Numbers",
    "description": "Basic understanding of numbers and their types",
    "page_range": "1-3",
    "key_concepts": ["natural numbers", "whole numbers", "integers"]
  }},
  ...
]

**RULES:**
- Extract 5-10 topics per chapter
- Topics should be distinct and non-overlapping
- Use student-friendly topic names
- Be accurate with page ranges

Output ONLY the JSON array, no other text."""

        try:
            response = await self.gemini.generate_text(prompt)
            
            json_match = re.search(r'\[.*\]', response, re.DOTALL)
            if json_match:
                topics = json.loads(json_match.group())
                logger.info(f"Extracted {len(topics)} topics from chapter")
                return topics
            else:
                logger.warning("Could not parse topics JSON, using fallback")
                return self._generate_fallback_topics(chapter_name)
                
        except Exception as e:
            logger.error(f"Topic extraction error: {e}")
            return self._generate_fallback_topics(chapter_name)
    
    def _generate_fallback_topics(self, chapter_name: str) -> List[Dict]:
        """Generate fallback topics if extraction fails."""
        return [
            {
                "topic_name": f"{chapter_name} - Overview",
                "description": f"Introduction and overview of {chapter_name}",
                "page_range": "1-5",
                "key_concepts": ["introduction", "basics"]
            },
            {
                "topic_name": f"{chapter_name} - Core Concepts",
                "description": f"Main concepts of {chapter_name}",
                "page_range": "6-15",
                "key_concepts": ["concepts", "applications"]
            },
            {
                "topic_name": f"{chapter_name} - Practice",
                "description": f"Practice problems and exercises",
                "page_range": "16-20",
                "key_concepts": ["practice", "problems"]
            }
        ]
    
    async def generate_questions_for_topic(
        self,
        topic_name: str,
        topic_description: str,
        key_concepts: List[str],
        content_context: str,
        class_level: int,
        subject: str
    ) -> List[TopicQuestion]:
        """
        Generate comprehensive questions for a topic.
        Called during PDF processing.
        
        Generates:
        - 5 Easy questions (recall, basic understanding)
        - 6 Medium questions (application, connection)
        - 4 Hard questions (analysis, evaluation)
        """
        logger.info(f"📝 Generating questions for topic: {topic_name}")
        
        questions = []
        
        for difficulty, count in self.DIFFICULTY_DISTRIBUTION.items():
            batch = await self._generate_question_batch(
                topic_name=topic_name,
                topic_description=topic_description,
                key_concepts=key_concepts,
                content_context=content_context,
                class_level=class_level,
                subject=subject,
                difficulty=difficulty,
                count=count
            )
            questions.extend(batch)
        
        logger.info(f"Generated {len(questions)} questions for {topic_name}")
        return questions
    
    async def _generate_question_batch(
        self,
        topic_name: str,
        topic_description: str,
        key_concepts: List[str],
        content_context: str,
        class_level: int,
        subject: str,
        difficulty: str,
        count: int
    ) -> List[TopicQuestion]:
        """Generate a batch of questions for a specific difficulty."""
        
        difficulty_instructions = {
            "easy": """
                - Simple factual recall questions
                - "What is...", "Name the...", "Define..."
                - Directly answerable from textbook
                - Single concept questions
            """,
            "medium": """
                - Understanding and application questions
                - "Explain why...", "How does...", "Compare..."
                - Requires connecting concepts
                - May need 2-3 sentences to answer
            """,
            "hard": """
                - Analysis and evaluation questions
                - "Analyze...", "Evaluate...", "What would happen if..."
                - Requires deep understanding
                - May need multiple paragraphs to answer
            """
        }
        
        prompt = f"""Generate {count} {difficulty.upper()} level questions for Class {class_level} {subject}.

**Topic:** {topic_name}
**Description:** {topic_description}
**Key Concepts:** {', '.join(key_concepts)}

**Textbook Content:**
{content_context[:5000]}

**Question Requirements for {difficulty.upper()} level:**
{difficulty_instructions[difficulty]}

**OUTPUT FORMAT (JSON array):**
[
  {{
    "question_text": "What is...?",
    "question_type": "recall|conceptual|application|analytical",
    "expected_answer": "The expected answer based on textbook...",
    "keywords": ["keyword1", "keyword2", "keyword3"],
    "marks": 5,
    "time_estimate_seconds": 60
  }},
  ...
]

**RULES:**
- Questions must be answerable from the provided content
- Expected answers should be accurate and complete
- Keywords should help in answer evaluation
- Time estimates: easy=45-60s, medium=90-120s, hard=150-180s
- Marks: easy=5, medium=8, hard=10

Output ONLY the JSON array."""

        try:
            response = self.gemini.generate_response(prompt)
            
            json_match = re.search(r'\[.*\]', response, re.DOTALL)
            if json_match:
                questions_data = json.loads(json_match.group())
                
                questions = []
                for q in questions_data:
                    questions.append(TopicQuestion(
                        question_text=q.get("question_text", ""),
                        question_type=q.get("question_type", "conceptual"),
                        difficulty=difficulty,
                        expected_answer=q.get("expected_answer"),
                        keywords=q.get("keywords", []),
                        marks=q.get("marks", 5 if difficulty == "easy" else 8 if difficulty == "medium" else 10),
                        time_estimate_seconds=q.get("time_estimate_seconds", 60)
                    ))
                return questions
            
            return []
            
        except Exception as e:
            logger.error(f"Question generation error for {difficulty}: {e}")
            return []
    
    async def save_chapter_question_bank(
        self,
        class_level: int,
        subject: str,
        chapter_number: int,
        chapter_name: str,
        topics: List[Topic],
        source_pdf: str = None
    ) -> str:
        """Save complete chapter question bank to MongoDB."""
        
        collection = mongodb.db[self.QUESTION_BANK]
        
        existing = await collection.find_one({
            "class_level": class_level,
            "subject": subject,
            "chapter_number": chapter_number
        })
        
        total_questions = sum(len(t.questions) for t in topics)
        
        bank_doc = {
            "class_level": class_level,
            "subject": subject,
            "chapter_number": chapter_number,
            "chapter_name": chapter_name,
            "topics": [t.model_dump() for t in topics],
            "total_topics": len(topics),
            "total_questions": total_questions,
            "source_pdf": source_pdf,
            "created_at": datetime.utcnow(),
            "last_updated": datetime.utcnow(),
            "is_active": True
        }
        
        if existing:
            await collection.update_one(
                {"_id": existing["_id"]},
                {"$set": bank_doc}
            )
            logger.info(f"Updated question bank for {subject} Ch.{chapter_number}")
            return str(existing["_id"])
        else:
            result = await collection.insert_one(bank_doc)
            logger.info(f"Created question bank for {subject} Ch.{chapter_number}")
            return str(result.inserted_id)
    
    async def get_chapter_question_bank(
        self,
        class_level: int,
        subject: str,
        chapter_number: int
    ) -> Optional[Dict]:
        """Get question bank for a chapter."""
        collection = mongodb.db[self.QUESTION_BANK]
        
        result = await collection.find_one({
            "class_level": class_level,
            "subject": subject,
            "chapter_number": chapter_number,
            "is_active": True
        })
        
        return result
    
    async def get_available_subjects(self, class_level: int) -> List[Dict]:
        """
        Get all subjects available for a class level.
        Checks MongoDB books collection, question bank, AND Pinecone namespaces.
        """
        logger.info(f" get_available_subjects called for class_level={class_level}")
        subjects_map = {}
        
        books_collection = mongodb.db["books"]
        books_pipeline = [
            {"$match": {"class_level": class_level}},
            {"$group": {
                "_id": "$subject",
                "total_chapters": {"$sum": 1}
            }},
            {"$project": {
                "subject": "$_id",
                "total_chapters": 1,
                "_id": 0
            }}
        ]
        
        logger.info(f" Querying books collection with class_level={class_level}")
        books_results = await books_collection.aggregate(books_pipeline).to_list(100)
        logger.info(f"Books query result for class {class_level}: {books_results}")
        for r in books_results:
            subject = r.get("subject", "").title()
            if subject:
                subjects_map[subject] = {
                    "subject": subject,
                    "total_chapters": r.get("total_chapters", 0),
                    "total_questions": 0
                }
        
        if books_results:
            logger.info(f"Found {len(books_results)} subjects in books for class {class_level}")
        
        collection = mongodb.db[self.QUESTION_BANK]
        pipeline = [
            {"$match": {"class_level": class_level, "is_active": True}},
            {"$group": {
                "_id": "$subject",
                "total_chapters": {"$sum": 1},
                "total_questions": {"$sum": "$total_questions"}
            }},
            {"$project": {
                "subject": "$_id",
                "total_chapters": 1,
                "total_questions": 1,
                "_id": 0
            }}
        ]
        
        bank_results = await collection.aggregate(pipeline).to_list(100)
        for r in bank_results:
            subject = r.get("subject", "").title()
            if subject:
                if subject in subjects_map:
                    subjects_map[subject]["total_questions"] = r.get("total_questions", 0)
                else:
                    subjects_map[subject] = {
                        "subject": subject,
                        "total_chapters": r.get("total_chapters", 0),
                        "total_questions": r.get("total_questions", 0)
                    }
        
        if subjects_map:
            results = list(subjects_map.values())
            logger.info(f"Found {len(results)} total subjects for class {class_level}")
            return results
        
        logger.info(f"No subjects found for class {class_level}, checking Pinecone namespaces...")
        
        try:
            from app.db.mongo import namespace_db
            
            if namespace_db.index:
                stats = namespace_db.index.describe_index_stats()
                namespaces = stats.get('namespaces', {})
                
                subjects = []
                for ns_name, ns_stats in namespaces.items():
                    vector_count = ns_stats.get('vector_count', 0)
                    if vector_count > 0:
                        parts = ns_name.split('_')
                        
                        if len(parts) >= 3 and parts[0] == 'class':
                            try:
                                ns_class = int(parts[1])
                                if ns_class == class_level:
                                    subject_name = '_'.join(parts[2:]).replace('-', ' ').title()
                                    if not any(s['subject'].lower() == subject_name.lower() for s in subjects):
                                        subjects.append({
                                            "subject": subject_name,
                                            "total_chapters": max(1, vector_count // 50),
                                            "total_questions": 0
                                        })
                            except ValueError:
                                continue
                        else:
                            logger.debug(f"Skipping namespace {ns_name} - doesn't match class format")
                
                if subjects:
                    logger.info(f"Found {len(subjects)} subjects in Pinecone namespaces for class {class_level}")
                    return subjects
                
        except Exception as e:
            logger.error(f"Error checking Pinecone namespaces: {e}")
        
        logger.warning(f"No subjects found for class {class_level}")
        return []
    
    async def get_chapters_for_subject(
        self,
        class_level: int,
        subject: str,
        student_id: Optional[str] = None
    ) -> List[Dict]:
        """
        Get all chapters for a subject with their topics.
        Checks MongoDB question bank first, then books collection, then Pinecone metadata.
        """
        collection = mongodb.db[self.QUESTION_BANK]
        
        chapters = await collection.find(
            {"class_level": class_level, "subject": subject, "is_active": True},
            {"chapter_number": 1, "chapter_name": 1, "total_topics": 1, "total_questions": 1, "topics.topic_id": 1, "topics.topic_name": 1}
        ).sort("chapter_number", 1).to_list(100)
        
        student_scores = {}
        if student_id:
            perf_collection = mongodb.db[self.STUDENT_TOPIC_PERFORMANCE]
            performances = await perf_collection.find({
                "student_id": student_id,
                "class_level": class_level,
                "subject": subject
            }).to_list(1000)
            
            for p in performances:
                ch_num = p.get("chapter_number")
                if ch_num:
                    if ch_num not in student_scores:
                        student_scores[ch_num] = {"total": 0, "count": 0}
                    student_scores[ch_num]["total"] += p.get("average_score", 0)
                    student_scores[ch_num]["count"] += 1

        result = []
        for ch in chapters:
            avg_score = None
            if student_id and ch["chapter_number"] in student_scores:
                stats = student_scores[ch["chapter_number"]]
                if stats["count"] > 0:
                    avg_score = round(stats["total"] / stats["count"], 1)

            result.append({
                "chapter_number": ch["chapter_number"],
                "chapter_name": ch["chapter_name"],
                "total_topics": ch.get("total_topics", 0),
                "total_questions": ch.get("total_questions", 0),
                "average_score": avg_score,
                "topics": [
                    {"topic_id": t["topic_id"], "topic_name": t["topic_name"]}
                    for t in ch.get("topics", [])
                ]
            })
        
        if result:
            return result
        
        logger.info(f"No chapters in question bank for {subject} class {class_level}, checking books collection...")
        
        try:
            books_collection = mongodb.db["books"]
            books = await books_collection.find(
                {"class_level": class_level, "subject": {"$regex": f"^{subject}$", "$options": "i"}},
                {"chapter_number": 1, "title": 1, "subject": 1}
            ).sort("chapter_number", 1).to_list(100)
            
            if books:
                chapter_info = {}
                for book in books:
                    ch_num = book.get("chapter_number", 1)
                    ch_name = book.get("title", f"Chapter {ch_num}")
                    chapter_key = str(ch_num)
                    if chapter_key not in chapter_info:
                        chapter_info[chapter_key] = {
                            "chapter_number": ch_num,
                            "chapter_name": ch_name,
                            "total_topics": 0,
                            "total_questions": 0,
                            "average_score": None,
                            "topics": []
                        }
                
                result = sorted(chapter_info.values(), key=lambda x: x["chapter_number"])
                if result:
                    logger.info(f"Found {len(result)} chapters from books collection for {subject} class {class_level}")
                    return result
        except Exception as e:
            logger.error(f"Error fetching chapters from books collection: {e}")
        
        logger.info(f"No chapters in books for {subject} class {class_level}, checking Pinecone...")
        
        try:
            from app.db.mongo import namespace_db
            
            if namespace_db.index:
                namespace = namespace_db.get_namespace(subject)
                
                stats = namespace_db.index.describe_index_stats()
                namespaces = stats.get('namespaces', {})
                
                if namespace in namespaces:
                    from app.services.llm_storage_service import llm_storage_service
                    sample_embedding = llm_storage_service._generate_embedding(f"{subject} class {class_level} chapter")
                    
                    results = namespace_db.index.query(
                        vector=sample_embedding,
                        namespace=namespace,
                        top_k=100,
                        filter={"class_level": class_level},
                        include_metadata=True
                    )
                    
                    if not results.get('matches'):
                        results = namespace_db.index.query(
                            vector=sample_embedding,
                            namespace=namespace,
                            top_k=100,
                            include_metadata=True
                        )
                    
                    chapter_info = {}
                    for match in results.get('matches', []):
                        metadata = match.get('metadata', {})
                        chapter_num = metadata.get('chapter_number')
                        book_title = metadata.get('book_title', '')
                        
                        chapter_name = book_title if book_title else f'Chapter {chapter_num}'
                        
                        if chapter_num is not None:
                            chapter_key = str(int(chapter_num))
                            if chapter_key not in chapter_info:
                                chapter_info[chapter_key] = {
                                    "chapter_number": int(chapter_num),
                                    "chapter_name": chapter_name,
                                    "total_topics": 1,
                                    "total_questions": 0,
                                    "topics": []
                                }
                    
                    result = list(chapter_info.values())
                    result.sort(key=lambda x: x["chapter_number"])
                    
                    if result:
                        logger.info(f"Found {len(result)} chapters from Pinecone for {subject}")
                        return result
                        
        except Exception as e:
            logger.error(f"Error fetching chapters from Pinecone: {e}")
        
        logger.warning(f"No chapters found for {subject}")
        return []
    
    async def get_topics_for_chapter(
        self,
        class_level: int,
        subject: str,
        chapter_number: int,
        student_id: str = None
    ) -> List[Dict]:
        """
        Get all topics for a chapter with student performance data.
        Includes recommendations based on weak areas.
        """
        collection = mongodb.db[self.QUESTION_BANK]
        
        chapter = await collection.find_one({
            "class_level": class_level,
            "subject": subject,
            "chapter_number": chapter_number,
            "is_active": True
        })
        
        if not chapter:
            return []
        
        topics = []
        student_performance = {}
        
        if student_id:
            perf_collection = mongodb.db[self.STUDENT_TOPIC_PERFORMANCE]
            perfs = await perf_collection.find({
                "student_id": student_id,
                "class_level": class_level,
                "subject": subject,
                "chapter_number": chapter_number
            }).to_list(100)
            
            for p in perfs:
                student_performance[p["topic_id"]] = {
                    "average_score": p.get("average_score", 0),
                    "tests_taken": p.get("tests_taken", 0),
                    "improvement_trend": p.get("improvement_trend", "stable")
                }
        
        for t in chapter.get("topics", []):
            topic_id = t["topic_id"]
            perf = student_performance.get(topic_id, {})
            
            avg_score = perf.get("average_score", None)
            is_weak = avg_score is not None and avg_score < 60
            is_recommended = is_weak or perf.get("tests_taken", 0) == 0
            
            topics.append({
                "topic_id": topic_id,
                "topic_name": t["topic_name"],
                "topic_description": t.get("topic_description", ""),
                "page_range": t.get("page_range", ""),
                "total_questions": t.get("total_questions", len(t.get("questions", []))),
                "difficulty_distribution": t.get("difficulty_distribution", {}),
                "student_score": avg_score,
                "tests_taken": perf.get("tests_taken", 0),
                "trend": perf.get("improvement_trend", "stable"),
                "is_weak": is_weak,
                "is_recommended": is_recommended
            })
        
        topics.sort(key=lambda x: (not x["is_recommended"], x["topic_name"]))
        
        return topics
    
    async def get_questions_for_test(
        self,
        class_level: int,
        subject: str,
        chapter_number: int,
        topic_id: str,
        num_questions: int = 5,
        difficulty: str = "mixed"
    ) -> Tuple[List[Dict], str]:
        """
        Get pre-generated questions for a test.
        Returns questions from the question bank, NOT from Gemini.
        
        Returns: (questions, topic_name)
        """
        collection = mongodb.db[self.QUESTION_BANK]
        
        chapter = await collection.find_one({
            "class_level": class_level,
            "subject": subject,
            "chapter_number": chapter_number,
            "is_active": True
        })
        
        if not chapter:
            logger.warning(f"No question bank found for {subject} Ch.{chapter_number}")
            return [], ""
        
        topic = None
        for t in chapter.get("topics", []):
            if t["topic_id"] == topic_id:
                topic = t
                break
        
        if not topic:
            logger.warning(f"Topic {topic_id} not found")
            return [], ""
        
        all_questions = topic.get("questions", [])
        topic_name = topic.get("topic_name", "")
        
        if not all_questions:
            logger.warning(f"No questions found for topic {topic_name}")
            return [], topic_name
        
        if difficulty != "mixed":
            filtered = [q for q in all_questions if q.get("difficulty") == difficulty]
            if len(filtered) >= num_questions:
                all_questions = filtered
        
        import random
        if len(all_questions) <= num_questions:
            selected = all_questions
        else:
            if difficulty == "mixed":
                easy = [q for q in all_questions if q.get("difficulty") == "easy"]
                medium = [q for q in all_questions if q.get("difficulty") == "medium"]
                hard = [q for q in all_questions if q.get("difficulty") == "hard"]
                
                n_easy = max(1, int(num_questions * 0.4))
                n_medium = max(1, int(num_questions * 0.4))
                n_hard = num_questions - n_easy - n_medium
                
                selected = []
                selected.extend(random.sample(easy, min(n_easy, len(easy))))
                selected.extend(random.sample(medium, min(n_medium, len(medium))))
                selected.extend(random.sample(hard, min(n_hard, len(hard))))
                
                remaining = num_questions - len(selected)
                if remaining > 0:
                    unused = [q for q in all_questions if q not in selected]
                    selected.extend(random.sample(unused, min(remaining, len(unused))))
            else:
                selected = random.sample(all_questions, num_questions)
        
        random.shuffle(selected)
        
        formatted = []
        for i, q in enumerate(selected):
            formatted.append({
                "question_number": i + 1,
                "question_id": q.get("question_id", str(i)),
                "question_text": q.get("question_text", ""),
                "difficulty": q.get("difficulty", "medium"),
                "question_type": q.get("question_type", "conceptual"),
                "marks": q.get("marks", 5),
                "time_estimate": q.get("time_estimate_seconds", 60)
            })
        
        logger.info(f"Serving {len(formatted)} questions for topic: {topic_name}")
        return formatted, topic_name
    
    async def update_student_performance(
        self,
        student_id: str,
        class_level: int,
        subject: str,
        chapter_number: int,
        topic_id: str,
        topic_name: str,
        score: float,
        questions_attempted: int,
        correct_count: int
    ):
        """Update student's performance on a topic after test completion."""
        collection = mongodb.db[self.STUDENT_TOPIC_PERFORMANCE]
        
        existing = await collection.find_one({
            "student_id": student_id,
            "topic_id": topic_id
        })
        
        now = datetime.utcnow()
        
        if existing:
            tests_taken = existing.get("tests_taken", 0) + 1
            total_questions = existing.get("total_questions_attempted", 0) + questions_attempted
            total_correct = existing.get("correct_answers", 0) + correct_count
            
            old_avg = existing.get("average_score", 0)
            new_avg = (old_avg * (tests_taken - 1) + score) / tests_taken
            
            best = max(existing.get("best_score", 0), score)
            
            history = existing.get("score_history", [])
            history.append({"score": score, "date": now.isoformat()})
            history = history[-10:]
            
            if len(history) >= 3:
                recent = sum(h["score"] for h in history[-3:]) / 3
                older = sum(h["score"] for h in history[:3]) / min(3, len(history))
                if recent > older + 5:
                    trend = "improving"
                elif recent < older - 5:
                    trend = "declining"
                else:
                    trend = "stable"
            else:
                trend = "stable"
            
            await collection.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "tests_taken": tests_taken,
                    "total_questions_attempted": total_questions,
                    "correct_answers": total_correct,
                    "average_score": round(new_avg, 1),
                    "best_score": best,
                    "latest_score": score,
                    "score_history": history,
                    "improvement_trend": trend,
                    "last_attempted": now
                }}
            )
        else:
            await collection.insert_one({
                "student_id": student_id,
                "class_level": class_level,
                "subject": subject,
                "chapter_number": chapter_number,
                "topic_id": topic_id,
                "topic_name": topic_name,
                "tests_taken": 1,
                "total_questions_attempted": questions_attempted,
                "correct_answers": correct_count,
                "average_score": round(score, 1),
                "best_score": score,
                "latest_score": score,
                "score_history": [{"score": score, "date": now.isoformat()}],
                "improvement_trend": "stable",
                "first_attempted": now,
                "last_attempted": now
            })
        
        await self._update_subject_progress(student_id, class_level, subject)
    
    async def _update_subject_progress(
        self,
        student_id: str,
        class_level: int,
        subject: str
    ):
        """Update overall subject progress for a student."""
        perf_collection = mongodb.db[self.STUDENT_TOPIC_PERFORMANCE]
        prog_collection = mongodb.db[self.STUDENT_SUBJECT_PROGRESS]
        
        performances = await perf_collection.find({
            "student_id": student_id,
            "class_level": class_level,
            "subject": subject
        }).to_list(1000)
        
        if not performances:
            return
        
        chapters = set(p["chapter_number"] for p in performances)
        total_topics = len(performances)
        strong = sum(1 for p in performances if p.get("average_score", 0) >= 80)
        moderate = sum(1 for p in performances if 60 <= p.get("average_score", 0) < 80)
        weak = sum(1 for p in performances if p.get("average_score", 0) < 60)
        
        weak_topics = [
            {
                "topic_id": p["topic_id"],
                "topic_name": p["topic_name"],
                "chapter": p["chapter_number"],
                "score": p.get("average_score", 0)
            }
            for p in performances if p.get("average_score", 0) < 60
        ]
        weak_topics.sort(key=lambda x: x["score"])
        
        overall_avg = sum(p.get("average_score", 0) for p in performances) / len(performances)
        total_tests = sum(p.get("tests_taken", 0) for p in performances)
        
        chapter_scores = {}
        for p in performances:
            ch = p["chapter_number"]
            if ch not in chapter_scores:
                chapter_scores[ch] = []
            chapter_scores[ch].append(p.get("average_score", 0))
        
        mastered = [ch for ch, scores in chapter_scores.items() if sum(scores)/len(scores) >= 80]
        
        await prog_collection.update_one(
            {"student_id": student_id, "class_level": class_level, "subject": subject},
            {"$set": {
                "chapters_attempted": list(chapters),
                "chapters_mastered": mastered,
                "total_topics": total_topics,
                "topics_strong": strong,
                "topics_moderate": moderate,
                "topics_weak": weak,
                "weak_topics": weak_topics[:10],
                "overall_average": round(overall_avg, 1),
                "total_tests_taken": total_tests,
                "last_updated": datetime.utcnow()
            }},
            upsert=True
        )
    
    async def get_student_recommendations(
        self,
        student_id: str,
        class_level: int,
        subject: str,
        limit: int = 5
    ) -> List[Dict]:
        """Get topic recommendations for a student based on weak areas."""
        collection = mongodb.db[self.STUDENT_SUBJECT_PROGRESS]
        
        progress = await collection.find_one({
            "student_id": student_id,
            "class_level": class_level,
            "subject": subject
        })
        
        if progress and progress.get("weak_topics"):
            return progress["weak_topics"][:limit]
        
        return await self._get_unstarted_topics(student_id, class_level, subject, limit)
    
    async def _get_unstarted_topics(
        self,
        student_id: str,
        class_level: int,
        subject: str,
        limit: int
    ) -> List[Dict]:
        """Get topics the student hasn't attempted yet."""
        bank_collection = mongodb.db[self.QUESTION_BANK]
        perf_collection = mongodb.db[self.STUDENT_TOPIC_PERFORMANCE]
        
        banks = await bank_collection.find({
            "class_level": class_level,
            "subject": subject,
            "is_active": True
        }).to_list(100)
        
        attempted = await perf_collection.find({
            "student_id": student_id,
            "class_level": class_level,
            "subject": subject
        }, {"topic_id": 1}).to_list(1000)
        
        attempted_ids = {a["topic_id"] for a in attempted}
        
        unstarted = []
        for bank in banks:
            for topic in bank.get("topics", []):
                if topic["topic_id"] not in attempted_ids:
                    unstarted.append({
                        "topic_id": topic["topic_id"],
                        "topic_name": topic["topic_name"],
                        "chapter": bank["chapter_number"],
                        "chapter_name": bank["chapter_name"],
                        "is_new": True
                    })
        
        return unstarted[:limit]
    
    GENERATED_QUESTIONS_COLLECTION = "generated_questions"
    
    async def generate_questions_on_demand(
        self,
        class_level: int,
        subject: str,
        chapter_number: int,
        num_questions: int = 15,
        include_variations: bool = True
    ) -> Dict:
        """
        Generate questions on-demand from Pinecone content.
        
        Flow:
        1. Check MongoDB for existing questions (cache hit)
        2. If not found, retrieve content from Pinecone via RAG
        3. Generate questions with difficulty distribution (40% easy, 40% medium, 20% hard)
        4. Generate validated variations for numerical problems
        5. Store in MongoDB for future students
        6. Return questions
        
        Args:
            class_level: Student's class level (9-12)
            subject: Subject name (Chemistry, Physics, Mathematics)
            chapter_number: Chapter number
            num_questions: Total questions to generate per difficulty
            include_variations: Whether to generate question variations
            
        Returns:
            Dict with questions, difficulty distribution, and generation status
        """
        collection = mongodb.db[self.GENERATED_QUESTIONS_COLLECTION]
        
        cache_key = {
            "class_level": class_level,
            "subject": subject,
            "chapter_number": chapter_number
        }
        
        existing = await collection.find_one(cache_key)
        
        if existing and existing.get("questions"):
            logger.info(f"Cache hit: Found {len(existing['questions'])} questions for {subject} Ch.{chapter_number}")
            
            await collection.update_one(
                {"_id": existing["_id"]},
                {"$set": {"last_used": datetime.utcnow()}}
            )
            
            cached_questions = existing["questions"]
            if len(cached_questions) > num_questions:
                import random
                cached_questions = random.sample(cached_questions, num_questions)
            
            return {
                "status": "cached",
                "questions": cached_questions,
                "total_questions": len(cached_questions),
                "difficulty_distribution": existing.get("difficulty_distribution", {}),
                "generated_at": existing.get("generated_at"),
                "chapter_name": existing.get("chapter_name", f"Chapter {chapter_number}")
            }
        
        logger.info(f"Generating questions for {subject} Ch.{chapter_number}...")
        
        try:
            content = await self._retrieve_chapter_content(class_level, subject, chapter_number)
            
            if not content:
                logger.warning(f"No content found for {subject} Ch.{chapter_number}")
                return {
                    "status": "no_content",
                    "questions": [],
                    "total_questions": 0,
                    "error": "No content available for this chapter"
                }
            chapter_name = content.get("chapter_name", f"Chapter {chapter_number}")
            content_text = content.get("text", "")
            
            difficulty_counts = {
                "easy": max(1, int(num_questions * 0.4)),
                "medium": max(1, int(num_questions * 0.4)),
                "hard": max(1, int(num_questions * 0.2))
            }
            
            all_questions = await self._generate_questions_batch_optimized(
                content_text=content_text,
                class_level=class_level,
                subject=subject,
                chapter_number=chapter_number,
                chapter_name=chapter_name,
                difficulty_distribution=difficulty_counts,
                include_variations=include_variations
            )
            
            difficulty_distribution = {"easy": 0, "medium": 0, "hard": 0}
            for q in all_questions:
                diff = q.get("difficulty", "medium")
                if diff in difficulty_distribution:
                    difficulty_distribution[diff] += 1
            
            if not all_questions:
                logger.error(f"Failed to generate questions for {subject} Ch.{chapter_number}")
                return {
                    "status": "generation_failed",
                    "questions": [],
                    "total_questions": 0,
                    "error": "Question generation failed"
                }
            
            question_doc = {
                **cache_key,
                "chapter_name": chapter_name,
                "questions": [q if isinstance(q, dict) else q.model_dump() for q in all_questions],
                "total_questions": len(all_questions),
                "difficulty_distribution": difficulty_distribution,
                "generated_at": datetime.utcnow(),
                "last_used": datetime.utcnow(),
                "content_length": len(content_text)
            }
            
            if existing:
                await collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": question_doc}
                )
            else:
                await collection.insert_one(question_doc)
            
            logger.info(f"Generated and cached {len(all_questions)} questions for {subject} Ch.{chapter_number}")
            
            return {
                "status": "generated",
                "questions": question_doc["questions"],
                "total_questions": len(all_questions),
                "difficulty_distribution": difficulty_distribution,
                "generated_at": datetime.utcnow().isoformat(),
                "chapter_name": chapter_name
            }
            
        except Exception as e:
            logger.error(f"Error generating questions: {e}")
            return {
                "status": "error",
                "questions": [],
                "total_questions": 0,
                "error": str(e)
            }
    
    async def _retrieve_chapter_content(
        self,
        class_level: int,
        subject: str,
        chapter_number: int
    ) -> Optional[Dict]:
        """Retrieve chapter content from Pinecone using RAG."""
        try:
            from app.db.mongo import namespace_db
            from app.services.llm_storage_service import llm_storage_service
            
            if not namespace_db.index:
                logger.info("Namespace DB not connected, attempting to connect...")
                namespace_db.connect()
                
            if not namespace_db.index:
                logger.error("Failed to connect to Namespace DB")
                return None
            
            namespace = namespace_db.get_namespace(subject)
            logger.info(f"Using namespace '{namespace}' for subject '{subject}'")
            
            query_text = f"{subject} class {class_level} chapter {chapter_number}"
            query_embedding = llm_storage_service._generate_embedding(query_text)
            
            results = namespace_db.index.query(
                vector=query_embedding,
                namespace=namespace,
                top_k=50,
                filter={
                    "chapter_number": chapter_number,
                    "class_level": class_level
                },
                include_metadata=True
            )
            
            logger.info(f"Query for {subject} class {class_level} ch.{chapter_number}: {len(results.get('matches', []))} matches")
            
            if not results.get('matches'):
                logger.info(f"No matches with class filter, trying chapter-only filter...")
                results = namespace_db.index.query(
                    vector=query_embedding,
                    namespace=namespace,
                    top_k=50,
                    filter={"chapter_number": chapter_number},
                    include_metadata=True
                )
                logger.info(f"Chapter-only query: {len(results.get('matches', []))} matches")
            
            if not results.get('matches'):
                logger.info(f"No matches with chapter filter, trying semantic search...")
                results = namespace_db.index.query(
                    vector=query_embedding,
                    namespace=namespace,
                    top_k=50,
                    include_metadata=True
                )
                logger.info(f"Semantic-only query: {len(results.get('matches', []))} matches")
            
            if not results.get('matches'):
                logger.warning(f"No content found in namespace '{namespace}' for any filter")
                return None
            
            chapter_name = ""
            all_text = []
            
            for match in results['matches']:
                metadata = match.get('metadata', {})
                text = metadata.get('text', '')
                if text:
                    all_text.append(text)
                if not chapter_name and metadata.get('book_title'):
                    chapter_name = metadata['book_title']
            
            return {
                "chapter_name": chapter_name or f"Chapter {chapter_number}",
                "text": "\n\n".join(all_text),
                "chunk_count": len(all_text)
            }
            
        except Exception as e:
            logger.error(f"Error retrieving content: {e}")
            return None
    
    async def _generate_questions_batch_optimized(
        self,
        content_text: str,
        class_level: int,
        subject: str,
        chapter_number: int,
        chapter_name: str,
        difficulty_distribution: Dict[str, int],
        include_variations: bool = True
    ) -> List[Dict]:
        """
        Generate questions for ALL difficulties in a single API call.
        Optimized to reduce API usage by 66%.
        """
        
        variation_instructions = """
**IMPORTANT - Question Variations:**
For numerical/calculation problems, generate the base question AND 2-3 variations where:
1. Only the numerical values change (not the concept)
2. The changed values MUST produce calculable, correct answers
3. Include the correct answer for each variation
4. Keep formulas, equations, and any diagrams reference EXACTLY as in the textbook

Example format for numerical questions:
{
  "question_text": "Calculate the molarity of a solution...",
  "is_numerical": true,
  "base_values": {"mass": 40, "volume": 2},
  "expected_answer": "0.5 M",
  "solution_steps": "Molarity = moles/volume = (40/80)/2 = 0.5 M",
  "variations": [
    {
      "values": {"mass": 80, "volume": 4},
      "question_text": "Calculate the molarity... (with 80g in 4L)",
      "expected_answer": "0.25 M",
      "validated": true
    }
  ]
}

For conceptual/theoretical questions, no variations needed.
"""
        
        prompt = f"""Generate questions for Class {class_level} {subject} based on the provided content.
        
**Chapter:** {chapter_name}

**Textbook Content:**
{content_text[:12000]}

**REQUIREMENTS:**
Generate the following number of questions per difficulty:
- EASY: {difficulty_distribution.get('easy', 5)} questions (Simple recall, definitions)
- MEDIUM: {difficulty_distribution.get('medium', 6)} questions (Application, understanding)
- HARD: {difficulty_distribution.get('hard', 4)} questions (Analysis, complex problems)

{variation_instructions if include_variations else ""}

**OUTPUT FORMAT (JSON Object):**
{{
  "easy": [
    {{
      "question_text": "...",
      "question_type": "recall",
      "difficulty": "easy",
      "expected_answer": "...",
      "marks": 5,
      "time_estimate_seconds": 60,
      "keywords": ["..."]
    }},
    ...
  ],
  "medium": [
    {{
      "question_text": "...",
      "question_type": "application",
      "difficulty": "medium",
      "expected_answer": "...",
      "marks": 8,
      "time_estimate_seconds": 120,
      "keywords": ["..."]
    }},
    ...
  ],
  "hard": [
    {{
      "question_text": "...",
      "question_type": "analytical",
      "difficulty": "hard",
      "expected_answer": "...",
      "marks": 10,
      "time_estimate_seconds": 180,
      "keywords": ["..."],
      "variations": [...]
    }},
    ...
  ]
}}

**CRITICAL RULES:**
1. Questions MUST be answerable from the provided content
2. For numerical problems: values in variations MUST produce correct answers
3. Keep ALL formulas, equations exactly as in textbook
4. Include solution_steps for calculation problems
5. Validate that each variation is mathematically correct

Output ONLY the JSON object."""

        try:
            response = self.gemini.generate_response(prompt)
            
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                all_questions_data = json.loads(json_match.group())
                
                validated_questions = []
                
                for difficulty, questions in all_questions_data.items():
                    if difficulty not in ['easy', 'medium', 'hard']:
                        continue
                        
                    for i, q in enumerate(questions):
                        question = {
                            "question_id": q.get("question_id", f"{subject}_{chapter_number}_{difficulty}_{i}"),
                            "question_text": q.get("question_text", ""),
                            "question_type": q.get("question_type", "conceptual"),
                            "difficulty": difficulty,
                            "is_numerical": q.get("is_numerical", False),
                            "expected_answer": q.get("expected_answer", ""),
                            "solution_steps": q.get("solution_steps", ""),
                            "keywords": q.get("keywords", []),
                            "marks": q.get("marks", 5 if difficulty == "easy" else 8 if difficulty == "medium" else 10),
                            "time_estimate_seconds": q.get("time_estimate_seconds", 60),
                            "formulas_used": q.get("formulas_used", []),
                            "variations": []
                        }
                        
                        if include_variations and q.get("variations"):
                            for var in q["variations"]:
                                if var.get("validated", True):
                                    question["variations"].append({
                                        "question_text": var.get("question_text", ""),
                                        "expected_answer": var.get("expected_answer", "")
                                    })
                        
                        validated_questions.append(question)
                
                logger.info(f"Generated {len(validated_questions)} questions in single batch")
                return validated_questions
            
            return []
            
        except Exception as e:
            logger.error(f"Batch question generation error: {e}")
            return []
    
    async def get_cached_questions(
        self,
        class_level: int,
        subject: str,
        chapter_number: int = None,
        difficulty: str = "mixed",
        num_questions: int = 10
    ) -> List[Dict]:
        """
        Get questions from cache for a test.
        If chapter_number is None, gets questions from all chapters.
        """
        collection = mongodb.db[self.GENERATED_QUESTIONS_COLLECTION]
        
        query = {
            "class_level": class_level,
            "subject": subject
        }
        
        if chapter_number:
            query["chapter_number"] = chapter_number
        
        chapters = await collection.find(query).to_list(100)
        
        if not chapters:
            return []
        
        all_questions = []
        for chapter in chapters:
            for q in chapter.get("questions", []):
                q["chapter_number"] = chapter["chapter_number"]
                q["chapter_name"] = chapter.get("chapter_name", "")
                all_questions.append(q)
        
        if difficulty != "mixed":
            all_questions = [q for q in all_questions if q.get("difficulty") == difficulty]
        
        import random
        random.shuffle(all_questions)
        
        final_questions = []
        for q in all_questions[:num_questions]:
            if q.get("variations") and random.random() > 0.5:
                variation = random.choice(q["variations"])
                q_copy = q.copy()
                q_copy["question_text"] = variation["question_text"]
                q_copy["expected_answer"] = variation["expected_answer"]
                q_copy["is_variation"] = True
                final_questions.append(q_copy)
            else:
                final_questions.append(q)
        
        return final_questions
    
    async def check_questions_available(
        self,
        class_level: int,
        subject: str,
        chapter_number: int = None
    ) -> Dict:
        """Check if questions are available in cache."""
        collection = mongodb.db[self.GENERATED_QUESTIONS_COLLECTION]
        
        query = {
            "class_level": class_level,
            "subject": subject
        }
        
        if chapter_number:
            query["chapter_number"] = chapter_number
        
        result = await collection.find_one(query)
        
        if result:
            return {
                "available": True,
                "total_questions": result.get("total_questions", 0),
                "difficulty_distribution": result.get("difficulty_distribution", {}),
                "generated_at": result.get("generated_at"),
                "chapter_name": result.get("chapter_name", "")
            }
        
        return {
            "available": False,
            "total_questions": 0,
            "message": "Questions not yet generated for this content"
        }
    
    CHAPTER_TEST_COLLECTION = "chapter_test_questions"
    
    CHAPTER_TEST_FORMAT = {
        "mcq": {
            "pool_per_variant": 5,
            "marks": 1
        },
        "fillup": {
            "pool_per_variant": 5,
            "marks": 1
        },
        "two_mark": {
            "pool_per_variant": 5,
            "marks": 2
        },
        "total_questions": 15,
        "total_marks": 20,
        "time_limit_minutes": 40,
        "variants_per_difficulty": 10,
        "difficulties": ["easy", "medium", "hard"]
    }
    
    async def check_chapter_test_pool_exists(
        self,
        class_level: int,
        subject: str,
        chapter_number: int
    ) -> Dict:
        """Check if chapter test question pool exists in MongoDB with all 3 variants."""
        collection = mongodb.db[self.CHAPTER_TEST_COLLECTION]
        
        existing = await collection.find_one({
            "class_level": class_level,
            "subject": subject,
            "chapter_number": chapter_number
        })
        
        if existing:
            variants = existing.get("variants", [])
            if len(variants) >= 1:
                v = variants[0]
                has_mcq = len(v.get("mcq_pool", [])) >= 5
                has_fillup = len(v.get("fillup_pool", [])) >= 5
                has_two_mark = len(v.get("two_mark_pool", [])) >= 5
                if has_mcq and has_fillup and has_two_mark:
                    return {
                        "exists": True,
                        "chapter_name": existing.get("chapter_name", ""),
                        "num_variants": len(variants),
                        "generated_at": existing.get("generated_at")
                    }
            
            if len(existing.get("one_mark_pool", [])) >= 10 and len(existing.get("two_mark_pool", [])) >= 5:
                return {
                    "exists": True,
                    "chapter_name": existing.get("chapter_name", ""),
                    "num_variants": 0,
                    "generated_at": existing.get("generated_at")
                }
        
        return {"exists": False}
    
    async def generate_chapter_test_pool(
        self,
        class_level: int,
        subject: str,
        chapter_number: int
    ) -> Dict:
        """
        Generate chapter test question pool with 10 variants per difficulty level.
        
        Each variant has:
        - 5 MCQs × 1 mark = 5 marks
        - 5 Fill-ups × 1 mark = 5 marks  
        - 5 Two-mark × 2 marks = 10 marks
        Total: 15 questions, 20 marks per variant
        
        Structure: {easy: 10 variants, medium: 10 variants, hard: 10 variants}
        Total: 30 variants × 15 = 450 questions stored.
        """
        logger.info(f" Generating chapter test pool (10 variants per difficulty) for {subject} Ch.{chapter_number}...")
        
        collection = mongodb.db[self.CHAPTER_TEST_COLLECTION]
        
        content = await self._retrieve_chapter_content(class_level, subject, chapter_number)
        
        if not content:
            books_collection = mongodb.db["books"]
            book = await books_collection.find_one({
                "class_level": class_level,
                "subject": {"$regex": f"^{subject}$", "$options": "i"},
                "chapter_number": chapter_number
            })
            if book and book.get("content"):
                content = {
                    "chapter_name": book.get("title", f"Chapter {chapter_number}"),
                    "text": book["content"],
                    "chunk_count": 1
                }
        
        if not content:
            logger.error(f"No content found for {subject} Ch.{chapter_number}")
            return {"status": "error", "error": "No chapter content available. Please ensure the book is uploaded and embedded."}
        
        chapter_name = content.get("chapter_name", f"Chapter {chapter_number}")
        content_text = content.get("text", "")
        
        difficulty_variants = await self._generate_all_variants(
            content_text=content_text,
            class_level=class_level,
            subject=subject,
            chapter_name=chapter_name,
            chapter_number=chapter_number
        )
        
        total_variants = sum(len(v) for v in difficulty_variants.values())
        if total_variants == 0:
            return {"status": "error", "error": "Failed to generate questions. Please try again."}
        
        question_stats = {"easy": {}, "medium": {}, "hard": {}}
        for diff in ["easy", "medium", "hard"]:
            variants = difficulty_variants.get(diff, [])
            mcq_total = sum(len(v.get("mcq_pool", [])) for v in variants)
            fillup_total = sum(len(v.get("fillup_pool", [])) for v in variants)
            two_mark_total = sum(len(v.get("two_mark_pool", [])) for v in variants)
            question_stats[diff] = {
                "variants": len(variants),
                "mcq": mcq_total,
                "fillup": fillup_total,
                "two_mark": two_mark_total,
                "total": mcq_total + fillup_total + two_mark_total
            }
        
        pool_doc = {
            "class_level": class_level,
            "subject": subject,
            "chapter_number": chapter_number,
            "chapter_name": chapter_name,
            "variants_by_difficulty": difficulty_variants,
            "variants_count": {
                "easy": len(difficulty_variants.get("easy", [])),
                "medium": len(difficulty_variants.get("medium", [])),
                "hard": len(difficulty_variants.get("hard", []))
            },
            "question_stats": question_stats,
            "format": {
                "mcq_count": 5,
                "fillup_count": 5,
                "two_mark_count": 5,
                "total_questions": 15,
                "total_marks": 20,
                "time_limit_minutes": 40
            },
            "generated_at": datetime.utcnow(),
            "last_used": datetime.utcnow(),
            "usage_count": 0
        }
        
        await collection.update_one(
            {
                "class_level": class_level,
                "subject": subject,
                "chapter_number": chapter_number
            },
            {"$set": pool_doc},
            upsert=True
        )
        
        total_q = sum(stats["total"] for stats in question_stats.values())
        
        logger.info(f"💾 Saved to MongoDB: {subject} Ch.{chapter_number} '{chapter_name}'")
        logger.info(f"   📊 Question Stats Stored:")
        for diff in ["easy", "medium", "hard"]:
            stats = question_stats[diff]
            logger.info(f"      {diff.upper()}: {stats['variants']} variants | "
                       f"MCQ: {stats['mcq']}, Fill-up: {stats['fillup']}, 2-mark: {stats['two_mark']} "
                       f"(Total: {stats['total']})")
        logger.info(f"   📈 Grand Total: {total_variants} variants, {total_q} questions")
        
        return {
            "status": "generated",
            "chapter_name": chapter_name,
            "variants_count": pool_doc['variants_count'],
            "question_stats": question_stats,
            "total_questions": total_q
        }
    
    async def _generate_all_variants(
        self,
        content_text: str,
        class_level: int,
        subject: str,
        chapter_name: str,
        chapter_number: int = 1
    ) -> Dict[str, List[Dict]]:
        """Generate 10 variants per difficulty level (easy, medium, hard) in batches.
        
        Generates 5 variants at a time (2 API calls per difficulty = 10 variants total).
        Returns a dict with keys 'easy', 'medium', 'hard', each containing 10 variants.
        """
        
        all_difficulty_variants = {"easy": [], "medium": [], "hard": []}
        
        PRO_MODEL = "models/gemini-3-pro-preview"
        
        for difficulty in ["easy", "medium", "hard"]:
            difficulty_display = {
                "easy": "Easy (direct recall, definitions, basic facts)",
                "medium": "Medium (understanding, application, some thinking)",
                "hard": "Hard (analysis, higher-order thinking, complex)"
            }[difficulty]
            
            for batch_num in range(5):
                
                prompt = f"""Generate 2 test variants for Class {class_level} {subject} - {chapter_name}.

Content: {content_text[:8000]}

Create EXACTLY 2 unique variants at {difficulty_display} level. Each variant needs:
- 5 MCQs (4 options A-D, 1 correct)
- 5 Fill-in-the-blanks  
- 5 Two-mark short answers

{difficulty.upper()} level: {self._get_difficulty_guidelines(difficulty)[:400]}

RULES:
- Questions from textbook content only
- MCQs: 4 options, clear correct answer
- Fill-ups: single word/phrase answer
- Include "topic" field for each question
- Each variant must have DIFFERENT questions

OUTPUT JSON ONLY (no markdown):
{{"variants": [
  {{"variant_id": {batch_num * 2 + 1}, "mcq": [{{"question_text": "...", "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}}, "correct_option": "A", "expected_answer": "...", "topic": "...", "keywords": ["k1"]}}], "fillup": [{{"question_text": "... _____ ...", "expected_answer": "...", "topic": "...", "keywords": ["k1"]}}], "two_mark": [{{"question_text": "...", "expected_answer": "2-3 sentence answer", "topic": "...", "keywords": ["k1"]}}]}},
  {{"variant_id": {batch_num * 2 + 2}, "mcq": [...], "fillup": [...], "two_mark": [...]}}
]}}"""

                try:
                    logger.info(f"Generating {difficulty} variants batch {batch_num + 1}/5 for {subject} Ch.{chapter_number} (using Gemini 3 Pro)...")
                    response = self.gemini.generate_response(
                        prompt, 
                        max_output_tokens=16384,
                        model_name=PRO_MODEL
                    )
                    
                    data = self._extract_json_from_response(response, f"{difficulty}_batch{batch_num + 1}")
                    
                    if not data:
                        logger.error(f"Failed to parse {difficulty} batch {batch_num + 1}/5 JSON from Gemini response")
                        continue
                    
                    raw_variants = data.get("variants", [])
                    
                    if not raw_variants:
                        logger.error(f"No {difficulty} variants found in batch {batch_num + 1}/5")
                        continue
                    
                    mcq_count_batch = 0
                    fillup_count_batch = 0
                    two_mark_count_batch = 0
                    
                    for v_idx, variant in enumerate(raw_variants):
                        global_v_idx = batch_num * 2 + v_idx
                        timestamp = datetime.utcnow().timestamp()
                        prefix = f"{subject.lower().replace(' ', '_')}_ch{chapter_number}"
                        
                        mcq_pool = []
                        for i, q in enumerate(variant.get("mcq", [])):
                            if not q.get("question_text") or not q.get("expected_answer"):
                                continue
                            mcq_pool.append({
                                "question_id": f"{prefix}_{difficulty}_mcq_v{global_v_idx}_{i}_{timestamp}",
                                "question_text": q["question_text"],
                                "question_type": "mcq",
                                "options": q.get("options", {}),
                                "correct_option": q.get("correct_option", ""),
                                "expected_answer": q["expected_answer"],
                                "topic": q.get("topic", chapter_name),
                                "difficulty": difficulty,
                                "keywords": q.get("keywords", []),
                                "marks": 1
                            })
                        
                        fillup_pool = []
                        for i, q in enumerate(variant.get("fillup", [])):
                            if not q.get("question_text") or not q.get("expected_answer"):
                                continue
                            fillup_pool.append({
                                "question_id": f"{prefix}_{difficulty}_fillup_v{global_v_idx}_{i}_{timestamp}",
                                "question_text": q["question_text"],
                                "question_type": "fillup",
                                "expected_answer": q["expected_answer"],
                                "topic": q.get("topic", chapter_name),
                                "difficulty": difficulty,
                                "keywords": q.get("keywords", []),
                                "marks": 1
                            })
                        
                        two_mark_pool = []
                        for i, q in enumerate(variant.get("two_mark", [])):
                            if not q.get("question_text") or not q.get("expected_answer"):
                                continue
                            two_mark_pool.append({
                                "question_id": f"{prefix}_{difficulty}_2mark_v{global_v_idx}_{i}_{timestamp}",
                                "question_text": q["question_text"],
                                "question_type": "two_mark",
                                "expected_answer": q["expected_answer"],
                                "topic": q.get("topic", chapter_name),
                                "difficulty": difficulty,
                                "keywords": q.get("keywords", []),
                                "marks": 2,
                                "solution_steps": q.get("solution_steps", "")
                            })
                        
                        mcq_count_batch += len(mcq_pool)
                        fillup_count_batch += len(fillup_pool)
                        two_mark_count_batch += len(two_mark_pool)
                        
                        all_difficulty_variants[difficulty].append({
                            "variant_id": global_v_idx + 1,
                            "mcq_pool": mcq_pool,
                            "fillup_pool": fillup_pool,
                            "two_mark_pool": two_mark_pool,
                            "total_questions": len(mcq_pool) + len(fillup_pool) + len(two_mark_pool)
                        })
                    
                    logger.info(f"✅ Batch {batch_num + 1}/5 complete: {len(raw_variants)} variants | "
                               f"MCQ={mcq_count_batch}, Fill-up={fillup_count_batch}, 2-mark={two_mark_count_batch}")
                    
                except json.JSONDecodeError as e:
                    logger.error(f"JSON parse error in {difficulty} batch {batch_num + 1}/5: {e}")
                    continue
                except Exception as e:
                    logger.error(f"Error generating {difficulty} batch {batch_num + 1}/5: {e}")
                    continue
            
            total_variants = len(all_difficulty_variants[difficulty])
            if total_variants > 0:
                mcq_total = sum(len(v.get("mcq_pool", [])) for v in all_difficulty_variants[difficulty])
                fillup_total = sum(len(v.get("fillup_pool", [])) for v in all_difficulty_variants[difficulty])
                two_mark_total = sum(len(v.get("two_mark_pool", [])) for v in all_difficulty_variants[difficulty])
                logger.info(f"✅ {difficulty.upper()} complete: {total_variants} variants | "
                           f"MCQ={mcq_total}, Fill-up={fillup_total}, 2-mark={two_mark_total} "
                           f"(Total: {mcq_total + fillup_total + two_mark_total} questions)")
            else:
                logger.warning(f"⚠️ {difficulty.upper()}: 0 variants generated!")
        
        total_variants = sum(len(v) for v in all_difficulty_variants.values())
        logger.info(f"📊 Question Generation Summary for {subject} Ch.{chapter_number}:")
        for diff in ["easy", "medium", "hard"]:
            variants = all_difficulty_variants[diff]
            if variants:
                mcq_total = sum(len(v.get("mcq_pool", [])) for v in variants)
                fillup_total = sum(len(v.get("fillup_pool", [])) for v in variants)
                two_mark_total = sum(len(v.get("two_mark_pool", [])) for v in variants)
                logger.info(f"   {diff.upper()}: {len(variants)} variants | MCQ: {mcq_total}, Fill-up: {fillup_total}, 2-mark: {two_mark_total}")
            else:
                logger.warning(f"   {diff.upper()}: 0 variants generated!")
        
        return all_difficulty_variants
    
    def _extract_json_from_response(self, response: str, difficulty: str) -> Dict:
        """Extract and parse JSON from Gemini response with multiple fallback strategies."""
        if not response:
            logger.error(f"Empty response received for {difficulty} variants")
            return None
        
        logger.debug(f"{difficulty.upper()} response preview (first 1000 chars): {response[:1000]}")
        
        try:
            return json.loads(response.strip())
        except json.JSONDecodeError:
            pass
        
        cleaned = response.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass
        
        try:
            start_idx = response.find('{')
            if start_idx == -1:
                logger.error(f"No opening brace found in {difficulty} response")
                return None
            
            brace_count = 0
            end_idx = start_idx
            for i, char in enumerate(response[start_idx:], start_idx):
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end_idx = i + 1
                        break
            
            if end_idx > start_idx:
                json_str = response[start_idx:end_idx]
                logger.debug(f"Extracted JSON length: {len(json_str)} chars")
                return json.loads(json_str)
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Strategy 3 failed: {e}")
            pass
        
        try:
            json_match = re.search(r'\{[\s\S]*"variants"[\s\S]*\}', response)
            if json_match:
                return json.loads(json_match.group())
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Strategy 4 failed: {e}")
            pass
        
        try:
            start_idx = cleaned.find('{"variants":')
            if start_idx == -1:
                start_idx = cleaned.find('{')
            
            if start_idx != -1:
                json_part = cleaned[start_idx:]
                
                variant_pattern = r'\{\s*"variant_id"\s*:\s*\d+[^}]*(?:\{[^}]*\}[^}]*)*\}'
                variants = re.findall(variant_pattern, json_part, re.DOTALL)
                
                if variants:
                    reconstructed = '{"variants": [' + ','.join(variants) + ']}'
                    try:
                        return json.loads(reconstructed)
                    except json.JSONDecodeError:
                        pass
                
                open_brackets = json_part.count('[') - json_part.count(']')
                open_braces = json_part.count('{') - json_part.count('}')
                
                fixed = json_part + ']' * max(0, open_brackets) + '}' * max(0, open_braces)
                try:
                    result = json.loads(fixed)
                    logger.warning(f"Salvaged truncated JSON by closing {open_brackets} brackets, {open_braces} braces")
                    return result
                except json.JSONDecodeError:
                    pass
        except Exception as e:
            logger.error(f"Strategy 5 (salvage) failed: {e}")
            pass
        
        logger.error(f"All JSON extraction strategies failed for {difficulty} response")
        logger.error(f"Response length: {len(response)} chars")
        logger.error(f"Response starts with: {response[:200]}")
        logger.error(f"Response ends with: {response[-200:]}")
        return None
    
    def _get_difficulty_guidelines(self, difficulty: str) -> str:
        """Return specific guidelines for each difficulty level."""
        guidelines = {
            "easy": """
- Direct recall questions from the text
- Simple definitions and facts
- Basic terminology identification
- Straightforward fill-in-the-blanks with obvious answers
- Questions that can be answered directly by reading the text
- No complex calculations or multi-step reasoning required""",
            "medium": """
- Application of concepts to simple scenarios
- Understanding relationships between concepts  
- Moderate fill-in-the-blanks requiring understanding
- Questions requiring interpretation of information
- Simple calculations or single-step problem solving
- Connecting two or more related concepts""",
            "hard": """
- Analysis and evaluation questions
- Complex problem-solving requiring multiple steps
- Higher-order thinking and critical reasoning
- Application to new/unfamiliar scenarios
- Multi-concept questions requiring integration
- Challenging calculations or abstract reasoning
- "Why" and "How" questions requiring deep understanding"""
        }
        return guidelines.get(difficulty, guidelines["medium"])
    
    def _has_valid_answer(self, question: Dict) -> bool:
        """Check if question has a valid expected answer."""
        answer = question.get("expected_answer", "")
        if not answer:
            return False
        return len(str(answer).strip()) >= 10
    
    async def select_chapter_test_questions(
        self,
        class_level: int,
        subject: str,
        chapter_number: int,
        student_id: str = None,
        difficulty: str = "medium"
    ) -> Dict:
        """
        Select 15 questions from a variant for a chapter test based on difficulty.
        - Student selects difficulty level (easy/medium/hard)
        - All 15 questions are of the same difficulty
        - 5 MCQ questions (1 mark each, with options)
        - 5 Fill-in-the-blank questions (1 mark each)
        - 5 Two-mark questions (2 marks each)
        - Total: 20 marks, 40 minutes
        
        Variant is selected based on student's previous attempt count
        so repeat tests get different questions.
        
        Returns: Dict with questions, chapter info, and test parameters
        """
        collection = mongodb.db[self.CHAPTER_TEST_COLLECTION]
        
        if difficulty not in ["easy", "medium", "hard"]:
            difficulty = "medium"
        
        pool = await collection.find_one({
            "class_level": class_level,
            "subject": subject,
            "chapter_number": chapter_number
        })
        
        if not pool:
            return {"status": "error", "error": "Question pool not found"}
        
        variants_by_difficulty = pool.get("variants_by_difficulty", {})
        
        if variants_by_difficulty and difficulty in variants_by_difficulty:
            difficulty_variants = variants_by_difficulty[difficulty]
            
            if not difficulty_variants:
                return {"status": "error", "error": f"No {difficulty} variants available"}
            
            variant_index = 0
            if student_id:
                attempt_count = await mongodb.db.test_sessions.count_documents({
                    "student_id": student_id,
                    "class_level": class_level,
                    "subject": subject,
                    "chapter_number": chapter_number,
                    "difficulty": difficulty,
                    "test_type": {"$in": ["chapter_test", "ai_with_topics"]}
                })
                variant_index = attempt_count % len(difficulty_variants)
            
            variant = difficulty_variants[variant_index]
            mcq_pool = variant.get("mcq_pool", [])
            fillup_pool = variant.get("fillup_pool", [])
            two_mark_pool = variant.get("two_mark_pool", [])
            
            logger.info(f" Using {difficulty.upper()} variant {variant_index + 1}/{len(difficulty_variants)} for student {student_id}")
            
            formatted_questions = []
            q_num = 1
            
            for q in mcq_pool:
                formatted_questions.append({
                    "question_number": q_num,
                    "question_id": q.get("question_id", f"mcq_{q_num}"),
                    "question_text": q.get("question_text", ""),
                    "difficulty": difficulty,
                    "question_type": "mcq",
                    "marks": 1,
                    "time_estimate": 90,
                    "options": q.get("options", {}),
                    "correct_option": q.get("correct_option", ""),
                    "expected_answer": q.get("expected_answer", ""),
                    "keywords": q.get("keywords", []),
                    "topic": q.get("topic", "")
                })
                q_num += 1
            
            for q in fillup_pool:
                formatted_questions.append({
                    "question_number": q_num,
                    "question_id": q.get("question_id", f"fillup_{q_num}"),
                    "question_text": q.get("question_text", ""),
                    "difficulty": difficulty,
                    "question_type": "fillup",
                    "marks": 1,
                    "time_estimate": 60,
                    "expected_answer": q.get("expected_answer", ""),
                    "keywords": q.get("keywords", []),
                    "topic": q.get("topic", "")
                })
                q_num += 1
            
            for q in two_mark_pool:
                formatted_questions.append({
                    "question_number": q_num,
                    "question_id": q.get("question_id", f"2mark_{q_num}"),
                    "question_text": q.get("question_text", ""),
                    "difficulty": difficulty,
                    "question_type": "two_mark",
                    "marks": 2,
                    "time_estimate": 150,
                    "expected_answer": q.get("expected_answer", ""),
                    "keywords": q.get("keywords", []),
                    "solution_steps": q.get("solution_steps", ""),
                    "topic": q.get("topic", "")
                })
                q_num += 1
        elif pool.get("variants"):
            variants = pool.get("variants", [])
            variant_index = 0
            if student_id:
                attempt_count = await mongodb.db.test_sessions.count_documents({
                    "student_id": student_id,
                    "class_level": class_level,
                    "subject": subject,
                    "chapter_number": chapter_number,
                    "test_type": {"$in": ["chapter_test", "ai_with_topics"]}
                })
                variant_index = attempt_count % len(variants)
            
            variant = variants[variant_index]
            mcq_pool = variant.get("mcq_pool", [])
            fillup_pool = variant.get("fillup_pool", [])
            two_mark_pool = variant.get("two_mark_pool", [])
            
            formatted_questions = []
            q_num = 1
            
            for q in mcq_pool:
                formatted_questions.append({
                    "question_number": q_num,
                    "question_id": q.get("question_id", f"mcq_{q_num}"),
                    "question_text": q.get("question_text", ""),
                    "difficulty": q.get("difficulty", "medium"),
                    "question_type": "mcq",
                    "marks": 1,
                    "time_estimate": 90,
                    "options": q.get("options", {}),
                    "correct_option": q.get("correct_option", ""),
                    "expected_answer": q.get("expected_answer", ""),
                    "keywords": q.get("keywords", []),
                    "topic": q.get("topic", "")
                })
                q_num += 1
            
            for q in fillup_pool:
                formatted_questions.append({
                    "question_number": q_num,
                    "question_id": q.get("question_id", f"fillup_{q_num}"),
                    "question_text": q.get("question_text", ""),
                    "difficulty": q.get("difficulty", "medium"),
                    "question_type": "fillup",
                    "marks": 1,
                    "time_estimate": 60,
                    "expected_answer": q.get("expected_answer", ""),
                    "keywords": q.get("keywords", []),
                    "topic": q.get("topic", "")
                })
                q_num += 1
            
            for q in two_mark_pool:
                formatted_questions.append({
                    "question_number": q_num,
                    "question_id": q.get("question_id", f"2mark_{q_num}"),
                    "question_text": q.get("question_text", ""),
                    "difficulty": q.get("difficulty", "medium"),
                    "question_type": "two_mark",
                    "marks": 2,
                    "time_estimate": 150,
                    "expected_answer": q.get("expected_answer", ""),
                    "keywords": q.get("keywords", []),
                    "solution_steps": q.get("solution_steps", ""),
                    "topic": q.get("topic", "")
                })
                q_num += 1
        else:
            import random
            one_mark_pool = pool.get("one_mark_pool", [])
            two_mark_pool_legacy = pool.get("two_mark_pool", [])
            
            if len(one_mark_pool) < 10 or len(two_mark_pool_legacy) < 5:
                return {"status": "error", "error": "Insufficient questions in pool"}
            
            selected_one = random.sample(one_mark_pool, 10)
            selected_two = random.sample(two_mark_pool_legacy, 5)
            all_questions = selected_one + selected_two
            random.shuffle(all_questions)
            
            formatted_questions = []
            for i, q in enumerate(all_questions):
                formatted_questions.append({
                    "question_number": i + 1,
                    "question_id": q.get("question_id", f"q_{i}"),
                    "question_text": q.get("question_text", ""),
                    "difficulty": q.get("difficulty", "medium"),
                    "question_type": q.get("question_type", "conceptual"),
                    "marks": q.get("marks", 1),
                    "time_estimate": 120 if q.get("marks", 1) == 2 else 90,
                    "expected_answer": q.get("expected_answer", ""),
                    "keywords": q.get("keywords", []),
                    "solution_steps": q.get("solution_steps", "")
                })
        
        await collection.update_one(
            {"_id": pool["_id"]},
            {
                "$set": {"last_used": datetime.utcnow()},
                "$inc": {"usage_count": 1}
            }
        )
        
        mcq_count = len([q for q in formatted_questions if q["question_type"] == "mcq"])
        fillup_count = len([q for q in formatted_questions if q["question_type"] == "fillup"])
        two_mark_count = len([q for q in formatted_questions if q["question_type"] == "two_mark"])
        
        logger.info(f"📚 Retrieved from MongoDB (no Gemini call): {subject} Ch.{chapter_number}")
        logger.info(f"   Selected {len(formatted_questions)} {difficulty.upper()} questions: "
                     f"MCQ={mcq_count}, Fill-up={fillup_count}, 2-mark={two_mark_count}")
        
        return {
            "status": "success",
            "chapter_name": pool.get("chapter_name", f"Chapter {chapter_number}"),
            "questions": formatted_questions,
            "total_questions": len(formatted_questions),
            "total_marks": 20,
            "time_limit_minutes": 40,
            "difficulty": difficulty,
            "mcq_count": mcq_count,
            "fillup_count": fillup_count,
            "two_mark_count": two_mark_count
        }
    
    async def generate_questions_with_topic_tagging(
        self,
        class_level: int,
        subject: str,
        chapter_number: int,
        num_questions: int = 15,
        student_id: str = None
    ) -> Dict:
        """
        Generate questions with automatic topic tagging for AI tests.
        This method:
        1. Retrieves chapter content from Pinecone
        2. Asks Gemini to identify main topics in the chapter
        3. Generates questions and tags each with its relevant topic
        4. Returns questions with topic metadata for topic-level analytics
        
        Returns questions with topic_id and topic_name for each question.
        """
        logger.info(f"Generating topic-tagged questions for {subject} Ch.{chapter_number}")
        
        try:
            content = await self._retrieve_chapter_content(class_level, subject, chapter_number)
            
            if not content:
                return {
                    "status": "no_content",
                    "questions": [],
                    "error": "No content available for this chapter"
                }
            
            chapter_name = content.get("chapter_name", f"Chapter {chapter_number}")
            content_text = content.get("text", "")
            
            previous_questions = await self._get_previous_questions(
                student_id=student_id,
                subject=subject,
                chapter_number=chapter_number
            ) if student_id else []
            
            questions_with_topics = await self._generate_topic_tagged_questions(
                content_text=content_text,
                class_level=class_level,
                subject=subject,
                chapter_number=chapter_number,
                chapter_name=chapter_name,
                num_questions=num_questions,
                previous_questions=previous_questions
            )
            
            if not questions_with_topics:
                return {
                    "status": "generation_failed",
                    "questions": [],
                    "error": "Failed to generate questions"
                }
            
            unique_topics = {}
            for q in questions_with_topics:
                topic_id = q.get("topic_id")
                if topic_id and topic_id not in unique_topics:
                    unique_topics[topic_id] = q.get("topic_name", "Unknown Topic")
            
            logger.info(f"Generated {len(questions_with_topics)} questions covering {len(unique_topics)} topics")
            
            return {
                "status": "generated",
                "questions": questions_with_topics,
                "total_questions": len(questions_with_topics),
                "chapter_name": chapter_name,
                "topics_covered": [{"topic_id": tid, "topic_name": tname} for tid, tname in unique_topics.items()],
                "generated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error generating topic-tagged questions: {e}")
            return {
                "status": "error",
                "questions": [],
                "error": str(e)
            }
    
    async def _get_previous_questions(
        self,
        student_id: str,
        subject: str,
        chapter_number: int
    ) -> List[str]:
        """Fetch question texts from previous test sessions for this student+chapter to avoid repetition."""
        try:
            if mongodb.db is None:
                return []
            
            previous_sessions = await mongodb.db.test_sessions.find(
                {
                    "student_id": student_id,
                    "subject": {"$regex": f"^{re.escape(subject)}$", "$options": "i"},
                    "chapter_number": chapter_number,
                    "test_type": "ai_with_topics",
                    "status": {"$in": ["completed", "started"]}
                },
                {"questions_served": 1}
            ).sort("started_at", -1).limit(3).to_list(length=3)
            
            prev_questions = []
            for session in previous_sessions:
                for q in session.get("questions_served", []):
                    q_text = q.get("question_text", "").strip()
                    if q_text and q_text not in prev_questions:
                        prev_questions.append(q_text)
            
            logger.info(f"Found {len(prev_questions)} previous questions for student {student_id} on {subject} Ch.{chapter_number}")
            return prev_questions
            
        except Exception as e:
            logger.warning(f"Could not fetch previous questions: {e}")
            return []
    
    async def _generate_topic_tagged_questions(
        self,
        content_text: str,
        class_level: int,
        subject: str,
        chapter_number: int,
        chapter_name: str,
        num_questions: int,
        previous_questions: List[str] = None
    ) -> List[Dict]:
        """
        Generate structured questions (5 MCQ + 5 Fill-up + 5 Short Answer) with topic tagging.
        Each type has difficulty distribution: 2 easy, 2 medium, 1 hard.
        """
        
        avoid_section = ""
        if previous_questions:
            prev_list = "\n".join([f"- {q}" for q in previous_questions[:30]])
            avoid_section = f"""
**PREVIOUSLY ASKED QUESTIONS (DO NOT REPEAT THESE — generate completely different questions):**
{prev_list}

"""
        
        prompt = f"""You are an expert question paper setter for Class {class_level} {subject}.

**Chapter:** {chapter_name}

**Textbook Content:**
{content_text[:15000]}

{avoid_section}**TASK:**
1. Identify 3-5 main TOPICS/CONCEPTS covered in this content
2. Generate a structured test paper with these sections:
   - 5 MCQs (Multiple Choice - 4 options, 1 correct) → 1 mark each
   - 5 Fill-in-the-blanks → 1 mark each
   - 5 Short answer questions → 2 marks each
3. Tag EACH question with the specific topic it belongs to

**DIFFICULTY DISTRIBUTION (for each question type):**
- 2 Easy questions (recall, definitions, basic facts)
- 2 Medium questions (understanding, application)
- 1 Hard question (analysis, higher-order thinking)

**OUTPUT FORMAT (JSON):**
{{
  "topics": [
    {{"topic_id": "topic_1", "topic_name": "Specific Topic Name"}},
    {{"topic_id": "topic_2", "topic_name": "Another Specific Topic"}}
  ],
  "mcq": [
    {{
      "question_text": "Which of the following...",
      "options": {{"A": "option1", "B": "option2", "C": "option3", "D": "option4"}},
      "correct_option": "B",
      "expected_answer": "option2",
      "topic_id": "topic_1",
      "topic_name": "Specific Topic Name",
      "difficulty": "easy",
      "keywords": ["keyword1"]
    }}
  ],
  "fillup": [
    {{
      "question_text": "The process of ______ is used to...",
      "expected_answer": "photosynthesis",
      "topic_id": "topic_2",
      "topic_name": "Another Specific Topic",
      "difficulty": "easy",
      "keywords": ["photosynthesis"]
    }}
  ],
  "two_mark": [
    {{
      "question_text": "Explain the significance of...",
      "expected_answer": "Detailed answer explaining the concept in 2-4 sentences...",
      "topic_id": "topic_1",
      "topic_name": "Specific Topic Name",
      "difficulty": "easy",
      "keywords": ["keyword1", "keyword2"]
    }}
  ]
}}

**CRITICAL RULES:**
1. Each question MUST have a topic_id and topic_name — topics should be SPECIFIC (e.g., "Photosynthesis Process" not "Biology Concepts")
2. MCQs must have exactly 4 options (A, B, C, D) with exactly 1 correct answer
3. Fill-ups must have a clear single correct answer (the blank word/phrase)
4. Two-mark questions need detailed answers (2-4 sentences)
5. ALL questions must be directly answerable from the provided textbook content
6. Distribute questions across ALL identified topics
7. Generate exactly 5 questions per type (15 total)
8. For numerical subjects: include calculation-based questions

Output ONLY the JSON object, no other text."""

        try:
            response = self.gemini.generate_response(prompt, max_output_tokens=8000)
            
            cleaned = response.strip()
            if cleaned.startswith("```"):
                first_newline = cleaned.find('\n')
                if first_newline != -1:
                    cleaned = cleaned[first_newline + 1:]
                if cleaned.rstrip().endswith("```"):
                    cleaned = cleaned.rstrip()[:-3].rstrip()
            
            start_idx = cleaned.find('{')
            end_idx = cleaned.rfind('}')
            if start_idx == -1 or end_idx == -1 or end_idx <= start_idx:
                logger.error(f"Could not parse JSON from Gemini response (length={len(response)})")
                logger.debug(f"Response preview: {response[:500]}")
                return []
            json_str = cleaned[start_idx:end_idx + 1]
            
            json_str = re.sub(r',\s*([}\]])', r'\1', json_str)
            json_str = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', json_str)
            
            try:
                data = json.loads(json_str)
            except json.JSONDecodeError as parse_err:
                logger.warning(f"Initial JSON parse failed: {parse_err}")
                json_str = json_str.replace('\n', '\\n').replace('\t', '\\t')
                json_str = json_str.replace('\\n{', '\n{').replace('\\n[', '\n[')
                json_str = json_str.replace('}\\n', '}\n').replace(']\\n', ']\n')
                json_str = json_str.replace(',\\n', ',\n').replace(':\\n', ':\n')
                try:
                    data = json.loads(json_str)
                except json.JSONDecodeError as parse_err2:
                    logger.error(f"JSON parse failed after cleanup: {parse_err2}")
                    logger.error(f"Problematic JSON around char {parse_err2.pos}: ...{json_str[max(0,parse_err2.pos-100):parse_err2.pos+100]}...")
                    return []
            
            topics = data.get("topics", [])
            logger.info(f"Gemini identified {len(topics)} topics: {[t['topic_name'] for t in topics]}")
            
            formatted_questions = []
            mcq_questions = data.get("mcq", [])
            for i, q in enumerate(mcq_questions[:5]):
                formatted_questions.append({
                    "question_id": f"{subject}_{chapter_number}_mcq_{i}_{uuid.uuid4().hex[:6]}",
                    "question_text": q.get("question_text", ""),
                    "topic_id": q.get("topic_id", "general"),
                    "topic_name": q.get("topic_name", "General"),
                    "difficulty": q.get("difficulty", "medium"),
                    "question_type": "mcq",
                    "options": q.get("options", {}),
                    "correct_option": q.get("correct_option", ""),
                    "expected_answer": q.get("expected_answer", ""),
                    "keywords": q.get("keywords", []),
                    "marks": 1,
                    "time_estimate_seconds": 60,
                    "chapter_number": chapter_number,
                    "chapter_name": chapter_name
                })
            
            fillup_questions = data.get("fillup", [])
            for i, q in enumerate(fillup_questions[:5]):
                formatted_questions.append({
                    "question_id": f"{subject}_{chapter_number}_fillup_{i}_{uuid.uuid4().hex[:6]}",
                    "question_text": q.get("question_text", ""),
                    "topic_id": q.get("topic_id", "general"),
                    "topic_name": q.get("topic_name", "General"),
                    "difficulty": q.get("difficulty", "medium"),
                    "question_type": "fillup",
                    "expected_answer": q.get("expected_answer", ""),
                    "keywords": q.get("keywords", []),
                    "marks": 1,
                    "time_estimate_seconds": 45,
                    "chapter_number": chapter_number,
                    "chapter_name": chapter_name
                })
            
            two_mark_questions = data.get("two_mark", [])
            for i, q in enumerate(two_mark_questions[:5]):
                formatted_questions.append({
                    "question_id": f"{subject}_{chapter_number}_2mark_{i}_{uuid.uuid4().hex[:6]}",
                    "question_text": q.get("question_text", ""),
                    "topic_id": q.get("topic_id", "general"),
                    "topic_name": q.get("topic_name", "General"),
                    "difficulty": q.get("difficulty", "medium"),
                    "question_type": "short_answer",
                    "expected_answer": q.get("expected_answer", ""),
                    "keywords": q.get("keywords", []),
                    "marks": 2,
                    "time_estimate_seconds": 120,
                    "chapter_number": chapter_number,
                    "chapter_name": chapter_name
                })
            
            logger.info(f"Formatted {len(formatted_questions)} questions: {len(mcq_questions[:5])} MCQ, {len(fillup_questions[:5])} Fill-up, {len(two_mark_questions[:5])} Short Answer")
            
            return formatted_questions
            
        except Exception as e:
            logger.error(f"Error in topic-tagged question generation: {e}")
            return []

topic_question_bank_service = TopicQuestionBankService()
