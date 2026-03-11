"""
Notifications Router
Handles notifications with:
- Role-based visibility (admin and teacher notifications)
- Auto-delete after 7 days of reading
- Save option for permanent storage
- Delete option with dismiss tracking (prevents re-creation)
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import logging

from app.db.mongo import db
from app.core.permissions import get_current_user
from app.models.rbac_models import TokenData, UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

def cleanup_old_notifications():
    """Auto-delete notifications that were read more than 7 days ago and not saved."""
    try:
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        result = db.notifications.delete_many({
            "read_at": {"$lt": seven_days_ago},
            "saved": {"$ne": True}
        })
        if result.deleted_count > 0:
            logger.info(f"Auto-deleted {result.deleted_count} old read notifications")
        
        two_days_ago = datetime.utcnow() - timedelta(days=2)
        db.dismissed_notifications.delete_many({
            "dismissed_at": {"$lt": two_days_ago}
        })
    except Exception as e:
        logger.error(f"Error cleaning up notifications: {e}")

def is_dismissed(title: str, role: str, user_id: str = None):
    """Check if a notification with this title was dismissed today."""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    query = {
        "title": title,
        "role": role,
        "dismissed_at": {"$gte": today_start}
    }
    if user_id:
        query["user_id"] = user_id
    return db.dismissed_notifications.find_one(query) is not None

def generate_admin_notifications():
    """Generate system notifications for admins based on platform activity."""
    try:
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = now - timedelta(days=7)
        yesterday = now - timedelta(days=1)

        notifications = []

        new_students_today = db.users.count_documents({
            "role": "student",
            "created_at": {"$gte": today_start}
        })
        if new_students_today > 0:
            notifications.append({
                "title": "New Student Registrations",
                "message": f"{new_students_today} new student(s) registered today",
                "type": "success",
                "category": "users"
            })

        new_teachers_today = db.users.count_documents({
            "role": "teacher",
            "created_at": {"$gte": today_start}
        })
        if new_teachers_today > 0:
            notifications.append({
                "title": "New Teacher Registrations",
                "message": f"{new_teachers_today} new teacher(s) joined today",
                "type": "success",
                "category": "users"
            })

        inactive_students = db.users.count_documents({
            "role": "student",
            "is_active": True,
            "$or": [
                {"last_login": {"$lt": week_ago}},
                {"last_login": None, "created_at": {"$lt": week_ago}},
            ]
        })
        if inactive_students > 0:
            notifications.append({
                "title": "Inactive Students",
                "message": f"{inactive_students} student(s) haven't logged in for 7+ days",
                "type": "warning",
                "category": "activity"
            })

        inactive_teachers = db.users.count_documents({
            "role": "teacher",
            "is_active": True,
            "$or": [
                {"last_login": {"$lt": week_ago}},
                {"last_login": None, "created_at": {"$lt": week_ago}},
            ]
        })
        if inactive_teachers > 0:
            notifications.append({
                "title": "Inactive Teachers",
                "message": f"{inactive_teachers} teacher(s) haven't logged in for 7+ days",
                "type": "warning",
                "category": "activity"
            })

        test_sessions = db.get_collection("test_sessions")
        failed_tests = test_sessions.count_documents({
            "status": "completed",
            "score": {"$lt": 40},
            "completed_at": {"$gte": week_ago}
        })
        if failed_tests > 0:
            notifications.append({
                "title": "Poor Test Performance",
                "message": f"{failed_tests} test(s) scored below 40% in the past week",
                "type": "error",
                "category": "performance"
            })

        submissions_col = db.get_collection("submissions")
        failing_new = submissions_col.count_documents({
            "status": {"$in": ["submitted", "graded"]},
            "percentage": {"$lt": 40},
            "submitted_at": {"$gte": week_ago}
        })
        if failing_new > 0:
            notifications.append({
                "title": "Low Assessment Scores",
                "message": f"{failing_new} assessment(s) scored below 40% this week",
                "type": "error",
                "category": "performance"
            })

        try:
            pending_tickets = db.support_tickets.count_documents({
                "status": {"$in": ["open", "pending"]}
            })
            if pending_tickets > 0:
                notifications.append({
                    "title": "Pending Support Queries",
                    "message": f"{pending_tickets} unresolved support quer{'y' if pending_tickets == 1 else 'ies'} from students",
                    "type": "info",
                    "category": "support"
                })
        except Exception:
            pass

        tests_today = test_sessions.count_documents({"completed_at": {"$gte": today_start}})
        new_tests_today = submissions_col.count_documents({
            "submitted_at": {"$gte": today_start},
            "status": {"$in": ["submitted", "graded"]}
        })
        total_tests_today = tests_today + new_tests_today
        if total_tests_today > 0:
            notifications.append({
                "title": "Daily Test Activity",
                "message": f"{total_tests_today} test(s) completed today",
                "type": "success",
                "category": "tests"
            })

        return notifications
    except Exception as e:
        logger.error(f"Error generating admin notifications: {e}")
        return []

def generate_teacher_notifications(teacher_user_id: str):
    """Generate notifications for a teacher scoped to their assigned groups."""
    try:
        now = datetime.utcnow()
        week_ago = now - timedelta(days=7)

        teacher_groups = list(db.groups.find({
            "$or": [
                {"teacher_id": teacher_user_id},
                {"teacher_ids": teacher_user_id}
            ]
        }))

        if not teacher_groups:
            return []

        all_student_ids = []
        for g in teacher_groups:
            all_student_ids.extend(g.get("student_ids", []))
        all_student_ids = list(set(all_student_ids))

        if not all_student_ids:
            return []

        student_oids = [ObjectId(sid) for sid in all_student_ids if ObjectId.is_valid(sid)]

        notifications = []

        inactive_students = db.users.count_documents({
            "_id": {"$in": student_oids},
            "is_active": True,
            "$or": [
                {"last_login": {"$lt": week_ago}},
                {"last_login": None}
            ]
        })
        if inactive_students > 0:
            notifications.append({
                "title": "Inactive Students",
                "message": f"{inactive_students} student(s) in your groups haven't logged in for 7+ days",
                "type": "warning",
                "category": "activity"
            })

        student_user_ids = [s.get("user_id") for s in db.users.find({"_id": {"$in": student_oids}}, {"user_id": 1}) if s.get("user_id")]
        
        test_sessions = db.get_collection("test_sessions")
        failed_tests = test_sessions.count_documents({
            "status": "completed",
            "user_id": {"$in": student_user_ids},
            "score": {"$lt": 40},
            "completed_at": {"$gte": week_ago}
        })
        if failed_tests > 0:
            notifications.append({
                "title": "Student Test Failures",
                "message": f"{failed_tests} test(s) by your students scored below 40% this week",
                "type": "error",
                "category": "performance"
            })

        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        tests_today = test_sessions.count_documents({
            "user_id": {"$in": student_user_ids},
            "completed_at": {"$gte": today_start}
        })
        if tests_today > 0:
            notifications.append({
                "title": "Student Activity Today",
                "message": f"{tests_today} test(s) completed by your students today",
                "type": "success",
                "category": "tests"
            })

        return notifications
    except Exception as e:
        logger.error(f"Error generating teacher notifications: {e}")
        return []

@router.get("")
async def get_notifications(
    limit: int = 20,
    current_user: TokenData = Depends(get_current_user)
):
    """Get notifications for the current user (role-based)."""
    try:
        cleanup_old_notifications()

        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

        if current_user.role == UserRole.ADMIN:
            query = {
                "$or": [
                    {"user_id": current_user.user_id},
                    {"role": "admin"},
                    {"role": {"$exists": False}, "user_id": {"$exists": False}}
                ]
            }
        elif current_user.role == UserRole.TEACHER:
            query = {
                "$or": [
                    {"user_id": current_user.user_id},
                    {"role": "teacher", "target_user_id": current_user.user_id}
                ]
            }
        elif current_user.role == UserRole.HEAD:
            query = {
                "$or": [
                    {"user_id": current_user.user_id},
                    {"role": "head", "target_user_id": current_user.user_id},
                    {"role": "head", "target_user_id": {"$exists": False}},
                ]
            }
        else:
            query = {"user_id": current_user.user_id}

        stored_notifications = list(db.notifications.find(query).sort("created_at", -1).limit(limit))

        result = []
        for n in stored_notifications:
            created_at = n.get("created_at")
            read_at = n.get("read_at")

            result.append({
                "id": str(n["_id"]),
                "title": n.get("title", ""),
                "message": n.get("message", ""),
                "type": n.get("type", "info"),
                "category": n.get("category", "general"),
                "read": n.get("read", False),
                "saved": n.get("saved", False),
                "created_at": created_at.isoformat() if created_at else None,
                "read_at": read_at.isoformat() if read_at else None,
                "expires_in_days": 7 - (datetime.utcnow() - read_at).days if read_at and not n.get("saved") else None
            })

        if current_user.role == UserRole.ADMIN:
            live_notifications = generate_admin_notifications()
            role_key = "admin"
            target_user_id = None
        elif current_user.role == UserRole.TEACHER:
            live_notifications = generate_teacher_notifications(current_user.user_id)
            role_key = "teacher"
            target_user_id = current_user.user_id
        else:
            live_notifications = []
            role_key = None
            target_user_id = None

        for ln in live_notifications:
            if is_dismissed(ln["title"], role_key, target_user_id):
                continue

            existing_query = {
                "title": ln["title"],
                "role": role_key,
                "created_at": {"$gte": today_start}
            }
            if target_user_id:
                existing_query["target_user_id"] = target_user_id

            existing = db.notifications.find_one(existing_query)
            if not existing:
                new_notif = {
                    "title": ln["title"],
                    "message": ln["message"],
                    "type": ln["type"],
                    "category": ln.get("category", "general"),
                    "role": role_key,
                    "read": False,
                    "saved": False,
                    "created_at": datetime.utcnow()
                }
                if target_user_id:
                    new_notif["target_user_id"] = target_user_id

                insert_result = db.notifications.insert_one(new_notif)
                result.insert(0, {
                    "id": str(insert_result.inserted_id),
                    "title": ln["title"],
                    "message": ln["message"],
                    "type": ln["type"],
                    "category": ln.get("category", "general"),
                    "read": False,
                    "saved": False,
                    "created_at": datetime.utcnow().isoformat(),
                    "read_at": None,
                    "expires_in_days": None
                })

        unread_count = len([n for n in result if not n.get("read")])

        return {
            "notifications": result[:limit],
            "unread_count": unread_count
        }
    except Exception as e:
        logger.error(f"Error fetching notifications: {e}")
        return {
            "notifications": [],
            "unread_count": 0
        }

@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Mark a notification as read. Starts the 7-day auto-delete timer."""
    try:
        if not ObjectId.is_valid(notification_id):
            raise HTTPException(status_code=400, detail="Invalid notification ID")

        result = db.notifications.update_one(
            {"_id": ObjectId(notification_id)},
            {"$set": {"read": True, "read_at": datetime.utcnow()}}
        )

        return {"success": True, "modified": result.modified_count > 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{notification_id}/save")
async def save_notification(
    notification_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Save a notification permanently (prevents auto-delete)."""
    try:
        if not ObjectId.is_valid(notification_id):
            raise HTTPException(status_code=400, detail="Invalid notification ID")

        result = db.notifications.update_one(
            {"_id": ObjectId(notification_id)},
            {"$set": {"saved": True}}
        )

        return {"success": True, "saved": result.modified_count > 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{notification_id}/unsave")
async def unsave_notification(
    notification_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Unsave a notification (re-enables auto-delete if read)."""
    try:
        if not ObjectId.is_valid(notification_id):
            raise HTTPException(status_code=400, detail="Invalid notification ID")

        result = db.notifications.update_one(
            {"_id": ObjectId(notification_id)},
            {"$set": {"saved": False}}
        )

        return {"success": True, "unsaved": result.modified_count > 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Permanently delete a notification and dismiss it so it won't regenerate."""
    try:
        if not ObjectId.is_valid(notification_id):
            raise HTTPException(status_code=400, detail="Invalid notification ID")

        notif = db.notifications.find_one({"_id": ObjectId(notification_id)})
        if notif:
            role = notif.get("role", "admin")
            db.dismissed_notifications.insert_one({
                "title": notif.get("title"),
                "role": role,
                "user_id": notif.get("target_user_id"),
                "dismissed_at": datetime.utcnow()
            })

        result = db.notifications.delete_one({"_id": ObjectId(notification_id)})

        return {"success": True, "deleted": result.deleted_count > 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/read-all")
async def mark_all_notifications_read(
    current_user: TokenData = Depends(get_current_user)
):
    """Mark all notifications as read for the current user."""
    try:
        now = datetime.utcnow()

        if current_user.role == UserRole.ADMIN:
            query = {
                "$or": [
                    {"user_id": current_user.user_id},
                    {"role": "admin"}
                ],
                "read": False
            }
        elif current_user.role == UserRole.TEACHER:
            query = {
                "$or": [
                    {"user_id": current_user.user_id},
                    {"role": "teacher", "target_user_id": current_user.user_id}
                ],
                "read": False
            }
        elif current_user.role == UserRole.HEAD:
            query = {
                "$or": [
                    {"user_id": current_user.user_id},
                    {"role": "head", "target_user_id": current_user.user_id}
                ],
                "read": False
            }
        else:
            query = {"user_id": current_user.user_id, "read": False}

        result = db.notifications.update_many(
            query,
            {"$set": {"read": True, "read_at": now}}
        )

        return {"success": True, "modified_count": result.modified_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
