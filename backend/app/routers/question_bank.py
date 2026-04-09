"""
Question Bank Router
Centralized management for all questions (Admin & Staff)
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Body, UploadFile, File
from fastapi.responses import FileResponse
from typing import List, Optional, Dict
from app.services.question_bank_service import question_bank_service
from app.core.permissions import get_current_user, require_role
from app.models.rbac_models import UserRole, TokenData
from pydantic import BaseModel, Field
from pathlib import Path
from bson import ObjectId
import logging
import uuid
import os
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/question-bank", tags=["question-bank"])

# Directory where question images are stored
QUESTION_IMAGES_DIR = Path(__file__).parent.parent / "uploads" / "question_images"
QUESTION_IMAGES_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"}
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB

class QuestionCreate(BaseModel):
    text: str = Field(..., description="Question text")
    subject: str
    class_level: int
    chapter: int
    topic: Optional[str] = None
    type: str = Field(..., min_length=1)
    difficulty: str = Field(..., min_length=1)
    bloom_level: Optional[str] = Field(None, min_length=1, description="Bloom's taxonomy cognitive level")
    marks: int
    options: List[str] = []
    correct_answer: str
    status: str = Field("approved", pattern="^(approved|pending|rejected|draft_answer|archived)$")
    image_ids: List[str] = Field(default_factory=list, description="IDs of images embedded in this question")
    answer_image_ids: List[str] = Field(default_factory=list, description="IDs of answer/explanation reference images")

class QuestionUpdate(BaseModel):
    text: Optional[str] = None
    subject: Optional[str] = None
    class_level: Optional[int] = None
    chapter: Optional[int] = None
    topic: Optional[str] = None
    type: Optional[str] = None
    difficulty: Optional[str] = None
    bloom_level: Optional[str] = None
    marks: Optional[int] = None
    options: Optional[List[str]] = None
    correct_answer: Optional[str] = None
    status: Optional[str] = None
    image_ids: Optional[List[str]] = None
    answer_image_ids: Optional[List[str]] = None

class GenerateRequest(BaseModel):
    class_level: int
    subject: str
    chapter: int
    config: Dict[str, Dict[str, int]]
    bloom_level: Optional[str] = Field(None, min_length=1, description="Bloom's taxonomy cognitive level for AI generation")

class DeleteRequestBody(BaseModel):
    reason: Optional[str] = None

@router.get("/subjects")
async def get_subjects(
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.TEACHER, UserRole.HEAD]))
):
    """
    Get available subjects.
    - Admin/Head: All unique subjects in DB (Questions + Books) + defaults.
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
    bloom_level: Optional[str] = None,
    status: Optional[str] = "approved",
    limit: int = 50,
    offset: int = 0,
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.TEACHER, UserRole.HEAD]))
):
    """
    Get questions from bank.
    - Admins/Heads: See all.
    - Teachers: See only questions matching their assigned groups' subject/class.
    """
    try:
        group_filters = None
        extra_filter = None

        if status == "draft_answer":
            # Answer Page: show only creator/trigger owner drafts, regardless of staff role.
            extra_filter = {
                "$or": [
                    {"created_by": current_user.user_id},
                    {"triggered_by": current_user.user_id},
                ]
            }

        if current_user.role == UserRole.HEAD and status != "draft_answer":
            from app.db.mongo import db
            from app.routers.head_approval import build_assignment_filter, get_head_user
            head_doc = get_head_user(current_user.user_id)
            extra_filter = build_assignment_filter(head_doc, {})

        if current_user.role == UserRole.TEACHER and status != "draft_answer":
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
            bloom_level=bloom_level,
            status=status,
            limit=limit,
            offset=offset,
            group_filters=group_filters,
            user_id=current_user.user_id,
            user_role=current_user.role.value,
            extra_filter=extra_filter
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
        
        # Teachers: questions go to pending for head approval
        if current_user.role == UserRole.TEACHER:
            question_data["status"] = "pending"
            question_data["teacher_id"] = current_user.user_id

        id = await question_bank_service.create_question(
            question_data, 
            current_user.user_id, 
            current_user.role.value
        )
        
        if current_user.role == UserRole.TEACHER:
            return {"success": True, "id": id, "message": "Question submitted for approval"}
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
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.HEAD]))
):
    """Approve a pending question. Only Head and Admin can approve."""
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
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.HEAD]))
):
    """Reject a pending question. Only Head and Admin can reject."""
    try:
        if not ObjectId.is_valid(question_id):
            raise HTTPException(status_code=400, detail="Invalid ID")

        query = {"_id": ObjectId(question_id), "status": "pending"}

        # Heads can reject only within their assignment scope.
        if current_user.role == UserRole.HEAD:
            from app.db.mongo import db
            from app.routers.head_approval import build_assignment_filter, get_head_user

            head_doc = get_head_user(current_user.user_id)
            query = build_assignment_filter(head_doc, query)

        from app.db.mongo import db
        result = db.questions.find_one_and_update(
            query,
            {
                "$set": {
                    "status": "rejected",
                    "rejected_by": current_user.user_id,
                    "rejected_at": datetime.utcnow().isoformat()
                }
            },
            return_document=True
        )

        if not result:
            raise HTTPException(status_code=404, detail="Pending question not found")

        return {"success": True, "message": "Question rejected"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/questions/{question_id}")
async def delete_question(
    question_id: str,
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.TEACHER, UserRole.HEAD]))
):
    """Delete a question. Admin and Head can hard-delete; teachers use /archive instead."""
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


