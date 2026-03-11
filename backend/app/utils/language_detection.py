"""
Language Detection Utility for NCERT AI Learning Platform

Detects Indian languages using langdetect library with Unicode script fallback.
No ML models or OpenVINO required.
"""

import logging
from typing import Tuple

logger = logging.getLogger(__name__)

try:
    from langdetect import detect, detect_langs, LangDetectException
    HAS_LANGDETECT = True
except ImportError:
    HAS_LANGDETECT = False

SUPPORTED_LANGUAGES = {
    "en": "English",
    "hi": "Hindi",
    "ta": "Tamil",
    "ur": "Urdu",
    "bn": "Bengali",
    "mr": "Marathi",
    "kn": "Kannada",
    "te": "Telugu",
    "ml": "Malayalam",
    "gu": "Gujarati",
    "pa": "Punjabi",
    "or": "Odia",
    "as": "Assamese",
    "sa": "Sanskrit",
    "ne": "Nepali"
}

SCRIPT_RANGES = {
    "hi": (0x0900, 0x097F),
    "ta": (0x0B80, 0x0BFF),
    "ur": (0x0600, 0x06FF),
    "bn": (0x0980, 0x09FF),
    "kn": (0x0C80, 0x0CFF),
    "te": (0x0C00, 0x0C7F),
    "ml": (0x0D00, 0x0D7F),
    "gu": (0x0A80, 0x0AFF),
    "pa": (0x0A00, 0x0A7F),
    "or": (0x0B00, 0x0B7F),
}

def _detect_by_script(text: str) -> str:
    """Detect language based on Unicode script ranges."""
    script_counts = {lang: 0 for lang in SCRIPT_RANGES}

    for char in text:
        code = ord(char)
        for lang, (start, end) in SCRIPT_RANGES.items():
            if start <= code <= end:
                script_counts[lang] += 1
                break

    max_count = max(script_counts.values())
    if max_count > 0:
        for lang, count in script_counts.items():
            if count == max_count:
                return lang

    return "en"

def detect_language(text: str) -> str:
    """
    Detect language of input text.

    Returns:
        ISO 639-1 language code: "en", "hi", "ta", "ur", etc.
    """
    if not text or len(text.strip()) < 3:
        return "en"

    if HAS_LANGDETECT:
        try:
            detected = detect(text)
            if detected in SUPPORTED_LANGUAGES:
                return detected
            if detected in ["mr", "ne", "sa"]:
                return "hi"
            if detected in ["as"]:
                return "bn"
        except Exception:
            pass

    return _detect_by_script(text)

def detect_language_with_confidence(text: str) -> Tuple[str, float]:
    """
    Detect language with confidence score.

    Returns:
        Tuple of (language_code, confidence)
    """
    if not text or len(text.strip()) < 3:
        return "en", 1.0

    if HAS_LANGDETECT:
        try:
            langs = detect_langs(text)
            if langs:
                top_lang = langs[0]
                lang_code = top_lang.lang
                confidence = top_lang.prob

                if lang_code in SUPPORTED_LANGUAGES:
                    return lang_code, confidence
                if lang_code in ["mr", "ne", "sa"]:
                    return "hi", confidence * 0.9
                if lang_code in ["as"]:
                    return "bn", confidence * 0.9
        except Exception:
            pass

    lang = _detect_by_script(text)
    return lang, 0.7 if lang != "en" else 0.8

def get_language_name(code: str) -> str:
    """Get full language name from code."""
    return SUPPORTED_LANGUAGES.get(code, "Unknown")

def is_indic_language(code: str) -> bool:
    """Check if language code is an Indian language."""
    return code in SUPPORTED_LANGUAGES and code != "en"
