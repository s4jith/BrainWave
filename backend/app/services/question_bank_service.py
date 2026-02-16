"""
Question Bank Service
Handles management of the centralized question bank.
"""

from app.db.mongo import db
from app.services.rag_service import rag_service
from app.services.gemini_service import gemini_service
from datetime import datetime, timedelta
from bson import ObjectId
import logging
from typing import List, Optional, Dict

logger = logging.getLogger(__name__)

class QuestionBankService:
    def __init__(self):
        self.collection = db.questions
    
    async def get_questions(
        self,
        class_level: Optional[int] = None,
        subject: Optional[str] = None,
        search: Optional[str] = None,
        type: Optional[str] = None,
        difficulty: Optional[str] = None,
        status: Optional[str] = "approved", # Default to approved
        created_by: Optional[str] = None,  # For teacher-specific view
        limit: int = 50,
        offset: int = 0,
        group_filters: Optional[list] = None,  # List of {subject, class_level} dicts
        user_id: Optional[str] = None,  # Current user ID for filtering
        user_role: Optional[str] = None  # Current user role
    ) -> Dict:
        """Get questions with filters."""
        query = {}
        if class_level:
            query["class_level"] = class_level
        if subject:
            # Case-insensitive subject match
            query["subject"] = {"$regex": f"^{subject}$", "$options": "i"}
        if type:
            query["type"] = type
        if difficulty:
            query["difficulty"] = difficulty
            
        # Approval Status Filter
        if status:
             query["status"] = status
        
        # IMPORTANT: Pending questions should only be visible to:
        # 1. The creator/trigger (admin or teacher who created/triggered it)
        # 2. Admins (who can approve)
        if status == "pending" and user_role != "admin":
            # Non-admin users can only see their own pending questions
            # For AI-generated questions, check triggered_by; for manual, check created_by
            if user_id:
                query["$or"] = [
                    {"created_by": user_id},
                    {"triggered_by": user_id}
                ]
            else:
                # If no user_id provided, return empty for pending
                query["_id"] = {"$exists": False}  # Force no results
        
        # Group-based filtering for teachers
        # Only show questions matching teacher's assigned group subjects/classes
        if group_filters is not None:
            group_or = []
            for gf in group_filters:
                group_or.append({
                    "subject": {"$regex": f"^{gf['subject']}$", "$options": "i"},
                    "class_level": gf["class_level"]
                })
            if group_or:
                # If user also specified subject/class filters, combine with group restriction
                if "$or" not in query:
                    query["$and"] = [{"$or": group_or}]
                else:
                    query["$and"] = [{"$or": group_or}]
             
        # Teacher can only see questions for their subjects OR created by them
        # But per requirements: "Staff can create questions for subjects which they are allocated but admin can... 
        # then the questions created either by staff or admin should be in one db like staff creates chemistry that shows in admin"
        # Implication: Admin sees all. Staff sees all questions for their *assigned subjects*, regardless of who created them.
        
        # If created_by is passed, it might be for "My Questions" filter. 
        # But for general bank access, we probably filter by subject.
        
        if search:
            search_or = [
                {"text": {"$regex": search, "$options": "i"}},
                {"topic": {"$regex": search, "$options": "i"}}
            ]
            if "$and" in query:
                query["$and"].append({"$or": search_or})
            else:
                query["$or"] = search_or
            
        total = self.collection.count_documents(query)
        cursor = self.collection.find(query).sort("created_at", -1).skip(offset).limit(limit)
        
        questions = []
        for q in cursor:
            questions.append({
                "id": str(q["_id"]),
                "text": q.get("text"),
                "subject": q.get("subject"),
                "class_level": q.get("class_level"),
                "chapter": q.get("chapter"),
                "chapter_name": q.get("chapter_name"),
                "topic": q.get("topic"),
                "type": q.get("type"),
                "difficulty": q.get("difficulty"),
                "marks": q.get("marks"),
                "options": q.get("options", []),
                "correct_answer": q.get("correct_answer"),
                "status": q.get("status", "approved"), # Default for old data
                "created_by": q.get("created_by"),
                "created_role": q.get("created_role"),
                "triggered_by": q.get("triggered_by"),
                "created_at": q.get("created_at"),
                "is_ai_generated": q.get("is_ai_generated", False),
                "expires_at": q.get("expires_at")  # For auto-delete countdown
            })
            
        return {
            "questions": questions,
            "total": total,
            "page": (offset // limit) + 1,
            "pages": (total + limit - 1) // limit
        }

    async def create_question(self, question_data: dict, user_id: str, user_role: str):
        """Create a single question manually."""
        question_data["created_by"] = user_id
        question_data["created_role"] = user_role
        question_data["created_at"] = datetime.utcnow().isoformat()
        question_data["updated_at"] = datetime.utcnow().isoformat()
        
        # Ensure default fields
        if "options" not in question_data:
            question_data["options"] = []
            
        result = self.collection.insert_one(question_data)
        
        # Invalidate related caches if any (omitted for now)
        
        return str(result.inserted_id)

    async def update_question(self, question_id: str, update_data: dict, user_id: str, user_role: str):
        """Update a question."""
        if not ObjectId.is_valid(question_id):
            return False, "Invalid ID"
            
        # Check permissions logic if needed. For now, assuming granular access control is in router.
        
        update_data["updated_at"] = datetime.utcnow().isoformat()
        result = self.collection.update_one(
            {"_id": ObjectId(question_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            return False, "Question not found"
            
        return True, "Updated successfully"

    async def delete_question(self, question_id: str, user_id: str, user_role: str):
        """Delete a question."""
        if not ObjectId.is_valid(question_id):
            return False, "Invalid ID"
            
        result = self.collection.delete_one({"_id": ObjectId(question_id)})
        
        if result.deleted_count == 0:
            return False, "Question not found"
            
        return True, "Deleted successfully"

    async def generate_questions(
        self,
        class_level: int,
        subject: str,
        chapter: int,
        config: dict,
        user_id: str,
        user_role: str
    ):
        """
        Generate questions using AI and save to bank.
        
        config example:
        {
            "easy": {"mcq": 5},
            "medium": {"short_answer": 3}
        }
        """
        try:
            # 1. Get Context
            context = rag_service.retrieve_chapter_context(
                class_level=class_level,
                subject=subject,
                chapter=chapter
            )
            
            if not context:
                return {"success": False, "error": "No context found for this chapter. Please upload textbook content first."}

            # 2. Generate
            generated_questions = gemini_service.generate_varied_questions(
                context=context,
                config=config,
                class_level=class_level,
                subject=subject,
                chapter=chapter
            )
            
            # 3. Save to DB
            saved_ids = []
            now = datetime.utcnow()
            expires_at = now + timedelta(days=7)  # Auto-delete after 7 days
            
            for q in generated_questions:
                q_doc = {
                    "text": q.get("text") or q.get("question"), # Handle potential variation in AI output keys
                    "subject": subject,
                    "class_level": class_level,
                    "chapter": chapter,
                    "type": q.get("type", "mcq").lower(),
                    "difficulty": q.get("difficulty", "medium").lower(),
                    "marks": q.get("marks", 1),
                    "options": q.get("options", []),
                    "correct_answer": q.get("correct_answer"),
                    "created_by": "AI",
                    "created_role": "system",
                    "triggered_by": user_id,
                    "triggered_by_role": user_role,
                    "created_at": now.isoformat(),
                    "is_ai_generated": True,
                    "status": "pending", # AI Questions are Pending Approval by default
                    "expires_at": expires_at  # Auto-delete after 7 days if still pending
                }
                
                # Sanitize: ensure no nulls for required fields
                if not q_doc["text"]: continue
                
                res = self.collection.insert_one(q_doc)
                saved_ids.append(str(res.inserted_id))
                
            return {
                "success": True, 
                "count": len(saved_ids), 
                "ids": saved_ids,
                "message": f"Successfully generated {len(saved_ids)} questions. They are now pending approval."
            }
            
        except Exception as e:
            logger.error(f"Generate questions error: {e}")
            return {"success": False, "error": str(e)}

    async def cleanup_expired_pending_questions(self):
        """
        Delete pending questions that have expired (older than 7 days).
        Returns count of deleted questions.
        """
        try:
            now = datetime.utcnow()
            
            # Delete pending questions where expires_at is in the past
            result = self.collection.delete_many({
                "status": "pending",
                "expires_at": {"$lt": now}
            })
            
            deleted_count = result.deleted_count
            if deleted_count > 0:
                logger.info(f"🗑️ Cleaned up {deleted_count} expired pending questions")
            
            return deleted_count
        except Exception as e:
            logger.error(f"Error cleaning up expired questions: {e}")
            return 0

question_bank_service = QuestionBankService()
