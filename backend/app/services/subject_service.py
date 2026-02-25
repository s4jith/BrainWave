"""
Subject Management Service
Handles dynamic subject retrieval based on available data in database.
"""

from typing import List, Dict, Set
from app.db.mongo import db
import logging

logger = logging.getLogger(__name__)

class SubjectService:
    """Service for managing subjects and their availability."""
    
    ALL_SUBJECTS = [
        "hindi",
        "english",
        "mathematics",
        "math",
        "science",
        "physics",
        "chemistry",
        "biology",
        "history",
        "geography",
        "civics",
        "economics",
        "social-science"
    ]
    
    def get_available_subjects_for_class(self, class_level: int) -> List[Dict[str, str]]:
        """
        Get list of subjects that have data available for a given class.
        
        Checks:
        1. Topic question bank (AI Test questions)
        2. Top questions database (frequently asked)
        3. Question-answer pairs database (chat history)
        4. Pinecone namespaces (textbook content)
        
        Args:
            class_level: Class level (6-12)
        
        Returns:
            List of dicts with subject info: [{"name": "Hindi", "value": "hindi"}]
        """
        try:
            available_subjects = set()
            
            # Normalize aliases so duplicates like "mathematics"/"math"/"maths" collapse into one
            _alias_map = {
                "mathematics": "maths",
                "math": "maths",
                "social science": "social-science",
                "socialscience": "social-science",
                "social_science": "social-science",
            }

            def _normalize(s: str) -> str:
                s = s.lower().strip()
                return _alias_map.get(s, s)

            database = db.db
            
            books_collection = database["books"]
            subjects_from_books = books_collection.distinct(
                "subject",
                {"class_level": class_level}
            )
            available_subjects.update(_normalize(s) for s in subjects_from_books if s)
            logger.info(f"Found {len(subjects_from_books)} subjects in books for class {class_level}: {subjects_from_books}")
            
            topic_bank_collection = database["topic_question_bank"]
            subjects_from_bank = topic_bank_collection.distinct(
                "subject",
                {"class_level": class_level, "is_active": True}
            )
            available_subjects.update(_normalize(s) for s in subjects_from_bank if s)
            
            top_questions_collection = database["top_questions"]
            subjects_from_questions = top_questions_collection.distinct(
                "subject",
                {"class_level": class_level}
            )
            available_subjects.update(_normalize(s) for s in subjects_from_questions if s)
            
            qa_collection = database["question_answer_pairs"]
            subjects_from_qa = qa_collection.distinct(
                "subject",
                {"class_level": class_level}
            )
            available_subjects.update(_normalize(s) for s in subjects_from_qa if s)
            
            try:
                from app.db.mongo import pinecone_index
                if pinecone_index:
                    stats = pinecone_index.describe_index_stats()
                    namespaces = stats.get('namespaces', {})
                    
                    for namespace in namespaces.keys():
                        parts = namespace.split('_')
                        if len(parts) >= 3 and parts[0] == 'class':
                            try:
                                ns_class = int(parts[1])
                                if ns_class == class_level:
                                    subject = '_'.join(parts[2:])
                                    available_subjects.add(_normalize(subject))
                            except ValueError:
                                continue
            except Exception as e:
                logger.warning(f"Could not check Pinecone namespaces: {e}")
            
            if not available_subjects:
                logger.info(f"No subjects found for class {class_level} - returning empty list (no fallback)")
                return []
            
            formatted_subjects = []
            subject_display_names = {
                "hindi": "Hindi",
                "english": "English",
                "maths": "Maths",
                "mathematics": "Maths",
                "math": "Maths",
                "science": "Science",
                "physics": "Physics",
                "chemistry": "Chemistry",
                "biology": "Biology",
                "history": "History",
                "geography": "Geography",
                "civics": "Civics",
                "economics": "Economics",
                "social-science": "Social Science"
            }
            
            for subject in sorted(available_subjects):
                display_name = subject_display_names.get(subject, subject.title())
                formatted_subjects.append({
                    "name": display_name,
                    "value": subject.lower()
                })
            
            logger.info(f"Found {len(formatted_subjects)} available subjects for class {class_level}")
            return formatted_subjects
            
        except Exception as e:
            logger.error(f"Error getting available subjects: {e}")
            return []
    
    def get_subject_stats(self, subject: str, class_level: int) -> Dict:
        """
        Get statistics for a subject.
        
        Args:
            subject: Subject name
            class_level: Class level
        
        Returns:
            Dict with stats: question_count, student_count, etc.
        """
        try:
            top_questions_collection = db["top_questions"]
            qa_collection = db["question_answer_pairs"]
            
            question_count = top_questions_collection.count_documents({
                "subject": subject.lower(),
                "class_level": class_level
            })
            
            pipeline = [
                {
                    "$match": {
                        "subject": subject.lower(),
                        "class_level": class_level
                    }
                },
                {
                    "$group": {
                        "_id": None,
                        "total_asks": {"$sum": "$ask_count"}
                    }
                }
            ]
            
            result = list(top_questions_collection.aggregate(pipeline))
            total_asks = result[0]["total_asks"] if result else 0
            
            unique_students = len(qa_collection.distinct(
                "user_id",
                {
                    "subject": subject.lower(),
                    "class_level": class_level
                }
            ))
            
            return {
                "subject": subject,
                "class_level": class_level,
                "question_count": question_count,
                "total_asks": total_asks,
                "unique_students": unique_students
            }
            
        except Exception as e:
            logger.error(f"Error getting subject stats: {e}")
            return {
                "subject": subject,
                "class_level": class_level,
                "question_count": 0,
                "total_asks": 0,
                "unique_students": 0
            }

subject_service = SubjectService()
