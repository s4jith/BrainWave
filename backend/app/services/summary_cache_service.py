"""
Summary Cache Service - Caches page and chapter summaries to reduce API costs.

Saves summaries in MongoDB for reuse when same page/chapter is requested again.
"""

from app.db.mongo import mongodb
from datetime import datetime
import logging
import hashlib

logger = logging.getLogger(__name__)


class SummaryCacheService:
    """Service to cache and retrieve summaries from MongoDB."""
    
    def __init__(self):
        self.collection_name = "summary_cache"
    
    async def get_collection(self):
        """Get the summary cache collection."""
        return mongodb.db[self.collection_name]
    
    def _generate_cache_key(self, summary_type: str, subject: str, class_level: int, 
                           chapter: int, page_number: int = None) -> str:
        """Generate a unique cache key for the summary."""
        if summary_type == "page":
            key_string = f"{summary_type}_{subject}_{class_level}_{chapter}_{page_number}"
        else:
            key_string = f"{summary_type}_{subject}_{class_level}_{chapter}"
        
        return hashlib.md5(key_string.lower().encode()).hexdigest()
    
    async def get_cached_summary(
        self,
        summary_type: str,  # "page" or "chapter"
        subject: str,
        class_level: int,
        chapter: int,
        page_number: int = None
    ) -> dict | None:
        """
        Check if a summary exists in cache.
        
        Returns:
            Cached summary dict or None if not found
        """
        try:
            collection = await self.get_collection()
            cache_key = self._generate_cache_key(
                summary_type, subject, class_level, chapter, page_number
            )
            
            # Find cached summary
            cached = await collection.find_one({"cache_key": cache_key})
            
            if cached:
                logger.info(f"✅ Cache HIT: {summary_type} summary for {subject} Class {class_level}, Ch {chapter}" + 
                           (f", Page {page_number}" if page_number else ""))
                
                # Update access count and last accessed
                await collection.update_one(
                    {"_id": cached["_id"]},
                    {
                        "$inc": {"access_count": 1},
                        "$set": {"last_accessed": datetime.utcnow()}
                    }
                )
                
                return {
                    "summary": cached["summary"],
                    "created_at": cached["created_at"],
                    "source": "cache"
                }
            
            logger.info(f"❌ Cache MISS: {summary_type} summary for {subject} Class {class_level}, Ch {chapter}" +
                       (f", Page {page_number}" if page_number else ""))
            return None
            
        except Exception as e:
            logger.error(f"❌ Cache lookup error: {e}")
            return None
    
    async def save_summary(
        self,
        summary_type: str,  # "page" or "chapter"
        subject: str,
        class_level: int,
        chapter: int,
        summary: str,
        page_number: int = None,
        chapter_title: str = None
    ) -> bool:
        """
        Save a summary to cache.
        
        Returns:
            True if saved successfully
        """
        try:
            collection = await self.get_collection()
            cache_key = self._generate_cache_key(
                summary_type, subject, class_level, chapter, page_number
            )
            
            document = {
                "cache_key": cache_key,
                "summary_type": summary_type,
                "subject": subject,
                "class_level": class_level,
                "chapter": chapter,
                "page_number": page_number,
                "chapter_title": chapter_title,
                "summary": summary,
                "created_at": datetime.utcnow(),
                "last_accessed": datetime.utcnow(),
                "access_count": 1
            }
            
            # Upsert (update if exists, insert if not)
            await collection.update_one(
                {"cache_key": cache_key},
                {"$set": document},
                upsert=True
            )
            
            logger.info(f"✅ Saved {summary_type} summary to cache: {subject} Class {class_level}, Ch {chapter}" +
                       (f", Page {page_number}" if page_number else ""))
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to save summary to cache: {e}")
            return False
    
    async def get_cache_stats(self) -> dict:
        """Get cache statistics."""
        try:
            collection = await self.get_collection()
            
            total = await collection.count_documents({})
            page_summaries = await collection.count_documents({"summary_type": "page"})
            chapter_summaries = await collection.count_documents({"summary_type": "chapter"})
            
            return {
                "total_cached": total,
                "page_summaries": page_summaries,
                "chapter_summaries": chapter_summaries
            }
        except Exception as e:
            logger.error(f"❌ Failed to get cache stats: {e}")
            return {"total_cached": 0}


# Global instance
summary_cache_service = SummaryCacheService()
