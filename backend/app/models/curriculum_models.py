"""
Curriculum Models - Subjects, Chapters, and Topics Management
Centralized structure for academic content organization
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

class Topic(BaseModel):
    """Individual topic within a chapter"""
    topic_id: str = Field(..., description="Unique topic identifier")
    topic_name: str = Field(..., description="Topic name")
    description: Optional[str] = Field("", description="Topic description")
    page_range: Optional[str] = Field("", description="Page range in textbook (e.g., '10-15')")
    learning_objectives: List[str] = Field(default_factory=list, description="Learning objectives")
    keywords: List[str] = Field(default_factory=list, description="Key terms and concepts")
    estimated_time_minutes: Optional[int] = Field(45, description="Estimated study time in minutes")
    difficulty_level: Optional[str] = Field("medium", description="easy, medium, hard")
    prerequisites: List[str] = Field(default_factory=list, description="Required prior topics")
    order: int = Field(1, description="Display order within chapter")
    is_active: bool = Field(True, description="Is topic active/visible")
    question_count: Optional[int] = Field(0, description="Number of questions available")

class Chapter(BaseModel):
    """Chapter within a subject"""
    chapter_id: str = Field(..., description="Unique chapter identifier")
    chapter_number: int = Field(..., description="Chapter number")
    chapter_name: str = Field(..., description="Chapter title")
    description: Optional[str] = Field("", description="Chapter overview")
    summary: Optional[str] = Field("", description="Admin-written chapter summary (HTML rich text)")
    topics: List[Topic] = Field(default_factory=list, description="Topics in this chapter")
    pdf_url: Optional[str] = Field("", description="Link to chapter PDF")
    video_url: Optional[str] = Field("", description="Link to chapter video")
    total_pages: Optional[int] = Field(0, description="Total pages in chapter")
    order: int = Field(1, description="Display order within subject")
    is_active: bool = Field(True, description="Is chapter active/visible")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Subject(BaseModel):
    """Subject with hierarchical chapter and topic structure"""
    subject_id: str = Field(..., description="Unique subject identifier")
    subject_name: str = Field(..., description="Subject name (e.g., Mathematics)")
    class_level: int = Field(..., description="Class level (5-12)")
    board: Optional[str] = Field("CBSE", description="Educational board")
    description: Optional[str] = Field("", description="Subject description")
    icon: Optional[str] = Field("📚", description="Emoji or icon for display")
    color: Optional[str] = Field("#3B82F6", description="Theme color for UI")
    chapters: List[Chapter] = Field(default_factory=list, description="Chapters in this subject")
    total_topics: Optional[int] = Field(0, description="Total topic count")
    total_chapters: Optional[int] = Field(0, description="Total chapter count")
    is_active: bool = Field(True, description="Is subject active/visible")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class SubjectDocument(BaseModel):
    """MongoDB document for subjects collection"""
    id: Optional[str] = Field(alias="_id")
    subject_id: str
    subject_name: str
    class_level: int
    board: str = "CBSE"
    description: str = ""
    icon: str = "📚"
    color: str = "#3B82F6"
    chapters: List[dict] = []
    total_topics: int = 0
    total_chapters: int = 0
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class CreateSubjectRequest(BaseModel):
    """Request to create a new subject"""
    subject_name: str = Field(..., min_length=1, max_length=100)
    class_level: int = Field(..., ge=5, le=12)
    board: str = Field(default="CBSE")
    description: Optional[str] = ""
    icon: Optional[str] = "📚"
    color: Optional[str] = "#3B82F6"

class UpdateSubjectRequest(BaseModel):
    """Request to update subject details"""
    subject_name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None

class CreateChapterRequest(BaseModel):
    """Request to create a new chapter"""
    chapter_number: int = Field(..., ge=1)
    chapter_name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = ""
    pdf_url: Optional[str] = ""
    video_url: Optional[str] = ""
    total_pages: Optional[int] = 0

class UpdateChapterRequest(BaseModel):
    """Request to update chapter details"""
    chapter_name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    summary: Optional[str] = None
    pdf_url: Optional[str] = None
    video_url: Optional[str] = None
    total_pages: Optional[int] = None
    order: Optional[int] = None
    is_active: Optional[bool] = None

class CreateTopicRequest(BaseModel):
    """Request to create a new topic"""
    topic_name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = ""
    page_range: Optional[str] = ""
    learning_objectives: List[str] = Field(default_factory=list)
    keywords: List[str] = Field(default_factory=list)
    estimated_time_minutes: Optional[int] = 45
    difficulty_level: Optional[str] = "medium"
    prerequisites: List[str] = Field(default_factory=list)

class UpdateTopicRequest(BaseModel):
    """Request to update topic details"""
    topic_name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    page_range: Optional[str] = None
    learning_objectives: Optional[List[str]] = None
    keywords: Optional[List[str]] = None
    estimated_time_minutes: Optional[int] = None
    difficulty_level: Optional[str] = None
    prerequisites: Optional[List[str]] = None
    order: Optional[int] = None
    is_active: Optional[bool] = None

class SubjectSummary(BaseModel):
    """Summary of a subject for list views"""
    subject_id: str
    subject_name: str
    class_level: int
    icon: str
    color: str
    total_chapters: int
    total_topics: int
    is_active: bool

class ChapterSummary(BaseModel):
    """Summary of a chapter for list views"""
    chapter_id: str
    chapter_number: int
    chapter_name: str
    total_topics: int
    pdf_url: Optional[str] = ""
    is_active: bool

class TopicSummary(BaseModel):
    """Summary of a topic for list views"""
    topic_id: str
    topic_name: str
    description: str
    page_range: Optional[str] = ""
    difficulty_level: str
    question_count: int
    is_active: bool

class ExtractedTopic(BaseModel):
    """Topic extracted from PDF/image by AI"""
    topic_name: str
    page_range: Optional[str] = ""
    description: Optional[str] = ""

class ExtractedChapter(BaseModel):
    """Chapter extracted from PDF/image by AI"""
    chapter_number: int
    chapter_name: str
    author: Optional[str] = ""
    page_number: Optional[int] = None
    topics: List[ExtractedTopic] = Field(default_factory=list)

class PendingCurriculumItem(BaseModel):
    """Pending curriculum item awaiting admin approval"""
    pending_id: str = Field(..., description="Unique pending item identifier")
    subject_name: str = Field(..., description="Subject name")
    class_level: int = Field(..., description="Class level (5-12)")
    board: str = Field(default="CBSE", description="Educational board")
    extracted_chapters: List[ExtractedChapter] = Field(default_factory=list)
    source_file_name: str = Field(..., description="Original file name")
    source_file_url: Optional[str] = Field("", description="URL of uploaded file if stored")
    extraction_method: str = Field(default="ai", description="'ai' or 'manual'")
    status: str = Field(default="pending", description="pending, approved, rejected")
    uploaded_by: str = Field(..., description="Admin user who uploaded")
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    reviewed_by: Optional[str] = Field(None, description="Admin who reviewed")
    reviewed_at: Optional[datetime] = Field(None, description="Review timestamp")
    rejection_reason: Optional[str] = Field("", description="Reason if rejected")

class UploadCurriculumRequest(BaseModel):
    """Request to upload PDF/image for curriculum extraction"""
    subject_name: str = Field(..., min_length=1, max_length=100)
    class_level: int = Field(..., ge=5, le=12)
    board: str = Field(default="CBSE")

class ApprovePendingItemRequest(BaseModel):
    """Request to approve or reject a pending curriculum item"""
    action: str = Field(..., description="'approve' or 'reject'")
    rejection_reason: Optional[str] = Field("", description="Required if action is reject")
    subject_name_override: Optional[str] = None
    icon: Optional[str] = "📚"
    color: Optional[str] = "#3B82F6"
