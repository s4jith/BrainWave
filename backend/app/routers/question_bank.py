"""
Question Bank Router
Centralized management for all questions (Admin & Staff)
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Body
from typing import List, Optional, Dict
from app.services.question_bank_service import question_bank_service
from app.core.permissions import get_current_user, require_role
from app.models.rbac_models import UserRole, TokenData
from pydantic import BaseModel, Field
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/question-bank", tags=["question-bank"])

class QuestionCreate(BaseModel):
    text: str = Field(..., description="Question text")
    subject: str
    class_level: int
    chapter: int
    topic: Optional[str] = None
    type: str = Field(..., pattern="^(mcq|fillup|short_answer|long_answer)$")
    difficulty: str = Field(..., pattern="^(easy|medium|hard|advanced)$")
    marks: int
    options: List[str] = []
    correct_answer: str
    status: str = Field("approved", pattern="^(approved|pending|rejected)$")

class QuestionUpdate(BaseModel):
    text: Optional[str] = None
    subject: Optional[str] = None
    class_level: Optional[int] = None
    chapter: Optional[int] = None
    topic: Optional[str] = None
    type: Optional[str] = None
    difficulty: Optional[str] = None
    marks: Optional[int] = None
    options: Optional[List[str]] = None
    correct_answer: Optional[str] = None
    status: Optional[str] = None

class GenerateRequest(BaseModel):
    class_level: int
    subject: str
    chapter: int
    config: Dict[str, Dict[str, int]]

@router.get("/subjects")
async def get_subjects(
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.TEACHER]))
):
    """
    Get available subjects.
    - Admin: All unique subjects in DB (Questions + Books) + defaults.
    - Teacher: Only assigned subjects.
    """

    try:
        from app.db.mongo import db
        
        if current_user.role == UserRole.TEACHER:
            logger.info(f"\ud83d\udd0d Question Bank subjects for teacher: {current_user.user_id}")
            
            teacher_user = db.users.find_one({"user_id": current_user.user_id})
            teacher_mongo_id = str(teacher_user["_id"]) if teacher_user else None
            
            group_query = {
                "$or": [
                    {"teacher_id": current_user.user_id},
                    {"teacher_ids": current_user.user_id}
                ]
            }
            
            if teacher_mongo_id and teacher_mongo_id != current_user.user_id:
                group_query["$or"].extend([
                    {"teacher_id": teacher_mongo_id},
                    {"teacher_ids": teacher_mongo_id}
                ])
            
            teacher_groups = list(db.groups.find(group_query, {"subject": 1, "name": 1}))
            
            logger.info(f"   - Found {len(teacher_groups)} groups:")
            for g in teacher_groups:
                logger.info(f"      * {g.get('name')}: {g.get('subject')}")
            
            subjects = sorted(list(set(
                g.get("subject") for g in teacher_groups if g.get("subject")
            )))
            
            logger.info(f"   - Unique subjects: {subjects}")
            return {"subjects": subjects}
        
        q_subjects = db.questions.distinct("subject")
        b_subjects = db.books.distinct("subject")
        
        all_subjects = sorted(list(set(q_subjects + b_subjects)))
        
        return {"subjects": all_subjects}
    except Exception as e:
        logger.error(f"Error fetching subjects: {e}")
        return {"subjects": []}

@router.get("/questions")
async def get_questions(
    class_level: Optional[int] = None,
    subject: Optional[str] = None,
    search: Optional[str] = None,
    type: Optional[str] = None,
    difficulty: Optional[str] = None,
    status: Optional[str] = "approved",
    limit: int = 50,
    offset: int = 0,
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.TEACHER]))
):
    """
    Get questions from bank.
    - Admins: See all.
    - Teachers: See only questions matching their assigned groups' subject/class.
    """
    try:
        group_filters = None
        
        if current_user.role == UserRole.TEACHER:
            from app.db.mongo import db
            
            teacher_doc = db.users.find_one({"user_id": current_user.user_id, "role": "teacher"})
            if not teacher_doc:
                raise HTTPException(status_code=401, detail="User data not found")
            
            teacher_id_str = str(teacher_doc["_id"])
            match_values = [current_user.user_id, teacher_id_str]
            
            teacher_groups = list(db.groups.find({
                "$or": [
                    {"teacher_id": {"$in": match_values}},
                    {"teacher_ids": {"$in": match_values}}
                ]
            }))
            
            group_filters = []
            for g in teacher_groups:
                g_subject = g.get("subject")
                g_class = g.get("class_level")
                if g_subject and g_class:
                    group_filters.append({"subject": g_subject, "class_level": g_class})
            
            if not group_filters:
                return {"questions": [], "total": 0, "page": 1, "pages": 0}
                
        result = await question_bank_service.get_questions(
            class_level=class_level,
            subject=subject,
            search=search,
            type=type,
            difficulty=difficulty,
            status=status,
            limit=limit,
            offset=offset,
            group_filters=group_filters,
            user_id=current_user.user_id,
            user_role=current_user.role.value
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/questions")
async def create_question(
    question: QuestionCreate,
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.TEACHER]))
):
    """Create a manual question."""
    try:
        if current_user.role == UserRole.TEACHER:
            from app.db.mongo import db
            
            user = db.users.find_one({"user_id": current_user.user_id})
            if not user:
                raise HTTPException(status_code=401, detail="User data not found")
            
            teacher_id_str = str(user["_id"])
            match_values = [current_user.user_id, teacher_id_str]
            
            groups = list(db.groups.find({
                "$or": [
                    {"teacher_id": {"$in": match_values}},
                    {"teacher_ids": {"$in": match_values}}
                ]
            }))
            
            teacher_subjects = set()
            for group in groups:
                if "subject" in group:
                    teacher_subjects.add(group["subject"].lower())
            
            if not teacher_subjects:
                raise HTTPException(
                    status_code=403, 
                    detail="You are not assigned to any groups. Please contact admin."
                )
            
            if question.subject.lower() not in teacher_subjects:
                raise HTTPException(
                    status_code=403, 
                    detail=f"You can only create questions for your allocated subjects: {', '.join(teacher_subjects)}"
                )

        question_data = question.model_dump()
        
        id = await question_bank_service.create_question(
            question_data, 
            current_user.user_id, 
            current_user.role.value
        )
        return {"success": True, "id": id, "message": "Question created"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/questions/{question_id}")
async def update_question(
    question_id: str,
    update_data: QuestionUpdate,
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.TEACHER]))
):
    """Update a question."""
    try:
        if current_user.role == UserRole.TEACHER:
            pass 

        success, msg = await question_bank_service.update_question(
            question_id, 
            update_data.model_dump(exclude_unset=True), 
            current_user.user_id, 
            current_user.role.value
        )
        if not success:
             raise HTTPException(status_code=400, detail=msg)
             
        return {"success": True, "message": msg}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/questions/{question_id}/approve")
async def approve_question(
    question_id: str,
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.TEACHER]))
):
    """Approve a pending question."""
    try:
        
        success, msg = await question_bank_service.update_question(
            question_id, 
            {"status": "approved"},
            current_user.user_id, 
            current_user.role.value
        )
        if not success:
             raise HTTPException(status_code=400, detail=msg)
        return {"success": True, "message": "Question approved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/questions/{question_id}/reject")
async def reject_question(
    question_id: str,
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.TEACHER]))
):
    """Reject (delete) a pending question."""
    try:
        
        success, msg = await question_bank_service.delete_question(
            question_id, 
            current_user.user_id, 
            current_user.role.value
        )
        if not success:
             raise HTTPException(status_code=400, detail=msg)
        return {"success": True, "message": "Question rejected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/questions/{question_id}")
async def delete_question(
    question_id: str,
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.TEACHER]))
):
    """Delete a question."""
    try:
        success, msg = await question_bank_service.delete_question(
            question_id, 
            current_user.user_id, 
            current_user.role.value
        )
        if not success:
             raise HTTPException(status_code=400, detail=msg)
             
        return {"success": True, "message": msg}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate")
async def generate_questions(
    request: GenerateRequest,
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.TEACHER]))
):
    """Generate questions using AI."""
    try:
        if current_user.role == UserRole.TEACHER:
            from app.db.mongo import db
            user = db.users.find_one({"user_id": current_user.user_id})
            if not user:
                raise HTTPException(status_code=401, detail="User data not found")
            
            teacher_id_str = str(user["_id"])
            match_values = [current_user.user_id, teacher_id_str]
            
            groups = list(db.groups.find({
                "$or": [
                    {"teacher_id": {"$in": match_values}},
                    {"teacher_ids": {"$in": match_values}}
                ]
            }))
            
            teacher_subjects = set()
            for group in groups:
                if "subject" in group:
                    teacher_subjects.add(group["subject"].lower())
            
            if not teacher_subjects:
                raise HTTPException(
                    status_code=403, 
                    detail="You are not assigned to any groups. Please contact admin."
                )
            
            if request.subject.lower() not in teacher_subjects:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Access denied for subject. Your allowed subjects: {', '.join(teacher_subjects)}"
                )

        result = await question_bank_service.generate_questions(
            request.class_level,
            request.subject,
            request.chapter,
            request.config,
            current_user.user_id,
            current_user.role.value
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cleanup-expired")
async def cleanup_expired_questions(
    current_user: TokenData = Depends(require_role([UserRole.ADMIN]))
):
    """
    Manually trigger cleanup of expired pending questions (older than 7 days).
    Admin only.
    """
    try:
        deleted_count = await question_bank_service.cleanup_expired_pending_questions()
        return {
            "success": True,
            "deleted_count": deleted_count,
            "message": f"Cleaned up {deleted_count} expired pending questions"
        }
    except Exception as e:
        logger.error(f"Manual cleanup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
