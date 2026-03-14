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

DEFAULT_FEATURE_FLAGS = {
    "ai_chatbot": False,
    "test_center": False,
    "my_grades": False,
    "book_to_bot": True,  # Unlocked by default; admin/group can lock it
    "book_to_bot_doubt": False,  # Locked by default; can be unlocked by admin/group
}

def _get_student_id_variants(current_user: TokenData) -> list:
    """Get all possible ID formats for the current student to match against student_ids in groups."""
    ids = [current_user.user_id]
    
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


def _safe_iso(value: Any) -> Optional[str]:
    """Return ISO string for datetime-like values while tolerating already-string fields."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, str):
        return value
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            return str(value)
    return str(value)

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
    """Get upcoming/pending tests for the student (from both assessments and tests collections)."""
    try:
        student_ids = _get_student_id_variants(current_user)
        groups = list(db.groups.find({"student_ids": {"$in": student_ids}}))
        group_ids = [str(g["_id"]) for g in groups]

        result = []

        # ── 1. Query the `assessments` collection (created via CreateTest.jsx) ──
        assessment_query = {
            "$or": (
                [{"student_ids": {"$in": student_ids}}] +
                ([{"group_ids": {"$in": group_ids}}] if group_ids else [])
            ),
            "status": {"$in": ["published", "active"]}
        }
        assessments = list(db.assessments.find(assessment_query).sort("created_at", -1).limit(50))
        for a in assessments:
            submission = db.submissions.find_one({
                "assessment_id": str(a["_id"]),
                "student_id": {"$in": student_ids}
            }) if db.submissions is not None else None

            result.append({
                "id": str(a["_id"]),
                "title": a.get("title", "Untitled Test"),
                "subject": a.get("subject", ""),
                "class_level": a.get("class_level"),
                "total_marks": a.get("total_points", 0),
                "duration_minutes": a.get("duration_minutes", 60),
                "deadline": _safe_iso(a.get("end_datetime")) or _safe_iso(a.get("due_date")),
                "start_datetime": _safe_iso(a.get("start_datetime")),
                "status": "submitted" if submission else "pending",
                "score": submission.get("score") if submission else None,
                "source": "assessment",
                "created_at": _safe_iso(a.get("created_at"))
            })

        # ── 2. Query the legacy `tests` collection ──
        if group_ids:
            tests_query = {
                "$or": [
                    {"group_id": {"$in": group_ids}},
                    {"group_ids": {"$in": group_ids}},
                    {"student_ids": {"$in": student_ids}}
                ],
                "status": {"$in": ["active", "published", "upcoming", "scheduled"]}
            }
            existing_ids = {r["id"] for r in result}
            tests = list(db.tests.find(tests_query).sort("created_at", -1).limit(50))
            for t in tests:
                tid = str(t["_id"])
                if tid in existing_ids:
                    continue
                submission = db.test_submissions.find_one({
                    "test_id": tid,
                    "student_id": {"$in": student_ids}
                }) if db.test_submissions is not None else None

                result.append({
                    "id": tid,
                    "title": t.get("title", "Untitled Test"),
                    "subject": t.get("subject", ""),
                    "class_level": t.get("class_level"),
                    "total_marks": t.get("total_marks", 0),
                    "duration_minutes": t.get("duration_minutes", 60),
                    "deadline": _safe_iso(t.get("end_date")) or _safe_iso(t.get("due_date")),
                    "start_datetime": None,
                    "status": "submitted" if submission else "pending",
                    "score": submission.get("score") if submission else None,
                    "source": "test",
                    "created_at": _safe_iso(t.get("created_at"))
                })

        # Sort all results by created_at descending
        result.sort(key=lambda x: x.get("created_at") or "", reverse=True)

        return {"tests": result, "total": len(result)}
    except Exception as e:
        logger.error(f"get_upcoming_tests error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/my-features")
async def get_student_features(current_user: TokenData = Depends(require_role([UserRole.STUDENT]))):
    """Get effective feature flags for the current student.
    
    Resolution order:
    1. Student-level overrides (highest priority)
    2. Group-level flags (if ANY group enables a feature, it's enabled)
    3. Default (all locked)
    """
    try:
        student_ids = _get_student_id_variants(current_user)
        
        # Get student's feature overrides
        user_doc = db.users.find_one({
            "$or": [
                {"user_id": current_user.user_id},
                {"email": current_user.email}
            ]
        })
        student_overrides = user_doc.get("feature_overrides", {}) if user_doc else {}
        
        # Get all groups this student belongs to
        groups = list(db.groups.find({"student_ids": {"$in": student_ids}}))
        
        # Merge group flags with direction-aware logic:
        # - Default-False features: any group enabling it unlocks it (OR)
        # - Default-True features (e.g. book_to_bot): any group disabling it locks it
        group_flags = {}
        for g in groups:
            gf = g.get("feature_flags", {})
            for key, default_val in DEFAULT_FEATURE_FLAGS.items():
                if key in gf:
                    val = gf[key]
                    if not default_val:
                        # Default-locked: any group enabling unlocks
                        if val:
                            group_flags[key] = True
                    else:
                        # Default-unlocked: any group disabling locks
                        if not val:
                            group_flags[key] = False
        
        # Resolve: student override > group flags > default
        effective = {}
        for key, default_val in DEFAULT_FEATURE_FLAGS.items():
            if key in student_overrides:
                effective[key] = student_overrides[key]
            elif key in group_flags:
                effective[key] = group_flags[key]
            else:
                effective[key] = default_val
        
        return {"features": effective}
    except Exception as e:
        logger.error(f"Error fetching student features: {e}")
        return {"features": DEFAULT_FEATURE_FLAGS}


@router.get("/my-subjects")
async def get_student_subjects(current_user: TokenData = Depends(require_role([UserRole.STUDENT]))):
    """Get subjects for the student based on their groups and curriculum."""
    try:
        student_ids = _get_student_id_variants(current_user)
        groups = list(db.groups.find({
            "student_ids": {"$in": student_ids}
        }))
        
        subjects_set = set()
        class_levels = set()
        for g in groups:
            if g.get("subject"):
                subjects_set.add(g["subject"])
            if g.get("class_level"):
                class_levels.add(g["class_level"])
        
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
