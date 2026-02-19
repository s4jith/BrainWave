"""
Annotation History Service - Handles persistent storage of AI annotations.
"""

from app.db.mongo import get_annotation_history_collection
from app.models.schemas import AnnotationHistoryCreateRequest, AnnotationHistoryItem
from datetime import datetime
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

class AnnotationHistoryService:
    """Service for managing annotation history."""
    
    async def create_entry(self, request: AnnotationHistoryCreateRequest) -> AnnotationHistoryItem:
        """
        Save an AI annotation to history.
        
        Args:
            request: Annotation data
        
        Returns:
            Created history item
        """
        try:
            collection = get_annotation_history_collection()
            
            document = request.dict()
            document["created_at"] = datetime.utcnow()
            
            result = await collection.insert_one(document)
            
            item = AnnotationHistoryItem(
                id=str(result.inserted_id),
                **document
            )
            
            logger.info(f"Annotation history saved: {item.id}")
            return item
        
        except Exception as e:
            logger.error(f" Failed to save annotation history: {e}")
            raise
    
    async def get_history_by_student(
        self,
        student_id: str,
        class_level: int = None,
        subject: str = None,
        chapter: int = None,
        limit: int = 50
    ) -> list[AnnotationHistoryItem]:
        """
        Retrieve annotation history for a student.
        """
        try:
            collection = get_annotation_history_collection()
            
            query = {"student_id": student_id}
            if class_level:
                query["class_level"] = class_level
            if subject:
                query["subject"] = subject
            if chapter:
                query["chapter"] = chapter
            
            cursor = collection.find(query).sort("created_at", -1).limit(limit)
            history = []
            
            async for doc in cursor:
                item = AnnotationHistoryItem(
                    id=str(doc["_id"]),
                    student_id=doc["student_id"],
                    class_level=doc["class_level"],
                    subject=doc["subject"],
                    chapter=doc.get("chapter"),
                    page_number=doc["page_number"],
                    selected_text=doc["selected_text"],
                    action_type=doc["action_type"],
                    ai_response=doc["ai_response"],
                    source_count=doc.get("source_count", 0),
                    created_at=doc["created_at"]
                )
                history.append(item)
            
            return history
        
        except Exception as e:
            logger.error(f" Failed to retrieve annotation history: {e}")
            raise

    async def delete_entry(self, entry_id: str) -> bool:
        """Delete a history entry."""
        try:
            collection = get_annotation_history_collection()
            result = await collection.delete_one({"_id": ObjectId(entry_id)})
            
            if result.deleted_count == 0:
                raise ValueError(f"Entry {entry_id} not found")
                
            return True
        except Exception as e:
            logger.error(f" Failed to delete history entry: {e}")
            raise

annotation_history_service = AnnotationHistoryService()
