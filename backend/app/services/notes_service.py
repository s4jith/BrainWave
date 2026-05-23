"""
Notes Service - Handles student notes CRUD operations.
"""

from app.db.mongo import get_notes_collection
from app.models.schemas import Note, NoteCreateRequest, NotePdf
from datetime import datetime
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

class NotesService:
    """Service for managing student notes."""
    
    async def create_note(self, note_request: NoteCreateRequest) -> Note:
        """
        Create a new note in MongoDB.
        
        Args:
            note_request: Note creation request data
        
        Returns:
            Created Note object
        """
        try:
            collection = get_notes_collection()
            
            document = {
                "student_id": note_request.student_id,
                "class_level": note_request.class_level,
                "subject": note_request.subject,
                "chapter": note_request.chapter,
                "page_number": note_request.page_number,
                "highlight_text": note_request.highlight_text,
                "note_content": note_request.note_content,
                "heading": note_request.heading,
                "created_at": datetime.utcnow(),
                "updated_at": None
            }
            
            result = await collection.insert_one(document)
            
            note = Note(
                id=str(result.inserted_id),
                **document
            )
            
            logger.info(f"Note created: {note.id}")
            return note
        
        except Exception as e:
            logger.error(f" Failed to create note: {e}")
            raise
    
    async def get_notes_by_student(
        self,
        student_id: str,
        class_level: int = None,
        subject: str = None,
        chapter: int = None,
        page_number: int = None
    ) -> list[Note]:
        """
        Retrieve notes for a student with optional filters.
        
        Args:
            student_id: Student identifier
            class_level: Optional class filter
            subject: Optional subject filter
            chapter: Optional chapter filter
            page_number: Optional page number filter
        
        Returns:
            List of Note objects
        """
        try:
            collection = get_notes_collection()
            
            query = {"student_id": student_id}
            if class_level:
                query["class_level"] = class_level
            if subject:
                query["subject"] = subject
            if chapter:
                query["chapter"] = chapter
            if page_number:
                query["page_number"] = page_number
            
            cursor = collection.find(query).sort("created_at", -1)
            notes = []
            
            async for doc in cursor:
                note = Note(
                    id=str(doc["_id"]),
                    student_id=doc["student_id"],
                    class_level=doc["class_level"],
                    subject=doc["subject"],
                    chapter=doc["chapter"],
                    page_number=doc["page_number"],
                    highlight_text=doc["highlight_text"],
                    note_content=doc["note_content"],
                    heading=doc.get("heading"),
                    created_at=doc["created_at"],
                    updated_at=doc.get("updated_at")
                )
                notes.append(note)
            
            logger.info(f"Retrieved {len(notes)} notes for student {student_id}")
            return notes
        
        except Exception as e:
            logger.error(f" Failed to retrieve notes: {e}")
            raise
    
    async def update_note(
        self,
        note_id: str,
        note_content: str = None,
        heading: str = None
    ) -> Note:
        """
        Update an existing note.
        
        Args:
            note_id: Note ID
            note_content: Updated content (optional)
            heading: Updated heading (optional)
        
        Returns:
            Updated Note object
        """
        try:
            collection = get_notes_collection()
            
            update_doc = {"updated_at": datetime.utcnow()}
            if note_content is not None:
                update_doc["note_content"] = note_content
            if heading is not None:
                update_doc["heading"] = heading
            
            result = await collection.find_one_and_update(
                {"_id": ObjectId(note_id)},
                {"$set": update_doc},
                return_document=True
            )
            
            if not result:
                raise ValueError(f"Note {note_id} not found")
            
            note = Note(
                id=str(result["_id"]),
                student_id=result["student_id"],
                class_level=result["class_level"],
                subject=result["subject"],
                chapter=result["chapter"],
                page_number=result["page_number"],
                highlight_text=result["highlight_text"],
                note_content=result["note_content"],
                heading=result.get("heading"),
                created_at=result["created_at"],
                updated_at=result.get("updated_at")
            )
            
            logger.info(f"Note updated: {note_id}")
            return note
        
        except Exception as e:
            logger.error(f" Failed to update note: {e}")
            raise
    
    async def delete_note(self, note_id: str) -> bool:
        """
        Delete a note by ID.
        
        Args:
            note_id: Note ID
        
        Returns:
            True if deleted successfully
        """
        try:
            collection = get_notes_collection()
            
            result = await collection.delete_one({"_id": ObjectId(note_id)})
            
            if result.deleted_count == 0:
                raise ValueError(f"Note {note_id} not found")
            
            logger.info(f"Note deleted: {note_id}")
            return True
        
        except Exception as e:
            logger.error(f" Failed to delete note: {e}")
            raise

    async def create_pdf_note(
        self,
        student_id: str,
        filename: str,
        file_url: str,
        cloudinary_public_id: str,
        file_size: int,
        note_text: str | None = None,
    ) -> NotePdf:
        """Store uploaded PDF note metadata for a student."""
        try:
            collection = get_notes_collection().database["student_note_pdfs"]
            document = {
                "student_id": student_id,
                "filename": filename,
                "file_url": file_url,
                "cloudinary_public_id": cloudinary_public_id,
                "file_size": file_size,
                "note_text": note_text,
                "uploaded_at": datetime.utcnow(),
            }
            result = await collection.insert_one(document)
            return NotePdf(id=str(result.inserted_id), **document)
        except Exception as e:
            logger.error(f" Failed to create PDF note metadata: {e}")
            raise

    async def get_pdf_notes_by_student(self, student_id: str) -> list[NotePdf]:
        """List uploaded PDF notes for a student."""
        try:
            collection = get_notes_collection().database["student_note_pdfs"]
            cursor = collection.find({"student_id": student_id}).sort("uploaded_at", -1)
            files: list[NotePdf] = []
            async for doc in cursor:
                files.append(
                    NotePdf(
                        id=str(doc["_id"]),
                        student_id=doc["student_id"],
                        filename=doc["filename"],
                        file_url=doc["file_url"],
                        cloudinary_public_id=doc["cloudinary_public_id"],
                        file_size=int(doc.get("file_size", 0) or 0),
                        note_text=doc.get("note_text"),
                        uploaded_at=doc.get("uploaded_at") or datetime.utcnow(),
                    )
                )
            return files
        except Exception as e:
            logger.error(f" Failed to list PDF notes: {e}")
            raise

    async def get_pdf_note_by_id(self, pdf_note_id: str) -> dict | None:
        """Fetch one uploaded PDF note document by ID."""
        try:
            collection = get_notes_collection().database["student_note_pdfs"]
            return await collection.find_one({"_id": ObjectId(pdf_note_id)})
        except Exception:
            return None

    async def delete_pdf_note(self, pdf_note_id: str) -> bool:
        """Delete uploaded PDF note metadata by ID."""
        try:
            collection = get_notes_collection().database["student_note_pdfs"]
            result = await collection.delete_one({"_id": ObjectId(pdf_note_id)})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f" Failed to delete PDF note metadata: {e}")
            raise

    async def update_pdf_note_text(self, pdf_note_id: str, note_text: str | None) -> NotePdf:
        """Update note text attached to a PDF note."""
        try:
            collection = get_notes_collection().database["student_note_pdfs"]
            doc = await collection.find_one_and_update(
                {"_id": ObjectId(pdf_note_id)},
                {"$set": {"note_text": note_text}},
                return_document=True,
            )
            if not doc:
                raise ValueError("PDF note not found")
            return NotePdf(
                id=str(doc["_id"]),
                student_id=doc["student_id"],
                filename=doc["filename"],
                file_url=doc["file_url"],
                cloudinary_public_id=doc["cloudinary_public_id"],
                file_size=int(doc.get("file_size", 0) or 0),
                note_text=doc.get("note_text"),
                uploaded_at=doc.get("uploaded_at") or datetime.utcnow(),
            )
        except Exception as e:
            logger.error(f" Failed to update PDF note text: {e}")
            raise

notes_service = NotesService()
