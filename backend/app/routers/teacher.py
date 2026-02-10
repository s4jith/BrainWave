"""
Teacher Router
Handles teacher-specific operations:
- Fetching assigned groups
- Managing manual questions (CRUD)
- Dashboard statistics
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Body
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId

from app.db.mongo import db
from app.core.permissions import get_current_user, require_role
from app.models.rbac_models import UserRole, TokenData
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/teacher", tags=["teacher"])

# === Models ===

class QuestionCreate(BaseModel):
    text: str
    subject: str
    class_level: int
    chapter: int
    type: str = "short_answer"
    difficulty: str = "medium"
    marks: int = 1
    options: List[str] = []  # For MCQ
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

# === Endpoints ===

@router.get("/groups")
async def get_teacher_groups(current_user: TokenData = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN]))):
    """Get groups assigned to the current teacher."""
    try:
        # Match teacher_id (string) or teacher_ids (list)
        # current_user.user_id is the string ID used in the system
        groups = list(db.groups.find({
            "$or": [
                {"teacher_id": current_user.user_id},
                {"teacher_ids": current_user.user_id}
            ]
        }))
        
        result = []
        for g in groups:
            # Fetch students for this group
            student_ids = g.get("student_ids", [])
            students = []
            if student_ids:
                # Assuming student_ids are user_ids or ObjectIds. 
                # Ideally they are _ids as strings or ObjectIds.
                # Let's try flexible query
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
            
        # Ensure ownership
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
    """Get dashboard stats for teacher."""
    try:
        # My Questions
        # My Questions
        my_questions = db.questions.count_documents({"created_by": current_user.user_id})
        
        # My Tests (Tests)
        # Using db.tests instead of assessments, and checking created_by
        my_tests = db.tests.count_documents({"created_by": current_user.user_id, "is_active": True})
        
        # Evaluated and Pending (from test_submissions)
        # First get all test IDs created by this teacher
        my_test_ids = [str(t["_id"]) for t in db.tests.find({"created_by": current_user.user_id}, {"_id": 1})]
        
        evaluated = 0
        pending = 0
        
        if my_test_ids:
            # Evaluated = is_reviewed is True
            evaluated = db.test_submissions.count_documents({
                "test_id": {"$in": my_test_ids},
                "is_reviewed": True
            })
            # Pending = is_reviewed is False
            pending = db.test_submissions.count_documents({
                "test_id": {"$in": my_test_ids},
                "is_reviewed": False
            })
            
        return {
            "my_questions": my_questions,
            "my_tests": my_tests,
            "evaluated": evaluated,
            "pending": pending
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports")
async def get_teacher_reports(current_user: TokenData = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN]))):
    """Get detailed analytics/reports for teacher's tests."""
    try:
        # Get teacher's assessments
        my_assessments = list(db.assessments.find({"instructor_id": current_user.user_id}))
        my_assessment_ids = [str(a["_id"]) for a in my_assessments]
        
        total_assessments = len(my_assessments)
        
        # Get unique students who took teacher's tests
        unique_students = set()
        submissions = list(db.submissions.find({"assessment_id": {"$in": my_assessment_ids}}))
        
        total_score = 0
        graded_count = 0
        
        for sub in submissions:
            if sub.get("student_id"):
                unique_students.add(sub["student_id"])
            if sub.get("score") is not None:
                total_score += sub.get("score", 0)
                graded_count += 1
        
        total_students = len(unique_students)
        avg_score = round(total_score / graded_count, 1) if graded_count > 0 else 0
        
        # Pass rate (assuming passing score is 40%)
        passing_submissions = [s for s in submissions if s.get("score", 0) >= 40]
        pass_rate = round((len(passing_submissions) / len(submissions)) * 100, 1) if submissions else 0
        
        # Recent performance by assessment
        recent_performance = []
        for assessment in my_assessments[:5]:  # Last 5 assessments
            assessment_subs = [s for s in submissions if s.get("assessment_id") == str(assessment["_id"])]
            if assessment_subs:
                avg = sum(s.get("score", 0) for s in assessment_subs) / len(assessment_subs)
                recent_performance.append({
                    "name": assessment.get("title", "Untitled")[:15],
                    "avg": round(avg, 1)
                })
        
        # Score distribution
        excellent = len([s for s in submissions if s.get("score", 0) >= 90])
        good = len([s for s in submissions if 70 <= s.get("score", 0) < 90])
        average = len([s for s in submissions if 50 <= s.get("score", 0) < 70])
        needs_improvement = len([s for s in submissions if s.get("score", 0) < 50])
        
        distribution = [
            {"name": "Excellent (>90)", "value": excellent},
            {"name": "Good (70-90)", "value": good},
            {"name": "Average (50-70)", "value": average},
            {"name": "Needs Improvement (<50)", "value": needs_improvement}
        ]
        
        # Detailed test reports
        test_reports = []
        for assessment in my_assessments[:10]:
            assessment_subs = [s for s in submissions if s.get("assessment_id") == str(assessment["_id"])]
            avg_score_test = sum(s.get("score", 0) for s in assessment_subs) / len(assessment_subs) if assessment_subs else 0
            test_reports.append({
                "id": str(assessment["_id"]),
                "name": assessment.get("title", "Untitled"),
                "date": assessment.get("created_at", "")[:10] if assessment.get("created_at") else "",
                "taken_by": len(assessment_subs),
                "avg_score": round(avg_score_test, 1),
                "status": "Completed" if assessment_subs else "No submissions"
            })
        
        return {
            "total_assessments": total_assessments,
            "total_students": total_students,
            "avg_score": avg_score,
            "pass_rate": pass_rate,
            "recent_performance": recent_performance,
            "distribution": distribution,
            "test_reports": test_reports
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
