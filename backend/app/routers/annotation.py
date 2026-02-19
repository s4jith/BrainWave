"""
Annotation Router - Text annotation with AI assistance (Define, Elaborate, Flow)

Supports multilingual input/output - responds in the same language as the selected text.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Literal
from app.services.enhanced_rag_service import enhanced_rag_service
from app.services.gemini_service import gemini_service
from app.services.summary_cache_service import summary_cache_service
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
    action: Literal["define", "elaborate", "stick_flow", "summarize_page", "summarize_chapter"] = Field(..., description="AI action to perform")
    class_level: int = Field(..., ge=5, le=12, description="Student's class level")
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
    - `summarize_page`: Comprehensive summary of the current page
    - `summarize_chapter`: Complete chapter summary with all major topics
    
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
        
        subject_to_lang = {
            "hindi": "hi",
            "urdu": "ur",
            "tamil": "ta",
            "telugu": "te",
            "bengali": "bn",
            "marathi": "mr",
            "gujarati": "gu",
            "kn": "kn",
            "ml": "ml",
            "pa": "pa",
            "english": "en",
            "physics": "en",
            "chemistry": "en",
            "biology": "en",
            "mathematics": "en",
            "math": "en",
            "maths": "en",
            "social science": "en",
            "history": "en",
            "geography": "en",
            "civics": "en",
            "economics": "en",
            "science": "en",
        }
        language_hint = subject_to_lang.get(request.subject.lower(), "en")
        
        if request.image_data:
            logger.info(f"[IMAGE] Screenshot doubt - using Gemini Vision OCR directly...")
            
            try:
                import base64
                import asyncio
                
                if request.image_data.startswith('data:'):
                    b64_data = request.image_data.split(',', 1)[1]
                else:
                    b64_data = request.image_data
                    
                image_bytes = base64.b64decode(b64_data)
                
                vision_prompt = """Extract the main educational text from this textbook screenshot. 
                If it contains a question, output the question. 
                If it contains a paragraph, output the paragraph.
                Do not describe the UI, just give the content text.
                Output ONLY the extracted text."""
                
                extracted_text_vision = await asyncio.to_thread(
                    gemini_service.generate_response_with_image,
                    prompt=vision_prompt,
                    image_bytes=image_bytes
                )
                
                if extracted_text_vision and len(extracted_text_vision.strip()) > 3:
                     query_text = extracted_text_vision.strip()
                     logger.info(f"   Gemini Vision extracted: '{query_text[:100]}'")
                else:
                     logger.warning("    Gemini Vision failed to extract meaningful text")
                     raise HTTPException(status_code=400, detail="Could not extract text from image")
                     
            except Exception as ve:
                logger.error(f"    Gemini Vision failed: {ve}")
                raise HTTPException(status_code=500, detail="Image OCR failed")
        
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
                    
                    prompt = f"""You are a helpful tutor for Class {request.class_level} {request.subject} students.
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
                
                prompt = f"""You are a helpful tutor for Class {request.class_level} {request.subject} students.
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
                
                prompt = f"""You are a helpful tutor for Class {request.class_level} {request.subject} students.
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
                prompt = f"""You are a tutor for Class {request.class_level} {request.subject}.
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
        
        elif request.action == "summarize_page":
            logger.info(f"[SUMMARIZE_PAGE] Summarizing page {request.page_number or 'unknown'}")
            
            cached_summary = await summary_cache_service.get_cached_summary(
                summary_type="page",
                subject=request.subject,
                class_level=request.class_level,
                chapter=request.chapter,
                page_number=request.page_number
            )
            
            if cached_summary:
                logger.info(f"[CACHE HIT] Returning cached page summary for page {request.page_number}")
                answer = cached_summary["summary"]
                source_chunks = []
            elif request.image_data:
                import base64
                import asyncio
                
                if request.image_data.startswith('data:'):
                    b64_data = request.image_data.split(',', 1)[1]
                else:
                    b64_data = request.image_data
                    
                image_bytes = base64.b64decode(b64_data)
                
                subject_lower = request.subject.lower()
                if subject_lower == "hindi":
                    lang_prompt = "\n\nIMPORTANT: Provide the summary in Hindi using Devanagari script."
                elif subject_lower == "urdu":
                    lang_prompt = "\n\nIMPORTANT: Provide the summary in Urdu using Nastaliq script."
                else:
                    lang_prompt = ""
                
                vision_prompt = f"""You are an educational assistant helping a Class {request.class_level} student studying {request.subject}.

