"""
Notes Router - Student notes CRUD endpoints.
"""

from fastapi import APIRouter, HTTPException, Query, Depends, UploadFile, File
from app.models.schemas import (
    NoteCreateRequest,
    Note,
    NotesListResponse,
    SuccessResponse,
    NotePdf,
    NotePdfListResponse,
)
from app.services.notes_service import notes_service
from typing import Optional
from pydantic import BaseModel
from app.core.permissions import require_role
from app.models.rbac_models import TokenData, UserRole
from app.services.cloudinary_service import get_cloudinary_service
from app.db.mongo import get_notes_collection
from app.db.mongo import db
from bson import ObjectId
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/notes",
    tags=["Notes"]
)


class NoteUpdateRequest(BaseModel):
    note_content: Optional[str] = None
    heading: Optional[str] = None


class PdfNoteUpdateRequest(BaseModel):
    note_text: Optional[str] = None


def _ensure_self_or_admin(student_id: str, current_user: TokenData) -> None:
    if current_user.role == UserRole.ADMIN:
        return
    if current_user.user_id == student_id:
        return
    if ObjectId.is_valid(student_id):
        user_doc = db.users.find_one({"_id": ObjectId(student_id)})
        if user_doc and user_doc.get("user_id") == current_user.user_id:
            return
    raise HTTPException(status_code=403, detail="Access denied")


async def _ensure_note_owner_or_admin(note_id: str, current_user: TokenData) -> None:
    if not ObjectId.is_valid(note_id):
        raise HTTPException(status_code=404, detail="Note not found")
    collection = get_notes_collection()
    note = await collection.find_one({"_id": ObjectId(note_id)})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    _ensure_self_or_admin(note.get("student_id", ""), current_user)

@router.post("/", response_model=Note)
async def create_note(
    request: NoteCreateRequest,
    current_user: TokenData = Depends(require_role([UserRole.STUDENT, UserRole.ADMIN]))
):
    """
    Create a new student note.
    
    Saves note to MongoDB Atlas with metadata including:
    - Student ID
    - Class, subject, chapter
    - Page number
    - Highlighted text
    - Note content and optional heading
    """
    try:
        _ensure_self_or_admin(request.student_id, current_user)
        logger.info(f"Create note request: Student {request.student_id}, Class {request.class_level}, {request.subject}, Ch. {request.chapter}")
        
        note = await notes_service.create_note(request)
        return note
    
    except Exception as e:
        logger.error(f" Create note error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{student_id}", response_model=NotesListResponse)
async def get_notes(
    student_id: str,
    class_level: Optional[int] = Query(None, ge=1, le=12),
    subject: Optional[str] = Query(None),
    chapter: Optional[int] = Query(None, ge=1),
    page_number: Optional[int] = Query(None, ge=1),
    current_user: TokenData = Depends(require_role([UserRole.STUDENT, UserRole.ADMIN]))
):
    """
    Retrieve notes for a student with optional filters.
    
    **Query Parameters:**
    - `class_level`: Filter by class (5-10)
    - `subject`: Filter by subject
    - `chapter`: Filter by chapter number
    """
    try:
        _ensure_self_or_admin(student_id, current_user)
        logger.info(f"Get notes request: Student {student_id}")
        
        notes = await notes_service.get_notes_by_student(
            student_id=student_id,
            class_level=class_level,
            subject=subject,
            chapter=chapter,
            page_number=page_number
        )
        
        return NotesListResponse(
            notes=notes,
            total=len(notes)
        )
    
    except Exception as e:
        logger.error(f" Get notes error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{note_id}", response_model=Note)