@router.post("/questions/{question_id}/archive")
async def archive_question(
    question_id: str,
    current_user: TokenData = Depends(require_role([UserRole.TEACHER]))
):
    """Soft-delete (archive) a question. Teachers use this instead of hard-delete."""
    try:
        success, msg = await question_bank_service.archive_question(
            question_id,
            current_user.user_id
        )
        if not success:
            raise HTTPException(status_code=400, detail=msg)
        return {"success": True, "message": msg}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/questions/{question_id}/request-delete")
async def request_question_delete(
    question_id: str,
    body: DeleteRequestBody = Body(default_factory=DeleteRequestBody),
    current_user: TokenData = Depends(require_role([UserRole.TEACHER]))
):
    """Teacher sends a deletion request to the head for a specific question."""
    from app.db.mongo import db
    from datetime import datetime
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")

    question = db.questions.find_one({"_id": ObjectId(question_id)})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    existing = db.question_delete_requests.find_one({"question_id": question_id, "status": "pending"})
    if existing:
        raise HTTPException(status_code=400, detail="A pending delete request already exists for this question")

    teacher_doc = db.users.find_one({"user_id": current_user.user_id})
    teacher_name = (teacher_doc.get("full_name") or teacher_doc.get("name") or current_user.user_id) if teacher_doc else current_user.user_id

    now = datetime.utcnow()
    req = {
        "question_id": question_id,
        "question_text": question.get("text", "")[:200],
        "question_subject": question.get("subject", ""),
        "question_class_level": question.get("class_level"),
        "teacher_id": current_user.user_id,
        "teacher_name": teacher_name,
        "reason": body.reason or "",
        "status": "pending",
        "created_at": now
    }
    res = db.question_delete_requests.insert_one(req)
    request_id = str(res.inserted_id)

    q_subject = question.get("subject", "")
    q_class = question.get("class_level")

    all_heads = list(db.users.find({"role": "head", "is_active": True},
        {"user_id": 1, "full_name": 1, "name": 1, "assigned_subjects": 1, "assigned_classes": 1, "assignment_type": 1}
    ))
    target_heads = []
    for h in all_heads:
        a_type = h.get("assignment_type", "class")
        if a_type == "subject":
            if q_subject.lower() in [s.lower() for s in h.get("assigned_subjects", [])]:
                target_heads.append(h)
        else:
            if q_class in h.get("assigned_classes", []):
                target_heads.append(h)
    if not target_heads:
        target_heads = all_heads

    for h in target_heads:
        h_uid = h.get("user_id")
        if not h_uid:
            continue
        db.notifications.insert_one({
            "title": "Question Deletion Request",
            "message": f"{teacher_name} requested deletion of: \"{question.get('text', '')[:80]}...\"",
            "type": "warning",
            "category": "delete_request",
            "role": "head",
            "user_id": h_uid,
            "target_user_id": h_uid,
            "request_id": request_id,
            "teacher_id": current_user.user_id,
            "question_id": question_id,
            "read": False,
            "saved": False,
            "created_at": now
        })

    return {"success": True, "message": "Delete request sent to head", "request_id": request_id}


