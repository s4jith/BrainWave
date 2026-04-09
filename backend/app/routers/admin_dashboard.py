"""
Admin Dashboard Router
- Analytics and metrics
- Student management (CRUD)
- User statistics
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Union
from datetime import datetime, timedelta, date
from bson import ObjectId
import hashlib
import logging
import time
import re
from pymongo.errors import DuplicateKeyError

from app.db.mongo import db
from app.utils.email import send_credentials_email
from app.core.permissions import require_role
from app.models.rbac_models import UserRole

logger = logging.getLogger(__name__)

_analytics_cache = {"data": None, "timestamp": 0}
ANALYTICS_CACHE_TTL = 60

router = APIRouter(
    prefix="/api/admin",
    tags=["Admin Dashboard"],
    dependencies=[Depends(require_role([UserRole.ADMIN]))],
)

class StudentCreate(BaseModel):
    """Model for creating a new student."""
    name: str = Field(..., min_length=2, max_length=100)
    dob: str = Field(..., description="Date of birth in YYYY-MM-DD format")
    class_level: int = Field(..., ge=1, le=12)
    email: str = Field(..., description="Gmail address")
    mobile: str = Field(..., min_length=10, max_length=15)

class StudentUpdate(BaseModel):
    """Model for updating a student."""
    name: Optional[str] = None
    dob: Optional[str] = None
    class_level: Optional[int] = None
    email: Optional[str] = None
    mobile: Optional[str] = None
    is_active: Optional[bool] = None

class StudentResponse(BaseModel):
    """Model for student response."""
    id: str
    user_id: str
    name: str
    dob: Optional[str] = None
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


def _clean_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def _parse_dob(value: str) -> date:
    """Parse DOB from ISO-like string and ensure it is not in the future."""
    try:
        dob = datetime.fromisoformat(str(value).split("T")[0]).date()
    except Exception:
        raise HTTPException(status_code=400, detail="dob must be in YYYY-MM-DD format")

    if dob > date.today():
        raise HTTPException(status_code=400, detail="dob cannot be in the future")
    return dob


def _age_from_dob(dob: date) -> int:
    today = date.today()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    if age < 1 or age > 120:
        raise HTTPException(status_code=400, detail="Derived age is out of allowed range")
    return age


def _ensure_unique_user_id(base_user_id: str) -> str:
    candidate = base_user_id
    suffix = 1
    while db.users.find_one({"user_id": candidate}):
        candidate = f"{base_user_id}_{suffix}"
        suffix += 1
    return candidate


def _normalize_email(value: Optional[str]) -> str:
    return str(value or "").strip().lower()


def _validate_mobile(value: Optional[str], field_name: str = "mobile") -> str:
    mobile = re.sub(r"\D", "", str(value or ""))
    if len(mobile) != 10:
        raise HTTPException(status_code=400, detail=f"{field_name} must be exactly 10 digits")
    return mobile


def _ensure_email_unique_index() -> None:
    """Best-effort unique index for normalized email values."""
    try:
        db.users.create_index(
            "email_normalized",
            unique=True,
            partialFilterExpression={"email_normalized": {"$exists": True, "$ne": ""}}
        )
    except Exception as exc:
        logger.warning(f"Unable to ensure unique email index: {exc}")

def generate_student_id(class_level: int, age: int, name: str = "") -> str:
    """
    Generate unique student ID.
    Format: {class_level}_{sequential_number:05d}_{age}
    Example: 12_00001_16 (Class 12, student #1, age 16)
    Counter is per class_level so each class starts from 00001.
    """
    try:
        counter = db.student_counters.find_one_and_update(
            {"_id": f"student_count_{class_level}"},
            {"$inc": {"count": 1}},
            upsert=True,
            return_document=True
        )
        student_number = counter.get("count", 1)
        
        user_id = f"{class_level}_{student_number:05d}_{age}"
        return _ensure_unique_user_id(user_id)
    except Exception as e:
        logger.error(f"Error generating student ID: {e}")
        import time
        return f"{class_level}_{int(time.time()) % 100000:05d}_{age}"

def generate_password(name: str, age: int) -> str:
    """
    Generate default password.
    Format: {name_lowercase}{age}
    Example: sajith14
    """
    clean_name = _clean_name(name)
    return f"{clean_name}{age}"

def serialize_student(student: dict) -> dict:
    """Convert MongoDB document to response dict."""
    return {
        "id": str(student.get("_id", "")),
        "name": student.get("name", ""),
        "dob": student.get("dob"),
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


def _resolve_users_for_role(candidate_ids: Optional[List[str]], role: str) -> List[dict]:
    """Resolve mixed user_id/ObjectId identifiers into user documents for a role."""
    if not candidate_ids:
        return []

    values = [str(v).strip() for v in candidate_ids if str(v).strip()]
    if not values:
        return []

    object_ids = [ObjectId(v) for v in values if ObjectId.is_valid(v)]
    role_query = {"role": role}
    if role == "teacher":
        role_query = {
            "$or": [
                {"role": "teacher"},
                {"role": "head", "promoted_from_teacher": True},
            ]
        }

    query = {"$and": [role_query, {"$or": [{"user_id": {"$in": values}}]}]}
    if object_ids:
        query["$and"][1]["$or"].append({"_id": {"$in": object_ids}})

    docs = list(db.users.find(query))
    by_oid = {str(doc.get("_id")): doc for doc in docs if doc.get("_id")}
    by_uid = {str(doc.get("user_id")): doc for doc in docs if doc.get("user_id")}

    ordered: List[dict] = []
    seen = set()
    for value in values:
        doc = by_oid.get(value) or by_uid.get(value)
        if not doc:
            continue
        oid_str = str(doc.get("_id"))
        if not oid_str or oid_str in seen:
            continue
        seen.add(oid_str)
        ordered.append(doc)
    return ordered


def _canonical_oid_strings(docs: List[dict]) -> List[str]:
    """Return stable ObjectId string list for resolved docs."""
    ids: List[str] = []
    seen = set()
    for doc in docs:
        oid = str(doc.get("_id", "")).strip()
        if not oid or oid in seen:
            continue
        seen.add(oid)
        ids.append(oid)
    return ids

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
        active_today = db.users.count_documents({
            "role": "student",
            "last_login": {"$gte": today_start}
        })

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
            active_users = db.users.count_documents({
                "role": "student",
                "last_login": {"$gte": day_start, "$lt": day_end}
            })
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

        old_passed = test_sessions.count_documents({"status": "completed", "score": {"$gte": 40}})
        new_passed = submissions_col.count_documents({"status": {"$in": ["submitted", "graded"]}, "percentage": {"$gte": 40}})
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
    Auto-generates user_id and password based on name and derived age.
    
    ID Format: {class_level}_{sequential_number:05d}_{age} (e.g., 12_00001_16)
    Password: {name_lowercase}{age} (e.g., sajith16)
    """
    try:
        _ensure_email_unique_index()

        cleaned_email = (student.email or "").strip()
        normalized_email = _normalize_email(cleaned_email)
        existing = db.users.find_one({
            "$or": [
                {"email_normalized": normalized_email},
                {"email": {"$regex": f"^{re.escape(cleaned_email)}$", "$options": "i"}},
            ]
        })
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        dob = _parse_dob(student.dob)
        age = _age_from_dob(dob)

        user_id = generate_student_id(student.class_level, age, student.name)
        password = generate_password(student.name, age)
        hashed_password = hash_password(password)
        
        student_doc = {
            "user_id": user_id,
            "name": student.name,
            "dob": dob.isoformat(),
            "age": age,
            "email": cleaned_email,
            "email_normalized": normalized_email,
            "mobile": _validate_mobile(student.mobile),
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
            "email": cleaned_email,
            "password": password,
            "note": "Share these credentials with the student."
        }
        
        email_sent = send_credentials_email(cleaned_email, password, student.name)
        if email_sent:
            response["generated_credentials"]["email_status"] = "sent"
        else:
            response["generated_credentials"]["email_status"] = "failed"
            logger.warning(f"Failed to send email to {cleaned_email}")
        
        logger.info(f"Created student: {user_id} ({student.name})")
        return response
        
    except HTTPException:
        raise
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Email already registered")
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
        if student.dob is not None:
            dob = _parse_dob(student.dob)
            update_doc["dob"] = dob.isoformat()
            update_doc["age"] = _age_from_dob(dob)
        if student.email is not None:
            cleaned_email = student.email.strip()
            normalized_email = _normalize_email(cleaned_email)
            email_conflict = db.users.find_one({
                "$and": [
                    {
                        "$or": [
                            {"email_normalized": normalized_email},
                            {"email": {"$regex": f"^{re.escape(cleaned_email)}$", "$options": "i"}},
                        ]
                    },
                    {
                        "$or": [
                            {"_id": {"$ne": ObjectId(student_id)}} if ObjectId.is_valid(student_id) else {"user_id": {"$ne": student_id}},
                        ]
                    }
                ]
            })
            if email_conflict:
                raise HTTPException(status_code=400, detail="Email already registered")
            update_doc["email"] = cleaned_email
            update_doc["email_normalized"] = normalized_email
        if student.mobile is not None:
            update_doc["mobile"] = _validate_mobile(student.mobile)
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
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Email already registered")
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

        assigned_groups = list(db.groups.find(
            {
                "$or": [
                    {"student_ids": uid},
                    {"student_ids": oid_str},
                ]
            },
            {"_id": 0, "name": 1, "class_level": 1, "subject": 1, "batch_year": 1}
        ))
        if assigned_groups:
            group_list = [
                g.get("name") or f"Class {g.get('class_level')} - {g.get('subject', '')} ({g.get('batch_year', '')})"
                for g in assigned_groups
            ]
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Student is assigned to one or more groups. Remove the student from groups first.",
                    "groups": group_list,
                }
            )

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
            "email": student.get("email", ""),
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
        # Include regular teachers and promoted-teacher heads in one stable query.
        role_filter = {"$or": [{"role": "teacher"}, {"role": "head", "promoted_from_teacher": True}]}
        filters = [role_filter]

        if is_active is not None:
            filters.append({"is_active": is_active})

        if search:
            filters.append({
                "$or": [
                    {"name": {"$regex": search, "$options": "i"}},
                    {"email": {"$regex": search, "$options": "i"}},
                    {"user_id": {"$regex": search, "$options": "i"}}
                ]
            })

        if subject:
            filters.append({"subjects": {"$regex": f"^{re.escape(subject)}$", "$options": "i"}})

        filter_query = {"$and": filters} if len(filters) > 1 else role_filter
        
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
                "name": t.get("name", ""),
                "email": t.get("email", ""),
                "mobile": t.get("mobile", ""),
                "dob": t.get("dob"),
                "age": t.get("age"),
                "subjects": t.get("subjects", []),
                "preferred_subject": (t.get("subjects") or [""])[0] if t.get("subjects") else "",
                "group_count": group_count,
                "group_names": group_names,
                "is_active": t.get("is_active", True),
                "role": t.get("role", "teacher"),
                "assigned_classes": t.get("assigned_classes", []),
                "assigned_subjects": t.get("assigned_subjects", []),
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
    dob: str = Field(..., description="Date of birth in YYYY-MM-DD format")
    subjects: List[str] = []

