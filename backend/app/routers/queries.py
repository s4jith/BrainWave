"""
Queries Router
Student → Teacher query (message) system.
- Students send queries to a specific teacher via group
- Teachers view and reply to queries from their group students
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from bson import ObjectId
from datetime import datetime
import logging

from app.db.mongo import db
from app.core.permissions import require_role
from app.models.rbac_models import UserRole, TokenData
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/queries", tags=["queries"])


class CreateQueryRequest(BaseModel):
    group_id: str
    subject: str
    message: str


class ReplyRequest(BaseModel):
    reply: str


def _get_user_id_variants(user_id: str) -> list:
    ids = [user_id]
    user_doc = db.users.find_one({"user_id": user_id})
    if user_doc:
        mongo_id = str(user_doc["_id"])
        if mongo_id not in ids:
            ids.append(mongo_id)
    return ids


# ─── Student endpoints ────────────────────────────────────────────────────────

@router.post("")
async def create_query(
    body: CreateQueryRequest,
    current_user: TokenData = Depends(require_role([UserRole.STUDENT]))
):
    """Student submits a query for a specific group (goes to that group's teacher)."""
    if not ObjectId.is_valid(body.group_id):
        raise HTTPException(status_code=400, detail="Invalid group_id")

    group = db.groups.find_one({"_id": ObjectId(body.group_id)})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    student_ids = _get_user_id_variants(current_user.user_id)
    if not any(sid in (group.get("student_ids") or []) for sid in student_ids):
        raise HTTPException(status_code=403, detail="You are not in this group")

    # Resolve teacher_id for this group
    teacher_id = None
    if group.get("teacher_ids"):
        teacher_id = group["teacher_ids"][0]
    elif group.get("teacher_id"):
        teacher_id = group["teacher_id"]

    student_doc = db.users.find_one({
        "$or": [{"user_id": current_user.user_id}, {"email": current_user.email}]
    })
    student_name = student_doc.get("name", "Unknown") if student_doc else "Unknown"

    doc = {
        "group_id": body.group_id,
        "group_name": group.get("name", ""),
        "subject": body.subject,
        "student_id": current_user.user_id,
        "student_name": student_name,
        "teacher_id": teacher_id,
        "message": body.message.strip(),
        "reply": None,
        "reply_at": None,
        "status": "open",
        "created_at": datetime.utcnow(),
    }
    result = db.queries.insert_one(doc)
    return {"id": str(result.inserted_id), "message": "Query sent successfully"}


@router.get("/student")
async def get_student_queries(
    current_user: TokenData = Depends(require_role([UserRole.STUDENT]))
):
    """Get all queries submitted by this student."""
    queries = list(
        db.queries.find({"student_id": current_user.user_id}).sort("created_at", -1).limit(50)
    )
    return {"queries": [_format_query(q) for q in queries]}


# ─── Teacher endpoints ────────────────────────────────────────────────────────

@router.get("/teacher")
async def get_teacher_queries(
    status: Optional[str] = None,
    current_user: TokenData = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN]))
):
    """Get queries addressed to this teacher (from their group students)."""
    teacher_ids = _get_user_id_variants(current_user.user_id)

    # Find groups this teacher owns
    groups = list(db.groups.find({
        "$or": [
            {"teacher_id": {"$in": teacher_ids}},
            {"teacher_ids": {"$in": teacher_ids}}
        ]
    }, {"_id": 1}))
    group_ids = [str(g["_id"]) for g in groups]

    query_filter: dict = {
        "$or": [
            {"teacher_id": {"$in": teacher_ids}},
            {"group_id": {"$in": group_ids}},
        ]
    }
    if status:
        query_filter["status"] = status

    queries = list(db.queries.find(query_filter).sort("created_at", -1).limit(100))
    return {"queries": [_format_query(q) for q in queries]}


@router.post("/{query_id}/reply")
async def reply_to_query(
    query_id: str,
    body: ReplyRequest,
    current_user: TokenData = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN]))
):
    """Teacher replies to a student query."""
    if not ObjectId.is_valid(query_id):
        raise HTTPException(status_code=400, detail="Invalid query_id")

    q = db.queries.find_one({"_id": ObjectId(query_id)})
    if not q:
        raise HTTPException(status_code=404, detail="Query not found")

    teacher_ids = _get_user_id_variants(current_user.user_id)
    groups = list(db.groups.find({
        "$or": [
            {"teacher_id": {"$in": teacher_ids}},
            {"teacher_ids": {"$in": teacher_ids}}
        ]
    }, {"_id": 1}))
    group_ids = [str(g["_id"]) for g in groups]

    if q.get("teacher_id") not in teacher_ids and q.get("group_id") not in group_ids:
        raise HTTPException(status_code=403, detail="Not authorized to reply to this query")

    db.queries.update_one(
        {"_id": ObjectId(query_id)},
        {"$set": {
            "reply": body.reply.strip(),
            "reply_at": datetime.utcnow(),
            "status": "answered",
            "replied_by": current_user.user_id,
        }}
    )
    return {"message": "Reply sent"}


# ─── Shared helper ────────────────────────────────────────────────────────────

def _format_query(q: dict) -> dict:
    return {
        "id": str(q["_id"]),
        "group_id": q.get("group_id"),
        "group_name": q.get("group_name", ""),
        "subject": q.get("subject", ""),
        "student_id": q.get("student_id"),
        "student_name": q.get("student_name", ""),
        "teacher_id": q.get("teacher_id"),
        "message": q.get("message", ""),
        "reply": q.get("reply"),
        "reply_at": q["reply_at"].isoformat() if q.get("reply_at") else None,
        "status": q.get("status", "open"),
        "created_at": q["created_at"].isoformat() if q.get("created_at") else None,
    }