@router.get("/delete-requests")
async def get_delete_requests(
    status: Optional[str] = Query("pending"),
    current_user: TokenData = Depends(require_role([UserRole.HEAD, UserRole.ADMIN]))
):
    """Head views delete requests from teachers."""
    from app.db.mongo import db
    query = {}
    if status and status != "all":
        query["status"] = status

    raw = list(db.question_delete_requests.find(query).sort("created_at", -1).limit(100))
    result = []
    for r in raw:
        result.append({
            "id": str(r["_id"]),
            "question_id": r.get("question_id"),
            "question_text": r.get("question_text", ""),
            "question_subject": r.get("question_subject", ""),
            "question_class_level": r.get("question_class_level"),
            "teacher_id": r.get("teacher_id"),
            "teacher_name": r.get("teacher_name", ""),
            "reason": r.get("reason", ""),
            "status": r.get("status", "pending"),
            "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
            "resolved_at": r["resolved_at"].isoformat() if r.get("resolved_at") else None,
        })
    return {"requests": result, "total": len(result)}


@router.post("/delete-requests/{request_id}/approve")
async def approve_delete_request(
    request_id: str,
    current_user: TokenData = Depends(require_role([UserRole.HEAD, UserRole.ADMIN]))
):
    """Head approves a delete request — actually deletes the question and notifies the teacher."""
    from app.db.mongo import db
    from datetime import datetime
    if not ObjectId.is_valid(request_id):
        raise HTTPException(status_code=400, detail="Invalid request ID")

    req = db.question_delete_requests.find_one({"_id": ObjectId(request_id), "status": "pending"})
    if not req:
        raise HTTPException(status_code=404, detail="Pending request not found")

    question_id = req.get("question_id")
    if question_id and ObjectId.is_valid(question_id):
        success, msg = await question_bank_service.delete_question(
            question_id,
            current_user.user_id,
            current_user.role.value,
        )
        if not success:
            raise HTTPException(status_code=400, detail=msg)

    now = datetime.utcnow()
    db.question_delete_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "approved", "resolved_by": current_user.user_id, "resolved_at": now}}
    )

    teacher_id = req.get("teacher_id")
    if teacher_id:
        head_doc = db.users.find_one({"user_id": current_user.user_id})
        head_name = (head_doc.get("full_name") or head_doc.get("name") or current_user.user_id) if head_doc else current_user.user_id
        db.notifications.insert_one({
            "title": "Delete Request Approved ✓",
            "message": f"Your question deletion request was approved by {head_name}. The question has been removed.",
            "type": "success",
            "category": "delete_request",
            "role": "teacher",
            "user_id": teacher_id,
            "target_user_id": teacher_id,
            "read": False,
            "saved": False,
            "created_at": now
        })

    return {"success": True, "message": "Question deleted and teacher notified"}


@router.post("/delete-requests/{request_id}/reject")
async def reject_delete_request(
    request_id: str,
    body: DeleteRequestBody = Body(default_factory=DeleteRequestBody),
    current_user: TokenData = Depends(require_role([UserRole.HEAD, UserRole.ADMIN]))
):
    """Head rejects a delete request — question stays and teacher is notified."""
    from app.db.mongo import db
    from datetime import datetime
    if not ObjectId.is_valid(request_id):
        raise HTTPException(status_code=400, detail="Invalid request ID")

    req = db.question_delete_requests.find_one({"_id": ObjectId(request_id), "status": "pending"})
    if not req:
        raise HTTPException(status_code=404, detail="Pending request not found")

    now = datetime.utcnow()
    db.question_delete_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "rejected", "resolved_by": current_user.user_id, "resolved_at": now, "head_note": body.reason or ""}}
    )

    teacher_id = req.get("teacher_id")
    if teacher_id:
        head_doc = db.users.find_one({"user_id": current_user.user_id})
        head_name = (head_doc.get("full_name") or head_doc.get("name") or current_user.user_id) if head_doc else current_user.user_id
        note = f" Reason: {body.reason}" if body.reason else ""
        db.notifications.insert_one({
            "title": "Delete Request Rejected",
            "message": f"Your question deletion request was rejected by {head_name}.{note} The question remains in the bank.",
            "type": "error",
            "category": "delete_request",
            "role": "teacher",
            "user_id": teacher_id,
            "target_user_id": teacher_id,
            "read": False,
            "saved": False,
            "created_at": now
        })

    return {"success": True, "message": "Request rejected and teacher notified"}


