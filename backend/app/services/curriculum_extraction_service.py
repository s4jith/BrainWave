"""
Curriculum Extraction Service - AI-powered chapter/topic extraction from PDFs and images
Uses Gemini Vision to extract table of contents and chapter structure
"""

import logging
import json
from typing import List, Dict, Any
from app.services.gemini_service import gemini_service
from app.models.curriculum_models import ExtractedChapter, ExtractedTopic

logger = logging.getLogger(__name__)


class CurriculumExtractionService:
    """Service for extracting curriculum structure from PDFs and images using AI"""
    
    def __init__(self):
        self.gemini = gemini_service
        logger.info("📚 Curriculum Extraction Service initialized")
    
    async def extract_from_image(
        self, 
        image_bytes: bytes, 
        mime_type: str,
        subject_name: str,
        class_level: int
    ) -> List[ExtractedChapter]:
        """
        Extract chapter and topic structure from an image (e.g., table of contents).
        
        Args:
            image_bytes: Raw image bytes
            mime_type: Image MIME type (e.g., 'image/jpeg', 'image/png')
            subject_name: Subject name for context
            class_level: Class level for context
        
        Returns:
            List of ExtractedChapter objects
        """
        try:
            logger.info(f"🔍 Extracting curriculum from image for {subject_name} Class {class_level}")
            
            # Build detailed prompt for Gemini Vision
            prompt = self._build_extraction_prompt(subject_name, class_level)
            
            # Use Gemini Vision to extract structure with high token limit for complete extraction
            response_text = self.gemini.generate_response_with_image(
                prompt=prompt,
                image_bytes=image_bytes,
                mime_type=mime_type,
                max_output_tokens=8000  # High limit for complete table of contents
            )
            
            logger.info(f"✅ Gemini Vision response received ({len(response_text)} chars), parsing structure...")
            
            # Parse the response into structured data
            chapters = self._parse_extraction_response(response_text)
            
            logger.info(f"✅ Extracted {len(chapters)} chapters from image")
            return chapters
            
        except Exception as e:
            logger.error(f"❌ Curriculum extraction failed: {e}")
            raise
    
    async def extract_from_pdf(
        self,
        pdf_bytes: bytes,
        subject_name: str,
        class_level: int
    ) -> List[ExtractedChapter]:
        """
        Extract chapter and topic structure from a PDF file.
        
        Note: This converts first few pages to images and uses vision extraction.
        For large PDFs, we focus on the table of contents pages.
        
        Args:
            pdf_bytes: Raw PDF bytes
            subject_name: Subject name for context
            class_level: Class level for context
        
        Returns:
            List of ExtractedChapter objects
        """
        try:
            logger.info(f"📄 Extracting curriculum from PDF for {subject_name} Class {class_level}")
            
            # Try to convert PDF to images using pdf2image or similar
            # For now, we'll extract text and use text-based extraction
            import PyPDF2
            from io import BytesIO
            
            pdf_file = BytesIO(pdf_bytes)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            # Extract text from first 5 pages (usually contains TOC)
            toc_text = ""
            max_pages = min(5, len(pdf_reader.pages))
            
            for page_num in range(max_pages):
                page = pdf_reader.pages[page_num]
                toc_text += page.extract_text() + "\n\n"
            
            logger.info(f"📖 Extracted text from {max_pages} pages, analyzing with Gemini...")
            
            # Build prompt for text-based extraction
            prompt = f"""
You are analyzing the table of contents from a {subject_name} textbook for Class {class_level} (CBSE board).

Extract the complete chapter structure in JSON format. Each chapter should include:
- chapter_number: Integer chapter number
- chapter_name: Chapter title (clean, without chapter number prefix)
- author: Author name if mentioned (optional)
- page_number: Starting page number if mentioned
- topics: Array of topic objects (if sub-topics are listed)

For topics, include:
- topic_name: Topic/section title
- page_range: Page range if mentioned (e.g., "14-20")
- description: Brief description if available

Return ONLY a valid JSON array of chapters, nothing else. Example format:
[
  {{
    "chapter_number": 1,
    "chapter_name": "A Letter to God",
    "author": "G.L. Fuentes",
    "page_number": 1,
    "topics": [
      {{"topic_name": "Introduction", "page_range": "1-2"}},
      {{"topic_name": "Story Analysis", "page_range": "3-5"}}
    ]
  }}
]

Here is the table of contents text:

{toc_text[:6000]}  

Return only the JSON array, no markdown formatting, no explanations.
"""
            
            # Use Gemini to extract structure from text with high token limit
            response_text = self.gemini.generate_response(prompt, max_output_tokens=8000)
            
            logger.info(f"✅ Gemini response received ({len(response_text)} chars), parsing structure...")
            
            # Parse the response into structured data
            chapters = self._parse_extraction_response(response_text)
            
            logger.info(f"✅ Extracted {len(chapters)} chapters from PDF")
            return chapters
            
        except Exception as e:
            logger.error(f"❌ PDF extraction failed: {e}")
            raise
    
    def _build_extraction_prompt(self, subject_name: str, class_level: int) -> str:
        """Build the prompt for Gemini Vision to extract curriculum structure"""
        
        prompt = f"""
You are analyzing a table of contents image from a {subject_name} textbook for Class {class_level} (CBSE board).

Extract the complete chapter structure in JSON format. Each chapter should include:
- chapter_number: Integer chapter number
- chapter_name: Chapter title (clean, without chapter number prefix)
- author: Author name if mentioned (optional)
- page_number: Starting page number if mentioned
- topics: Array of topic objects (if sub-topics/sections are visible in the image)

For topics, include:
- topic_name: Topic/section title
- page_range: Page range if visible (e.g., "14-20")
- description: Brief description if available

Return ONLY a valid JSON array of chapters, nothing else. Example format:
[
  {{
    "chapter_number": 1,
    "chapter_name": "A Letter to God",
    "author": "G.L. Fuentes",
    "page_number": 1,
    "topics": [
      {{"topic_name": "Dust of Snow", "page_range": "14"}},
      {{"topic_name": "Fire and Ice", "page_range": "15"}}
    ]
  }},
  {{
    "chapter_number": 2,
    "chapter_name": "Nelson Mandela: Long Walk to Freedom",
    "author": "Nelson Rolihlahla Mandela",
    "page_number": 16,
    "topics": [
      {{"topic_name": "A Tiger in the Zoo", "page_range": "29"}}
    ]
  }}
]

Important:
- Extract ALL chapters visible in the image
- Keep chapter names clean (remove "Chapter 1:", "Ch.", etc.)
- Include all authors if mentioned
- Extract all topics/sections listed under each chapter
- Return ONLY the JSON array, no markdown code blocks, no explanations
- Make sure the JSON is valid and properly formatted
"""
        
        return prompt
    
    def _parse_extraction_response(self, response_text: str) -> List[ExtractedChapter]:
        """
        Parse Gemini's response into ExtractedChapter objects.
        Handles both JSON array format and markdown code blocks.
        """
        try:
            # Clean up response - remove markdown code blocks if present
            response_text = response_text.strip()
            
            # Remove markdown code blocks
            if response_text.startswith("```json"):
                response_text = response_text[7:]  # Remove ```json
            elif response_text.startswith("```"):
                response_text = response_text[3:]  # Remove ```
            
            if response_text.endswith("```"):
                response_text = response_text[:-3]  # Remove trailing ```
            
            response_text = response_text.strip()
            
            # Parse JSON
            chapters_data = json.loads(response_text)
            
            # Convert to ExtractedChapter objects
            chapters = []
            for ch_data in chapters_data:
                # Parse topics
                topics = []
                for topic_data in ch_data.get("topics", []):
                    topics.append(ExtractedTopic(
                        topic_name=topic_data.get("topic_name", ""),
                        page_range=topic_data.get("page_range", ""),
                        description=topic_data.get("description", "")
                    ))
                
                # Create chapter
                chapter = ExtractedChapter(
                    chapter_number=ch_data.get("chapter_number", 0),
                    chapter_name=ch_data.get("chapter_name", ""),
                    author=ch_data.get("author", ""),
                    page_number=ch_data.get("page_number"),
                    topics=topics
                )
                chapters.append(chapter)
            
            return chapters
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ Failed to p (first 1000 chars): {response_text[:1000]}")
            logger.error(f"Response text (last 500 chars): {response_text[-500:]}")
            logger.error(f"Total response length: {len(response_text)} chars")
            logger.error(f"Response text: {response_text[:500]}")
            raise ValueError(f"Invalid JSON response from AI: {str(e)}")
        except Exception as e:
            logger.error(f"❌ Failed to parse extraction response: {e}")
            raise


# Singleton instance
curriculum_extraction_service = CurriculumExtractionService()
