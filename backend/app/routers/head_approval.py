"""
Head Approval Router
Endpoints for the Head role to view, approve, and reject pending questions and papers.
Supports assignment-based filtering: heads assigned to specific classes or subjects
only see content relevant to their assignment.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from app.db.mongo import db, mongodb
from app.core.permissions import require_role
from app.models.rbac_models import UserRole, TokenData
from bson import ObjectId
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/head", tags=["Head Approval"])


# ──────────── Helper: Get Head Assignment Filters ────────────

def get_head_user(user_id: str):
    """Fetch the full head user document to read assignment fields."""
    head = db.users.find_one(
        {"$or": [{"user_id": user_id}, {"email": user_id}]}
    )
    return head


# Common subject name aliases — maps any variant to its regex pattern group
_SUBJECT_ALIAS_GROUPS = [
    ["mathematics", "maths", "math"],
    ["science"],
    ["social science", "social studies", "sst"],
    ["computer science", "computers", "computer"],
    ["english"],
    ["hindi"],
    ["physics"],
    ["chemistry"],
    ["biology"],
]

def _subject_regex_pattern(name: str) -> str:
    """Return a regex that matches the subject name AND its common aliases."""
    lower = name.strip().lower()
    for group in _SUBJECT_ALIAS_GROUPS:
        if lower in group:
            # Escape and join all aliases as an alternation
            escaped = [g.replace(" ", r"\s+") for g in group]
            return "^(" + "|".join(escaped) + ")$"
    # No alias group found — just match the name as-is
    escaped = name.strip().replace(" ", r"\s+")
    return f"^{escaped}$"


def build_assignment_filter(head_doc: dict, base_query: dict = None) -> dict:
    """
    Build a MongoDB query filter based on head's assignment.
    - assignment_type='class' → filter by class_level in assigned_classes
    - assignment_type='subject' → filter by subject in assigned_subjects
    - Admin (no head_doc) → no restriction
    - Head with empty assignment → return impossible filter (see nothing)
    """
    query = dict(base_query) if base_query else {}
    if not head_doc:
        return query

    a_type = head_doc.get("assignment_type", "class")
    a_classes = head_doc.get("assigned_classes", [])
    a_subjects = head_doc.get("assigned_subjects", [])

    if a_type == "class":
        if a_classes:
            query["class_level"] = {"$in": a_classes}
        else:
            # No classes assigned — head should see nothing
            query["_id"] = {"$exists": False}
    elif a_type == "subject":
        if a_subjects:
            # Case-insensitive match for subjects including common aliases (e.g. Mathematics ↔ Maths)
            subject_patterns = [{"subject": {"$regex": _subject_regex_pattern(s), "$options": "i"}} for s in a_subjects]
            if "$and" not in query:
                query["$and"] = [{"$or": subject_patterns}]
            else:
                query["$and"].append({"$or": subject_patterns})
        else:
            # No subjects assigned — head should see nothing
            query["_id"] = {"$exists": False}

    return query


def build_assignment_filter_groups(head_doc: dict) -> dict:
    """Build filter for groups collection."""
    query = {}
    if not head_doc:
        return query

    a_type = head_doc.get("assignment_type", "class")
    a_classes = head_doc.get("assigned_classes", [])
    a_subjects = head_doc.get("assigned_subjects", [])

    if a_type == "class":
        if a_classes:
            query["class_level"] = {"$in": a_classes}
        else:
            # No classes assigned — head sees no groups
            query["_id"] = {"$exists": False}
    elif a_type == "subject":
        if a_subjects:
            subject_patterns = [{"subject": {"$regex": _subject_regex_pattern(s), "$options": "i"}} for s in a_subjects]
            query["$or"] = subject_patterns
        else:
            # No subjects assigned — head sees no groups
            query["_id"] = {"$exists": False}

    return query


# ──────────── My Assignment Info ────────────

@router.get("/my-assignment")
async def get_my_assignment(
    current_user: TokenData = Depends(require_role([UserRole.HEAD, UserRole.ADMIN]))
):
    """Get the current head's assignment info including derived subject list."""
    try:
        head = get_head_user(current_user.user_id)
        if not head:
            return {
                "assignment_type": "class",
                "assigned_classes": [],
                "assigned_subjects": [],
                "head_subjects": []
            }
        group_filter = build_assignment_filter_groups(head)
        head_subjects = sorted(list(set(
            g.get("subject") for g in db.groups.find(group_filter, {"subject": 1})
            if g.get("subject")
        )))
        return {
            "assignment_type": head.get("assignment_type", "class"),
            "assigned_classes": head.get("assigned_classes", []),
            "assigned_subjects": head.get("assigned_subjects", []),
            "head_subjects": head_subjects
        }
    except Exception as e:
        logger.error(f"Error fetching assignment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ──────────── Pending Questions ────────────

@router.get("/pending-questions")
async def get_pending_questions(
    subject: Optional[str] = Query(None),
    class_level: Optional[int] = Query(None),
    teacher_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: TokenData = Depends(require_role([UserRole.HEAD, UserRole.ADMIN]))
):
    """Get all pending questions for head approval, filtered by assignment."""
    try:
        # Build base query with assignment filter
        head_doc = get_head_user(current_user.user_id) if current_user.role == UserRole.HEAD else None
        query = build_assignment_filter(head_doc, {"status": "pending"})

        # Additional user-specified filters
        if subject:
            query["subject"] = {"$regex": f"^{subject}$", "$options": "i"}
        if class_level:
            query["class_level"] = class_level
        if teacher_id:
            teacher_or = {"$or": [
                {"teacher_id": teacher_id},
                {"triggered_by": teacher_id},
                {"created_by": teacher_id}
            ]}
            if "$and" not in query:
                query["$and"] = [teacher_or]
            else:
                query["$and"].append(teacher_or)

        total = db.questions.count_documents(query)
        cursor = db.questions.find(query).sort("created_at", -1).skip(offset).limit(limit)

        questions = []
        for q in cursor:
            # Get teacher name
            t_id = q.get("teacher_id") or q.get("triggered_by") or q.get("created_by")
            teacher_name = None
            if t_id and t_id != "AI":
                teacher_doc = db.users.find_one(
                    {"$or": [{"user_id": t_id}, {"_id": ObjectId(t_id) if ObjectId.is_valid(t_id) else None}]},
                    {"name": 1}
                )
                teacher_name = teacher_doc.get("name") if teacher_doc else None

            questions.append({
                "id": str(q["_id"]),
                "text": q.get("text"),
                "subject": q.get("subject"),
                "class_level": q.get("class_level"),
                "chapter": q.get("chapter"),
                "topic": q.get("topic"),
                "type": q.get("type"),
                "difficulty": q.get("difficulty"),
                "marks": q.get("marks"),
                "options": q.get("options", []),
                "correct_answer": q.get("correct_answer"),
                "status": q.get("status"),
                "teacher_id": t_id,
                "teacher_name": teacher_name,
                "is_ai_generated": q.get("is_ai_generated", False),
                "created_at": q.get("created_at"),
            })

        return {
            "questions": questions,
            "total": total,
            "page": (offset // limit) + 1,
            "pages": (total + limit - 1) // limit
        }
    except Exception as e:
        logger.error(f"Error fetching pending questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/approve-question/{question_id}")
async def approve_question(
    question_id: str,
    current_user: TokenData = Depends(require_role([UserRole.HEAD, UserRole.ADMIN]))
):
    """Approve a pending question — moves it to approved status."""
    try:
        if not ObjectId.is_valid(question_id):
            raise HTTPException(status_code=400, detail="Invalid question ID")

        result = db.questions.find_one_and_update(
            {"_id": ObjectId(question_id), "status": "pending"},
            {"$set": {
                "status": "approved",
                "approved_by": current_user.user_id,
                "approved_at": datetime.utcnow().isoformat()
            }},
            return_document=True
        )

        if not result:
            raise HTTPException(status_code=404, detail="Pending question not found")

        return {"success": True, "message": "Question approved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving question: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reject-question/{question_id}")
async def reject_question(
    question_id: str,
    reason: Optional[str] = Query(None),
    current_user: TokenData = Depends(require_role([UserRole.HEAD, UserRole.ADMIN]))
):
    """Reject a pending question."""
    try:
        if not ObjectId.is_valid(question_id):
            raise HTTPException(status_code=400, detail="Invalid question ID")

        update_fields = {
            "status": "rejected",
            "rejected_by": current_user.user_id,
            "rejected_at": datetime.utcnow().isoformat()
        }
        if reason:
            update_fields["rejection_reason"] = reason

        result = db.questions.find_one_and_update(
            {"_id": ObjectId(question_id), "status": "pending"},
            {"$set": update_fields},
            return_document=True
        )

        if not result:
            raise HTTPException(status_code=404, detail="Pending question not found")

        return {"success": True, "message": "Question rejected"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rejecting question: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-approve-questions")
async def bulk_approve_questions(
    question_ids: list[str],
    current_user: TokenData = Depends(require_role([UserRole.HEAD, UserRole.ADMIN]))
):
    """Approve multiple pending questions at once."""
    try:
        oids = []
        for qid in question_ids:
            if ObjectId.is_valid(qid):
                oids.append(ObjectId(qid))

        if not oids:
            raise HTTPException(status_code=400, detail="No valid question IDs")

        result = db.questions.update_many(
            {"_id": {"$in": oids}, "status": "pending"},
            {"$set": {
                "status": "approved",
                "approved_by": current_user.user_id,
                "approved_at": datetime.utcnow().isoformat()
            }}
        )

        return {
            "success": True,
            "approved_count": result.modified_count,
            "message": f"Approved {result.modified_count} questions"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk approving questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ──────────── Pending Papers ────────────

@router.get("/pending-papers")
async def get_pending_papers(
    subject: Optional[str] = Query(None),
    class_level: Optional[int] = Query(None),
    teacher_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: TokenData = Depends(require_role([UserRole.HEAD, UserRole.ADMIN]))
):
    """Get all pending question papers for head approval, filtered by assignment."""
    try:
        # Build base query with assignment filter
        head_doc = get_head_user(current_user.user_id) if current_user.role == UserRole.HEAD else None
        query = build_assignment_filter(head_doc, {"status": "pending"})

        # Additional user-specified filters
        if subject:
            query["subject"] = {"$regex": f"^{subject}$", "$options": "i"}
        if class_level:
            query["class_level"] = class_level
        if teacher_id:
            teacher_or = {"$or": [
                {"teacher_id": teacher_id},
                {"created_by": teacher_id}
            ]}
            if "$and" not in query:
                query["$and"] = [teacher_or]
            else:
                query["$and"].append(teacher_or)

        total = await mongodb.db.question_papers.count_documents(query)
        cursor = mongodb.db.question_papers.find(query).sort("created_at", -1).skip(offset).limit(limit)

        papers = []
        async for doc in cursor:
            # Get teacher name
            t_id = doc.get("teacher_id") or doc.get("created_by")
            teacher_name = None
            if t_id:
                teacher_doc = db.users.find_one(
                    {"$or": [{"user_id": t_id}, {"_id": ObjectId(t_id) if ObjectId.is_valid(t_id) else None}]},
                    {"name": 1}
                )
                teacher_name = teacher_doc.get("name") if teacher_doc else None

            papers.append({
                "id": str(doc["_id"]),
                "title": doc.get("title"),
                "paper_type": doc.get("paper_type"),
                "class_level": doc.get("class_level"),
                "subject": doc.get("subject"),
                "year": doc.get("year"),
                "question_count": len(doc.get("questions", [])),
                "source": doc.get("source", "manual"),
                "status": doc.get("status"),
                "teacher_id": t_id,
                "teacher_name": teacher_name,
                "created_at": doc.get("created_at"),
            })

        return {
            "papers": papers,
            "total": total,
            "page": (offset // limit) + 1,
            "pages": (total + limit - 1) // limit
        }
    except Exception as e:
        logger.error(f"Error fetching pending papers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/approve-paper/{paper_id}")
async def approve_paper(
    paper_id: str,
    current_user: TokenData = Depends(require_role([UserRole.HEAD, UserRole.ADMIN]))
):
    """Approve a pending question paper."""
    try:
        if not ObjectId.is_valid(paper_id):
            raise HTTPException(status_code=400, detail="Invalid paper ID")

        result = await mongodb.db.question_papers.update_one(
            {"_id": ObjectId(paper_id), "status": "pending"},
            {"$set": {
                "status": "approved",
                "approved_by": current_user.user_id,
                "approved_at": datetime.utcnow().isoformat()
            }}
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Pending paper not found")

        return {"success": True, "message": "Paper approved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving paper: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reject-paper/{paper_id}")
async def reject_paper(
    paper_id: str,
    reason: Optional[str] = Query(None),
    current_user: TokenData = Depends(require_role([UserRole.HEAD, UserRole.ADMIN]))
):
    """Reject a pending question paper."""
    try:
        if not ObjectId.is_valid(paper_id):
            raise HTTPException(status_code=400, detail="Invalid paper ID")

        update_fields = {
            "status": "rejected",
            "rejected_by": current_user.user_id,
            "rejected_at": datetime.utcnow().isoformat()
        }
        if reason:
            update_fields["rejection_reason"] = reason

        result = await mongodb.db.question_papers.update_one(
            {"_id": ObjectId(paper_id), "status": "pending"},
            {"$set": update_fields}
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Pending paper not found")

        return {"success": True, "message": "Paper rejected"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rejecting paper: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ──────────── Dashboard Stats ────────────

@router.get("/dashboard-stats")
async def get_head_dashboard_stats(
    current_user: TokenData = Depends(require_role([UserRole.HEAD, UserRole.ADMIN]))
):
    """Get dashboard statistics for the head, filtered by assignment."""
    try:
        head_doc = get_head_user(current_user.user_id) if current_user.role == UserRole.HEAD else None

        pending_q_filter = build_assignment_filter(head_doc, {"status": "pending"})
        pending_p_filter = build_assignment_filter(head_doc, {"status": "pending"})
        approved_today_filter = build_assignment_filter(head_doc, {
            "status": "approved",
            "approved_at": {"$gte": datetime.utcnow().replace(hour=0, minute=0, second=0).isoformat()}
        })

        pending_questions = db.questions.count_documents(pending_q_filter)
        pending_papers = await mongodb.db.question_papers.count_documents(pending_p_filter)
        approved_questions_today = db.questions.count_documents(approved_today_filter)
        total_teachers = db.users.count_documents({"role": "teacher", "is_active": True})

        return {
            "pending_questions": pending_questions,
            "pending_papers": pending_papers,
            "approved_today": approved_questions_today,
            "total_teachers": total_teachers
        }
    except Exception as e:
        logger.error(f"Error fetching head dashboard stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ──────────── Groups (Read-only for Head) ────────────

@router.get("/groups")
async def get_head_groups(
    current_user: TokenData = Depends(require_role([UserRole.HEAD, UserRole.ADMIN]))
):
    """Get groups relevant to the head's assignment (class or subject)."""
    try:
        head_doc = get_head_user(current_user.user_id) if current_user.role == UserRole.HEAD else None
        query = build_assignment_filter_groups(head_doc)

        cursor = db.groups.find(query).sort("created_at", -1)
        groups = []

        for g in cursor:
            # Resolve teacher names
            teacher_names = []
            for tid in g.get("teacher_ids", []):
                teacher = db.users.find_one(
                    {"_id": ObjectId(tid)} if ObjectId.is_valid(tid) else {"user_id": tid},
                    {"name": 1}
                )
                if teacher:
                    teacher_names.append(teacher.get("name"))

            student_ids = g.get("student_ids", [])
            student_count = len(student_ids)

            # Get basic student info
            students = []
            if student_ids:
                oids = [ObjectId(sid) for sid in student_ids if ObjectId.is_valid(sid)]
                if oids:
                    for s in db.users.find({"_id": {"$in": oids}}, {"name": 1, "user_id": 1, "email": 1, "class_level": 1}):
                        students.append({
                            "id": str(s["_id"]),
                            "name": s.get("name", ""),
                            "user_id": s.get("user_id", ""),
                            "email": s.get("email", ""),
                            "class_level": s.get("class_level")
                        })

            groups.append({
                "id": str(g["_id"]),
                "name": g.get("name"),
                "class_level": g.get("class_level"),
                "subject": g.get("subject"),
                "batch_year": g.get("batch_year"),
                "description": g.get("description", ""),
                "teacher_names": teacher_names,
                "teacher_name": ", ".join(teacher_names) if teacher_names else "No Teacher",
                "student_count": student_count,
                "students": students,
                "feature_flags": g.get("feature_flags", {}),
                "created_at": g.get("created_at").isoformat() if g.get("created_at") else None
            })

        return {"groups": groups, "total": len(groups)}
    except Exception as e:
        logger.error(f"Error fetching head groups: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ──────────── Reports for Head ────────────

@router.get("/reports")
async def get_head_reports(
    current_user: TokenData = Depends(require_role([UserRole.HEAD, UserRole.ADMIN]))
):
    """
    Get report/analytics data relevant to the head's assignment.
    Includes: question stats, group stats, teacher performance.
    """
    try:
        head_doc = get_head_user(current_user.user_id) if current_user.role == UserRole.HEAD else None
        group_filter = build_assignment_filter_groups(head_doc)
        q_filter = build_assignment_filter(head_doc, {})

        # Group stats
        groups = list(db.groups.find(group_filter))
        total_groups = len(groups)
        total_students_in_groups = sum(len(g.get("student_ids", [])) for g in groups)

        # Question stats by status
        q_approved = build_assignment_filter(head_doc, {"status": "approved"})
        q_pending = build_assignment_filter(head_doc, {"status": "pending"})
        q_rejected = build_assignment_filter(head_doc, {"status": "rejected"})

        approved_count = db.questions.count_documents(q_approved)
        pending_count = db.questions.count_documents(q_pending)
        rejected_count = db.questions.count_documents(q_rejected)
        total_questions = approved_count + pending_count + rejected_count

        # Paper stats
        p_approved = build_assignment_filter(head_doc, {"status": "approved"})
        p_pending = build_assignment_filter(head_doc, {"status": "pending"})
        approved_papers = await mongodb.db.question_papers.count_documents(p_approved)
        pending_papers = await mongodb.db.question_papers.count_documents(p_pending)

        # Subject-wise question breakdown
        subject_breakdown = []
        pipeline = [{"$match": build_assignment_filter(head_doc, {})}]
        pipeline.append({"$group": {"_id": {"subject": "$subject", "status": "$status"}, "count": {"$sum": 1}}})
        subject_data = {}
        for doc in db.questions.aggregate(pipeline):
            subj = doc["_id"].get("subject", "Unknown")
            status = doc["_id"].get("status", "unknown")
            if subj not in subject_data:
                subject_data[subj] = {"subject": subj, "approved": 0, "pending": 0, "rejected": 0, "total": 0}
            subject_data[subj][status] = doc["count"]
            subject_data[subj]["total"] += doc["count"]
        subject_breakdown = sorted(subject_data.values(), key=lambda x: x["total"], reverse=True)

        # Class-wise breakdown
        class_pipeline = [{"$match": build_assignment_filter(head_doc, {})}]
        class_pipeline.append({"$group": {"_id": "$class_level", "count": {"$sum": 1}}})
        class_breakdown = []
        for doc in db.questions.aggregate(class_pipeline):
            class_breakdown.append({
                "class_level": doc["_id"],
                "question_count": doc["count"]
            })
        class_breakdown.sort(key=lambda x: x.get("class_level") or 0)

        # Teacher performance (who creates most questions)
        teacher_pipeline = [
            {"$match": build_assignment_filter(head_doc, {"teacher_id": {"$exists": True, "$ne": None}})},
            {"$group": {"_id": "$teacher_id", "total": {"$sum": 1}, "approved": {"$sum": {"$cond": [{"$eq": ["$status", "approved"]}, 1, 0]}}, "pending": {"$sum": {"$cond": [{"$eq": ["$status", "pending"]}, 1, 0]}}, "rejected": {"$sum": {"$cond": [{"$eq": ["$status", "rejected"]}, 1, 0]}}}},
            {"$sort": {"total": -1}},
            {"$limit": 20}
        ]
        teacher_stats = []
        for doc in db.questions.aggregate(teacher_pipeline):
            t_id = doc["_id"]
            teacher = db.users.find_one(
                {"$or": [{"user_id": t_id}, {"_id": ObjectId(t_id) if ObjectId.is_valid(t_id) else None}]},
                {"name": 1}
            )
            teacher_stats.append({
                "teacher_id": t_id,
                "teacher_name": teacher.get("name") if teacher else t_id,
                "total_questions": doc["total"],
                "approved": doc["approved"],
                "pending": doc["pending"],
                "rejected": doc["rejected"],
                "approval_rate": round((doc["approved"] / doc["total"]) * 100, 1) if doc["total"] > 0 else 0
            })

        return {
            "overview": {
                "total_groups": total_groups,
                "total_students": total_students_in_groups,
                "total_questions": total_questions,
                "approved_questions": approved_count,
                "pending_questions": pending_count,
                "rejected_questions": rejected_count,
                "approved_papers": approved_papers,
                "pending_papers": pending_papers
            },
            "subject_breakdown": subject_breakdown,
            "class_breakdown": class_breakdown,
            "teacher_performance": teacher_stats
        }
    except Exception as e:
        logger.error(f"Error fetching head reports: {e}")
        raise HTTPException(status_code=500, detail=str(e))
