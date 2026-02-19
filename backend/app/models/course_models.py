"""
Course Management Models

Pydantic models for courses, modules, and content items.
Used by teachers to create structured learning content.
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum

class DifficultyLevel(str, Enum):
    """Course difficulty levels."""
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"

class CourseStatus(str, Enum):
    """Course publication status."""
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"

class ContentType(str, Enum):
    """Types of content that can be added to modules."""
    VIDEO = "video"
    PDF = "pdf"
    DOCUMENT = "document"
    QUIZ = "quiz"
    ASSIGNMENT = "assignment"
    TEXT = "text"

class ContentItem(BaseModel):
    """Individual content item within a module."""
    id: Optional[str] = None
    type: ContentType
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    url: Optional[str] = None
    content: Optional[str] = None
    duration_minutes: int = Field(default=0, ge=0)
    order: int = Field(default=0, ge=0)
    is_required: bool = True
    assessment_id: Optional[str] = None

class Module(BaseModel):
    """Course module containing content items."""
    id: Optional[str] = None
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    order: int = Field(default=0, ge=0)
    content_items: List[ContentItem] = Field(default_factory=list)
    is_published: bool = True

class CourseRating(BaseModel):
    """Student rating for a course."""
    student_id: str
    rating: int = Field(..., ge=1, le=5)
    review: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CourseCreateRequest(BaseModel):
    """Request model for creating a new course."""
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=10)
    category: str = Field(..., description="Subject category")
    difficulty: DifficultyLevel = DifficultyLevel.BEGINNER
    thumbnail_url: Optional[str] = None
    class_level: int = Field(..., ge=5, le=12, description="Target class level")

class CourseUpdateRequest(BaseModel):
    """Request model for updating a course."""
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = None
    difficulty: Optional[DifficultyLevel] = None
    thumbnail_url: Optional[str] = None
    class_level: Optional[int] = Field(None, ge=5, le=12)
    status: Optional[CourseStatus] = None

class ModuleCreateRequest(BaseModel):
    """Request model for adding a module to a course."""
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    order: Optional[int] = None

class ContentItemCreateRequest(BaseModel):
    """Request model for adding content to a module."""
    type: ContentType
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    url: Optional[str] = None
    content: Optional[str] = None
    duration_minutes: int = Field(default=0, ge=0)
    order: Optional[int] = None
    is_required: bool = True

class EnrollmentRequest(BaseModel):
    """Request for student enrollment."""
    course_id: str

class RatingRequest(BaseModel):
    """Request for rating a course."""
    rating: int = Field(..., ge=1, le=5)
    review: Optional[str] = None

class CourseInDB(BaseModel):
    """Course as stored in MongoDB."""
    id: Optional[str] = None
    title: str
    description: str
    category: str
    difficulty: DifficultyLevel
    thumbnail_url: Optional[str] = None
    class_level: int
    instructor_id: str
    instructor_name: str
    status: CourseStatus = CourseStatus.DRAFT
    modules: List[Module] = Field(default_factory=list)
    enrolled_students: List[str] = Field(default_factory=list)
    ratings: List[CourseRating] = Field(default_factory=list)
    average_rating: float = 0.0
    total_enrollments: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True

class CourseResponse(BaseModel):
    """Course response for API."""
    id: str
    title: str
    description: str
    category: str
    difficulty: str
    thumbnail_url: Optional[str] = None
    class_level: int
    instructor_id: str
    instructor_name: str
    status: str
    module_count: int = 0
    total_content_items: int = 0
    average_rating: float = 0.0
    total_enrollments: int = 0
    is_enrolled: bool = False
    created_at: datetime
    updated_at: datetime

class CourseDetailResponse(CourseResponse):
    """Detailed course response including modules."""
    modules: List[Module] = []

class CourseListResponse(BaseModel):
    """Response for listing courses."""
    courses: List[CourseResponse]
    total: int
    page: int = 1
    page_size: int = 20

class EnrollmentResponse(BaseModel):
    """Response for enrollment action."""
    success: bool
    message: str
    enrolled: bool = False
