"""
Advanced PDF Processor for NCERT Books

Handles:
- Regular text extraction
- OCR for scanned pages
- Image extraction and description
- Formula/equation detection
- Diagram recognition
- Chemical equations
- Page-by-page processing without missing any content

This processor ensures every page is captured and properly chunked for embeddings.
"""

import os
import re
import io
import time
import base64
import logging
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime

import PyPDF2
from pdf2image import convert_from_path
from PIL import Image
import cv2
import numpy as np

from app.services.gemini_service import gemini_service

from google import genai
from google.genai import types

from pinecone import Pinecone

from app.utils.embedding_helper import (
    generate_embedding as _generate_embedding_rest,
    generate_embeddings_batch as _generate_embeddings_batch_rest,
    EMBEDDING_MODEL
)

from app.core.config import settings

logger = logging.getLogger(__name__)

@dataclass
class PageContent:
    """Content extracted from a single page"""
    page_number: int
    text_content: str
    ocr_content: str
    image_descriptions: List[str] = field(default_factory=list)
    formulas: List[str] = field(default_factory=list)
    combined_content: str = ""
    word_count: int = 0
    has_images: bool = False
    has_formulas: bool = False

@dataclass
class ProcessingResult:
    """Result of PDF processing"""
    success: bool
    total_pages: int
    processed_pages: int
    total_chunks: int
    total_embeddings: int
    errors: List[str] = field(default_factory=list)
    processing_time: float = 0.0
    pages: List[PageContent] = field(default_factory=list)

