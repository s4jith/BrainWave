"""
Google Drive Service for NCERT AI Learning Backend

This service handles:
- Uploading PDFs to Google Drive
- Creating folder structure (Class -> Subject -> Chapters)
- Getting shareable links for PDFs
- Managing folder permissions

Setup Instructions:
1. Go to Google Cloud Console: https://console.cloud.google.com/
2. Create a new project or select existing one
3. Enable Google Drive API
4. Create a Service Account:
   - Go to APIs & Services > Credentials
   - Create Credentials > Service Account
   - Download the JSON key file
   - Save as 'google_drive_credentials.json' in backend folder
5. Share the root folder with the service account email
   (the email looks like: service-account-name@project-id.iam.gserviceaccount.com)
"""

import os
import json
import logging
from typing import Optional, Dict, Tuple
from io import BytesIO

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaFileUpload
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']

ROOT_FOLDER_ID = "1OWyxSncLl03Ax2CjJuV7-g7R0LuarZYp"

class GoogleDriveService:
    """Service for managing PDF uploads to Google Drive."""
    
    def __init__(self, credentials_path: Optional[str] = None):
        """
        Initialize Google Drive service.
        
        Args:
            credentials_path: Path to service account JSON credentials file.
                            If not provided, looks for 'google_drive_credentials.json' in backend folder.
        """
        self.service = None
        self.initialized = False
        self.credentials_path = credentials_path
        
        if not self.credentials_path:
            backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            possible_paths = [
                os.path.join(backend_dir, "google_drive_credentials.json"),
                os.path.join(backend_dir, "credentials.json"),
                os.path.join(backend_dir, "service_account.json"),
            ]
            for path in possible_paths:
                if os.path.exists(path):
                    self.credentials_path = path
                    break
        
        self._initialize()
    
    def _initialize(self):
        """Initialize the Google Drive API service."""
        try:
            if not self.credentials_path or not os.path.exists(self.credentials_path):
                logger.warning(" Google Drive credentials not found. Drive upload disabled.")
                logger.info("   To enable: Create a service account and save credentials as 'google_drive_credentials.json' in backend folder")
                return
            
            credentials = service_account.Credentials.from_service_account_file(
                self.credentials_path,
                scopes=SCOPES
            )
            
            self.service = build('drive', 'v3', credentials=credentials)
            self.initialized = True
            logger.info("Google Drive service initialized successfully")
            
        except Exception as e:
            logger.error(f" Failed to initialize Google Drive service: {e}")
            self.initialized = False
    
    def is_available(self) -> bool:
        """Check if Google Drive service is available."""
        return self.initialized and self.service is not None
    
    def find_or_create_folder(self, folder_name: str, parent_id: str = None) -> Optional[str]:
        """
        Find a folder by name or create it if it doesn't exist.
        
        Args:
            folder_name: Name of the folder to find/create
            parent_id: ID of the parent folder (uses ROOT_FOLDER_ID if not provided)
        
        Returns:
            Folder ID or None if failed
        """
        if not self.is_available():
            return None
        
        parent_id = parent_id or ROOT_FOLDER_ID
        
        try:
            query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and '{parent_id}' in parents and trashed=false"
            results = self.service.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name)',
                supportsAllDrives=True,
                includeItemsFromAllDrives=True
            ).execute()
            
            files = results.get('files', [])
            
            if files:
                logger.info(f"📁 Found existing folder: {folder_name}")
                return files[0]['id']
            
            folder_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [parent_id]
            }
            
            folder = self.service.files().create(
                body=folder_metadata,
                fields='id'
            ).execute()
            
            folder_id = folder.get('id')
            logger.info(f"📁 Created new folder: {folder_name} (ID: {folder_id})")
            
            return folder_id
            
        except HttpError as e:
            logger.error(f" Error finding/creating folder {folder_name}: {e}")
            return None
    
    def create_class_subject_structure(self, class_level: int, subject: str, chapter_number: int) -> Optional[str]:
        """
        Create the folder structure: Class X -> Subject -> Chapter Y
        
        Args:
            class_level: Class number (6-12)
            subject: Subject name (Mathematics, Physics, etc.)
            chapter_number: Chapter number
        
        Returns:
            Chapter folder ID or None if failed
        """
        if not self.is_available():
            return None
        
        try:
            class_folder_name = f"Class {class_level}"
            class_folder_id = self.find_or_create_folder(class_folder_name, ROOT_FOLDER_ID)
            if not class_folder_id:
                return None
            
            subject_folder_id = self.find_or_create_folder(subject, class_folder_id)
            if not subject_folder_id:
                return None
            
            chapter_folder_name = f"Chapter {chapter_number}"
            chapter_folder_id = self.find_or_create_folder(chapter_folder_name, subject_folder_id)
            
            return chapter_folder_id
            
        except Exception as e:
            logger.error(f" Error creating folder structure: {e}")
            return None
    
    def upload_pdf(
        self,
        file_path: str = None,
        file_content: bytes = None,
        filename: str = None,
        class_level: int = None,
        subject: str = None,
        chapter_number: int = None,
        folder_id: str = None
    ) -> Optional[Dict]:
        """
        Upload a PDF file to Google Drive.
        
        Args:
            file_path: Path to local PDF file (alternative to file_content)
            file_content: PDF file bytes (alternative to file_path)
            filename: Name for the file in Drive
            class_level: Class number (used to create folder structure)
            subject: Subject name (used to create folder structure)
            chapter_number: Chapter number (used to create folder structure)
            folder_id: Direct folder ID (overrides class/subject/chapter)
        
        Returns:
            Dict with file info including shareable link, or None if failed
        """
        if not self.is_available():
            logger.warning(" Google Drive not available, skipping upload")
            return None
        
        try:
            if folder_id:
                target_folder_id = folder_id
            elif class_level and subject and chapter_number:
                target_folder_id = self.create_class_subject_structure(
                    class_level, subject, chapter_number
                )
                if not target_folder_id:
                    logger.error(" Failed to create folder structure")
                    return None
            else:
                target_folder_id = ROOT_FOLDER_ID
            
            if not filename:
                if file_path:
                    filename = os.path.basename(file_path)
                else:
                    filename = "document.pdf"
            
            existing_file = self._find_file_in_folder(filename, target_folder_id)
            if existing_file:
                logger.info(f"📄 File already exists in Drive: {filename}")
                return self._update_file(existing_file['id'], file_path, file_content)
            
            file_metadata = {
                'name': filename,
                'parents': [target_folder_id]
            }
            
            if file_path and os.path.exists(file_path):
                media = MediaFileUpload(file_path, mimetype='application/pdf', resumable=True)
            elif file_content:
                media = MediaIoBaseUpload(
                    BytesIO(file_content),
                    mimetype='application/pdf',
                    resumable=True
                )
            else:
                logger.error(" No file path or content provided")
                return None
            
            file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, name, webViewLink, webContentLink',
                f1supportsAllDrives=True
            ).execute()
            
            file_id = file.get('id')
            logger.info(f"Uploaded PDF to Google Drive: {filename} (ID: {file_id})")
            
            self._set_file_permissions(file_id)
            
            shareable_link = self._get_shareable_link(file_id)
            
            return {
                'file_id': file_id,
                'filename': filename,
                'web_view_link': file.get('webViewLink'),
                'web_content_link': file.get('webContentLink'),
                'shareable_link': shareable_link,
                'embed_link': f"https://drive.google.com/file/d/{file_id}/preview",
                'direct_link': f"https://drive.google.com/uc?export=view&id={file_id}"
            }
            
        except HttpError as e:
            error_details = str(e)
            if 'storageQuotaExceeded' in error_details or 'Service Accounts do not have storage quota' in error_details:
                logger.warning(" Google Drive: Service accounts cannot upload to personal drives.")
                logger.info("   Solution: Use a Google Workspace Shared Drive instead of a personal folder.")
                logger.info("   The PDF will be served from local storage.")
            else:
                logger.error(f" Error uploading PDF to Google Drive: {e}")
            return None
        except Exception as e:
            logger.error(f" Unexpected error uploading PDF: {e}")
            return None
    
    def _find_file_in_folder(self, filename: str, folder_id: str) -> Optional[Dict]:
        """Find a file by name in a specific folder."""
        try:
            query = f"name='{filename}' and '{folder_id}' in parents and trashed=false"
            results = self.service.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name, webViewLink)',
                supportsAllDrives=True,
                includeItemsFromAllDrives=True
            ).execute()
            
            files = results.get('files', [])
            return files[0] if files else None
            
        except Exception as e:
            logger.error(f" Error finding file: {e}")
            return None
    
    def _update_file(self, file_id: str, file_path: str = None, file_content: bytes = None) -> Optional[Dict]:
        """Update an existing file's content."""
        try:
            if file_path and os.path.exists(file_path):
                media = MediaFileUpload(file_path, mimetype='application/pdf', resumable=True)
            elif file_content:
                media = MediaIoBaseUpload(
                    BytesIO(file_content),
                    mimetype='application/pdf',
                    resumable=True
                )
            else:
                return None
            
            file = self.service.files().update(
                fileId=file_id,
                media_body=media,
                fields='id, name, webViewLink, webContentLink',
                supportsAllDrives=True
            ).execute()
            
            logger.info(f"Updated file in Google Drive: {file.get('name')}")
            
            shareable_link = self._get_shareable_link(file_id)
            
            return {
                'file_id': file_id,
                'filename': file.get('name'),
                'web_view_link': file.get('webViewLink'),
                'web_content_link': file.get('webContentLink'),
                'shareable_link': shareable_link,
                'embed_link': f"https://drive.google.com/file/d/{file_id}/preview",
                'direct_link': f"https://drive.google.com/uc?export=view&id={file_id}"
            }
            
        except Exception as e:
            logger.error(f" Error updating file: {e}")
            return None
    
    def _set_file_permissions(self, file_id: str):
        """Set file permissions to be accessible by anyone with the link."""
        try:
            permission = {
                'type': 'anyone',
                'role': 'reader'
            }
            self.service.permissions().create(
                fileId=file_id,
                body=permission,
                supportsAllDrives=True
            ).execute()
            logger.info(f"Set permissions for file: {file_id}")
            
        except HttpError as e:
            if e.resp.status == 400:
                logger.info(f"ℹ️ Permissions already set for file: {file_id}")
            else:
                logger.error(f" Error setting permissions: {e}")
    
    def _get_shareable_link(self, file_id: str) -> str:
        """Get the shareable link for a file."""
        return f"https://drive.google.com/file/d/{file_id}/view?usp=sharing"
    
    def get_file_info(self, file_id: str) -> Optional[Dict]:
        """Get information about a file."""
        if not self.is_available():
            return None
        
        try:
            file = self.service.files().get(
                fileId=file_id,
                fields='id, name, mimeType, size, webViewLink, webContentLink, createdTime, modifiedTime'
            ).execute()
            
            return {
                'file_id': file.get('id'),
                'filename': file.get('name'),
                'mime_type': file.get('mimeType'),
                'size': file.get('size'),
                'web_view_link': file.get('webViewLink'),
                'web_content_link': file.get('webContentLink'),
                'created_time': file.get('createdTime'),
                'modified_time': file.get('modifiedTime'),
                'embed_link': f"https://drive.google.com/file/d/{file.get('id')}/preview",
                'direct_link': f"https://drive.google.com/uc?export=view&id={file.get('id')}"
            }
            
        except HttpError as e:
            logger.error(f" Error getting file info: {e}")
            return None
    
    def delete_file(self, file_id: str) -> bool:
        """Delete a file from Google Drive."""
        if not self.is_available():
            return False
        
        try:
            self.service.files().delete(fileId=file_id, supportsAllDrives=True).execute()
            logger.info(f"Deleted file from Google Drive: {file_id}")
            return True
            
        except HttpError as e:
            logger.error(f" Error deleting file: {e}")
            return False
    
    def list_folder_contents(self, folder_id: str = None) -> Optional[list]:
        """List contents of a folder."""
        if not self.is_available():
            return None
        
        folder_id = folder_id or ROOT_FOLDER_ID
        
        try:
            query = f"'{folder_id}' in parents and trashed=false"
            results = self.service.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name, mimeType, webViewLink)',
                orderBy='name',
                supportsAllDrives=True,
                includeItemsFromAllDrives=True
            ).execute()
            
            return results.get('files', [])
            
        except HttpError as e:
            logger.error(f" Error listing folder contents: {e}")
            return None

_drive_service = None

def get_drive_service() -> GoogleDriveService:
    """Get the global Google Drive service instance."""
    global _drive_service
    if _drive_service is None:
        _drive_service = GoogleDriveService()
    return _drive_service
