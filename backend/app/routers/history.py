"""
History Router - Endpoints for AI Annotation History.
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from app.models.schemas import AnnotationHistoryCreateRequest, AnnotationHistoryItem, AnnotationHistoryListResponse, SuccessResponse
from app.services.annotation_history_service import annotation_history_service
from typing import Optional
from bson import ObjectId
from app.core.permissions import get_current_user
from app.models.rbac_models import TokenData, UserRole
from app.db.mongo import get_annotation_history_collection
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/history",
    tags=["History"]
)

@router.post("/", response_model=AnnotationHistoryItem)
async def save_history(
    request: AnnotationHistoryCreateRequest,
    current_user: TokenData = Depends(get_current_user),
):
    """Save an AI annotation to history."""
    try:
        if current_user.role != UserRole.ADMIN:
            request.student_id = current_user.user_id
        return await annotation_history_service.create_entry(request)
    except Exception as e:
        logger.error(f"Save history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{student_id}", response_model=AnnotationHistoryListResponse)
async def get_history(
    student_id: str,
    class_level: Optional[int] = Query(None, ge=1, le=12),
    subject: Optional[str] = Query(None),
    chapter: Optional[int] = Query(None, ge=1),
    limit: int = 50,
    current_user: TokenData = Depends(get_current_user),
):
    """Get annotation history for a student."""
    try:
        if current_user.role != UserRole.ADMIN and current_user.user_id != student_id:
            raise HTTPException(status_code=403, detail="Access denied")
        history = await annotation_history_service.get_history_by_student(
            student_id=student_id,
            class_level=class_level,
            subject=subject,
            chapter=chapter,
            limit=limit
        )
        return AnnotationHistoryListResponse(
            history=history,
            total=len(history)
        )
    except Exception as e:
        logger.error(f"Get history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{entry_id}", response_model=SuccessResponse)
async def delete_history_entry(
    entry_id: str,
    current_user: TokenData = Depends(get_current_user),
):
    """Delete a history entry."""
    try:
        collection = get_annotation_history_collection()
        entry = await collection.find_one({"_id": ObjectId(entry_id)})
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if current_user.role != UserRole.ADMIN and entry.get("student_id") != current_user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        await annotation_history_service.delete_entry(entry_id)
        return SuccessResponse(message="Entry deleted successfully")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Delete history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
