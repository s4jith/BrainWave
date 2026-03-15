"""
MCQ Router - MCQ generation endpoints.
"""

from fastapi import APIRouter, HTTPException
from app.models.schemas import MCQGenerationRequest, MCQGenerationResponse
from app.services.mcq_service import mcq_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/mcq",
    tags=["MCQ Generation"]
)


@router.post("/generate", response_model=MCQGenerationResponse)
async def generate_mcqs(request: MCQGenerationRequest):
    """
    Generate AI-powered MCQs based on chapter content.
    
    Uses RAG to retrieve chapter context from Pinecone,
    then generates concept-based MCQs using Gemini.
    
    **Returns:**
    - List of MCQs with questions, options, correct answer, and explanations
    - Metadata about class, subject, and chapter
    """
    try:
        logger.info(f"MCQ generation request: Class {request.class_level}, {request.subject}, Ch. {request.chapter}, {request.num_questions} questions")
        
        # Generate MCQs
        mcqs = mcq_service.generate_mcqs(
            class_level=request.class_level,
            subject=request.subject,
            chapter=request.chapter,
            num_questions=request.num_questions,
            page_range=request.page_range
        )
        
        metadata = {
            "class_level": request.class_level,
            "subject": request.subject,
            "chapter": request.chapter,
            "num_questions": len(mcqs)
        }
        
        return MCQGenerationResponse(
            mcqs=mcqs,
            metadata=metadata
        )
    
    except Exception as e:
        logger.error(f"❌ MCQ generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
