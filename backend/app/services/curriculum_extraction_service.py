"""
Curriculum Extraction Service - AI-powered chapter/topic extraction from PDFs and images
Uses Gemini Vision to extract table of contents and chapter structure
"""

import logging
import json
import re
from typing import List, Dict, Any, Tuple
from app.services.gemini_service import gemini_service
from app.models.curriculum_models import ExtractedChapter, ExtractedTopic

logger = logging.getLogger(__name__)

class CurriculumExtractionService:
    """Service for extracting curriculum structure from PDFs and images using AI"""
    
    def __init__(self):
        self.gemini = gemini_service
        logger.info("Curriculum Extraction Service initialized")
    
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
            logger.info(f" Extracting curriculum from image for {subject_name} Class {class_level}")
            
            prompt = self._build_extraction_prompt(subject_name, class_level)
            
            response_text = self.gemini.generate_response_with_image(
                prompt=prompt,
                image_bytes=image_bytes,
                mime_type=mime_type,
                max_output_tokens=8000
            )
            
            logger.info(f"Gemini Vision response received ({len(response_text)} chars), parsing structure...")

            try:
                chapters = self._parse_extraction_response(response_text)
            except ValueError as parse_error:
                logger.warning(f"Initial image extraction parse failed, retrying with stricter prompt: {parse_error}")
                retry_prompt = (
                    prompt
                    + "\n\nIMPORTANT: Your previous output was invalid or truncated. "
                    + "Return STRICT valid JSON only. If output is long, omit optional 'description' fields."
                )
                retry_text = self.gemini.generate_response_with_image(
                    prompt=retry_prompt,
                    image_bytes=image_bytes,
                    mime_type=mime_type,
                    max_output_tokens=8000,
                )
                logger.info(f"Gemini Vision retry response received ({len(retry_text)} chars), parsing structure...")
                chapters = self._parse_extraction_response(retry_text)
            
            logger.info(f"Extracted {len(chapters)} chapters from image")
            return chapters
            
        except Exception as e:
            logger.error(f" Curriculum extraction failed: {e}")
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
            
            import PyPDF2
            from io import BytesIO
            
            pdf_file = BytesIO(pdf_bytes)
            pdf_reader = PyPDF2.PdfReader(pdf_file)

            max_pages = min(12, len(pdf_reader.pages))
            page_texts: List[str] = []

            for page_num in range(max_pages):
                page = pdf_reader.pages[page_num]
                page_texts.append((page.extract_text() or "").strip())

            non_empty_pages = sum(1 for page_text in page_texts if page_text)
            logger.info(
                f"📖 Extracted text from {max_pages} pages ({non_empty_pages} non-empty), analyzing with Gemini..."
            )

            if non_empty_pages == 0:
                raise ValueError("No extractable text found in uploaded PDF pages")

            batch_specs = self._build_pdf_batches(page_texts)
            all_chapters_raw: List[Dict[str, Any]] = []

            for batch_index, (start_page, batch_page_texts) in enumerate(batch_specs, start=1):
                total_batches = len(batch_specs)
                batch_prompt = self._build_pdf_extraction_prompt(
                    subject_name=subject_name,
                    class_level=class_level,
                    start_page=start_page,
                    batch_texts=batch_page_texts,
                    batch_index=batch_index,
                    total_batches=total_batches,
                )

                response_text = self.gemini.generate_response(batch_prompt, max_output_tokens=8000)
                logger.info(
                    f"Gemini batch {batch_index}/{total_batches} response received "
                    f"({len(response_text)} chars), parsing structure..."
                )

                try:
                    batch_chapters = self._parse_extraction_response(response_text)
                except ValueError as parse_error:
                    logger.warning(
                        f"Batch {batch_index}/{total_batches} parse failed, retrying with stricter prompt: {parse_error}"
                    )
                    retry_prompt = (
                        batch_prompt
                        + "\n\nIMPORTANT: Your previous output was invalid or truncated. "
                        + "Return STRICT valid JSON only. If output is long, omit optional 'description' fields."
                    )
                    retry_text = self.gemini.generate_response(retry_prompt, max_output_tokens=8000)
                    logger.info(
                        f"Gemini batch {batch_index}/{total_batches} retry response received "
                        f"({len(retry_text)} chars), parsing structure..."
                    )
                    batch_chapters = self._parse_extraction_response(retry_text)

                all_chapters_raw.extend(chapter.dict() for chapter in batch_chapters)

            chapters = self._merge_extracted_chapters(all_chapters_raw)
            logger.info(f"Extracted {len(chapters)} merged chapters from PDF")
            return chapters
            
        except Exception as e:
            logger.error(f" PDF extraction failed: {e}")
            raise

    def _build_pdf_batches(self, page_texts: List[str]) -> List[Tuple[int, List[str]]]:
        """
        Build one or two extraction batches from early PDF pages.
        For 3+ pages we split into two calls to avoid long, truncation-prone model output.
        """
        if len(page_texts) <= 2:
            return [(1, page_texts)]

        split_index = (len(page_texts) + 1) // 2
        return [
            (1, page_texts[:split_index]),
            (split_index + 1, page_texts[split_index:]),
        ]

    def _build_pdf_extraction_prompt(
        self,
        subject_name: str,
        class_level: int,
        start_page: int,
        batch_texts: List[str],
        batch_index: int,
        total_batches: int,
    ) -> str:
        """Build a bounded PDF extraction prompt for one page batch."""
        text_blocks: List[str] = []
        for offset, text in enumerate(batch_texts):
            page_num = start_page + offset
            if text:
                text_blocks.append(f"[PDF Page {page_num}]\n{text[:3500]}")

        combined_text = "\n\n".join(text_blocks)

        return f"""
You are analyzing table-of-contents pages from a {subject_name} textbook for Class {class_level} (CBSE board).

This is part {batch_index} of {total_batches}. Extract ONLY chapters/topics that are visible in this part.
Do not invent missing chapters from other pages.

Return a JSON array where each chapter has:
- chapter_number: Integer chapter number
- chapter_name: Chapter title (clean, without chapter number prefix)
- author: Author name if mentioned (optional)
- page_number: Starting page number if mentioned
- topics: Array of topic objects (if sub-topics are listed)

For topics, include:
- section_number: Section number if shown (e.g., "3.3" or "3.3.1")
- topic_name: Topic/section title
- page_range: Page range if mentioned (e.g., "14-20")
- description: Brief description if available
- subtopics: Array of nested subtopics (each with section_number, topic_name, page_range, description)

Output requirements:
- Return ONLY valid JSON array
- No markdown, no explanations
- Keep chapter numbers and names exactly as shown in text

Table-of-contents text for this part:

{combined_text[:12000]}

Return only the JSON array.
"""

    def _merge_extracted_chapters(self, chapter_dicts: List[Dict[str, Any]]) -> List[ExtractedChapter]:
        """Merge chapter fragments from multiple extraction batches into one canonical chapter list."""
        merged: Dict[str, Dict[str, Any]] = {}

        for chapter in chapter_dicts:
            chapter_number = chapter.get("chapter_number")
            chapter_name = (chapter.get("chapter_name") or "").strip()
            key = (
                f"num:{chapter_number}"
                if isinstance(chapter_number, int) and chapter_number > 0
                else f"name:{chapter_name.lower()}"
            )

            if key not in merged:
                merged[key] = {
                    "chapter_number": chapter_number if isinstance(chapter_number, int) else 0,
                    "chapter_name": chapter_name,
                    "author": (chapter.get("author") or "").strip(),
                    "page_number": chapter.get("page_number"),
                    "topics": [],
                }

            current = merged[key]

            if not current.get("chapter_name") and chapter_name:
                current["chapter_name"] = chapter_name

            current_author = (current.get("author") or "").strip()
            new_author = (chapter.get("author") or "").strip()
            if not current_author and new_author:
                current["author"] = new_author

            current_page = current.get("page_number")
            new_page = chapter.get("page_number")
            if isinstance(new_page, int):
                if not isinstance(current_page, int) or new_page < current_page:
                    current["page_number"] = new_page

            topic_seen = {
                (
                    (topic.get("section_number") or "").strip(),
                    (topic.get("topic_name") or "").strip().lower(),
                    (topic.get("page_range") or "").strip(),
                )
                for topic in current["topics"]
            }
            for topic in chapter.get("topics", []):
                section_number = (topic.get("section_number") or "").strip()
                topic_name = (topic.get("topic_name") or "").strip()
                page_range = (topic.get("page_range") or "").strip()
                topic_key = (section_number, topic_name.lower(), page_range)
                if topic_name and topic_key not in topic_seen:
                    current["topics"].append(
                        {
                            "section_number": section_number,
                            "topic_name": topic_name,
                            "page_range": page_range,
                            "description": (topic.get("description") or "").strip(),
                            "subtopics": topic.get("subtopics", []) or [],
                        }
                    )
                    topic_seen.add(topic_key)
                elif topic_name:
                    # Merge missing subtopics into existing topic entry
                    for existing_topic in current["topics"]:
                        existing_key = (
                            (existing_topic.get("section_number") or "").strip(),
                            (existing_topic.get("topic_name") or "").strip().lower(),
                            (existing_topic.get("page_range") or "").strip(),
                        )
                        if existing_key != topic_key:
                            continue

                        existing_subtopics = existing_topic.get("subtopics", []) or []
                        existing_subtopic_keys = {
                            (
                                (sub.get("section_number") or "").strip(),
                                (sub.get("topic_name") or "").strip().lower(),
                                (sub.get("page_range") or "").strip(),
                            )
                            for sub in existing_subtopics
                        }
                        for subtopic in (topic.get("subtopics", []) or []):
                            subtopic_key = (
                                (subtopic.get("section_number") or "").strip(),
                                (subtopic.get("topic_name") or "").strip().lower(),
                                (subtopic.get("page_range") or "").strip(),
                            )
                            if (subtopic.get("topic_name") or "").strip() and subtopic_key not in existing_subtopic_keys:
                                existing_subtopics.append(subtopic)
                                existing_subtopic_keys.add(subtopic_key)
                        existing_topic["subtopics"] = existing_subtopics
                        break

        ordered = sorted(
            merged.values(),
            key=lambda item: (
                item.get("chapter_number") if isinstance(item.get("chapter_number"), int) and item.get("chapter_number") > 0 else 10**9,
                item.get("page_number") if isinstance(item.get("page_number"), int) else 10**9,
                (item.get("chapter_name") or "").lower(),
            ),
        )

        chapters: List[ExtractedChapter] = []
        for item in ordered:
            if not (item.get("chapter_name") or "").strip():
                continue

            topic_objects = [
                ExtractedTopic(
                    topic_name=topic.get("topic_name") or "",
                    section_number=topic.get("section_number") or "",
                    page_range=topic.get("page_range") or "",
                    description=topic.get("description") or "",
                    subtopics=[
                        ExtractedTopic(
                            topic_name=subtopic.get("topic_name") or "",
                            section_number=subtopic.get("section_number") or "",
                            page_range=subtopic.get("page_range") or "",
                            description=subtopic.get("description") or "",
                            subtopics=[],
                        )
                        for subtopic in (topic.get("subtopics", []) or [])
                        if (subtopic.get("topic_name") or "").strip()
                    ],
                )
                for topic in item.get("topics", [])
            ]

            topic_objects = self._normalize_topic_hierarchy(topic_objects)

            chapters.append(
                ExtractedChapter(
                    chapter_number=item.get("chapter_number") or 0,
                    chapter_name=item.get("chapter_name") or "",
                    author=item.get("author") or "",
                    page_number=item.get("page_number"),
                    topics=topic_objects,
                )
            )

        return chapters
    
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
- section_number: Section number if visible (e.g., "3.3" or "3.3.1")
- topic_name: Topic/section title
- page_range: Page range if visible (e.g., "14-20")
- description: Brief description if available
- subtopics: Array of nested subtopics when sub-sections are present

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
            response_text = self._clean_response_text(response_text)

            try:
                chapters_data = json.loads(response_text)
            except json.JSONDecodeError:
                chapters_data = self._attempt_json_repair(response_text)

            if not isinstance(chapters_data, list):
                raise ValueError("AI response must be a JSON array of chapters")
            
            chapters = []
            for ch_data in chapters_data:
                if not isinstance(ch_data, dict):
                    continue

                chapter_name = (ch_data.get("chapter_name") or "").strip()
                chapter_number = self._coerce_chapter_number(ch_data, chapter_name)
                page_number = self._coerce_optional_int(ch_data.get("page_number"))

                topics = []
                for topic_data in ch_data.get("topics", []):
                    if isinstance(topic_data, dict):
                        topics.append(self._build_topic_from_dict(topic_data))

                topics = self._normalize_topic_hierarchy(topics)

                if not chapter_name and not topics:
                    # Skip empty/invalid chapter placeholders from model output.
                    continue
                
                chapter = ExtractedChapter(
                    chapter_number=chapter_number,
                    chapter_name=chapter_name,
                    author=ch_data.get("author", ""),
                    page_number=page_number,
                    topics=topics
                )
                chapters.append(chapter)
            
            return chapters
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse extraction response JSON (first 1000 chars): {response_text[:1000]}")
            logger.error(f"Response text (last 500 chars): {response_text[-500:]}")
            logger.error(f"Total response length: {len(response_text)} chars")
            logger.error(f"Response text: {response_text[:500]}")
            raise ValueError(f"Invalid JSON response from AI: {str(e)}")
        except Exception as e:
            logger.error(f" Failed to parse extraction response: {e}")
            raise

    def _coerce_optional_int(self, value: Any) -> int | None:
        """Convert model-provided number-like values to int, else return None."""
        if value is None:
            return None
        if isinstance(value, bool):
            return None
        if isinstance(value, int):
            return value
        if isinstance(value, float):
            return int(value)
        if isinstance(value, str):
            match = re.search(r'\d+', value)
            if match:
                return int(match.group(0))
        return None

    def _coerce_chapter_number(self, chapter_data: Dict[str, Any], chapter_name: str) -> int:
        """Return a safe integer chapter number from noisy model payload."""
        direct = self._coerce_optional_int(chapter_data.get("chapter_number"))
        if direct is not None:
            return direct

        # Try to infer from chapter title, e.g. "3. Pair of Linear Equations..."
        name_match = re.match(r'^\s*(\d+)\s*[\).:-]?\s+', chapter_name or "")
        if name_match:
            return int(name_match.group(1))

        # Try to infer from first topic section number, e.g. 4.1 => chapter 4
        for topic in chapter_data.get("topics", []) or []:
            if not isinstance(topic, dict):
                continue
            section = (topic.get("section_number") or "").strip()
            sec_match = re.match(r'^(\d+)(?:\.\d+)+$', section)
            if sec_match:
                return int(sec_match.group(1))

            topic_name = (topic.get("topic_name") or "").strip()
            topic_match = re.match(r'^(\d+)(?:\.\d+)+\s*[\).:-]?\s+', topic_name)
            if topic_match:
                return int(topic_match.group(1))

        # Keep parsing resilient; 0 means unknown and will still merge by chapter name.
        return 0

    def _build_topic_from_dict(self, topic_data: Dict[str, Any]) -> ExtractedTopic:
        """Build an ExtractedTopic recursively from raw dict payload."""
        raw_name = (topic_data.get("topic_name") or "").strip()
        detected_section, cleaned_name = self._extract_section_number(raw_name)

        section_number = (topic_data.get("section_number") or "").strip() or detected_section
        topic_name = cleaned_name or raw_name

        raw_subtopics = topic_data.get("subtopics", []) or []
        subtopics = [self._build_topic_from_dict(subtopic) for subtopic in raw_subtopics if isinstance(subtopic, dict)]

        return ExtractedTopic(
            topic_name=topic_name,
            section_number=section_number,
            page_range=(topic_data.get("page_range") or "").strip(),
            description=(topic_data.get("description") or "").strip(),
            subtopics=subtopics,
        )

    def _extract_section_number(self, text: str) -> Tuple[str, str]:
        """Extract section number prefix from a title like '3.3.1 Substitution Method'."""
        if not text:
            return "", ""

        match = re.match(r'^\s*((?:\d+\.)+\d+|\d+)\s*[\)\.:\-]?\s*(.+?)\s*$', text)
        if not match:
            return "", text.strip()

        return match.group(1).strip(), match.group(2).strip()

    def _normalize_topic_hierarchy(self, topics: List[ExtractedTopic]) -> List[ExtractedTopic]:
        """
        Attach numbered sub-sections (e.g. 3.3.1) under their parent section (e.g. 3.3).
        Preserves model-provided nested subtopics and avoids flattening them as top-level topics.
        """
        if not topics:
            return []

        normalized: List[ExtractedTopic] = []
        section_to_topic: Dict[str, ExtractedTopic] = {}

        for topic in topics:
            section = (topic.section_number or "").strip()
            if section:
                level = section.count('.') + 1
                if level >= 3:
                    parent_section = '.'.join(section.split('.')[:2])
                    parent_topic = section_to_topic.get(parent_section)
                    if parent_topic:
                        child_key = (
                            (topic.section_number or "").strip(),
                            (topic.topic_name or "").strip().lower(),
                            (topic.page_range or "").strip(),
                        )
                        existing_child_keys = {
                            (
                                (child.section_number or "").strip(),
                                (child.topic_name or "").strip().lower(),
                                (child.page_range or "").strip(),
                            )
                            for child in parent_topic.subtopics
                        }
                        if child_key not in existing_child_keys:
                            parent_topic.subtopics.append(topic)
                        continue

            normalized.append(topic)
            if section and section.count('.') == 1:
                section_to_topic[section] = topic

        return normalized

    def _clean_response_text(self, response_text: str) -> str:
        """Normalize model response before JSON parsing."""
        text = response_text.strip()

        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]

        if text.endswith("```"):
            text = text[:-3]

        text = text.strip()
        text = re.sub(r',\s*([}\]])', r'\1', text)
        return text

    def _attempt_json_repair(self, text: str) -> List[Dict[str, Any]]:
        """
        Try to recover valid chapter JSON when model output is truncated.
        Returns fully parsed chapter dicts when possible, otherwise re-raises the original parse error.
        """
        try:
            json_match = re.search(r'\[\s*\{.*\}\s*\]', text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass

        if text.startswith('['):
            depth = 0
            in_string = False
            escape_next = False
            last_complete_pos = -1
            recovered_count = 0

            for idx, char in enumerate(text):
                if escape_next:
                    escape_next = False
                    continue

                if char == '\\':
                    escape_next = True
                    continue

                if char == '"':
                    in_string = not in_string
                    continue

                if in_string:
                    continue

                if char == '{':
                    depth += 1
                elif char == '}':
                    depth -= 1
                    if depth == 0:
                        last_complete_pos = idx + 1
                        recovered_count += 1

            if last_complete_pos > 1 and recovered_count > 0:
                repaired = text[:last_complete_pos].rstrip(', \n\t') + ']'
                repaired_data = json.loads(repaired)
                logger.warning(
                    f"Recovered {len(repaired_data)} complete chapters from truncated AI response"
                )
                return repaired_data

        return json.loads(text)

curriculum_extraction_service = CurriculumExtractionService()
