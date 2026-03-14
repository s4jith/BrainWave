"""
Annotation Router - Text annotation with AI assistance (Define, Elaborate, Flow)

Supports multilingual input/output - responds in the same language as the selected text.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal
from app.services.enhanced_rag_service import enhanced_rag_service
from app.services.gemini_service import gemini_service
from app.services.safe_image_rag_service import safe_image_rag_service
from app.utils.tutor_persona import get_tutor_system_prompt
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/annotation",
    tags=["Annotation"]
)

def detect_text_language(text: str) -> str:
    """Detect language of the selected text and return language instruction."""
    try:
        from app.utils.language_detection import detect_language_with_confidence
        lang, confidence = detect_language_with_confidence(text)
        
        lang_names = {
            "hi": "Hindi",
            "ur": "Urdu",
            "ta": "Tamil",
            "te": "Telugu",
            "bn": "Bengali",
            "mr": "Marathi",
            "gu": "Gujarati",
            "kn": "Kannada",
            "ml": "Malayalam",
            "pa": "Punjabi",
            "ar": "Arabic",
            "en": "English"
        }
        
        if lang != "en" and confidence > 0.5:
            lang_name = lang_names.get(lang, lang.upper())
            return f"\n\n**IMPORTANT: The input text is in {lang_name}. You MUST respond entirely in {lang_name} using the same script.**"
        return ""
    except:
        return ""

class AnnotationRequest(BaseModel):
    """Request schema for annotation AI actions."""
    selected_text: str = Field(..., description="Text selected by user for annotation")
    action: Literal["define", "elaborate", "stick_flow"] = Field(..., description="AI action to perform")
    class_level: int = Field(..., ge=1, le=12, description="Student's class level")
    subject: str = Field(..., description="Subject name (Mathematics, Physics, etc.)")
    chapter: int | None = Field(None, ge=1, description="Optional chapter number")
    image_data: str | None = Field(None, description="Optional base64 image data for screenshot doubts")
    page_number: int | None = Field(None, ge=1, description="Current page number for page summarization")

class AnnotationResponse(BaseModel):
    """Response schema for annotation."""
    answer: str = Field(..., description="AI-generated response")
    action_type: str = Field(..., description="Type of action performed")
    source_count: int = Field(..., description="Number of sources used")

@router.post("/", response_model=AnnotationResponse)
async def process_annotation(request: AnnotationRequest):
    """
    [TARGET] Process annotation request with AI assistance.
    
    **Actions:**
    - `define`: Quick, accurate definition from textbook
    - `elaborate`: Detailed explanation with examples  
    - `stick_flow`: Text-based flow diagram showing concept breakdown
    
    **Cost-Efficient Design:**
    - Uses RAG for context (reduces Gemini tokens)
    - Targeted prompts for specific actions
    - No image generation (text-based flows)
    
    **Edge Case Handling:**
    - Class 11-12: Limited content available (graceful fallback)
    - Missing content: Searches earlier classes for foundation
    - No matches: Uses Gemini general knowledge with disclaimer
    """
    try:
        from app.services.cache_service import cache_service
        
        cached_response = await cache_service.get_annotation_cache(
            action=request.action,
            subject=request.subject,
            class_level=request.class_level,
            selected_text=request.selected_text,
            image_data=request.image_data
        )
        
        if cached_response:
            logger.info(f"[FAST] CACHE HIT: Serving stored {request.action} response (0 cost)")
            return AnnotationResponse(**cached_response)

        query_text = request.selected_text
        source_chunks = []

        if request.image_data:
            logger.info("[IMAGE] Running strict safe image RAG pipeline")

            image_result = await safe_image_rag_service.run_pipeline(
                image_data=request.image_data,
                action=request.action,
                class_level=request.class_level,
                subject=request.subject,
                chapter=request.chapter,
                fallback_text=request.selected_text,
            )

            response_data = {
                "answer": image_result.answer,
                "action_type": request.action,
                "source_count": image_result.source_count,
            }

            await cache_service.set_annotation_cache(
                action=request.action,
                subject=request.subject,
                class_level=request.class_level,
                selected_text=request.selected_text,
                response_data=response_data,
                image_data=request.image_data,
            )

            return AnnotationResponse(**response_data)
        
        logger.info(f"[NOTE] Annotation request: {request.action.upper()} for '{query_text[:50]}...'")
        logger.info(f"   Class {request.class_level}, {request.subject}")
        
        lang_instruction = detect_text_language(query_text)
        if lang_instruction:
            logger.info(f"   [LANG] Detected non-English input, will respond in same language")
        
        if request.class_level > 10:
            logger.warning(f"[WARNING] Class {request.class_level} requested (limited content available)")
        
        if request.action == "define":
            answer, source_chunks = enhanced_rag_service.answer_annotation_basic(
                question=f"Define: {query_text}",
                subject=request.subject,
                student_class=request.class_level,
                chapter=request.chapter
            )
            
            subject_lower = request.subject.lower()
            is_hindi_subject = subject_lower == "hindi"
            is_urdu_subject = subject_lower == "urdu"
            
            if is_hindi_subject:
                language_instruction = """
