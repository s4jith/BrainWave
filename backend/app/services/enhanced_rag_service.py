"""
Enhanced Multi-Index RAG Service

Implements intelligent cross-index retrieval:
- Basic Mode: Current class + relevant lower classes (textbook only)
- Deep Dive Mode: From fundamentals (earliest class) + web content for comprehensive understanding
- Triple-Index: Textbook + Web Scraped + LLM Generated content
"""

from app.services.gemini_service import gemini_service
from app.db.mongo import pinecone_db, pinecone_llm_db
from app.services.llm_storage_service import llm_storage_service
from app.services.subject_classifier import subject_classifier
from app.utils.tutor_persona import get_tutor_system_prompt
import logging
import re
import asyncio
from typing import List, Dict, Tuple, Optional
from app.utils.embedding_helper import generate_embedding as _embed_rest, EMBEDDING_MODEL

logger = logging.getLogger(__name__)

# ── Identity / Greeting Detection ──────────────────────────────────────────
# Comprehensive tuple of phrases that indicate the user is asking about the AI
# itself, its identity, or simply greeting it.  Easy to extend — just append
# a new phrase.  All matching is case-insensitive.
#
# Categories covered:
#   • Name / identity questions
#   • "What AI is this" / app-identity questions
#   • Capability questions ("what can you do")
#   • Greetings / small-talk

_IDENTITY_PHRASES: tuple = (
    # ── Name / identity ─────────────────────────────────────────
    "what is your name",
    "what's your name",
    "whats your name",
    "who are you",
    "what are you",
    "your name",
    "tell me your name",
    "tell me about yourself",
    "introduce yourself",
    "what should i call you",
    "how can i call you",
    "how do i call you",
    "how should i call you",
    "what do i call you",
    "what to call you",
    "may i know your name",
    "can i know your name",
    "do you have a name",
    "you have a name",
    "what is this ai",
    "which ai is this",
    "which ai are you",
    "what ai is this",
    "what ai are you",
    "are you a bot",
    "are you ai",
    "are you an ai",
    "are you a robot",
    "are you chatgpt",
    "are you gemini",
    "are you gpt",
    "are you human",
    "are you real",
    "what model are you",
    "what llm are you",
    "who made you",
    "who created you",
    "who built you",
    "who developed you",
    "what is brainwave",
    "what's brainwave",
    "what is this app",
    "what is this chatbot",
    "what is this bot",
    # ── Capability / purpose questions ──────────────────────────
    "what can you do",
    "what do you do",
    "how can you help me",
    "how can you help",
    "what are your capabilities",
    "what are you capable of",
)

_GREETING_PHRASES: tuple = (
    "hi",
    "hello",
    "hey",
    "hola",
    "namaste",
    "good morning",
    "good afternoon",
    "good evening",
    "good night",
    "howdy",
    "sup",
    "wassup",
    "whats up",
    "what's up",
)

BRAINWAVE_IDENTITY_RESPONSE = (
    "Hello! My name is **Brainwave** 🧠\n\n"
    "I'm your AI-powered NCERT learning assistant. "
    "I can help you understand concepts from your textbooks, "
    "answer questions, and guide you through topics across all subjects and classes.\n\n"
    "Feel free to ask me anything related to your studies!"
)

BRAINWAVE_GREETING_RESPONSE = (
    "Hello! 👋 I'm **Brainwave**, your AI learning assistant.\n\n"
    "How can I help you today? Ask me any question related to your studies!"
)


