"""
Student Suggestions Router
Allows students to send suggestions/feedback to admin
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.db.mongo import mongodb, db
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/suggestions",
    tags=["Suggestions"]
)


class CreateSuggestionRequest(BaseModel):
    """Request to create a suggestion"""
    student_id: str
    student_name: str
    class_level: int
    category: str = Field(default="general", description="general, feature, ui, content, bug, other")
    subject: Optional[str] = None
    content: str
    email: Optional[str] = None


class SuggestionResponse(BaseModel):
    """Suggestion response"""
    id: str
    student_id: str
    student_name: str
    class_level: int
    category: str
    content: str
    status: str
    admin_response: Optional[str] = None
    created_at: str
    reviewed_at: Optional[str] = None


@router.post("", response_model=dict)
async def create_suggestion(request: CreateSuggestionRequest):
    """Create a new suggestion from student"""
    try:
        suggestion_doc = {
            "student_id": request.student_id,
            "student_name": request.student_name,
            "class_level": request.class_level,
            "category": request.category,
            "subject": request.subject or "",
            "content": request.content,
            "email": request.email,
            "status": "pending",
            "admin_response": None,
            "created_at": datetime.utcnow(),
            "reviewed_at": None
        }
        
        result = await mongodb.db.suggestions.insert_one(suggestion_doc)
        
        logger.info(f"Suggestion created: {result.inserted_id} from {request.student_name}")
        
        # Resolve login user_id from MongoDB ObjectId for notifications
        student_login_id = request.student_id
        try:
            user_doc = db.users.find_one({"_id": ObjectId(request.student_id)})
            if user_doc:
                student_login_id = user_doc.get("user_id", request.student_id)
        except Exception:
            pass
        
        # Notify admin about new suggestion
        try:
            db.notifications.insert_one({
                "type": "suggestion",
                "title": "New Suggestion",
                "message": f"{request.student_name} (Class {request.class_level}) submitted a suggestion: {request.content[:80]}",
                "suggestion_id": str(result.inserted_id),
                "category": request.category,
                "for_admin": True,
                "is_read": False,
                "created_at": datetime.utcnow(),
                "created_by": request.student_id,
                "created_by_name": request.student_name
            })
        except Exception as ne:
            logger.error(f"Failed to create admin notification for suggestion: {ne}")
        
        # Notify student that suggestion was received
        try:
            db.notifications.insert_one({
                "user_id": student_login_id,
                "type": "suggestion",
                "title": "Suggestion Received",
                "message": "Your suggestion has been submitted and will be reviewed by admin.",
                "suggestion_id": str(result.inserted_id),
                "for_admin": False,
                "is_read": False,
                "created_at": datetime.utcnow()
            })
        except Exception as ne:
            logger.error(f"Failed to create student notification for suggestion: {ne}")
        
        return {
            "status": "success",
            "message": "Suggestion submitted successfully",
            "id": str(result.inserted_id)
        }
        
    except Exception as e:
        logger.error(f"Error creating suggestion: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/student/{student_id}")
async def get_student_suggestions(student_id: str):
    """Get all suggestions from a specific student"""
    try:
        suggestions = await mongodb.db.suggestions.find(
            {"student_id": student_id}
        ).sort("created_at", -1).to_list(100)
        
        formatted_suggestions = []
        for s in suggestions:
            formatted_suggestions.append({
                "id": str(s["_id"]),
                "student_id": s.get("student_id"),
                "student_name": s.get("student_name"),
                "class_level": s.get("class_level"),
                "category": s.get("category"),
                "subject": s.get("subject", ""),
                "content": s.get("content"),
                "status": s.get("status", "pending"),
                "admin_response": s.get("admin_response"),
                "created_at": s.get("created_at", datetime.utcnow()).isoformat(),
                "reviewed_at": s.get("reviewed_at").isoformat() if s.get("reviewed_at") else None
            })
        
        return {
            "suggestions": formatted_suggestions,
            "total": len(formatted_suggestions)
        }
        
    except Exception as e:
        logger.error(f"Error fetching student suggestions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/all")
async def get_all_suggestions(
    status: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 100
):
    """Get all suggestions (admin only)"""
    try:
        query = {}
        if status:
            query["status"] = status
        if category:
            query["category"] = category
        
        suggestions = await mongodb.db.suggestions.find(query).sort("created_at", -1).limit(limit).to_list(limit)
        
        formatted_suggestions = []
        for s in suggestions:
            formatted_suggestions.append({
                "id": str(s["_id"]),
                "student_id": s.get("student_id"),
                "student_name": s.get("student_name"),
                "class_level": s.get("class_level"),
                "category": s.get("category"),
                "subject": s.get("subject", ""),
                "content": s.get("content"),
                "email": s.get("email"),
                "status": s.get("status", "pending"),
                "admin_response": s.get("admin_response"),
                "created_at": s.get("created_at", datetime.utcnow()).isoformat(),
                "reviewed_at": s.get("reviewed_at").isoformat() if s.get("reviewed_at") else None
            })
        
        return {
            "suggestions": formatted_suggestions,
            "total": len(formatted_suggestions),
            "pending_count": len([s for s in formatted_suggestions if s["status"] == "pending"])
        }
        
    except Exception as e:
        logger.error(f"Error fetching all suggestions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{suggestion_id}/respond")
async def respond_to_suggestion(
    suggestion_id: str,
    response: str,
    status: str = "reviewed"
):
    """Admin responds to a suggestion"""
    try:
        result = await mongodb.db.suggestions.update_one(
            {"_id": ObjectId(suggestion_id)},
            {
                "$set": {
                    "admin_response": response,
                    "status": status,
                    "reviewed_at": datetime.utcnow()
                }
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        
        # Notify the student about admin's response
        try:
            suggestion = await mongodb.db.suggestions.find_one({"_id": ObjectId(suggestion_id)})
            if suggestion:
                # Resolve login user_id from MongoDB ObjectId
                student_login_id = suggestion.get("student_id")
                try:
                    user_doc = db.users.find_one({"_id": ObjectId(student_login_id)})
                    if user_doc:
                        student_login_id = user_doc.get("user_id", student_login_id)
                except Exception:
                    pass
                
                db.notifications.insert_one({
                    "user_id": student_login_id,
                    "type": "suggestion_response",
                    "title": "Suggestion Reviewed",
                    "message": f"Admin responded to your suggestion: {response[:80]}",
                    "suggestion_id": suggestion_id,
                    "for_admin": False,
                    "is_read": False,
                    "created_at": datetime.utcnow()
                })
        except Exception as ne:
            logger.error(f"Failed to create notification for suggestion response: {ne}")
        
        logger.info(f"Admin responded to suggestion: {suggestion_id}")
        
        return {
            "status": "success",
            "message": "Response added successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error responding to suggestion: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{suggestion_id}")
async def delete_suggestion(suggestion_id: str):
    """Delete a suggestion"""
    try:
        result = await mongodb.db.suggestions.delete_one({"_id": ObjectId(suggestion_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        
        logger.info(f"Suggestion deleted: {suggestion_id}")
        
        return {
            "status": "success",
            "message": "Suggestion deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting suggestion: {e}")
        raise HTTPException(status_code=500, detail=str(e))
