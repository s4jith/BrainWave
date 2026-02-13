"""
Student Router
Handles student-specific operations:
- Fetching assigned groups with details
- Fetching upcoming tests for student
- Fetching student's curriculum/subjects
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
from bson import ObjectId
from datetime import datetime
import logging

from app.db.mongo import db
from app.core.permissions import get_current_user, require_role
from app.models.rbac_models import UserRole, TokenData

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/student", tags=["student"])

def _get_student_id_variants(current_user: TokenData) -> list:
    """Get all possible ID formats for the current student to match against student_ids in groups."""
    ids = [current_user.user_id]  # e.g., "NCERT2025001"
    
    # Also look up the user's MongoDB _id since groups store student_ids as ObjectId strings
    user_doc = db.users.find_one({
        "$or": [
            {"user_id": current_user.user_id},
            {"email": current_user.email}
        ]
    })
    if user_doc:
        mongo_id = str(user_doc["_id"])
        if mongo_id not in ids:
            ids.append(mongo_id)
    
    return ids

@router.get("/groups")
async def get_student_groups(current_user: TokenData = Depends(require_role([UserRole.STUDENT]))):
    """Get groups the current student is assigned to, with details."""
    try:
        student_ids = _get_student_id_variants(current_user)
        logger.info(f"Looking up groups for student IDs: {student_ids}")
        
        groups = list(db.groups.find({
            "student_ids": {"$in": student_ids}
        }))
        
        result = []
        for g in groups:
            # Get teacher details
            teacher = None
            tid = None
            if g.get("teacher_ids"):
                tid = g.get("teacher_ids")[0]
            elif g.get("teacher_id"):
                tid = g.get("teacher_id")
                
            if tid:
                teacher_doc = db.users.find_one({
                    "$or": [
                        {"user_id": tid},
                        {"_id": ObjectId(tid) if ObjectId.is_valid(tid) else "invalid"}
                    ]
                })
                if teacher_doc:
                    teacher = {
                        "name": teacher_doc.get("name"),
                        "email": teacher_doc.get("email")
                    }

            # Count tests assigned to this group
            test_count = db.tests.count_documents({
                "$or": [
                    {"group_id": str(g["_id"])},
                    {"group_ids": str(g["_id"])}
                ]
            }) if db.tests is not None else 0

            student_count = len(g.get("student_ids", []))

            result.append({
                "id": str(g["_id"]),
                "name": g.get("name"),
                "description": g.get("description", ""),
                "subject": g.get("subject", ""),
                "class_level": g.get("class_level"),
                "batch_year": g.get("batch_year"),
                "teacher": teacher,
                "student_count": student_count,
                "test_count": test_count,
                "created_at": g.get("created_at").isoformat() if g.get("created_at") else None
            })
            
        return {"groups": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/upcoming-tests")
async def get_upcoming_tests(current_user: TokenData = Depends(require_role([UserRole.STUDENT]))):
    """Get upcoming/pending tests for the student."""
    try:
        # Get student's groups
        student_ids = _get_student_id_variants(current_user)
        groups = list(db.groups.find({
            "student_ids": {"$in": student_ids}
        }))
        group_ids = [str(g["_id"]) for g in groups]
        
        if not group_ids:
            return {"tests": [], "total": 0}
        
        # Find tests assigned to these groups
        now = datetime.utcnow()
        tests = list(db.tests.find({
            "$or": [
                {"group_id": {"$in": group_ids}},
                {"group_ids": {"$elemMatch": {"$in": group_ids}}}
            ],
            "status": {"$in": ["active", "published", "upcoming"]}
        }).sort("created_at", -1).limit(20))
        
        result = []
        for t in tests:
            # Check if student already submitted
            submission = db.test_submissions.find_one({
                "test_id": str(t["_id"]),
                "student_id": {"$in": student_ids}
            }) if hasattr(db, 'test_submissions') and db.test_submissions is not None else None
            
            result.append({
                "id": str(t["_id"]),
                "title": t.get("title", "Untitled Test"),
                "subject": t.get("subject", ""),
                "class_level": t.get("class_level"),
                "total_marks": t.get("total_marks", 0),
                "duration_minutes": t.get("duration_minutes", 60),
                "deadline": t.get("end_date").isoformat() if t.get("end_date") else None,
                "status": "submitted" if submission else "pending",
                "score": submission.get("score") if submission else None,
                "created_at": t.get("created_at").isoformat() if t.get("created_at") else None
            })
        
        return {"tests": result, "total": len(result)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/my-subjects")
async def get_student_subjects(current_user: TokenData = Depends(require_role([UserRole.STUDENT]))):
    """Get subjects for the student based on their groups and curriculum."""
    try:
        # Get student's groups
        student_ids = _get_student_id_variants(current_user)
        groups = list(db.groups.find({
            "student_ids": {"$in": student_ids}
        }))
        
        # Extract unique subjects from groups
        subjects_set = set()
        class_levels = set()
        for g in groups:
            if g.get("subject"):
                subjects_set.add(g["subject"])
            if g.get("class_level"):
                class_levels.add(g["class_level"])
        
        # Get curriculum details for those subjects
        result = []
        for subj_name in subjects_set:
            for cls in class_levels:
                subj_id = f"{subj_name.lower().replace(' ', '_')}_{cls}"
                curriculum = db.subjects.find_one({
                    "_id": subj_id,
                    "is_active": True
                })
                if curriculum:
                    chapters = [ch for ch in curriculum.get("chapters", []) if ch.get("is_active", True)]
                    result.append({
                        "id": subj_id,
                        "subject_name": curriculum.get("subject_name"),
                        "class_level": curriculum.get("class_level"),
                        "total_chapters": len(chapters),
                        "chapters": [
                            {
                                "chapter_number": ch.get("chapter_number"),
                                "title": ch.get("title"),
                                "topics": [t.get("name") for t in ch.get("topics", []) if t.get("is_active", True)]
                            }
                            for ch in chapters
                        ]
                    })
        
        return {"subjects": result, "total": len(result)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
