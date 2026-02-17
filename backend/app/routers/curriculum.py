"""
Curriculum Management Router
Admin endpoints for managing subjects, chapters, and topics hierarchy
"""

from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form, Depends
from typing import List, Optional
from datetime import datetime
import logging
import uuid

from app.db.mongo import mongodb, db
from app.models.curriculum_models import (
    Subject, Chapter, Topic,
    CreateSubjectRequest, UpdateSubjectRequest,
    CreateChapterRequest, UpdateChapterRequest,
    CreateTopicRequest, UpdateTopicRequest,
    SubjectSummary, ChapterSummary, TopicSummary,
    PendingCurriculumItem, UploadCurriculumRequest, ApprovePendingItemRequest,
    ExtractedChapter
)
from app.services.curriculum_extraction_service import curriculum_extraction_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/curriculum", tags=["Curriculum Management"])

SUBJECTS_COLLECTION = "subjects"
PENDING_CURRICULUM_COLLECTION = "pending_curriculum"


# ==================== SUBJECT MANAGEMENT ====================

@router.get("/subjects", response_model=List[SubjectSummary])
async def get_all_subjects(
    class_level: Optional[int] = Query(None, ge=5, le=12),
    is_active: Optional[bool] = Query(True)
):
    """
    Get all subjects with optional filters.
    Returns summary information for list views.
    By default, only returns active subjects.
    """
    try:
        query = {}
        if class_level:
            query["class_level"] = class_level
        
        # Filter by is_active - handle both new format and legacy documents
        if is_active is True:
            # Show active subjects (explicit True) but exclude explicitly False ones
            query["is_active"] = {"$ne": False}
        elif is_active is False:
            query["is_active"] = False
        elif is_active is not None:
            query["is_active"] = is_active
        # If is_active is None (default True), show only active
        else:
            query["is_active"] = {"$ne": False}
        
        collection = mongodb.db[SUBJECTS_COLLECTION]
        subjects = await collection.find(query).sort("class_level", 1).to_list(200)
        
        logger.info(f"Query: {query}, Retrieved {len(subjects)} subjects")
        
        # Convert to summary format
        summaries = []
        for subject in subjects:
            # Filter active chapters and topics for counts
            active_chapters = [ch for ch in subject.get("chapters", []) if ch.get("is_active", True) != False]
            total_topics = sum(
                len([t for t in ch.get("topics", []) if t.get("is_active", True) != False]) 
                for ch in active_chapters
            )
            
            summaries.append(SubjectSummary(
                subject_id=subject["subject_id"],
                subject_name=subject["subject_name"],
                class_level=subject["class_level"],
                icon=subject.get("icon", "📚"),
                color=subject.get("color", "#3B82F6"),
                total_chapters=len(active_chapters),
                total_topics=total_topics,
                is_active=subject.get("is_active", True)
            ))
        
        logger.info(f"Retrieved {len(summaries)} subjects")
        return summaries
        
    except Exception as e:
        logger.error(f" Get subjects failed: {e}")
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
        
        # Filter out inactive chapters and topics
        active_chapters = []
        for chapter in subject.get("chapters", []):
            if chapter.get("is_active", True) != False:
                # Also filter out inactive topics within the chapter
                chapter_copy = chapter.copy()
                active_topics = [t for t in chapter_copy.get("topics", []) if t.get("is_active", True) != False]
                chapter_copy["topics"] = active_topics
                active_chapters.append(chapter_copy)
        
        # Convert MongoDB document to Subject model
        subject_data = {
            "subject_id": subject["subject_id"],
            "subject_name": subject["subject_name"],
            "class_level": subject["class_level"],
            "board": subject.get("board", "CBSE"),
            "description": subject.get("description", ""),
            "icon": subject.get("icon", "📚"),
            "color": subject.get("color", "#3B82F6"),
            "chapters": active_chapters,
            "total_topics": sum(len(ch.get("topics", [])) for ch in active_chapters),
            "total_chapters": len(active_chapters),
            "is_active": subject.get("is_active", True),
            "created_at": subject.get("created_at", datetime.utcnow()),
            "updated_at": subject.get("updated_at", datetime.utcnow())
        }
        
        return Subject(**subject_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Get subject details failed: {e}")
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
            logger.info(f"Reactivated subject: {request.subject_name} for Class {request.class_level}")
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
            logger.info(f"Created subject: {request.subject_name} for Class {request.class_level}")
            return Subject(**subject_doc)
        else:
            raise HTTPException(status_code=500, detail="Failed to create subject")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Create subject failed: {e}")
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
        
        logger.info(f"Updated subject: {subject_id}")
        
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
        logger.error(f" Update subject failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/subjects/{subject_id}")
async def delete_subject(subject_id: str):
    """
    Delete a subject (soft delete by setting is_active=False).
    """
    try:
        collection = mongodb.db[SUBJECTS_COLLECTION]
        
        # Log before deletion
        logger.info(f" Attempting to delete subject: {subject_id}")
        
        result = await collection.find_one_and_update(
            {"subject_id": subject_id},
            {"$set": {"is_active": False, "updated_at": datetime.utcnow()}},
            return_document=True
        )
        
        if not result:
            logger.warning(f" Subject not found: {subject_id}")
            raise HTTPException(status_code=404, detail="Subject not found")
        
        logger.info(f"🗑️ Deleted subject: {subject_id}, is_active now: {result.get('is_active', 'NOT SET')}")
        return {"success": True, "message": "Subject deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Delete subject failed: {e}")
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
        logger.error(f" Get chapters failed: {e}")
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
            logger.info(f"Created chapter {request.chapter_number} in {subject_id}")
            return Chapter(**chapter_doc)
        else:
            raise HTTPException(status_code=500, detail="Failed to create chapter")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Create chapter failed: {e}")
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
        
        logger.info(f"Updated chapter: {chapter_id}")
        return Chapter(**updated_chapter)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Update chapter failed: {e}")
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
        logger.error(f" Delete chapter failed: {e}")
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
        logger.error(f" Get topics failed: {e}")
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
            logger.info(f"Created topic '{request.topic_name}' in {chapter_id}")
            return Topic(**topic_doc)
        else:
            raise HTTPException(status_code=500, detail="Failed to create topic")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Create topic failed: {e}")
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
        
        logger.info(f"Updated topic: {topic_id}")
        return Topic(**updated_topic)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Update topic failed: {e}")
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
        logger.error(f=" Delete topic failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== AVAILABLE BOOKS METADATA ====================

@router.get("/available-books")
async def get_available_books():
    """
    Get available subjects and classes from books collection.
    Used for dropdown options in curriculum creation forms.
    
    Returns:
        {
            "subjects": ["Mathematics", "Physics", ...],
            "classes": [5, 6, 7, ...],
            "subject_class_map": {
                "Mathematics": [5, 6, 7, ...],
                "Physics": [9, 10, 11, 12],
                ...
            }
        }
    """
    try:
        # Get distinct subjects and classes from books collection
        books_collection = db.books
        
        # Get all books
        all_books = list(books_collection.find({}, {"subject": 1, "class": 1}))
        
        # Extract unique subjects and classes
        subjects_set = set()
        classes_set = set()
        subject_class_map = {}
        
        for book in all_books:
            subject = book.get("subject")
            class_level = book.get("class")
            
            if subject:
                subjects_set.add(subject)
                
                if subject not in subject_class_map:
                    subject_class_map[subject] = set()
                
                if class_level:
                    classes_set.add(class_level)
                    subject_class_map[subject].add(class_level)
        
        # Convert sets to sorted lists
        subjects = sorted(list(subjects_set))
        classes = sorted(list(classes_set))
        
        # Convert subject_class_map sets to sorted lists
        subject_class_map_final = {
            subject: sorted(list(classes))
            for subject, classes in subject_class_map.items()
        }
        
        logger.info(f"Available books: {len(subjects)} subjects, {len(classes)} classes")
        
        return {
            "subjects": subjects,
            "classes": classes,
            "subject_class_map": subject_class_map_final
        }
        
    except Exception as e:
        logger.error(f" Get available books failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== AI-POWERED EXTRACTION ====================

@router.post("/extract-from-upload")
async def extract_curriculum_from_upload(
    file: UploadFile = File(...),
    subject_name: str = Form(...),
    class_level: int = Form(..., ge=5, le=12),
    board: str = Form(default="CBSE"),
    uploaded_by: str = Form(...),
):
    """
    Upload a PDF or image file and extract chapter/topic structure using AI.
    The extracted data is stored in pending_curriculum collection for admin review.
    
    Args:
        file: PDF or image file (table of contents)
        subject_name: Subject name
        class_level: Class level (5-12)
        board: Educational board (default: CBSE)
        uploaded_by: User ID of the admin who uploaded
    
    Returns:
        PendingCurriculumItem with extracted chapters and topics
    """
    try:
        logger.info(f"📤 Received curriculum extraction request: {file.filename}")
        
        # Validate file type
        allowed_types = [
            "application/pdf",
            "image/jpeg", "image/jpg", "image/png", "image/webp"
        ]
        
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type: {file.content_type}. Allowed: PDF, JPEG, PNG, WebP"
            )
        
        # Read file bytes
        file_bytes = await file.read()
        
        logger.info(f"📖 Processing {file.content_type} file ({len(file_bytes)} bytes)...")
        
        # Extract chapters using AI
        extracted_chapters: List[ExtractedChapter] = []
        
        if file.content_type == "application/pdf":
            extracted_chapters = await curriculum_extraction_service.extract_from_pdf(
                pdf_bytes=file_bytes,
                subject_name=subject_name,
                class_level=class_level
            )
        else:
            # Image file
            extracted_chapters = await curriculum_extraction_service.extract_from_image(
                image_bytes=file_bytes,
                mime_type=file.content_type,
                subject_name=subject_name,
                class_level=class_level
            )
        
        # Create pending curriculum item
        pending_id = f"pending_{subject_name.lower().replace(' ', '_')}_{class_level}_{uuid.uuid4().hex[:8]}"
        
        pending_item = {
            "pending_id": pending_id,
            "subject_name": subject_name,
            "class_level": class_level,
            "board": board,
            "extracted_chapters": [ch.dict() for ch in extracted_chapters],
            "source_file_name": file.filename,
            "source_file_url": "",  # Could upload to cloud storage here
            "extraction_method": "ai",
            "status": "pending",
            "uploaded_by": uploaded_by,
            "uploaded_at": datetime.utcnow(),
            "reviewed_by": None,
            "reviewed_at": None,
            "rejection_reason": ""
        }
        
        # Save to pending collection
        collection = mongodb.db[PENDING_CURRICULUM_COLLECTION]
        result = await collection.insert_one(pending_item)
        
        if result.inserted_id:
            logger.info(f"Created pending curriculum item: {pending_id} ({len(extracted_chapters)} chapters)")
            return PendingCurriculumItem(**pending_item)
        else:
            raise HTTPException(status_code=500, detail="Failed to save pending item")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Curriculum extraction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pending", response_model=List[PendingCurriculumItem])
async def get_pending_curriculum_items(
    status: Optional[str] = Query(None, description="Filter by status: pending, approved, rejected")
):
    """
    Get all pending curriculum items waiting for admin review.
    
    Args:
        status: Optional status filter
    
    Returns:
        List of pending curriculum items
    """
    try:
        query = {}
        if status:
            query["status"] = status
        else:
            # Default to showing only pending items
            query["status"] = "pending"
        
        collection = mongodb.db[PENDING_CURRICULUM_COLLECTION]
        items = await collection.find(query).sort("uploaded_at", -1).to_list(100)
        
        pending_items = [PendingCurriculumItem(**item) for item in items]
        
        logger.info(f"📋 Retrieved {len(pending_items)} pending curriculum items")
        return pending_items
        
    except Exception as e:
        logger.error(f" Get pending items failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pending/{pending_id}", response_model=PendingCurriculumItem)
async def get_pending_curriculum_item(pending_id: str):
    """
    Get details of a specific pending curriculum item.
    
    Args:
        pending_id: Pending item ID
    
    Returns:
        PendingCurriculumItem details
    """
    try:
        collection = mongodb.db[PENDING_CURRICULUM_COLLECTION]
        item = await collection.find_one({"pending_id": pending_id})
        
        if not item:
            raise HTTPException(status_code=404, detail="Pending item not found")
        
        return PendingCurriculumItem(**item)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Get pending item failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/pending/{pending_id}")
async def update_pending_curriculum_item(
    pending_id: str,
    subject_name: str = Form(None),
    class_level: int = Form(None),
    extracted_chapters: str = Form(None)  # JSON string
):
    """
    Update a pending curriculum item before approval.
    Allows admin to edit extracted data if AI made mistakes.
    
    Args:
        pending_id: Pending item ID
        subject_name: Updated subject name (optional)
        class_level: Updated class level (optional)
        extracted_chapters: Updated chapters as JSON string (optional)
    
    Returns:
        Updated PendingCurriculumItem
    """
    try:
        import json
        
        collection = mongodb.db[PENDING_CURRICULUM_COLLECTION]
        
        # Get existing item
        existing = await collection.find_one({"pending_id": pending_id})
        
        if not existing:
            raise HTTPException(status_code=404, detail="Pending item not found")
        
        # Build update data
        update_data = {}
        
        if subject_name is not None:
            update_data["subject_name"] = subject_name
        
        if class_level is not None:
            update_data["class_level"] = class_level
        
        if extracted_chapters is not None:
            # Parse JSON string to list of chapters
            chapters_data = json.loads(extracted_chapters)
            update_data["extracted_chapters"] = chapters_data
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No data to update")
        
        # Add updated timestamp
        update_data["updated_at"] = datetime.utcnow()
        
        # Update the item
        result = await collection.update_one(
            {"pending_id": pending_id},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update item")
        
        # Get updated item
        updated_item = await collection.find_one({"pending_id": pending_id})
        
        logger.info(f"Updated pending item: {pending_id}")
        return PendingCurriculumItem(**updated_item)
        
    except HTTPException:
        raise
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON format for extracted_chapters")
    except Exception as e:
        logger.error(f" Update pending item failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pending/{pending_id}/approve")
async def approve_or_reject_pending_item(
    pending_id: str,
    action: str = Form(...),
    reviewed_by: str = Form(...),
    rejection_reason: Optional[str] = Form(None),
    subject_name_override: Optional[str] = Form(None),
    icon: Optional[str] = Form(None),
    color: Optional[str] = Form(None)
):
    """
    Approve or reject a pending curriculum item.
    If approved, creates the subject with chapters and topics.
    
    Args:
        pending_id: Pending item ID
        action: 'approve' or 'reject'
        reviewed_by: User ID of the admin who reviewed
        rejection_reason: Required if action is 'reject'
        subject_name_override: Optional override for subject name
        icon: Optional icon for subject (default: 📚)
        color: Optional color for subject (default: #3B82F6)
    
    Returns:
        Success message with created subject_id if approved
    """
    try:
        pending_collection = mongodb.db[PENDING_CURRICULUM_COLLECTION]
        subjects_collection = mongodb.db[SUBJECTS_COLLECTION]
        
        # Get pending item
        pending_item = await pending_collection.find_one({"pending_id": pending_id})
        
        if not pending_item:
            raise HTTPException(status_code=404, detail="Pending item not found")
        
        if pending_item["status"] != "pending":
            raise HTTPException(
                status_code=400,
                detail=f"Item already {pending_item['status']}"
            )
        
        # Handle rejection
        if action == "reject":
            if not rejection_reason:
                raise HTTPException(
                    status_code=400,
                    detail="Rejection reason is required"
                )
            
            await pending_collection.update_one(
                {"pending_id": pending_id},
                {
                    "$set": {
                        "status": "rejected",
                        "reviewed_by": reviewed_by,
                        "reviewed_at": datetime.utcnow(),
                        "rejection_reason": rejection_reason
                    }
                }
            )
            
            logger.info(f" Rejected pending item: {pending_id}")
            return {
                "success": True,
                "message": "Pending item rejected",
                "action": "rejected"
            }
        
        # Handle approval
        if action == "approve":
            # Use override values if provided
            subject_name = subject_name_override or pending_item["subject_name"]
            
            # Check if subject already exists
            subject_id = f"{subject_name.lower().replace(' ', '_')}_{pending_item['class_level']}"
            
            existing = await subjects_collection.find_one({
                "subject_id": subject_id,
                "is_active": True
            })
            
            # Convert extracted chapters to proper Chapter format
            chapters = []
            for idx, extracted_ch in enumerate(pending_item["extracted_chapters"], 1):
                # Convert extracted topics to Topic format
                topics = []
                for topic_idx, extracted_topic in enumerate(extracted_ch.get("topics", []), 1):
                    topic_id = f"{subject_id}_ch{extracted_ch['chapter_number']}_topic{topic_idx}"
                    topics.append({
                        "topic_id": topic_id,
                        "topic_name": extracted_topic["topic_name"],
                        "description": extracted_topic.get("description", ""),
                        "page_range": extracted_topic.get("page_range", ""),
                        "learning_objectives": [],
                        "keywords": [],
                        "estimated_time_minutes": 45,
                        "difficulty_level": "medium",
                        "prerequisites": [],
                        "order": topic_idx,
                        "is_active": True,
                        "question_count": 0
                    })
                
                # Create chapter
                chapter_id = f"{subject_id}_ch{extracted_ch['chapter_number']}"
                chapters.append({
                    "chapter_id": chapter_id,
                    "chapter_number": extracted_ch["chapter_number"],
                    "chapter_name": extracted_ch["chapter_name"],
                    "description": f"Author: {extracted_ch.get('author', 'N/A')}",
                    "topics": topics,
                    "pdf_url": "",
                    "video_url": "",
                    "total_pages": 0,
                    "order": idx,
                    "is_active": True,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                })
            
            # Create subject document
            subject_doc = {
                "subject_id": subject_id,
                "subject_name": subject_name,
                "class_level": pending_item["class_level"],
                "board": pending_item.get("board", "CBSE"),
                "description": f"Auto-generated from {pending_item['source_file_name']}",
                "icon": icon or "📚",
                "color": color or "#3B82F6",
                "chapters": chapters,
                "total_topics": sum(len(ch["topics"]) for ch in chapters),
                "total_chapters": len(chapters),
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            # If subject exists, MERGE chapters instead of creating new
            if existing:
                # Get existing chapters and find which new ones to add
                existing_chapters = existing.get("chapters", [])
                existing_chapter_numbers = set(ch.get("chapter_number") for ch in existing_chapters)
                
                # Add only new chapters (those not already present)
                new_chapters_to_add = [ch for ch in chapters if ch["chapter_number"] not in existing_chapter_numbers]
                
                if new_chapters_to_add:
                    merged_chapters = existing_chapters + new_chapters_to_add
                    merged_chapters.sort(key=lambda ch: ch.get("chapter_number", 0))
                    
                    # Update existing subject with merged chapters
                    total_topics = sum(len(ch.get("topics", [])) for ch in merged_chapters)
                    await subjects_collection.update_one(
                        {"subject_id": subject_id},
                        {
                            "$set": {
                                "chapters": merged_chapters,
                                "total_chapters": len(merged_chapters),
                                "total_topics": total_topics,
                                "updated_at": datetime.utcnow()
                            }
                        }
                    )
                    
                    # Update pending item status
                    await pending_collection.update_one(
                        {"pending_id": pending_id},
                        {
                            "$set": {
                                "status": "approved",
                                "reviewed_by": reviewed_by,
                                "reviewed_at": datetime.utcnow()
                            }
                        }
                    )
                    
                    logger.info(f"Approved and merged {len(new_chapters_to_add)} chapters into existing subject: {subject_id}")
                    return {
                        "success": True,
                        "message": f"Pending item approved. Merged {len(new_chapters_to_add)} new chapters into existing subject.",
                        "action": "approved",
                        "subject_id": subject_id,
                        "total_chapters": len(merged_chapters),
                        "total_topics": total_topics,
                        "merged": True,
                        "new_chapters_added": len(new_chapters_to_add)
                    }
                else:
                    # All chapters already exist - just mark as approved
                    await pending_collection.update_one(
                        {"pending_id": pending_id},
                        {
                            "$set": {
                                "status": "approved",
                                "reviewed_by": reviewed_by,
                                "reviewed_at": datetime.utcnow()
                            }
                        }
                    )
                    
                    logger.info(f"Approved pending item for {subject_id} - all chapters already exist")
                    return {
                        "success": True,
                        "message": "Pending item approved. All chapters already exist in subject.",
                        "action": "approved",
                        "subject_id": subject_id,
                        "merged": True,
                        "new_chapters_added": 0
                    }
            
            # Insert NEW subject
            result = await subjects_collection.insert_one(subject_doc)
            
            if result.inserted_id:
                # Update pending item status
                await pending_collection.update_one(
                    {"pending_id": pending_id},
                    {
                        "$set": {
                            "status": "approved",
                            "reviewed_by": reviewed_by,
                            "reviewed_at": datetime.utcnow()
                        }
                    }
                )
                
                logger.info(f"Approved and created subject: {subject_id} ({len(chapters)} chapters, {subject_doc['total_topics']} topics)")
                return {
                    "success": True,
                    "message": "Pending item approved and subject created",
                    "action": "approved",
                    "subject_id": subject_id,
                    "total_chapters": len(chapters),
                    "total_topics": subject_doc["total_topics"]
                }
            else:
                raise HTTPException(status_code=500, detail="Failed to create subject")
        
        raise HTTPException(
            status_code=400,
            detail="Invalid action. Must be 'approve' or 'reject'"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Approve/reject pending item failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/pending/{pending_id}")
async def delete_pending_item(pending_id: str):
    """
    Delete a pending curriculum item (hard delete).
    
    Args:
        pending_id: Pending item ID
    
    Returns:
        Success message
    """
    try:
        collection = mongodb.db[PENDING_CURRICULUM_COLLECTION]
        result = await collection.delete_one({"pending_id": pending_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Pending item not found")
        
        logger.info(f"🗑️ Deleted pending item: {pending_id}")
        return {"success": True, "message": "Pending item deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Delete pending item failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))
