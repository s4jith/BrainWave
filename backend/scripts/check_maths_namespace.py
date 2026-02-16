"""
Check what data exists in Pinecone maths namespace
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pinecone import Pinecone
from app.core.config import settings
import random

# Connect to Pinecone
pc = Pinecone(api_key=settings.PINECONE_API_KEY)
index = pc.Index(
    name=settings.PINECONE_MASTER_INDEX,
    host=settings.PINECONE_MASTER_HOST
)

# Random vector for query
random_vec = [random.random() for _ in range(768)]

# Query maths namespace
try:
    results = index.query(
        namespace="maths",
        vector=random_vec,
        top_k=10,
        include_metadata=True
    )
    
    print(f"✅ Found {len(results.matches)} vectors in 'maths' namespace")
    print("\nSample metadata:")
    
    for i, match in enumerate(results.matches[:5], 1):
        meta = match.metadata
        print(f"\n{i}. Score: {match.score:.4f}")
        print(f"   Class: {meta.get('class_level') or meta.get('class', 'N/A')}")
        print(f"   Chapter: {meta.get('chapter_number') or meta.get('chapter', 'N/A')}")
        print(f"   Title: {meta.get('title') or meta.get('book_title', 'N/A')}")
        
    # Get namespace stats
    stats = index.describe_index_stats()
    if 'namespaces' in stats and 'maths' in stats['namespaces']:
        maths_stats = stats['namespaces']['maths']
        print(f"\n📊 Namespace stats:")
        print(f"   Total vectors: {maths_stats.get('vector_count', 0):,}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
