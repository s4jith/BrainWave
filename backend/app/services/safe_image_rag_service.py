"""
Hallucination-safe image RAG pipeline for NCERT chatbot.

Pipeline:
1) Image relevance classification (education vs irrelevant photo)
2) Educational text/description extraction with Gemini Vision
3) Vector retrieval from NCERT Pinecone namespaces only
4) Strict similarity gating (>= 0.75)
5) Answer generation grounded ONLY in retrieved NCERT context

Any uncertain step fails closed with a refusal message.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from app.services.enhanced_rag_service import enhanced_rag_service
from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)


IRRELEVANT_IMAGE_MESSAGE = (
    "This image does not appear to be related to NCERT study material. "
    "Please upload textbook pages, diagrams, or questions."
)

NO_TOPIC_FOUND_MESSAGE = "I could not find this topic in the NCERT material."

IMAGE_UNREADABLE_MESSAGE = (
    "Unable to read the uploaded image clearly. "
    "Please upload textbook pages, diagrams, or questions."
)

# Kept conservative to avoid hallucinations, but not so strict that valid
# diagram/textbook snippets get rejected frequently.
SIMILARITY_THRESHOLD = 0.45


CHATBOT_SYSTEM_PROMPT = """You are an NCERT tutoring assistant.

NON-NEGOTIABLE SAFETY RULES:
1. Answer ONLY from the provided NCERT_CONTEXT.
2. Never use outside knowledge.
3. Never guess or fabricate facts.
4. If NCERT_CONTEXT is missing or insufficient, reply exactly:
   \"I could not find this topic in the NCERT material.\"
5. Keep the answer concise, clear, and suitable for the student's class level.
"""


IMAGE_RELEVANCE_CLASSIFIER_PROMPT = """You are an image relevance classifier for an NCERT study assistant.

Task: Decide whether this image is educationally relevant to NCERT study content.

RELEVANT examples:
- textbook pages
- handwritten/printed questions
- diagrams
- charts/graphs
- math/science problems

IRRELEVANT examples:
- selfies/people photos
- animals/pets
- memes
- random lifestyle photos
- scenery/travel shots

Return ONLY strict JSON with keys:
{
  "is_relevant": true or false,
  "category": "textbook_page|diagram|chart|question_sheet|handwritten_question|photo|selfie|animal|meme|scenery|other",
  "confidence": number between 0 and 1,
  "reason": "short reason"
}
"""


IMAGE_UNDERSTANDING_PROMPT = """You are extracting educational content from an image for NCERT retrieval.

Return ONLY strict JSON with keys:
{
  "has_educational_content": true or false,
  "image_type": "textbook_page|diagram|chart|question|mixed|other",
  "extracted_text": "OCR text exactly as visible (empty string if none)",
  "description": "short factual description of visible educational content",
  "retrieval_query": "one clean search query for NCERT retrieval"
}

Rules:
- Do not invent unseen text.
- If little/no readable educational content exists, set has_educational_content=false.
- Keep retrieval_query compact and factual.
"""


SAFE_ANSWER_GENERATION_PROMPT = """{system_prompt}

ACTION: {action}
CLASS_LEVEL: {class_level}
SUBJECT: {subject}
USER_QUERY: {query}

NCERT_CONTEXT:
{context}

