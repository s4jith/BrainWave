"""
Chat Router - RAG-based chat endpoints with multi-index support.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Literal, List, Optional
from app.models.schemas import ChatRequest, ChatResponse
from app.services.rag_service import rag_service
from app.services.enhanced_rag_service import enhanced_rag_service
from app.services.gemini_service import gemini_service
from app.services.top_question_service import top_question_service
import logging
from PIL import Image
import io

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
    
    **Auto-tracking:** Questions and answers are automatically tracked for recommendations
    when user_id and session_id are provided.
    """
    try:
        logger.info(f"Chat request: Class {request.class_level}, {request.subject}, Ch. {request.chapter}, Mode: {request.mode}")
        
        answer, source_chunks = rag_service.query_with_rag_progressive(
            query_text=request.highlight_text,
            class_level=request.class_level,
            subject=request.subject,
            chapter=request.chapter,
            mode="quick"
        )
        
        if request.user_id and request.session_id:
            try:
                tracking_mode = "deep" if request.mode in ["elaborate", "story", "example"] else "quick"
                
                top_question_service.save_question_answer(
                    user_id=request.user_id,
                    session_id=request.session_id,
                    question=request.highlight_text,
                    answer=answer,
                    subject=request.subject,
                    class_level=request.class_level,
                    mode=tracking_mode,
                    chapter=request.chapter
                )
                logger.info(f"Question tracked for user {request.user_id}")
            except Exception as track_error:
                logger.warning(f" Failed to track question: {track_error}")
        
        return ChatResponse(
            answer=answer,
            used_mode=request.mode,
            source_chunks=source_chunks
        )
    
    except Exception as e:
        logger.error(f" Chat endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class StudentChatRequest(BaseModel):
    """Request schema for student chatbot with Quick/DeepDive modes."""
    question: str = Field(..., description="Student's question")
    class_level: int = Field(..., ge=1, le=12, description="Class level (1-12)")
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
    - Searches ALL classes from fundamentals (Class 1 or earliest) to current
    - Example: Class 10 asking about "line" → builds from Class 1 basics to Class 10
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
        
        if request.mode == "quick":
            answer, source_chunks_list = await enhanced_rag_service.answer_question_basic(
                question=request.question,
                subject=request.subject,
                student_class=request.class_level,
                chapter=request.chapter
            )
            
            source_chunks = [chunk.get('text', '') for chunk in source_chunks_list]
            
            # Don't show "no content" if we got a valid answer (e.g. identity/greeting)
            if (not source_chunks or len(source_chunks) < 2) and not answer:
                return ChatResponse(
                    answer="No relevant content found for this topic.",
                    used_mode="quick",
                    source_chunks=[]
                )
        
        else:
            answer, source_chunks_list = await enhanced_rag_service.answer_question_deepdive(
                question=request.question,
                subject=request.subject,
                student_class=request.class_level,
                chapter=request.chapter
            )
            
            source_chunks = [chunk.get('text', '') for chunk in source_chunks_list]
        
        logger.info(f"Answer generated: {len(answer)} chars, {len(source_chunks)} sources")
        
        return ChatResponse(
            answer=answer,
            used_mode=request.mode,
            source_chunks=source_chunks
        )
    
    except Exception as e:
        logger.error(f" Student chat error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

from fastapi.responses import StreamingResponse
import asyncio

class StreamingChatRequest(BaseModel):
    """Request schema for streaming student chatbot."""
    question: str = Field(..., description="Student's question")
    class_level: int = Field(..., ge=1, le=12, description="Class level (1-12)")
    subject: str = Field(..., description="Subject name")
    chapter: int = Field(..., ge=1, description="Chapter number")
    mode: Literal["quick", "deepdive"] = Field("quick", description="Chat mode")

@router.post("/student/stream")
async def student_chatbot_stream(request: StreamingChatRequest):
    """
    STREAMING Student Chatbot - Reduced Perceived Latency
    
    Same as /chat/student but streams the response token-by-token.
    Uses Server-Sent Events (SSE) for real-time text streaming.
    
    **Benefits:**
    - Time to First Token (TTFT): ~2-3 seconds instead of 20+ seconds
    - User sees response building in real-time
    - Same answer quality as non-streaming endpoint
    
    **Response Format (SSE):**
    Each chunk is sent as: `data: {"text": "chunk of text"}\n\n`
    Final message: `data: {"done": true, "sources": [...]}\n\n`
    
    **Frontend Usage:**
    ```javascript
    const eventSource = new EventSource('/api/chat/student/stream');
    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.done) {
            // Response complete
        } else {
            // Append data.text to display
        }
    };
    ```
    """
    import json
    from app.services.enhanced_rag_service import detect_identity_or_greeting
    
    async def generate_stream():
        try:
            logger.info(f"Streaming chat: Class {request.class_level}, {request.subject}")
            logger.info(f"   Question: {request.question[:100]}...")
            
            # Identity / greeting — respond immediately as Brainwave
            identity_response = detect_identity_or_greeting(request.question)
            if identity_response:
                logger.info("Identity/greeting detected in stream — returning Brainwave response")
                yield f"data: {json.dumps({'text': identity_response})}\n\n"
                yield f"data: {json.dumps({'done': True, 'sources': []})}\n\n"
                return
            
            query_embedding = enhanced_rag_service.generate_embedding(request.question)
            
            textbook_chunks, class_dist = enhanced_rag_service.query_multi_class(
                query_text=request.question,
                subject=request.subject,
                student_class=request.class_level,
                chapter=request.chapter,
                mode=request.mode,
                chunks_per_class=3,
                query_embedding=query_embedding
            )
            
            llm_chunks = enhanced_rag_service.query_llm_content(
                query_text=request.question,
                subject=request.subject,
                top_k=2,
                query_embedding=query_embedding
            )
            
            if llm_chunks and llm_chunks[0]['score'] >= 0.80:
                cached_answer = llm_chunks[0]['text']
                logger.info(f" CACHE HIT (streaming): similarity {llm_chunks[0]['score']:.3f}")
                
                chunk_size = 50
                for i in range(0, len(cached_answer), chunk_size):
                    chunk = cached_answer[i:i+chunk_size]
                    yield f"data: {json.dumps({'text': chunk})}\n\n"
                    await asyncio.sleep(0.02)
                
                source_texts = [c.get('text', '')[:200] for c in textbook_chunks[:3]]
                yield f"data: {json.dumps({'done': True, 'sources': source_texts, 'cached': True})}\n\n"
                return
            
            context_parts = []
            for chunk in textbook_chunks[:3]:
                class_level = chunk.get('class', request.class_level)
                context_parts.append(f"[Class {class_level}] {chunk['text']}")
            
            combined_context = "\n\n".join(context_parts)
            
            if not combined_context:
                logger.info(f"No textbook content found - generating direct answer for valid {request.subject} question")
                
                direct_prompt = f"""You are a {request.subject} tutor helping a Class {request.class_level} student.

STUDENT QUESTION: {request.question}

**IMPORTANT CONSTRAINTS:**
- ONLY answer if the question is related to education, academics, or school subjects.
- If the question is NOT related to studies/education, respond with EXACTLY:
  "I can only help with education-related questions. Please ask something related to your studies."
- Stay strictly within the scope of {request.subject}.
- Do NOT confuse Physics and Maths concepts.

Provide a clear, educational answer appropriate for Class {request.class_level} level.
- Start with a simple definition/explanation
- Give 1-2 examples
- Keep it concise but informative (200-400 words)"""

                fallback_full = ""
                for chunk in gemini_service.generate_response_streaming(direct_prompt):
                    fallback_full += chunk
                    yield f"data: {json.dumps({'text': chunk})}\n\n"
                
                # Store the Gemini fallback answer in LLM cache for reuse
                try:
                    if enhanced_rag_service.llm_storage._should_store_answer(fallback_full):
                        topic = enhanced_rag_service.llm_storage._extract_topic(request.question)
                        enhanced_rag_service.llm_storage.store_answer(
                            question=request.question,
                            answer=fallback_full,
                            subject=request.subject,
                            class_level=request.class_level,
                            topic=topic,
                            quality_score=0.75
                        )
                        logger.info(f"✓ Streaming fallback answer stored in LLM cache (topic: {topic})")
                except Exception as store_err:
                    logger.warning(f"Failed to store streaming fallback answer: {store_err}")
                
                yield f"data: {json.dumps({'done': True, 'sources': [], 'fallback': True})}\n\n"
                return
            
            # Subject isolation instruction for Physics / Maths confusion prevention
            subject_isolation = ""
            if request.subject.lower() in ("physics", "maths", "mathematics", "science"):
                subject_isolation = (
                    f"\n**SUBJECT ISOLATION ({request.subject}):**\n"
                    f"- You are answering ONLY for **{request.subject}**.\n"
                    f"- The word 'sum' or 'problem' may appear in both Physics and Mathematics — "
                    f"interpret it STRICTLY in the context of {request.subject}.\n"
                    f"- Never mix Physics concepts into a Maths answer or vice-versa.\n"
                )
            
            prompt = f"""You are a helpful tutor for Class {request.class_level} {request.subject} students.

STUDENT QUESTION: {request.question}

REFERENCE CONTENT FROM TEXTBOOK:
{combined_context}

RULES:
1. Answer the question using the REFERENCE CONTENT above as your primary source.
2. If the reference content is directly about the topic asked, give a clear answer from it.
3. If the reference content is from the same subject but covers a different specific topic (e.g., student asks about irrational numbers but content is about prime factorization), respond with EXACTLY:
   "The content is not found in the book, ask some other questions related to your subject."
4. If the student asks about something completely unrelated to {request.subject} (e.g., asking about animals in a math class), respond with EXACTLY:
   "The content is not found in the book, ask some other questions related to your subject."
5. Do NOT start with preamble like "Based on your textbook" - just give the answer directly.
6. Do NOT describe what the reference content contains instead of answering.
7. Keep the answer clear for Class {request.class_level} students.
{subject_isolation}
Generate your answer:"""
            
            logger.info("📡 Starting Gemini streaming...")
            full_response = ""
            
            import queue
            import threading
            
            chunk_queue = queue.Queue()
            
            def _stream_worker():
                try:
                    for chunk in gemini_service.generate_response_streaming(prompt):
                        chunk_queue.put(("chunk", chunk))
                    chunk_queue.put(("done", None))
                except Exception as e:
                    chunk_queue.put(("error", str(e)))
            
            thread = threading.Thread(target=_stream_worker, daemon=True)
            thread.start()
            
            while True:
                while chunk_queue.empty():
                    await asyncio.sleep(0.01)
                
                msg_type, data = chunk_queue.get()
                
                if msg_type == "chunk":
                    full_response += data
                    yield f"data: {json.dumps({'text': data})}\n\n"
                elif msg_type == "done":
                    break
                elif msg_type == "error":
                    yield f"data: {json.dumps({'error': data})}\n\n"
                    return            
            logger.info(f"Streaming complete: {len(full_response)} chars")
            
            source_texts = [c.get('text', '')[:200] for c in textbook_chunks[:3]]
            yield f"data: {json.dumps({'done': True, 'sources': source_texts, 'total_length': len(full_response)})}\n\n"
            
            try:
                # Don't cache "not found" responses
                not_found_markers = ["the content is not found", "not found in the book", "not found in your textbook"]
                is_not_found = any(m in full_response.lower() for m in not_found_markers)
                
                if not is_not_found and enhanced_rag_service.llm_storage._should_store_answer(full_response):
                    topic = enhanced_rag_service.llm_storage._extract_topic(request.question)
                    enhanced_rag_service.llm_storage.store_answer(
                        question=request.question,
                        answer=full_response,
                        subject=request.subject,
                        class_level=request.class_level,
                        topic=topic,
                        quality_score=0.9
                    )
            except Exception as store_error:
                logger.warning(f" Failed to store answer: {store_error}")
        
        except Exception as e:
            logger.error(f" Streaming error: {e}")
            import traceback
            logger.error(traceback.format_exc())
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

class ImageChatResponse(BaseModel):
    """Response schema for image-based chat."""
    answer: str = Field(..., description="RAG-generated answer")
    used_mode: str = Field(..., description="Mode used (quick/deepdive)")
    source_chunks: List[str] = Field(default=[], description="Source text chunks used")
    image_analysis: dict = Field(..., description="Image analysis metadata")

MAX_IMAGE_SIZE_MB = 5
ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/jpg", "image/webp"]

@router.post("/image", response_model=ImageChatResponse)
async def image_chat(
    image: UploadFile = File(..., description="Image file (jpg/png, max 5MB)"),
    class_level: int = Form(..., ge=1, le=12, description="Class level (1-12)"),
    subject: str = Form(..., description="Subject name"),
    mode: str = Form("quick", description="Chat mode: quick or deepdive"),
    chapter: int = Form(1, ge=1, description="Chapter number"),
    user_query: Optional[str] = Form(None, description="Optional user text to accompany image")
):
    """
     Image-Based Chat: Extract text from student photos → Generate RAG answer
    
    Students can upload photos of:
    - Textbook pages
    - Diagrams and charts
    - Handwritten questions
    - Mathematical formulas
    
    **Flow:**
    1. Validate and preprocess image
    2. Extract text using Gemini Vision OCR
    3. Generate query from extracted text AND user input
    4. Run RAG pipeline for answer generation
    
    **Supported formats:** JPEG, PNG, WebP (max 5MB)
    """
    try:
        logger.info(f" Image chat request: Class {class_level}, {subject}, Ch. {chapter}, Mode: {mode}, Query: {user_query}")
        
        if image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid image type: {image.content_type}. Allowed: {', '.join(ALLOWED_IMAGE_TYPES)}"
            )
        
        image_bytes = await image.read()
        
        if len(image_bytes) > MAX_IMAGE_SIZE_MB * 1024 * 1024:
            raise HTTPException(
                status_code=400,
                detail=f"Image too large. Maximum size: {MAX_IMAGE_SIZE_MB}MB"
            )
        
        if len(image_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty image file")
        
        logger.info(f"   Image: {image.filename}, {len(image_bytes) / 1024:.1f}KB, {image.content_type}")
        
        try:
            pil_image = Image.open(io.BytesIO(image_bytes))
            pil_image = pil_image.convert("RGB")
            logger.info(f"   Image loaded: {pil_image.size}")
        except Exception as e:
            logger.error(f"Failed to parse image: {e}")
            raise HTTPException(status_code=400, detail=f"Failed to parse image: {str(e)}")
        
        import base64
        image_b64 = base64.b64encode(image_bytes).decode('utf-8')
        vision_prompt = """Extract the main educational text from this image.
        Return ONLY the extracted text, no explanations.
        If there are mathematical formulas, express them in plain text."""
        
        try:
            ocr_text = gemini_service.analyze_image(
                image_data=image_b64,
                prompt=vision_prompt,
                mime_type=image.content_type or "image/jpeg"
            )
        except Exception as e:
            logger.warning(f"Gemini Vision OCR failed: {e}")
            ocr_text = ""
        
        image_analysis = {
            "text": ocr_text,
            "image_type": "textbook",
            "source": "gemini_vision"
        }
        image_type = "textbook"
        
        logger.info(f"   OCR extracted: {len(ocr_text)} chars")
        
        if (not ocr_text or len(ocr_text) < 10) and not user_query:
            return ImageChatResponse(
                answer="I couldn't extract enough text from this image. Please try:\n"
                       "1. Take a clearer photo with better lighting\n"
                       "2. Make sure the text is in focus\n"
                       "3. Avoid shadows and glare\n"
                       "Or, you can type your question directly along with the image!",
                used_mode=mode,
                source_chunks=[],
                image_analysis=image_analysis
            )
        
        query_parts = []
        if user_query:
            query_parts.append(f"User Question: {user_query}")
        
        if ocr_text:
            if image_type == "formula":
                query_parts.append(f"Image Content (Formula): {ocr_text}")
            elif image_type == "diagram":
                query_parts.append(f"Image Content (Diagram labels): {ocr_text}")
            elif image_type == "handwritten":
                query_parts.append(f"Image Content (Handwritten): {ocr_text}")
            else:
                query_parts.append(f"Image Content (Textbook): {ocr_text}")
        
        query = "\n\n".join(query_parts)
        
        if not ocr_text and user_query:
            query = f"User Question about uploaded image: {user_query}\n(Note: OCR could not extract text from the image)"

        logger.info(f"   Generated query: {query[:100]}...")
        
        if mode == "quick":
            answer, source_chunks_list = await enhanced_rag_service.answer_question_basic(
                question=query,
                subject=subject,
                student_class=class_level,
                chapter=chapter
            )
        else:
            answer, source_chunks_list = await enhanced_rag_service.answer_question_deepdive(
                question=query,
                subject=subject,
                student_class=class_level,
                chapter=chapter
            )
        
        source_chunks = [chunk.get('text', '') for chunk in source_chunks_list]
        
        logger.info(f"Image chat complete: {len(answer)} chars, {len(source_chunks)} sources")
        
        return ImageChatResponse(
            answer=answer,
            used_mode=mode,
            source_chunks=source_chunks,
            image_analysis=image_analysis
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Image chat error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

from datetime import datetime
from app.db.mongo import mongodb

class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str
    timestamp: Optional[str] = None

class SaveSessionRequest(BaseModel):
    user_id: str
    subject: str
    class_level: int
    messages: List[ChatMessage]
    title: Optional[str] = None

class ChatSession(BaseModel):
    id: str
    user_id: str
    subject: str
    class_level: int
    title: str
    message_count: int
    created_at: str
    updated_at: str

@router.post("/sessions", summary="Save chat session")
async def save_chat_session(request: SaveSessionRequest):
    """
    Save or update a chat session for resuming later.
    """
    try:
        db = mongodb.db
        sessions_col = db["chat_sessions"]
        
        title = request.title
        if not title and request.messages:
            first_msg = next((m for m in request.messages if m.role == "user"), None)
            if first_msg:
                title = first_msg.content[:50] + ("..." if len(first_msg.content) > 50 else "")
        title = title or f"{request.subject} Chat"
        
        now = datetime.now().isoformat()
        
        session_doc = {
            "user_id": request.user_id,
            "subject": request.subject,
            "class_level": request.class_level,
            "title": title,
            "messages": [m.dict() for m in request.messages],
            "message_count": len(request.messages),
            "created_at": now,
            "updated_at": now
        }
        
        result = sessions_col.insert_one(session_doc)
        
        logger.info(f"💾 Saved chat session for user {request.user_id}: {title}")
        
        return {
            "success": True,
            "session_id": str(result.inserted_id),
            "title": title,
            "message_count": len(request.messages)
        }
        
    except Exception as e:
        logger.error(f" Save session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions/{user_id}", summary="Get user's chat sessions")
async def get_user_sessions(
    user_id: str,
    subject: Optional[str] = None,
    limit: int = 20
):
    """
    Get list of chat sessions for a user.
    """
    try:
        db = mongodb.db
        sessions_col = db["chat_sessions"]
        
        filter_query = {"user_id": user_id}
        if subject:
            filter_query["subject"] = subject
        
        sessions = list(
            sessions_col.find(filter_query)
            .sort("updated_at", -1)
            .limit(limit)
        )
        
        result = []
        for s in sessions:
            result.append({
                "id": str(s["_id"]),
                "subject": s.get("subject", "Unknown"),
                "class_level": s.get("class_level", 0),
                "title": s.get("title", "Untitled"),
                "message_count": s.get("message_count", 0),
                "created_at": s.get("created_at", ""),
                "updated_at": s.get("updated_at", "")
            })
        
        logger.info(f" Found {len(result)} sessions for user {user_id}")
        
        return {"sessions": result, "total": len(result)}
        
    except Exception as e:
        logger.error(f" Get sessions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions/{user_id}/{session_id}", summary="Load chat session")
async def load_chat_session(user_id: str, session_id: str):
    """
    Load full chat session with messages.
    """
    try:
        from bson import ObjectId
        db = mongodb.db
        sessions_col = db["chat_sessions"]
        
        session = sessions_col.find_one({
            "_id": ObjectId(session_id),
            "user_id": user_id
        })
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        logger.info(f" Loaded session {session_id} for user {user_id}")
        
        return {
            "id": str(session["_id"]),
            "user_id": session["user_id"],
            "subject": session.get("subject", "Unknown"),
            "class_level": session.get("class_level", 0),
            "title": session.get("title", "Untitled"),
            "messages": session.get("messages", []),
            "created_at": session.get("created_at", ""),
            "updated_at": session.get("updated_at", "")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Load session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/sessions/{user_id}/{session_id}", summary="Delete chat session")
async def delete_chat_session(user_id: str, session_id: str):
    """
    Delete a chat session.
    """
    try:
        from bson import ObjectId
        db = mongodb.db
        sessions_col = db["chat_sessions"]
        
        result = sessions_col.delete_one({
            "_id": ObjectId(session_id),
            "user_id": user_id
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Session not found")
        
        logger.info(f" Deleted session {session_id} for user {user_id}")
        
        return {"success": True, "message": "Session deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Delete session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
