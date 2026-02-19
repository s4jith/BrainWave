"""
Course Management Service

Handles CRUD operations for courses, modules, and content.
Integrates with MongoDB for persistence.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
import logging
import uuid

from app.db.mongo import mongodb
from app.models.course_models import (
    CourseCreateRequest, CourseUpdateRequest, CourseInDB, CourseResponse,
    CourseDetailResponse, CourseListResponse, Module, ContentItem,
    ModuleCreateRequest, ContentItemCreateRequest, CourseStatus,
    CourseRating, EnrollmentResponse
)

logger = logging.getLogger(__name__)

class CourseService:
    """Service for managing courses."""
    
    def __init__(self):
        self.collection_name = "courses"
        self._collection = None
    
    @property
    def collection(self):
        """Lazy access to collection."""
        if self._collection is None:
            if mongodb.db is not None:
                self._collection = mongodb.get_collection(self.collection_name)
            else:
                logger.warning("MongoDB not connected")
        return self._collection
    
    async def create_course(
        self,
        request: CourseCreateRequest,
        instructor_id: str,
        instructor_name: str
    ) -> CourseResponse:
        """
        Create a new course.
        
        Args:
            request: Course creation data
            instructor_id: MongoDB ID of the instructor
            instructor_name: Name of the instructor
            
        Returns:
            Created course response
        """
        try:
            course_doc = {
                "title": request.title,
                "description": request.description,
                "category": request.category,
                "difficulty": request.difficulty.value,
                "thumbnail_url": request.thumbnail_url,
                "class_level": request.class_level,
                "instructor_id": instructor_id,
                "instructor_name": instructor_name,
                "status": CourseStatus.DRAFT.value,
                "modules": [],
                "enrolled_students": [],
                "ratings": [],
                "average_rating": 0.0,
                "total_enrollments": 0,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            result = await self.collection.insert_one(course_doc)
            course_doc["id"] = str(result.inserted_id)
            
            logger.info(f"Course created: {course_doc['title']} by {instructor_name}")
            
            return self._to_response(course_doc)
            
        except Exception as e:
            logger.error(f"Failed to create course: {e}")
            raise
    
    async def get_course(self, course_id: str, user_id: str = None) -> Optional[CourseDetailResponse]:
        """
        Get course by ID with full details.
        
        Args:
            course_id: Course MongoDB ID
            user_id: Current user ID (to check enrollment)
            
        Returns:
            Course details or None
        """
        try:
            doc = await self.collection.find_one({"_id": ObjectId(course_id)})
            
            if not doc:
                return None
            
            return self._to_detail_response(doc, user_id)
            
        except Exception as e:
            logger.error(f"Failed to get course {course_id}: {e}")
            return None
    
    async def list_courses(
        self,
        page: int = 1,
        page_size: int = 20,
        category: str = None,
        difficulty: str = None,
        class_level: int = None,
        instructor_id: str = None,
        status: str = None,
        user_id: str = None,
        enrolled_only: bool = False
    ) -> CourseListResponse:
        """
        List courses with filtering and pagination.
        
        Args:
            page: Page number (1-indexed)
            page_size: Items per page
            category: Filter by category
            difficulty: Filter by difficulty
            class_level: Filter by target class
            instructor_id: Filter by instructor
            status: Filter by status (for instructors)
            user_id: Current user ID
            enrolled_only: Show only enrolled courses
            
        Returns:
            Paginated course list
        """
        try:
            query = {}
            
            if category:
                query["category"] = category
            if difficulty:
                query["difficulty"] = difficulty
            if class_level:
                query["class_level"] = class_level
            if instructor_id:
                query["instructor_id"] = instructor_id
            if status:
                query["status"] = status
            else:
                if not instructor_id:
                    query["status"] = CourseStatus.PUBLISHED.value
            
            if enrolled_only and user_id:
                query["enrolled_students"] = user_id
            
            total = await self.collection.count_documents(query)
            
            skip = (page - 1) * page_size
            cursor = self.collection.find(query).sort("created_at", -1).skip(skip).limit(page_size)
            
            courses = []
            async for doc in cursor:
                courses.append(self._to_response(doc, user_id))
            
            return CourseListResponse(
                courses=courses,
                total=total,
                page=page,
                page_size=page_size
            )
            
        except Exception as e:
            logger.error(f"Failed to list courses: {e}")
            return CourseListResponse(courses=[], total=0)
    
    async def update_course(
        self,
        course_id: str,
        request: CourseUpdateRequest,
        instructor_id: str
    ) -> Optional[CourseResponse]:
        """
        Update a course.
        
        Args:
            course_id: Course ID
            request: Update data
            instructor_id: Must match course instructor
            
        Returns:
            Updated course or None
        """
        try:
            existing = await self.collection.find_one({
                "_id": ObjectId(course_id),
                "instructor_id": instructor_id
            })
            
            if not existing:
                return None
            
            update_data = {"updated_at": datetime.utcnow()}
            
            if request.title is not None:
                update_data["title"] = request.title
            if request.description is not None:
                update_data["description"] = request.description
            if request.category is not None:
                update_data["category"] = request.category
            if request.difficulty is not None:
                update_data["difficulty"] = request.difficulty.value
            if request.thumbnail_url is not None:
                update_data["thumbnail_url"] = request.thumbnail_url
            if request.class_level is not None:
                update_data["class_level"] = request.class_level
            if request.status is not None:
                update_data["status"] = request.status.value
            
            await self.collection.update_one(
                {"_id": ObjectId(course_id)},
                {"$set": update_data}
            )
            
            updated = await self.collection.find_one({"_id": ObjectId(course_id)})
            return self._to_response(updated)
            
        except Exception as e:
            logger.error(f"Failed to update course {course_id}: {e}")
            return None
    
    async def delete_course(self, course_id: str, instructor_id: str) -> bool:
        """Delete a course (soft delete by archiving)."""
        try:
            result = await self.collection.update_one(
                {"_id": ObjectId(course_id), "instructor_id": instructor_id},
                {"$set": {"status": CourseStatus.ARCHIVED.value, "updated_at": datetime.utcnow()}}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Failed to delete course {course_id}: {e}")
            return False
    
    async def publish_course(self, course_id: str, instructor_id: str) -> Optional[CourseResponse]:
        """Publish a draft course."""
        try:
            existing = await self.collection.find_one({
                "_id": ObjectId(course_id),
                "instructor_id": instructor_id,
                "status": CourseStatus.DRAFT.value
            })
            
            if not existing:
                return None
            
            await self.collection.update_one(
                {"_id": ObjectId(course_id)},
                {"$set": {"status": CourseStatus.PUBLISHED.value, "updated_at": datetime.utcnow()}}
            )
            
            updated = await self.collection.find_one({"_id": ObjectId(course_id)})
            logger.info(f"Course published: {updated['title']}")
            return self._to_response(updated)
            
        except Exception as e:
            logger.error(f"Failed to publish course {course_id}: {e}")
            return None
    
    async def add_module(
        self,
        course_id: str,
        request: ModuleCreateRequest,
        instructor_id: str
    ) -> Optional[Module]:
        """Add a module to a course."""
        try:
            course = await self.collection.find_one({
                "_id": ObjectId(course_id),
                "instructor_id": instructor_id
            })
            
            if not course:
                return None
            
            module_id = str(uuid.uuid4())
            order = request.order if request.order is not None else len(course.get("modules", []))
            
            module = {
                "id": module_id,
                "title": request.title,
                "description": request.description,
                "order": order,
                "content_items": [],
                "is_published": True
            }
            
            await self.collection.update_one(
                {"_id": ObjectId(course_id)},
                {
                    "$push": {"modules": module},
                    "$set": {"updated_at": datetime.utcnow()}
                }
            )
            
            return Module(**module)
            
        except Exception as e:
            logger.error(f"Failed to add module to course {course_id}: {e}")
            return None
    
    async def add_content_to_module(
        self,
        course_id: str,
        module_id: str,
        request: ContentItemCreateRequest,
        instructor_id: str
    ) -> Optional[ContentItem]:
        """Add content item to a module."""
        try:
            course = await self.collection.find_one({
                "_id": ObjectId(course_id),
                "instructor_id": instructor_id
            })
            
            if not course:
                return None
            
            module_idx = None
            for idx, mod in enumerate(course.get("modules", [])):
                if mod.get("id") == module_id:
                    module_idx = idx
                    break
            
            if module_idx is None:
                return None
            
            content_id = str(uuid.uuid4())
            order = request.order if request.order is not None else len(course["modules"][module_idx].get("content_items", []))
            
            content_item = {
                "id": content_id,
                "type": request.type.value,
                "title": request.title,
                "description": request.description,
                "url": request.url,
                "content": request.content,
                "duration_minutes": request.duration_minutes,
                "order": order,
                "is_required": request.is_required
            }
            
            await self.collection.update_one(
                {"_id": ObjectId(course_id)},
                {
                    "$push": {f"modules.{module_idx}.content_items": content_item},
                    "$set": {"updated_at": datetime.utcnow()}
                }
            )
            
            return ContentItem(**content_item)
            
        except Exception as e:
            logger.error(f"Failed to add content to module {module_id}: {e}")
            return None
    
    async def enroll_student(self, course_id: str, student_id: str) -> EnrollmentResponse:
        """Enroll a student in a course."""
        try:
            course = await self.collection.find_one({
                "_id": ObjectId(course_id),
                "status": CourseStatus.PUBLISHED.value
            })
            
            if not course:
                return EnrollmentResponse(success=False, message="Course not found or not published")
            
            if student_id in course.get("enrolled_students", []):
                return EnrollmentResponse(success=True, message="Already enrolled", enrolled=True)
            
            await self.collection.update_one(
                {"_id": ObjectId(course_id)},
                {
                    "$addToSet": {"enrolled_students": student_id},
                    "$inc": {"total_enrollments": 1}
                }
            )
            
            logger.info(f"Student {student_id} enrolled in course {course_id}")
            return EnrollmentResponse(success=True, message="Enrolled successfully", enrolled=True)
            
        except Exception as e:
            logger.error(f"Failed to enroll student in course {course_id}: {e}")
            return EnrollmentResponse(success=False, message="Enrollment failed")
    
    async def unenroll_student(self, course_id: str, student_id: str) -> EnrollmentResponse:
        """Remove a student from a course."""
        try:
            result = await self.collection.update_one(
                {"_id": ObjectId(course_id)},
                {
                    "$pull": {"enrolled_students": student_id},
                    "$inc": {"total_enrollments": -1}
                }
            )
            
            if result.modified_count > 0:
                return EnrollmentResponse(success=True, message="Unenrolled successfully", enrolled=False)
            return EnrollmentResponse(success=False, message="Not enrolled in this course")
            
        except Exception as e:
            logger.error(f"Failed to unenroll student from course {course_id}: {e}")
            return EnrollmentResponse(success=False, message="Unenrollment failed")
    
    async def rate_course(
        self,
        course_id: str,
        student_id: str,
        rating: int,
        review: str = None
    ) -> bool:
        """Add or update a course rating."""
        try:
            course = await self.collection.find_one({"_id": ObjectId(course_id)})
            
            if not course:
                return False
            
            if student_id not in course.get("enrolled_students", []):
                return False
            
            ratings = [r for r in course.get("ratings", []) if r.get("student_id") != student_id]
            
            ratings.append({
                "student_id": student_id,
                "rating": rating,
                "review": review,
                "created_at": datetime.utcnow()
            })
            
            avg_rating = sum(r["rating"] for r in ratings) / len(ratings) if ratings else 0
            
            await self.collection.update_one(
                {"_id": ObjectId(course_id)},
                {"$set": {"ratings": ratings, "average_rating": round(avg_rating, 2)}}
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to rate course {course_id}: {e}")
            return False
    
    def _to_response(self, doc: dict, user_id: str = None) -> CourseResponse:
        """Convert MongoDB document to CourseResponse."""
        return CourseResponse(
            id=str(doc["_id"]),
            title=doc["title"],
            description=doc["description"],
            category=doc["category"],
            difficulty=doc["difficulty"],
            thumbnail_url=doc.get("thumbnail_url"),
            class_level=doc["class_level"],
            instructor_id=doc["instructor_id"],
            instructor_name=doc["instructor_name"],
            status=doc["status"],
            module_count=len(doc.get("modules", [])),
            total_content_items=sum(len(m.get("content_items", [])) for m in doc.get("modules", [])),
            average_rating=doc.get("average_rating", 0.0),
            total_enrollments=doc.get("total_enrollments", 0),
            is_enrolled=user_id in doc.get("enrolled_students", []) if user_id else False,
            created_at=doc.get("created_at", datetime.utcnow()),
            updated_at=doc.get("updated_at", datetime.utcnow())
        )
    
    def _to_detail_response(self, doc: dict, user_id: str = None) -> CourseDetailResponse:
        """Convert MongoDB document to CourseDetailResponse with modules."""
        base = self._to_response(doc, user_id)
        
        modules = []
        for mod in doc.get("modules", []):
            content_items = [ContentItem(**item) for item in mod.get("content_items", [])]
            modules.append(Module(
                id=mod.get("id"),
                title=mod["title"],
                description=mod.get("description"),
                order=mod.get("order", 0),
                content_items=content_items,
                is_published=mod.get("is_published", True)
            ))
        
        return CourseDetailResponse(
            **base.model_dump(),
            modules=modules
        )

course_service = CourseService()