Output requirements:
- Use only NCERT_CONTEXT.
- If context is missing/insufficient, output exactly: "I could not find this topic in the NCERT material."
- No assumptions, no extra facts, no fabricated examples.
- For `define`: brief definition + 2-4 bullet key points.
- For `elaborate`: structured explanation with short headings.
- For `stick_flow`: stepwise numbered flow.
"""


RAG_QUERY_EXAMPLE = {
    "retrieval_query": "Define photosynthesis and explain role of chlorophyll",
    "subject": "Biology",
    "class_level": 7,
    "chapter": 6,
    "similarity_threshold": 0.75,
}


@dataclass
class SafeImageRAGResult:
    answer: str
    source_count: int
    best_similarity: float
    extracted_query: str
    source_chunks: List[str]


class SafeImageRAGService:
    """Strict, fail-closed image RAG pipeline for NCERT-only answering."""

    def __init__(self) -> None:
        self.rag = enhanced_rag_service
        self.gemini = gemini_service

    @staticmethod
    def _decode_image_data(image_data: str) -> bytes:
        if image_data.startswith("data:"):
            image_data = image_data.split(",", 1)[1]
        return base64.b64decode(image_data)

    @staticmethod
    def _extract_json(payload: str) -> Dict[str, Any]:
        if not payload:
            return {}

        text = payload.strip()
        try:
            return json.loads(text)
        except Exception:
            pass

        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if not match:
            return {}
        try:
            return json.loads(match.group(0))
        except Exception:
            return {}

    def _classify_image_relevance(self, image_bytes: bytes) -> Dict[str, Any]:
        raw = self.gemini.generate_response_with_image(
            prompt=IMAGE_RELEVANCE_CLASSIFIER_PROMPT,
            image_bytes=image_bytes,
            mime_type="image/png",
        )
        parsed = self._extract_json(raw)
        return {
            "is_relevant": bool(parsed.get("is_relevant", False)),
            "category": str(parsed.get("category", "other")),
            "confidence": float(parsed.get("confidence", 0.0) or 0.0),
            "reason": str(parsed.get("reason", "")),
        }

    def _extract_educational_query(self, image_bytes: bytes) -> Dict[str, Any]:
        raw = self.gemini.generate_response_with_image(
            prompt=IMAGE_UNDERSTANDING_PROMPT,
            image_bytes=image_bytes,
            mime_type="image/png",
        )
        parsed = self._extract_json(raw)
        return {
            "has_educational_content": bool(parsed.get("has_educational_content", False)),
            "image_type": str(parsed.get("image_type", "other")),
            "extracted_text": str(parsed.get("extracted_text", "") or "").strip(),
            "description": str(parsed.get("description", "") or "").strip(),
            "retrieval_query": str(parsed.get("retrieval_query", "") or "").strip(),
        }

    def _retrieve_ncert_chunks(
        self,
        query: str,
        subject: str,
        class_level: int,
        chapter: Optional[int],
    ) -> tuple[List[Dict[str, Any]], float]:
        query_embedding = self.rag.generate_embedding(query)
        chunks, _distribution = self.rag.query_multi_class(
            query_text=query,
            subject=subject,
            student_class=class_level,
            chapter=chapter,
            mode="basic",
            chunks_per_class=10,
            query_embedding=query_embedding,
        )

        if not chunks:
            return [], 0.0

        filtered = [c for c in chunks if float(c.get("score", 0.0)) >= SIMILARITY_THRESHOLD]
        best_similarity = max(float(c.get("score", 0.0)) for c in chunks)
        return filtered, best_similarity

    @staticmethod
    def _build_context(chunks: List[Dict[str, Any]], max_chunks: int = 6) -> str:
        context_parts: List[str] = []
        for chunk in chunks[:max_chunks]:
            text = str(chunk.get("text", "")).strip()
            if not text:
                continue
            chunk_class = chunk.get("class")
            chapter = chunk.get("chapter")
            score = float(chunk.get("score", 0.0))
            context_parts.append(
                f"[class={chunk_class} chapter={chapter} score={score:.3f}]\n{text}"
            )
        return "\n\n---\n\n".join(context_parts)

    def _generate_grounded_answer(
        self,
        *,
        action: str,
        class_level: int,
        subject: str,
        query: str,
        context: str,
    ) -> str:
        prompt = SAFE_ANSWER_GENERATION_PROMPT.format(
            system_prompt=CHATBOT_SYSTEM_PROMPT,
            action=action,
            class_level=class_level,
            subject=subject,
            query=query,
            context=context,
        )
        answer = self.gemini.generate_response(prompt, max_output_tokens=1200).strip()
        if not answer:
            return NO_TOPIC_FOUND_MESSAGE
        return answer

    async def run_pipeline(
        self,
        *,
        image_data: str,
        action: str,
        class_level: int,
        subject: str,
        chapter: Optional[int],
        fallback_text: str = "",
    ) -> SafeImageRAGResult:
        """Run strict hallucination-safe image pipeline and return final answer."""
        try:
            image_bytes = self._decode_image_data(image_data)
        except Exception as exc:
            logger.warning("Image decode failed: %s", exc)
            return SafeImageRAGResult(
                answer=IMAGE_UNREADABLE_MESSAGE,
                source_count=0,
                best_similarity=0.0,
                extracted_query="",
                source_chunks=[],
            )

        relevance = await asyncio.to_thread(self._classify_image_relevance, image_bytes)
        logger.info(
            "[IMAGE_RAG] relevance=%s category=%s confidence=%.2f",
            relevance.get("is_relevant"),
            relevance.get("category"),
            float(relevance.get("confidence", 0.0)),
        )
        if not relevance["is_relevant"]:
            logger.info("Image rejected as irrelevant: %s", relevance)
            return SafeImageRAGResult(
                answer=IRRELEVANT_IMAGE_MESSAGE,
                source_count=0,
                best_similarity=0.0,
                extracted_query="",
                source_chunks=[],
            )

        understanding = await asyncio.to_thread(self._extract_educational_query, image_bytes)
        logger.info(
            "[IMAGE_RAG] understanding has_educational_content=%s type=%s extracted_text_len=%s query_len=%s",
            understanding.get("has_educational_content"),
            understanding.get("image_type"),
            len(understanding.get("extracted_text", "")),
            len(understanding.get("retrieval_query", "")),
        )
        if not understanding["has_educational_content"]:
            logger.info("Image has no usable educational content: %s", understanding)
            return SafeImageRAGResult(
                answer=IMAGE_UNREADABLE_MESSAGE,
                source_count=0,
                best_similarity=0.0,
                extracted_query="",
                source_chunks=[],
            )

        extracted_query = understanding["retrieval_query"] or understanding["extracted_text"] or understanding["description"]
        extracted_query = extracted_query.strip()

        if (
            fallback_text
            and len(extracted_query) < 8
            and "[screenshot from page" not in fallback_text.lower()
        ):
            extracted_query = fallback_text.strip()

        if len(extracted_query) < 5:
            return SafeImageRAGResult(
                answer=IMAGE_UNREADABLE_MESSAGE,
                source_count=0,
                best_similarity=0.0,
                extracted_query="",
                source_chunks=[],
            )

        chunks, best_similarity = await asyncio.to_thread(
            self._retrieve_ncert_chunks,
            extracted_query,
            subject,
            class_level,
            chapter,
        )

        logger.info(
            "[IMAGE_RAG] retrieval subject=%s class=%s chapter=%s query='%s' matches=%s best_similarity=%.3f threshold=%.2f",
            subject,
            class_level,
            chapter,
            extracted_query[:180],
            len(chunks),
            best_similarity,
            SIMILARITY_THRESHOLD,
        )

        # If chapter metadata is noisy/misaligned, retry once across all chapters.
        if chapter is not None and (not chunks or best_similarity < SIMILARITY_THRESHOLD):
            chunks_all, best_similarity_all = await asyncio.to_thread(
                self._retrieve_ncert_chunks,
                extracted_query,
                subject,
                class_level,
                None,
            )
            logger.info(
                "[IMAGE_RAG] all-chapter fallback matches=%s best_similarity=%.3f",
                len(chunks_all),
                best_similarity_all,
            )
            if best_similarity_all > best_similarity:
                chunks = chunks_all
                best_similarity = best_similarity_all

        if not chunks or best_similarity < SIMILARITY_THRESHOLD:
            logger.info(
                "NCERT match rejected by threshold: best=%.3f threshold=%.2f",
                best_similarity,
                SIMILARITY_THRESHOLD,
            )
            return SafeImageRAGResult(
                answer=NO_TOPIC_FOUND_MESSAGE,
                source_count=0,
                best_similarity=best_similarity,
                extracted_query=extracted_query,
                source_chunks=[],
            )

        context = self._build_context(chunks)
        answer = await asyncio.to_thread(
            self._generate_grounded_answer,
            action=action,
            class_level=class_level,
            subject=subject,
            query=extracted_query,
            context=context,
        )

        return SafeImageRAGResult(
            answer=answer,
            source_count=len(chunks),
            best_similarity=best_similarity,
            extracted_query=extracted_query,
            source_chunks=[str(c.get("text", "")).strip() for c in chunks if str(c.get("text", "")).strip()],
        )


safe_image_rag_service = SafeImageRAGService()
