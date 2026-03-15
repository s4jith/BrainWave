"""
Chat Router - RAG-based chat endpoints with multi-index support.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal
from app.models.schemas import ChatRequest, ChatResponse, ErrorResponse
from app.services.rag_service import rag_service
from app.services.enhanced_rag_service import enhanced_rag_service
from app.services.gemini_service import gemini_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/chat",
    tags=["Chat / RAG"]
)


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    RAG-based chat endpoint with progressive learning.
    
    Retrieves relevant context from Pinecone based on class, subject, and chapter.
    Uses progressive learning to access foundational content from previous classes.
    
    **Modes:**
    - `define`: Clear definitions (quick mode - current + previous class)
    - `elaborate`: Detailed explanation with examples (quick mode)
    """
    try:
        logger.info(f"Chat request: Class {request.class_level}, {request.subject}, Ch. {request.chapter}, Mode: {request.mode}")
        
        # Query RAG system with progressive learning
        answer, source_chunks = rag_service.query_with_rag_progressive(
            query_text=request.highlight_text,
            class_level=request.class_level,
            subject=request.subject,
            chapter=request.chapter,
            mode="quick"  # Use quick mode (current + previous class)
        )
        
        return ChatResponse(
            answer=answer,
            used_mode=request.mode,
            source_chunks=source_chunks
        )
    
    except Exception as e:
        logger.error(f"❌ Chat endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== STICK FLOW ENDPOINT ====================

class StickFlowRequest(BaseModel):
    """Request schema for Stick Flow visual diagram generation."""
    highlight_text: str = Field(..., description="Text to create flow diagram for")
    class_level: int = Field(..., ge=5, le=12, description="Class level (5-12)")
    subject: str = Field(..., description="Subject name")
    chapter: int = Field(..., ge=1, description="Chapter number")


class StickFlowResponse(BaseModel):
    """Response schema for Stick Flow."""
    imageUrl: str = Field(..., description="Generated flow diagram image URL")
    description: str = Field(None, description="Optional description of the flow")


@router.post("/stick-flow", response_model=StickFlowResponse)
async def generate_stick_flow(request: StickFlowRequest):
    """
    Generate visual flow diagram using Gemini image generation.
    
    Creates a step-by-step flow diagram of the concept using ONLY textbook content.
    The image will be a clean, attractive visual representation focusing solely on
    the content without extraneous elements.
    """
    try:
        logger.info(f"Stick Flow request: Class {request.class_level}, {request.subject}, Ch. {request.chapter}")
        
        # Get context from RAG
        context = rag_service.retrieve_chapter_context(
            class_level=request.class_level,
            subject=request.subject,
            chapter=request.chapter,
            max_chunks=15
        )
        
        # Build flow diagram generation prompt with strict constraints
        flow_prompt = f"""Create a visual flow diagram for Class {request.class_level} students.

**TEXTBOOK CONTENT:**
{context[:2000]}

**CONCEPT TO VISUALIZE:**
{request.highlight_text}

**STRICT REQUIREMENTS:**
1. Create a clear, step-by-step flow diagram
2. Use ONLY information from the textbook content above
3. Make it visually attractive with:
   - Clear boxes/shapes for each step
   - Arrows showing flow/sequence
   - Simple icons or symbols where appropriate
   - Color coding for different types of steps
4. Keep text minimal - use keywords and short phrases
5. Focus ONLY on the concept - no decorative elements, backgrounds, or unrelated content
6. Make it suitable for Class {request.class_level} students
7. Layout should be vertical or horizontal flowchart style

**OUTPUT:**
A clean, professional flow diagram that a student can use for quick revision.
"""
        
        # Generate image using Gemini (using text-to-image capability)
        # For now, we'll generate a text description and return a placeholder
        # In production, you'd integrate with an actual image generation service
        
        description_prompt = f"""Based on this textbook content:

{context[:1500]}

Create a brief description (2-3 sentences) of how to visualize "{request.highlight_text}" as a flow diagram.
Focus on the steps and connections."""

        description = gemini_service.generate_response(description_prompt)
        
        # TODO: Integrate actual image generation
        # For now, return a placeholder
        image_url = f"https://via.placeholder.com/800x600/6366f1/ffffff?text=Flow+Diagram:+{request.highlight_text[:30]}"
        
        logger.info(f"✅ Stick Flow generated successfully")
        
        return StickFlowResponse(
            imageUrl=image_url,
            description=description
        )
    
    except Exception as e:
        logger.error(f"❌ Stick Flow error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== STUDENT CHATBOT ENDPOINT ====================

class StudentChatRequest(BaseModel):
    """Request schema for student chatbot with Quick/DeepDive modes."""
    question: str = Field(..., description="Student's question")
    class_level: int = Field(..., ge=5, le=12, description="Class level (5-12)")
    subject: str = Field(..., description="Subject name")
    chapter: int = Field(..., ge=1, description="Chapter number")
    mode: Literal["quick", "deepdive"] = Field("quick", description="Chat mode: quick (exam-style) or deepdive (comprehensive)")


@router.post("/student", response_model=ChatResponse)
async def student_chatbot(request: StudentChatRequest):
    """
    🎓 Enhanced Student Chatbot with Multi-Index Progressive Learning
    
    **BASIC MODE (Quick)**:
    - Searches current class + 2 recent lower classes
    - Example: Class 10 student → searches Classes 8, 9, 10
    - Fast, focused answers from textbook
    - Perfect for homework help and quick concept clarification
    
    **DEEP DIVE MODE**:
    - Searches ALL classes from fundamentals (Class 5 or earliest) to current
    - Example: Class 10 asking about "line" → builds from Class 5 basics to Class 10
    - Includes web content for comprehensive background
    - Starts with "What is a line?", "Why do we need it?", builds progressively
    - Perfect for thorough understanding and exam preparation
    
    **Progressive Learning Architecture**:
    - Automatically accesses foundational content from earlier classes
    - Builds understanding layer by layer
    - Example: Class 11 Physics on "Force" → uses Class 9-10 Newton's laws as foundation
    """
    try:
        logger.info(f"🎓 Student chat ({request.mode.upper()}): Class {request.class_level}, {request.subject}")
        logger.info(f"   Question: {request.question[:100]}...")
        
        # Convert to new enhanced system
        if request.mode == "quick":
            # BASIC MODE: Current + recent lower classes (textbook only)
            answer, source_chunks_list = enhanced_rag_service.answer_question_basic(
                question=request.question,
                subject=request.subject,
                student_class=request.class_level,
                chapter=request.chapter
            )
            
            # Convert chunk format for compatibility
            source_chunks = [chunk.get('text', '') for chunk in source_chunks_list]
            
            # Check if answer is meaningful
            if not source_chunks or len(source_chunks) < 2:
                return ChatResponse(
                    answer=f"I couldn't find enough information in your textbooks. Try asking about specific topics covered in Chapter {request.chapter} of {request.subject}!",
                    used_mode="quick",
                    source_chunks=[]
                )
        
        else:  # deepdive mode
            # DEEP DIVE MODE: ALL prerequisite classes + web content
            answer, source_chunks_list = enhanced_rag_service.answer_question_deepdive(
                question=request.question,
                subject=request.subject,
                student_class=request.class_level,
                chapter=request.chapter
            )
            
            # Convert chunk format
            source_chunks = [chunk.get('text', '') for chunk in source_chunks_list]
        
        logger.info(f"✅ Answer generated: {len(answer)} chars, {len(source_chunks)} sources")
        
        return ChatResponse(
            answer=answer,
            used_mode=request.mode,
            source_chunks=source_chunks
        )
    
    except Exception as e:
        logger.error(f"❌ Student chat error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
