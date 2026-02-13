"""
Gemini Embedding Helper - Direct REST API calls for embedding generation.

Uses the Gemini REST API directly (bypasses google-generativeai library)
to ensure compatibility with the latest embedding models.

Model: gemini-embedding-001 (768-dim output for Pinecone compatibility)
"""

import logging
import requests
from typing import List, Optional

logger = logging.getLogger(__name__)

# The only embedding model currently available in Gemini API
EMBEDDING_MODEL = "models/gemini-embedding-001"
EMBEDDING_DIMENSION = 768  # Match Pinecone index dimension
API_BASE = "https://generativelanguage.googleapis.com/v1beta"


def generate_embedding(
    text: str,
    api_key: str,
    task_type: str = "RETRIEVAL_DOCUMENT",
    dimension: int = EMBEDDING_DIMENSION
) -> List[float]:
    """
    Generate embedding using Gemini REST API directly.
    
    Args:
        text: Input text to embed
        api_key: Gemini API key
        task_type: RETRIEVAL_DOCUMENT for indexing, RETRIEVAL_QUERY for search
        dimension: Output dimension (768 for Pinecone compatibility)
    
    Returns:
        List of floats representing the embedding vector
    """
    url = f"{API_BASE}/{EMBEDDING_MODEL}:embedContent?key={api_key}"
    
    payload = {
        "model": EMBEDDING_MODEL,
        "content": {
            "parts": [{"text": text}]
        },
        "taskType": task_type,
        "outputDimensionality": dimension
    }
    
    response = requests.post(url, json=payload, timeout=30)
    
    if response.status_code != 200:
        error_msg = response.json().get("error", {}).get("message", response.text)
        raise Exception(f"Embedding API error ({response.status_code}): {error_msg}")
    
    return response.json()["embedding"]["values"]


def generate_embeddings_batch(
    texts: List[str],
    api_key: str,
    task_type: str = "RETRIEVAL_DOCUMENT",
    dimension: int = EMBEDDING_DIMENSION
) -> List[List[float]]:
    """
    Generate embeddings for multiple texts using Gemini batch API.
    
    Args:
        texts: List of input texts
        api_key: Gemini API key
        task_type: RETRIEVAL_DOCUMENT for indexing, RETRIEVAL_QUERY for search
        dimension: Output dimension (768 for Pinecone compatibility)
    
    Returns:
        List of embedding vectors
    """
    url = f"{API_BASE}/{EMBEDDING_MODEL}:batchEmbedContents?key={api_key}"
    
    requests_list = []
    for text in texts:
        requests_list.append({
            "model": EMBEDDING_MODEL,
            "content": {
                "parts": [{"text": text}]
            },
            "taskType": task_type,
            "outputDimensionality": dimension
        })
    
    payload = {
        "requests": requests_list
    }
    
    response = requests.post(url, json=payload, timeout=120)
    
    if response.status_code != 200:
        error_msg = response.json().get("error", {}).get("message", response.text)
        raise Exception(f"Batch embedding API error ({response.status_code}): {error_msg}")
    
    result = response.json()
    embeddings = [item["values"] for item in result["embeddings"]]
    return embeddings
