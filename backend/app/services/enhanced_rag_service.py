"""
Enhanced Multi-Index RAG Service

Implements intelligent cross-index retrieval:
- Basic Mode: Current class + relevant lower classes (textbook only)
- Deep Dive Mode: From fundamentals (earliest class) + web content for comprehensive understanding
- Triple-Index: Textbook + Web Scraped + LLM Generated content
"""

from app.services.gemini_service import gemini_service
from app.db.mongo import pinecone_db, pinecone_web_db, pinecone_llm_db
from app.services.llm_storage_service import llm_storage_service
from app.services.web_scraper_service import web_scraper_service
from app.services.subject_classifier import subject_classifier
import logging
import re
import asyncio
from typing import List, Dict, Tuple, Optional
import google.generativeai as genai
from app.utils.embedding_helper import generate_embedding as _embed_rest, EMBEDDING_MODEL

logger = logging.getLogger(__name__)


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
        self.textbook_db = pinecone_db  # ncert-all-subjects index
        self.web_db = pinecone_web_db    # ncert-web-content index
        self.llm_db = pinecone_llm_db    # ncert-llm index (NEW)
        
        # Storage and scraping services
        self.llm_storage = llm_storage_service
        self.web_scraper = web_scraper_service
        
        # CRITICAL FIX: Use same embedding model as data upload
        # Data was uploaded using sentence-transformers, so we must use it for queries too!
        self.embedding_model_name = EMBEDDING_MODEL
        logger.info("✅ RAG Service: Using Gemini gemini-embedding-001 for embeddings")
        logger.info("✅ Triple-Index System: Textbook + Web + LLM content")
        
        # Subject to namespace mapping for ncert-all-subjects index
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
        
        # Class ranges for each subject
        self.subject_class_ranges = {
            "Mathematics": list(range(5, 13)),  # Class 5-12
            "Physics": list(range(11, 13)),     # Class 11-12
            "Chemistry": list(range(11, 13)),    # Class 11-12
            "Biology": list(range(11, 13)),      # Class 11-12
            "Social Science": list(range(5, 11)), # Class 5-10
            "History": list(range(5, 13)),       # Class 5-12
            "Geography": list(range(5, 13)),     # Class 5-12
            "Civics": list(range(5, 11)),        # Class 5-10
            "Economics": list(range(9, 13)),     # Class 9-12
            "English": list(range(5, 13)),       # Class 5-12
            "Hindi": list(range(5, 13))          # Class 5-12
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


    def _clean_markdown_formatting(self, text: str) -> str:
        """
        Clean markdown formatting to make text more readable for display.
        Converts markdown to plain text with proper formatting.
        """
        if not text:
            return text
        
        # Convert **bold** to plain text
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
        
        # Convert *italic* to plain text
        text = re.sub(r'\*(.*?)\*', r'\1', text)
        
        # Convert bullet points with * to proper bullets
        text = re.sub(r'^\s*\*\s+', '• ', text, flags=re.MULTILINE)
        
        # Convert numbered lists (1. 2. 3.) to better formatting  
        text = re.sub(r'^\s*(\d+)\.\s+', r'\1. ', text, flags=re.MULTILINE)
        
        # Clean up excessive newlines (more than 2)
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        # Remove any remaining markdown escape characters
        text = text.replace('\\*', '*')
        
        return text.strip()
    
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
        
        Args:
            subject: Subject name
            student_class: Student's current class
            mode: "basic" (current + recent lower) or "deepdive" (all from fundamentals)
        
        Returns:
            List of class numbers to search, ordered from earliest to current
        """
        available_classes = self.subject_class_ranges.get(subject, list(range(5, 13)))
        available_classes = [c for c in available_classes if c <= student_class]
        
        if mode in ("basic", "quick"):
            # Quick mode: ONLY search student's current class
            # Example: Class 10 → [10]
            return [student_class] if student_class in available_classes else available_classes[-1:]
        
        else:  # deepdive mode
            # Deep dive: ALL classes from start to current
            # Example: Class 10 Math → [5, 6, 7, 8, 9, 10]
            return available_classes
    
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
            # Get embedding using sentence-transformers (CRITICAL: Must match data upload model!)
            if query_embedding is None:
                query_embedding = self.generate_embedding(query_text)
            
            # Get classes to search
            classes_to_search = self.get_prerequisite_classes(subject, student_class, mode)
            logger.info(f"🔍 {mode.upper()} mode: Searching classes {classes_to_search} for {subject}")
            
            # Get namespace
            namespace = self.get_namespace(subject)
            
            # Query each class level
            all_chunks = []
            class_distribution = {}
            
            # === STAGE 1: PRE-FILTER (Indexed Metadata) ===
            # Pinecone data uses 'class_level' (int) from pdf_processor uploads
            # Also handle legacy 'class' (str) from math_chunker uploads
            # Build filters for both possible metadata schemas
            class_filter_int = [int(c) for c in classes_to_search]
            class_filter_str = [str(c) for c in classes_to_search]
            
            # Primary filter: class_level as integer (pdf_processor format)
            metadata_filter = {"class_level": {"$in": class_filter_int}}
            
            # Optional: add chapter filter if provided
            if chapter is not None:
                metadata_filter["chapter_number"] = int(chapter)
            
            logger.info(f"   Stage 1 Pre-filter: namespace={namespace}, class={class_filter_int}, chapter={chapter}")
            
            try:
                # === STAGE 2: ANN VECTOR SEARCH (on pre-filtered subset) ===
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
                    logger.warning(f"   ⚠️ class_level int filter failed: {filter_err}")
                    matches = []
                
                # If no matches with class_level (int), try legacy 'class' (str) key
                if len(matches) == 0:
                    logger.info(f"   ⚠️ No matches with class_level filter, trying 'class' (string) filter...")
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
                            logger.info(f"   ✅ Legacy 'class' filter matched: {len(matches)} results")
                    except Exception:
                        matches = []
                
                logger.info(f"   Stage 2 ANN search: {len(matches)} matches from filtered subset")
                
                # FALLBACK: If pre-filter is too restrictive, retry without filter
                if len(matches) == 0:
                    logger.info(f"   ⚠️ No matches with any filter, retrying without metadata filter...")
                    results = self.textbook_db.index.query(
                        namespace=namespace,
                        vector=query_embedding,
                        top_k=10,
                        include_metadata=True
                    )
                    matches = results.get('matches', [])
                    logger.info(f"   🔄 Fallback: {len(matches)} matches without filter")
                
                # === STAGE 3: POST-FILTER (Score Threshold + Class Boost) ===
                # Gemini embeddings produce lower cosine similarity scores (~0.05-0.15)
                # compared to other models, so threshold must be low
                threshold = 0.03
                
                for match in matches:
                    score = match.get('score', 0)
                    
                    if score >= threshold:
                        metadata = match.get('metadata', {})
                        # Read class from metadata - supports both 'class_level' (pdf_processor) 
                        # and 'class' (math_chunker) upload formats
                        chunk_class = metadata.get('class_level', metadata.get('class', 0))
                        
                        try:
                            chunk_class = int(chunk_class) if chunk_class else 0
                        except (ValueError, TypeError):
                            chunk_class = 0
                        
                        # Class-boost: prefer chunks from student's exact class
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
                        
                        # Track class distribution
                        class_distribution[chunk_class] = class_distribution.get(chunk_class, 0) + 1
                
                logger.info(f"   Stage 3 Post-filter: {len(all_chunks)} chunks passed threshold (≥{threshold})")
                        
            except Exception as query_error:
                logger.warning(f"  ✗ Query failed: {query_error}")
            
            # Sort by effective score (highest first)
            all_chunks.sort(key=lambda x: -x['score'])
            
            logger.info(f"📊 Total chunks retrieved: {len(all_chunks)} | Classes: {dict(class_distribution)}")
            
            return all_chunks, class_distribution
            
        except Exception as e:
            logger.error(f"❌ Multi-class query failed: {e}")
            return [], {}
    
    def query_web_content(
        self,
        query_text: str,
        subject: str,
        student_class: int,
        top_k: int = 10,
        query_embedding: Optional[List[float]] = None
    ) -> List[Dict]:
        """
        Query web content index for additional context (DeepDive mode).
        
        Args:
            query_text: Student's question
            subject: Subject name
            student_class: Current class level
            top_k: Number of results
        
        Returns:
            List of web content chunks
        """
        try:
            if not self.web_db or not self.web_db.index:
                logger.info("ℹ️ Web content DB not available")
                return []
            
            # Generate embedding using sentence-transformers (CRITICAL: Must match data upload model!)
            if query_embedding is None:
                query_embedding = self.generate_embedding(query_text)
            
            # Query web content index
            # Note: Web content may use broader metadata structure
            metadata_filter = {
                "subject": subject,
                # Don't filter by class for web content - get broader context
            }
            
            results = self.web_db.query(
                vector=query_embedding,
                top_k=top_k,
                filter=metadata_filter
            )
            
            web_chunks = []
            for match in results.get('matches', []):
                if match.get('score', 0) >= 0.5:  # Higher threshold for web content
                    metadata = match.get('metadata', {})
                    chunk_data = {
                        'text': metadata.get('text', ''),
                        'source': 'web',
                        'score': match.get('score', 0),
                        'url': metadata.get('url', 'N/A')
                    }
                    web_chunks.append(chunk_data)
            
            logger.info(f"🌐 Web content: {len(web_chunks)} chunks retrieved")
            return web_chunks
            
        except Exception as e:
            logger.warning(f"Web content query failed: {e}")
            return []
    
    def query_llm_content(
        self,
        query_text: str,
        subject: str,
        top_k: int = 3,
        similarity_threshold: float = 0.75,
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
            
            # Generate embedding using sentence-transformers
            if query_embedding is None:
                query_embedding = self.generate_embedding(query_text)
            
            # Query LLM content index
            results = self.llm_db.query(
                vector=query_embedding,
                subject=subject,
                top_k=top_k
            )
            
            # Log what we found (for debugging)
            all_matches = results.get('matches', [])
            if all_matches:
                top_scores = [f"{m.get('score', 0):.3f}" for m in all_matches[:3]]
                logger.info(f"💡 LLM index check: Found {len(all_matches)} similar answers (top scores: {top_scores})")
            
            llm_chunks = []
            for match in results.get('matches', []):
                # Use configurable threshold for LLM reuse
                if match.get('score', 0) >= similarity_threshold:
                    metadata = match.get('metadata', {})
                    
                    # Increment usage count
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
                # Found similar answers but below threshold
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
            logger.info("⚠️ No RAG content found (Basic Mode).")
            return "The content is not found in the book, ask some other questions related to your subject."
        
        # Build context with class markers
        context_parts = []
        current_class = None
        
        for chunk in textbook_chunks[:15]:  # Limit to top 15 chunks
            chunk_class = chunk.get('class')
            
            # Add class header when switching classes
            if chunk_class != current_class:
                if chunk_class < student_class:
                    context_parts.append(f"\n**FROM CLASS {chunk_class} (Foundation):**\n")
                else:
                    context_parts.append(f"\n**FROM CLASS {chunk_class}:**\n")
                current_class = chunk_class
            
            context_parts.append(chunk['text'])
        
        combined_context = "\n\n".join(context_parts)
        
        # Build progressive note
        classes_used = sorted(class_distribution.keys())
        if len(classes_used) > 1:
            progressive_note = f"(Using content from Classes {', '.join(map(str, classes_used))} to build complete understanding)"
        else:
            progressive_note = ""
        
        # Detect language of question for multilingual response
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
        
        # Generate answer
        prompt = f"""You are a helpful tutor for Class {student_class} {subject} students.

STUDENT QUESTION: {question}

REFERENCE CONTENT:
{combined_context}

{progressive_note}

INSTRUCTIONS:
1. Answer the question using the REFERENCE CONTENT above as your primary source.
2. If the reference content is directly about the topic asked, give a clear answer from it.
3. If the reference content is from the same subject but covers a different specific topic, respond with EXACTLY:
   "The content is not found in the book, ask some other questions related to your subject."
4. If the student asks about something completely unrelated to {subject}, respond with EXACTLY:
   "The content is not found in the book, ask some other questions related to your subject."
5. Do NOT start with preamble like "Based on your textbook" - just give the answer directly.
6. Do NOT describe what the reference content contains instead of answering.
7. Keep the answer clear for Class {student_class} students{lang_instruction}

Generate a clear, direct answer:"""
        
        answer = self.gemini.generate_response(prompt)
        logger.info(f"✓ Basic answer generated ({len(answer)} chars)")
        
        # Keep markdown formatting for ReactMarkdown frontend rendering
        # answer = self._clean_markdown_formatting(answer)  # DISABLED - frontend uses ReactMarkdown
        
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
        
        # Build layered context
        context_sections = []
        
        # Section 1: Textbook content (progressive from fundamentals)
        if textbook_chunks:
            textbook_context = []
            classes_used = sorted(set(chunk.get('class') for chunk in textbook_chunks))
            
            context_sections.append(f"**TEXTBOOK CONTENT (Classes {', '.join(map(str, classes_used))}):**\n")
            
            # Group by class for progressive building
            for class_level in classes_used:
                class_chunks = [c for c in textbook_chunks if c.get('class') == class_level][:5]
                
                if class_level < student_class:
                    textbook_context.append(f"\n--- Foundation from Class {class_level} ---")
                else:
                    textbook_context.append(f"\n--- Class {class_level} ---")
                
                for chunk in class_chunks:
                    textbook_context.append(chunk['text'])
            
            context_sections.append("\n\n".join(textbook_context))
        
        # Section 2: Web content (additional background)
        if web_chunks:
            context_sections.append("\n\n**ADDITIONAL CONTEXT (Background Information):**\n")
            web_context = [chunk['text'] for chunk in web_chunks[:5]]
            context_sections.append("\n\n".join(web_context))
        
        combined_context = "\n\n".join(context_sections)
        
        # Build comprehensive prompt
        earliest_class = min(class_distribution.keys()) if class_distribution else student_class
        
        # Detect language of question for multilingual response
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
        
        prompt = f"""You are an expert tutor providing a COMPREHENSIVE explanation for a Class {student_class} {subject} student in DEEP DIVE mode.

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
   - 📚 **Core Concept** (Class {student_class} level understanding)
   - 🔍 **Deep Dive** (comprehensive explanation with examples, applications, significance)
   - 💡 **Key Takeaways** (summarize main points)
6. **Make it engaging**: Use analogies, examples, and clear explanations
7. **Appropriate language**: Suitable for Class {student_class} students but comprehensive{lang_instruction}

Generate a thorough, well-structured deep dive explanation:"""
        
        answer = self.gemini.generate_response(prompt)
        logger.info(f"✓ Deep dive answer generated ({len(answer)} chars)")
        
        # Keep markdown formatting for ReactMarkdown frontend rendering
        # answer = self._clean_markdown_formatting(answer)  # DISABLED - frontend uses ReactMarkdown
        
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
            logger.info("⚠️ No RAG content found for this question.")
            return "The content is not found in your textbook. Please try a different question."
        
        # Build multi-source context
        context_sections = []
        
        # PRIORITY 1: Textbook Content (Most Important)
        if textbook_chunks:
            classes_used = sorted(set(chunk.get('class') for chunk in textbook_chunks))
            context_sections.append(f"**PRIMARY SOURCE - NCERT Textbook (Classes {', '.join(map(str, classes_used))}):**\n")
            
            textbook_context = []
            for chunk in textbook_chunks[:10]:
                class_level = chunk.get('class', student_class)
                textbook_context.append(f"[Class {class_level}] {chunk['text']}")
            
            context_sections.append("\n\n".join(textbook_context))
        
        # PRIORITY 2: Previously Generated Explanations (High Quality)
        if llm_chunks:
            context_sections.append("\n\n**REFERENCE - Previously Generated Explanations:**\n")
            
            llm_context = []
            for chunk in llm_chunks[:2]:
                topic = chunk.get('topic', 'general')
                score = chunk.get('score', 0)
                llm_context.append(f"[Topic: {topic}, Relevance: {score:.2f}]\n{chunk['text']}")
            
            context_sections.append("\n\n".join(llm_context))
        
        # PRIORITY 3: Web Resources (Supplementary)
        if web_chunks:
            context_sections.append("\n\n**SUPPLEMENTARY - Web Resources:**\n")
            
            web_context = []
            for chunk in web_chunks[:5]:
                source_url = chunk.get('url', 'N/A')
                web_context.append(f"[Source: {source_url[:50]}...]\n{chunk['text']}")
            
            context_sections.append("\n\n".join(web_context))
        
        combined_context = "\n\n".join(context_sections)
        
        # Build comprehensive prompt with STRICT anti-hallucination rules
        mode_description = "COMPREHENSIVE" if mode == "deepdive" else "FOCUSED"
        
        prompt = f"""You are an NCERT tutor for Class {student_class} {subject}. 

**RULES:**

1. Answer the question using the TEXTBOOK CONTENT below as your primary source.
2. If the textbook content is directly about the topic asked, give a clear answer from it.
3. If the textbook content is about a completely different topic than what the student asked, respond with EXACTLY:
   "The content is not found in the book, ask some other questions related to your subject."
4. Do NOT make up facts, formulas, or examples not present in the content.
5. Do NOT describe what the textbook content contains instead of answering.
6. If you can partially answer, answer what you can from the textbook.

**STUDENT QUESTION:** {question}

**TEXTBOOK CONTENT:**
{combined_context}

**ANSWER FORMAT ({mode_description}):**
{'- Start from fundamentals and build up' if mode == 'deepdive' else '- Direct and concise answer'}
- Use headings and bullet points
- Appropriate language for Class {student_class} students

Generate your answer:"""
        
        answer = self.gemini.generate_response(prompt)
        
        # Log sources used
        sources_summary = f"Textbook: {len(textbook_chunks)}, LLM: {len(llm_chunks)}, Web: {len(web_chunks)}"
        logger.info(f"✅ Answer generated ({len(answer)} chars) from {sources_summary}")
        
        # Keep markdown formatting for ReactMarkdown frontend rendering
        # answer = self._clean_markdown_formatting(answer)  # DISABLED - frontend uses ReactMarkdown
        
        return answer
    
    # Main public methods
    
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
        logger.info(f"📚 BASIC MODE (Triple-Index): Class {student_class} {subject}")
        logger.info(f"   Question: {question[:100]}...")
        
        # 0. Generate embedding AND validate subject IN PARALLEL to save ~2s
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

        # 🔍 STRICT SUBJECT VALIDATION (result from parallel call above)
        try:
            detected_subject = validation.get("detected_subject", "Unknown")
            confidence = validation.get("confidence", 0.0)
            
            logger.info(f"🔍 Subject Check: Detected='{detected_subject}' ({confidence:.2f}) vs Current='{subject}'")
            
            # STRICT BLOCKING LOGIC
            if confidence > 0.60 and detected_subject.lower() != subject.lower():
                 logger.warning(f"⚠️ Subject mismatch blocked: User={subject}, Detected={detected_subject}")
                 return "The specific topic is not present in the book. Change the book or question.", []
                 
        except Exception as e:
            logger.warning(f"Subject validation failed (proceeding anyway): {e}")

        # 1. PARALLEL QUERY: Textbook + LLM cache simultaneously
        # This saves 2-4 seconds by not waiting for sequential queries
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
        
        # Execute both queries in parallel
        (textbook_chunks, class_dist), llm_chunks = await asyncio.gather(
            query_textbook_async(),
            query_llm_async()
        )
        
        # Log best score for debugging
        best_score = textbook_chunks[0]['score'] if textbook_chunks else 0.0
        good_chunks = [c for c in textbook_chunks if c.get('score', 0) >= 0.05]
        logger.info(f"   📊 Best textbook score: {best_score:.3f}, Good chunks: {len(good_chunks)}/{len(textbook_chunks)}")
        logger.info(f"   ⚡ Parallel query complete")
        
        # 🎯 CACHE HIT: Return cached answer if high similarity (0.80 — same Gemini embeddings for store & query)
        if llm_chunks and llm_chunks[0]['score'] >= 0.80:
            cached_answer = llm_chunks[0]['text']
            logger.info(f"🎯 CACHE HIT! Using cached answer (similarity: {llm_chunks[0]['score']:.3f}, topic: {llm_chunks[0].get('topic', 'N/A')})")
            logger.info(f"   Saved 1 Gemini API call (answer length: {len(cached_answer)} chars)")
            
            # Return cached answer with source information
            source_chunks = textbook_chunks + llm_chunks
            return cached_answer, source_chunks
        
        # 3. Query web content - DISABLED to save API calls (restored original behavior)
        web_chunks = []
        logger.info("   🌐 Web content: DISABLED (saving API calls)")
        
        # Combine all sources
        all_chunks = textbook_chunks + llm_chunks + web_chunks
        
        # Generate answer from multiple sources
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
        
        # Store answer if high quality (with textbook verification)
        if self.llm_storage._should_store_answer(answer, textbook_chunks):
            topic = self.llm_storage._extract_topic(question)
            self.llm_storage.store_answer(
                question=question,
                answer=answer,
                subject=subject,
                class_level=student_class,
                topic=topic,
                quality_score=0.9,
                textbook_chunks=textbook_chunks  # Pass for fingerprinting
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
        
        # OPTIMIZATION: Generate embedding ONCE and reuse for all queries
        query_embedding = self.generate_embedding(question)
        
        # 1. Query textbook content (primary source) - reduced to top 3 chunks
        textbook_chunks, class_dist = self.query_multi_class(
            query_text=question,
            subject=subject,
            student_class=student_class,
            chapter=chapter,
            mode="basic",
            chunks_per_class=3,
            query_embedding=query_embedding
        )
        
        # 2. Query stored LLM answers with LOWER threshold for annotations
        llm_chunks = self.query_llm_content(
            query_text=question,
            subject=subject,
            top_k=3,
            similarity_threshold=0.35,  # Much lower threshold (0.35 vs 0.65) for better cache reuse
            query_embedding=query_embedding
        )
        
        # 🎯 CACHE HIT: Return cached answer directly if reasonable similarity
        if llm_chunks and llm_chunks[0]['score'] >= 0.80:  # Same Gemini embeddings for store & query
            cached_answer = llm_chunks[0]['text']
            logger.info(f"🎯 CACHE HIT! Using cached answer (similarity: {llm_chunks[0]['score']:.3f}, topic: {llm_chunks[0].get('topic', 'N/A')})")
            logger.info(f"   Saved 1 Gemini API call (answer length: {len(cached_answer)} chars)")
            
            # Return cached answer with source information
            source_chunks = textbook_chunks + llm_chunks
            return cached_answer, source_chunks
        
        # 3. Query web content - DISABLED to save API calls
        # web_chunks = self.query_web_content(
        #     query_text=question,
        #     subject=subject,
        #     student_class=student_class,
        #     top_k=2
        # )
        web_chunks = []  # Web scraping disabled to reduce Gemini API usage
        logger.info("🌐 Web content: DISABLED (saving API calls)")
        
        # EDGE CASE 1: No content found - Try ONE previous class only (optimized)
        if not textbook_chunks and not llm_chunks:
            logger.warning(f"⚠️ EDGE CASE: No content found for '{question[:50]}...' in Class {student_class}")
            prev_class = student_class - 1
            if prev_class >= 5:
                logger.info(f"🔄 Searching Class {prev_class} (one-step fallback)...")
                prev_chunks, prev_dist = self.query_multi_class(
                    query_text=question,
                    subject=subject,
                    student_class=prev_class,
                    chapter=None,  # Remove chapter filter for broader search
                    mode="basic",
                    chunks_per_class=3,
                    query_embedding=query_embedding
                )
                
                if prev_chunks:
                    logger.info(f"✅ Found {len(prev_chunks)} chunks in Class {prev_class} (foundation content)")
                    textbook_chunks = prev_chunks
                    class_dist = prev_dist
        
        # Combine all sources
        all_chunks = textbook_chunks + llm_chunks + web_chunks
        
        # EDGE CASE 2: Still no content - return not found message
        if not all_chunks:
            logger.warning(f"⚠️ EDGE CASE: No content in any class for '{question[:50]}...'")
            return "The content is not found in the book, ask some other questions related to your subject.", []
        
        # Generate answer from multiple sources
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
        
        # Store answer for future reuse (even fallback answers, for better caching)
        # Simplified: Store if answer is reasonable length and not obviously broken
        if answer and len(answer.strip()) > 100:
            topic = self.llm_storage._extract_topic(question)
            self.llm_storage.store_answer(
                question=question,
                answer=answer,
                subject=subject,
                class_level=student_class,
                topic=topic,
                quality_score=0.9 if textbook_chunks else 0.7,  # Lower score for fallback
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
        # 🔍 STRICT SUBJECT VALIDATION
        try:
            # Use lower threshold (0.60) as requested for strict enforcement
            validation = await subject_classifier.classify(question)
            detected_subject = validation.get("detected_subject", "Unknown")
            confidence = validation.get("confidence", 0.0)
            
            logger.info(f"🔍 Deep Dive Subject Check: Detected='{detected_subject}' ({confidence:.2f}) vs Current='{subject}'")
            
            # STRICT BLOCKING LOGIC
            if confidence > 0.60 and detected_subject.lower() != subject.lower():
                 logger.warning(f"⚠️ Subject mismatch blocked: User={subject}, Detected={detected_subject}")
                 return "The specific topic is not present in the book. Change the book or question.", []
                 
        except Exception as e:
            logger.warning(f"Subject validation failed (proceeding anyway): {e}")

        logger.info(f"🔍 DEEP DIVE MODE (Triple-Index): Class {student_class} {subject}")
        logger.info(f"   Question: {question[:100]}...")
        logger.info(f"   Will search from fundamentals (earliest class) to current class")
        
        # Generate embedding ONCE for all queries
        try:
            query_embedding = self.generate_embedding(question)
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            return "I'm having trouble understanding that right now. Please try again.", []
        
        # 1. PARALLEL QUERY: Textbook + LLM cache + Web content simultaneously
        logger.info("   ⚡ Running parallel queries (textbook + LLM + web)...")
        
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
        
        async def query_web_async():
            return await asyncio.to_thread(
                self.query_web_content,
                query_text=question,
                subject=subject,
                student_class=student_class,
                top_k=10,
                query_embedding=query_embedding
            )
        
        # Execute all three queries in parallel
        (textbook_chunks, class_dist), llm_chunks, web_chunks = await asyncio.gather(
            query_textbook_async(),
            query_llm_async(),
            query_web_async()
        )
        
        # Log best score for debugging
        best_score = textbook_chunks[0]['score'] if textbook_chunks else 0.0
        logger.info(f"   📊 Best textbook score: {best_score:.3f}")
        logger.info(f"   ⚡ Parallel query complete (textbook: {len(textbook_chunks)}, llm: {len(llm_chunks)}, web: {len(web_chunks)})")
        
        # 🎯 CACHE HIT: Return cached answer if high similarity (0.80 — same Gemini embeddings for store & query)
        if llm_chunks and llm_chunks[0]['score'] >= 0.80:
            cached_answer = llm_chunks[0]['text']
            logger.info(f"🎯 CACHE HIT! Using cached answer (similarity: {llm_chunks[0]['score']:.3f}, topic: {llm_chunks[0].get('topic', 'N/A')})")
            logger.info(f"   Saved 1 Gemini API call (answer length: {len(cached_answer)} chars)")
            
            # Return cached answer with source information
            source_chunks = textbook_chunks + llm_chunks
            return cached_answer, source_chunks
        
        # 4. Check if we need more content via web scraping
        total_chunks = len(textbook_chunks) + len(web_chunks)
        if self.web_scraper.should_scrape(total_chunks, threshold=8):
            # Extract topic and trigger scraping
            topic = self.llm_storage._extract_topic(question)
            logger.info(f"🌐 Triggering web scraping for topic: {topic}")
            self.web_scraper.scrape_topic(subject, topic, student_class, max_sources=3)
            
            # Re-query web content after scraping
            web_chunks = self.query_web_content(
                query_text=question,
                subject=subject,
                student_class=student_class,
                top_k=10
            )
        
        # Combine all sources
        all_chunks = textbook_chunks + llm_chunks + web_chunks
        
        # Generate comprehensive answer from multiple sources
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
        
        # Store answer if high quality (with textbook verification)
        if self.llm_storage._should_store_answer(answer, textbook_chunks):
            topic = self.llm_storage._extract_topic(question)
            self.llm_storage.store_answer(
                question=question,
                answer=answer,
                subject=subject,
                class_level=student_class,
                topic=topic,
                quality_score=0.95,  # Higher score for deepdive answers
                textbook_chunks=textbook_chunks
            )
        
        return answer, all_chunks


# Global instance
enhanced_rag_service = EnhancedRAGService()

