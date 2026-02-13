"""
Curriculum Management Router
Admin endpoints for managing subjects, chapters, and topics hierarchy
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime
import logging
import uuid

from app.db.mongo import mongodb
from app.models.curriculum_models import (
    Subject, Chapter, Topic,
    CreateSubjectRequest, UpdateSubjectRequest,
    CreateChapterRequest, UpdateChapterRequest,
    CreateTopicRequest, UpdateTopicRequest,
    SubjectSummary, ChapterSummary, TopicSummary
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/curriculum", tags=["Curriculum Management"])

SUBJECTS_COLLECTION = "subjects"


# ==================== SUBJECT MANAGEMENT ====================

@router.get("/subjects", response_model=List[SubjectSummary])
async def get_all_subjects(
    class_level: Optional[int] = Query(None, ge=5, le=12),
    is_active: Optional[bool] = Query(None)
):
    """
    Get all subjects with optional filters.
    Returns summary information for list views.
    """
    try:
        query = {}
        if class_level:
            query["class_level"] = class_level
        if is_active is not None:
            query["is_active"] = is_active
        
        collection = mongodb.db[SUBJECTS_COLLECTION]
        subjects = await collection.find(query).sort("class_level", 1).to_list(200)
        
        # Convert to summary format
        summaries = []
        for subject in subjects:
            summaries.append(SubjectSummary(
                subject_id=subject["subject_id"],
                subject_name=subject["subject_name"],
                class_level=subject["class_level"],
                icon=subject.get("icon", "📚"),
                color=subject.get("color", "#3B82F6"),
                total_chapters=len(subject.get("chapters", [])),
                total_topics=sum(len(ch.get("topics", [])) for ch in subject.get("chapters", [])),
                is_active=subject.get("is_active", True)
            ))
        
        logger.info(f"📚 Retrieved {len(summaries)} subjects")
        return summaries
        
    except Exception as e:
        logger.error(f"❌ Get subjects failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/subjects/{subject_id}", response_model=Subject)
async def get_subject_details(subject_id: str):
    """
    Get full details of a subject including all chapters and topics.
    """
    try:
        collection = mongodb.db[SUBJECTS_COLLECTION]
        subject = await collection.find_one({"subject_id": subject_id})
        
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        
        # Convert MongoDB document to Subject model
        subject_data = {
            "subject_id": subject["subject_id"],
            "subject_name": subject["subject_name"],
            "class_level": subject["class_level"],
            "board": subject.get("board", "CBSE"),
            "description": subject.get("description", ""),
            "icon": subject.get("icon", "📚"),
            "color": subject.get("color", "#3B82F6"),
            "chapters": subject.get("chapters", []),
            "total_topics": sum(len(ch.get("topics", [])) for ch in subject.get("chapters", [])),
            "total_chapters": len(subject.get("chapters", [])),
            "is_active": subject.get("is_active", True),
            "created_at": subject.get("created_at", datetime.utcnow()),
            "updated_at": subject.get("updated_at", datetime.utcnow())
        }
        
        return Subject(**subject_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Get subject details failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/subjects", response_model=Subject)
async def create_subject(request: CreateSubjectRequest):
    """
    Create a new subject.
    """
    try:
        collection = mongodb.db[SUBJECTS_COLLECTION]
        
        # Check if active subject already exists for this class
        existing = await collection.find_one({
            "subject_name": request.subject_name,
            "class_level": request.class_level,
            "is_active": True
        })
        
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Subject '{request.subject_name}' already exists for Class {request.class_level}"
            )
        
        # Check if there's an inactive subject - reactivate it instead
        inactive_subject = await collection.find_one({
            "subject_name": request.subject_name,
            "class_level": request.class_level,
            "is_active": False
        })
        
        if inactive_subject:
            # Reactivate the existing subject
            subject_id = inactive_subject["subject_id"]
            await collection.update_one(
                {"subject_id": subject_id},
                {
                    "$set": {
                        "is_active": True,
                        "icon": request.icon or inactive_subject.get("icon", "📚"),
                        "color": request.color or inactive_subject.get("color", "#3B82F6"),
                        "description": request.description or inactive_subject.get("description", ""),
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            logger.info(f"✅ Reactivated subject: {request.subject_name} for Class {request.class_level}")
            # Return the reactivated subject
            updated_subject = await collection.find_one({"subject_id": subject_id})
            subject_data = {
                "subject_id": updated_subject["subject_id"],
                "subject_name": updated_subject["subject_name"],
                "class_level": updated_subject["class_level"],
                "board": updated_subject.get("board", "CBSE"),
                "description": updated_subject.get("description", ""),
                "icon": updated_subject.get("icon", "📚"),
                "color": updated_subject.get("color", "#3B82F6"),
                "chapters": updated_subject.get("chapters", []),
                "total_topics": sum(len(ch.get("topics", [])) for ch in updated_subject.get("chapters", [])),
                "total_chapters": len(updated_subject.get("chapters", [])),
                "is_active": updated_subject.get("is_active", True),
                "created_at": updated_subject.get("created_at", datetime.utcnow()),
                "updated_at": updated_subject.get("updated_at", datetime.utcnow())
            }
            return Subject(**subject_data)
        
        # Create subject document
        subject_id = f"{request.subject_name.lower().replace(' ', '_')}_{request.class_level}"
        subject_doc = {
            "subject_id": subject_id,
            "subject_name": request.subject_name,
            "class_level": request.class_level,
            "board": request.board,
            "description": request.description or "",
            "icon": request.icon or "📚",
            "color": request.color or "#3B82F6",
            "chapters": [],
            "total_topics": 0,
            "total_chapters": 0,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await collection.insert_one(subject_doc)
        
        if result.inserted_id:
            logger.info(f"✅ Created subject: {request.subject_name} for Class {request.class_level}")
            return Subject(**subject_doc)
        else:
            raise HTTPException(status_code=500, detail="Failed to create subject")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Create subject failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/subjects/{subject_id}", response_model=Subject)
async def update_subject(subject_id: str, request: UpdateSubjectRequest):
    """
    Update subject details.
    """
    try:
        collection = mongodb.db[SUBJECTS_COLLECTION]
        
        # Build update document
        update_data = {"updated_at": datetime.utcnow()}
        
        if request.subject_name:
            update_data["subject_name"] = request.subject_name
        if request.description is not None:
            update_data["description"] = request.description
        if request.icon:
            update_data["icon"] = request.icon
        if request.color:
            update_data["color"] = request.color
        if request.is_active is not None:
            update_data["is_active"] = request.is_active
        
        result = await collection.find_one_and_update(
            {"subject_id": subject_id},
            {"$set": update_data},
            return_document=True
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Subject not found")
        
        logger.info(f"✅ Updated subject: {subject_id}")
        
        # Convert to Subject model
        subject_data = {
            "subject_id": result["subject_id"],
            "subject_name": result["subject_name"],
            "class_level": result["class_level"],
            "board": result.get("board", "CBSE"),
            "description": result.get("description", ""),
            "icon": result.get("icon", "📚"),
            "color": result.get("color", "#3B82F6"),
            "chapters": result.get("chapters", []),
            "total_topics": sum(len(ch.get("topics", [])) for ch in result.get("chapters", [])),
            "total_chapters": len(result.get("chapters", [])),
            "is_active": result.get("is_active", True),
            "created_at": result.get("created_at", datetime.utcnow()),
            "updated_at": result.get("updated_at", datetime.utcnow())
        }
        
        return Subject(**subject_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Update subject failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/subjects/{subject_id}")
async def delete_subject(subject_id: str):
    """
    Delete a subject (soft delete by setting is_active=False).
    """
    try:
        collection = mongodb.db[SUBJECTS_COLLECTION]
        
        result = await collection.find_one_and_update(
            {"subject_id": subject_id},
            {"$set": {"is_active": False, "updated_at": datetime.utcnow()}},
            return_document=True
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Subject not found")
        
        logger.info(f"🗑️ Deleted subject: {subject_id}")
        return {"success": True, "message": "Subject deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Delete subject failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== CHAPTER MANAGEMENT ====================

@router.get("/subjects/{subject_id}/chapters", response_model=List[ChapterSummary])
async def get_chapters(subject_id: str):
    """
    Get all chapters for a subject.
    """
    try:
        collection = mongodb.db[SUBJECTS_COLLECTION]
        subject = await collection.find_one({"subject_id": subject_id})
        
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        
        chapters = subject.get("chapters", [])
        
        # Convert to summary format
        summaries = []
        for chapter in chapters:
            summaries.append(ChapterSummary(
                chapter_id=chapter["chapter_id"],
                chapter_number=chapter["chapter_number"],
                chapter_name=chapter["chapter_name"],
                total_topics=len(chapter.get("topics", [])),
                pdf_url=chapter.get("pdf_url", ""),
                is_active=chapter.get("is_active", True)
            ))
        
        return summaries
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Get chapters failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/subjects/{subject_id}/chapters", response_model=Chapter)
async def create_chapter(subject_id: str, request: CreateChapterRequest):
    """
    Create a new chapter within a subject.
    """
    try:
        collection = mongodb.db[SUBJECTS_COLLECTION]
        
        # Get subject
        subject = await collection.find_one({"subject_id": subject_id})
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        
        # Check if chapter number already exists
        chapters = subject.get("chapters", [])
        if any(ch["chapter_number"] == request.chapter_number for ch in chapters):
            raise HTTPException(
                status_code=400,
                detail=f"Chapter {request.chapter_number} already exists"
            )
        
        # Create chapter
        chapter_id = f"{subject_id}_ch{request.chapter_number}"
        chapter_doc = {
            "chapter_id": chapter_id,
            "chapter_number": request.chapter_number,
            "chapter_name": request.chapter_name,
            "description": request.description or "",
            "topics": [],
            "pdf_url": request.pdf_url or "",
            "video_url": request.video_url or "",
            "total_pages": request.total_pages or 0,
            "order": request.chapter_number,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        # Add chapter to subject
        result = await collection.update_one(
            {"subject_id": subject_id},
            {
                "$push": {"chapters": chapter_doc},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        if result.modified_count > 0:
            logger.info(f"✅ Created chapter {request.chapter_number} in {subject_id}")
            return Chapter(**chapter_doc)
        else:
            raise HTTPException(status_code=500, detail="Failed to create chapter")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Create chapter failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/subjects/{subject_id}/chapters/{chapter_id}", response_model=Chapter)
async def update_chapter(
    subject_id: str,
    chapter_id: str,
    request: UpdateChapterRequest
):
    """
    Update chapter details.
    """
    try:
        collection = mongodb.db[SUBJECTS_COLLECTION]
        
        # Build update document
        update_fields = {}
        if request.chapter_name:
            update_fields["chapters.$.chapter_name"] = request.chapter_name
        if request.description is not None:
            update_fields["chapters.$.description"] = request.description
        if request.pdf_url is not None:
            update_fields["chapters.$.pdf_url"] = request.pdf_url
        if request.video_url is not None:
            update_fields["chapters.$.video_url"] = request.video_url
        if request.total_pages is not None:
            update_fields["chapters.$.total_pages"] = request.total_pages
        if request.order is not None:
            update_fields["chapters.$.order"] = request.order
        if request.is_active is not None:
            update_fields["chapters.$.is_active"] = request.is_active
        
        update_fields["chapters.$.updated_at"] = datetime.utcnow()
        update_fields["updated_at"] = datetime.utcnow()
        
        result = await collection.find_one_and_update(
            {"subject_id": subject_id, "chapters.chapter_id": chapter_id},
            {"$set": update_fields},
            return_document=True
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Chapter not found")
        
        # Find updated chapter
        updated_chapter = next(
            (ch for ch in result["chapters"] if ch["chapter_id"] == chapter_id),
            None
        )
        
        if not updated_chapter:
            raise HTTPException(status_code=404, detail="Chapter not found")
        
        logger.info(f"✅ Updated chapter: {chapter_id}")
        return Chapter(**updated_chapter)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Update chapter failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/subjects/{subject_id}/chapters/{chapter_id}")
async def delete_chapter(subject_id: str, chapter_id: str):
    """
    Delete a chapter (soft delete by setting is_active=False).
    """
    try:
        collection = mongodb.db[SUBJECTS_COLLECTION]
        
        result = await collection.update_one(
            {"subject_id": subject_id, "chapters.chapter_id": chapter_id},
            {
                "$set": {
                    "chapters.$.is_active": False,
                    "chapters.$.updated_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Chapter not found")
        
        logger.info(f"🗑️ Deleted chapter: {chapter_id}")
        return {"success": True, "message": "Chapter deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Delete chapter failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== TOPIC MANAGEMENT ====================

@router.get("/subjects/{subject_id}/chapters/{chapter_id}/topics", response_model=List[TopicSummary])
async def get_topics(subject_id: str, chapter_id: str):
    """
    Get all topics for a chapter.
    """
    try:
        collection = mongodb.db[SUBJECTS_COLLECTION]
        subject = await collection.find_one({"subject_id": subject_id})
        
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        
        # Find chapter
        chapter = next(
            (ch for ch in subject.get("chapters", []) if ch["chapter_id"] == chapter_id),
            None
        )
        
        if not chapter:
            raise HTTPException(status_code=404, detail="Chapter not found")
        
        topics = chapter.get("topics", [])
        
        # Convert to summary format
        summaries = []
        for topic in topics:
            summaries.append(TopicSummary(
                topic_id=topic["topic_id"],
                topic_name=topic["topic_name"],
                description=topic.get("description", ""),
                page_range=topic.get("page_range", ""),
                difficulty_level=topic.get("difficulty_level", "medium"),
                question_count=topic.get("question_count", 0),
                is_active=topic.get("is_active", True)
            ))
        
        return summaries
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Get topics failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/subjects/{subject_id}/chapters/{chapter_id}/topics", response_model=Topic)
async def create_topic(
    subject_id: str,
    chapter_id: str,
    request: CreateTopicRequest
):
    """
    Create a new topic within a chapter.
    """
    try:
        collection = mongodb.db[SUBJECTS_COLLECTION]
        
        # Generate topic ID
        topic_id = f"{chapter_id}_{request.topic_name.lower().replace(' ', '_')}"
        
        # Create topic document
        topic_doc = {
            "topic_id": topic_id,
            "topic_name": request.topic_name,
            "description": request.description or "",
            "page_range": request.page_range or "",
            "learning_objectives": request.learning_objectives or [],
            "keywords": request.keywords or [],
            "estimated_time_minutes": request.estimated_time_minutes or 45,
            "difficulty_level": request.difficulty_level or "medium",
            "prerequisites": request.prerequisites or [],
            "order": 999,  # Will be set based on existing topics
            "is_active": True,
            "question_count": 0
        }
        
        # Add topic to chapter
        result = await collection.update_one(
            {"subject_id": subject_id, "chapters.chapter_id": chapter_id},
            {
                "$push": {"chapters.$.topics": topic_doc},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        if result.modified_count > 0:
            logger.info(f"✅ Created topic '{request.topic_name}' in {chapter_id}")
            return Topic(**topic_doc)
        else:
            raise HTTPException(status_code=500, detail="Failed to create topic")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Create topic failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/subjects/{subject_id}/chapters/{chapter_id}/topics/{topic_id}", response_model=Topic)
async def update_topic(
    subject_id: str,
    chapter_id: str,
    topic_id: str,
    request: UpdateTopicRequest
):
    """
    Update topic details.
    """
    try:
        collection = mongodb.db[SUBJECTS_COLLECTION]
        
        # Build update fields
        update_fields = {}
        if request.topic_name:
            update_fields["chapters.$[chapter].topics.$[topic].topic_name"] = request.topic_name
        if request.description is not None:
            update_fields["chapters.$[chapter].topics.$[topic].description"] = request.description
        if request.page_range is not None:
            update_fields["chapters.$[chapter].topics.$[topic].page_range"] = request.page_range
        if request.learning_objectives is not None:
            update_fields["chapters.$[chapter].topics.$[topic].learning_objectives"] = request.learning_objectives
        if request.keywords is not None:
            update_fields["chapters.$[chapter].topics.$[topic].keywords"] = request.keywords
        if request.estimated_time_minutes is not None:
            update_fields["chapters.$[chapter].topics.$[topic].estimated_time_minutes"] = request.estimated_time_minutes
        if request.difficulty_level is not None:
            update_fields["chapters.$[chapter].topics.$[topic].difficulty_level"] = request.difficulty_level
        if request.prerequisites is not None:
            update_fields["chapters.$[chapter].topics.$[topic].prerequisites"] = request.prerequisites
        if request.order is not None:
            update_fields["chapters.$[chapter].topics.$[topic].order"] = request.order
        if request.is_active is not None:
            update_fields["chapters.$[chapter].topics.$[topic].is_active"] = request.is_active
        
        update_fields["updated_at"] = datetime.utcnow()
        
        result = await collection.find_one_and_update(
            {"subject_id": subject_id},
            {"$set": update_fields},
            array_filters=[
                {"chapter.chapter_id": chapter_id},
                {"topic.topic_id": topic_id}
            ],
            return_document=True
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Topic not found")
        
        # Find updated topic
        chapter = next(
            (ch for ch in result["chapters"] if ch["chapter_id"] == chapter_id),
            None
        )
        if not chapter:
            raise HTTPException(status_code=404, detail="Chapter not found")
        
        updated_topic = next(
            (t for t in chapter["topics"] if t["topic_id"] == topic_id),
            None
        )
        
        if not updated_topic:
            raise HTTPException(status_code=404, detail="Topic not found")
        
        logger.info(f"✅ Updated topic: {topic_id}")
        return Topic(**updated_topic)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Update topic failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/subjects/{subject_id}/chapters/{chapter_id}/topics/{topic_id}")
async def delete_topic(subject_id: str, chapter_id: str, topic_id: str):
    """
    Delete a topic (soft delete by setting is_active=False).
    """
    try:
        collection = mongodb.db[SUBJECTS_COLLECTION]
        
        result = await collection.update_one(
            {"subject_id": subject_id},
            {
                "$set": {
                    "chapters.$[chapter].topics.$[topic].is_active": False,
                    "updated_at": datetime.utcnow()
                }
            },
            array_filters=[
                {"chapter.chapter_id": chapter_id},
                {"topic.topic_id": topic_id}
            ]
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Topic not found")
        
        logger.info(f"🗑️ Deleted topic: {topic_id}")
        return {"success": True, "message": "Topic deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Delete topic failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
