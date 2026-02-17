"""
Cloudinary Service for PDF Storage (Free Tier)

Free Tier: 25GB storage, 25GB bandwidth/month
Perfect for storing educational PDFs

Setup:
1. Create account at https://cloudinary.com/users/register_free
2. Get your Cloud Name, API Key, and API Secret from the dashboard
3. Add to .env file:
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
"""

import os
import logging
from typing import Optional, Dict

# Ensure dotenv is loaded
from dotenv import load_dotenv
load_dotenv()

import cloudinary
import cloudinary.uploader
import cloudinary.api
from app.core.config import settings

logger = logging.getLogger(__name__)


class CloudinaryService:
    """Service for managing PDF uploads to Cloudinary."""
    
    def __init__(self):
        """Initialize Cloudinary service."""
        self.initialized = False
        self.cloud_name = None
        self._initialize()
    
    def _initialize(self):
        """Configure Cloudinary with credentials."""
        try:
            # Try to get credentials from environment
            cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME')
            api_key = os.getenv('CLOUDINARY_API_KEY')
            api_secret = os.getenv('CLOUDINARY_API_SECRET')
            
            logger.info(f" Cloudinary init check - cloud_name: {cloud_name}, api_key: {'set' if api_key else 'not set'}, api_secret: {'set' if api_secret else 'not set'}")
            
            if not all([cloud_name, api_key, api_secret]):
                logger.warning(" Cloudinary credentials not found in environment")
                logger.info("   Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET to .env")
                logger.info("   Sign up free at: https://cloudinary.com/users/register_free")
                return
            
            cloudinary.config(
                cloud_name=cloud_name,
                api_key=api_key,
                api_secret=api_secret,
                secure=True
            )
            
            self.cloud_name = cloud_name
            self.initialized = True
            logger.info("Cloudinary service initialized successfully")
            logger.info(f"   Cloud: {cloud_name}")
            
        except Exception as e:
            logger.error(f" Failed to initialize Cloudinary: {e}")
            self.initialized = False
    
    def is_available(self) -> bool:
        """Check if Cloudinary service is available. Attempts re-init if not initialized."""
        if not self.initialized:
            logger.info("🔄 Cloudinary not initialized, attempting re-initialization...")
            self._initialize()
        return self.initialized
    
    def upload_pdf(
        self,
        file_path: str = None,
        file_content: bytes = None,
        filename: str = None,
        class_level: int = None,
        subject: str = None,
        chapter_number: int = None,
        folder: str = None
    ) -> Optional[Dict]:
        """
        Upload a PDF to Cloudinary.
        
        Args:
            file_path: Path to local PDF file
            file_content: PDF bytes (alternative to file_path)
            filename: Original filename
            class_level: Class number
            subject: Subject name
            chapter_number: Chapter number
            folder: Custom folder path (overrides class/subject/chapter)
        
        Returns:
            Dict with URL and metadata, or None if failed
        """
        if not self.is_available():
            logger.warning(" Cloudinary not available, skipping upload")
            return None
        
        try:
            # Build folder path: ncert-books/class_11/physics/chapter_1
            if folder:
                upload_folder = folder
            elif class_level and subject and chapter_number:
                upload_folder = f"ncert-books/class_{class_level}/{subject.lower().replace(' ', '_')}/chapter_{chapter_number}"
            else:
                upload_folder = "ncert-books"
            
            # Determine public_id (filename without extension)
            if filename:
                public_id = os.path.splitext(filename)[0]
            else:
                public_id = f"chapter_{chapter_number}"
            
            # Full public_id with folder
            full_public_id = f"{upload_folder}/{public_id}"
            
            # Upload to Cloudinary
            if file_path and os.path.exists(file_path):
                result = cloudinary.uploader.upload(
                    file_path,
                    resource_type="raw",  # Upload PDFs as raw files
                    public_id=full_public_id,
                    overwrite=True,
                    type="upload"  # Use 'upload' type for public access
                )
            elif file_content:
                # Upload from bytes
                import io
                result = cloudinary.uploader.upload(
                    io.BytesIO(file_content),
                    resource_type="raw",  # Upload PDFs as raw files
                    public_id=full_public_id,
                    overwrite=True,
                    type="upload"  # Use 'upload' type for public access
                )
            else:
                logger.error(" No file path or content provided")
                return None
            
            # Use the actual secure_url returned by Cloudinary
            # Note: Cloudinary returns the correct versioned URL
            secure_url = result.get('secure_url')
            public_id_result = result.get('public_id')
            
            logger.info(f"Uploaded PDF to Cloudinary: {public_id_result}")
            logger.info(f"   URL: {secure_url}")
            
            return {
                'url': secure_url,
                'public_id': public_id_result,
                'resource_type': result.get('resource_type'),
                'format': result.get('format'),
                'bytes': result.get('bytes'),
                'created_at': result.get('created_at'),
                'folder': upload_folder
            }
            
        except Exception as e:
            logger.error(f" Cloudinary upload failed: {e}")
            return None
    
    def delete_file(self, public_id: str) -> bool:
        """Delete a file from Cloudinary."""
        if not self.is_available():
            return False
        
        try:
            result = cloudinary.uploader.destroy(
                public_id,
                resource_type="raw"
            )
            
            if result.get('result') == 'ok':
                logger.info(f"Deleted from Cloudinary: {public_id}")
                return True
            else:
                logger.warning(f" Cloudinary delete returned: {result.get('result')}")
                return False
                
        except Exception as e:
            logger.error(f" Cloudinary delete failed: {e}")
            return False
    
    def get_url(self, public_id: str) -> Optional[str]:
        """Get the URL for a file."""
        if not self.is_available():
            return None
        
        try:
            url = cloudinary.CloudinaryResource(public_id, resource_type="raw").build_url(secure=True)
            return url
        except Exception as e:
            logger.error(f" Failed to get Cloudinary URL: {e}")
            return None


# Global instance
_cloudinary_service = None

def get_cloudinary_service() -> CloudinaryService:
    """Get the global Cloudinary service instance."""
    global _cloudinary_service
    if _cloudinary_service is None:
        _cloudinary_service = CloudinaryService()
    return _cloudinary_service
