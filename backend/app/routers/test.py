"""
Test Router - Topic-based AI Tests and Staff Test management endpoints
Production-grade implementation with pre-generated question bank.

Key Features:
1. Topic-based test selection (Subject → Chapter → Topic)
2. Pre-generated questions from question bank (minimizes LLM calls)
3. Recommendations based on student weak areas
4. RAG-based answer evaluation
5. Real-time performance tracking
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
from app.db.mongo import mongodb
from app.services.topic_question_bank_service import topic_question_bank_service
from app.services.rag_evaluation_service import rag_evaluation_service
from bson import ObjectId
import logging
import os
import uuid

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/test",
    tags=["Tests"]
)

# Upload directory for test files
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "tests")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ==================== SCHEMAS ====================

# --- Subject/Chapter/Topic Selection ---

class SubjectResponse(BaseModel):
    """Subject info for selection."""
    subject: str
    total_chapters: int
    total_questions: int


class ChapterInfo(BaseModel):
    """Chapter info with topics."""
    chapter_number: int
    chapter_name: str
    total_topics: int
    total_questions: int


class TopicInfo(BaseModel):
    """Topic info with student performance."""
    topic_id: str
    topic_name: str
    topic_description: Optional[str] = ""
    page_range: str
    total_questions: int
    difficulty_distribution: Dict = {}
    student_score: Optional[float] = None
    tests_taken: int = 0
    trend: str = "stable"
    is_weak: bool = False
    is_recommended: bool = False


class RecommendationItem(BaseModel):
    """Topic recommendation for student."""
    topic_id: str
    topic_name: str
    chapter: int
    chapter_name: Optional[str] = None
    score: Optional[float] = None
    is_new: bool = False
    reason: str = ""


# --- Test Session ---

class StartTestRequest(BaseModel):
    """Request to start a topic-based test."""
    student_id: str = Field(..., description="Student ID")
    class_level: int = Field(default=10, description="Class level")
    subject: str = Field(..., description="Subject name")
    chapter_number: int = Field(..., description="Chapter number")
    topic_id: str = Field(..., description="Topic ID")
    num_questions: int = Field(default=5, ge=1, le=15, description="Number of questions")
    difficulty: str = Field(default="mixed", description="easy/medium/hard/mixed")


class TestQuestionItem(BaseModel):
    """Question served in test."""
    question_number: int
    question_id: str
    question_text: str
    difficulty: str
    question_type: str
    marks: int
    time_estimate: int


class StartTestResponse(BaseModel):
    """Response after starting a test."""
    session_id: str
    topic_id: str
    topic_name: str
    questions: List[TestQuestionItem]
    total_questions: int
    time_limit_minutes: int
    started_at: str


class SubmitAnswerRequest(BaseModel):
    """Submit a single answer."""
    session_id: str
    question_id: str
    question_number: int
    answer: str


class CompleteTestRequest(BaseModel):
    """Complete test and get evaluation."""
    session_id: str
    student_id: str


class EvaluationItem(BaseModel):
    """Single question evaluation."""
    question_id: str
    question_text: str
    student_answer: str
    is_correct: bool
    score: float
    max_score: float
    feedback: str
    correct_answer: str


class CompleteTestResponse(BaseModel):
    """Test completion response with evaluation."""
    session_id: str
    score: float
    total_questions: int
    correct_answers: int
    evaluations: List[EvaluationItem]
    feedback: str
    strengths: List[str]
    improvements: List[str]
    topics_to_review: List[str]
    completed_at: str


# --- Staff Tests ---

class StaffTestItem(BaseModel):
    """Staff test response."""
    id: str
    subject: str
    chapter: int
    title: str
    description: Optional[str] = None
    due_date: Optional[str] = None
    max_score: int = 100
    question_paper_url: Optional[str] = None
    created_by: str = "Staff"
    created_at: str
    submission_status: Optional[str] = None
    score: Optional[int] = None


# --- Analytics ---

class StudentAnalytics(BaseModel):
    """Student analytics data."""
    total_tests_taken: int
    overall_average: float
    best_score: float
    topics_strong: int
    topics_moderate: int
    topics_weak: int
    weak_topics: List[Dict]
    performance_history: List[Dict]
    topic_breakdown: List[Dict]
    recommendations: List[Dict]


# ==================== SUBJECT/CHAPTER/TOPIC SELECTION ====================

@router.get("/subjects/{class_level}", response_model=List[SubjectResponse])
async def get_available_subjects(class_level: int):
    """
    Get all subjects available for a class level.
    This reads from the question bank to show only subjects with pre-generated questions.
    """
    try:
        subjects = await topic_question_bank_service.get_available_subjects(class_level)
        return [SubjectResponse(**s) for s in subjects]
    except Exception as e:
        logger.error(f"Error fetching subjects: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/chapters/{class_level}/{subject}", response_model=List[ChapterInfo])
async def get_chapters_for_subject(class_level: int, subject: str):
    """
    Get all chapters for a subject with topic counts.
    """
    try:
        chapters = await topic_question_bank_service.get_chapters_for_subject(class_level, subject)
        return [ChapterInfo(
            chapter_number=ch["chapter_number"],
            chapter_name=ch["chapter_name"],
            total_topics=ch.get("total_topics", 0),
            total_questions=ch.get("total_questions", 0)
        ) for ch in chapters]
    except Exception as e:
        logger.error(f"Error fetching chapters: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/topics/{class_level}/{subject}/{chapter}", response_model=List[TopicInfo])
async def get_topics_for_chapter(
    class_level: int,
    subject: str,
    chapter: int,
    student_id: Optional[str] = Query(None, description="Student ID for personalized recommendations")
):
    """
    Get all topics for a chapter with student performance data.
    Returns recommendations based on weak areas.
    """
    try:
        topics = await topic_question_bank_service.get_topics_for_chapter(
            class_level=class_level,
            subject=subject,
            chapter_number=chapter,
            student_id=student_id
        )
        return [TopicInfo(**t) for t in topics]
    except Exception as e:
        logger.error(f"Error fetching topics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recommendations/{class_level}/{subject}/{student_id}", response_model=List[RecommendationItem])
async def get_topic_recommendations(
    class_level: int,
    subject: str,
    student_id: str,
    limit: int = Query(default=5, ge=1, le=10)
):
    """
    Get personalized topic recommendations for a student.
    Based on weak areas and untested topics.
    """
    try:
        recommendations = await topic_question_bank_service.get_student_recommendations(
            student_id=student_id,
            class_level=class_level,
            subject=subject,
            limit=limit
        )
        
        # Add reason for recommendation
        result = []
        for rec in recommendations:
            if rec.get("is_new"):
                reason = "New topic - not yet attempted"
            elif rec.get("score", 100) < 40:
                reason = f"Needs urgent attention (Score: {rec.get('score', 0)}%)"
            elif rec.get("score", 100) < 60:
                reason = f"Room for improvement (Score: {rec.get('score', 0)}%)"
            else:
                reason = "Recommended for practice"
            
            result.append(RecommendationItem(
                topic_id=rec.get("topic_id", ""),
                topic_name=rec.get("topic_name", ""),
                chapter=rec.get("chapter", 0),
                chapter_name=rec.get("chapter_name"),
                score=rec.get("score"),
                is_new=rec.get("is_new", False),
                reason=reason
            ))
        
        return result
    except Exception as e:
        logger.error(f"Error fetching recommendations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== AI TEST SESSION ENDPOINTS ====================

@router.post("/start", response_model=StartTestResponse)
async def start_test(request: StartTestRequest):
    """
    Start a topic-based test.
    Fetches pre-generated questions from the question bank (NO Gemini call).
    """
    try:
        # Get questions from question bank
        questions, topic_name = await topic_question_bank_service.get_questions_for_test(
            class_level=request.class_level,
            subject=request.subject,
            chapter_number=request.chapter_number,
            topic_id=request.topic_id,
            num_questions=request.num_questions,
            difficulty=request.difficulty
        )
        
        if not questions:
            raise HTTPException(
                status_code=404,
                detail="No questions found for this topic. Please try another topic."
            )
        
        # Create test session
        session_id = str(uuid.uuid4())
        session_doc = {
            "session_id": session_id,
            "student_id": request.student_id,
            "class_level": request.class_level,
            "subject": request.subject,
            "chapter_number": request.chapter_number,
            "topic_id": request.topic_id,
            "topic_name": topic_name,
            "num_questions": len(questions),
            "difficulty": request.difficulty,
            "questions_served": questions,
            "answers": [],
            "status": "started",
            "started_at": datetime.utcnow(),
            "time_limit_minutes": max(10, len(questions) * 2)  # 2 min per question
        }
        
        await mongodb.db.test_sessions.insert_one(session_doc)
        
        # Format response
        formatted_questions = [
            TestQuestionItem(
                question_number=q["question_number"],
                question_id=q["question_id"],
                question_text=q["question_text"],
                difficulty=q["difficulty"],
                question_type=q["question_type"],
                marks=q["marks"],
                time_estimate=q["time_estimate"]
            )
            for q in questions
        ]
        
        logger.info(f"✅ Started test session {session_id} with {len(questions)} questions")
        
        return StartTestResponse(
            session_id=session_id,
            topic_id=request.topic_id,
            topic_name=topic_name,
            questions=formatted_questions,
            total_questions=len(questions),
            time_limit_minutes=session_doc["time_limit_minutes"],
            started_at=session_doc["started_at"].isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting test: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/answer")
async def submit_answer(request: SubmitAnswerRequest):
    """
    Submit a single answer during test.
    Stores answer for later evaluation.
    """
    try:
        result = await mongodb.db.test_sessions.update_one(
            {"session_id": request.session_id},
            {
                "$push": {
                    "answers": {
                        "question_id": request.question_id,
                        "question_number": request.question_number,
                        "answer": request.answer,
                        "submitted_at": datetime.utcnow().isoformat()
                    }
                },
                "$set": {"status": "in_progress"}
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {"status": "success", "message": "Answer recorded"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting answer: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/complete", response_model=CompleteTestResponse)
async def complete_test(request: CompleteTestRequest):
    """
    Complete test and get AI evaluation.
    Uses RAG to retrieve context and evaluate answers.
    """
    try:
        # Get session
        session = await mongodb.db.test_sessions.find_one({"session_id": request.session_id})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if session.get("status") == "completed":
            # Return cached result
            return CompleteTestResponse(
                session_id=request.session_id,
                score=session.get("score", 0),
                total_questions=len(session.get("questions_served", [])),
                correct_answers=session.get("correct_count", 0),
                evaluations=[EvaluationItem(**e) for e in session.get("evaluation_details", [])],
                feedback=session.get("overall_feedback", {}).get("summary", ""),
                strengths=session.get("overall_feedback", {}).get("strengths", []),
                improvements=session.get("overall_feedback", {}).get("improvements", []),
                topics_to_review=session.get("topics_to_review", []),
                completed_at=session.get("completed_at", datetime.utcnow()).isoformat()
            )
        
        # Evaluate using RAG
        evaluation_result = await rag_evaluation_service.evaluate_test_session(
            session_id=request.session_id,
            student_id=request.student_id,
            class_level=session.get("class_level", 10),
            subject=session.get("subject", ""),
            chapter_number=session.get("chapter_number", 1),
            topic_id=session.get("topic_id", ""),
            topic_name=session.get("topic_name", ""),
            questions=session.get("questions_served", []),
            answers=session.get("answers", [])
        )
        
        return CompleteTestResponse(
            session_id=evaluation_result["session_id"],
            score=evaluation_result["score"],
            total_questions=evaluation_result["total_questions"],
            correct_answers=evaluation_result["correct_answers"],
            evaluations=[EvaluationItem(**e) for e in evaluation_result["evaluations"]],
            feedback=evaluation_result["feedback"],
            strengths=evaluation_result["strengths"],
            improvements=evaluation_result["improvements"],
            topics_to_review=evaluation_result["topics_to_review"],
            completed_at=evaluation_result["completed_at"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing test: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== STAFF TEST ENDPOINTS ====================

@router.get("/staff-tests", response_model=List[StaffTestItem])
async def get_staff_tests(
    subject: Optional[str] = Query(None),
    chapter: Optional[int] = Query(None),
    student_id: Optional[str] = Query(None)
):
    """Get available staff tests with optional filtering."""
    try:
        query = {}
        if subject:
            query["subject"] = {"$regex": subject, "$options": "i"}
        if chapter:
            query["chapter"] = chapter
        
        tests = await mongodb.db.staff_tests.find(query).to_list(100)
        
        # Get submission status for student if provided
        submissions = {}
        if student_id:
            student_submissions = await mongodb.db.test_submissions.find(
                {"student_id": student_id}
            ).to_list(1000)
            for sub in student_submissions:
                test_id = sub.get("test_id")
                submissions[test_id] = {
                    "status": sub.get("status", "pending"),
                    "score": sub.get("score")
                }
        
        response = []
        for test in tests:
            test_id = str(test["_id"])
            submission = submissions.get(test_id, {})
            response.append(StaffTestItem(
                id=test_id,
                subject=test.get("subject", ""),
                chapter=test.get("chapter", 1),
                title=test.get("title", ""),
                description=test.get("description"),
                due_date=test.get("due_date"),
                max_score=test.get("max_score", 100),
                question_paper_url=f"/api/test/staff-tests/{test_id}/download",
                created_by=test.get("created_by", "Staff"),
                created_at=test.get("created_at", datetime.now().isoformat()),
                submission_status=submission.get("status"),
                score=submission.get("score")
            ))
        
        return response
    except Exception as e:
        logger.error(f"Error fetching staff tests: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/staff-tests")
async def create_staff_test(
    subject: str = Form(...),
    chapter: int = Form(...),
    class_level: int = Form(10),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    due_date: Optional[str] = Form(None),
    max_score: int = Form(100),
    created_by: str = Form("Staff"),
    question_paper: UploadFile = File(...)
):
    """Create a new staff test with question paper upload."""
    try:
        # Validate file
        if not question_paper.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
        # Generate unique filename
        file_id = str(uuid.uuid4())
        filename = f"{file_id}_{question_paper.filename}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        # Save file
        content = await question_paper.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Create test record
        test_doc = {
            "subject": subject,
            "chapter": chapter,
            "class_level": class_level,
            "title": title,
            "description": description,
            "due_date": due_date,
            "max_score": max_score,
            "created_by": created_by,
            "question_paper_filename": filename,
            "question_paper_path": file_path,
            "created_at": datetime.now().isoformat()
        }
        
        result = await mongodb.db.staff_tests.insert_one(test_doc)
        
        return {
            "id": str(result.inserted_id),
            "title": title,
            "message": "Staff test created successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating staff test: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/staff-tests/{test_id}/download")
async def download_question_paper(test_id: str):
    """Download question paper PDF."""
    try:
        test = await mongodb.db.staff_tests.find_one({"_id": ObjectId(test_id)})
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")
        
        file_path = test.get("question_paper_path")
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Question paper not found")
        
        return FileResponse(
            file_path,
            media_type="application/pdf",
            filename=test.get("question_paper_filename", "question_paper.pdf")
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading question paper: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/staff-tests/{test_id}/submit")
async def submit_answer_sheet(
    test_id: str,
    student_id: str = Form(...),
    answer_sheet: UploadFile = File(...)
):
    """Submit answer sheet for a staff test."""
    try:
        # Validate test exists
        test = await mongodb.db.staff_tests.find_one({"_id": ObjectId(test_id)})
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")
        
        # Validate file
        if not answer_sheet.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
        # Check for existing submission
        existing = await mongodb.db.test_submissions.find_one({
            "test_id": test_id,
            "student_id": student_id
        })
        
        # Generate unique filename
        file_id = str(uuid.uuid4())
        filename = f"answer_{file_id}_{answer_sheet.filename}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        # Save file
        content = await answer_sheet.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        if existing:
            # Update existing submission
            await mongodb.db.test_submissions.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "answer_sheet_filename": filename,
                    "answer_sheet_path": file_path,
                    "status": "submitted",
                    "submitted_at": datetime.now().isoformat()
                }}
            )
            submission_id = str(existing["_id"])
        else:
            # Create new submission
            submission_doc = {
                "test_id": test_id,
                "student_id": student_id,
                "answer_sheet_filename": filename,
                "answer_sheet_path": file_path,
                "status": "submitted",
                "submitted_at": datetime.now().isoformat()
            }
            result = await mongodb.db.test_submissions.insert_one(submission_doc)
            submission_id = str(result.inserted_id)
        
        return {
            "submission_id": submission_id,
            "status": "submitted",
            "message": "Answer sheet submitted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting answer sheet: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ANALYTICS ENDPOINTS ====================

@router.get("/analytics/{student_id}", response_model=StudentAnalytics)
async def get_student_analytics(
    student_id: str,
    class_level: int = Query(default=10),
    subject: Optional[str] = Query(None)
):
    """Get comprehensive test analytics for a student."""
    try:
        # Get student subject progress
        query = {"student_id": student_id, "class_level": class_level}
        if subject:
            query["subject"] = subject
        
        progress_docs = await mongodb.db.student_subject_progress.find(query).to_list(100)
        
        if not progress_docs:
            # Return empty analytics
            return StudentAnalytics(
                total_tests_taken=0,
                overall_average=0.0,
                best_score=0.0,
                topics_strong=0,
                topics_moderate=0,
                topics_weak=0,
                weak_topics=[],
                performance_history=[],
                topic_breakdown=[],
                recommendations=[]
            )
        
        # Aggregate stats
        total_tests = sum(p.get("total_tests_taken", 0) for p in progress_docs)
        all_averages = [p.get("overall_average", 0) for p in progress_docs if p.get("total_tests_taken", 0) > 0]
        overall_avg = sum(all_averages) / len(all_averages) if all_averages else 0
        
        topics_strong = sum(p.get("topics_strong", 0) for p in progress_docs)
        topics_moderate = sum(p.get("topics_moderate", 0) for p in progress_docs)
        topics_weak = sum(p.get("topics_weak", 0) for p in progress_docs)
        
        # Collect weak topics
        weak_topics = []
        for p in progress_docs:
            weak_topics.extend(p.get("weak_topics", [])[:5])
        weak_topics.sort(key=lambda x: x.get("score", 0))
        
        # Get performance history from topic performances
        perf_docs = await mongodb.db.student_topic_performance.find(
            {"student_id": student_id}
        ).sort("last_attempted", -1).to_list(100)
        
        # Build performance history
        performance_history = []
        for p in perf_docs[:20]:
            for h in p.get("score_history", [])[-3:]:
                performance_history.append({
                    "topic": p.get("topic_name", ""),
                    "score": h.get("score", 0),
                    "date": h.get("date", "")
                })
        
        # Sort by date
        performance_history.sort(key=lambda x: x.get("date", ""), reverse=True)
        performance_history = performance_history[:15]
        
        # Build topic breakdown
        topic_breakdown = [
            {
                "topic": p.get("topic_name", ""),
                "score": p.get("average_score", 0),
                "tests": p.get("tests_taken", 0),
                "trend": p.get("improvement_trend", "stable")
            }
            for p in perf_docs
        ]
        
        # Get best score
        best_score = max((p.get("best_score", 0) for p in perf_docs), default=0)
        
        # Get recommendations
        recommendations = []
        if subject:
            recs = await topic_question_bank_service.get_student_recommendations(
                student_id, class_level, subject, 5
            )
            recommendations = recs
        
        return StudentAnalytics(
            total_tests_taken=total_tests,
            overall_average=round(overall_avg, 1),
            best_score=best_score,
            topics_strong=topics_strong,
            topics_moderate=topics_moderate,
            topics_weak=topics_weak,
            weak_topics=weak_topics[:10],
            performance_history=performance_history,
            topic_breakdown=topic_breakdown,
            recommendations=recommendations
        )
        
    except Exception as e:
        logger.error(f"Error fetching analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== QUESTION BANK ADMIN ENDPOINTS ====================

@router.get("/question-bank/stats")
async def get_question_bank_stats():
    """Get statistics about the question bank."""
    try:
        collection = mongodb.db.topic_question_bank
        
        pipeline = [
            {"$group": {
                "_id": {"class_level": "$class_level", "subject": "$subject"},
                "chapters": {"$sum": 1},
                "total_questions": {"$sum": "$total_questions"},
                "total_topics": {"$sum": "$total_topics"}
            }},
            {"$sort": {"_id.class_level": 1, "_id.subject": 1}}
        ]
        
        results = await collection.aggregate(pipeline).to_list(100)
        
        stats = []
        for r in results:
            stats.append({
                "class_level": r["_id"]["class_level"],
                "subject": r["_id"]["subject"],
                "chapters": r["chapters"],
                "topics": r["total_topics"],
                "questions": r["total_questions"]
            })
        
        return {
            "total_subjects": len(set(s["subject"] for s in stats)),
            "total_chapters": sum(s["chapters"] for s in stats),
            "total_questions": sum(s["questions"] for s in stats),
            "breakdown": stats
        }
        
    except Exception as e:
        logger.error(f"Error fetching question bank stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))
