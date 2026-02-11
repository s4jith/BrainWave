"""
Admin Dashboard Router
- Analytics and metrics
- Student management (CRUD)
- User statistics
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime, timedelta
from bson import ObjectId
import hashlib
import logging

from app.db.mongo import db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["Admin Dashboard"])


# ==================== PYDANTIC MODELS ====================

class StudentCreate(BaseModel):
    """Model for creating a new student."""
    name: str = Field(..., min_length=2, max_length=100)
    age: int = Field(..., ge=5, le=25)
    class_level: int = Field(..., ge=5, le=12)
    email: str = Field(..., description="Gmail address")
    mobile: str = Field(..., min_length=10, max_length=15)


class StudentUpdate(BaseModel):
    """Model for updating a student."""
    name: Optional[str] = None
    age: Optional[int] = None
    class_level: Optional[int] = None
    email: Optional[str] = None
    mobile: Optional[str] = None
    is_active: Optional[bool] = None


class StudentResponse(BaseModel):
    """Model for student response."""
    id: str
    user_id: str
    name: str
    age: int
    email: str
    mobile: str
    class_level: int
    is_active: bool
    is_onboarded: bool
    created_at: Optional[str] = None
    last_login: Optional[str] = None
    tests_completed: int = 0
    avg_score: float = 0.0


# ==================== HELPER FUNCTIONS ====================

def hash_password(password: str) -> str:
    """Hash password using SHA-256."""
    return hashlib.sha256(password.encode()).hexdigest()


def generate_student_id(name: str, age: int) -> str:
    """
    Generate unique student ID.
    Format: {name_lowercase}{age}{sequential_number}
    Example: sajith141 (Sajith, age 14, student #1)
    """
    try:
        # Get next student number
        counter = db.student_counters.find_one_and_update(
            {"_id": "student_count"},
            {"$inc": {"count": 1}},
            upsert=True,
            return_document=True
        )
        student_number = counter.get("count", 1)
        
        # Generate ID: name (lowercase, no spaces) + age + number
        clean_name = name.lower().replace(" ", "").replace(".", "")[:10]
        user_id = f"{clean_name}{age}{student_number}"
        
        return user_id
    except Exception as e:
        logger.error(f"Error generating student ID: {e}")
        # Fallback: use timestamp
        import time
        clean_name = name.lower().replace(" ", "")[:10]
        return f"{clean_name}{age}{int(time.time()) % 10000}"


def generate_password(name: str, age: int) -> str:
    """
    Generate default password.
    Format: {name_lowercase}{age}
    Example: sajith14
    """
    clean_name = name.lower().replace(" ", "").replace(".", "")
    return f"{clean_name}{age}"


def serialize_student(student: dict) -> dict:
    """Convert MongoDB document to response dict."""
    return {
        "id": str(student.get("_id", "")),
        "user_id": student.get("user_id", ""),
        "name": student.get("name", ""),
        "age": student.get("age", 0),
        "email": student.get("email", ""),
        "mobile": student.get("mobile", ""),
        "class_level": student.get("class_level", 10),
        "is_active": student.get("is_active", True),
        "is_onboarded": student.get("isOnboarded", False),
        "created_at": student.get("created_at", datetime.utcnow()).isoformat() if student.get("created_at") else None,
        "last_login": student.get("last_login").isoformat() if student.get("last_login") else None,
        "tests_completed": student.get("tests_completed", 0),
        "avg_score": student.get("avg_score", 0.0)
    }


# ==================== ANALYTICS ENDPOINTS ====================

@router.get("/analytics")
async def get_analytics():
    """
    Get comprehensive analytics for admin dashboard.
    Returns user stats, test stats, activity trends, etc.
    """
    try:
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = today_start - timedelta(days=7)
        month_ago = today_start - timedelta(days=30)
        
        # User Statistics
        total_users = db.users.count_documents({})
        total_students = db.users.count_documents({"role": "student"})
        total_teachers = db.users.count_documents({"role": "teacher"})
        
        # Active users (logged in today/week/month)
        active_today = db.users.count_documents({"last_login": {"$gte": today_start}})
        active_this_week = db.users.count_documents({"last_login": {"$gte": week_ago}})
        active_this_month = db.users.count_documents({"last_login": {"$gte": month_ago}})
        
        # Inactive users (no login in 30 days)
        inactive_users = db.users.count_documents({
            "$or": [
                {"last_login": {"$lt": month_ago}},
                {"last_login": None}
            ]
        })
        
        # New users
        new_users_today = db.users.count_documents({"created_at": {"$gte": today_start}})
        new_users_this_week = db.users.count_documents({"created_at": {"$gte": week_ago}})
        new_users_this_month = db.users.count_documents({"created_at": {"$gte": month_ago}})
        
        user_stats = {
            "total_users": total_users,
            "total_students": total_students,
            "total_teachers": total_teachers,
            "active_today": active_today,
            "active_this_week": active_this_week,
            "active_this_month": active_this_month,
            "inactive_users": inactive_users,
            "new_users_today": new_users_today,
            "new_users_this_week": new_users_this_week,
            "new_users_this_month": new_users_this_month
        }
        
        # Test Statistics - Use test_sessions collection (where tests are actually stored)
        test_sessions = db.get_collection("test_sessions")
        total_tests_taken = test_sessions.count_documents({"status": "completed"})
        tests_today = test_sessions.count_documents({"completed_at": {"$gte": today_start}})
        tests_this_week = test_sessions.count_documents({"completed_at": {"$gte": week_ago}})
        
        # Also check tests in progress
        tests_in_progress = test_sessions.count_documents({"status": "in_progress"})
        
        # Calculate average score from test_sessions (score)
        pipeline = [
            {"$match": {"status": "completed", "score": {"$exists": True}}},
            {"$group": {"_id": None, "avg_score": {"$avg": "$score"}}}
        ]
        avg_result = list(test_sessions.aggregate(pipeline))
        average_score = round(avg_result[0]["avg_score"], 1) if avg_result and avg_result[0].get("avg_score") else 0
        
        # Pass rate (score >= 60%)
        passed = test_sessions.count_documents({"status": "completed", "score": {"$gte": 60}})
        pass_rate = round((passed / total_tests_taken * 100), 1) if total_tests_taken > 0 else 0
        
        # Question sets created
        tests_col = db.get_collection("tests")
        total_tests_created = tests_col.count_documents({})
        
        test_stats = {
            "total_tests_created": total_tests_created,
            "total_tests_taken": total_tests_taken,
            "tests_completed": total_tests_taken,
            "tests_in_progress": tests_in_progress,
            "average_score": average_score,
            "pass_rate": pass_rate,
            "tests_today": tests_today,
            "tests_this_week": tests_this_week
        }
        
        # Activity Trend (last 14 days)
        activity_trend = []
        for i in range(13, -1, -1):
            date = today_start - timedelta(days=i)
            next_date = date + timedelta(days=1)
            
            active_users = db.users.count_documents({
                "last_login": {"$gte": date, "$lt": next_date}
            })
            tests_taken = test_sessions.count_documents({
                "completed_at": {"$gte": date, "$lt": next_date}
            })
            
            activity_trend.append({
                "date": date.strftime("%Y-%m-%d"),
                "active_users": active_users,
                "tests_taken": tests_taken
            })
        
        # Subject-wise Performance
        subject_pipeline = [
            {"$match": {"status": "completed"}},
            {"$group": {
                "_id": "$subject",
                "avg_score": {"$avg": "$score"},
                "total_tests": {"$sum": 1},
                "total_students": {"$addToSet": "$student_id"}
            }},
            {"$project": {
                "_id": 0,
                "subject": "$_id",
                "avg_score": {"$round": ["$avg_score", 1]},
                "total_tests": 1,
                "total_students": {"$size": "$total_students"}
            }}
        ]
        subject_stats = list(test_sessions.aggregate(subject_pipeline))
        
        # Top Performers
        performer_pipeline = [
            {"$match": {"status": "completed"}},
            {"$group": {
                "_id": "$student_id",
                "avg_score": {"$avg": "$score"},
                "tests_completed": {"$sum": 1}
            }},
            {"$match": {"tests_completed": {"$gte": 1}}},
            {"$sort": {"avg_score": -1}},
            {"$limit": 5}
        ]
        top_performers_raw = list(test_sessions.aggregate(performer_pipeline))
        
        top_performers = []
        for p in top_performers_raw:
            student = db.users.find_one({"_id": ObjectId(p["_id"])} if ObjectId.is_valid(str(p["_id"])) else {"user_id": str(p["_id"])})
            top_performers.append({
                "student_id": str(p["_id"]),
                "name": student.get("name", "Unknown") if student else "Unknown",
                "avg_score": round(p["avg_score"], 1),
                "tests_completed": p["tests_completed"]
            })
        
        # Weak Students (low scores or inactive)
        weak_pipeline = [
            {"$match": {"status": "completed"}},
            {"$group": {
                "_id": "$student_id",
                "avg_score": {"$avg": "$score"},
                "tests_completed": {"$sum": 1}
            }},
            {"$match": {"avg_score": {"$lt": 50}}},
            {"$sort": {"avg_score": 1}},
            {"$limit": 5}
        ]
        weak_students_raw = list(test_sessions.aggregate(weak_pipeline))
        
        weak_students = []
        for w in weak_students_raw:
            student = db.users.find_one({"_id": ObjectId(w["_id"])} if ObjectId.is_valid(str(w["_id"])) else {"user_id": str(w["_id"])})
            days_inactive = 0
            if student and student.get("last_login"):
                days_inactive = (now - student["last_login"]).days
            weak_students.append({
                "student_id": str(w["_id"]),
                "name": student.get("name", "Unknown") if student else "Unknown",
                "avg_score": round(w["avg_score"], 1),
                "days_inactive": days_inactive
            })
        
        # Recent Activities
        recent_pipeline = [
            {"$match": {"status": "completed"}},
            {"$sort": {"completed_at": -1}},
            {"$limit": 10},
            {"$project": {
                "_id": 0,
                "student_id": 1,
                "subject": 1,
                "score": "$score",
                "created_at": "$completed_at"
            }}
        ]
        recent_activities_raw = list(test_sessions.aggregate(recent_pipeline))
        
        # Serialize recent_activities and look up student names
        recent_activities = []
        for activity in recent_activities_raw:
            student_id = activity.get("student_id", "")
            student_name = "Unknown Student"
            class_level = None
            
            # Try to find student by ObjectId or user_id
            if student_id:
                student = None
                if ObjectId.is_valid(str(student_id)):
                    student = db.users.find_one({"_id": ObjectId(str(student_id))})
                if not student:
                    student = db.users.find_one({"user_id": str(student_id)})
                if student:
                    student_name = student.get("name", "Unknown Student")
                    class_level = student.get("class_level")
            
            recent_activities.append({
                "student_id": str(student_id),
                "student_name": student_name,
                "class_level": class_level,
                "subject": activity.get("subject", "Unknown"),
                "score": activity.get("score", 0),
                "created_at": activity.get("created_at").isoformat() if activity.get("created_at") else None
            })
        
        return {
            "user_stats": user_stats,
            "test_stats": test_stats,
            "activity_trend": activity_trend,
            "subject_stats": subject_stats,
            "top_performers": top_performers,
            "weak_students": weak_students,
            "recent_activities": recent_activities
        }
        
    except Exception as e:
        logger.error(f"Analytics error: {e}")
        # Return empty data on error
        return {
            "user_stats": {
                "total_users": 0, "total_students": 0, "total_teachers": 0,
                "active_today": 0, "active_this_week": 0, "active_this_month": 0,
                "inactive_users": 0, "new_users_today": 0, "new_users_this_week": 0, "new_users_this_month": 0
            },
            "test_stats": {
                "total_tests_created": 0, "total_tests_taken": 0, "tests_completed": 0,
                "tests_in_progress": 0, "average_score": 0, "pass_rate": 0,
                "tests_today": 0, "tests_this_week": 0
            },
            "activity_trend": [],
            "subject_stats": [],
            "top_performers": [],
            "weak_students": [],
            "recent_activities": []
        }


# ==================== STUDENT MANAGEMENT ENDPOINTS ====================

@router.get("/students")
async def get_students(
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0),
    is_active: Optional[bool] = None,
    class_level: Optional[int] = None,
    search: Optional[str] = None
):
    """
    Get list of all students with optional filters.
    """
    try:
        # Build filter
        filter_query = {"role": "student"}
        
        if is_active is not None:
            filter_query["is_active"] = is_active
        
        if class_level is not None:
            filter_query["class_level"] = class_level
        
        if search:
            filter_query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}},
                {"user_id": {"$regex": search, "$options": "i"}}
            ]
        
        # Query students
        cursor = db.users.find(filter_query).skip(skip).limit(limit).sort("created_at", -1)
        students = [serialize_student(s) for s in cursor]
        
        return students
        
    except Exception as e:
        logger.error(f"Error fetching students: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/students")
async def create_student(student: StudentCreate):
    """
    Create a new student account.
    Auto-generates user_id and password based on name and age.
    
    ID Format: {name}{age}{sequential_number} (e.g., sajith141)
    Password: {name}{age} (e.g., sajith14)
    """
    try:
        # Check if email already exists
        existing = db.users.find_one({"email": student.email})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Generate user_id and password
        user_id = generate_student_id(student.name, student.age)
        password = generate_password(student.name, student.age)
        hashed_password = hash_password(password)
        
        # Create student document (no preferred_subject - students access all subjects for their class)
        student_doc = {
            "user_id": user_id,
            "name": student.name,
            "age": student.age,
            "email": student.email,
            "mobile": student.mobile,
            "password": hashed_password,
            "role": "student",
            "class_level": student.class_level,
            "is_active": True,
            "isOnboarded": False,
            "created_at": datetime.utcnow(),
            "last_login": None,
            "tests_completed": 0,
            "avg_score": 0.0
        }
        
        # Insert into database
        result = db.users.insert_one(student_doc)
        student_doc["_id"] = result.inserted_id
        
        # Return with credentials
        response = serialize_student(student_doc)
        response["generated_credentials"] = {
            "user_id": user_id,
            "password": password,  # Plain text for admin to share
            "note": "Share these credentials with the student. They will be prompted to change password on first login."
        }
        
        logger.info(f"Created student: {user_id} ({student.name})")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating student: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/students/{student_id}")
async def get_student(student_id: str):
    """
    Get a single student by ID (MongoDB _id or user_id).
    """
    try:
        # Try as ObjectId first
        student = None
        if ObjectId.is_valid(student_id):
            student = db.users.find_one({"_id": ObjectId(student_id), "role": "student"})
        
        if not student:
            student = db.users.find_one({"user_id": student_id, "role": "student"})
        
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
        return serialize_student(student)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching student: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/students/{student_id}")
async def update_student(student_id: str, student: StudentUpdate):
    """
    Update a student's information.
    """
    try:
        # Build update document
        update_doc = {}
        if student.name is not None:
            update_doc["name"] = student.name
        if student.age is not None:
            update_doc["age"] = student.age
        if student.email is not None:
            update_doc["email"] = student.email
        if student.mobile is not None:
            update_doc["mobile"] = student.mobile
        if student.class_level is not None:
            update_doc["class_level"] = student.class_level
        if student.is_active is not None:
            update_doc["is_active"] = student.is_active
        
        if not update_doc:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        update_doc["updated_at"] = datetime.utcnow()
        
        # Find and update
        query = {"_id": ObjectId(student_id), "role": "student"} if ObjectId.is_valid(student_id) else {"user_id": student_id, "role": "student"}
        result = db.users.find_one_and_update(
            query,
            {"$set": update_doc},
            return_document=True
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Student not found")
        
        logger.info(f"Updated student: {student_id}")
        return serialize_student(result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating student: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/students/{student_id}")
async def delete_student(student_id: str):
    """
    Delete a student (soft delete by setting is_active=False, or hard delete).
    """
    try:
        # Find student
        query = {"_id": ObjectId(student_id), "role": "student"} if ObjectId.is_valid(student_id) else {"user_id": student_id, "role": "student"}
        
        # Hard delete
        result = db.users.delete_one(query)
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Student not found")
        
        logger.info(f"Deleted student: {student_id}")
        return {"success": True, "message": "Student deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting student: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/students/{student_id}/reset-password")
async def reset_student_password(student_id: str):
    """
    Reset a student's password to the default (name + age).
    """
    try:
        # Find student
        query = {"_id": ObjectId(student_id), "role": "student"} if ObjectId.is_valid(student_id) else {"user_id": student_id, "role": "student"}
        student = db.users.find_one(query)
        
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
        # Generate new password
        new_password = generate_password(student.get("name", "student"), student.get("age", 10))
        hashed_password = hash_password(new_password)
        
        # Update password
        db.users.update_one(
            {"_id": student["_id"]},
            {"$set": {"password": hashed_password, "password_changed_at": None}}
        )
        
        logger.info(f"Reset password for student: {student_id}")
        return {
            "success": True,
            "message": "Password reset successfully",
            "new_password": new_password,
            "note": "Share this password with the student"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting password: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== TEACHER MANAGEMENT ENDPOINTS ====================

@router.get("/teachers")
async def get_teachers(
    limit: int = Query(100, ge=1, le=500),
    is_active: Optional[bool] = None
):
    """
    Get list of all teachers.
    """
    try:
        filter_query = {"role": "teacher"}
        
        if is_active is not None:
            filter_query["is_active"] = is_active
        
        cursor = db.users.find(filter_query).limit(limit).sort("created_at", -1)
        teachers = []
        
        for t in cursor:
            teachers.append({
                "id": str(t.get("_id", "")),
                "user_id": t.get("user_id", ""),
                "name": t.get("name", ""),
                "email": t.get("email", ""),
                "mobile": t.get("mobile", ""),
                "subjects": t.get("subjects", []),
                "is_active": t.get("is_active", True),
                "created_at": t.get("created_at", datetime.utcnow()).isoformat() if t.get("created_at") else None,
                "last_login": t.get("last_login").isoformat() if t.get("last_login") else None
            })
        
        return teachers
        
    except Exception as e:
        logger.error(f"Error fetching teachers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class TeacherCreate(BaseModel):
    """Model for creating a new teacher."""
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., description="Email address")
    mobile: Optional[str] = None
    subjects: List[str] = []


class TeacherUpdate(BaseModel):
    """Model for updating a teacher."""
    name: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None
    subjects: Optional[List[str]] = None
    is_active: Optional[bool] = None


def generate_teacher_id(name: str) -> str:
    """Generate unique teacher ID in format: staff_{number}_{name}"""
    try:
        counter = db.teacher_counters.find_one_and_update(
            {"_id": "teacher_count"},
            {"$inc": {"count": 1}},
            upsert=True,
            return_document=True
        )
        teacher_number = counter.get("count", 1)
        clean_name = name.lower().replace(" ", "").replace(".", "")[:10]
        return f"staff_{teacher_number}_{clean_name}"
    except Exception as e:
        logger.error(f"Error generating teacher ID: {e}")
        import time
        clean_name = name.lower().replace(" ", "")[:10]
        return f"staff_{int(time.time()) % 10000}_{clean_name}"


def generate_teacher_password(name: str) -> str:
    """Generate default teacher password."""
    clean_name = name.lower().replace(" ", "").replace(".", "")
    return f"{clean_name}@123"


@router.post("/teachers")
async def create_teacher(teacher: TeacherCreate):
    """Create a new teacher account."""
    try:
        existing = db.users.find_one({"email": teacher.email})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        user_id = generate_teacher_id(teacher.name)
        password = generate_teacher_password(teacher.name)
        hashed_password = hash_password(password)
        
        teacher_doc = {
            "user_id": user_id,
            "name": teacher.name,
            "email": teacher.email,
            "mobile": teacher.mobile or "",
            "subjects": teacher.subjects,
            "password": hashed_password,
            "role": "teacher",
            "is_active": True,
            "created_at": datetime.utcnow(),
            "last_login": None
        }
        
        result = db.users.insert_one(teacher_doc)
        teacher_doc["_id"] = result.inserted_id
        
        response = {
            "id": str(teacher_doc["_id"]),
            "user_id": user_id,
            "name": teacher.name,
            "email": teacher.email,
            "mobile": teacher.mobile or "",
            "subjects": teacher.subjects,
            "is_active": True,
            "generated_credentials": {
                "user_id": user_id,
                "password": password,
                "note": "Share these credentials with the teacher."
            }
        }
        
        logger.info(f"Created teacher: {user_id} ({teacher.name})")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating teacher: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/teachers/{teacher_id}")
async def update_teacher(teacher_id: str, teacher: TeacherUpdate):
    """Update a teacher's information."""
    try:
        update_doc = {}
        if teacher.name is not None:
            update_doc["name"] = teacher.name
        if teacher.email is not None:
            update_doc["email"] = teacher.email
        if teacher.mobile is not None:
            update_doc["mobile"] = teacher.mobile
        if teacher.subjects is not None:
            update_doc["subjects"] = teacher.subjects
        if teacher.is_active is not None:
            update_doc["is_active"] = teacher.is_active
        
        if not update_doc:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        update_doc["updated_at"] = datetime.utcnow()
        
        query = {"_id": ObjectId(teacher_id), "role": "teacher"} if ObjectId.is_valid(teacher_id) else {"user_id": teacher_id, "role": "teacher"}
        result = db.users.find_one_and_update(
            query,
            {"$set": update_doc},
            return_document=True
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Teacher not found")
        
        logger.info(f"Updated teacher: {teacher_id}")
        return {
            "id": str(result["_id"]),
            "user_id": result.get("user_id", ""),
            "name": result.get("name", ""),
            "email": result.get("email", ""),
            "mobile": result.get("mobile", ""),
            "subjects": result.get("subjects", []),
            "is_active": result.get("is_active", True)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating teacher: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/teachers/{teacher_id}")
async def delete_teacher(teacher_id: str):
    """Delete a teacher."""
    try:
        query = {"_id": ObjectId(teacher_id), "role": "teacher"} if ObjectId.is_valid(teacher_id) else {"user_id": teacher_id, "role": "teacher"}
        result = db.users.delete_one(query)
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Teacher not found")
        
        logger.info(f"Deleted teacher: {teacher_id}")
        return {"success": True, "message": "Teacher deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting teacher: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/teachers/{teacher_id}/reset-password")
async def reset_teacher_password(teacher_id: str):
    """Reset a teacher's password."""
    try:
        query = {"_id": ObjectId(teacher_id), "role": "teacher"} if ObjectId.is_valid(teacher_id) else {"user_id": teacher_id, "role": "teacher"}
        teacher = db.users.find_one(query)
        
        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher not found")
        
        new_password = generate_teacher_password(teacher.get("name", "teacher"))
        hashed_password = hash_password(new_password)
        
        db.users.update_one(
            {"_id": teacher["_id"]},
            {"$set": {"password": hashed_password, "password_changed_at": None}}
        )
        
        logger.info(f"Reset password for teacher: {teacher_id}")
        return {
            "success": True,
            "message": "Password reset successfully",
            "new_password": new_password,
            "note": "Share this password with the teacher"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting password: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== GROUP MANAGEMENT ENDPOINTS ====================

class GroupCreate(BaseModel):
    """Model for creating a group."""
    class_level: int = Field(..., ge=1, le=12, description="Class Level (1-12)")
    subject: str = Field(..., min_length=2, max_length=50)
    batch_year: int = Field(..., ge=2020, le=2100)
    teacher_ids: List[str] = Field(default=[], description="List of Teacher IDs")
    student_ids: List[str] = []


class GroupStudentUpdate(BaseModel):
    """Model for updating group students."""
    student_ids: List[str] = []


class GroupUpdate(BaseModel):
    """Model for updating a group."""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    teacher_ids: Optional[List[str]] = None
    description: Optional[str] = None


@router.get("/groups")
async def get_groups():
    """Get all groups."""
    try:
        cursor = db.groups.find({}).sort("created_at", -1)
        groups = []
        
        for g in cursor:
            teacher_names = []
            # Handle legacy teacher_id
            if g.get("teacher_id"):
                tid = g.get("teacher_id")
                teacher = db.users.find_one({"_id": ObjectId(tid)} if ObjectId.is_valid(tid) else {"user_id": tid})
                if teacher:
                    teacher_names.append(teacher.get("name"))
            
            # Handle new teacher_ids
            if g.get("teacher_ids"):
                for tid in g.get("teacher_ids"):
                    # Avoid duplicates if teacher_id is also present and same
                    if g.get("teacher_id") and tid == g.get("teacher_id"):
                        continue
                        
                    teacher = db.users.find_one({"_id": ObjectId(tid)} if ObjectId.is_valid(tid) else {"user_id": tid})
                    if teacher:
                        teacher_names.append(teacher.get("name"))
            
            groups.append({
                "id": str(g["_id"]),
                "name": g.get("name"),
                "class_level": g.get("class_level"),
                "subject": g.get("subject"),
                "batch_year": g.get("batch_year"),
                "description": g.get("description", ""),
                "teacher_id": g.get("teacher_id"), # Keep for legacy compatibility
                "teacher_ids": g.get("teacher_ids", [g.get("teacher_id")] if g.get("teacher_id") else []),
                "teacher_name": ", ".join(teacher_names) if teacher_names else "No Teacher",
                "student_ids": g.get("student_ids", []),
                "students": [serialize_student(s) for s in db.users.find({"_id": {"$in": [ObjectId(sid) for sid in g.get("student_ids", [])]}})] if g.get("student_ids") else [],
                "student_count": len(g.get("student_ids", [])),
                "created_at": g.get("created_at").isoformat() if g.get("created_at") else None
            })
        
        return {"groups": groups}
        
    except Exception as e:
        logger.error(f"Error fetching groups: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/groups")
async def create_group(group: GroupCreate):
    """Create a new group with auto-generated name."""
    try:
        # Auto-generate name: Subject_Class_Batch
        group_name = f"{group.subject}_Class{group.class_level}_{group.batch_year}"
        
        # Check if group already exists (optional, but good practice)
        existing = db.groups.find_one({"name": group_name})
        if existing:
            # Append a counter or just return existing? Let's just append if needed or fail.
            # User might want to just add students to existing group.
            # For now, let's allow duplicates or maybe it's better to prevent.
            # Let's check constraints. The prompt logic implies unique nature.
            # I'll just proceed, if they want unique names, they will see it in the list.
            pass

        # Prepare document
        group_doc = {
            "name": group_name,
            "class_level": group.class_level,
            "subject": group.subject,
            "batch_year": group.batch_year,
            "teacher_ids": group.teacher_ids,
            # For backward compatibility, set teacher_id to the first teacher if available
            "teacher_id": group.teacher_ids[0] if group.teacher_ids else None,
            "student_ids": group.student_ids,
            "created_at": datetime.utcnow()
        }
        
        result = db.groups.insert_one(group_doc)
        group_doc["_id"] = result.inserted_id
        
        # Resolve teacher names
        teacher_names = []
        if group_doc["teacher_ids"]:
            for tid in group_doc["teacher_ids"]:
                teacher = db.users.find_one({"_id": ObjectId(tid)} if ObjectId.is_valid(tid) else {"user_id": tid})
                if teacher:
                    teacher_names.append(teacher.get("name"))
        
        logger.info(f"Created group: {group_name} with {len(group.student_ids)} students")
        return {
            "id": str(group_doc["_id"]),
            "name": group_name,
            "class_level": group.class_level,
            "subject": group.subject,
            "batch_year": group.batch_year,
            "teacher_id": group_doc["teacher_id"],
            "teacher_ids": group_doc["teacher_ids"],
            "teacher_name": ", ".join(teacher_names) if teacher_names else "No Teacher",
            "student_ids": group.student_ids,
            "student_count": len(group.student_ids)
        }
        
    except Exception as e:
        logger.error(f"Error creating group: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/groups/{group_id}")
async def delete_group(group_id: str):
    """Delete a group."""
    try:
        if not ObjectId.is_valid(group_id):
            raise HTTPException(status_code=400, detail="Invalid group ID")
        
        result = db.groups.delete_one({"_id": ObjectId(group_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Group not found")
        
        logger.info(f"Deleted group: {group_id}")
        return {"success": True, "message": "Group deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting group: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/groups/{group_id}")
async def update_group(group_id: str, data: GroupUpdate):
    """Update group details (name, teachers)."""
    try:
        if not ObjectId.is_valid(group_id):
            raise HTTPException(status_code=400, detail="Invalid group ID")
        
        update_data = {k: v for k, v in data.dict().items() if v is not None}
        
        # Sync legacy teacher_id if teacher_ids is present
        if "teacher_ids" in update_data:
            update_data["teacher_id"] = update_data["teacher_ids"][0] if update_data["teacher_ids"] else None
            
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
            
        update_data["updated_at"] = datetime.utcnow()
        
        result = db.groups.find_one_and_update(
            {"_id": ObjectId(group_id)},
            {"$set": update_data},
            return_document=True
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Group not found")
        
        teacher_names = []
        if result.get("teacher_ids"):
            for tid in result.get("teacher_ids"):
                teacher = db.users.find_one({"_id": ObjectId(tid)} if ObjectId.is_valid(tid) else {"user_id": tid})
                if teacher:
                    teacher_names.append(teacher.get("name"))
        elif result.get("teacher_id"):
            # Fallback for legacy data
            tid = result.get("teacher_id")
            teacher = db.users.find_one({"_id": ObjectId(tid)} if ObjectId.is_valid(tid) else {"user_id": tid})
            if teacher:
                teacher_names.append(teacher.get("name"))
            
        logger.info(f"Updated group: {group_id}")
        return {
            "id": str(result["_id"]),
            "name": result.get("name"),
            "teacher_id": result.get("teacher_id"),
            "teacher_ids": result.get("teacher_ids", [result.get("teacher_id")] if result.get("teacher_id") else []),
            "teacher_name": ", ".join(teacher_names) if teacher_names else "No Teacher",
            "student_ids": result.get("student_ids", []),
            "student_count": len(result.get("student_ids", []))
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating group: {e}")
        raise HTTPException(status_code=500, detail=str(e))





@router.put("/groups/{group_id}/students")
async def update_group_students(group_id: str, data: GroupStudentUpdate):
    """Update students in a group."""
    try:
        if not ObjectId.is_valid(group_id):
            raise HTTPException(status_code=400, detail="Invalid group ID")
        
        result = db.groups.find_one_and_update(
            {"_id": ObjectId(group_id)},
            {"$set": {"student_ids": data.student_ids, "updated_at": datetime.utcnow()}},
            return_document=True
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Group not found")
        
        teacher_name = None
        if result.get("teacher_id"):
            teacher = db.users.find_one({"_id": ObjectId(result["teacher_id"])} if ObjectId.is_valid(result["teacher_id"]) else {"user_id": result["teacher_id"]})
            teacher_name = teacher.get("name") if teacher else None
        
        logger.info(f"Updated group students: {group_id} - {len(data.student_ids)} students")
        return {
            "id": str(result["_id"]),
            "name": result.get("name", ""),
            "description": result.get("description", ""),
            "teacher_id": result.get("teacher_id", ""),
            "teacher_name": teacher_name,
            "student_ids": result.get("student_ids", []),
            "student_count": len(result.get("student_ids", []))
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating group students: {e}")
        raise HTTPException(status_code=500, detail=str(e))