[CRITICAL]: You MUST respond ONLY in Hindi using DEVANAGARI script (देवनागरी लिपि)
- Example: क, ख, ग, घ, च, छ, ज, झ
- Write like this: "यह एक उदाहरण है"
- DO NOT use Urdu/Arabic script"""
                format_example = """**परिभाषा:** [Explanation in Hindi Devanagari]

**मुख्य बिंदु:**
- [Point 1 in Hindi]
- [Point 2 in Hindi]"""
            elif is_urdu_subject:
                language_instruction = """
[CRITICAL]: You MUST respond in Urdu using NASTALIQ script
- Write right-to-left in Urdu/Arabic script
- Example: یہ ایک مثال ہے"""
                format_example = """**تعریف:** [Explanation in Urdu]

**اہم نکات:**
- [Point 1 in Urdu]
- [Point 2 in Urdu]"""
            else:
                language_instruction = ""
                format_example = """**Definition:** [Clear explanation in English]

**Key Points:**
- [Point 1]
- [Point 2]
- [Point 3]"""
            
            if answer and len(answer.strip()) > 20:
                logger.info(f"   ⚡ Using RAG answer directly (already formatted by RAG service)")
                if is_hindi_subject or is_urdu_subject:
                    context = "\n\n".join([chunk.get('text', '')[:500] for chunk in source_chunks[:3]]) if source_chunks else ""
                    
                    persona = get_tutor_system_prompt(request.class_level, request.subject)
                    prompt = f"""{persona}
{language_instruction}
**Student's Query:** {query_text}

**Context:** {context or answer}

**Instructions:**
1. Provide a clear, simple definition or explanation
2. Use bullet points for key concepts
3. Keep it concise (under 150 words)
{'4. RESPOND ONLY IN HINDI USING DEVANAGARI SCRIPT' if is_hindi_subject else '4. RESPOND IN URDU USING NASTALIQ SCRIPT'}

**Format your response as:**
{format_example}"""
                    
                    answer = gemini_service.generate_response(prompt)
            else:
                logger.warning(f"    RAG returned no answer, generating from scratch")
                context = "\n\n".join([chunk.get('text', '')[:500] for chunk in source_chunks[:3]]) if source_chunks else ""
                
                persona = get_tutor_system_prompt(request.class_level, request.subject)
                prompt = f"""{persona}
{language_instruction}
**Student's Query:** {query_text}

{f'**Textbook Content:** {context}' if context else 'No textbook content found. Provide a helpful explanation based on general knowledge.'}

**Instructions:**
1. Provide a clear, simple definition or explanation
2. Use bullet points for key concepts
3. Keep it concise (under 150 words)
4. Make it easy for a Class {request.class_level} student to understand

**Format your response as:**
{format_example}"""
                
                answer = gemini_service.generate_response(prompt)
        
        elif request.action == "elaborate":
            answer, source_chunks = await enhanced_rag_service.answer_question_deepdive(
                question=f"Explain in detail: {query_text}",
                subject=request.subject,
                student_class=request.class_level,
                chapter=request.chapter
            )
            
            subject_lower = request.subject.lower()
            is_hindi_subject = subject_lower == "hindi"
            is_urdu_subject = subject_lower == "urdu"
            
            if is_hindi_subject:
                language_instruction = """
[CRITICAL]: You MUST respond ONLY in Hindi using DEVANAGARI script (देवनागरी लिपि)
- Write like this: "यह एक उदाहरण है"
- DO NOT use Urdu/Arabic script"""
                format_example = """**परिचय:** [Introduction in Hindi]