class TeacherUpdate(BaseModel):
    """Model for updating a teacher."""
    name: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None
    dob: Optional[str] = None
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
        clean_name = _clean_name(name)[:10]
        user_id = f"staff_{teacher_number}_{clean_name}"
        return _ensure_unique_user_id(user_id)
    except Exception as e:
        logger.error(f"Error generating teacher ID: {e}")
        import time
        clean_name = name.lower().replace(" ", "")[:10]
        return f"staff_{int(time.time()) % 10000}_{clean_name}"

def generate_teacher_password(name: str) -> str:
    """Generate default teacher password."""
    clean_name = _clean_name(name)
    return f"{clean_name}@123"

@router.post("/teachers")
async def create_teacher(teacher: TeacherCreate):
    """Create a new teacher account."""
    try:
        _ensure_email_unique_index()
        normalized_email = (teacher.email or "").strip().lower()
        existing = db.users.find_one({
            "$or": [
                {"email_normalized": normalized_email},
                {"email": {"$regex": f"^{re.escape((teacher.email or '').strip())}$", "$options": "i"}},
            ]
        })
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        user_id = generate_teacher_id(teacher.name)
        password = generate_teacher_password(teacher.name)
        hashed_password = hash_password(password)
        dob = _parse_dob(teacher.dob)
        age = _age_from_dob(dob)
        
        teacher_doc = {
            "user_id": user_id,
            "name": teacher.name,
            "email": (teacher.email or "").strip(),
            "email_normalized": normalized_email,
            "mobile": _validate_mobile(teacher.mobile),
            "dob": dob.isoformat(),
            "age": age,
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
            "name": teacher.name,
            "email": teacher.email,
            "mobile": teacher_doc["mobile"],
            "subjects": teacher.subjects,
            "is_active": True,
            "generated_credentials": {
                "email": teacher.email,
                "password": password,
                "note": "Share these credentials with the teacher."
            }
        }
        
        email_sent = send_credentials_email(teacher.email, password, teacher.name)
        if email_sent:
            response["generated_credentials"]["email_status"] = "sent"
        else:
            response["generated_credentials"]["email_status"] = "failed"
            logger.warning(f"Failed to send email to {teacher.email}")
        
        logger.info(f"Created teacher: {user_id} ({teacher.name})")
        return response
        
    except HTTPException:
        raise
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Email already registered")
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
            cleaned_email = teacher.email.strip()
            normalized_email = cleaned_email.lower()
            # Ensure email uniqueness when updating.
            email_conflict = db.users.find_one({
                "$and": [
                    {
                        "$or": [
                            {"email_normalized": normalized_email},
                            {"email": {"$regex": f"^{re.escape(cleaned_email)}$", "$options": "i"}},
                        ]
                    },
                    {
                        "$or": [
                            {"_id": {"$ne": ObjectId(teacher_id)}} if ObjectId.is_valid(teacher_id) else {"user_id": {"$ne": teacher_id}},
                        ]
                    }
                ]
            })
            if email_conflict:
                raise HTTPException(status_code=400, detail="Email already registered")
            update_doc["email"] = cleaned_email
            update_doc["email_normalized"] = normalized_email
        if teacher.mobile is not None:
            update_doc["mobile"] = _validate_mobile(teacher.mobile)
        if teacher.dob is not None:
            dob = _parse_dob(teacher.dob)
            update_doc["dob"] = dob.isoformat()
            update_doc["age"] = _age_from_dob(dob)
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
            "name": result.get("name", ""),
            "email": result.get("email", ""),
            "mobile": result.get("mobile", ""),
            "dob": result.get("dob"),
            "age": result.get("age"),
            "subjects": result.get("subjects", []),
            "preferred_subject": (result.get("subjects") or [""])[0] if result.get("subjects") else "",
            "is_active": result.get("is_active", True)
        }
        
    except HTTPException:
        raise
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Email already registered")
    except Exception as e:
        logger.error(f"Error updating teacher: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/teachers/{teacher_id}")
