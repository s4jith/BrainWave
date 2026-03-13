"""
Teacher Router
Handles teacher-specific operations:
- Fetching assigned groups
- Managing manual questions (CRUD)
- Dashboard statistics
- Reports with real test data
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
import logging

from app.db.mongo import db
from app.core.permissions import get_current_user, require_role
from app.models.rbac_models import UserRole, TokenData
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/teacher", tags=["teacher"])


def _extract_submission_percent(sub: Dict[str, Any]) -> Optional[float]:
    """Normalize submission score into a percent value (0-100) across schema variants."""
    try:
        if sub.get("percentage") is not None:
            return float(sub.get("percentage"))
    except (TypeError, ValueError):
        pass

    try:
        if sub.get("score") is not None:
            return float(sub.get("score"))
    except (TypeError, ValueError):
        pass

    try:
        total = float(sub.get("total_score")) if sub.get("total_score") is not None else None
        max_score = float(sub.get("max_score")) if sub.get("max_score") is not None else None
        if total is not None and max_score and max_score > 0:
            return (total / max_score) * 100.0
    except (TypeError, ValueError, ZeroDivisionError):
        pass

    return None

class QuestionCreate(BaseModel):
    text: str
    subject: str
    class_level: int
    chapter: int
    type: str = "short_answer"
    difficulty: str = "medium"
    marks: int = 1
    options: List[str] = []
    correct_answer: str = ""

class QuestionUpdate(BaseModel):
    text: Optional[str] = None
    subject: Optional[str] = None
    class_level: Optional[int] = None
    chapter: Optional[int] = None
    type: Optional[str] = None
    difficulty: Optional[str] = None
    marks: Optional[int] = None
    options: Optional[List[str]] = None
    correct_answer: Optional[str] = None


@router.get("/groups")
async def get_teacher_groups(current_user: TokenData = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN]))):
    """Get groups assigned to the current teacher."""
    try:
        teacher_doc = db.users.find_one({"user_id": current_user.user_id, "role": "teacher"})
        teacher_id_str = str(teacher_doc["_id"]) if teacher_doc else ""
        
        match_values = [current_user.user_id]
        if teacher_id_str:
            match_values.append(teacher_id_str)
        
        groups = list(db.groups.find({
            "$or": [
                {"teacher_id": {"$in": match_values}},
                {"teacher_ids": {"$in": match_values}}
            ]
        }))
        
        result = []
        for g in groups:
            student_ids = g.get("student_ids", [])
            students = []
            if student_ids:
                student_query = {"$or": [
                    {"user_id": {"$in": student_ids}},
                    {"_id": {"$in": [ObjectId(sid) for sid in student_ids if ObjectId.is_valid(sid)]}}
                ]}
                student_docs = list(db.users.find(student_query, {"password": 0, "permissions": 0}))
                students = [{
                    "id": str(s["_id"]),
                    "user_id": s.get("user_id"),
                    "name": s.get("name"),
                    "email": s.get("email"),
                    "class_level": s.get("class_level")
                } for s in student_docs]

            result.append({
                "id": str(g["_id"]),
                "name": g.get("name"),
                "subject": g.get("subject"),
                "class_level": g.get("class_level"),
                "batch_year": g.get("batch_year"),
                "student_count": len(students),
                "teacher_id": g.get("teacher_id"),
                "students": students
            })
            
        return {"groups": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/questions")
async def get_questions(
    subject: Optional[str] = None,
    class_level: Optional[int] = None,
    current_user: TokenData = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN]))
):
    """Get questions created by the teacher."""
    try:
        query = {"created_by": current_user.user_id}
        if subject:
            query["subject"] = subject
        if class_level:
            query["class_level"] = class_level
            
        questions_cursor = db.questions.find(query).sort("created_at", -1)
        questions = []
        for q in questions_cursor:
            questions.append({
                "id": str(q["_id"]),
                **q,
                "_id": str(q["_id"])
            })
            
        return {"questions": questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/questions")
async def create_question(
    question: QuestionCreate,
    current_user: TokenData = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN]))
):
    """Create a new manual question."""
    try:
        q_doc = question.dict()
        q_doc.update({
            "created_by": current_user.user_id,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        })
        
        result = db.questions.insert_one(q_doc)
        return {"success": True, "id": str(result.inserted_id), "message": "Question created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/questions/{question_id}")
async def update_question(
    question_id: str,
    update_data: QuestionUpdate,
    current_user: TokenData = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN]))
):
    """Update a question."""
    try:
        if not ObjectId.is_valid(question_id):
            raise HTTPException(status_code=400, detail="Invalid ID")
            
        existing = db.questions.find_one({
            "_id": ObjectId(question_id), 
            "created_by": current_user.user_id
        })
        if not existing:
            raise HTTPException(status_code=404, detail="Question not found or permission denied")
            
        update_fields = {k: v for k, v in update_data.dict().items() if v is not None}
        if not update_fields:
            return {"success": False, "message": "No fields to update"}
            
        update_fields["updated_at"] = datetime.utcnow().isoformat()
        
        db.questions.update_one(
            {"_id": ObjectId(question_id)},
            {"$set": update_fields}
        )
        return {"success": True, "message": "Question updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/questions/{question_id}")
async def delete_question(
    question_id: str,
    current_user: TokenData = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN]))
):
    """Delete a question."""
    try:
        if not ObjectId.is_valid(question_id):
            raise HTTPException(status_code=400, detail="Invalid ID")
            
        result = db.questions.delete_one({
            "_id": ObjectId(question_id), 
            "created_by": current_user.user_id
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Question not found or permission denied")
            
        return {"success": True, "message": "Question deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
async def get_teacher_stats(current_user: TokenData = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN]))):
    """Get dashboard stats for teacher (supports both old tests and new assessments)."""
    try:
        teacher_doc = db.users.find_one({"user_id": current_user.user_id})
        teacher_mongo_id = str(teacher_doc["_id"]) if teacher_doc else None
        
        my_questions = db.questions.count_documents({"created_by": current_user.user_id})
        
        old_tests = db.tests.count_documents({"created_by": current_user.user_id, "is_active": True})
        
        new_assessments_query = {"instructor_id": current_user.user_id}
        if teacher_mongo_id:
            new_assessments_query = {
                "$or": [
                    {"instructor_id": current_user.user_id},
                    {"instructor_id": teacher_mongo_id}
                ]
            }
        new_assessments = db.assessments.count_documents(new_assessments_query)
        
        my_tests = old_tests + new_assessments
        
        evaluated = 0
        pending = 0
        
        old_test_ids = [str(t["_id"]) for t in db.tests.find({"created_by": current_user.user_id}, {"_id": 1})]
        if old_test_ids:
            evaluated += db.test_submissions.count_documents({
                "test_id": {"$in": old_test_ids},
                "is_reviewed": True
            })
            pending += db.test_submissions.count_documents({
                "test_id": {"$in": old_test_ids},
                "is_reviewed": False
            })
        
        new_assessment_ids = []
        if teacher_mongo_id:
            new_assessment_ids = [
                str(a["_id"]) for a in db.assessments.find(
                    {"$or": [
                        {"instructor_id": current_user.user_id},
                        {"instructor_id": teacher_mongo_id}
                    ]},
                    {"_id": 1}
                )
            ]
        else:
            new_assessment_ids = [
                str(a["_id"]) for a in db.assessments.find(
                    {"instructor_id": current_user.user_id},
                    {"_id": 1}
                )
            ]
        
        if new_assessment_ids:
            evaluated += db.submissions.count_documents({
                "assessment_id": {"$in": new_assessment_ids},
                "score": {"$ne": None}
            })
            pending += db.submissions.count_documents({
                "assessment_id": {"$in": new_assessment_ids},
                "score": None
            })
            
        return {
            "my_questions": my_questions,
            "my_tests": my_tests,
            "evaluated": evaluated,
            "pending": pending
        }
    except Exception as e:
        logger.error(f"Get teacher stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/reports")
async def get_teacher_reports(current_user: TokenData = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN]))):
    """
    Get detailed analytics/reports for teacher's tests.
    - Teachers: Only see staff-created tests (own + admin tests assigned to their groups). No AI tests.
    - Admins: See both staff tests AND AI test sessions
    """
    try:
        is_admin = current_user.role == UserRole.ADMIN
        
        teacher_doc = db.users.find_one({"user_id": current_user.user_id})
        teacher_mongo_id = str(teacher_doc["_id"]) if teacher_doc else None
        
        match_values = [current_user.user_id]
        if teacher_mongo_id:
            match_values.append(teacher_mongo_id)
        
        teacher_groups = list(db.groups.find({
            "$or": [
                {"teacher_id": {"$in": match_values}},
                {"teacher_ids": {"$in": match_values}}
            ]
        }))
        teacher_group_ids = [str(g["_id"]) for g in teacher_groups]
        
        if is_admin:
            my_assessments = list(db.assessments.find())
        else:
            admin_users = list(db.users.find({"role": "admin"}, {"user_id": 1, "_id": 1}))
            admin_ids = [a["user_id"] for a in admin_users] + [str(a["_id"]) for a in admin_users]
            
            or_conditions = [
                {"instructor_id": current_user.user_id}
            ]
            if teacher_mongo_id:
                or_conditions.append({"instructor_id": teacher_mongo_id})
            
            if teacher_group_ids:
                or_conditions.append({"group_ids": {"$in": teacher_group_ids}})
            
            for g in teacher_groups:
                if g.get("class_level") and g.get("subject"):
                    or_conditions.append({
                        "instructor_id": {"$in": admin_ids},
                        "class_level": g["class_level"],
                        "subject": g["subject"]
                    })
            
            my_assessments = list(db.assessments.find({"$or": or_conditions}))
        
        my_assessment_ids = [str(a["_id"]) for a in my_assessments]
        
        assessment_submissions = list(db.submissions.find({"assessment_id": {"$in": my_assessment_ids}})) if my_assessment_ids else []
        
        group_student_ids = set()
        group_subjects = set()
        for g in teacher_groups:
            for sid in g.get("student_ids", []):
                group_student_ids.add(sid)
            if g.get("subject"):
                group_subjects.add(g["subject"])
        
        student_mongo_ids = set()
        if group_student_ids:
            student_docs = list(db.users.find(
                {"$or": [
                    {"user_id": {"$in": list(group_student_ids)}},
                    {"_id": {"$in": [ObjectId(sid) for sid in group_student_ids if ObjectId.is_valid(sid)]}}
                ]},
                {"_id": 1, "user_id": 1}
            ))
            for s in student_docs:
                student_mongo_ids.add(str(s["_id"]))
                if s.get("user_id"):
                    group_student_ids.add(s["user_id"])
        
        all_student_ids = list(group_student_ids | student_mongo_ids)
        test_sessions = []
        if is_admin:
            test_sessions = list(db.db.test_sessions.find({
                "status": "completed"
            }).sort("completed_at", -1).limit(200))
        
        if is_admin:
            total_assessments = len(my_assessments) + len(set(
                (s.get("subject", ""), s.get("chapter_number", 0), s.get("test_type", ""))
                for s in test_sessions
            ))
        else:
            total_assessments = len(my_assessments)
        
        # total_students: use group membership count (not just submission-based)
        group_total_students = sum(len(g.get("student_ids", [])) for g in teacher_groups)
        unique_students_from_subs = set()
        for sub in assessment_submissions:
            if sub.get("student_id"):
                unique_students_from_subs.add(sub["student_id"])
        if is_admin:
            for s in test_sessions:
                if s.get("student_id"):
                    unique_students_from_subs.add(s["student_id"])
        # Use whichever is larger: group members or submission-based unique students
        total_student_count = max(group_total_students, len(unique_students_from_subs))
        
        all_scores = []
        for sub in assessment_submissions:
            percent = _extract_submission_percent(sub)
            if percent is not None:
                all_scores.append(percent)
        if is_admin:
            for s in test_sessions:
                if s.get("score") is not None:
                    all_scores.append(s["score"])
        
        avg_score = round(sum(all_scores) / len(all_scores), 1) if all_scores else 0
        passing = [s for s in all_scores if s >= 40]
        pass_rate = round((len(passing) / len(all_scores)) * 100, 1) if all_scores else 0
        
        # Build recent_performance: aggregate per test (avg across all submissions per assessment)
        recent_performance = []
        if is_admin:
            for s in test_sessions[:10]:
                recent_performance.append({
                    "name": f"{s.get('subject', '?')[:8]} Ch.{s.get('chapter_number', '?')}",
                    "avg": round(s.get("score", 0), 1),
                })
        else:
            # Group submissions by assessment and compute per-test avg
            subs_by_assessment = {}
            for sub in assessment_submissions:
                aid = sub.get("assessment_id")
                if aid:
                    subs_by_assessment.setdefault(aid, []).append(sub)
            
            for assessment in sorted(my_assessments, key=lambda a: a.get("created_at", ""), reverse=True)[:10]:
                aid = str(assessment["_id"])
                subs = subs_by_assessment.get(aid, [])
                scored = []
                for s in subs:
                    percent = _extract_submission_percent(s)
                    if percent is not None:
                        scored.append(percent)
                avg_t = round(sum(scored) / len(scored), 1) if scored else 0
                recent_performance.append({
                    "name": assessment.get("title", "Test")[:14],
                    "avg": avg_t,
                })
        
        excellent = len([s for s in all_scores if s >= 90])
        good = len([s for s in all_scores if 70 <= s < 90])
        average = len([s for s in all_scores if 50 <= s < 70])
        needs_improvement = len([s for s in all_scores if s < 50])
        
        distribution = [
            {"name": "Excellent (>90)", "value": excellent},
            {"name": "Good (70-90)", "value": good},
            {"name": "Average (50-70)", "value": average},
            {"name": "Needs Improvement (<50)", "value": needs_improvement}
        ]
        
        from datetime import timezone
        
        def compute_assessment_status(assessment):
            """Compute date-based status matching frontend logic."""
            raw_status = assessment.get("status", "draft")
            start = assessment.get("start_datetime")
            end = assessment.get("end_datetime")
            if not start or not end:
                return "active" if raw_status == "published" else raw_status
            now = datetime.utcnow()
            # Normalise start to naive datetime
            if isinstance(start, str):
                try:
                    start = datetime.fromisoformat(start.replace("Z", "+00:00").replace("+00:00", ""))
                except Exception:
                    return "active" if raw_status == "published" else raw_status
            elif isinstance(start, datetime):
                if start.tzinfo is not None:
                    start = start.replace(tzinfo=None)
            else:
                return "active" if raw_status == "published" else raw_status
            # Normalise end to naive datetime
            if isinstance(end, str):
                try:
                    end = datetime.fromisoformat(end.replace("Z", "+00:00").replace("+00:00", ""))
                except Exception:
                    return "active" if raw_status == "published" else raw_status
            elif isinstance(end, datetime):
                if end.tzinfo is not None:
                    end = end.replace(tzinfo=None)
            else:
                return "active" if raw_status == "published" else raw_status
            if now < start:
                return "upcoming"
            if now > end:
                return "completed"
            return "active"
        
        test_reports = []
        
        for assessment in my_assessments[:20]:
            assessment_subs = [s for s in assessment_submissions if s.get("assessment_id") == str(assessment["_id"])]
            assessment_scores = []
            for s in assessment_subs:
                percent = _extract_submission_percent(s)
                if percent is not None:
                    assessment_scores.append(percent)
            avg_score_test = sum(assessment_scores) / len(assessment_scores) if assessment_scores else 0
            computed_status = compute_assessment_status(assessment)
            created_at = assessment.get("created_at", "")
            if hasattr(created_at, "isoformat"):
                created_at = created_at.isoformat()
            test_reports.append({
                "id": str(assessment["_id"]),
                "name": assessment.get("title", "Untitled"),
                "type": "Staff Test",
                "date": str(created_at)[:10] if created_at else "",
                "taken_by": len(assessment_subs),
                "avg_score": round(avg_score_test, 1),
                "status": computed_status,
                "class_level": assessment.get("class_level", ""),
                "subject": assessment.get("subject", ""),
            })
        
        if is_admin:
            session_groups = {}
            for s in test_sessions:
                key = f"{s.get('subject', '')}_{s.get('chapter_number', 0)}_{s.get('test_type', 'ai')}"
                if key not in session_groups:
                    session_groups[key] = {
                        "sessions": [],
                        "subject": s.get("subject", ""),
                        "chapter": s.get("chapter_number", 0),
                        "test_type": s.get("test_type", "ai_with_topics")
                    }
                session_groups[key]["sessions"].append(s)
            
            for key, group in list(session_groups.items())[:15]:
                sessions = group["sessions"]
                scores = [s.get("score", 0) for s in sessions]
                avg_s = sum(scores) / len(scores) if scores else 0
                latest_date = ""
                if sessions and sessions[0].get("completed_at"):
                    completed = sessions[0]["completed_at"]
                    latest_date = completed.strftime("%Y-%m-%d") if hasattr(completed, 'strftime') else str(completed)[:10]
                
                pending_count = sum(1 for s in sessions if s.get("evaluation_status") == "pending_manual_review")
                status = "Completed"
                if pending_count > 0:
                    status = f"{pending_count} Pending Review"
                
                test_reports.append({
                    "id": key,
                    "name": f"{group['subject']} Ch.{group['chapter']} ({group['test_type'].replace('_', ' ').title()})",
                    "type": "AI Test",
                    "date": latest_date,
                    "taken_by": len(sessions),
                    "avg_score": round(avg_s, 1),
                    "status": status,
                    "pending_count": pending_count
                })
        
        test_reports.sort(key=lambda x: x.get("date", ""), reverse=True)
        
        return {
            "total_assessments": total_assessments,
            "total_students": total_student_count,
            "avg_score": avg_score,
            "pass_rate": pass_rate,
            "recent_performance": recent_performance,
            "distribution": distribution,
            "test_reports": test_reports
        }
    except Exception as e:
        logger.error(f"Get teacher reports error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def _get_teacher_student_ids(user_id: str) -> set:
    """Helper: Get all student IDs from teacher's groups."""
    teacher_doc = db.users.find_one({"user_id": user_id})
    teacher_mongo_id = str(teacher_doc["_id"]) if teacher_doc else None
    
    match_values = [user_id]
    if teacher_mongo_id:
        match_values.append(teacher_mongo_id)
    
    teacher_groups = list(db.groups.find({
        "$or": [
            {"teacher_id": {"$in": match_values}},
            {"teacher_ids": {"$in": match_values}}
        ]
    }))
    
    student_ids = set()
    for g in teacher_groups:
        for sid in g.get("student_ids", []):
            student_ids.add(sid)
    
    if student_ids:
        student_docs = list(db.users.find(
            {"$or": [
                {"user_id": {"$in": list(student_ids)}},
                {"_id": {"$in": [ObjectId(sid) for sid in student_ids if ObjectId.is_valid(sid)]}}
            ]},
            {"_id": 1, "user_id": 1}
        ))
        for s in student_docs:
            student_ids.add(str(s["_id"]))
            if s.get("user_id"):
                student_ids.add(s["user_id"])
    
    return student_ids


