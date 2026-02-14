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
    
    # Collection names
    QUESTION_BANK = "topic_question_bank"
    STUDENT_TOPIC_PERFORMANCE = "student_topic_performance"
    STUDENT_SUBJECT_PROGRESS = "student_subject_progress"
    TEST_SESSIONS = "test_sessions"
    
    # Question generation config
    QUESTIONS_PER_TOPIC = 15  # Generate 15 questions per topic
    DIFFICULTY_DISTRIBUTION = {"easy": 5, "medium": 6, "hard": 4}
    
    def __init__(self):
        self.gemini = gemini_service
    
    # ==================== TOPIC EXTRACTION ====================
    
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
        logger.info(f"📚 Extracting topics from {subject} Ch.{chapter_number}: {chapter_name}")
        
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
            
            # Parse JSON from response
            json_match = re.search(r'\[.*\]', response, re.DOTALL)
            if json_match:
                topics = json.loads(json_match.group())
                logger.info(f"✅ Extracted {len(topics)} topics from chapter")
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
    
    # ==================== QUESTION GENERATION ====================
    
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
        
        # Generate questions by difficulty
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
        
        logger.info(f"✅ Generated {len(questions)} questions for {topic_name}")
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
    
    # ==================== STORAGE OPERATIONS ====================
    
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
        
        # Check if already exists
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
            # Update existing
            await collection.update_one(
                {"_id": existing["_id"]},
                {"$set": bank_doc}
            )
            logger.info(f"✅ Updated question bank for {subject} Ch.{chapter_number}")
            return str(existing["_id"])
        else:
            # Insert new
            result = await collection.insert_one(bank_doc)
            logger.info(f"✅ Created question bank for {subject} Ch.{chapter_number}")
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
    
    # ==================== SUBJECT/CHAPTER/TOPIC RETRIEVAL ====================
    
    async def get_available_subjects(self, class_level: int) -> List[Dict]:
        """
        Get all subjects available for a class level.
        Checks MongoDB books collection, question bank, AND Pinecone namespaces.
        """
        logger.info(f"🔍 get_available_subjects called for class_level={class_level}")
        subjects_map = {}  # Use dict to merge and count chapters
        
        # Method 1: Check books collection (Primary source - actual textbook content)
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
        
        logger.info(f"🔍 Querying books collection with class_level={class_level}")
        books_results = await books_collection.aggregate(books_pipeline).to_list(100)
        logger.info(f"📚 Books query result for class {class_level}: {books_results}")
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
        
        # Method 2: Check question bank (has pre-generated questions)
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
                    # Update questions count
                    subjects_map[subject]["total_questions"] = r.get("total_questions", 0)
                else:
                    subjects_map[subject] = {
                        "subject": subject,
                        "total_chapters": r.get("total_chapters", 0),
                        "total_questions": r.get("total_questions", 0)
                    }
        
        # If we have subjects, return them
        if subjects_map:
            results = list(subjects_map.values())
            logger.info(f"Found {len(results)} total subjects for class {class_level}")
            return results
        
        # Fallback: Check Pinecone namespace_db for embedded content
        logger.info(f"No subjects found for class {class_level}, checking Pinecone namespaces...")
        
        try:
            from app.db.mongo import namespace_db
            
            # Get stats from Pinecone to see which namespaces have data
            if namespace_db.index:
                stats = namespace_db.index.describe_index_stats()
                namespaces = stats.get('namespaces', {})
                
                subjects = []
                for ns_name, ns_stats in namespaces.items():
                    vector_count = ns_stats.get('vector_count', 0)
                    if vector_count > 0:
                        # Parse namespace format: class_X_subject (e.g., class_10_science)
                        parts = ns_name.split('_')
                        
                        # Check if namespace follows class_X_subject format
                        if len(parts) >= 3 and parts[0] == 'class':
                            try:
                                ns_class = int(parts[1])
                                # Only include subjects for the requested class level
                                if ns_class == class_level:
                                    subject_name = '_'.join(parts[2:]).replace('-', ' ').title()
                                    # Check if already added
                                    if not any(s['subject'].lower() == subject_name.lower() for s in subjects):
                                        subjects.append({
                                            "subject": subject_name,
                                            "total_chapters": max(1, vector_count // 50),  # Estimate chapters
                                            "total_questions": 0  # No pre-generated questions yet
                                        })
                            except ValueError:
                                continue
                        else:
                            # Old format namespace - can't filter by class, skip it
                            logger.debug(f"Skipping namespace {ns_name} - doesn't match class format")
                
                if subjects:
                    logger.info(f"Found {len(subjects)} subjects in Pinecone namespaces for class {class_level}")
                    return subjects
                
        except Exception as e:
            logger.error(f"Error checking Pinecone namespaces: {e}")
        
        # Final fallback: return empty (frontend will show static fallback)
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
        Checks MongoDB question bank first, then falls back to Pinecone metadata.
        """
        collection = mongodb.db[self.QUESTION_BANK]
        
        chapters = await collection.find(
            {"class_level": class_level, "subject": subject, "is_active": True},
            {"chapter_number": 1, "chapter_name": 1, "total_topics": 1, "total_questions": 1, "topics.topic_id": 1, "topics.topic_name": 1}
        ).sort("chapter_number", 1).to_list(100)
        
        # If student_id is provided, fetch performance data
        student_scores = {}
        if student_id:
            perf_collection = mongodb.db[self.STUDENT_TOPIC_PERFORMANCE]
            performances = await perf_collection.find({
                "student_id": student_id,
                "class_level": class_level,
                "subject": subject
            }).to_list(1000)
            
            # Aggregate scores by chapter
            for p in performances:
                ch_num = p.get("chapter_number")
                if ch_num:
                    if ch_num not in student_scores:
                        student_scores[ch_num] = {"total": 0, "count": 0}
                    student_scores[ch_num]["total"] += p.get("average_score", 0)
                    student_scores[ch_num]["count"] += 1

        result = []
        for ch in chapters:
            # Calculate average score for chapter
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
        
        # Fallback: Get chapter info from Pinecone metadata
        logger.info(f"No chapters in question bank for {subject}, checking Pinecone...")
        
        try:
            from app.db.mongo import namespace_db
            
            if namespace_db.index:
                # Query Pinecone to get unique chapters from metadata
                # Use a simple embedding of the subject name to retrieve some docs
                namespace = namespace_db.get_namespace(subject)
                
                # Get all unique chapters from metadata
                # We'll sample vectors from the namespace to get chapter info
                stats = namespace_db.index.describe_index_stats()
                namespaces = stats.get('namespaces', {})
                
                if namespace in namespaces:
                    # Generate embedding using llm_storage_service
                    from app.services.llm_storage_service import llm_storage_service
                    sample_embedding = llm_storage_service.embedding_model.encode(f"{subject} class {class_level} chapter").tolist()
                    
                    results = namespace_db.index.query(
                        vector=sample_embedding,
                        namespace=namespace,
                        top_k=100,  # Get enough docs to find chapters
                        include_metadata=True
                    )
                    
                    # Extract unique chapters from metadata
                    chapter_info = {}
                    for match in results.get('matches', []):
                        metadata = match.get('metadata', {})
                        # Use correct metadata fields: chapter_number (not chapter)
                        chapter_num = metadata.get('chapter_number')
                        book_title = metadata.get('book_title', '')
                        
                        # Construct chapter name from book title or fallback
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
                    
                    # Convert to sorted list
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
        
        # Get student performance if student_id provided
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
            
            # Determine if weak topic (score < 60%)
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
                # Student-specific data
                "student_score": avg_score,
                "tests_taken": perf.get("tests_taken", 0),
                "trend": perf.get("improvement_trend", "stable"),
                "is_weak": is_weak,
                "is_recommended": is_recommended
            })
        
        # Sort: recommended topics first, then by name
        topics.sort(key=lambda x: (not x["is_recommended"], x["topic_name"]))
        
        return topics
    
    # ==================== TEST QUESTION SERVING ====================
    
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
        
        # Find the topic
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
        
        # Filter by difficulty if specified
        if difficulty != "mixed":
            filtered = [q for q in all_questions if q.get("difficulty") == difficulty]
            if len(filtered) >= num_questions:
                all_questions = filtered
        
        # Select questions (random sampling)
        import random
        if len(all_questions) <= num_questions:
            selected = all_questions
        else:
            # Stratified sampling by difficulty
            if difficulty == "mixed":
                easy = [q for q in all_questions if q.get("difficulty") == "easy"]
                medium = [q for q in all_questions if q.get("difficulty") == "medium"]
                hard = [q for q in all_questions if q.get("difficulty") == "hard"]
                
                # Distribution: 40% easy, 40% medium, 20% hard
                n_easy = max(1, int(num_questions * 0.4))
                n_medium = max(1, int(num_questions * 0.4))
                n_hard = num_questions - n_easy - n_medium
                
                selected = []
                selected.extend(random.sample(easy, min(n_easy, len(easy))))
                selected.extend(random.sample(medium, min(n_medium, len(medium))))
                selected.extend(random.sample(hard, min(n_hard, len(hard))))
                
                # Fill remaining from any pool
                remaining = num_questions - len(selected)
                if remaining > 0:
                    unused = [q for q in all_questions if q not in selected]
                    selected.extend(random.sample(unused, min(remaining, len(unused))))
            else:
                selected = random.sample(all_questions, num_questions)
        
        # Shuffle selected questions
        random.shuffle(selected)
        
        # Format for response
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
        
        logger.info(f"✅ Serving {len(formatted)} questions for topic: {topic_name}")
        return formatted, topic_name
    
    # ==================== STUDENT PERFORMANCE TRACKING ====================
    
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
        
        # Find existing record
        existing = await collection.find_one({
            "student_id": student_id,
            "topic_id": topic_id
        })
        
        now = datetime.utcnow()
        
        if existing:
            # Calculate new averages
            tests_taken = existing.get("tests_taken", 0) + 1
            total_questions = existing.get("total_questions_attempted", 0) + questions_attempted
            total_correct = existing.get("correct_answers", 0) + correct_count
            
            # Update average score
            old_avg = existing.get("average_score", 0)
            new_avg = (old_avg * (tests_taken - 1) + score) / tests_taken
            
            # Update best score
            best = max(existing.get("best_score", 0), score)
            
            # Add to score history
            history = existing.get("score_history", [])
            history.append({"score": score, "date": now.isoformat()})
            history = history[-10:]  # Keep last 10
            
            # Determine trend
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
            # Create new record
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
        
        # Update subject progress
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
        
        # Get all topic performances for this subject
        performances = await perf_collection.find({
            "student_id": student_id,
            "class_level": class_level,
            "subject": subject
        }).to_list(1000)
        
        if not performances:
            return
        
        # Calculate stats
        chapters = set(p["chapter_number"] for p in performances)
        total_topics = len(performances)
        strong = sum(1 for p in performances if p.get("average_score", 0) >= 80)
        moderate = sum(1 for p in performances if 60 <= p.get("average_score", 0) < 80)
        weak = sum(1 for p in performances if p.get("average_score", 0) < 60)
        
        # Get weak topics
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
        
        # Calculate overall average
        overall_avg = sum(p.get("average_score", 0) for p in performances) / len(performances)
        total_tests = sum(p.get("tests_taken", 0) for p in performances)
        
        # Mastered chapters (avg > 80%)
        chapter_scores = {}
        for p in performances:
            ch = p["chapter_number"]
            if ch not in chapter_scores:
                chapter_scores[ch] = []
            chapter_scores[ch].append(p.get("average_score", 0))
        
        mastered = [ch for ch, scores in chapter_scores.items() if sum(scores)/len(scores) >= 80]
        
        # Upsert subject progress
        await prog_collection.update_one(
            {"student_id": student_id, "class_level": class_level, "subject": subject},
            {"$set": {
                "chapters_attempted": list(chapters),
                "chapters_mastered": mastered,
                "total_topics": total_topics,
                "topics_strong": strong,
                "topics_moderate": moderate,
                "topics_weak": weak,
                "weak_topics": weak_topics[:10],  # Top 10 weakest
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
        
        # If no weak topics, recommend unstarted topics
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
        
        # Get all topics for subject
        banks = await bank_collection.find({
            "class_level": class_level,
            "subject": subject,
            "is_active": True
        }).to_list(100)
        
        # Get student's attempted topics
        attempted = await perf_collection.find({
            "student_id": student_id,
            "class_level": class_level,
            "subject": subject
        }, {"topic_id": 1}).to_list(1000)
        
        attempted_ids = {a["topic_id"] for a in attempted}
        
        # Find unstarted
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
    
    # ==================== ON-DEMAND QUESTION GENERATION ====================
    
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
        
        # Step 1: Check cache
        cache_key = {
            "class_level": class_level,
            "subject": subject,
            "chapter_number": chapter_number
        }
        
        existing = await collection.find_one(cache_key)
        
        if existing and existing.get("questions"):
            logger.info(f"✅ Cache hit: Found {len(existing['questions'])} questions for {subject} Ch.{chapter_number}")
            
            # Update last_used timestamp
            await collection.update_one(
                {"_id": existing["_id"]},
                {"$set": {"last_used": datetime.utcnow()}}
            )
            
            # Return requested number of questions
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
        
        # Step 2: Retrieve content from Pinecone
        logger.info(f"📚 Generating questions for {subject} Ch.{chapter_number}...")
        
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
            
            # Step 3: Generate questions with difficulty distribution
            # Distribution: 40% easy, 40% medium, 20% hard
            difficulty_counts = {
                "easy": max(1, int(num_questions * 0.4)),
                "medium": max(1, int(num_questions * 0.4)),
                "hard": max(1, int(num_questions * 0.2))
            }
            
            # Generate all questions in one batch (Optimized: 1 API call instead of 3)
            all_questions = await self._generate_questions_batch_optimized(
                content_text=content_text,
                class_level=class_level,
                subject=subject,
                chapter_number=chapter_number,
                chapter_name=chapter_name,
                difficulty_distribution=difficulty_counts,
                include_variations=include_variations
            )
            
            # Calculate actual distribution
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
            
            # Step 4: Store in MongoDB for future use
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
            
            logger.info(f"✅ Generated and cached {len(all_questions)} questions for {subject} Ch.{chapter_number}")
            
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
                logger.error("Namespace DB not connected")
                return None
            
            namespace = namespace_db.get_namespace(subject)
            
            # Create embedding for chapter query
            query_text = f"{subject} class {class_level} chapter {chapter_number}"
            query_embedding = llm_storage_service.embedding_model.encode(query_text).tolist()
            
            # Query Pinecone with chapter filter
            results = namespace_db.index.query(
                vector=query_embedding,
                namespace=namespace,
                top_k=50,  # Get enough chunks to cover the chapter
                filter={"chapter_number": chapter_number},
                include_metadata=True
            )
            
            if not results.get('matches'):
                # Try without filter
                results = namespace_db.index.query(
                    vector=query_embedding,
                    namespace=namespace,
                    top_k=50,
                    include_metadata=True
                )
            
            if not results.get('matches'):
                return None
            
            # Combine text from all chunks
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
                
                # Process each difficulty level
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
                        
                        # Add validated variations
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
        
        # Collect all questions
        all_questions = []
        for chapter in chapters:
            for q in chapter.get("questions", []):
                q["chapter_number"] = chapter["chapter_number"]
                q["chapter_name"] = chapter.get("chapter_name", "")
                all_questions.append(q)
        
        # Filter by difficulty if specified
        if difficulty != "mixed":
            all_questions = [q for q in all_questions if q.get("difficulty") == difficulty]
        
        # Randomize and select
        import random
        random.shuffle(all_questions)
        
        # Include some variations if available
        final_questions = []
        for q in all_questions[:num_questions]:
            # Randomly pick base question or a variation
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
    
    # ==================== FIXED-FORMAT CHAPTER TEST METHODS ====================
    
    CHAPTER_TEST_COLLECTION = "chapter_test_questions"
    
    # Test format: 15 questions (10 one-mark + 5 two-mark) = 20 marks, 40 minutes
    CHAPTER_TEST_FORMAT = {
        "one_mark": {
            "pool_size": 30,  # Generate 30 for variety (3 variations × 10)
            "select_count": 10,
            "marks": 1,
            "difficulty_mix": ["easy", "medium", "application"]  # Mixed
        },
        "two_mark": {
            "pool_size": 15,  # Generate 15 for variety (3 variations × 5)
            "select_count": 5,
            "marks": 2,
            "difficulty_mix": ["medium", "application"]  # Mixed
        },
        "total_marks": 20,
        "time_limit_minutes": 40
    }
    
    async def check_chapter_test_pool_exists(
        self,
        class_level: int,
        subject: str,
        chapter_number: int
    ) -> Dict:
        """Check if chapter test question pool exists in MongoDB."""
        collection = mongodb.db[self.CHAPTER_TEST_COLLECTION]
        
        existing = await collection.find_one({
            "class_level": class_level,
            "subject": subject,
            "chapter_number": chapter_number
        })
        
        if existing and len(existing.get("one_mark_pool", [])) >= 10 and len(existing.get("two_mark_pool", [])) >= 5:
            return {
                "exists": True,
                "chapter_name": existing.get("chapter_name", ""),
                "one_mark_count": len(existing.get("one_mark_pool", [])),
                "two_mark_count": len(existing.get("two_mark_pool", [])),
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
        Generate chapter test question pool (first-time).
        Creates 30 one-mark + 15 two-mark = 45 questions total.
        
        One-mark questions: Mix of easy, medium, application (1 mark each)
        Two-mark questions: Mix of medium, application (2 marks each)
        
        Returns: Dict with status and question counts
        """
        logger.info(f"🎯 Generating chapter test pool for {subject} Ch.{chapter_number}...")
        
        collection = mongodb.db[self.CHAPTER_TEST_COLLECTION]
        
        # Step 1: Get chapter content from Pinecone
        content = await self._retrieve_chapter_content(class_level, subject, chapter_number)
        
        if not content:
            logger.error(f"No content found for {subject} Ch.{chapter_number}")
            return {"status": "error", "error": "No chapter content available"}
        
        chapter_name = content.get("chapter_name", f"Chapter {chapter_number}")
        content_text = content.get("text", "")
        
        # Step 2: Generate one-mark questions (30 total)
        one_mark_questions = await self._generate_chapter_test_questions_batch(
            content_text=content_text,
            class_level=class_level,
            subject=subject,
            chapter_name=chapter_name,
            marks=1,
            count=self.CHAPTER_TEST_FORMAT["one_mark"]["pool_size"],
            difficulty_mix=self.CHAPTER_TEST_FORMAT["one_mark"]["difficulty_mix"]
        )
        
        # Step 3: Generate two-mark questions (15 total)
        two_mark_questions = await self._generate_chapter_test_questions_batch(
            content_text=content_text,
            class_level=class_level,
            subject=subject,
            chapter_name=chapter_name,
            marks=2,
            count=self.CHAPTER_TEST_FORMAT["two_mark"]["pool_size"],
            difficulty_mix=self.CHAPTER_TEST_FORMAT["two_mark"]["difficulty_mix"]
        )
        
        # Step 4: Validate questions have proper answers
        valid_one_mark = [q for q in one_mark_questions if self._has_valid_answer(q)]
        valid_two_mark = [q for q in two_mark_questions if self._has_valid_answer(q)]
        
        logger.info(f"Validated: {len(valid_one_mark)} one-mark, {len(valid_two_mark)} two-mark questions")
        
        # If not enough questions, log warning but proceed
        if len(valid_one_mark) < 10 or len(valid_two_mark) < 5:
            logger.warning(f"Insufficient validated questions: {len(valid_one_mark)} one-mark, {len(valid_two_mark)} two-mark")
        
        # Step 5: Store in MongoDB
        pool_doc = {
            "class_level": class_level,
            "subject": subject,
            "chapter_number": chapter_number,
            "chapter_name": chapter_name,
            "one_mark_pool": valid_one_mark,
            "two_mark_pool": valid_two_mark,
            "total_one_mark": len(valid_one_mark),
            "total_two_mark": len(valid_two_mark),
            "generated_at": datetime.utcnow(),
            "last_used": datetime.utcnow()
        }
        
        # Upsert - update if exists, insert if not
        await collection.update_one(
            {
                "class_level": class_level,
                "subject": subject,
                "chapter_number": chapter_number
            },
            {"$set": pool_doc},
            upsert=True
        )
        
        logger.info(f"✅ Stored chapter test pool: {len(valid_one_mark)} one-mark + {len(valid_two_mark)} two-mark questions")
        
        return {
            "status": "generated",
            "chapter_name": chapter_name,
            "one_mark_count": len(valid_one_mark),
            "two_mark_count": len(valid_two_mark),
            "total_questions": len(valid_one_mark) + len(valid_two_mark)
        }
    
    async def _generate_chapter_test_questions_batch(
        self,
        content_text: str,
        class_level: int,
        subject: str,
        chapter_name: str,
        marks: int,
        count: int,
        difficulty_mix: List[str]
    ) -> List[Dict]:
        """Generate questions for chapter test with specified marks value."""
        
        mark_type = "one-mark" if marks == 1 else "two-mark"
        difficulty_desc = ", ".join(difficulty_mix)
        
        prompt = f"""Generate {count} {mark_type} questions for Class {class_level} {subject} chapter test.

**Chapter:** {chapter_name}

**Textbook Content:**
{content_text[:15000]}

**REQUIREMENTS:**
- Generate exactly {count} questions worth {marks} mark(s) each
- Mix of difficulties: {difficulty_desc}
- {"Simple recall, definitions, basic concepts" if marks == 1 else "Application, understanding, problem-solving"}
- Each question MUST have a clear, complete expected answer
- For numerical questions: include solution steps

**OUTPUT FORMAT (JSON Array):**
[
  {{
    "question_text": "What is the definition of...",
    "question_type": "{"recall" if marks == 1 else "application"}",
    "difficulty": "{"easy" if marks == 1 else "medium"}",
    "expected_answer": "Complete answer that can be verified...",
    "keywords": ["keyword1", "keyword2"],
    "marks": {marks},
    "is_numerical": false,
    "solution_steps": ""
  }},
  ...
]

**CRITICAL RULES:**
1. Every question MUST have expected_answer (at least 10 characters)
2. Questions must be diverse - cover different concepts from the chapter
3. For {marks}-mark questions: {"brief, direct answers" if marks == 1 else "more detailed answers with explanation"}
4. Questions MUST be answerable from the provided content
5. For numerical problems, include solution_steps

Output ONLY the JSON array, no other text."""

        try:
            response = self.gemini.generate_response(prompt)
            
            json_match = re.search(r'\[.*\]', response, re.DOTALL)
            if json_match:
                questions_data = json.loads(json_match.group())
                
                formatted_questions = []
                for i, q in enumerate(questions_data):
                    question = {
                        "question_id": f"{subject.lower().replace(' ', '_')}_{chapter_name.lower()[:10]}_{mark_type}_{i}_{datetime.utcnow().timestamp()}",
                        "question_text": q.get("question_text", ""),
                        "question_type": q.get("question_type", "recall" if marks == 1 else "application"),
                        "difficulty": q.get("difficulty", "medium"),
                        "expected_answer": q.get("expected_answer", ""),
                        "keywords": q.get("keywords", []),
                        "marks": marks,
                        "is_numerical": q.get("is_numerical", False),
                        "solution_steps": q.get("solution_steps", "")
                    }
                    formatted_questions.append(question)
                
                logger.info(f"Generated {len(formatted_questions)} {mark_type} questions")
                return formatted_questions
            
            logger.error("Failed to parse questions JSON")
            return []
            
        except Exception as e:
            logger.error(f"Error generating {mark_type} questions: {e}")
            return []
    
    def _has_valid_answer(self, question: Dict) -> bool:
        """Check if question has a valid expected answer."""
        answer = question.get("expected_answer", "")
        if not answer:
            return False
        # Answer should be at least 10 characters for meaningful content
        return len(str(answer).strip()) >= 10
    
    async def select_chapter_test_questions(
        self,
        class_level: int,
        subject: str,
        chapter_number: int
    ) -> Dict:
        """
        Select 15 random questions from pool for a chapter test.
        - 10 one-mark questions (mixed difficulty)
        - 5 two-mark questions (mixed difficulty)
        - Total: 20 marks, 40 minutes
        
        Returns: Dict with questions, chapter info, and test parameters
        """
        collection = mongodb.db[self.CHAPTER_TEST_COLLECTION]
        
        pool = await collection.find_one({
            "class_level": class_level,
            "subject": subject,
            "chapter_number": chapter_number
        })
        
        if not pool:
            return {"status": "error", "error": "Question pool not found"}
        
        one_mark_pool = pool.get("one_mark_pool", [])
        two_mark_pool = pool.get("two_mark_pool", [])
        
        if len(one_mark_pool) < 10 or len(two_mark_pool) < 5:
            return {"status": "error", "error": "Insufficient questions in pool"}
        
        import random
        
        # Random select 10 one-mark questions
        selected_one_mark = random.sample(one_mark_pool, 10)
        
        # Random select 5 two-mark questions
        selected_two_mark = random.sample(two_mark_pool, 5)
        
        # Combine and shuffle
        all_questions = selected_one_mark + selected_two_mark
        random.shuffle(all_questions)
        
        # Add question numbers
        formatted_questions = []
        for i, q in enumerate(all_questions):
            formatted_questions.append({
                "question_number": i + 1,
                "question_id": q.get("question_id", f"q_{i}"),
                "question_text": q.get("question_text", ""),
                "difficulty": q.get("difficulty", "medium"),
                "question_type": q.get("question_type", "conceptual"),
                "marks": q.get("marks", 1),
                "time_estimate": 120 if q.get("marks", 1) == 2 else 90,  # 2 min for 2-mark, 1.5 min for 1-mark
                # Keep for evaluation (not sent to frontend)
                "expected_answer": q.get("expected_answer", ""),
                "keywords": q.get("keywords", []),
                "solution_steps": q.get("solution_steps", "")
            })
        
        # Update last_used timestamp
        await collection.update_one(
            {"_id": pool["_id"]},
            {"$set": {"last_used": datetime.utcnow()}}
        )
        
        logger.info(f"✅ Selected 15 questions for {subject} Ch.{chapter_number} test")
        
        return {
            "status": "success",
            "chapter_name": pool.get("chapter_name", f"Chapter {chapter_number}"),
            "questions": formatted_questions,
            "total_questions": 15,
            "total_marks": 20,
            "time_limit_minutes": 40,
            "one_mark_count": 10,
            "two_mark_count": 5
        }
    
    # ==================== TOPIC-TAGGED QUESTION GENERATION ====================
    
    async def generate_questions_with_topic_tagging(
        self,
        class_level: int,
        subject: str,
        chapter_number: int,
        num_questions: int = 15
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
        logger.info(f"📚 Generating topic-tagged questions for {subject} Ch.{chapter_number}")
        
        try:
            # Step 1: Retrieve content
            content = await self._retrieve_chapter_content(class_level, subject, chapter_number)
            
            if not content:
                return {
                    "status": "no_content",
                    "questions": [],
                    "error": "No content available for this chapter"
                }
            
            chapter_name = content.get("chapter_name", f"Chapter {chapter_number}")
            content_text = content.get("text", "")
            
            # Step 2: Generate questions with topic tagging
            questions_with_topics = await self._generate_topic_tagged_questions(
                content_text=content_text,
                class_level=class_level,
                subject=subject,
                chapter_number=chapter_number,
                chapter_name=chapter_name,
                num_questions=num_questions
            )
            
            if not questions_with_topics:
                return {
                    "status": "generation_failed",
                    "questions": [],
                    "error": "Failed to generate questions"
                }
            
            # Extract unique topics
            unique_topics = {}
            for q in questions_with_topics:
                topic_id = q.get("topic_id")
                if topic_id and topic_id not in unique_topics:
                    unique_topics[topic_id] = q.get("topic_name", "Unknown Topic")
            
            logger.info(f"✅ Generated {len(questions_with_topics)} questions covering {len(unique_topics)} topics")
            
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
    
    async def _generate_topic_tagged_questions(
        self,
        content_text: str,
        class_level: int,
        subject: str,
        chapter_number: int,
        chapter_name: str,
        num_questions: int
    ) -> List[Dict]:
        """
        Generate questions with Gemini and auto-assign topics to each question.
        Uses a single API call to be efficient.
        """
        
        prompt = f"""Analyze this Class {class_level} {subject} chapter content and generate {num_questions} questions.

**Chapter:** {chapter_name}

**Content:**
{content_text[:12000]}

**TASK:**
1. Identify 3-5 main TOPICS/CONCEPTS covered in this content
2. Generate {num_questions} questions (mix of easy/medium/hard)
3. Tag EACH question with the topic it belongs to

**QUESTION DISTRIBUTION:**
- {int(num_questions * 0.4)} EASY questions (recall, definitions)
- {int(num_questions * 0.4)} MEDIUM questions (application, understanding)
- {int(num_questions * 0.2)} HARD questions (analysis, problem-solving)

**OUTPUT FORMAT (JSON):**
{{
  "topics": [
    {{"topic_id": "topic_1", "topic_name": "Introduction to {subject}"}},
    {{"topic_id": "topic_2", "topic_name": "Basic Concepts"}},
    ...
  ],
  "questions": [
    {{
      "question_text": "What is...?",
      "topic_id": "topic_1",
      "topic_name": "Introduction to {subject}",
      "difficulty": "easy",
      "question_type": "recall",
      "expected_answer": "...",
      "keywords": ["..."],
      "marks": 5,
      "time_estimate_seconds": 60
    }},
    ...
  ]
}}

**CRITICAL RULES:**
1. Each question MUST have a topic_id and topic_name
2. Topics should be specific (e.g., "Photosynthesis" not "Biology Concepts")  
3. Questions must be answerable from the content
4. Distribute questions across ALL identified topics
5. Include detailed expected_answer for evaluation

Output ONLY the JSON object."""

        try:
            response = self.gemini.generate_response(prompt)
            
            # Parse JSON
            json_match = re.search(r'\\{.*\\}', response, re.DOTALL)
            if not json_match:
                logger.error("Could not parse JSON from Gemini response")
                return []
            
            data = json.loads(json_match.group())
            questions_data = data.get("questions", [])
            topics = data.get("topics", [])
            
            logger.info(f"Gemini identified {len(topics)} topics: {[t['topic_name'] for t in topics]}")
            
            # Format questions
            formatted_questions = []
            for i, q in enumerate(questions_data):
                formatted_questions.append({
                    "question_id": f"{subject}_{chapter_number}_{i}_{uuid.uuid4().hex[:6]}",
                    "question_text": q.get("question_text", ""),
                    "topic_id": q.get("topic_id", "general"),
                    "topic_name": q.get("topic_name", "General"),
                    "difficulty": q.get("difficulty", "medium"),
                    "question_type": q.get("question_type", "conceptual"),
                    "expected_answer": q.get("expected_answer", ""),
                    "keywords": q.get("keywords", []),
                    "marks": q.get("marks", 5),
                    "time_estimate_seconds": q.get("time_estimate_seconds", 90),
                    "chapter_number": chapter_number,
                    "chapter_name": chapter_name
                })
            
            return formatted_questions
            
        except Exception as e:
            logger.error(f"Error in topic-tagged question generation: {e}")
            return []


# Global instance
topic_question_bank_service = TopicQuestionBankService()

