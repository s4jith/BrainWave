"""
PDF Cache Service

Caches PDFs downloaded from Cloudinary for rendering.
Uses a simple file-based cache with automatic cleanup.
"""

import os
import hashlib
import time
import logging
import requests
from typing import Optional
from pathlib import Path

logger = logging.getLogger(__name__)

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cache", "pdfs")
os.makedirs(CACHE_DIR, exist_ok=True)

CACHE_EXPIRY = 3600

def get_cache_path(url: str) -> str:
    """Get the cache file path for a URL."""
    url_hash = hashlib.md5(url.encode()).hexdigest()
    return os.path.join(CACHE_DIR, f"{url_hash}.pdf")

def is_cache_valid(cache_path: str) -> bool:
    """Check if a cached file is still valid."""
    if not os.path.exists(cache_path):
        return False
    
    file_age = time.time() - os.path.getmtime(cache_path)
    return file_age < CACHE_EXPIRY

def get_cached_pdf(url: str) -> Optional[str]:
    """
    Get a PDF from cache or download it.
    
    Returns the local file path to the PDF.
    """
    if not url or not url.startswith('http'):
        return None
    
    cache_path = get_cache_path(url)
    
    if is_cache_valid(cache_path):
        logger.info(f"📁 Using cached PDF: {cache_path}")
        return cache_path
    
    try:
        logger.info(f"⬇️ Downloading PDF from: {url}")
        response = requests.get(url, timeout=60)
        
        if response.status_code != 200:
            logger.error(f" Failed to download PDF: {response.status_code}")
            return None
        
        with open(cache_path, 'wb') as f:
            f.write(response.content)
        
        logger.info(f"Cached PDF: {cache_path} ({len(response.content)} bytes)")
        return cache_path
        
    except Exception as e:
        logger.error(f" PDF download failed: {e}")
        return None

def cleanup_cache():
    """Remove expired cached files."""
    try:
        for filename in os.listdir(CACHE_DIR):
            filepath = os.path.join(CACHE_DIR, filename)
            if os.path.isfile(filepath):
                file_age = time.time() - os.path.getmtime(filepath)
                if file_age > CACHE_EXPIRY:
                    os.remove(filepath)
                    logger.info(f" Cleaned up expired cache: {filename}")
    except Exception as e:
        logger.warning(f"Cache cleanup failed: {e}")

def clear_cache():
    """Clear all cached PDFs."""
    try:
        for filename in os.listdir(CACHE_DIR):
            filepath = os.path.join(CACHE_DIR, filename)
            if os.path.isfile(filepath):
                os.remove(filepath)
        logger.info(" PDF cache cleared")
    except Exception as e:
        logger.warning(f"Cache clear failed: {e}")
