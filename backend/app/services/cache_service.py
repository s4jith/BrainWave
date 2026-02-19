"""
Unified Cache Service

Provides deterministic caching for:
1. "Book to Bot" annotations (Exact Match)
2. API responses
3. Expensive computations

Uses MongoDB for persistent storage to survive server restarts.
"""

import hashlib
import json
import logging
from datetime import datetime, timedelta
from typing import Any, Optional, Dict
from app.db.mongo import mongodb

logger = logging.getLogger(__name__)

class CacheService:
    """
    Centralized caching service using MongoDB.
    """
    
    def __init__(self):
        self.collection_name = "unified_cache"
        self._collection = None

    @property
    def collection(self):
        """Lazy access to collection to ensure MongoDB connection is ready."""
        if self._collection is None:
            if mongodb.db is not None:
                self._collection = mongodb.get_collection(self.collection_name)
            else:
                logger.warning("MongoDB not connected yet, caching disabled")
        return self._collection

    def _generate_key(self, prefix: str, data: Dict[str, Any]) -> str:
        """
        Generate a deterministic MD5 hash key from input data.
        
        Args:
            prefix: Key prefix (e.g., 'annotation', 'ocr')
            data: Dictionary of input parameters to hash
        
        Returns:
            String key: "prefix_md5hash"
        """
        json_str = json.dumps(data, sort_keys=True, default=str)
        hash_str = hashlib.md5(json_str.encode()).hexdigest()
        return f"{prefix}_{hash_str}"

    async def get(self, prefix: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Retrieve cached data if exists and not expired.
        
        Args:
            prefix: Key prefix
            data: Input parameters valid for hash generation
            
        Returns:
            Cached response dictionary or None
        """
        if self.collection is None:
            return None

        key = self._generate_key(prefix, data)
        try:
            doc = await self.collection.find_one({"_id": key})
            
            if not doc:
                return None
            
            if "expires_at" in doc and doc["expires_at"] < datetime.utcnow():
                await self.collection.delete_one({"_id": key})
                return None
                
            await self.collection.update_one(
                {"_id": key},
                {"$set": {"last_accessed": datetime.utcnow()}}
            )
            
            return doc.get("response")
            
        except Exception as e:
            logger.error(f"Cache get error for {key}: {e}")
            return None

    async def set(self, prefix: str, input_data: Dict[str, Any], response: Any, ttl_days: int = 30) -> bool:
        """
        Store data in cache.
        
        Args:
            prefix: Key prefix
            input_data: Input parameters used to generate the key
            response: The result to cache
            ttl_days: Time to live in days
            
        Returns:
            True if successful
        """
        if self.collection is None:
            return False

        key = self._generate_key(prefix, input_data)
        try:
            expires_at = datetime.utcnow() + timedelta(days=ttl_days)
            
            doc = {
                "_id": key,
                "prefix": prefix,
                "input_hash_data": input_data,
                "response": response,
                "created_at": datetime.utcnow(),
                "last_accessed": datetime.utcnow(),
                "expires_at": expires_at
            }
            
            await self.collection.replace_one({"_id": key}, doc, upsert=True)
            logger.debug(f"Cached saved: {key}")
            return True
            
        except Exception as e:
            logger.error(f"Cache set error for {key}: {e}")
            return False

    async def get_annotation_cache(self, action: str, subject: str, class_level: int, selected_text: str, image_data: str = None) -> Optional[Dict]:
        """Specific helper for annotation caching logic."""
        
        data = {
            "action": action,
            "subject": subject.lower(),
            "class_level": class_level,
            "text_snippet": selected_text.strip()[:500],
        }
        
        if image_data:
            if image_data.startswith('data:'):
                try:
                    vals = image_data.split(',', 1)
                    raw_data = vals[1] if len(vals) > 1 else vals[0]
                except:
                    raw_data = image_data
            else:
                raw_data = image_data
                
            data["image_hash"] = hashlib.md5(raw_data.encode()).hexdigest()
            
        return await self.get("annotation", data)

    async def set_annotation_cache(self, action: str, subject: str, class_level: int, selected_text: str, response_data: Dict, image_data: str = None):
        """Specific helper to save annotation cache."""
        
        data = {
            "action": action,
            "subject": subject.lower(),
            "class_level": class_level,
            "text_snippet": selected_text.strip()[:500],
        }
        
        if image_data:
             if image_data.startswith('data:'):
                try:
                    vals = image_data.split(',', 1)
                    raw_data = vals[1] if len(vals) > 1 else vals[0]
                except:
                    raw_data = image_data
             else:
                raw_data = image_data
             data["image_hash"] = hashlib.md5(raw_data.encode()).hexdigest()
             
        await self.set("annotation", data, response_data)

cache_service = CacheService()
