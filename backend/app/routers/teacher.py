"""
Teacher Router
Handles teacher-specific operations:
- Fetching assigned groups
- Managing manual questions (CRUD)
- Dashboard statistics
- Test evaluation (manual grading for subjective questions)
- Reports with real test session data
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

class ManualGradeItem(BaseModel):
    question_id: str
    score: float
    max_score: float = 10
    feedback: str = ""

class ManualEvaluationRequest(BaseModel):
    session_id: str
    grades: List[ManualGradeItem]

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
        
        unique_students = set()
        for sub in assessment_submissions:
            if sub.get("student_id"):
                unique_students.add(sub["student_id"])
        if is_admin:
            for s in test_sessions:
                if s.get("student_id"):
                    unique_students.add(s["student_id"])
        
        all_scores = []
        for sub in assessment_submissions:
            if sub.get("score") is not None:
                all_scores.append(sub["score"])
        if is_admin:
            for s in test_sessions:
                if s.get("score") is not None:
                    all_scores.append(s["score"])
        
        avg_score = round(sum(all_scores) / len(all_scores), 1) if all_scores else 0
        passing = [s for s in all_scores if s >= 40]
        pass_rate = round((len(passing) / len(all_scores)) * 100, 1) if all_scores else 0
        
        recent_performance = []
        if is_admin:
            for s in test_sessions[:10]:
                recent_performance.append({
                    "name": f"{s.get('subject', '?')[:8]} Ch.{s.get('chapter_number', '?')}",
                    "avg": round(s.get("score", 0), 1),
                    "student": s.get("student_id", "")
                })
        else:
            recent_subs = sorted(assessment_submissions, key=lambda x: x.get("submitted_at", ""), reverse=True)[:10]
            for sub in recent_subs:
                assessment = next((a for a in my_assessments if str(a["_id"]) == sub.get("assessment_id")), None)
                name = assessment.get("title", "Test")[:12] if assessment else "Test"
                recent_performance.append({
                    "name": name,
                    "avg": round(sub.get("score", 0), 1),
                    "student": sub.get("student_id", "")
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
        
        test_reports = []
        
        for assessment in my_assessments[:20]:
            assessment_subs = [s for s in assessment_submissions if s.get("assessment_id") == str(assessment["_id"])]
            avg_score_test = sum(s.get("score", 0) for s in assessment_subs) / len(assessment_subs) if assessment_subs else 0
            test_reports.append({
                "id": str(assessment["_id"]),
                "name": assessment.get("title", "Untitled"),
                "type": "Staff Test",
                "date": assessment.get("created_at", "")[:10] if assessment.get("created_at") else "",
                "taken_by": len(assessment_subs),
                "avg_score": round(avg_score_test, 1),
                "status": "Completed" if assessment_subs else "No submissions"
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
            "total_students": len(unique_students),
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

@router.get("/pending-evaluations")
async def get_pending_evaluations(
    current_user: TokenData = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN]))
):
    """
    Get test sessions that have subjective questions pending manual evaluation.
    AI test evaluations are ONLY visible to Admin, NOT to teachers.
    Teachers should not evaluate AI tests.
    """
    try:
        if current_user.role != UserRole.ADMIN:
            return {"pending_sessions": [], "total": 0, "message": "AI test evaluation is admin-only"}
        
        query = {
            "status": "completed",
            "evaluation_status": "pending_manual_review"
        }
        
        sessions = list(db.db.test_sessions.find(query).sort("completed_at", -1).limit(100))
        
        result = []
        for s in sessions:
            student_name = s.get("student_id", "Unknown")
            student_doc = db.users.find_one({"$or": [
                {"user_id": s.get("student_id")},
                {"_id": ObjectId(s["student_id"]) if ObjectId.is_valid(s.get("student_id", "")) else None}
            ]})
            if student_doc:
                student_name = student_doc.get("name", student_doc.get("user_id", "Unknown"))
            
            evals = s.get("evaluation_details", [])
            pending_qs = [e for e in evals if e.get("evaluation_status") == "pending"]
            auto_qs = [e for e in evals if e.get("evaluation_status") == "auto_evaluated"]
            
            completed_at = s.get("completed_at", "")
            if hasattr(completed_at, 'isoformat'):
                completed_at = completed_at.isoformat()
            
            result.append({
                "session_id": s.get("session_id"),
                "student_id": s.get("student_id"),
                "student_name": student_name,
                "subject": s.get("subject", ""),
                "chapter_number": s.get("chapter_number", 0),
                "topic_name": s.get("topic_name", ""),
                "test_type": s.get("test_type", ""),
                "total_questions": s.get("total_questions", len(evals)),
                "auto_evaluated": len(auto_qs),
                "pending_evaluation": len(pending_qs),
                "auto_score": s.get("score", 0),
                "completed_at": completed_at
            })
        
        return {"pending_sessions": result, "total": len(result)}
    except Exception as e:
        logger.error(f"Get pending evaluations error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/evaluation/{session_id}")
async def get_evaluation_detail(
    session_id: str,
    current_user: TokenData = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN]))
):
    """Get detailed evaluation data for a specific test session."""
    try:
        session = db.db.test_sessions.find_one({"session_id": session_id})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        student_name = session.get("student_id", "Unknown")
        student_doc = db.users.find_one({"$or": [
            {"user_id": session.get("student_id")},
            {"_id": ObjectId(session["student_id"]) if ObjectId.is_valid(session.get("student_id", "")) else None}
        ]})
        if student_doc:
            student_name = student_doc.get("name", student_doc.get("user_id", "Unknown"))
        
        evals = session.get("evaluation_details", [])
        questions = session.get("questions_served", [])
        
        completed_at = session.get("completed_at", "")
        if hasattr(completed_at, 'isoformat'):
            completed_at = completed_at.isoformat()
        
        return {
            "session_id": session.get("session_id"),
            "student_id": session.get("student_id"),
            "student_name": student_name,
            "subject": session.get("subject", ""),
            "chapter_number": session.get("chapter_number", 0),
            "topic_name": session.get("topic_name", ""),
            "test_type": session.get("test_type", ""),
            "evaluation_status": session.get("evaluation_status", "completed"),
            "score": session.get("score", 0),
            "total_questions": session.get("total_questions", len(evals)),
            "correct_count": session.get("correct_count", 0),
            "evaluations": evals,
            "questions": questions,
            "overall_feedback": session.get("overall_feedback", {}),
            "topic_analytics": session.get("topic_analytics", {}),
            "completed_at": completed_at
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get evaluation detail error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/evaluate")
async def submit_manual_evaluation(
    request: ManualEvaluationRequest,
    current_user: TokenData = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN]))
):
    """Submit manual grades for subjective questions in a test session."""
    try:
        session = db.db.test_sessions.find_one({"session_id": request.session_id})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        evals = session.get("evaluation_details", [])
        
        grade_map = {g.question_id: g for g in request.grades}
        
        total_score = 0
        correct_count = 0
        max_possible = 0
        all_evaluated = True
        
        for e in evals:
            q_id = e.get("question_id")
            if q_id in grade_map:
                grade = grade_map[q_id]
                e["score"] = min(grade.score, grade.max_score)
                e["max_score"] = grade.max_score
                e["feedback"] = grade.feedback or e.get("feedback", "")
                e["is_correct"] = grade.score >= (grade.max_score * 0.5)
                e["evaluation_status"] = "manually_evaluated"
                e["evaluated_by"] = current_user.user_id
                e["evaluated_at"] = datetime.utcnow().isoformat()
            
            if e.get("evaluation_status") == "pending":
                all_evaluated = False
            
            total_score += e.get("score", 0)
            max_possible += e.get("max_score", 10)
            if e.get("is_correct"):
                correct_count += 1
        
        percentage_score = min(round((total_score / max_possible) * 100, 1) if max_possible > 0 else 0, 100)
        evaluation_status = "completed" if all_evaluated else "pending_manual_review"
        
        db.db.test_sessions.update_one(
            {"session_id": request.session_id},
            {"$set": {
                "evaluation_details": evals,
                "score": percentage_score,
                "correct_count": correct_count,
                "evaluation_status": evaluation_status,
                "manually_evaluated_by": current_user.user_id,
                "manually_evaluated_at": datetime.utcnow().isoformat()
            }}
        )
        
        return {
            "success": True,
            "message": "Evaluation submitted successfully",
            "new_score": percentage_score,
            "evaluation_status": evaluation_status,
            "evaluated_questions": len(request.grades)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Submit manual evaluation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/completed-tests")
async def get_completed_tests(
    current_user: TokenData = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN]))
):
    """
    Get all completed AI test sessions.
    AI test viewing is ONLY for Admin, NOT for teachers.
    Teachers see their staff test submissions through the assessments/submissions endpoints.
    """
    try:
        if current_user.role != UserRole.ADMIN:
            return {"sessions": [], "total": 0, "message": "AI test viewing is admin-only"}
        
        query = {"status": "completed"}
        
        sessions = list(db.db.test_sessions.find(query).sort("completed_at", -1).limit(200))
        
        result = []
        for s in sessions:
            student_name = s.get("student_id", "Unknown")
            student_doc = db.users.find_one({"$or": [
                {"user_id": s.get("student_id")},
                {"_id": ObjectId(s["student_id"]) if ObjectId.is_valid(s.get("student_id", "")) else None}
            ]})
            if student_doc:
                student_name = student_doc.get("name", student_doc.get("user_id", "Unknown"))
            
            completed_at = s.get("completed_at", "")
            if hasattr(completed_at, 'isoformat'):
                completed_at = completed_at.isoformat()
            
            result.append({
                "session_id": s.get("session_id"),
                "student_id": s.get("student_id"),
                "student_name": student_name,
                "subject": s.get("subject", ""),
                "chapter_number": s.get("chapter_number", 0),
                "topic_name": s.get("topic_name", ""),
                "test_type": s.get("test_type", ""),
                "score": s.get("score", 0),
                "total_questions": s.get("total_questions", 0),
                "correct_count": s.get("correct_count", 0),
                "evaluation_status": s.get("evaluation_status", "completed"),
                "completed_at": completed_at
            })
        
        return {"sessions": result, "total": len(result)}
    except Exception as e:
        logger.error(f"Get completed tests error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
