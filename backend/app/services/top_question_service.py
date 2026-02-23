"""
Top Questions Service
Handles tracking, retrieval, and recommendations for frequently asked questions.
Supports subject-wise filtering for both Quick and Deep modes.
"""

from typing import List, Optional, Tuple
from datetime import datetime, timedelta
from app.db.mongo import db
from app.models.top_questions import (
    TopQuestion, QuestionAnswerPair, TopQuestionResponse
)
import logging
import re

logger = logging.getLogger(__name__)

class TopQuestionService:
    """Service for managing top questions and recommendations."""
    
    TOP_QUESTIONS_COLLECTION = "top_questions"
    QA_PAIRS_COLLECTION = "question_answer_pairs"
    
    def __init__(self):
        """Initialize the service."""
        self._database = None
        self._ensure_indexes()
    
    @property
    def database(self):
        """Get the actual database from the SyncMongoDB wrapper."""
        if self._database is None:
            self._database = db.db
        return self._database
    
    def _ensure_indexes(self):
        """Ensure MongoDB indexes exist for better performance."""
        try:
            self.database[self.TOP_QUESTIONS_COLLECTION].create_index([
                ("subject", 1),
                ("class_level", 1),
                ("mode", 1),
                ("ask_count", -1)
            ])
            self.database[self.TOP_QUESTIONS_COLLECTION].create_index([
                ("last_asked", -1)
            ])
            
            self.database[self.QA_PAIRS_COLLECTION].create_index([
                ("user_id", 1),
                ("subject", 1),
                ("timestamp", -1)
            ])
            self.database[self.QA_PAIRS_COLLECTION].create_index([
                ("subject", 1),
                ("class_level", 1),
                ("mode", 1)
            ])
            
            logger.info("Top questions indexes created/verified")
        except Exception as e:
            logger.warning(f" Could not create indexes: {e}")
    
    def get_top_questions(
        self, 
        subject: str, 
        class_level: int, 
        mode: str = "quick", 
        limit: int = 5
    ) -> List[TopQuestionResponse]:
        """
        Get top questions by subject, class, and mode.
        
        Args:
            subject: Subject name (e.g., "hindi", "math", "science")
            class_level: Class level (6-12)
            mode: "quick" or "deep"
            limit: Number of questions to return
        
        Returns:
            List of TopQuestionResponse objects
        """
        try:
            collection = self.database[self.TOP_QUESTIONS_COLLECTION]
            
            query = {
                "subject": subject.lower(),
                "class_level": class_level,
                "mode": mode
            }
            
            cursor = collection.find(query).sort("ask_count", -1).limit(limit)
            
            questions = []
            for doc in cursor:
                questions.append(TopQuestionResponse(
                    question=doc["question"],
                    subject=doc["subject"],
                    class_level=doc["class_level"],
                    chapter=doc.get("chapter"),
                    mode=doc["mode"],
                    category=doc.get("category", "concept"),
                    ask_count=doc["ask_count"],
                    difficulty=doc.get("difficulty", "medium")
                ))
            
            logger.info(f"📊 Retrieved {len(questions)} top questions for {subject} class {class_level} ({mode})")
            return questions
            
        except Exception as e:
            logger.error(f" Error getting top questions: {e}")
            return []
    
    def track_question(
        self,
        question: str,
        subject: str,
        class_level: int,
        mode: str,
        chapter: Optional[int] = None
    ) -> bool:
        """
        Track a question being asked (increment counter or create new entry).
        
        Args:
            question: Question text
            subject: Subject name
            class_level: Class level
            mode: "quick" or "deep"
            chapter: Chapter number (optional)
        
        Returns:
            True if successful, False otherwise
        """
        try:
            collection = self.database[self.TOP_QUESTIONS_COLLECTION]
            
            normalized_question = question.strip().lower()
            
            existing = collection.find_one({
                "question": {"$regex": f"^{re.escape(normalized_question)}$", "$options": "i"},
                "subject": subject.lower(),
                "class_level": class_level
            })
            
            if existing:
                collection.update_one(
                    {"_id": existing["_id"]},
                    {
                        "$inc": {"ask_count": 1},
                        "$set": {
                            "last_asked": datetime.utcnow(),
                            "mode": mode
                        }
                    }
                )
                logger.info(f"📈 Updated question count: '{question[:50]}...'")
            else:
                category = self._categorize_question(question)
                
                new_question = {
                    "question": question.strip(),
                    "subject": subject.lower(),
                    "class_level": class_level,
                    "chapter": chapter,
                    "mode": mode,
                    "category": category,
                    "ask_count": 1,
                    "last_asked": datetime.utcnow(),
                    "difficulty": "medium",
                    "tags": self._extract_tags(question),
                    "related_concepts": []
                }
                
                collection.insert_one(new_question)
                logger.info(f"📝 New question tracked: '{question[:50]}...'")
            
            return True
            
        except Exception as e:
            logger.error(f" Error tracking question: {e}")
            return False
    
    def _categorize_question(self, question: str) -> str:
        """
        Categorize question based on keywords.
        
        Args:
            question: Question text
        
        Returns:
            Category string
        """
        lower_q = question.lower()
        
        if any(word in lower_q for word in ["explain", "what is", "define", "meaning"]):
            return "concept"
        elif any(word in lower_q for word in ["solve", "calculate", "find", "compute"]):
            return "problem"
        elif any(word in lower_q for word in ["why", "how does", "reason"]):
            return "theory"
        elif any(word in lower_q for word in ["example", "application", "real life"]):
            return "application"
        elif re.search(r'\d+', question):
            return "numerical"
        else:
            return "general"
    
    def _extract_tags(self, question: str) -> List[str]:
        """
        Extract tags from question text.
        
        Args:
            question: Question text
        
        Returns:
            List of tags
        """
        tags = []
        lower_q = question.lower()
        
        keywords = [
            "photosynthesis", "prime numbers", "world war", "cell", "equation",
            "triangle", "democracy", "constitution", "energy", "matter"
        ]
        
        for keyword in keywords:
            if keyword in lower_q:
                tags.append(keyword)
        
        return tags[:5]
    
    def save_question_answer(
        self,
        user_id: str,
        session_id: str,
        question: str,
        answer: str,
        subject: str,
        class_level: int,
        mode: str,
        chapter: Optional[int] = None,
        concepts_covered: Optional[List[str]] = None
    ) -> Optional[str]:
        """
        Save a question-answer pair to database.
        
        Args:
            user_id: User identifier
            session_id: Session identifier
            question: Question text
            answer: Answer text
            subject: Subject name
            class_level: Class level
            mode: "quick" or "deep"
            chapter: Chapter number (optional)
            concepts_covered: List of concepts covered (optional)
        
        Returns:
            Document ID if successful, None otherwise
        """
        try:
            collection = self.database[self.QA_PAIRS_COLLECTION]
            
            qa_pair = {
                "user_id": user_id,
                "session_id": session_id,
                "question": question,
                "answer": answer,
                "subject": subject.lower(),
                "class_level": class_level,
                "chapter": chapter,
                "mode": mode,
                "timestamp": datetime.utcnow(),
                "difficulty": None,
                "time_spent_seconds": None,
                "user_rating": None,
                "was_helpful": None,
                "follow_up_questions": [],
                "concepts_covered": concepts_covered or [],
                "formulas_used": [],
                "examples_provided": "example" in answer.lower()
            }
            
            result = collection.insert_one(qa_pair)
            
            self.track_question(question, subject, class_level, mode, chapter)
            
            logger.info(f"💾 Saved Q&A pair for user {user_id}")
            return str(result.inserted_id)
            
        except Exception as e:
            logger.error(f" Error saving Q&A pair: {e}")
            return None
    
    def update_feedback(
        self,
        qa_id: str,
        user_rating: Optional[int] = None,
        was_helpful: Optional[bool] = None,
        time_spent_seconds: Optional[int] = None
    ) -> bool:
        """
        Update user feedback for a Q&A pair.
        
        Args:
            qa_id: Question-answer pair ID
            user_rating: Rating (1-5)
            was_helpful: Whether answer was helpful
            time_spent_seconds: Time spent on answer
        
        Returns:
            True if successful, False otherwise
        """
        try:
            from bson import ObjectId
            collection = self.database[self.QA_PAIRS_COLLECTION]
            
            update_fields = {}
            if user_rating is not None:
                update_fields["user_rating"] = user_rating
            if was_helpful is not None:
                update_fields["was_helpful"] = was_helpful
            if time_spent_seconds is not None:
                update_fields["time_spent_seconds"] = time_spent_seconds
            
            if update_fields:
                result = collection.update_one(
                    {"_id": ObjectId(qa_id)},
                    {"$set": update_fields}
                )
                
                if result.modified_count > 0:
                    logger.info(f"Updated feedback for Q&A {qa_id}")
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f" Error updating feedback: {e}")
            return False
    
    def get_recommendations(
        self,
        user_id: str,
        subject: str,
        class_level: int,
        mode: str = "quick",
        limit: int = 5
    ) -> List[TopQuestionResponse]:
        """
        Get personalized question recommendations for a user.
        Based on:
        1. Questions asked by others in same subject/class
        2. Questions not yet asked by this user
        3. Questions related to user's recent study topics
        
        Args:
            user_id: User identifier
            subject: Subject name
            class_level: Class level
            mode: "quick" or "deep"
            limit: Number of recommendations
        
        Returns:
            List of recommended questions
        """
        try:
            qa_collection = self.database[self.QA_PAIRS_COLLECTION]
            top_collection = self.database[self.TOP_QUESTIONS_COLLECTION]
            
            user_questions = list(qa_collection.find({
                "user_id": user_id,
                "subject": subject.lower(),
                "class_level": class_level
            }).sort("timestamp", -1).limit(20))
            
            asked_questions = {q["question"].lower().strip() for q in user_questions}
            
            studied_chapters = {q.get("chapter") for q in user_questions if q.get("chapter")}
            studied_concepts = set()
            for q in user_questions:
                studied_concepts.update(q.get("concepts_covered", []))
            
            query = {
                "subject": subject.lower(),
                "class_level": class_level,
                "mode": mode
            }
            
            if studied_chapters:
                query["chapter"] = {"$in": list(studied_chapters)}
            
            cursor = top_collection.find(query).sort("ask_count", -1).limit(limit * 3)
            
            recommendations = []
            for doc in cursor:
                if doc["question"].lower().strip() in asked_questions:
                    continue
                
                recommendations.append(TopQuestionResponse(
                    question=doc["question"],
                    subject=doc["subject"],
                    class_level=doc["class_level"],
                    chapter=doc.get("chapter"),
                    mode=doc["mode"],
                    category=doc.get("category", "concept"),
                    ask_count=doc["ask_count"],
                    difficulty=doc.get("difficulty", "medium")
                ))
                
                if len(recommendations) >= limit:
                    break
            
            if len(recommendations) < limit:
                general_query = {
                    "subject": subject.lower(),
                    "class_level": class_level,
                    "mode": mode
                }
                cursor = top_collection.find(general_query).sort("ask_count", -1).limit(limit)
                
                for doc in cursor:
                    if doc["question"].lower().strip() not in asked_questions:
                        if len(recommendations) >= limit:
                            break
                        
                        if not any(r.question == doc["question"] for r in recommendations):
                            recommendations.append(TopQuestionResponse(
                                question=doc["question"],
                                subject=doc["subject"],
                                class_level=doc["class_level"],
                                chapter=doc.get("chapter"),
                                mode=doc["mode"],
                                category=doc.get("category", "concept"),
                                ask_count=doc["ask_count"],
                                difficulty=doc.get("difficulty", "medium")
                            ))
            
            logger.info(f" Generated {len(recommendations)} recommendations for user {user_id}")
            return recommendations
            
        except Exception as e:
            logger.error(f" Error getting recommendations: {e}")
            return self.get_top_questions(subject, class_level, mode, limit)
    
    def get_trending_questions(
        self,
        subject: str,
        class_level: int,
        mode: str = "quick",
        days: int = 7,
        limit: int = 5
    ) -> List[TopQuestionResponse]:
        """
        Get trending questions from the last N days.
        
        Args:
            subject: Subject name
            class_level: Class level
            mode: "quick" or "deep"
            days: Number of days to look back
            limit: Number of questions to return
        
        Returns:
            List of trending questions
        """
        try:
            collection = self.database[self.TOP_QUESTIONS_COLLECTION]
            
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            query = {
                "subject": subject.lower(),
                "class_level": class_level,
                "mode": mode,
                "last_asked": {"$gte": cutoff_date}
            }
            
            cursor = collection.find(query).sort("ask_count", -1).limit(limit)
            
            trending = []
            for doc in cursor:
                trending.append(TopQuestionResponse(
                    question=doc["question"],
                    subject=doc["subject"],
                    class_level=doc["class_level"],
                    chapter=doc.get("chapter"),
                    mode=doc["mode"],
                    category=doc.get("category", "concept"),
                    ask_count=doc["ask_count"],
                    difficulty=doc.get("difficulty", "medium")
                ))
            
            logger.info(f"🔥 Retrieved {len(trending)} trending questions (last {days} days)")
            return trending
            
        except Exception as e:
            logger.error(f" Error getting trending questions: {e}")
            return []

top_question_service = TopQuestionService()