Analyze this textbook page and create a comprehensive summary that:
1. Identifies the main topic/concept covered
2. Lists key points in bullet format
3. Highlights important definitions, formulas, or facts
4. Notes any examples or illustrations
5. Keeps the language simple and clear for a Class {request.class_level} student

Format your response as:
**Topic:** [Main topic of the page]

**Key Points:**
- [Point 1]
- [Point 2]
- [Point 3]

**Important Details:**
- [Any formulas, definitions, or critical facts]{lang_prompt}"""
                
                answer = await asyncio.to_thread(
                    gemini_service.generate_response_with_image,
                    prompt=vision_prompt,
                    image_bytes=image_bytes
                )
                
                if not answer or len(answer.strip()) < 10:
                    answer = "Unable to generate page summary. Please try again or select specific text for a focused explanation."
                else:
                    await summary_cache_service.save_summary(
                        summary_type="page",
                        subject=request.subject,
                        class_level=request.class_level,
                        chapter=request.chapter,
                        summary=answer,
                        page_number=request.page_number
                    )
                    logger.info(f"[CACHE SAVED] Page summary cached for page {request.page_number}")
                
                source_chunks = []
            else:
                logger.info(f"   No image data, using efficient RAG for page summary (page {request.page_number})")
                
                answer, source_chunks = enhanced_rag_service.answer_annotation_basic(
                    question=f"Summarize the main topics and key points covered on page {request.page_number} of chapter {request.chapter}.",
                    subject=request.subject,
                    student_class=request.class_level,
                    chapter=request.chapter
                )
                
                if answer and len(answer.strip()) > 20:
                    subject_lower = request.subject.lower()
                    if subject_lower == "hindi":
                        lang_prompt = "\n\nIMPORTANT: Write in Hindi using Devanagari script."
                    elif subject_lower == "urdu":
                        lang_prompt = "\n\nIMPORTANT: Write in Urdu using Nastaliq script."
                    else:
                        lang_prompt = ""
                    
                    format_prompt = f"""Reformat this content as a concise page summary for a Class {request.class_level} student:

{answer}

Format as:
**Main Topic:** [Topic]
**Key Points:**
- [3-5 bullet points]
**Important Notes:**
- [Any critical formulas/definitions]{lang_prompt}"""
                    
                    answer = gemini_service.generate_response(format_prompt)
                    
                    await summary_cache_service.save_summary(
                        summary_type="page",
                        subject=request.subject,
                        class_level=request.class_level,
                        chapter=request.chapter,
                        summary=answer,
                        page_number=request.page_number
                    )
                    logger.info(f"[CACHE SAVED] Page summary cached for page {request.page_number}")
                else:
                    answer = f"Unable to find content for page {request.page_number}. The content may not be indexed yet. Try using the Doubt button to select specific text for summarization."
                    source_chunks = []
        
        elif request.action == "summarize_chapter":
            logger.info(f"[SUMMARIZE_CHAPTER] Summarizing chapter {request.chapter or 'unknown'}")
            
            if not request.chapter:
                answer = "Chapter number is required for chapter summarization."
                source_chunks = []
            else:
                cached_summary = await summary_cache_service.get_cached_summary(
                    summary_type="chapter",
                    subject=request.subject,
                    class_level=request.class_level,
                    chapter=request.chapter,
                    page_number=None
                )
                
                if cached_summary:
                    logger.info(f"[CACHE HIT] Returning cached chapter summary for chapter {request.chapter}")
                    answer = cached_summary["summary"]
                    source_chunks = []
                else:
                    logger.info(f"[CHAPTER SUMMARY] Using deepdive RAG for comprehensive chapter content")
                    rag_answer, source_chunks = await enhanced_rag_service.answer_question_deepdive(
                        question=f"Explain all the main topics, concepts, definitions, formulas, and examples covered in chapter {request.chapter}. Include everything important from the chapter.",
                        subject=request.subject,
                        student_class=request.class_level,
                        chapter=request.chapter
                    )
                    
                    if rag_answer and len(rag_answer.strip()) > 50:
                        subject_lower = request.subject.lower()
                        if subject_lower == "hindi":
                            lang_prompt = "\n\nIMPORTANT: Write the entire summary in Hindi using Devanagari script."
                        elif subject_lower == "urdu":
                            lang_prompt = "\n\nIMPORTANT: Write the entire summary in Urdu using Nastaliq script."
                        else:
                            lang_prompt = ""
                        
                        prompt = f"""You are an expert tutor creating a DETAILED and COMPREHENSIVE chapter summary for a Class {request.class_level} student studying {request.subject}.

