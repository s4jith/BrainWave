"""
History Router - Endpoints for AI Annotation History.
"""

from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import AnnotationHistoryCreateRequest, AnnotationHistoryItem, AnnotationHistoryListResponse, SuccessResponse
from app.services.annotation_history_service import annotation_history_service
from typing import Optional
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/history",
    tags=["History"]
)


@router.post("/", response_model=AnnotationHistoryItem)
async def save_history(request: AnnotationHistoryCreateRequest):
    """Save an AI annotation to history."""
    try:
        return await annotation_history_service.create_entry(request)
    except Exception as e:
        logger.error(f"Save history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{student_id}", response_model=AnnotationHistoryListResponse)
async def get_history(
    student_id: str,
    class_level: Optional[int] = Query(None, ge=5, le=12),
    subject: Optional[str] = Query(None),
    chapter: Optional[int] = Query(None, ge=1),
    limit: int = 50
):
    """Get annotation history for a student."""
    try:
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
async def delete_history_entry(entry_id: str):
    """Delete a history entry."""
    try:
        await annotation_history_service.delete_entry(entry_id)
        return SuccessResponse(message="Entry deleted successfully")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Delete history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