async def update_note(
    note_id: str,
    request: NoteUpdateRequest,
    current_user: TokenData = Depends(require_role([UserRole.STUDENT, UserRole.ADMIN]))
):
    """
    Update an existing note.
    
    **Parameters:**
    - `note_id`: MongoDB document ID
    - `note_content`: Updated note content (optional)
    - `heading`: Updated heading (optional)
    """
    try:
        await _ensure_note_owner_or_admin(note_id, current_user)
        logger.info(f"Update note request: {note_id}")
        
        note = await notes_service.update_note(
            note_id=note_id,
            note_content=request.note_content,
            heading=request.heading
        )
        
        return note
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f" Update note error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{note_id}", response_model=SuccessResponse)
async def delete_note(
    note_id: str,
    current_user: TokenData = Depends(require_role([UserRole.STUDENT, UserRole.ADMIN]))
):
    """
    Delete a note by ID.
    
    **Parameters:**
    - `note_id`: MongoDB document ID
    """
    try:
        await _ensure_note_owner_or_admin(note_id, current_user)
        logger.info(f"Delete note request: {note_id}")
        
        await notes_service.delete_note(note_id)
        
        return SuccessResponse(
            message=f"Note {note_id} deleted successfully"
        )
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f" Delete note error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{student_id}/pdfs", response_model=NotePdfListResponse)
async def upload_note_pdfs(
    student_id: str,
    files: list[UploadFile] = File(...),
    current_user: TokenData = Depends(require_role([UserRole.STUDENT, UserRole.ADMIN]))
):
    """Upload one or more student-private PDF notes."""
    try:
        _ensure_self_or_admin(student_id, current_user)
        if not files:
            raise HTTPException(status_code=400, detail="No files uploaded")

        cloudinary = get_cloudinary_service()
        if not cloudinary.is_available():
            raise HTTPException(status_code=503, detail="PDF upload service is unavailable")

        uploaded: list[NotePdf] = []
        for file in files:
            filename = (file.filename or "").strip()
            if not filename:
                continue
            if not filename.lower().endswith(".pdf"):
                raise HTTPException(status_code=400, detail=f"Only PDF files are allowed: {filename}")

            content = await file.read()
            if not content:
                continue

            stem = filename.rsplit(".", 1)[0]
            safe_stem = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in stem).strip("_") or "note"
            cloud_filename = f"{safe_stem}_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}.pdf"
            upload = cloudinary.upload_pdf(
                file_content=content,
                filename=cloud_filename,
                folder=f"student-notes/{student_id}",
            )
            if not upload:
                raise HTTPException(status_code=500, detail=f"Failed to upload file: {filename}")

            created = await notes_service.create_pdf_note(
                student_id=student_id,
                filename=filename,
                file_url=upload.get("url", ""),
                cloudinary_public_id=upload.get("public_id", ""),
                file_size=int(upload.get("bytes") or len(content)),
            )
            uploaded.append(created)

        return NotePdfListResponse(files=uploaded, total=len(uploaded))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload PDF notes error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{student_id}/pdfs", response_model=NotePdfListResponse)
async def get_note_pdfs(
    student_id: str,
    current_user: TokenData = Depends(require_role([UserRole.STUDENT, UserRole.ADMIN]))
):
    """List student-private uploaded PDF notes."""
    try:
        _ensure_self_or_admin(student_id, current_user)
        files = await notes_service.get_pdf_notes_by_student(student_id)
        return NotePdfListResponse(files=files, total=len(files))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"List PDF notes error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/pdfs/{pdf_note_id}", response_model=SuccessResponse)
async def delete_note_pdf(
    pdf_note_id: str,
    current_user: TokenData = Depends(require_role([UserRole.STUDENT, UserRole.ADMIN]))
):
    """Delete one uploaded student-private PDF note."""
    try:
        if not ObjectId.is_valid(pdf_note_id):
            raise HTTPException(status_code=404, detail="PDF note not found")

        pdf_doc = await notes_service.get_pdf_note_by_id(pdf_note_id)
        if not pdf_doc:
            raise HTTPException(status_code=404, detail="PDF note not found")

        _ensure_self_or_admin(pdf_doc.get("student_id", ""), current_user)

        cloudinary = get_cloudinary_service()
        public_id = pdf_doc.get("cloudinary_public_id")
        if public_id:
            cloudinary.delete_file(public_id)

        deleted = await notes_service.delete_pdf_note(pdf_note_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="PDF note not found")

        return SuccessResponse(message="PDF note deleted successfully")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete PDF note error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/pdfs/{pdf_note_id}", response_model=NotePdf)
async def update_note_pdf(
    pdf_note_id: str,
    request: PdfNoteUpdateRequest,
    current_user: TokenData = Depends(require_role([UserRole.STUDENT, UserRole.ADMIN]))
):
    """Update note text for an uploaded student-private PDF."""
    try:
        if not ObjectId.is_valid(pdf_note_id):
            raise HTTPException(status_code=404, detail="PDF note not found")

        pdf_doc = await notes_service.get_pdf_note_by_id(pdf_note_id)
        if not pdf_doc:
            raise HTTPException(status_code=404, detail="PDF note not found")

        _ensure_self_or_admin(pdf_doc.get("student_id", ""), current_user)
        updated = await notes_service.update_pdf_note_text(pdf_note_id, request.note_text)
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update PDF note text error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