This is Chapter {request.chapter}. The student needs a thorough summary to understand and revise the entire chapter content.

**Source Content from Chapter:**
{rag_answer}

**CRITICAL INSTRUCTIONS:**
- This is the ONLY summary the student will receive for this chapter - make it COUNT
- Be EXTREMELY THOROUGH and DETAILED - cover ALL major topics mentioned in the source
- Write AT LEAST 1000-1500 words (this is a chapter summary, not a brief overview!)
- Include specific examples, explanations, and applications from the content
- Make it comprehensive enough for exam preparation and revision
- DO NOT truncate or cut short - complete the ENTIRE summary

**Required Format:**

[Write 4-6 sentences explaining what this chapter is about, its importance in the curriculum, prerequisites if any, and what students will learn by the end]

- Comprehensive explanation of the topic (5-7 sentences minimum)
- All key points and subtopics under this topic
- Examples or illustrations mentioned in the textbook
- How this connects to other concepts in the chapter or subject
- Common mistakes students make with this topic

- Comprehensive explanation (5-7 sentences minimum)
- Key points and subtopics
- Practical applications or examples
- Step-by-step methods if applicable

[Continue this pattern for ALL major topics in the chapter - do not skip any!]

- **[Term 1]**: [Complete definition with detailed explanation and example]
- **[Term 2]**: [Complete definition with detailed explanation and example]
- **[Term 3]**: [Complete definition with detailed explanation and example]
[Include ALL important terms from the chapter - aim for at least 5-10 terms]

- **[Formula/Fact 1]**: [The formula or fact] - [When to use it] - [Example of application]
- **[Formula/Fact 2]**: [The formula or fact] - [When to use it] - [Example of application]
[Include all formulas, theorems, rules, or critical facts from the chapter]

- **Example 1**: [Describe what the example demonstrates and the key learning]
- **Example 2**: [Describe what the example demonstrates and the key learning]
[Mention key examples discussed in the chapter with their purpose]

1. [Most important concept from the chapter with brief explanation]
2. [Second key takeaway with brief explanation]
3. [Third key takeaway with brief explanation]
4. [Fourth key takeaway with brief explanation]
5. [Fifth key takeaway with brief explanation]
6. [Additional takeaways if the chapter is content-heavy]

- [Point 1 - one line summary]
- [Point 2 - one line summary]
- [Point 3 - one line summary]
- [Point 4 - one line summary]
- [Point 5 - one line summary]
- [Point 6 - one line summary]
- [Point 7 - one line summary]
- [Point 8 - one line summary]

- What type of questions are commonly asked from this chapter?
- Key tips for scoring well in exams{lang_prompt}"""
                        
                        answer = gemini_service.generate_response(prompt, max_output_tokens=4000)
                        
                        await summary_cache_service.save_summary(
                            summary_type="chapter",
                            subject=request.subject,
                            class_level=request.class_level,
                            chapter=request.chapter,
                            summary=answer,
                            page_number=None,
                            chapter_title=f"Chapter {request.chapter}"
                        )
                        logger.info(f"[CACHE SAVED] Chapter summary cached for chapter {request.chapter}")
                    else:
                        answer = f"""Unable to find content for Chapter {request.chapter} in Class {request.class_level} {request.subject}.

Possible reasons:
- Chapter number might be incorrect
- Content not yet added to the system
- Subject or class level mismatch

Please verify the chapter number and try again."""
                        source_chunks = []
        
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
    
    except Exception as e:
        logger.error(f"[ERROR] Annotation error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/quick-define")
async def quick_define(
    text: str = Query(..., description="Text to define"),
    class_level: int = Query(..., ge=5, le=12),
    subject: str = Query(..., description="Subject name")
):
    """
    [FAST] Ultra-fast definition endpoint (optimized for speed).
    
    Returns just the definition without extra processing.
    Perfect for quick lookups while reading.
    """
    try:
        answer, source_chunks = await enhanced_rag_service.answer_question_basic(
            question=f"What is {text}?",
            subject=subject,
            student_class=class_level,
            chapter=None
        )
        
        if source_chunks:
            context = source_chunks[0].get('text', '')[:300]
            
            prompt = f"""Give a one-sentence definition of "{text}" based on this textbook excerpt:

{context}

Definition:"""
            
            definition = gemini_service.generate_response(prompt)
            
            return {"definition": definition.strip()}
        else:
            return {"definition": f"Term '{text}' not found in textbook."}
    
    except Exception as e:
        logger.error(f"Quick define error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