**विस्तार:** [Explanation in Hindi]
**उदाहरण:** [Examples in Hindi]"""
            elif is_urdu_subject:
                language_instruction = """
[CRITICAL]: You MUST respond in Urdu using NASTALIQ script
- Write right-to-left in Urdu/Arabic script"""
                format_example = """**تعارف:** [Introduction in Urdu]
**تفصیل:** [Explanation in Urdu]
**مثال:** [Examples in Urdu]"""
            else:
                language_instruction = ""
                format_example = """**Introduction:** [What is it?]
**Explanation:** [Detailed breakdown]
**Examples:** [If applicable]"""
            
            if source_chunks:
                context = "\n\n".join([chunk.get('text', '')[:800] for chunk in source_chunks[:5]])
                
                persona = get_tutor_system_prompt(request.class_level, request.subject)
                prompt = f"""{persona}
{language_instruction}
**Student wants detailed explanation of:** {query_text}

**Textbook Content:**
{context}

**Instructions:**
1. Start with a brief introduction
2. Explain the concept step-by-step
3. Include examples where possible
4. Use simple, engaging language for Class {request.class_level}
{'5. RESPOND ONLY IN HINDI USING DEVANAGARI SCRIPT' if is_hindi_subject else ('5. RESPOND IN URDU' if is_urdu_subject else '5. RESPOND IN ENGLISH')}
6. Keep it under 400 words

**Format:**
{format_example}"""
                
                answer = gemini_service.generate_response(prompt)
            else:
                persona = get_tutor_system_prompt(request.class_level, request.subject)
                prompt = f"""{persona}
{language_instruction}
The student wants to understand: "{query_text}"

Provide a helpful explanation even though specific textbook content wasn't found:
1. Explain the concept in simple terms
{'2. RESPOND ONLY IN HINDI USING DEVANAGARI SCRIPT' if is_hindi_subject else ('2. RESPOND IN URDU' if is_urdu_subject else '2. RESPOND IN ENGLISH')}
3. Keep it educational and age-appropriate
4. Note that this is general knowledge, not from their specific textbook"""
                
                answer = gemini_service.generate_response(prompt)
        
        elif request.action == "stick_flow":
            answer, source_chunks = enhanced_rag_service.answer_annotation_basic(
                question=f"Explain the flow/process of: {query_text}",
                subject=request.subject,
                student_class=request.class_level,
                chapter=request.chapter
            )
            
            if source_chunks:
                context = "\n\n".join([chunk.get('text', '')[:600] for chunk in source_chunks[:4]])
                
                prompt = f"""Based on the textbook content below, create a clear TEXT-BASED flow diagram for "{query_text}" suitable for a Class {request.class_level} student.

**Textbook Content:**
{context}

**Instructions:**
1. Create a step-by-step flow using text and arrows
2. Use these symbols: v -> <- ^
3. Keep each step brief (5-8 words max)
4. Show relationships and progression clearly
5. Use boxes made with text characters
6. Make it easy to copy-paste and study from
7. Limit to 5-8 major steps
8. Use ONLY information from the textbook content

**Format Example:**
```
+---------------------+
|   Starting Point    |
+---------------------+
          v
+---------------------+
|   Key Process       |
+---------------------+
          v
    +-----+-----+
    v           v
+-------+   +-------+
| Path A|   | Path B|
+-------+   +-------+
```

Generate a similar flow diagram for "{query_text}":{lang_instruction}"""
                
                answer = gemini_service.generate_response(prompt)
            else:
                answer = f"""No flow information found in the book.

Try asking about:
- Specific processes or procedures
- Step-by-step concepts
- Sequential topics

Current search: "{request.selected_text}" in Class {request.class_level} {request.subject}"""
        
        logger.info(f"[OK] Annotation processed: {len(answer)} chars, {len(source_chunks)} sources")
        
        response_data = {
            "answer": answer,
            "action_type": request.action,
            "source_count": len(source_chunks)
        }

        await cache_service.set_annotation_cache(
            action=request.action,
            subject=request.subject,
            class_level=request.class_level,
            selected_text=request.selected_text,
            response_data=response_data,
            image_data=request.image_data
        )

        return AnnotationResponse(**response_data)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ERROR] Annotation error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

