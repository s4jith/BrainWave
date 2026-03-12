"""
Main FastAPI Application
NCERT AI Learning Backend

Entry point for the FastAPI application.
Includes all routers, CORS configuration, and database initialization.
"""

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.db.mongo import init_databases, close_databases
from app.routers import chat, mcq, evaluate, notes, assessment, annotation, history
from app.core.auth_middleware import AuthMiddleware

logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan events for FastAPI application.
    Handles database initialization and cleanup.
    """
    logger.info("Starting NCERT AI Learning Backend...")
    logger.info(f"   App: {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"   Debug Mode: {settings.DEBUG}")
    
    try:
        await init_databases()
    except Exception as e:
        logger.error(f" Database initialization failed: {e}")
    
    try:
        from app.services.question_bank_service import question_bank_service
        deleted = await question_bank_service.cleanup_expired_pending_questions()
        if deleted > 0:
            logger.info(f" Cleaned up {deleted} expired pending questions")
    except Exception as e:
        logger.warning(f" Could not run startup cleanup: {e}")
    
    logger.info("All systems initialized successfully")
    
    yield
    
    logger.info(" Shutting down NCERT AI Learning Backend...")
    await close_databases()
    logger.info("Shutdown complete")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
    
    A production-grade educational AI system for NCERT students (Classes 5-10).
    
    - **RAG-based Chatbot**: Context-aware explanations using Pinecone + Gemini
    - **AI MCQ Generation**: Concept-based questions using chapter content
    - **Automated Evaluation**: Score calculation and personalized feedback
    - **Student Notes**: CRUD operations with MongoDB Atlas
    - **Multi-mode Learning**: Simple, Meaning, Story, Example, Summary modes
    
    - **Backend**: FastAPI + Python 3
    - **AI**: Google Gemini 1.5 Flash + embedding-001
    - **Vector DB**: Pinecone
    - **Database**: MongoDB Atlas
    
    All endpoints follow strict RAG principles - no hallucination, only context-based answers.
    """,
    lifespan=lifespan,
    debug=settings.DEBUG
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global auth middleware — protects all /api/ routes except public whitelist
app.add_middleware(AuthMiddleware)

app.include_router(chat.router, prefix="/api")
app.include_router(mcq.router, prefix="/api")
app.include_router(evaluate.router, prefix="/api")
app.include_router(notes.router, prefix="/api")
app.include_router(assessment.router, prefix="/api")
app.include_router(annotation.router, prefix="/api")
app.include_router(history.router, prefix="/api")

from app.routers import admin, user, test, auth
from app.routers import admin_dashboard, support, support_tickets, test_management, suggestions
from app.routers import book_management, curriculum
app.include_router(admin.router, prefix="/api")
app.include_router(user.router, prefix="/api")
app.include_router(test.router, prefix="/api")
app.include_router(auth.router)
app.include_router(admin_dashboard.router)
app.include_router(support.router)
app.include_router(support_tickets.router)
app.include_router(suggestions.router, prefix="/api")
app.include_router(test_management.router)
app.include_router(book_management.router)
app.include_router(curriculum.router)

from app.routers import teacher
app.include_router(teacher.router)

from app.routers import notifications
app.include_router(notifications.router)

from app.routers import student_level, student
app.include_router(student_level.router)
app.include_router(student.router)

from app.routers import question_bank, question_papers, queries
app.include_router(question_bank.router)
app.include_router(queries.router)
app.include_router(question_papers.router)

from app.routers import head_approval
app.include_router(head_approval.router)

from app.routers import top_questions
app.include_router(top_questions.router)

from app.routers import courses
app.include_router(courses.router)

from app.routers import assessments
app.include_router(assessments.router)

from app.routers import gradebook
app.include_router(gradebook.router)

from app.routers import career
app.include_router(career.router)

@app.get("/api/public/maintenance", tags=["Public"])
async def public_maintenance_alias():
    """Alias for /api/admin/public/maintenance (backward compat)."""
    from app.db.mongo import db
    try:
        col = db.get_collection("platform_settings")
        doc = col.find_one({"_id": "global"})
        maintenance = doc.get("maintenanceMode", False) if doc else False
        platform_name = doc.get("platformName", "NCERT Learning Platform") if doc else "NCERT Learning Platform"
        return {"maintenance_mode": maintenance, "platform_name": platform_name}
    except Exception:
        return {"maintenance_mode": False, "platform_name": "NCERT Learning Platform"}


@app.get("/", tags=["Health Check"])
async def root():
    """Root endpoint - API health check."""
    return {
        "message": "NCERT AI Learning Backend",
        "version": settings.APP_VERSION,
        "status": "operational",
        "docs": "/docs",
        "redoc": "/redoc"
    }

@app.get("/health", tags=["Health Check"])
async def health_check():
    """Detailed health check endpoint."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "debug": settings.DEBUG
    }

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