def _normalise(text: str) -> str:
    """Lower-case, collapse whitespace, strip punctuation for matching."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)   # drop punctuation
    text = re.sub(r"\s+", " ", text)       # collapse spaces
    return text


def detect_identity_or_greeting(question: str) -> Optional[str]:
    """Return a canned response if the question is an identity/greeting query, else None."""
    normalised = _normalise(question)

    # Check identity phrases — substring match so "hey what is your name?" also works
    for phrase in _IDENTITY_PHRASES:
        if phrase in normalised:
            return BRAINWAVE_IDENTITY_RESPONSE

    # Greetings — only match if the entire message IS a greeting (not embedded in a real question)
    for phrase in _GREETING_PHRASES:
        if normalised == phrase or normalised == phrase + " brainwave":
            return BRAINWAVE_GREETING_RESPONSE

    return None

class EnhancedRAGService:
    """
    Enhanced RAG service with multi-index progressive learning.
    
    Features:
    - Context-aware retrieval from multiple class levels
    - Two modes: Basic (quick answers) and Deep Dive (comprehensive from fundamentals)
    - Intelligent namespace/index routing
    """
    
    def __init__(self):
        self.gemini = gemini_service
        self.textbook_db = pinecone_db
        self.llm_db = pinecone_llm_db
        
        self.llm_storage = llm_storage_service
        
        self.embedding_model_name = EMBEDDING_MODEL
        logger.info("RAG Service: Using Gemini gemini-embedding-001 for embeddings")
        logger.info("Dual-Index System: Textbook + LLM content")
        
        self.subject_namespaces = {
            "Mathematics": "maths",
            "Physics": "physics",
            "Chemistry": "chemistry",
            "Biology": "biology",
            "Social Science": "social_science",
            "History": "history",
            "Geography": "geography",
            "Civics": "civics",
            "Economics": "economics",
            "English": "english",
            "Hindi": "hindi"
        }
        
        self.subject_class_ranges = {
            "Mathematics": list(range(1, 13)),
            "Physics": list(range(1, 13)),
            "Chemistry": list(range(1, 13)),
            "Biology": list(range(1, 13)),
            "Social Science": list(range(1, 13)),
            "History": list(range(1, 13)),
            "Geography": list(range(1, 13)),
            "Civics": list(range(1, 13)),
            "Economics": list(range(1, 13)),
            "English": list(range(1, 13)),
            "Hindi": list(range(1, 13)),
            "Science": list(range(1, 13)),
            "Arts": list(range(1, 13)),
            "EVS": list(range(1, 13)),
        }

    def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding using Gemini gemini-embedding-001 via REST API.
        
        CRITICAL: Must use same model as PDF upload for retrieval to work!
        Returns 768-dimensional embedding vector.
        """
        try:
            from app.services.gemini_key_manager import gemini_key_manager
            api_key = gemini_key_manager.get_available_key()
            
            return _embed_rest(
                text=text,
                api_key=api_key,
                task_type="RETRIEVAL_QUERY"
            )
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            raise

    def get_namespace(self, subject: str) -> str:
        """Get Pinecone namespace for subject"""
        return self.subject_namespaces.get(subject, subject.lower().replace(" ", "_"))
    
    def get_prerequisite_classes(
        self,
        subject: str,
        student_class: int,
        mode: str = "basic"
    ) -> List[int]:
        """
        Get list of classes to search based on mode.
        
        Deep dive: searches from Class 1 up to the student's current class.
                   Never goes BEYOND the student's class (e.g. Class 6 student
                   searches 1-6 only). Advanced content is only provided if
                   the student explicitly asks for it.
        Quick:     searches the student's current class only.
        
        Args:
            subject: Subject name
            student_class: Student's current class (1-12)
            mode: "basic"/"quick" or "deepdive"
        
        Returns:
            List of class numbers to search, ordered from earliest to current
        """
        # Default range 1-12 for any subject
        available_classes = self.subject_class_ranges.get(subject, list(range(1, 13)))
        # NEVER go beyond the student's current class
        available_classes = [c for c in available_classes if c <= student_class]
        
        if mode in ("basic", "quick"):
            # Quick mode: current class only
            return [student_class] if student_class in available_classes else available_classes[-1:]
        
        else:
            # Deep dive: all classes from 1 up to student's class
            return available_classes if available_classes else [student_class]
    
    def query_multi_class(
        self,
        query_text: str,
        subject: str,
        student_class: int,
        chapter: Optional[int] = None,
        mode: str = "basic",
        chunks_per_class: int = 5,
        query_embedding: Optional[List[float]] = None
    ) -> Tuple[List[Dict], Dict[int, int]]:
        """
        Query across multiple class levels for progressive learning.
        
        Args:
            query_text: Student's question
            subject: Subject name
            student_class: Current class level
            chapter: Optional chapter filter (None for all chapters)
            mode: "basic" or "deepdive"
            chunks_per_class: Max chunks per class level
        
        Returns:
            Tuple of (chunks, class_distribution)
        """
        try:
            if query_embedding is None:
                query_embedding = self.generate_embedding(query_text)
            
            classes_to_search = self.get_prerequisite_classes(subject, student_class, mode)
            logger.info(f" {mode.upper()} mode: Searching classes {classes_to_search} for {subject}")
            
            namespace = self.get_namespace(subject)
            
            all_chunks = []
            class_distribution = {}
            
            class_filter_int = [int(c) for c in classes_to_search]
            class_filter_str = [str(c) for c in classes_to_search]
            
            metadata_filter = {"class_level": {"$in": class_filter_int}}
            
            if chapter is not None:
                metadata_filter["chapter_number"] = int(chapter)
            
            logger.info(f"   Stage 1 Pre-filter: namespace={namespace}, class={class_filter_int}, chapter={chapter}")
            
            try:
                try:
                    results = self.textbook_db.index.query(
                        namespace=namespace,
                        vector=query_embedding,
                        top_k=10,
                        include_metadata=True,
                        filter=metadata_filter
                    )
                    matches = results.get('matches', [])
                except Exception as filter_err:
                    logger.warning(f"    class_level int filter failed: {filter_err}")
                    matches = []
                
                if len(matches) == 0:
                    logger.info(f"    No matches with class_level filter, trying 'class' (string) filter...")
                    legacy_filter = {"class": {"$in": class_filter_str}}
                    if chapter is not None:
                        legacy_filter["chapter_number"] = str(chapter)
                    try:
                        results = self.textbook_db.index.query(
                            namespace=namespace,
                            vector=query_embedding,
                            top_k=10,
                            include_metadata=True,
                            filter=legacy_filter
                        )
                        matches = results.get('matches', [])
                        if matches:
                            logger.info(f"   Legacy 'class' filter matched: {len(matches)} results")
                    except Exception:
                        matches = []
                
                logger.info(f"   Stage 2 ANN search: {len(matches)} matches from filtered subset")
                
                if len(matches) == 0:
                    logger.info(f"    No matches with any filter, retrying without metadata filter...")
                    results = self.textbook_db.index.query(
                        namespace=namespace,
                        vector=query_embedding,
                        top_k=10,
                        include_metadata=True
                    )
                    matches = results.get('matches', [])
                    logger.info(f"   🔄 Fallback: {len(matches)} matches without filter")
                
                # If we have matches but best score is low (wrong chapter),
                # retry without chapter filter to search all chapters
                if matches and chapter is not None:
                    best_score = max((m.get('score', 0) for m in matches), default=0)
                    if best_score < 0.3:
                        logger.info(f"   ⚠️ Best score {best_score:.3f} < 0.3 with chapter={chapter} filter — retrying across ALL chapters...")
                        no_chapter_filter = {"class_level": {"$in": class_filter_int}}
                        try:
                            results2 = self.textbook_db.index.query(
                                namespace=namespace,
                                vector=query_embedding,
                                top_k=10,
                                include_metadata=True,
                                filter=no_chapter_filter
                            )
                            matches2 = results2.get('matches', [])
                        except Exception:
                            matches2 = []
                        if not matches2:
                            try:
                                results2 = self.textbook_db.index.query(
                                    namespace=namespace,
                                    vector=query_embedding,
                                    top_k=10,
                                    include_metadata=True,
                                    filter={"class": {"$in": class_filter_str}}
                                )
                                matches2 = results2.get('matches', [])
                            except Exception:
                                matches2 = []
                        if matches2:
                            best2 = max((m.get('score', 0) for m in matches2), default=0)
                            if best2 > best_score:
                                logger.info(f"   ✅ All-chapter search found better matches (best score: {best2:.3f})")
                                matches = matches2

                threshold = 0.03
                
                for match in matches:
                    score = match.get('score', 0)
                    
                    if score >= threshold:
                        metadata = match.get('metadata', {})
                        chunk_class = metadata.get('class_level', metadata.get('class', 0))
                        
                        try:
                            chunk_class = int(chunk_class) if chunk_class else 0
                        except (ValueError, TypeError):
                            chunk_class = 0
                        
                        effective_score = score * 1.1 if chunk_class == student_class else score
                        
                        chunk_data = {
                            'text': metadata.get('text', ''),
                            'class': chunk_class,
                            'subject': subject,
                            'chapter': metadata.get('chapter_number', metadata.get('chapter')),
                            'page': metadata.get('page_number', metadata.get('page')),
                            'score': effective_score,
                            'source': 'textbook'
                        }
                        all_chunks.append(chunk_data)
                        
                        class_distribution[chunk_class] = class_distribution.get(chunk_class, 0) + 1
                
                logger.info(f"   Stage 3 Post-filter: {len(all_chunks)} chunks passed threshold (≥{threshold})")
                        
            except Exception as query_error:
                logger.warning(f"  ✗ Query failed: {query_error}")
            
            all_chunks.sort(key=lambda x: -x['score'])
            
            logger.info(f"📊 Total chunks retrieved: {len(all_chunks)} | Classes: {dict(class_distribution)}")
            
            return all_chunks, class_distribution
            
        except Exception as e:
            logger.error(f" Multi-class query failed: {e}")
            return [], {}
    
    def query_llm_content(
        self,
        query_text: str,
        subject: str,
        top_k: int = 3,
        similarity_threshold: float = 0.65,
        query_embedding: Optional[List[float]] = None
    ) -> List[Dict]:
        """
        Query stored LLM-generated answers for similar questions.
        
        Args:
            query_text: Student's question
            subject: Subject name
            top_k: Number of results
            similarity_threshold: Minimum similarity score (0.0-1.0) to reuse answer
        
        Returns:
            List of LLM-generated answer chunks
        """
        try:
            if not self.llm_db or not self.llm_db.index:
                logger.debug("LLM content DB not available")
                return []
            
            if query_embedding is None:
                query_embedding = self.generate_embedding(query_text)
            
            results = self.llm_db.query(
                vector=query_embedding,
                subject=subject,
                top_k=top_k
            )
            
            all_matches = results.get('matches', [])
            if all_matches:
                top_scores = [f"{m.get('score', 0):.3f}" for m in all_matches[:3]]
                logger.info(f"💡 LLM index check: Found {len(all_matches)} similar answers (top scores: {top_scores})")
            
            llm_chunks = []
            for match in results.get('matches', []):
                if match.get('score', 0) >= similarity_threshold:
                    metadata = match.get('metadata', {})
                    
                    self.llm_db.increment_usage(match['id'], subject)
                    
                    chunk_data = {
                        'text': metadata.get('answer', ''),
                        'source': 'llm_generated',
                        'score': match.get('score', 0),
                        'topic': metadata.get('topic', 'general'),
                        'quality_score': metadata.get('quality_score', 0.9),
                        'usage_count': metadata.get('usage_count', 0) + 1
                    }
                    llm_chunks.append(chunk_data)
            
            if llm_chunks:
                scores_list = [f"{c['score']:.2f}" for c in llm_chunks]
                logger.info(f"💡 LLM content: {len(llm_chunks)} stored answers retrieved (scores: {scores_list})")
            elif all_matches:
                logger.info(f"💡 LLM content: 0 answers met threshold ({similarity_threshold:.2f}+), will generate new answer")
            
            return llm_chunks
            
        except Exception as e:
            logger.warning(f"LLM content query failed: {e}")
            return []
    
    def generate_basic_answer(
        self,
        question: str,
        textbook_chunks: List[Dict],
        class_distribution: Dict[int, int],
        student_class: int,
        subject: str
    ) -> str:
        """
        Generate basic mode answer using textbook content from multiple classes.
        
        Args:
            question: Student's question
            textbook_chunks: Retrieved chunks from multiple classes
            class_distribution: Number of chunks per class
            student_class: Student's current class
            subject: Subject name
        
        Returns:
            Generated answer
        """
        if not textbook_chunks:
            logger.info(" No RAG content found (Basic Mode).")
            return "The content is not found in the book, ask some other questions related to your subject."
        
        context_parts = []
        current_class = None
        
        for chunk in textbook_chunks[:15]:
            chunk_class = chunk.get('class')
            
            if chunk_class != current_class:
                if chunk_class < student_class:
                    context_parts.append(f"\n**FROM CLASS {chunk_class} (Foundation):**\n")
                else:
                    context_parts.append(f"\n**FROM CLASS {chunk_class}:**\n")
                current_class = chunk_class
            
            context_parts.append(chunk['text'])
        
        combined_context = "\n\n".join(context_parts)
        
        classes_used = sorted(class_distribution.keys())
        if len(classes_used) > 1:
            progressive_note = f"(Using content from Classes {', '.join(map(str, classes_used))} to build complete understanding)"
        else:
            progressive_note = ""
        
        lang_instruction = ""
        try:
            from app.utils.language_detection import detect_language_with_confidence
            lang, confidence = detect_language_with_confidence(question)
            lang_names = {"hi": "Hindi", "ur": "Urdu", "ta": "Tamil", "te": "Telugu", "bn": "Bengali", "mr": "Marathi", "gu": "Gujarati", "kn": "Kannada", "ml": "Malayalam", "pa": "Punjabi"}
            if lang != "en" and confidence > 0.5 and lang in lang_names:
                lang_instruction = f"\n6. IMPORTANT: The question is in {lang_names[lang]}. You MUST respond entirely in {lang_names[lang]} using the same script."
                logger.info(f"   🌐 Detected {lang_names[lang]} input, will respond in same language")
        except Exception as e:
            logger.debug(f"Language detection skipped: {e}")
        
        # Detect if the student is asking for practice questions / sums
        practice_keywords = ["give me", "provide", "list", "show me", "practice", "practise", "sums", "questions", "problems", "exercises", "solve", "worksheet", "sample questions", "important questions", "previous year", "pyq"]
        question_lower = question.lower()
        is_practice_request = sum(1 for kw in practice_keywords if kw in question_lower) >= 2 or \
            any(phrase in question_lower for phrase in ["give me sums", "give me questions", "give me problems", "practice questions", "practice sums", "practise sums", "practise questions", "sample questions", "important questions", "previous year"])

        if is_practice_request:
            persona = get_tutor_system_prompt(student_class, subject)
            prompt = f"""{persona}

STUDENT REQUEST: {question}

REFERENCE CONTENT FROM TEXTBOOK:
{combined_context}

{progressive_note}

The student is asking for PRACTICE QUESTIONS. Follow these rules:

1. Do NOT explain the topic or chapter. Do NOT give theory or concept summaries.
2. Go STRAIGHT to giving questions.
3. First, give questions that appear in the NCERT textbook (from the REFERENCE CONTENT). Label them:
   **📖 Book Questions (NCERT):**
   Number each question.
4. Then give additional practice questions of similar difficulty. Label them:
   **📝 Additional Practice Questions:**
   Number each question continuing from the book questions.
5. For Maths/Science: include numerical problems, word problems, and application-based questions.
   For other subjects: include short answer, long answer, and value-based questions.
6. Give MINIMUM 10 book questions and MINIMUM 10 additional questions (total 20+). More is better.
7. Cover different exercises and sections from the chapter — pick a good variety.
8. Additional questions should test the same concepts but with different numbers/scenarios.
9. Keep it clean and well-formatted. Just questions, no answers (unless the student specifically asked for solutions).{lang_instruction}

Generate the practice questions now:"""
        else:
            persona = get_tutor_system_prompt(student_class, subject)
            prompt = f"""{persona}

STUDENT QUESTION: {question}

REFERENCE CONTENT:
{combined_context}

{progressive_note}

INSTRUCTIONS:
1. Answer the question using the REFERENCE CONTENT above as your primary source whenever it is relevant.
2. If the reference content directly covers the topic, use it to give a clear, detailed answer.
3. If the reference content does NOT directly cover the topic asked, but the question IS related to {subject} (e.g., a historical figure, a concept, a definition within the subject), answer from your own knowledge as an expert {subject} tutor. Do NOT say the content is not found — just answer.
4. ONLY respond with "The content is not found in the book, ask some other questions related to your subject." if the question is completely unrelated to {subject}.
5. Do NOT start with preamble like "Based on your textbook" - just give the answer directly.
6. Do NOT describe what the reference content contains instead of answering.{lang_instruction}

Generate a clear, direct answer:"""
        
        response_tokens = 16384 if is_practice_request else 8192
        answer = self.gemini.generate_response(prompt, max_output_tokens=response_tokens)
        logger.info(f"✓ Basic answer generated ({len(answer)} chars)")
        
        return answer
    
    def generate_deepdive_answer(
        self,
        question: str,
        textbook_chunks: List[Dict],
        web_chunks: List[Dict],
        class_distribution: Dict[int, int],
        student_class: int,
        subject: str
    ) -> str:
        """
        Generate comprehensive deep dive answer starting from fundamentals.
        
        Args:
            question: Student's question
            textbook_chunks: Retrieved chunks from all prerequisite classes
            web_chunks: Retrieved web content chunks
            class_distribution: Number of textbook chunks per class
            student_class: Student's current class
            subject: Subject name
        
        Returns:
            Comprehensive answer
        """
        if not textbook_chunks and not web_chunks:
            return f"I couldn't find enough information to provide a comprehensive answer. Try asking about specific topics from your {subject} curriculum!"
        
        context_sections = []
        
        if textbook_chunks:
            textbook_context = []
            classes_used = sorted(set(chunk.get('class') for chunk in textbook_chunks))
            
            context_sections.append(f"**TEXTBOOK CONTENT (Classes {', '.join(map(str, classes_used))}):**\n")
            
            for class_level in classes_used:
                class_chunks = [c for c in textbook_chunks if c.get('class') == class_level][:5]
                
                if class_level < student_class:
                    textbook_context.append(f"\n--- Foundation from Class {class_level} ---")
                else:
                    textbook_context.append(f"\n--- Class {class_level} ---")
                
                for chunk in class_chunks:
                    textbook_context.append(chunk['text'])
            
            context_sections.append("\n\n".join(textbook_context))
        
        if web_chunks:
            context_sections.append("\n\n**ADDITIONAL CONTEXT (Background Information):**\n")
            web_context = [chunk['text'] for chunk in web_chunks[:5]]
            context_sections.append("\n\n".join(web_context))
        
        combined_context = "\n\n".join(context_sections)
        
        earliest_class = min(class_distribution.keys()) if class_distribution else student_class
        
        lang_instruction = ""
        try:
            from app.utils.language_detection import detect_language_with_confidence
            lang, confidence = detect_language_with_confidence(question)
            lang_names = {"hi": "Hindi", "ur": "Urdu", "ta": "Tamil", "te": "Telugu", "bn": "Bengali", "mr": "Marathi", "gu": "Gujarati", "kn": "Kannada", "ml": "Malayalam", "pa": "Punjabi"}
            if lang != "en" and confidence > 0.5 and lang in lang_names:
                lang_instruction = f"\n7. IMPORTANT: The question is in {lang_names[lang]}. You MUST respond entirely in {lang_names[lang]} using the same script."
                logger.info(f"   🌐 Detected {lang_names[lang]} input, will respond in same language")
        except Exception as e:
            logger.debug(f"Language detection skipped: {e}")
        
        persona = get_tutor_system_prompt(student_class, subject)
        prompt = f"""{persona}

You are now in DEEP DIVE mode — provide a COMPREHENSIVE explanation.

STUDENT QUESTION: {question}

CONTENT (from Classes {earliest_class} to {student_class} + additional resources):
{combined_context}

DEEP DIVE MODE INSTRUCTIONS:
1. Answer the question using the CONTENT above as your primary source.
2. If the content is about a completely different topic than what's asked, respond with EXACTLY:
   "The content is not found in the book, ask some other questions related to your subject."
3. **Start from Fundamentals**: Begin with the most basic concept from the earliest class
4. **Progressive Building**: Build understanding step-by-step through class levels
5. **Structure**:
   - 🌱 **Fundamentals** (if using content from Classes {earliest_class}-{student_class-1})
   - **Core Concept** (Class {student_class} level understanding)
   -  **Deep Dive** (comprehensive explanation with examples, applications, significance)
   - 💡 **Key Takeaways** (summarize main points)
6. **Make it engaging**: Use analogies, examples, and clear explanations{lang_instruction}

Generate a thorough, well-structured deep dive explanation:"""
        
        answer = self.gemini.generate_response(prompt, max_output_tokens=16384)
        logger.info(f"✓ Deep dive answer generated ({len(answer)} chars)")
        
        return answer
    
    def generate_answer_from_multiple_sources(
        self,
        question: str,
        textbook_chunks: List[Dict],
        llm_chunks: List[Dict],
        web_chunks: List[Dict],
        class_distribution: Dict[int, int],
        student_class: int,
        subject: str,
        mode: str = "basic"
    ) -> str:
        """
        Generate answer using triple-index system (Textbook + LLM + Web).
        Prioritizes textbook content, enriches with LLM answers, supplements with web content.
        
        Args:
            question: Student's question
            textbook_chunks: Retrieved textbook chunks
            llm_chunks: Retrieved LLM-generated answer chunks
            web_chunks: Retrieved web content chunks
            class_distribution: Number of textbook chunks per class
            student_class: Student's current class
            subject: Subject name
            mode: "basic" or "deepdive"
        
        Returns:
            Generated answer
        """
        if not textbook_chunks and not llm_chunks and not web_chunks:
            logger.info(" No RAG content found for this question.")
            return "The content is not found in your textbook. Please try a different question."
        
        context_sections = []
        
        if textbook_chunks:
            classes_used = sorted(set(chunk.get('class') for chunk in textbook_chunks))
            context_sections.append(f"**PRIMARY SOURCE - NCERT Textbook (Classes {', '.join(map(str, classes_used))}):**\n")
            
            textbook_context = []
            for chunk in textbook_chunks[:10]:
                class_level = chunk.get('class', student_class)
                textbook_context.append(f"[Class {class_level}] {chunk['text']}")
            
            context_sections.append("\n\n".join(textbook_context))
        
        if llm_chunks:
            context_sections.append("\n\n**REFERENCE - Previously Generated Explanations:**\n")
            
            llm_context = []
            for chunk in llm_chunks[:2]:
                topic = chunk.get('topic', 'general')
                score = chunk.get('score', 0)
                llm_context.append(f"[Topic: {topic}, Relevance: {score:.2f}]\n{chunk['text']}")
            
            context_sections.append("\n\n".join(llm_context))
        
        if web_chunks:
            context_sections.append("\n\n**SUPPLEMENTARY - Web Resources:**\n")
            
            web_context = []
            for chunk in web_chunks[:5]:
                source_url = chunk.get('url', 'N/A')
                web_context.append(f"[Source: {source_url[:50]}...]\n{chunk['text']}")
            
            context_sections.append("\n\n".join(web_context))
        
        combined_context = "\n\n".join(context_sections)
        
        mode_description = "COMPREHENSIVE" if mode == "deepdive" else "FOCUSED"
        
        # ── Subject isolation instruction (avoids Physics ↔ Maths confusion) ──
        subject_isolation = ""
        if subject.lower() in ("physics", "maths", "mathematics", "science"):
            subject_isolation = (
                f"\n**SUBJECT ISOLATION ({subject}):**\n"
                f"- You are answering ONLY for the subject **{subject}**.\n"
                f"- The word 'sum' or 'problem' may appear in both Physics and Mathematics — "
                f"interpret it STRICTLY in the context of {subject}.\n"
                f"- If the subject is Physics, focus on physical laws, forces, energy, motion, etc.\n"
                f"- If the subject is Mathematics/Maths, focus on numbers, algebra, geometry, equations, etc.\n"
                f"- Never mix Physics concepts into a Maths answer or vice-versa.\n"
            )

        persona = get_tutor_system_prompt(student_class, subject)
        prompt = f"""{persona}

**RULES:**

1. Answer the question using the TEXTBOOK CONTENT below as your primary source.
2. If the textbook content is directly about the topic asked, give a clear answer from it.
3. If the textbook content is about a completely different topic than what the student asked, respond with EXACTLY:
   "The content is not found in the book, ask some other questions related to your subject."
4. Do NOT make up facts, formulas, or examples not present in the content.
5. Do NOT describe what the textbook content contains instead of answering.
6. If you can partially answer, answer what you can from the textbook.
{subject_isolation}
**STUDENT QUESTION:** {question}

**TEXTBOOK CONTENT:**
{combined_context}

**ANSWER FORMAT ({mode_description}):**
{'- Start from fundamentals and build up' if mode == 'deepdive' else '- Direct and concise answer'}
- Use headings and bullet points

Generate your answer:"""
        
        answer = self.gemini.generate_response(prompt, max_output_tokens=16384 if mode == 'deepdive' else 8192)
        
        sources_summary = f"Textbook: {len(textbook_chunks)}, LLM: {len(llm_chunks)}, Web: {len(web_chunks)}"
        logger.info(f"Answer generated ({len(answer)} chars) from {sources_summary}")
        
        return answer
    
    async def answer_question_basic(
        self,
        question: str,
        subject: str,
        student_class: int,
        chapter: Optional[int] = None
    ) -> Tuple[str, List[Dict]]:
        """
        Answer question in BASIC mode with triple-index system.
        Queries: Textbook + Web + LLM content.
        
        Args:
            question: Student's question
            subject: Subject name
            student_class: Current class level
            chapter: Optional chapter filter
        
        Returns:
            Tuple of (answer, source_chunks)
        """
        logger.info(f"BASIC MODE (Triple-Index): Class {student_class} {subject}")
        logger.info(f"   Question: {question[:100]}...")
        
        # Identity / greeting detection — bypass RAG entirely
        identity_response = detect_identity_or_greeting(question)
        if identity_response:
            logger.info("Identity/greeting detected — returning Brainwave response")
            return identity_response, []
        
        try:
            async def gen_embedding_async():
                return await asyncio.to_thread(self.generate_embedding, question)
            
            query_embedding, validation = await asyncio.gather(
                gen_embedding_async(),
                subject_classifier.classify(question)
            )
        except Exception as e:
            logger.error(f"Failed parallel init: {e}")
            return "I'm having trouble understanding that right now. Please try again.", []

        try:
            detected_subject = validation.get("detected_subject", "Unknown")
            confidence = validation.get("confidence", 0.0)
            
            logger.info(f" Subject Check: Detected='{detected_subject}' ({confidence:.2f}) vs Current='{subject}'")
            
            if confidence > 0.60 and detected_subject.lower() != subject.lower():
                 logger.warning(f" Subject mismatch blocked: User={subject}, Detected={detected_subject}")
                 return "The specific topic is not present in the book. Change the book or question.", []
                 
        except Exception as e:
            logger.warning(f"Subject validation failed (proceeding anyway): {e}")

        logger.info("   ⚡ Running parallel queries (textbook + LLM cache)...")
        
        async def query_textbook_async():
            return await asyncio.to_thread(
                self.query_multi_class,
                query_text=question,
                subject=subject,
                student_class=student_class,
                chapter=chapter,
                mode="basic",
                chunks_per_class=5,
                query_embedding=query_embedding
            )
        
        async def query_llm_async():
            return await asyncio.to_thread(
                self.query_llm_content,
                query_text=question,
                subject=subject,
                top_k=2,
                query_embedding=query_embedding
            )
        
        (textbook_chunks, class_dist), llm_chunks = await asyncio.gather(
            query_textbook_async(),
            query_llm_async()
        )
        
        best_score = textbook_chunks[0]['score'] if textbook_chunks else 0.0
        good_chunks = [c for c in textbook_chunks if c.get('score', 0) >= 0.05]
        logger.info(f"   📊 Best textbook score: {best_score:.3f}, Good chunks: {len(good_chunks)}/{len(textbook_chunks)}")
        logger.info(f"   ⚡ Parallel query complete")
        
        if llm_chunks and llm_chunks[0]['score'] >= 0.80:
            cached_answer = llm_chunks[0]['text']
            logger.info(f" CACHE HIT! Using cached answer (similarity: {llm_chunks[0]['score']:.3f}, topic: {llm_chunks[0].get('topic', 'N/A')})")
            logger.info(f"   Saved 1 Gemini API call (answer length: {len(cached_answer)} chars)")
            
            source_chunks = textbook_chunks + llm_chunks
            return cached_answer, source_chunks
        
        web_chunks = []
        
        all_chunks = textbook_chunks + llm_chunks + web_chunks
        
        answer = self.generate_answer_from_multiple_sources(
            question=question,
            textbook_chunks=textbook_chunks,
            llm_chunks=llm_chunks,
            web_chunks=web_chunks,
            class_distribution=class_dist,
            student_class=student_class,
            subject=subject,
            mode="basic"
        )
        
        not_found_messages = [
            "The content is not found",
            "not found in the book",
            "not found in your textbook"
        ]
        is_not_found = any(msg.lower() in answer.lower() for msg in not_found_messages)
        
        if is_not_found:
            logger.info(f"🔄 RAG returned 'not found' - generating direct answer for valid {subject} question...")
            
            persona = get_tutor_system_prompt(student_class, subject)
            direct_prompt = f"""{persona}

STUDENT QUESTION: {question}

**IMPORTANT CONSTRAINTS:**
- ONLY answer if the question is related to education, academics, or school subjects.
- If the question is about entertainment, social media, celebrities, violence, or anything
  NOT related to studies/education, respond with EXACTLY:
  "I can only help with education-related questions. Please ask something related to your studies."
- Do NOT mix Physics and Maths concepts — answer only for {subject}.

Provide a clear, educational answer.

Structure:
- Start with a simple definition/explanation
- Give 1-2 examples
- Summarize key points

Keep it concise but informative (200-400 words)."""
            
            answer = self.gemini.generate_response(direct_prompt, max_output_tokens=1000)
            logger.info(f"✓ Direct Gemini answer generated ({len(answer)} chars)")
            
            topic = self.llm_storage._extract_topic(question)
            self.llm_storage.store_answer(
                question=question,
                answer=answer,
                subject=subject,
                class_level=student_class,
                topic=topic,
                quality_score=0.75,
                textbook_chunks=[]
            )
            logger.info(f"✓ Direct answer stored in LLM cache (topic: {topic})")
            
            return answer, []
        
        if self.llm_storage._should_store_answer(answer, textbook_chunks):
            topic = self.llm_storage._extract_topic(question)
            self.llm_storage.store_answer(
                question=question,
                answer=answer,
                subject=subject,
                class_level=student_class,
                topic=topic,
                quality_score=0.9,
                textbook_chunks=textbook_chunks
            )
        
        return answer, all_chunks
    
    def answer_annotation_basic(
        self,
        question: str,
        subject: str,
        student_class: int,
        chapter: Optional[int] = None
    ) -> Tuple[str, List[Dict]]:
        """
        Answer annotation request with LOWER similarity threshold for LLM reuse.
        
        Annotations are often similar concepts worded differently, so we use
        a lower threshold (0.65 vs 0.75) to reuse existing answers more aggressively.
        
        EDGE CASE HANDLING:
        - If no content found in current class, searches previous classes (foundation)
        - If still no content, falls back to Gemini's general knowledge with disclaimer
        
        Args:
            question: Annotation question
            subject: Subject name
            student_class: Current class level
            chapter: Optional chapter filter
        
        Returns:
            Tuple of (answer, source_chunks)
        """
        logger.info(f"📝 ANNOTATION MODE (Optimized): Class {student_class} {subject}")
        logger.info(f"   Question: {question[:100]}...")
        
        query_embedding = self.generate_embedding(question)
        
        textbook_chunks, class_dist = self.query_multi_class(
            query_text=question,
            subject=subject,
            student_class=student_class,
            chapter=chapter,
            mode="basic",
            chunks_per_class=3,
            query_embedding=query_embedding
        )
        
        llm_chunks = self.query_llm_content(
            query_text=question,
            subject=subject,
            top_k=3,
            similarity_threshold=0.35,
            query_embedding=query_embedding
        )
        
        if llm_chunks and llm_chunks[0]['score'] >= 0.80:
            cached_answer = llm_chunks[0]['text']
            logger.info(f" CACHE HIT! Using cached answer (similarity: {llm_chunks[0]['score']:.3f}, topic: {llm_chunks[0].get('topic', 'N/A')})")
            logger.info(f"   Saved 1 Gemini API call (answer length: {len(cached_answer)} chars)")
            
            source_chunks = textbook_chunks + llm_chunks
            return cached_answer, source_chunks
        
        web_chunks = []
        
        if not textbook_chunks and not llm_chunks:
            logger.warning(f" EDGE CASE: No content found for '{question[:50]}...' in Class {student_class}")
            prev_class = student_class - 1
            if prev_class >= 1:
                logger.info(f"🔄 Searching Class {prev_class} (one-step fallback)...")
                prev_chunks, prev_dist = self.query_multi_class(
                    query_text=question,
                    subject=subject,
                    student_class=prev_class,
                    chapter=None,
                    mode="basic",
                    chunks_per_class=3,
                    query_embedding=query_embedding
                )
                
                if prev_chunks:
                    logger.info(f"Found {len(prev_chunks)} chunks in Class {prev_class} (foundation content)")
                    textbook_chunks = prev_chunks
                    class_dist = prev_dist
        
        all_chunks = textbook_chunks + llm_chunks + web_chunks
        
        if not all_chunks:
            logger.warning(f" EDGE CASE: No content in any class for '{question[:50]}...'")
            return "The content is not found in the book, ask some other questions related to your subject.", []
        
        answer = self.generate_answer_from_multiple_sources(
            question=question,
            textbook_chunks=textbook_chunks,
            llm_chunks=llm_chunks,
            web_chunks=web_chunks,
            class_distribution=class_dist,
            student_class=student_class,
            subject=subject,
            mode="basic"
        )
        
        if answer and len(answer.strip()) > 100:
            topic = self.llm_storage._extract_topic(question)
            self.llm_storage.store_answer(
                question=question,
                answer=answer,
                subject=subject,
                class_level=student_class,
                topic=topic,
                quality_score=0.9 if textbook_chunks else 0.7,
                textbook_chunks=textbook_chunks
            )
            logger.info(f"✓ Answer stored for future reuse (quality: {'high' if textbook_chunks else 'fallback'})")
        
        return answer, all_chunks
    
    async def answer_question_deepdive(
        self,
        question: str,
        subject: str,
        student_class: int,
        chapter: Optional[int] = None
    ) -> Tuple[str, List[Dict]]:
        """
        Answer question in DEEP DIVE mode with triple-index system.
        Queries: Textbook (all classes) + Web + LLM content + auto-scraping.
        
        Args:
            question: Student's question
            subject: Subject name
            student_class: Current class level
            chapter: Optional chapter filter
        
        Returns:
            Tuple of (answer, combined_source_chunks)
        """
        # Identity / greeting detection — bypass RAG entirely
        identity_response = detect_identity_or_greeting(question)
        if identity_response:
            logger.info("Identity/greeting detected — returning Brainwave response")
            return identity_response, []
        
        try:
            validation = await subject_classifier.classify(question)
            detected_subject = validation.get("detected_subject", "Unknown")
            confidence = validation.get("confidence", 0.0)
            
            logger.info(f" Deep Dive Subject Check: Detected='{detected_subject}' ({confidence:.2f}) vs Current='{subject}'")
            
            if confidence > 0.60 and detected_subject.lower() != subject.lower():
                 logger.warning(f" Subject mismatch blocked: User={subject}, Detected={detected_subject}")
                 return "The specific topic is not present in the book. Change the book or question.", []
                 
        except Exception as e:
            logger.warning(f"Subject validation failed (proceeding anyway): {e}")

        logger.info(f" DEEP DIVE MODE (Triple-Index): Class {student_class} {subject}")
        logger.info(f"   Question: {question[:100]}...")
        logger.info(f"   Will search from fundamentals (earliest class) to current class")
        
        try:
            query_embedding = self.generate_embedding(question)
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            return "I'm having trouble understanding that right now. Please try again.", []
        
        logger.info("   ⚡ Running parallel queries (textbook + LLM cache)...")
        
        async def query_textbook_async():
            return await asyncio.to_thread(
                self.query_multi_class,
                query_text=question,
                subject=subject,
                student_class=student_class,
                chapter=chapter,
                mode="deepdive",
                chunks_per_class=8,
                query_embedding=query_embedding
            )
        
        async def query_llm_async():
            return await asyncio.to_thread(
                self.query_llm_content,
                query_text=question,
                subject=subject,
                top_k=3,
                query_embedding=query_embedding
            )
        
        (textbook_chunks, class_dist), llm_chunks = await asyncio.gather(
            query_textbook_async(),
            query_llm_async()
        )
        
        web_chunks = []
        
        if llm_chunks and llm_chunks[0]['score'] >= 0.80:
            cached_answer = llm_chunks[0]['text']
            logger.info(f" CACHE HIT! Using cached answer (similarity: {llm_chunks[0]['score']:.3f}, topic: {llm_chunks[0].get('topic', 'N/A')})")
            logger.info(f"   Saved 1 Gemini API call (answer length: {len(cached_answer)} chars)")
            
            source_chunks = textbook_chunks + llm_chunks
            return cached_answer, source_chunks
        
        all_chunks = textbook_chunks + llm_chunks + web_chunks
        
        answer = self.generate_answer_from_multiple_sources(
            question=question,
            textbook_chunks=textbook_chunks,
            llm_chunks=llm_chunks,
            web_chunks=web_chunks,
            class_distribution=class_dist,
            student_class=student_class,
            subject=subject,
            mode="deepdive"
        )
        
        not_found_messages = [
            "The content is not found",
            "not found in the book",
            "not found in your textbook"
        ]
        is_not_found = any(msg.lower() in answer.lower() for msg in not_found_messages)
        
        if is_not_found:
            logger.info(f"🔄 RAG returned 'not found' - checking if question is valid for {subject}...")
            
            logger.info(f"Question IS related to {subject} - generating direct Gemini answer")
            
            persona = get_tutor_system_prompt(student_class, subject)
            direct_prompt = f"""{persona}

You are now in DEEP DIVE mode — provide a COMPREHENSIVE explanation.

STUDENT QUESTION: {question}

**IMPORTANT CONSTRAINTS:**
- ONLY answer if the question is related to education, academics, or school subjects.
- If the question is about entertainment, social media, celebrities, violence, or anything
  NOT related to studies/education, respond with EXACTLY:
  "I can only help with education-related questions. Please ask something related to your studies."
- Do NOT confuse Physics and Maths — 'sum' in Physics means numerical problem on physical concepts,
  'sum' in Maths means arithmetic/algebraic operations. Answer only for {subject}.

INSTRUCTIONS:
1. Start with a clear, simple definition or explanation
2. Provide examples to illustrate the concept
3. Explain any related concepts or applications
4. Use proper formatting with headers and bullet points

Structure your answer as:
🌱 **Basic Understanding**: [Simple definition/explanation]
**Detailed Explanation**: [Comprehensive explanation]
💡 **Examples**: [2-3 examples]
 **Key Points to Remember**: [Summary bullet points]

Generate a thorough educational explanation:"""
            
            answer = self.gemini.generate_response(direct_prompt, max_output_tokens=2000)
            logger.info(f"✓ Direct Gemini answer generated ({len(answer)} chars)")
            
            topic = self.llm_storage._extract_topic(question)
            self.llm_storage.store_answer(
                question=question,
                answer=answer,
                subject=subject,
                class_level=student_class,
                topic=topic,
                quality_score=0.80,
                textbook_chunks=[]
            )
            logger.info(f"✓ Direct answer stored in LLM cache for future reuse (topic: {topic})")
            
            return answer, []
        
        if self.llm_storage._should_store_answer(answer, textbook_chunks):
            topic = self.llm_storage._extract_topic(question)
            self.llm_storage.store_answer(
                question=question,
                answer=answer,
                subject=subject,
                class_level=student_class,
                topic=topic,
                quality_score=0.95,
                textbook_chunks=textbook_chunks
            )
        
        return answer, all_chunks

enhanced_rag_service = EnhancedRAGService()
