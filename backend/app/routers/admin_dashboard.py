"""
Admin Dashboard Router
- Analytics and metrics
- Student management (CRUD)
- User statistics
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta
from bson import ObjectId
import hashlib
import logging
import time

from app.db.mongo import db
from app.utils.email import send_credentials_email

logger = logging.getLogger(__name__)

_analytics_cache = {"data": None, "timestamp": 0}
ANALYTICS_CACHE_TTL = 60

router = APIRouter(prefix="/api/admin", tags=["Admin Dashboard"])

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
        counter = db.student_counters.find_one_and_update(
            {"_id": "student_count"},
            {"$inc": {"count": 1}},
            upsert=True,
            return_document=True
        )
        student_number = counter.get("count", 1)
        
        clean_name = name.lower().replace(" ", "").replace(".", "")[:10]
        user_id = f"{clean_name}{age}{student_number}"
        
        return user_id
    except Exception as e:
        logger.error(f"Error generating student ID: {e}")
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
        "avg_score": student.get("avg_score", 0.0),
        "feature_overrides": student.get("feature_overrides", {})
    }

@router.get("/dashboard-stats")
async def get_dashboard_stats():
    """
    Lightweight stats endpoint for the admin dashboard.
    Returns essential counts + 7-day activity trend for charts.
    """
    try:
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        total_students = db.users.count_documents({"role": "student"})
        total_teachers = db.users.count_documents({"role": "teacher"})
        active_today = db.users.count_documents({"last_login": {"$gte": today_start}})

        tests_col = db.get_collection("tests")
        assessments_col = db.get_collection("assessments")
        test_sessions = db.get_collection("test_sessions")
        submissions_col = db.get_collection("submissions")

        total_tests_created = tests_col.count_documents({}) + assessments_col.count_documents({})
        old_taken = test_sessions.count_documents({"status": "completed"})
        new_taken = submissions_col.count_documents({"status": {"$in": ["submitted", "graded"]}})
        total_tests_taken = old_taken + new_taken

        daily_trend = []
        for i in range(6, -1, -1):
            day_start = today_start - timedelta(days=i)
            day_end = day_start + timedelta(days=1)
            active_users = db.users.count_documents({"last_login": {"$gte": day_start, "$lt": day_end}})
            tests_done = (
                test_sessions.count_documents({"completed_at": {"$gte": day_start, "$lt": day_end}}) +
                submissions_col.count_documents({
                    "submitted_at": {"$gte": day_start, "$lt": day_end},
                    "status": {"$in": ["submitted", "graded"]}
                })
            )
            new_signups = db.users.count_documents({"created_at": {"$gte": day_start, "$lt": day_end}})
            daily_trend.append({
                "date": day_start.strftime("%a"),
                "full_date": day_start.strftime("%b %d"),
                "active_users": active_users,
                "tests_taken": tests_done,
                "new_signups": new_signups
            })

        student_pipeline = [
            {"$match": {"role": "student"}},
            {"$group": {
                "_id": "$class_level",
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        class_dist = [
            {"class": f"Class {r['_id']}" if r["_id"] else "Unknown", "students": r["count"]}
            for r in db.users.aggregate(student_pipeline)
        ]

        return {
            "total_students": total_students,
            "total_teachers": total_teachers,
            "active_today": active_today,
            "total_tests_created": total_tests_created,
            "total_tests_taken": total_tests_taken,
            "daily_trend": daily_trend,
            "class_distribution": class_dist
        }
    except Exception as e:
        logger.error(f"Dashboard stats error: {e}")
        return {
            "total_students": 0, "total_teachers": 0, "active_today": 0,
            "total_tests_created": 0, "total_tests_taken": 0,
            "daily_trend": [], "class_distribution": []
        }

@router.get("/analytics")
async def get_analytics():
    """
    Get comprehensive analytics for admin dashboard.
    Returns user stats, test stats, activity trends, etc.
    Cached for 60 seconds to avoid repeated slow queries.
    """
    now_ts = time.time()
    if _analytics_cache["data"] and (now_ts - _analytics_cache["timestamp"]) < ANALYTICS_CACHE_TTL:
        return _analytics_cache["data"]

    try:
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = today_start - timedelta(days=7)

        total_students = db.users.count_documents({"role": "student"})
        active_this_week = db.users.count_documents({"role": "student", "last_login": {"$gte": week_ago}})

        user_stats = {
            "total_students": total_students,
            "active_this_week": active_this_week,
        }
        
        test_sessions = db.get_collection("test_sessions")
        assessments_col = db.get_collection("assessments")
        submissions_col = db.get_collection("submissions")

        old_tests_week = test_sessions.count_documents({"completed_at": {"$gte": week_ago}})
        new_tests_week = submissions_col.count_documents({
            "submitted_at": {"$gte": week_ago},
            "status": {"$in": ["submitted", "graded"]}
        })
        tests_this_week = old_tests_week + new_tests_week

        old_avg_result = list(test_sessions.aggregate([
            {"$match": {"status": "completed", "score": {"$exists": True}}},
            {"$group": {"_id": None, "avg_score": {"$avg": "$score"}, "count": {"$sum": 1}}}
        ]))
        old_avg = old_avg_result[0] if old_avg_result else {"avg_score": 0, "count": 0}

        new_avg_result = list(submissions_col.aggregate([
            {"$match": {"status": {"$in": ["submitted", "graded"]}, "percentage": {"$exists": True}}},
            {"$group": {"_id": None, "avg_score": {"$avg": "$percentage"}, "count": {"$sum": 1}}}
        ]))
        new_avg = new_avg_result[0] if new_avg_result else {"avg_score": 0, "count": 0}

        total_count = old_avg["count"] + new_avg["count"]
        average_score = round(
            (old_avg["avg_score"] * old_avg["count"] + new_avg["avg_score"] * new_avg["count"]) / total_count, 1
        ) if total_count > 0 else 0

        old_tests_taken = test_sessions.count_documents({"status": "completed"})
        new_tests_taken = submissions_col.count_documents({"status": {"$in": ["submitted", "graded"]}})
        total_tests_taken = old_tests_taken + new_tests_taken

        old_passed = test_sessions.count_documents({"status": "completed", "score": {"$gte": 60}})
        new_passed = submissions_col.count_documents({"status": {"$in": ["submitted", "graded"]}, "percentage": {"$gte": 60}})
        pass_rate = round(((old_passed + new_passed) / total_tests_taken * 100), 1) if total_tests_taken > 0 else 0

        test_stats = {
            "average_score": average_score,
            "tests_this_week": tests_this_week,
            "pass_rate": pass_rate,
        }
        
        new_subject_pipeline = [
            {"$match": {"status": {"$in": ["submitted", "graded"]}}},
            {"$addFields": {
                "assessment_oid": {"$toObjectId": "$assessment_id"}
            }},
            {"$lookup": {
                "from": "assessments",
                "localField": "assessment_oid",
                "foreignField": "_id",
                "as": "assessment"
            }},
            {"$unwind": {"path": "$assessment", "preserveNullAndEmptyArrays": True}},
            {"$match": {"assessment.subject": {"$exists": True, "$ne": None}}},
            {"$group": {
                "_id": "$assessment.subject",
                "avg_score": {"$avg": "$percentage"},
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
        
        try:
            subject_stats = list(submissions_col.aggregate(new_subject_pipeline))
        except Exception as e:
            print(f"Subject stats aggregation error: {e}")
            subject_stats = []
        
        new_performer_pipeline = [
            {"$match": {"status": {"$in": ["submitted", "graded"]}}},
            {"$group": {
                "_id": "$student_id",
                "avg_score": {"$avg": "$percentage"},
                "tests_completed": {"$sum": 1}
            }},
            {"$match": {"tests_completed": {"$gte": 1}}}
        ]
        new_performers = list(submissions_col.aggregate(new_performer_pipeline))
        
        old_performer_pipeline = [
            {"$match": {"status": "completed"}},
            {"$group": {
                "_id": "$student_id",
                "avg_score": {"$avg": "$score"},
                "tests_completed": {"$sum": 1}
            }},
            {"$match": {"tests_completed": {"$gte": 1}}}
        ]
        old_performers = list(test_sessions.aggregate(old_performer_pipeline))
        
        performers_dict = {}
        for p in new_performers:
            student_id = str(p["_id"])
            performers_dict[student_id] = {
                "avg_score": p["avg_score"],
                "tests_completed": p["tests_completed"]
            }
        
        for p in old_performers:
            student_id = str(p["_id"])
            if student_id in performers_dict:
                existing = performers_dict[student_id]
                total_tests = existing["tests_completed"] + p["tests_completed"]
                weighted_avg = (
                    existing["avg_score"] * existing["tests_completed"] +
                    p["avg_score"] * p["tests_completed"]
                ) / total_tests
                performers_dict[student_id] = {
                    "avg_score": weighted_avg,
                    "tests_completed": total_tests
                }
            else:
                performers_dict[student_id] = {
                    "avg_score": p["avg_score"],
                    "tests_completed": p["tests_completed"]
                }
        
        top_performers_raw = sorted(
            [{"_id": k, **v} for k, v in performers_dict.items()],
            key=lambda x: x["avg_score"],
            reverse=True
        )[:5]
        
        top_performers = []
        for p in top_performers_raw:
            student = db.users.find_one({"_id": ObjectId(p["_id"])} if ObjectId.is_valid(str(p["_id"])) else {"user_id": str(p["_id"])})
            top_performers.append({
                "student_id": str(p["_id"]),
                "name": student.get("name", "Unknown") if student else "Unknown",
                "avg_score": round(p["avg_score"], 1),
                "tests_completed": p["tests_completed"]
            })
        
        new_weak_pipeline = [
            {"$match": {"status": {"$in": ["submitted", "graded"]}}},
            {"$group": {
                "_id": "$student_id",
                "avg_score": {"$avg": "$percentage"},
                "tests_completed": {"$sum": 1}
            }},
            {"$match": {"avg_score": {"$lt": 50}}}
        ]
        new_weak = list(submissions_col.aggregate(new_weak_pipeline))
        
        old_weak_pipeline = [
            {"$match": {"status": "completed"}},
            {"$group": {
                "_id": "$student_id",
                "avg_score": {"$avg": "$score"},
                "tests_completed": {"$sum": 1}
            }},
            {"$match": {"avg_score": {"$lt": 50}}}
        ]
        old_weak = list(test_sessions.aggregate(old_weak_pipeline))
        
        weak_dict = {}
        for w in new_weak:
            student_id = str(w["_id"])
            weak_dict[student_id] = {
                "avg_score": w["avg_score"],
                "tests_completed": w["tests_completed"]
            }
        
        for w in old_weak:
            student_id = str(w["_id"])
            if student_id in weak_dict:
                existing = weak_dict[student_id]
                total_tests = existing["tests_completed"] + w["tests_completed"]
                weighted_avg = (
                    existing["avg_score"] * existing["tests_completed"] +
                    w["avg_score"] * w["tests_completed"]
                ) / total_tests
                weak_dict[student_id] = {
                    "avg_score": weighted_avg,
                    "tests_completed": total_tests
                }
            else:
                weak_dict[student_id] = {
                    "avg_score": w["avg_score"],
                    "tests_completed": w["tests_completed"]
                }
        
        weak_students_raw = sorted(
            [{"_id": k, **v} for k, v in weak_dict.items()],
            key=lambda x: x["avg_score"]
        )[:5]
        
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
        
        old_recent_pipeline = [
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
        old_recent = list(test_sessions.aggregate(old_recent_pipeline))
        
        new_recent_pipeline = [
            {"$match": {"status": {"$in": ["submitted", "graded"]}}},
            {"$sort": {"submitted_at": -1}},
            {"$limit": 10},
            {"$addFields": {
                "assessment_oid": {"$toObjectId": "$assessment_id"}
            }},
            {"$lookup": {
                "from": "assessments",
                "localField": "assessment_oid",
                "foreignField": "_id",
                "as": "assessment"
            }},
            {"$unwind": {"path": "$assessment", "preserveNullAndEmptyArrays": True}},
            {"$project": {
                "_id": 0,
                "student_id": 1,
                "subject": "$assessment.subject",
                "score": "$percentage",
                "created_at": "$submitted_at"
            }}
        ]
        
        try:
            new_recent = list(submissions_col.aggregate(new_recent_pipeline))
        except Exception as e:
            print(f"Recent activities aggregation error: {e}")
            new_recent = []
        
        all_recent = old_recent + new_recent
        all_recent.sort(key=lambda x: x.get("created_at") or datetime.min, reverse=True)
        recent_activities_raw = all_recent[:10]
        
        recent_activities = []
        for activity in recent_activities_raw:
            student_id = activity.get("student_id", "")
            student_name = "Unknown Student"
            class_level = None
            
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
        
        result = {
            "user_stats": user_stats,
            "test_stats": test_stats,
            "subject_stats": subject_stats,
            "top_performers": top_performers,
            "weak_students": weak_students,
            "recent_activities": recent_activities
        }
        _analytics_cache["data"] = result
        _analytics_cache["timestamp"] = time.time()
        return result
        
    except Exception as e:
        logger.error(f"Analytics error: {e}")
        return {
            "user_stats": {"total_students": 0, "active_this_week": 0},
            "test_stats": {"average_score": 0, "tests_this_week": 0, "pass_rate": 0},
            "subject_stats": [],
            "top_performers": [],
            "weak_students": [],
            "recent_activities": []
        }

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
        
        cursor = db.users.find(filter_query).skip(skip).limit(limit).sort("created_at", -1)
        students = []
        for s in cursor:
            student_data = serialize_student(s)
            sid = str(s["_id"])
            student_groups = list(db.groups.find(
                {"student_ids": sid},
                {"name": 1}
            ))
            student_data["group_count"] = len(student_groups)
            student_data["group_names"] = [g.get("name", "Unnamed") for g in student_groups]
            students.append(student_data)
        
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
        existing = db.users.find_one({"email": student.email})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        user_id = generate_student_id(student.name, student.age)
        password = generate_password(student.name, student.age)
        hashed_password = hash_password(password)
        
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
            "avg_score": 0.0,
            "created_by": "admin"
        }
        
        result = db.users.insert_one(student_doc)
        student_doc["_id"] = result.inserted_id
        
        response = serialize_student(student_doc)
        response["generated_credentials"] = {
            "user_id": user_id,
            "password": password,
            "note": "Share these credentials with the student. They will be prompted to change password on first login."
        }
        
        email_sent = send_credentials_email(student.email, user_id, password, student.name)
        if email_sent:
            response["generated_credentials"]["email_status"] = "sent"
        else:
            response["generated_credentials"]["email_status"] = "failed"
            logger.warning(f"Failed to send email to {student.email}")
        
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
    """Delete a student and all associated data (cascade delete)."""
    try:
        query = {"_id": ObjectId(student_id), "role": "student"} if ObjectId.is_valid(student_id) else {"user_id": student_id, "role": "student"}

        student = db.users.find_one(query)
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

        uid = student.get("user_id", "")
        oid_str = str(student["_id"])

        user_id_filter = {"$or": [{"user_id": uid}, {"user_id": oid_str}, {"student_id": uid}, {"student_id": oid_str}]}
        db.db.test_sessions.delete_many(user_id_filter)
        db.submissions.delete_many({"$or": [{"student_id": uid}, {"student_id": oid_str}]})
        db.test_submissions.delete_many({"$or": [{"student_id": uid}, {"student_id": oid_str}, {"user_id": uid}, {"user_id": oid_str}]})
        db.notifications.delete_many({"$or": [{"user_id": uid}, {"user_id": oid_str}]})
        db.dismissed_notifications.delete_many({"$or": [{"user_id": uid}, {"user_id": oid_str}]})
        for col in ["chat_sessions", "chat_messages", "annotations", "annotation_history", "notes", "flashcards", "quiz_results"]:
            db.db[col].delete_many({"$or": [{"user_id": uid}, {"user_id": oid_str}, {"student_id": uid}, {"student_id": oid_str}]})

        db.users.delete_one({"_id": student["_id"]})

        logger.info(f"Cascade deleted student: {student_id}")
        return {"success": True, "message": "Student and all associated data deleted successfully"}

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
        query = {"_id": ObjectId(student_id), "role": "student"} if ObjectId.is_valid(student_id) else {"user_id": student_id, "role": "student"}
        student = db.users.find_one(query)
        
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
        new_password = generate_password(student.get("name", "student"), student.get("age", 10))
        hashed_password = hash_password(new_password)
        
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

@router.get("/teachers")
async def get_teachers(
    limit: int = Query(100, ge=1, le=500),
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    subject: Optional[str] = None
):
    """
    Get list of all teachers with optional filters.
    """
    try:
        filter_query = {"role": "teacher"}
        
        if is_active is not None:
            filter_query["is_active"] = is_active
            
        if search:
            filter_query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}},
                {"user_id": {"$regex": search, "$options": "i"}}
            ]
            
        if subject:
            filter_query["subjects"] = {"$regex": f"^{subject}$", "$options": "i"}
        
        cursor = db.users.find(filter_query).limit(limit).sort("created_at", -1)
        teachers = []
        
        for t in cursor:
            teacher_id_str = str(t.get("_id", ""))
            teacher_user_id = t.get("user_id", "")
            
            teacher_groups = list(db.groups.find({
                "$or": [
                    {"teacher_id": teacher_user_id},
                    {"teacher_id": teacher_id_str},
                    {"teacher_ids": teacher_user_id},
                    {"teacher_ids": teacher_id_str}
                ]
            }, {"name": 1}))
            group_count = len(teacher_groups)
            group_names = [g.get("name", "Unnamed") for g in teacher_groups]
            
            teachers.append({
                "id": teacher_id_str,
                "user_id": teacher_user_id,
                "name": t.get("name", ""),
                "email": t.get("email", ""),
                "mobile": t.get("mobile", ""),
                "subjects": t.get("subjects", []),
                "group_count": group_count,
                "group_names": group_names,
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
    age: Optional[int] = Field(None, ge=18, le=100)
    subjects: List[str] = []

class TeacherUpdate(BaseModel):
    """Model for updating a teacher."""
    name: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None
    age: Optional[int] = None
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
            "age": teacher.age,
            "subjects": teacher.subjects,
            "password": hashed_password,
            "role": "teacher",
            "is_active": True,
            "created_at": datetime.utcnow(),
            "created_by": "admin",
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
                "user_id": user_id,
                "password": password,
                "note": "Share these credentials with the teacher."
            }
        }
        
        email_sent = send_credentials_email(teacher.email, user_id, password, teacher.name)
        if email_sent:
            response["generated_credentials"]["email_status"] = "sent"
        else:
            response["generated_credentials"]["email_status"] = "failed"
            logger.warning(f"Failed to send email to {teacher.email}")
        
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
        if teacher.age is not None:
            update_doc["age"] = teacher.age
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
    """Delete a teacher. Blocked if the teacher is assigned to any groups."""
    try:
        query = {"_id": ObjectId(teacher_id), "role": "teacher"} if ObjectId.is_valid(teacher_id) else {"user_id": teacher_id, "role": "teacher"}

        teacher = db.users.find_one(query)
        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher not found")

        t_user_id = teacher.get("user_id", "")
        t_oid_str = str(teacher["_id"])

        groups = list(db.groups.find(
            {"$or": [
                {"teacher_id": t_user_id},
                {"teacher_id": t_oid_str},
                {"teacher_ids": t_user_id},
                {"teacher_ids": t_oid_str},
            ]},
            {"_id": 0, "name": 1, "class_level": 1, "subject": 1, "batch_year": 1}
        ))

        if groups:
            group_list = [
                g.get("name") or f"Class {g.get('class_level')} - {g.get('subject', '')} ({g.get('batch_year', '')})"
                for g in groups
            ]
            raise HTTPException(
                status_code=409,
                detail={"message": "Teacher is assigned to groups", "groups": group_list}
            )

        db.users.delete_one({"_id": teacher["_id"]})

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
            if g.get("teacher_id"):
                tid = g.get("teacher_id")
                teacher = db.users.find_one({"_id": ObjectId(tid)} if ObjectId.is_valid(tid) else {"user_id": tid})
                if teacher:
                    teacher_names.append(teacher.get("name"))
            
            if g.get("teacher_ids"):
                for tid in g.get("teacher_ids"):
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
                "teacher_id": g.get("teacher_id"),
                "teacher_ids": g.get("teacher_ids", [g.get("teacher_id")] if g.get("teacher_id") else []),
                "teacher_name": ", ".join(teacher_names) if teacher_names else "No Teacher",
                "student_ids": g.get("student_ids", []),
                "students": [serialize_student(s) for s in db.users.find({"_id": {"$in": [ObjectId(sid) for sid in g.get("student_ids", [])]}})] if g.get("student_ids") else [],
                "student_count": len(g.get("student_ids", [])),
                "feature_flags": {**{"ai_chatbot": False, "test_center": False, "my_grades": False, "book_to_bot": True}, **g.get("feature_flags", {})},
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
        group_name = f"{group.subject}_Class{group.class_level}_{group.batch_year}"
        
        existing = db.groups.find_one({"name": group_name})
        if existing:
            pass

        group_doc = {
            "name": group_name,
            "class_level": group.class_level,
            "subject": group.subject,
            "batch_year": group.batch_year,
            "teacher_ids": group.teacher_ids,
            "teacher_id": group.teacher_ids[0] if group.teacher_ids else None,
            "student_ids": group.student_ids,
            "created_at": datetime.utcnow()
        }
        
        result = db.groups.insert_one(group_doc)
        group_doc["_id"] = result.inserted_id
        
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


# ─── Feature Flags ──────────────────────────────────────────────────────────────

DEFAULT_FEATURE_FLAGS = {
    "ai_chatbot": False,
    "test_center": False,
    "my_grades": False,
    "book_to_bot": True,  # Unlocked by default; admin/group can lock it
}

class FeatureFlagsUpdate(BaseModel):
    ai_chatbot: Optional[bool] = None
    test_center: Optional[bool] = None
    my_grades: Optional[bool] = None
    book_to_bot: Optional[bool] = None


@router.patch("/groups/{group_id}/features")
async def update_group_features(group_id: str, flags: FeatureFlagsUpdate):
    """Update feature flags for a group. All students in this group inherit these unless overridden."""
    try:
        if not ObjectId.is_valid(group_id):
            raise HTTPException(status_code=400, detail="Invalid group ID")
        
        updates = {f"feature_flags.{k}": v for k, v in flags.dict().items() if v is not None}
        if not updates:
            raise HTTPException(status_code=400, detail="No feature flags provided")
        
        result = db.groups.find_one_and_update(
            {"_id": ObjectId(group_id)},
            {"$set": {**updates, "updated_at": datetime.utcnow()}},
            return_document=True
        )
        if not result:
            raise HTTPException(status_code=404, detail="Group not found")
        
        feature_flags = {**DEFAULT_FEATURE_FLAGS, **result.get("feature_flags", {})}
        return {"success": True, "feature_flags": feature_flags}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating group features: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/students/{student_id}/features")
async def update_student_features(student_id: str, flags: FeatureFlagsUpdate):
    """Update feature overrides for an individual student. These take priority over group flags."""
    try:
        if not ObjectId.is_valid(student_id):
            raise HTTPException(status_code=400, detail="Invalid student ID")
        
        updates = {f"feature_overrides.{k}": v for k, v in flags.dict().items() if v is not None}
        if not updates:
            raise HTTPException(status_code=400, detail="No feature flags provided")
        
        result = db.users.find_one_and_update(
            {"_id": ObjectId(student_id), "role": "student"},
            {"$set": {**updates, "updated_at": datetime.utcnow()}},
            return_document=True
        )
        if not result:
            raise HTTPException(status_code=404, detail="Student not found")
        
        feature_overrides = result.get("feature_overrides", {})
        return {"success": True, "feature_overrides": feature_overrides}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating student features: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Platform Settings ─────────────────────────────────────────────────────────

_DEFAULT_SETTINGS = {
    "platformName": "NCERT Learning Platform",
    "platformDescription": "Interactive learning platform for NCERT curriculum",
    "maintenanceMode": False,
    "backupFrequency": "daily",
    "retentionDays": 30,
}

class PlatformSettings(BaseModel):
    platformName: Optional[str] = None
    platformDescription: Optional[str] = None
    maintenanceMode: Optional[bool] = None
    backupFrequency: Optional[str] = None
    retentionDays: Optional[int] = None


@router.get("/settings")
async def get_admin_settings():
    """Return current platform settings (admin only)."""
    try:
        col = db.get_collection("platform_settings")
        doc = col.find_one({"_id": "global"})
        if not doc:
            return _DEFAULT_SETTINGS
        doc.pop("_id", None)
        return {**_DEFAULT_SETTINGS, **doc}
    except Exception as e:
        logger.error(f"Error fetching platform settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/settings")
async def save_admin_settings(settings: PlatformSettings):
    """Save platform settings to DB (admin only)."""
    try:
        updates = {k: v for k, v in settings.dict().items() if v is not None}
        if not updates:
            return {"success": False, "error": "No settings provided."}

        col = db.get_collection("platform_settings")
        col.update_one(
            {"_id": "global"},
            {"$set": {**updates, "updated_at": datetime.utcnow()}},
            upsert=True
        )
        return {"success": True, "message": "Settings saved successfully."}
    except Exception as e:
        logger.error(f"Error saving platform settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/public/maintenance", tags=["Public"])
async def get_maintenance_status():
    """Public endpoint: returns maintenance mode status. No auth required."""
    try:
        col = db.get_collection("platform_settings")
        doc = col.find_one({"_id": "global"})
        maintenance = doc.get("maintenanceMode", False) if doc else False
        platform_name = doc.get("platformName", "NCERT Learning Platform") if doc else "NCERT Learning Platform"
        return {"maintenance_mode": maintenance, "platform_name": platform_name}
    except Exception as e:
        logger.error(f"Error fetching maintenance status: {e}")
        return {"maintenance_mode": False, "platform_name": "NCERT Learning Platform"}