class AdvancedPDFProcessor:
    """
    Advanced PDF processor that extracts all content from NCERT books.
    
    Features:
    - Dual extraction (PyPDF2 + OCR) to ensure no text is missed
    - Image extraction and AI-powered description
    - Formula/equation detection and representation
    - Proper chunking with overlap for better retrieval
    - Progress callbacks for UI updates
    """
    
    def __init__(
        self,
        chunk_size: int = 800,
        chunk_overlap: int = 150,
        dpi: int = 300,
        use_gemini_vision: bool = True
    ):
        """
        Initialize the PDF processor.
        
        Args:
            chunk_size: Target size for each text chunk (characters)
            chunk_overlap: Overlap between consecutive chunks
            dpi: DPI for PDF to image conversion (higher = better OCR but slower)
            use_gemini_vision: Whether to use Gemini Vision for image descriptions
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.dpi = dpi
        self.use_gemini_vision = use_gemini_vision
        
        self.vision_client = genai.Client(api_key=settings.GEMINI_API_KEY)
        
        self.embedding_model = EMBEDDING_MODEL
        self.vision_model_name = "models/gemini-2.5-flash"  
        
        self.vision_api_enabled = True
        
        logger.info("✓ AdvancedPDFProcessor initialized")
    
    def process_pdf(
        self,
        pdf_path: str,
        book_metadata: Dict,
        progress_callback: Optional[Callable[[int, int, str], None]] = None
    ) -> ProcessingResult:
        """
        Process a PDF file and extract all content.
        
        Args:
            pdf_path: Path to the PDF file
            book_metadata: Metadata about the book (title, subject, class, etc.)
            progress_callback: Optional callback for progress updates (current, total, message)
            
        Returns:
            ProcessingResult with all extracted content and statistics
        """
        start_time = time.time()
        result = ProcessingResult(
            success=False,
            total_pages=0,
            processed_pages=0,
            total_chunks=0,
            total_embeddings=0
        )
        
        try:
            logger.info(f"📄 Processing: {Path(pdf_path).name}")
            
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                result.total_pages = len(pdf_reader.pages)
            
            logger.info(f"📄 Total pages: {result.total_pages}")
            
            if progress_callback:
                progress_callback(0, result.total_pages, "Starting PDF processing...")
            
            logger.info(" Converting PDF to images...")
            images = convert_from_path(
                pdf_path,
                dpi=self.dpi,
                fmt='png',
                thread_count=4
            )
            
            for page_num in range(result.total_pages):
                try:
                    page_content = self._process_single_page(
                        pdf_path=pdf_path,
                        page_number=page_num + 1,
                        page_image=images[page_num] if page_num < len(images) else None,
                        book_metadata=book_metadata
                    )
                    
                    result.pages.append(page_content)
                    result.processed_pages += 1
                    
                    if progress_callback:
                        progress_callback(
                            page_num + 1,
                            result.total_pages,
                            f"Processed page {page_num + 1}/{result.total_pages}"
                        )
                    
                    logger.info(f"  ✓ Page {page_num + 1}: {page_content.word_count} words")
                    
                except Exception as e:
                    error_msg = f"Error on page {page_num + 1}: {str(e)}"
                    result.errors.append(error_msg)
                    logger.error(f"  ✗ {error_msg}")
                    
                    result.pages.append(PageContent(
                        page_number=page_num + 1,
                        text_content="",
                        ocr_content="",
                        combined_content=f"[Page {page_num + 1} - Content extraction failed]"
                    ))
            
            result.success = result.processed_pages > 0
            result.processing_time = time.time() - start_time
            
            logger.info(f"PDF processing complete: {result.processed_pages}/{result.total_pages} pages in {result.processing_time:.2f}s")
            
            return result
            
        except Exception as e:
            result.errors.append(f"PDF processing failed: {str(e)}")
            result.processing_time = time.time() - start_time
            logger.error(f" PDF processing failed: {e}")
            return result
    
    def _process_single_page(
        self,
        pdf_path: str,
        page_number: int,
        page_image: Optional[Image.Image],
        book_metadata: Dict
    ) -> PageContent:
        """
        Process a single page of the PDF.
        
        Combines:
        1. Direct text extraction (PyPDF2)
        2. OCR text extraction (Tesseract)
        3. Image/diagram detection and description (Gemini Vision)
        4. Formula detection
        """
        page_content = PageContent(
            page_number=page_number,
            text_content="",
            ocr_content=""
        )
        
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                if page_number <= len(pdf_reader.pages):
                    page = pdf_reader.pages[page_number - 1]
                    page_content.text_content = page.extract_text() or ""
        except Exception as e:
            logger.warning(f"PyPDF2 extraction failed for page {page_number}: {e}")
        
        if page_image:
            try:
                img_array = np.array(page_image)
                
                processed_img = self._preprocess_for_ocr(img_array)
                
                import base64
                from io import BytesIO
                pil_img = Image.fromarray(processed_img) if isinstance(processed_img, np.ndarray) else processed_img
                buffer = BytesIO()
                pil_img.save(buffer, format='PNG')
                pil_img.save(buffer, format='PNG')
                
                page_content.ocr_content = gemini_service.generate_response_with_image(
                    prompt="Extract all text from this page image. Return only the text content.",
                    image_bytes=buffer.getvalue(),
                    mime_type="image/png"
                ) or ""
                
                page_content.has_images = self._detect_images_in_page(img_array)
                page_content.has_formulas = self._detect_formulas(
                    page_content.text_content + " " + page_content.ocr_content
                )
                
            except Exception as e:
                logger.warning(f"OCR extraction failed for page {page_number}: {e}")
        
        if page_image and self.use_gemini_vision and page_content.has_images:
            try:
                descriptions = self._describe_page_visuals(
                    page_image,
                    book_metadata.get('subject', 'General')
                )
                page_content.image_descriptions = descriptions
            except Exception as e:
                logger.warning(f"Vision analysis failed for page {page_number}: {e}")
        
        if page_content.has_formulas:
            page_content.formulas = self._extract_formulas(
                page_content.text_content + " " + page_content.ocr_content
            )
        
        page_content.combined_content = self._combine_page_content(page_content, book_metadata)
        page_content.word_count = len(page_content.combined_content.split())
        
        return page_content
    
    def _preprocess_for_ocr(self, image: np.ndarray) -> np.ndarray:
        """
        Preprocess image for optimal OCR accuracy.
        
        Applies:
        - Grayscale conversion
        - Adaptive thresholding
        - Noise reduction
        - Contrast enhancement
        """
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        else:
            gray = image
        
        binary = cv2.adaptiveThreshold(
            gray, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            11, 2
        )
        
        denoised = cv2.fastNlMeansDenoising(binary, None, 10, 7, 21)
        
        return denoised
    
    def _detect_images_in_page(self, image: np.ndarray) -> bool:
        """
        Detect if page contains significant visual content (diagrams, figures, etc.)
        
        Uses edge detection and contour analysis.
        """
        try:
            if len(image.shape) == 3:
                gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            else:
                gray = image
            
            edges = cv2.Canny(gray, 50, 150)
            
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            significant_contours = 0
            for contour in contours:
                area = cv2.contourArea(contour)
                if area > 5000:
                    significant_contours += 1
            
            return significant_contours > 2
            
        except Exception:
            return False
    
    def _detect_formulas(self, text: str) -> bool:
        """
        Detect if text contains mathematical formulas or equations.
        """
        formula_patterns = [
            r'[=+\-*/^]',
            r'\d+\s*[+\-*/^]\s*\d+',
            r'[a-z]\s*=\s*',
            r'\([^)]+\)',
            r'√|∑|∫|∏|∂|∆',
            r'\^[0-9]+',
            r'sin|cos|tan|log|ln',
            r'→|←|↔|⇒',
            r'[A-Z][a-z]?\d*[+\-]?',
            r'\d+\s*×\s*10\^',
        ]
        
        for pattern in formula_patterns:
            if re.search(pattern, text):
                return True
        return False
    
    def _extract_formulas(self, text: str) -> List[str]:
        """
        Extract mathematical formulas and equations from text.
        """
        formulas = []
        
        equation_pattern = r'[A-Za-z0-9\s\+\-\*/\^√∑∫\(\)]+\s*=\s*[A-Za-z0-9\s\+\-\*/\^√∑∫\(\)]+'
        equations = re.findall(equation_pattern, text)
        formulas.extend(equations[:10])
        
        chemical_pattern = r'[A-Z][a-z]?\d*(?:\s*\+\s*[A-Z][a-z]?\d*)*\s*→\s*[A-Z][a-z]?\d*(?:\s*\+\s*[A-Z][a-z]?\d*)*'
        chemicals = re.findall(chemical_pattern, text)
        formulas.extend(chemicals[:10])
        
        return formulas
    
    def _describe_page_visuals(self, page_image: Image.Image, subject: str) -> List[str]:
        """
        Use Gemini Vision to describe diagrams, figures, and visual content.
        Includes circuit breaker for API quotas.
        """
        if not self.use_gemini_vision or not getattr(self, 'vision_api_enabled', True):
            return []

        try:
            max_size = 1024
            if page_image.width > max_size or page_image.height > max_size:
                page_image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            
            subject_context = {
                "Mathematics": "mathematical diagrams, graphs, geometric figures, or visual representations of concepts",
                "Physics": "physics diagrams, circuit diagrams, ray diagrams, force diagrams, or experimental setups",
                "Chemistry": "chemical structures, molecular diagrams, lab equipment, reaction diagrams, or periodic table references",
                "Biology": "biological diagrams, cell structures, anatomical illustrations, or ecosystem representations",
                "Science": "scientific diagrams, experimental setups, or visual explanations of concepts"
            }.get(subject, "educational diagrams and figures")
            
            prompt = f"""Analyze this page from an educational textbook about {subject}.
            
            If the page contains {subject_context}, please describe them clearly and concisely.
            Focus on:
            1. What the diagram/figure represents
            2. Key labels or components
            3. The concept being illustrated
            
            If the page is mostly text without significant visual content, simply respond with "TEXT_ONLY".
            
            Keep descriptions educational and helpful for understanding the content."""
            
            max_retries = 2
            for attempt in range(max_retries):
                try:
                    response = self.vision_client.models.generate_content(
                        model=self.vision_model_name,
                        contents=[prompt, page_image],
                    )
                    
                    if response.text and "TEXT_ONLY" not in response.text:
                        return [response.text.strip()]
                    return []
                    
                except Exception as e:
                    error_str = str(e)
                    
                    if "429" in error_str or "quota" in error_str.lower():
                        logger.warning(f" Vision API quota exceeded. Disabling Vision features for remaining pages.")
                        self.vision_api_enabled = False
                        return []
                    
                    if "503" in error_str or "504" in error_str or "overloaded" in error_str.lower():
                        if attempt < max_retries - 1:
                            time.sleep(2 * (attempt + 1))
                            continue
                    
                    logger.warning(f"Vision API error (attempt {attempt+1}): {e}")
                    if attempt == max_retries - 1:
                        return []

            return []
            
        except Exception as e:
            logger.warning(f"Vision analysis failed: {e}")
            return []
    
    def _combine_page_content(self, page: PageContent, metadata: Dict) -> str:
        """
        Intelligently combine all extracted content from a page.
        
        Merges:
        - Direct text extraction
        - OCR text (deduped)
        - Image descriptions
        - Formulas
        """
        parts = []
        
        parts.append(f"[Page {page.page_number}]")
        
        text = page.text_content.strip()
        ocr = page.ocr_content.strip()
        
        if text and ocr:
            has_hindi_ocr = any('\u0900' <= char <= '\u097F' for char in ocr)
            has_hindi_text = any('\u0900' <= char <= '\u097F' for char in text)
            
            if has_hindi_ocr and not has_hindi_text:
                combined_text = ocr
            elif len(text) >= len(ocr):
                combined_text = text
                ocr_unique = self._get_unique_content(ocr, text)
                if ocr_unique:
                    combined_text += f"\n\n[Additional content from images:]\n{ocr_unique}"
            else:
                combined_text = ocr
        else:
            combined_text = text or ocr
        
        parts.append(combined_text)
        
        if page.image_descriptions:
            parts.append("\n[Visual Content Description:]")
            for desc in page.image_descriptions:
                parts.append(f"• {desc}")
        
        if page.formulas:
            parts.append("\n[Formulas/Equations:]")
            for formula in page.formulas:
                parts.append(f"• {formula.strip()}")
        
        return "\n".join(parts)
    
    def _get_unique_content(self, new_text: str, existing_text: str) -> str:
        """
        Extract content from new_text that doesn't appear in existing_text.
        """
        existing_words = set(existing_text.lower().split())
        new_sentences = new_text.split('.')
        
        unique_sentences = []
        for sentence in new_sentences:
            words = sentence.lower().split()
            if len(words) < 3:
                continue
            
            matching = sum(1 for w in words if w in existing_words)
            if len(words) > 0 and (matching / len(words)) < 0.6:
                unique_sentences.append(sentence.strip())
        
        return '. '.join(unique_sentences[:5])
    
    def create_chunks(
        self,
        pages: List[PageContent],
        book_metadata: Dict
    ) -> List[Dict]:
        """
        Create overlapping chunks from processed pages.
        
        Each chunk includes:
        - Text content
        - Metadata (page number, book info, etc.)
        - Unique ID for Pinecone
        """
        chunks = []
        chunk_id = 1
        
        book_id = book_metadata.get('book_id', 'unknown')
        subject = book_metadata.get('subject', 'Unknown')
        class_level = book_metadata.get('class_level', 0)
        chapter_number = book_metadata.get('chapter_number', 0)
        title = book_metadata.get('title', 'Unknown Book')
        
        for page in pages:
            if not page.combined_content.strip():
                continue
            
            page_chunks = self._chunk_text(
                text=page.combined_content,
                page_number=page.page_number
            )
            
            for chunk_text in page_chunks:
                if len(chunk_text.strip()) < 50:
                    continue
                
                chunk = {
                    'id': f"book_{book_id}_ch{chapter_number}_p{page.page_number}_c{chunk_id}",
                    'text': chunk_text,
                    'metadata': {
                        'book_id': book_id,
                        'book_title': title,
                        'subject': subject,
                        'class_level': class_level,
                        'chapter_number': chapter_number,
                        'page_number': page.page_number,
                        'chunk_id': chunk_id,
                        'has_images': page.has_images,
                        'has_formulas': page.has_formulas,
                        'word_count': len(chunk_text.split()),
                        'char_count': len(chunk_text)
                    }
                }
                chunks.append(chunk)
                chunk_id += 1
        
        logger.info(f"📦 Created {len(chunks)} chunks from {len(pages)} pages")
        return chunks
    
    def _chunk_text(self, text: str, page_number: int) -> List[str]:
        """
        Split text into overlapping chunks.
        """
        chunks = []
        
        text = re.sub(r'\n+', '\n', text)
        text = re.sub(r' +', ' ', text)
        
        if len(text) <= self.chunk_size:
            return [text]
        
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        current_chunk = []
        current_length = 0
        
        for sentence in sentences:
            sentence_len = len(sentence)
            
            if current_length + sentence_len > self.chunk_size and current_chunk:
                chunks.append(' '.join(current_chunk))
                
                overlap_sentences = current_chunk[-2:] if len(current_chunk) > 2 else current_chunk
                current_chunk = overlap_sentences + [sentence]
                current_length = sum(len(s) for s in current_chunk)
            else:
                current_chunk.append(sentence)
                current_length += sentence_len
        
        if current_chunk:
            chunks.append(' '.join(current_chunk))
        
        return chunks

class PineconeEmbeddingUploader:
    """
    Uploads embeddings to Pinecone with proper error handling and batching.
    """
    
    def __init__(self):
        """Initialize Pinecone connection."""
        self.genai_client = genai.Client(api_key=settings.GEMINI_API_KEY)
        
        self.pc = Pinecone(api_key=settings.PINECONE_API_KEY)
        self.index = self.pc.Index(host=settings.PINECONE_HOST)
        
        self.batch_size = 50
        self.retry_count = 3
        self.retry_delay = 2
        
        logger.info("✓ Connected to Pinecone")
    
    def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding using Gemini gemini-embedding-001 via REST API.
        Returns 768-dimensional vector for Pinecone compatibility.
        """
        try:
            return _generate_embedding_rest(
                text=text,
                api_key=settings.GEMINI_API_KEY,
                task_type="RETRIEVAL_DOCUMENT"
            )
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            raise

    def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for a batch of texts using Gemini REST API.
        Uses batch endpoint for efficiency.
        """
        try:
            return _generate_embeddings_batch_rest(
                texts=texts,
                api_key=settings.GEMINI_API_KEY,
                task_type="RETRIEVAL_DOCUMENT"
            )
        except Exception as e:
            logger.warning(f"Batch embedding failed, falling back to single: {e}")
            embeddings = []
            for text in texts:
                try:
                    embeddings.append(self.generate_embedding(text))
                except Exception:
                    embeddings.append([])
            return embeddings
    
    def upload_chunks(
        self,
        chunks: List[Dict],
        namespace: str,
        progress_callback: Optional[Callable[[int, int, str], None]] = None
    ) -> Dict:
        """
        Upload chunks to Pinecone with embeddings.
        Uses batch processing for both embedding generation and upload.
        """
        stats = {
            'total_chunks': len(chunks),
            'successful': 0,
            'failed': 0,
            'errors': []
        }
        
        logger.info(f"Uploading {len(chunks)} chunks to namespace '{namespace}'")
        
        total_batches = (len(chunks) + self.batch_size - 1) // self.batch_size
        
        for batch_idx in range(total_batches):
            start_idx = batch_idx * self.batch_size
            end_idx = min(start_idx + self.batch_size, len(chunks))
            
            batch_chunks = chunks[start_idx:end_idx]
            batch_texts = [chunk['text'] for chunk in batch_chunks]
            
            try:
                logger.info(f"  Generating embeddings for batch {batch_idx+1}/{total_batches} ({len(batch_chunks)} chunks)...")
                embeddings = self.generate_embeddings_batch(batch_texts)
                
                if len(embeddings) != len(batch_chunks):
                    logger.error(f"Mismatch in embedding count: got {len(embeddings)}, expected {len(batch_chunks)}")
                    stats['failed'] += len(batch_chunks)
                    continue
                
                vectors = []
                for i, chunk in enumerate(batch_chunks):
                    if not embeddings[i]:
                        continue
                        
                    vector = {
                        'id': chunk['id'],
                        'values': embeddings[i],
                        'metadata': {
                            **chunk['metadata'],
                            'text': chunk['text'][:2000]
                        }
                    }
                    vectors.append(vector)
                
                if vectors:
                    success = self._upload_batch(vectors, namespace)
                    if success:
                        stats['successful'] += len(vectors)
                    else:
                        stats['failed'] += len(vectors)
                
                if progress_callback:
                    progress_callback(
                        end_idx,
                        len(chunks),
                        f"Processed {end_idx}/{len(chunks)} chunks"
                    )
                
                time.sleep(1)
                    
            except Exception as e:
                logger.error(f"Batch processing failed: {e}")
                stats['failed'] += len(batch_chunks)
                stats['errors'].append(str(e))
        
        logger.info(f"Upload complete: {stats['successful']} successful, {stats['failed']} failed")
        return stats

    def _upload_batch(self, vectors: List[Dict], namespace: str) -> bool:
        """
        Upload a batch of vectors to Pinecone with retry logic.
        """
        for attempt in range(self.retry_count):
            try:
                self.index.upsert(vectors=vectors, namespace=namespace)
                logger.info(f"  ✓ Uploaded batch of {len(vectors)} vectors")
                return True
            except Exception as e:
                logger.warning(f"  Upload attempt {attempt + 1} failed: {e}")
                if attempt < self.retry_count - 1:
                    time.sleep(self.retry_delay * (attempt + 1))
        
        logger.error(f"  ✗ Failed to upload batch after {self.retry_count} attempts")
        return False
    
    def get_namespace_stats(self, namespace: str) -> Dict:
        """Get statistics for a specific namespace."""
        try:
            stats = self.index.describe_index_stats()
            namespaces = stats.get('namespaces', {})
            
            if namespace in namespaces:
                return {
                    'exists': True,
                    'vector_count': namespaces[namespace].get('vector_count', 0)
                }
            return {'exists': False, 'vector_count': 0}
        except Exception as e:
            logger.error(f"Failed to get namespace stats: {e}")
            return {'exists': False, 'vector_count': 0, 'error': str(e)}