@router.post("/generate")
async def generate_questions(
    request: GenerateRequest,
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.TEACHER, UserRole.HEAD]))
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
            current_user.role.value,
            bloom_level=request.bloom_level
        )
        
        # AI-generated questions are stored as draft_answer first.
        # Teacher/Admin can fill answers in Answer Page, then send each to pending.
        if current_user.role == UserRole.TEACHER and result.get("success"):
            result["message"] = f"Successfully generated {result.get('count', 0)} questions. Fill answers in Answer Page, then send to pending for head approval."
        elif current_user.role == UserRole.ADMIN and result.get("success"):
            result["message"] = f"Successfully generated {result.get('count', 0)} questions. Fill answers in Answer Page, then send to pending."
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/questions/{question_id}/send-to-pending")
async def send_question_to_pending(
    question_id: str,
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.TEACHER, UserRole.HEAD]))
):
    """
    Move an AI draft question from draft_answer -> pending after answer is filled.
    Pending questions are visible to admin/head approval flow only.
    """
    from app.db.mongo import db

    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")

    question = db.questions.find_one({"_id": ObjectId(question_id)})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    if question.get("status") != "draft_answer":
        raise HTTPException(status_code=400, detail="Only draft answer questions can be sent to pending")

    is_owner = (
        question.get("triggered_by") == current_user.user_id
        or question.get("created_by") == current_user.user_id
    )
    if not is_owner:
        raise HTTPException(status_code=403, detail="You can only send your own draft questions")

    q_type = (question.get("type") or "").lower()
    correct_answer = (question.get("correct_answer") or "").strip()
    options = question.get("options") or []

    if not correct_answer:
        raise HTTPException(status_code=400, detail="Please fill the answer before sending to pending")

    if q_type == "mcq":
        if not options or any(not str(opt).strip() for opt in options):
            raise HTTPException(status_code=400, detail="MCQ options are incomplete")
        answers = [a.strip() for a in correct_answer.split("|") if a.strip()]
        if not answers:
            raise HTTPException(status_code=400, detail="Please select at least one correct answer")
        invalid = [a for a in answers if a not in options]
        if invalid:
            raise HTTPException(status_code=400, detail="Correct answer must match one of the options")

    if q_type == "true_false" and correct_answer not in ("True", "False"):
        raise HTTPException(status_code=400, detail="True/False question must have answer as True or False")

    success, msg = await question_bank_service.update_question(
        question_id,
        {"status": "pending", "updated_at": __import__("datetime").datetime.utcnow().isoformat()},
        current_user.user_id,
        current_user.role.value,
    )
    if not success:
        raise HTTPException(status_code=400, detail=msg)

    return {"success": True, "message": "Question sent to pending approval"}

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


# ---------------------------------------------------------------------------
# Question Image Upload & Serve
# ---------------------------------------------------------------------------

@router.post("/images/upload")
async def upload_question_image(
    file: UploadFile = File(...),
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.TEACHER, UserRole.HEAD]))
):
    """
    Upload an image to attach to a question.
    Returns an image_id. Use [img:<image_id>] in the question text to embed it.
    """
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Allowed types: JPEG, PNG, GIF, WebP"
        )

    contents = await file.read()

    if len(contents) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Image too large. Maximum allowed size is 5 MB.")

    # Derive a safe extension from content_type
    ext_map = {
        "image/jpeg": "jpg", "image/jpg": "jpg",
        "image/png": "png", "image/gif": "gif", "image/webp": "webp"
    }
    ext = ext_map.get(file.content_type, "jpg")

    image_id = str(uuid.uuid4())
    filename = f"{image_id}.{ext}"
    file_path = QUESTION_IMAGES_DIR / filename

    with open(file_path, "wb") as f:
        f.write(contents)

    logger.info(f"Question image uploaded: {filename} by {current_user.user_id}")
    return {
        "success": True,
        "image_id": image_id,
        "filename": filename,
        "embed_tag": f"[img:{image_id}]",
        "message": "Image uploaded. Copy the embed_tag and paste it into your question text where the image should appear."
    }


@router.get("/images/{image_id}")
async def get_question_image(image_id: str):
    """Serve a question image by its ID. No auth required (images are embedded in tests)."""
    # Validate that image_id is a UUID to prevent path traversal
    try:
        uuid.UUID(image_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid image ID format.")

    media_types = {
        "jpg": "image/jpeg", "png": "image/png",
        "gif": "image/gif", "webp": "image/webp"
    }
    for ext, media_type in media_types.items():
        file_path = QUESTION_IMAGES_DIR / f"{image_id}.{ext}"
        if file_path.exists():
            return FileResponse(str(file_path), media_type=media_type)

    raise HTTPException(status_code=404, detail="Image not found.")