async def delete_teacher(teacher_id: str):
    """Delete a teacher. Blocked if the teacher is assigned to any groups."""
    try:
        # Teacher management may surface promoted teachers (role=head, promoted_from_teacher=True).
        # Allow deleting either a pure teacher or a promoted-teacher account.
        if ObjectId.is_valid(teacher_id):
            query = {
                "_id": ObjectId(teacher_id),
                "$or": [
                    {"role": "teacher"},
                    {"role": "head", "promoted_from_teacher": True}
                ]
            }
        else:
            query = {
                "user_id": teacher_id,
                "$or": [
                    {"role": "teacher"},
                    {"role": "head", "promoted_from_teacher": True}
                ]
            }

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
                detail={
                    "message": "Teacher is assigned to one or more groups. Remove the teacher from groups first.",
                    "groups": group_list,
                }
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
            "email": teacher.get("email", ""),
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
            resolved_students = _resolve_users_for_role(g.get("student_ids", []), "student")
            canonical_student_ids = _canonical_oid_strings(resolved_students)

            teacher_candidates: List[str] = []
            if g.get("teacher_id"):
                teacher_candidates.append(str(g.get("teacher_id")))
            teacher_candidates.extend([str(tid) for tid in g.get("teacher_ids", []) if str(tid).strip()])
            resolved_teachers = _resolve_users_for_role(teacher_candidates, "teacher")
            canonical_teacher_ids = _canonical_oid_strings(resolved_teachers)

            if (
                canonical_student_ids != (g.get("student_ids") or [])
                or canonical_teacher_ids != (g.get("teacher_ids") or [])
                or (canonical_teacher_ids and g.get("teacher_id") != canonical_teacher_ids[0])
                or (not canonical_teacher_ids and g.get("teacher_id") is not None)
            ):
                db.groups.update_one(
                    {"_id": g["_id"]},
                    {
                        "$set": {
                            "student_ids": canonical_student_ids,
                            "teacher_ids": canonical_teacher_ids,
                            "teacher_id": canonical_teacher_ids[0] if canonical_teacher_ids else None,
                            "updated_at": datetime.utcnow(),
                        }
                    }
                )

            teacher_names = []
            for teacher in resolved_teachers:
                teacher_name = teacher.get("name")
                if teacher_name and teacher_name not in teacher_names:
                    teacher_names.append(teacher_name)
            
            groups.append({
                "id": str(g["_id"]),
                "name": g.get("name"),
                "class_level": g.get("class_level"),
                "subject": g.get("subject"),
                "batch_year": g.get("batch_year"),
                "description": g.get("description", ""),
                "teacher_id": canonical_teacher_ids[0] if canonical_teacher_ids else None,
                "teacher_ids": canonical_teacher_ids,
                "teacher_name": ", ".join(teacher_names) if teacher_names else "No Teacher",
                "student_ids": canonical_student_ids,
                "students": [serialize_student(s) for s in resolved_students],
                "student_count": len(canonical_student_ids),
                "feature_flags": {**{"ai_chatbot": False, "test_center": False, "my_grades": False, "book_to_bot": True, "book_to_bot_doubt": False}, **g.get("feature_flags", {})},
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

        resolved_students = _resolve_users_for_role(group.student_ids, "student")
        resolved_teachers = _resolve_users_for_role(group.teacher_ids, "teacher")
        canonical_student_ids = _canonical_oid_strings(resolved_students)
        canonical_teacher_ids = _canonical_oid_strings(resolved_teachers)

        group_doc = {
            "name": group_name,
            "class_level": group.class_level,
            "subject": group.subject,
            "batch_year": group.batch_year,
            "teacher_ids": canonical_teacher_ids,
            "teacher_id": canonical_teacher_ids[0] if canonical_teacher_ids else None,
            "student_ids": canonical_student_ids,
            "created_at": datetime.utcnow()
        }
        
        result = db.groups.insert_one(group_doc)
        group_doc["_id"] = result.inserted_id
        
        teacher_names = []
        for teacher in resolved_teachers:
            teacher_name = teacher.get("name")
            if teacher_name and teacher_name not in teacher_names:
                teacher_names.append(teacher_name)
        
        logger.info(f"Created group: {group_name} with {len(canonical_student_ids)} students")
        return {
            "id": str(group_doc["_id"]),
            "name": group_name,
            "class_level": group.class_level,
            "subject": group.subject,
            "batch_year": group.batch_year,
            "teacher_id": group_doc["teacher_id"],
            "teacher_ids": group_doc["teacher_ids"],
            "teacher_name": ", ".join(teacher_names) if teacher_names else "No Teacher",
            "student_ids": canonical_student_ids,
            "student_count": len(canonical_student_ids)
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
            resolved_teachers = _resolve_users_for_role(update_data.get("teacher_ids") or [], "teacher")
            canonical_teacher_ids = _canonical_oid_strings(resolved_teachers)
            update_data["teacher_ids"] = canonical_teacher_ids
            update_data["teacher_id"] = canonical_teacher_ids[0] if canonical_teacher_ids else None
            
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
        teacher_candidates: List[str] = []
        if result.get("teacher_ids"):
            teacher_candidates.extend([str(tid) for tid in result.get("teacher_ids", []) if str(tid).strip()])
        elif result.get("teacher_id"):
            teacher_candidates.append(str(result.get("teacher_id")))
        resolved_teachers = _resolve_users_for_role(teacher_candidates, "teacher")
        canonical_teacher_ids = _canonical_oid_strings(resolved_teachers)
        for teacher in resolved_teachers:
            teacher_name = teacher.get("name")
            if teacher_name and teacher_name not in teacher_names:
                teacher_names.append(teacher_name)

        resolved_students = _resolve_users_for_role(result.get("student_ids", []), "student")
        canonical_student_ids = _canonical_oid_strings(resolved_students)
        if canonical_teacher_ids != (result.get("teacher_ids") or []) or canonical_student_ids != (result.get("student_ids") or []):
            db.groups.update_one(
                {"_id": result["_id"]},
                {
                    "$set": {
                        "teacher_ids": canonical_teacher_ids,
                        "teacher_id": canonical_teacher_ids[0] if canonical_teacher_ids else None,
                        "student_ids": canonical_student_ids,
                        "updated_at": datetime.utcnow(),
                    }
                }
            )
            
        logger.info(f"Updated group: {group_id}")
        return {
            "id": str(result["_id"]),
            "name": result.get("name"),
            "teacher_id": canonical_teacher_ids[0] if canonical_teacher_ids else None,
            "teacher_ids": canonical_teacher_ids,
            "teacher_name": ", ".join(teacher_names) if teacher_names else "No Teacher",
            "student_ids": canonical_student_ids,
            "student_count": len(canonical_student_ids)
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
        
        resolved_students = _resolve_users_for_role(data.student_ids, "student")
        canonical_student_ids = _canonical_oid_strings(resolved_students)

        result = db.groups.find_one_and_update(
            {"_id": ObjectId(group_id)},
            {"$set": {"student_ids": canonical_student_ids, "updated_at": datetime.utcnow()}},
            return_document=True
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Group not found")
        
        teacher_name = None
        teacher_candidates: List[str] = []
        if result.get("teacher_ids"):
            teacher_candidates.extend([str(tid) for tid in result.get("teacher_ids", []) if str(tid).strip()])
        elif result.get("teacher_id"):
            teacher_candidates.append(str(result.get("teacher_id")))
        resolved_teachers = _resolve_users_for_role(teacher_candidates, "teacher")
        if resolved_teachers:
            teacher_name = resolved_teachers[0].get("name")

        students = [serialize_student(s) for s in resolved_students]
        
        logger.info(f"Updated group students: {group_id} - {len(canonical_student_ids)} students")
        return {
            "id": str(result["_id"]),
            "name": result.get("name", ""),
            "description": result.get("description", ""),
            "teacher_id": result.get("teacher_id", ""),
            "teacher_name": teacher_name,
            "student_ids": canonical_student_ids,
            "student_count": len(canonical_student_ids),
            "students": students
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
    "book_to_bot_doubt": False,
}

class FeatureFlagsUpdate(BaseModel):
    ai_chatbot: Optional[bool] = None
    test_center: Optional[bool] = None
    my_grades: Optional[bool] = None
    book_to_bot: Optional[bool] = None
    book_to_bot_doubt: Optional[bool] = None


@router.patch("/groups/{group_id}/features")
async def update_group_features(group_id: str, flags: FeatureFlagsUpdate):
    """Update feature flags for a group. All students in this group inherit these unless overridden."""
    try:
        query = {"_id": ObjectId(group_id)} if ObjectId.is_valid(group_id) else {"_id": group_id}
        
        updates = {f"feature_flags.{k}": v for k, v in flags.dict().items() if v is not None}
        if not updates:
            raise HTTPException(status_code=400, detail="No feature flags provided")
        
        result = db.groups.find_one_and_update(
            query,
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
        query = {"_id": ObjectId(student_id), "role": "student"} if ObjectId.is_valid(student_id) else {"user_id": student_id, "role": "student"}
        
        updates = {f"feature_overrides.{k}": v for k, v in flags.dict().items() if v is not None}
        if not updates:
            raise HTTPException(status_code=400, detail="No feature flags provided")
        
        result = db.users.find_one_and_update(
            query,
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
    "questionTypes": ["mcq", "fillup", "true_false", "short_answer", "long_answer"],
    "cognitiveLevels": ["remember", "understand", "apply", "analyze", "evaluate", "create"],
    "difficultyLevels": ["easy", "medium", "hard"],
}


def _normalize_settings_option_list(values: Optional[List[str]], fallback: List[str]) -> List[str]:
    """Normalize settings arrays to stable lowercase slug values."""
    if not isinstance(values, list):
        return fallback

    cleaned: List[str] = []
    for value in values:
        if value is None:
            continue
        normalized = str(value).strip().lower().replace(" ", "_")
        normalized = re.sub(r"_+", "_", normalized)
        if not normalized:
            continue
        if normalized not in cleaned:
            cleaned.append(normalized)

    return cleaned if cleaned else fallback


def _normalize_settings_doc(doc: dict) -> dict:
    """Return a normalized settings payload with defaults."""
    payload = {**_DEFAULT_SETTINGS, **(doc or {})}
    payload["questionTypes"] = _normalize_settings_option_list(payload.get("questionTypes"), _DEFAULT_SETTINGS["questionTypes"])
    payload["cognitiveLevels"] = _normalize_settings_option_list(payload.get("cognitiveLevels"), _DEFAULT_SETTINGS["cognitiveLevels"])
    payload["difficultyLevels"] = _normalize_settings_option_list(payload.get("difficultyLevels"), _DEFAULT_SETTINGS["difficultyLevels"])
    return payload

class PlatformSettings(BaseModel):
    platformName: Optional[str] = None
    platformDescription: Optional[str] = None
    maintenanceMode: Optional[bool] = None
    backupFrequency: Optional[str] = None
    retentionDays: Optional[int] = None
    questionTypes: Optional[List[str]] = None
    cognitiveLevels: Optional[List[str]] = None
    difficultyLevels: Optional[List[str]] = None


@router.get("/settings")
async def get_admin_settings():
    """Return current platform settings (admin only)."""
    try:
        col = db.get_collection("platform_settings")
        doc = col.find_one({"_id": "global"})
        if not doc:
            return _DEFAULT_SETTINGS
        doc.pop("_id", None)
        return _normalize_settings_doc(doc)
    except Exception as e:
        logger.error(f"Error fetching platform settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/settings")
async def save_admin_settings(settings: PlatformSettings):
    """Save platform settings to DB (admin only)."""
    try:
        updates = {k: v for k, v in settings.model_dump().items() if v is not None}
        if not updates:
            return {"success": False, "error": "No settings provided."}

        normalized_updates = _normalize_settings_doc(updates)

        col = db.get_collection("platform_settings")
        col.update_one(
            {"_id": "global"},
            {"$set": {**normalized_updates, "updated_at": datetime.utcnow()}},
            upsert=True
        )
        return {"success": True, "message": "Settings saved successfully."}
    except Exception as e:
        logger.error(f"Error saving platform settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/internal/maintenance", tags=["Internal"])
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


# ──────────── Head Management (CRUD) ────────────

class HeadCreate(BaseModel):
    """Model for designating an existing teacher as a head."""
    teacher_id: str = Field(..., description="MongoDB _id or user_id of the teacher to promote")
    assigned_classes: List[Union[int, str]] = Field(default=[], description="Class levels this head is responsible for")
    assigned_subjects: List[str] = Field(default=[], description="Subjects this head is responsible for")

class HeadUpdate(BaseModel):
    """Model for updating a head user."""
    name: Optional[str] = None
    mobile: Optional[str] = None
    is_active: Optional[bool] = None
    assigned_classes: Optional[List[Union[int, str]]] = None
    assigned_subjects: Optional[List[str]] = None


def parse_class_level(value) -> Optional[int]:
    """Parse class from int/string forms like 10, '10', 'Class 10', 'X', 'XI', 'XII'."""
    if value is None:
        return None

    if isinstance(value, int):
        return value if 1 <= value <= 12 else None

    raw = str(value).strip()
    if not raw:
        return None

    lowered = raw.lower().replace("class", "").strip().replace("-", " ")

    # Numeric forms
    if lowered.isdigit():
        parsed = int(lowered)
        return parsed if 1 <= parsed <= 12 else None

    # Roman numeral forms sometimes sent by inconsistent UIs.
    roman_map = {
        "i": 1,
        "ii": 2,
        "iii": 3,
        "iv": 4,
        "v": 5,
        "vi": 6,
        "vii": 7,
        "viii": 8,
        "ix": 9,
        "x": 10,
        "xi": 11,
        "xii": 12,
    }
    return roman_map.get(lowered)


def normalize_head_assignments(classes: Optional[List[Union[int, str]]], subjects: Optional[List[str]]):
    normalized_classes: List[int] = []
    for c in classes or []:
        parsed = parse_class_level(c)
        if parsed and parsed not in normalized_classes:
            normalized_classes.append(parsed)

    normalized_subjects = []
    for s in subjects or []:
        sub = str(s).strip()
        if sub and sub not in normalized_subjects:
            normalized_subjects.append(sub)

    return normalized_classes, normalized_subjects

def generate_head_id(name: str) -> str:
    """Generate unique head ID in format: head_{number}_{name}"""
    try:
        counter = db.head_counters.find_one_and_update(
            {"_id": "head_count"},
            {"$inc": {"count": 1}},
            upsert=True,
            return_document=True
        )
        head_number = counter.get("count", 1)
        clean_name = name.lower().replace(" ", "").replace(".", "")[:10]
        return f"head_{head_number}_{clean_name}"
    except Exception as e:
        logger.error(f"Error generating head ID: {e}")
        import time
        clean_name = name.lower().replace(" ", "")[:10]
        return f"head_{int(time.time()) % 10000}_{clean_name}"

def generate_head_password(name: str) -> str:
    """Generate default head password."""
    clean_name = name.lower().replace(" ", "").replace(".", "")
    return f"{clean_name}@head123"

@router.get("/heads")
async def get_heads(
    limit: int = Query(100, ge=1, le=500),
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
):
    """Get list of all head users."""
    try:
        filter_query = {"role": "head"}

        if is_active is not None:
            filter_query["is_active"] = is_active

        if search:
            filter_query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}},
                {"user_id": {"$regex": search, "$options": "i"}}
            ]

        cursor = db.users.find(filter_query).limit(limit).sort("created_at", -1)
        heads = []

        for h in cursor:
            heads.append({
                "id": str(h["_id"]),
                "user_id": h.get("user_id", ""),
                "name": h.get("name", ""),
                "email": h.get("email", ""),
                "mobile": h.get("mobile", ""),
                "subjects": h.get("subjects", []),
                "assigned_classes": h.get("assigned_classes", []),
                "assigned_subjects": h.get("assigned_subjects", []),
                "promoted_from_teacher": h.get("promoted_from_teacher", False),
                "is_active": h.get("is_active", True),
                "created_at": h.get("created_at", datetime.utcnow()).isoformat() if h.get("created_at") else None,
                "last_login": h.get("last_login").isoformat() if h.get("last_login") else None
            })

        return heads

    except Exception as e:
        logger.error(f"Error fetching heads: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/heads")
async def create_head(head: HeadCreate):
    """Designate an existing teacher as a head by promoting their account."""
    try:
        if not (head.teacher_id or "").strip():
            raise HTTPException(status_code=400, detail="teacher_id is required")

        teacher_id = head.teacher_id.strip()

        # Find teacher by MongoDB _id or user_id
        query = (
            {"_id": ObjectId(teacher_id)}
            if ObjectId.is_valid(teacher_id)
            else {"user_id": teacher_id}
        )
        teacher = db.users.find_one(query)
        if not teacher:
            raise HTTPException(
                status_code=404,
                detail="Teacher not found. Only existing active teachers can be designated as heads."
            )

        if teacher.get("role") == "head":
            raise HTTPException(status_code=400, detail="Selected user is already a head")

        if teacher.get("role") != "teacher":
            raise HTTPException(status_code=400, detail="Selected user is not a teacher")

        normalized_classes, normalized_subjects = normalize_head_assignments(
            head.assigned_classes,
            head.assigned_subjects,
        )

        if not normalized_classes and not normalized_subjects:
            raise HTTPException(status_code=400, detail="Assign at least one class or subject")

        # Promote teacher to head role
        update_doc = {
            "role": "head",
            "assigned_classes": normalized_classes,
            "assigned_subjects": normalized_subjects,
            "promoted_to_head_at": datetime.utcnow(),
            "promoted_from_teacher": True,
            "updated_by": "admin",
        }
        db.users.update_one({"_id": teacher["_id"]}, {"$set": update_doc})
        updated = db.users.find_one({"_id": teacher["_id"]})

        response = {
            "id": str(updated["_id"]),
            "user_id": updated.get("user_id", ""),
            "name": updated.get("name", ""),
            "email": updated.get("email", ""),
            "mobile": updated.get("mobile", ""),
            "subjects": updated.get("subjects", []),
            "assigned_classes": normalized_classes,
            "assigned_subjects": normalized_subjects,
            "promoted_from_teacher": True,
            "is_active": updated.get("is_active", True),
            "note": f"{updated.get('name')} has been designated as head. They can log in with their existing credentials (User ID: {updated.get('user_id')})."
        }

        logger.info(f"Promoted teacher to head: {updated.get('user_id')} ({updated.get('name')})")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating head: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/heads/{head_id}")
async def update_head(head_id: str, head: HeadUpdate):
    """Update a head user's assignment and status."""
    try:
        update_doc = {}
        if head.name is not None:
            update_doc["name"] = head.name
        if head.mobile is not None:
            update_doc["mobile"] = head.mobile
        if head.is_active is not None:
            update_doc["is_active"] = head.is_active
        if head.assigned_classes is not None or head.assigned_subjects is not None:
            normalized_classes, normalized_subjects = normalize_head_assignments(
                head.assigned_classes if head.assigned_classes is not None else [],
                head.assigned_subjects if head.assigned_subjects is not None else [],
            )
            if head.assigned_classes is not None:
                update_doc["assigned_classes"] = normalized_classes
            if head.assigned_subjects is not None:
                update_doc["assigned_subjects"] = normalized_subjects

        if not update_doc:
            raise HTTPException(status_code=400, detail="No fields to update")

        update_doc["updated_at"] = datetime.utcnow()

        query = {"_id": ObjectId(head_id), "role": "head"} if ObjectId.is_valid(head_id) else {"user_id": head_id, "role": "head"}
        result = db.users.find_one_and_update(
            query,
            {"$set": update_doc},
            return_document=True
        )

        if not result:
            raise HTTPException(status_code=404, detail="Head not found")

        logger.info(f"Updated head: {head_id}")
        return {
            "id": str(result["_id"]),
            "user_id": result.get("user_id", ""),
            "name": result.get("name", ""),
            "email": result.get("email", ""),
            "mobile": result.get("mobile", ""),
            "subjects": result.get("subjects", []),
            "assigned_classes": result.get("assigned_classes", []),
            "assigned_subjects": result.get("assigned_subjects", []),
            "promoted_from_teacher": result.get("promoted_from_teacher", False),
            "is_active": result.get("is_active", True)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating head: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/heads/{head_id}")
async def delete_head(head_id: str):
    """Remove head designation. Demotes promoted teachers back to teacher; deletes legacy heads."""
    try:
        query = {"_id": ObjectId(head_id), "role": "head"} if ObjectId.is_valid(head_id) else {"user_id": head_id, "role": "head"}

        head = db.users.find_one(query)
        if not head:
            raise HTTPException(status_code=404, detail="Head not found")

        if head.get("promoted_from_teacher", False):
            # Restore to teacher role instead of deleting
            db.users.update_one(
                {"_id": head["_id"]},
                {
                    "$set": {"role": "teacher"},
                    "$unset": {
                        "assigned_classes": "",
                        "assigned_subjects": "",
                        "promoted_to_head_at": "",
                        "promoted_from_teacher": ""
                    }
                }
            )
            logger.info(f"Demoted head back to teacher: {head_id}")
            return {"success": True, "message": f"{head.get('name')} has been demoted back to teacher.", "demoted": True}
        else:
            # Legacy head account — delete entirely
            db.users.delete_one({"_id": head["_id"]})
            logger.info(f"Deleted legacy head: {head_id}")
            return {"success": True, "message": "Head deleted successfully", "demoted": False}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting head: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/heads/{head_id}/reset-password")
async def reset_head_password(head_id: str):
    """Reset a head user's password."""
    try:
        query = {"_id": ObjectId(head_id), "role": "head"} if ObjectId.is_valid(head_id) else {"user_id": head_id, "role": "head"}
        head = db.users.find_one(query)

        if not head:
            raise HTTPException(status_code=404, detail="Head not found")

        new_password = generate_head_password(head.get("name", "head"))
        hashed_password = hash_password(new_password)

        db.users.update_one(
            {"_id": head["_id"]},
            {"$set": {"password": hashed_password, "password_changed_at": None}}
        )

        logger.info(f"Reset password for head: {head_id}")
        return {
            "success": True,
            "message": "Password reset successfully",
            "new_password": new_password,
            "note": "Share this password with the head"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting password: {e}")
        raise HTTPException(status_code=500, detail=str(e))
