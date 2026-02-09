"""
Notifications Router
Handles admin-specific notifications with:
- Role-based visibility (admin-only notifications)
- Auto-delete after 7 days of reading
- Save option for permanent storage
- Delete option for permanent removal
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
    except Exception as e:
        logger.error(f"Error cleaning up notifications: {e}")


def generate_admin_notifications():
    """Generate system notifications for admins based on platform activity."""
    try:
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        notifications = []
        
        # Check for new users registered today
        new_users_today = db.users.count_documents({"created_at": {"$gte": today_start}})
        if new_users_today > 0:
            notifications.append({
                "title": "New User Registrations",
                "message": f"{new_users_today} new user(s) registered today",
                "type": "info",
                "category": "users"
            })
        
        # Check for inactive users (no login in 30 days)
        month_ago = now - timedelta(days=30)
        inactive_count = db.users.count_documents({
            "role": "student",
            "$or": [
                {"last_login": {"$lt": month_ago}},
                {"last_login": None}
            ]
        })
        if inactive_count > 5:
            notifications.append({
                "title": "Inactive Students Alert",
                "message": f"{inactive_count} students haven't logged in for 30+ days",
                "type": "warning",
                "category": "activity"
            })
        
        # Check for low-performing students
        test_sessions = db.get_collection("test_sessions")
        pipeline = [
            {"$match": {"status": "completed"}},
            {"$group": {"_id": None, "avg_score": {"$avg": "$score"}}}
        ]
        avg_result = list(test_sessions.aggregate(pipeline))
        if avg_result and avg_result[0].get("avg_score", 0) < 50:
            notifications.append({
                "title": "Platform Performance Alert",
                "message": f"Average test score is below 50%. Consider reviewing test difficulty.",
                "type": "warning",
                "category": "performance"
            })
        
        # Check for tests completed today
        tests_today = test_sessions.count_documents({"completed_at": {"$gte": today_start}})
        if tests_today > 0:
            notifications.append({
                "title": "Daily Test Activity",
                "message": f"{tests_today} test(s) completed today",
                "type": "success",
                "category": "tests"
            })
        
        return notifications
    except Exception as e:
        logger.error(f"Error generating admin notifications: {e}")
        return []


@router.get("")
async def get_notifications(
    limit: int = 20,
    current_user: TokenData = Depends(get_current_user)
):
    """Get notifications for the current user (role-based)."""
    try:
        # Run cleanup of old notifications
        cleanup_old_notifications()
        
        # Build query based on role
        query = {"user_id": current_user.user_id}
        
        # Admin sees admin-specific notifications
        if current_user.role == UserRole.ADMIN:
            query = {
                "$or": [
                    {"user_id": current_user.user_id},
                    {"role": "admin"},
                    {"role": {"$exists": False}, "user_id": {"$exists": False}}  # System notifications
                ]
            }
        
        # Fetch stored notifications
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
        
        # For admins, also generate real-time notifications
        if current_user.role == UserRole.ADMIN:
            live_notifications = generate_admin_notifications()
            for ln in live_notifications:
                # Check if similar notification already exists today
                existing = db.notifications.find_one({
                    "title": ln["title"],
                    "role": "admin",
                    "created_at": {"$gte": datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)}
                })
                if not existing:
                    # Store the notification
                    new_notif = {
                        "title": ln["title"],
                        "message": ln["message"],
                        "type": ln["type"],
                        "category": ln.get("category", "general"),
                        "role": "admin",
                        "read": False,
                        "saved": False,
                        "created_at": datetime.utcnow()
                    }
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
        
        # Count unread
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
    """Permanently delete a notification."""
    try:
        if not ObjectId.is_valid(notification_id):
            raise HTTPException(status_code=400, detail="Invalid notification ID")
        
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
        
        # Build query based on role
        if current_user.role == UserRole.ADMIN:
            query = {
                "$or": [
                    {"user_id": current_user.user_id},
                    {"role": "admin"}
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
