"""
Book Management Router

Admin endpoints for managing books:
- Upload new books (PDF + metadata → MongoDB + Pinecone)
- List all books
- Delete books (from both MongoDB and Pinecone)
- Get books by class/subject for student view

Student endpoints:
- Get available subjects for their class
- Get chapters/lessons for a subject
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime
import asyncio
import os
import uuid
import json
import logging
import tempfile
from pathlib import Path
import io

import requests
from bson import ObjectId

from app.db.mongo import db
from app.core.config import settings
from app.services.cloudinary_service import get_cloudinary_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/books", tags=["Book Management"])

BOOKS_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "books")
os.makedirs(BOOKS_UPLOAD_DIR, exist_ok=True)

EMBEDDING_JOBS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "embedding_jobs")
os.makedirs(EMBEDDING_JOBS_DIR, exist_ok=True)

ACTIVE_EMBEDDING_TASKS: Dict[str, asyncio.Task] = {}


def _embedding_jobs_collection():
    return db.get_collection("embedding_jobs")


def _job_dir(job_id: str) -> str:
    path = os.path.join(EMBEDDING_JOBS_DIR, job_id)
    os.makedirs(path, exist_ok=True)
    return path


def _job_pdf_path(job_id: str) -> str:
    return os.path.join(_job_dir(job_id), "source.pdf")


def _job_chunks_path(job_id: str) -> str:
    return os.path.join(_job_dir(job_id), "chunks.json")


def _serialize_job(job: Dict) -> Dict:
    if not job:
        return {}
    return {
        "job_id": job.get("job_id"),
        "book_id": job.get("book_id"),
        "status": job.get("status"),
        "namespace": job.get("namespace"),
        "total_chunks": job.get("total_chunks", 0),
        "processed_chunks": job.get("processed_chunks", 0),
        "successful_embeddings": job.get("successful_embeddings", 0),
        "failed_embeddings": job.get("failed_embeddings", 0),
        "total_pages": job.get("total_pages", 0),
        "processed_pages": job.get("processed_pages", 0),
        "last_message": job.get("last_message", ""),
        "errors": job.get("errors", []),
        "created_at": job.get("created_at").isoformat() if job.get("created_at") else None,
        "updated_at": job.get("updated_at").isoformat() if job.get("updated_at") else None,
        "completed_at": job.get("completed_at").isoformat() if job.get("completed_at") else None,
    }


def _update_job(job_id: str, fields: Dict) -> None:
    fields["updated_at"] = datetime.utcnow()
    _embedding_jobs_collection().update_one({"job_id": job_id}, {"$set": fields})


def _read_job_control_state(job_id: str) -> str:
    job = _embedding_jobs_collection().find_one({"job_id": job_id}, {"status": 1})
    if not job:
        return "cancel"
    status = job.get("status", "queued")
    if status == "paused":
        return "pause"
    if status == "cancelled":
        return "cancel"
    return "continue"


def _start_embedding_task(job_id: str) -> None:
    existing = ACTIVE_EMBEDDING_TASKS.get(job_id)
    if existing and not existing.done():
        return

    loop = asyncio.get_running_loop()
    task = loop.create_task(_run_embedding_job(job_id))
    ACTIVE_EMBEDDING_TASKS[job_id] = task

    def _cleanup(_task: asyncio.Task) -> None:
        ACTIVE_EMBEDDING_TASKS.pop(job_id, None)

    task.add_done_callback(_cleanup)


async def _run_embedding_job(job_id: str) -> None:
    """Background worker for a single embedding job with pause/resume/cancel controls."""
    try:
        jobs_col = _embedding_jobs_collection()
        job = jobs_col.find_one({"job_id": job_id})
        if not job:
            return

        if job.get("status") == "paused":
            logger.info(f"Embedding job {job_id} is paused before start; skipping run")
            return

        if job.get("status") in {"cancelled", "completed"}:
            return

        book = db.books.find_one({"_id": ObjectId(job["book_id"])})
        if not book:
            _update_job(job_id, {
                "status": "failed",
                "errors": ["Book not found for embedding job"],
                "completed_at": datetime.utcnow(),
            })
            return

        _update_job(job_id, {"status": "processing", "last_message": "Preparing embedding pipeline"})
        db.books.update_one(
            {"_id": ObjectId(job["book_id"])},
            {"$set": {"processing_status": "processing", "updated_at": datetime.utcnow()}},
        )

        from app.services.pdf_processor import AdvancedPDFProcessor, PineconeEmbeddingUploader

        pdf_processor = AdvancedPDFProcessor(
            chunk_size=800,
            chunk_overlap=150,
            dpi=200,
            use_gemini_vision=True,
        )
        uploader = PineconeEmbeddingUploader()

        chunks_path = _job_chunks_path(job_id)
        pdf_path = _job_pdf_path(job_id)

        if not os.path.exists(pdf_path):
            pdf_url = book.get("cloudinary_url") or book.get("pdf_url")
            if not pdf_url:
                raise RuntimeError("PDF URL not available for embedding job")
            response = requests.get(pdf_url, timeout=60)
            if response.status_code != 200:
                raise RuntimeError("Failed to download PDF for embedding job")
            with open(pdf_path, "wb") as pdf_handle:
                pdf_handle.write(response.content)

        chunks = None
        total_pages = int(job.get("total_pages") or 0)
        processed_pages = int(job.get("processed_pages") or 0)

        if os.path.exists(chunks_path):
            with open(chunks_path, "r", encoding="utf-8") as chunks_file:
                chunks = json.load(chunks_file)
            _update_job(job_id, {
                "last_message": "Loaded cached chunks; continuing from checkpoint",
                "total_chunks": len(chunks),
            })
        else:
            _update_job(job_id, {"last_message": "Extracting text and OCR from PDF"})
            result = pdf_processor.process_pdf(pdf_path=pdf_path, book_metadata=job["book_metadata"])
            if not result.success:
                _update_job(job_id, {
                    "status": "failed",
                    "errors": result.errors,
                    "total_pages": result.total_pages,
                    "processed_pages": result.processed_pages,
                    "last_message": "PDF processing failed",
                    "completed_at": datetime.utcnow(),
                })
                db.books.update_one(
                    {"_id": ObjectId(job["book_id"])},
                    {
                        "$set": {
                            "processing_status": "failed",
                            "processing_errors": result.errors,
                            "updated_at": datetime.utcnow(),
                        }
                    },
                )
                return

            chunks = pdf_processor.create_chunks(result.pages, job["book_metadata"])
            total_pages = result.total_pages
            processed_pages = result.processed_pages

            with open(chunks_path, "w", encoding="utf-8") as chunks_file:
                json.dump(chunks, chunks_file)

            _update_job(job_id, {
                "total_pages": total_pages,
                "processed_pages": processed_pages,
                "total_chunks": len(chunks),
                "last_message": "Chunking complete; generating embeddings",
            })

        if not chunks:
            raise RuntimeError("No chunks available for embedding upload")

        current_job = jobs_col.find_one({"job_id": job_id}) or {}
        start_index = int(current_job.get("processed_chunks") or 0)
        successful_so_far = int(current_job.get("successful_embeddings") or 0)
        failed_so_far = int(current_job.get("failed_embeddings") or 0)

        def _progress(done: int, total: int, message: str) -> None:
            _update_job(job_id, {
                "processed_chunks": done,
                "total_chunks": total,
                "last_message": message,
            })

        def _control() -> str:
            return _read_job_control_state(job_id)

        upload_stats = uploader.upload_chunks(
            chunks=chunks,
            namespace=job["namespace"],
            progress_callback=_progress,
            start_chunk_index=start_index,
            control_callback=_control,
        )

        processed_chunks = int(upload_stats.get("processed_chunks", start_index))
        new_successful = successful_so_far + int(upload_stats.get("successful", 0))
        new_failed = failed_so_far + int(upload_stats.get("failed", 0))
        all_errors = list(current_job.get("errors", [])) + list(upload_stats.get("errors", []))

        if upload_stats.get("cancelled"):
            _update_job(job_id, {
                "status": "cancelled",
                "processed_chunks": processed_chunks,
                "successful_embeddings": new_successful,
                "failed_embeddings": new_failed,
                "errors": all_errors,
                "last_message": "Embedding job cancelled by admin",
                "completed_at": datetime.utcnow(),
            })
            db.books.update_one(
                {"_id": ObjectId(job["book_id"])},
                {
                    "$set": {
                        "has_embeddings": new_successful > 0,
                        "embedding_count": new_successful,
                        "processing_status": "cancelled",
                        "processing_errors": all_errors,
                        "updated_at": datetime.utcnow(),
                    }
                },
            )
            return

        if upload_stats.get("paused"):
            _update_job(job_id, {
                "status": "paused",
                "processed_chunks": processed_chunks,
                "successful_embeddings": new_successful,
                "failed_embeddings": new_failed,
                "errors": all_errors,
                "last_message": "Embedding job paused",
            })
            db.books.update_one(
                {"_id": ObjectId(job["book_id"])},
                {
                    "$set": {
                        "has_embeddings": new_successful > 0,
                        "embedding_count": new_successful,
                        "processing_status": "paused",
                        "processing_errors": all_errors,
                        "updated_at": datetime.utcnow(),
                    }
                },
            )
            return

        success = processed_chunks >= len(chunks) and new_successful > 0

        _update_job(job_id, {
            "status": "completed" if success else "failed",
            "processed_chunks": processed_chunks,
            "total_chunks": len(chunks),
            "successful_embeddings": new_successful,
            "failed_embeddings": new_failed,
            "errors": all_errors,
            "last_message": "Embedding job completed" if success else "Embedding job finished with errors",
            "completed_at": datetime.utcnow(),
        })

        db.books.update_one(
            {"_id": ObjectId(job["book_id"])},
            {
                "$set": {
                    "has_embeddings": new_successful > 0,
                    "embedding_count": new_successful,
                    "total_pages": total_pages,
                    "total_chunks": len(chunks),
                    "processing_status": "completed" if success else "failed",
                    "processing_errors": all_errors,
                    "updated_at": datetime.utcnow(),
                }
            },
        )

    except Exception as e:
        logger.error(f"Embedding job runner failed for job_id={job_id}: {e}")
        _update_job(job_id, {
            "status": "failed",
            "last_message": "Embedding job crashed",
            "errors": [str(e)],
            "completed_at": datetime.utcnow(),
        })
        try:
            job = _embedding_jobs_collection().find_one({"job_id": job_id})
            if job:
                db.books.update_one(
                    {"_id": ObjectId(job["book_id"])},
                    {
                        "$set": {
                            "processing_status": "failed",
                            "processing_errors": [str(e)],
                            "updated_at": datetime.utcnow(),
                        }
                    },
                )
        except Exception:
            pass

async def process_book_embeddings(
    book_id: str,
    pdf_path: str,
    book_metadata: Dict,
    namespace: str
) -> Dict:
    """
    Process a PDF and generate embeddings for Pinecone.
    
    This function:
    1. Extracts text from PDF using PyPDF2 and OCR
    2. Handles images, formulas, and diagrams
    3. Chunks the content appropriately
    4. Generates embeddings using Gemini
    5. Uploads to Pinecone
    
    Returns statistics about the processing.
    """
    try:
        from app.services.pdf_processor import AdvancedPDFProcessor, PineconeEmbeddingUploader
        
        logger.info(f"🔄 Starting embedding generation for book: {book_id}")
        
        pdf_processor = AdvancedPDFProcessor(
            chunk_size=800,
            chunk_overlap=150,
            dpi=200,
            use_gemini_vision=True
        )
        
        uploader = PineconeEmbeddingUploader()
        
        logger.info("📄 Processing PDF...")
        result = pdf_processor.process_pdf(
            pdf_path=pdf_path,
            book_metadata=book_metadata
        )
        
        if not result.success:
            return {
                "success": False,
                "error": "PDF processing failed",
                "errors": result.errors,
                "total_pages": result.total_pages,
                "processed_pages": result.processed_pages
            }
        
        logger.info("📦 Creating chunks...")
        chunks = pdf_processor.create_chunks(result.pages, book_metadata)
        
        if not chunks:
            return {
                "success": False,
                "error": "No content extracted from PDF",
                "total_pages": result.total_pages,
                "total_chunks": 0
            }
        
        logger.info(f"Uploading {len(chunks)} chunks to Pinecone...")
        upload_stats = uploader.upload_chunks(chunks, namespace)
        
        return {
            "success": upload_stats['successful'] > 0,
            "total_pages": result.total_pages,
            "processed_pages": result.processed_pages,
            "total_chunks": len(chunks),
            "embedding_count": upload_stats['successful'],
            "failed_embeddings": upload_stats['failed'],
            "errors": result.errors + upload_stats.get('errors', []),
            "processing_time": result.processing_time,
            "namespace": namespace
        }
        
    except Exception as e:
        logger.error(f" Embedding generation failed: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e),
            "errors": [str(e)]
        }

class BookCreate(BaseModel):
    title: str
    subject: str
    class_level: int
    description: Optional[str] = ""
    
class ChapterCreate(BaseModel):
    book_id: str
    chapter_number: int
    title: str
    description: Optional[str] = ""

class BookResponse(BaseModel):
    id: str
    title: str
    subject: str
    class_level: int
    description: str
    pdf_filename: str
    pdf_url: str
    has_embeddings: bool
    embedding_count: int
    chapters: List[dict]
    created_at: str
    updated_at: str

@router.post("/upload")
async def upload_book(
    title: str = Form(...),
    subject: str = Form(...),
    class_level: int = Form(...),
    chapter_number: int = Form(1),
    description: str = Form(""),
    generate_embeddings: bool = Form(True),
    pdf_file: UploadFile = File(...)
):
    """
    Upload a new book chapter PDF, store metadata in MongoDB, and generate embeddings.
    
    This endpoint:
    1. Saves the PDF file
    2. Stores book metadata in MongoDB
    3. Processes the PDF (OCR, text extraction, image analysis)
    4. Generates embeddings for all content
    5. Uploads embeddings to Pinecone
    
    Namespace Organization:
    - All chapters of a subject are stored in one namespace
    - Mathematics: all class 6-12 math chapters
    - Physics: all class 6-12 physics chapters
    - Chemistry: all class 6-12 chemistry chapters
    - Metadata includes class_level and chapter_number for filtering
    
    Args:
        title: Book/Chapter title
        subject: Subject (Mathematics, Physics, Chemistry, etc.)
        class_level: Class level (6-12)
        chapter_number: Chapter number (1-50)
        description: Optional description
        generate_embeddings: Whether to generate and upload embeddings (default: True)
        pdf_file: The PDF file to upload
    """
    print(f"\n{'='*60}\n📤 UPLOAD REQUEST RECEIVED: {title}, {subject}, Class {class_level}\n{'='*60}\n")
    try:
        if not pdf_file.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
        clean_title = title.replace(' ', '_').replace('/', '_')[:50]
        safe_filename = f"{clean_title}.pdf"
        
        content = await pdf_file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        
        file_size = len(content)
        logger.info(f"📄 Received PDF: {safe_filename} ({file_size} bytes)")

        total_pages = 0
        try:
            import PyPDF2
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
            total_pages = len(pdf_reader.pages)
            logger.info(
                f"[Book Upload] title='{title}' class={class_level} subject='{subject}' "
                f"chapter={chapter_number} pages={total_pages}"
            )
        except Exception as page_err:
            logger.warning(f"Could not read page count for uploaded PDF '{safe_filename}': {page_err}")

        normalized_title = (title or "").strip().lower()
        existing_same_chapter = db.books.find({
            "class_level": class_level,
            "subject": {"$regex": f"^{subject}$", "$options": "i"},
            "chapter_number": chapter_number,
        })

        active_exact_duplicate = None
        for doc in existing_same_chapter:
            doc_title = (doc.get("title") or "").strip().lower()
            if doc_title == normalized_title and doc.get("processing_status") in {"queued", "processing", "completed"}:
                active_exact_duplicate = doc
                break

        if active_exact_duplicate:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"This chapter is already uploaded (Class {class_level}, {subject}, Chapter {chapter_number}). "
                    "Use regenerate embeddings or change chapter metadata."
                ),
            )
        
        cloud_service = get_cloudinary_service()
        
        if not cloud_service.is_available():
            raise HTTPException(status_code=500, detail="Cloud storage not configured. Please configure Cloudinary credentials.")
        
        logger.info(f"☁️ Uploading PDF to Cloudinary...")
        cloud_info = cloud_service.upload_pdf(
            file_content=content,
            filename=safe_filename,
            class_level=class_level,
            subject=subject,
            chapter_number=chapter_number
        )
        
        if not cloud_info:
            raise HTTPException(status_code=500, detail="Failed to upload PDF to cloud storage")
        
        cloud_url = cloud_info.get('url')
        cloud_public_id = cloud_info.get('public_id')
        logger.info(f"PDF uploaded to Cloudinary: {cloud_url}")
        
        namespace = subject.lower().replace(' ', '_')
        
        book_id = str(uuid.uuid4())
        
        book_doc = {
            "book_id": book_id,
            "title": title,
            "subject": subject,
            "class_level": class_level,
            "chapter_number": chapter_number,
            "description": description,
            "pdf_filename": safe_filename,
            "pdf_url": cloud_url,
            "cloudinary_url": cloud_url,
            "cloudinary_public_id": cloud_public_id,
            "has_embeddings": False,
            "embedding_count": 0,
            "embedding_namespace": namespace,
            "chapters": [],
            "total_pages": total_pages,
            "processing_status": "pending" if generate_embeddings else "uploaded",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = db.books.insert_one(book_doc)
        mongo_id = str(result.inserted_id)
        
        logger.info(f"Book record created: {title} (ID: {mongo_id}, book_id: {book_id})")
        
        embedding_result = None
        embedding_job = None
        if generate_embeddings:
            try:
                job_id = str(uuid.uuid4())
                job_metadata = {
                    "book_id": book_id,
                    "title": title,
                    "subject": subject,
                    "class_level": class_level,
                    "chapter_number": chapter_number,
                    "pdf_url": cloud_url,
                }

                with open(_job_pdf_path(job_id), "wb") as pdf_file_handle:
                    pdf_file_handle.write(content)

                _embedding_jobs_collection().insert_one({
                    "job_id": job_id,
                    "book_id": mongo_id,
                    "namespace": namespace,
                    "book_metadata": job_metadata,
                    "status": "queued",
                    "total_chunks": 0,
                    "processed_chunks": 0,
                    "successful_embeddings": 0,
                    "failed_embeddings": 0,
                    "total_pages": total_pages,
                    "processed_pages": 0,
                    "last_message": "Job queued",
                    "errors": [],
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                    "completed_at": None,
                })

                db.books.update_one(
                    {"_id": ObjectId(mongo_id)},
                    {
                        "$set": {
                            "processing_status": "queued",
                            "processing_errors": [],
                            "active_embedding_job_id": job_id,
                            "updated_at": datetime.utcnow()
                        }
                    }
                )

                _start_embedding_task(job_id)

                embedding_result = {
                    "success": True,
                    "mode": "background",
                    "job_id": job_id,
                    "status": "queued",
                }
                embedding_job = _serialize_job(_embedding_jobs_collection().find_one({"job_id": job_id}))
                
            except Exception as e:
                logger.error(f" Embedding generation failed: {e}")
                db.books.update_one(
                    {"_id": ObjectId(mongo_id)},
                    {
                        "$set": {
                            "processing_status": "failed",
                            "processing_errors": [str(e)],
                            "updated_at": datetime.utcnow()
                        }
                    }
                )
                embedding_result = {"success": False, "error": str(e)}
        
        return {
            "success": True,
            "message": f"Book '{title}' uploaded successfully to cloud storage",
            "book_id": mongo_id,
            "pdf_url": cloud_url,
            "cloudinary_url": cloud_url,
            "total_pages": total_pages,
            "embeddings": embedding_result,
            "embedding_job": embedding_job,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"\n{'='*60}\n UPLOAD ERROR:\n{error_trace}\n{'='*60}\n")
        logger.error(f" Book upload failed: {e}")
        logger.error(f"Traceback:\n{error_trace}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/embedding-jobs/{job_id}")
async def get_embedding_job(job_id: str):
    """Get status of a specific embedding job."""
    job = _embedding_jobs_collection().find_one({"job_id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Embedding job not found")
    return {"success": True, "job": _serialize_job(job)}


@router.get("/{book_id}/embedding-job")
async def get_latest_embedding_job(book_id: str):
    """Get latest embedding job for a book."""
    job = _embedding_jobs_collection().find_one(
        {"book_id": book_id},
        sort=[("created_at", -1)],
    )
    if not job:
        return {"success": True, "job": None}
    return {"success": True, "job": _serialize_job(job)}


@router.post("/embedding-jobs/{job_id}/pause")
async def pause_embedding_job(job_id: str):
    """Pause an embedding job. Processing pauses safely after current batch."""
    job = _embedding_jobs_collection().find_one({"job_id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Embedding job not found")

    if job.get("status") in {"completed", "cancelled", "failed"}:
        raise HTTPException(status_code=400, detail=f"Cannot pause job in status '{job.get('status')}'")

    _update_job(job_id, {"status": "paused", "last_message": "Pause requested by admin"})
    db.books.update_one(
        {"_id": ObjectId(job["book_id"])},
        {"$set": {"processing_status": "paused", "updated_at": datetime.utcnow()}},
    )

    return {
        "success": True,
        "message": "Pause requested. Job will pause after current batch.",
        "job": _serialize_job(_embedding_jobs_collection().find_one({"job_id": job_id})),
    }


@router.post("/embedding-jobs/{job_id}/resume")
async def resume_embedding_job(job_id: str):
    """Resume an embedding job from persisted checkpoint."""
    job = _embedding_jobs_collection().find_one({"job_id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Embedding job not found")

    if job.get("status") not in {"paused", "failed", "queued"}:
        raise HTTPException(status_code=400, detail=f"Cannot resume job in status '{job.get('status')}'")

    _update_job(job_id, {"status": "queued", "last_message": "Resume requested by admin"})
    db.books.update_one(
        {"_id": ObjectId(job["book_id"])},
        {"$set": {"processing_status": "queued", "updated_at": datetime.utcnow()}},
    )
    _start_embedding_task(job_id)

    return {
        "success": True,
        "message": "Embedding job resumed",
        "job": _serialize_job(_embedding_jobs_collection().find_one({"job_id": job_id})),
    }


@router.post("/embedding-jobs/{job_id}/cancel")
async def cancel_embedding_job(job_id: str):
    """Cancel an embedding job."""
    job = _embedding_jobs_collection().find_one({"job_id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Embedding job not found")

    if job.get("status") in {"completed", "cancelled"}:
        return {
            "success": True,
            "message": "Job already finished",
            "job": _serialize_job(job),
        }

    _update_job(job_id, {"status": "cancelled", "last_message": "Cancel requested by admin"})
    db.books.update_one(
        {"_id": ObjectId(job["book_id"])},
        {"$set": {"processing_status": "cancelled", "updated_at": datetime.utcnow()}},
    )

    return {
        "success": True,
        "message": "Cancel requested. Job will stop safely after current batch.",
        "job": _serialize_job(_embedding_jobs_collection().find_one({"job_id": job_id})),
    }

@router.post("/{book_id}/regenerate-embeddings")
async def regenerate_embeddings(book_id: str):
    """
    Regenerate embeddings for an existing book.
    Downloads PDF from Cloudinary and reprocesses it.
    """
    try:
        import tempfile
        import requests
        
        book = db.books.find_one({"_id": ObjectId(book_id)})
        if not book:
            raise HTTPException(status_code=404, detail="Book not found")
        
        pdf_url = book.get("cloudinary_url") or book.get("pdf_url")
        if not pdf_url or not pdf_url.startswith("http"):
            raise HTTPException(status_code=404, detail="PDF not found in cloud storage")
        
        db.books.update_one(
            {"_id": ObjectId(book_id)},
            {"$set": {"processing_status": "processing", "updated_at": datetime.utcnow()}}
        )
        
        logger.info(f"⬇️ Downloading PDF from: {pdf_url}")
        response = requests.get(pdf_url, timeout=60)
        if response.status_code != 200:
            raise HTTPException(status_code=404, detail="Failed to download PDF from cloud storage")
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            temp_file.write(response.content)
            temp_pdf_path = temp_file.name
        
        try:
            namespace = book.get("embedding_namespace", book['subject'].lower().replace(' ', '_'))
            
            result = await process_book_embeddings(
                book_id=book_id,
                pdf_path=temp_pdf_path,
                book_metadata={
                    "book_id": book_id,
                    "title": book["title"],
                    "subject": book["subject"],
                    "class_level": book["class_level"],
                    "chapter_number": book.get("chapter_number", 1),
                    "pdf_url": pdf_url
                },
                namespace=namespace
            )
        finally:
            if os.path.exists(temp_pdf_path):
                os.remove(temp_pdf_path)
        
        db.books.update_one(
            {"_id": ObjectId(book_id)},
            {
                "$set": {
                    "has_embeddings": result.get("success", False),
                    "embedding_count": result.get("embedding_count", 0),
                    "total_pages": result.get("total_pages", 0),
                    "total_chunks": result.get("total_chunks", 0),
                    "processing_status": "completed" if result.get("success") else "failed",
                    "processing_errors": result.get("errors", []),
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        return {
            "success": result.get("success", False),
            "message": f"Embeddings {'regenerated' if result.get('success') else 'failed to regenerate'}",
            "details": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Regenerate embeddings failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{book_id}/chapters")
async def add_chapter(book_id: str, chapter: ChapterCreate):
    """Add a chapter to a book."""
    try:
        chapter_doc = {
            "chapter_number": chapter.chapter_number,
            "title": chapter.title,
            "description": chapter.description,
            "page_start": 1,
            "page_end": None
        }
        
        result = db.books.update_one(
            {"_id": ObjectId(book_id)},
            {
                "$push": {"chapters": chapter_doc},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Book not found")
        
        return {"success": True, "message": "Chapter added successfully"}
        
    except Exception as e:
        logger.error(f" Add chapter failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin/list")
async def list_all_books():
    """List all books for admin view."""
    try:
        books = list(db.books.find().sort("created_at", -1))
        
        result = []
        for book in books:
            result.append({
                "id": str(book["_id"]),
                "title": book.get("title", "Untitled"),
                "subject": book.get("subject", "Unknown"),
                "class_level": book.get("class_level", 6),
                "description": book.get("description", ""),
                "pdf_filename": book.get("pdf_filename", ""),
                "pdf_url": book.get("pdf_url", ""),
                "has_embeddings": book.get("has_embeddings", False),
                "embedding_count": book.get("embedding_count", 0),
                "chapters": book.get("chapters", []),
                "created_at": book["created_at"].isoformat() if book.get("created_at") else "",
                "updated_at": book["updated_at"].isoformat() if book.get("updated_at") else ""
            })
        
        return {"books": result, "total": len(result)}
        
    except Exception as e:
        logger.error(f" List books failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{book_id}")
async def delete_book(book_id: str, delete_embeddings: bool = Query(default=True)):
    """
    Delete a book from MongoDB, Cloudinary, and optionally from Pinecone.
    """
    try:
        book = db.books.find_one({"_id": ObjectId(book_id)})
        if not book:
            raise HTTPException(status_code=404, detail="Book not found")
        
        cloudinary_public_id = book.get("cloudinary_public_id")
        if cloudinary_public_id:
            try:
                cloud_service = get_cloudinary_service()
                if cloud_service.is_available():
                    if cloud_service.delete_file(cloudinary_public_id):
                        logger.info(f"Deleted PDF from Cloudinary: {cloudinary_public_id}")
                    else:
                        logger.warning(f" Could not delete PDF from Cloudinary: {cloudinary_public_id}")
            except Exception as cloud_error:
                logger.warning(f" Cloudinary deletion failed: {cloud_error}")
        
        if delete_embeddings and book.get("has_embeddings"):
            try:
                from pinecone import Pinecone
                pc = Pinecone(api_key=settings.PINECONE_API_KEY)
                index = pc.Index(host=settings.PINECONE_HOST)
                
                namespace = book.get("embedding_namespace", "default")
                
                logger.info(f"Embeddings in namespace '{namespace}' should be deleted for book_id: {book_id}")
                
                try:
                    index.delete(
                        filter={"book_id": book_id},
                        namespace=namespace
                    )
                    logger.info(f"Deleted embeddings for book {book_id} from Pinecone")
                except Exception as pe:
                    logger.warning(f"Could not delete embeddings: {pe}")
                
            except Exception as e:
                logger.warning(f"Pinecone cleanup failed: {e}")
        
        db.books.delete_one({"_id": ObjectId(book_id)})
        
        logger.info(f"Book deleted: {book['title']} (ID: {book_id})")
        
        return {
            "success": True,
            "message": f"Book '{book['title']}' deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Delete book failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{book_id}/generate-embeddings")
async def generate_embeddings(book_id: str):
    """
    Trigger embedding generation for a book.
    This is a placeholder - actual embedding generation should be done via script.
    """
    try:
        book = db.books.find_one({"_id": ObjectId(book_id)})
        if not book:
            raise HTTPException(status_code=404, detail="Book not found")
        
        return {
            "success": True,
            "message": "Embedding generation triggered",
            "instructions": f"""
To generate embeddings, run the following script:
python backend/scripts/upload_pdfs_to_pinecone.py --book-id {book_id}

Or use the existing multimodal uploader for math/physics content.
            """,
            "book_id": book_id,
            "pdf_path": os.path.join(BOOKS_UPLOAD_DIR, book["pdf_filename"])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Generate embeddings failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{book_id}/embeddings-status")
async def update_embedding_status(
    book_id: str,
    has_embeddings: bool = Query(...),
    embedding_count: int = Query(default=0)
):
    """Update the embedding status of a book (called after embedding generation)."""
    try:
        result = db.books.update_one(
            {"_id": ObjectId(book_id)},
            {
                "$set": {
                    "has_embeddings": has_embeddings,
                    "embedding_count": embedding_count,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Book not found")
        
        return {"success": True, "message": "Embedding status updated"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Update embedding status failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/student/subjects")
async def get_available_subjects(
    class_level: int = Query(...),
    student_id: Optional[str] = Query(None, description="Student ID for progress tracking")
):
    """
    Get list of subjects that have books (chapters) available for a class level.
    Returns subjects with their total chapter count and real progress from MongoDB.
    """
    try:
        pipeline = [
            {"$match": {"class_level": class_level}},
            {"$group": {
                "_id": {"subject": "$subject", "title": "$title"},
                "doc": {"$first": "$$ROOT"}
            }},
            {"$group": {
                "_id": "$_id.subject",
                "total_chapters": {"$sum": 1},
                "chapters": {"$push": {
                    "id": {"$toString": "$doc._id"},
                    "title": "$doc.title"
                }}
            }},
            {"$project": {
                "name": "$_id",
                "total_chapters": 1,
                "chapters": 1,
                "_id": 0
            }},
            {"$sort": {"name": 1}}
        ]
        
        subjects_from_db = list(db.books.aggregate(pipeline))
        
        student_progress = {}
        if student_id:
            try:
                questions_col = db.client["ncert_ai"]["top_questions"]
                progress_pipeline = [
                    {"$match": {"user_id": student_id, "class_level": class_level}},
                    {"$group": {
                        "_id": "$subject",
                        "questions_asked": {"$sum": 1}
                    }}
                ]
                progress_data = list(questions_col.aggregate(progress_pipeline))
                for p in progress_data:
                    student_progress[p["_id"]] = p["questions_asked"]
                
                tests_col = db.client["ncert_ai"]["test_submissions"]
                test_pipeline = [
                    {"$match": {"student_id": student_id}},
                    {"$group": {
                        "_id": "$subject",
                        "tests_taken": {"$sum": 1}
                    }}
                ]
                test_data = list(tests_col.aggregate(test_pipeline))
                for t in test_data:
                    subj = t["_id"]
                    if subj in student_progress:
                        student_progress[subj] += t["tests_taken"] * 5
                    else:
                        student_progress[subj] = t["tests_taken"] * 5
                        
            except Exception as e:
                logger.warning(f"Could not fetch student progress: {e}")
        
        subject_info = []
        for s in subjects_from_db:
            subject_name = s["name"]
            total = s["total_chapters"]
            questions = student_progress.get(subject_name, 0)
            chapters_done = min(questions // 5, total) if total > 0 else 0
            
            subject_info.append({
                "name": subject_name,
                "namespace": subject_name.lower().replace(" ", "_"),
                "total_chapters": total,
                "chapters": s.get("chapters", []),
                "has_ai_support": True,
                "chapters_completed": chapters_done,
                "questions_asked": questions
            })
        
        logger.info(f"Found {len(subject_info)} subjects with {sum(s['total_chapters'] for s in subject_info)} total chapters for Class {class_level}")
        
        return {"subjects": subject_info, "class_level": class_level}
        
    except Exception as e:
        logger.error(f" Get subjects failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/student/books")
async def get_books_for_student(
    class_level: int = Query(...),
    subject: str = Query(...)
):
    """Get books/lessons for a student based on class and subject."""
    try:
        books = list(db.books.find({
            "class_level": class_level,
            "subject": subject
        }).sort("created_at", 1))
        
        result = []
        for book in books:
            result.append({
                "id": str(book["_id"]),
                "title": book["title"],
                "description": book.get("description", ""),
                "subject": book["subject"],
                "classLevel": book["class_level"],
                "pdfUrl": book["pdf_url"],
                "has_ai_support": book.get("has_embeddings", False),
                "chapters": book.get("chapters", [])
            })
        
        return {"books": result, "total": len(result)}
        
    except Exception as e:
        logger.error(f" Get student books failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/flashcards")
async def generate_flashcards(
    subject: str = Query(..., description="Subject name"),
    class_level: int = Query(..., description="Class level"),
    count: int = Query(10, description="Number of flashcards to generate", ge=5, le=20)
):
    """
    Generate flashcards from textbook content for revision.
    Uses AI to create question-answer pairs from chapter content.
    """
    try:
        from app.services.flashcard_service import flashcard_service
        
        logger.info(f"🎴 Generating {count} flashcards for {subject} Class {class_level}")
        
        flashcards = flashcard_service.generate_flashcards(
            subject=subject,
            class_level=class_level,
            count=count
        )
        
        if not flashcards:
            return {
                "flashcards": [],
                "message": "No content found to generate flashcards. Please ensure textbook is uploaded.",
                "count": 0
            }
        
        return {
            "flashcards": flashcards,
            "subject": subject,
            "class_level": class_level,
            "count": len(flashcards)
        }
        
    except Exception as e:
        logger.error(f" Flashcard generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/notes/generate")
async def generate_smart_notes(
    subject: str = Query(..., description="Subject name"),
    class_level: int = Query(..., description="Class level"),
    chapter: Optional[str] = Query(None, description="Specific chapter title")
):
    """
    Generate AI-powered study notes from textbook content.
    Returns summary, key points, important terms, and study tips.
    """
    try:
        from app.services.smart_notes_service import smart_notes_service
        
        logger.info(f"📝 Generating smart notes for {subject} Class {class_level}")
        
        notes = smart_notes_service.generate_chapter_summary(
            subject=subject,
            class_level=class_level,
            chapter_title=chapter
        )
        
        return notes
        
    except Exception as e:
        logger.error(f" Smart notes generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/notes/save")
async def save_smart_notes(
    user_id: str = Query(...),
    subject: str = Query(...),
    class_level: int = Query(...),
    title: str = Query(...),
    content: dict = None
):
    """Save generated notes for a user."""
    try:
        from app.services.smart_notes_service import smart_notes_service
        
        note_id = smart_notes_service.save_notes(
            user_id=user_id,
            subject=subject,
            class_level=class_level,
            title=title,
            content=content or {}
        )
        
        if note_id:
            return {"success": True, "note_id": note_id}
        else:
            raise HTTPException(status_code=500, detail="Failed to save notes")
            
    except Exception as e:
        logger.error(f" Save notes failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/notes/{user_id}")
async def get_user_notes(
    user_id: str,
    subject: Optional[str] = None,
    limit: int = 20
):
    """Get user's saved smart notes."""
    try:
        from app.services.smart_notes_service import smart_notes_service
        
        notes = smart_notes_service.get_user_notes(
            user_id=user_id,
            subject=subject,
            limit=limit
        )
        
        return {"notes": notes, "total": len(notes)}
        
    except Exception as e:
        logger.error(f" Get notes failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/student/lessons")
async def get_lessons_for_student(
    class_level: int = Query(...),
    subject: str = Query(...)
):
    """
    Get lessons/chapters for a student from Pinecone metadata.
    Returns in a format compatible with the existing BookToBot component.
    """
    try:
        subject_namespace_map = {
            "Maths": "maths",
            "Mathematics": "maths",
            "Physics": "physics",
            "Chemistry": "chemistry",
            "Biology": "biology",
            "Social Science": "social_science",
            "English": "english",
            "Hindi": "hindi"
        }
        
        subject_normalized = subject
        if subject.lower() in ["mathematics", "math"]:
            subject_normalized = "Maths"
        
        namespace = subject_namespace_map.get(subject, subject_namespace_map.get(subject_normalized, subject.lower().replace(' ', '_')))
        logger.info(
            f"Getting lessons for {subject} (normalized: {subject_normalized}, namespace: {namespace}), "
            f"Class {class_level}"
        )
        
        mongo_books = list(db.books.find({
            "class_level": class_level,
            "subject": {"$regex": f"^(maths|mathematics)$" if subject_normalized == "Maths" else f"^{subject_normalized}$", "$options": "i"}
        }).sort("chapter_number", 1))

        logger.info(f"[Lessons Source] Found {len(mongo_books)} uploaded chapters in MongoDB")

        def _to_chapter_number(value: Optional[int], default: int = 1) -> int:
            try:
                chapter_num = int(value)
                return chapter_num if chapter_num > 0 else default
            except Exception:
                return default

        def _status_rank(status: str) -> int:
            status_val = (status or "").strip().lower()
            if status_val in {"completed", "ready", "success", "embedded"}:
                return 3
            if status_val in {"processing", "queued", "running", "embedding"}:
                return 2
            if status_val in {"uploaded", "pending"}:
                return 1
            return 0

        def _record_rank(record: Dict) -> tuple:
            has_embeddings = 1 if bool(record.get("has_embeddings", False)) else 0
            status = _status_rank(record.get("processing_status", "uploaded"))
            embedding_count = int(record.get("embedding_count", 0) or 0)
            updated_at = record.get("updated_at") or record.get("created_at") or datetime.min
            return (has_embeddings, status, embedding_count, updated_at)

        chapter_counts = {}
        for b in mongo_books:
            ch = _to_chapter_number(b.get("chapter_number"), 0)
            chapter_counts[ch] = chapter_counts.get(ch, 0) + 1
        duplicates = [ch for ch, cnt in chapter_counts.items() if cnt > 1 and ch > 0]
        if duplicates:
            logger.warning(f"Duplicate chapter numbers detected for {subject} class {class_level}: {duplicates}")

        # Keep only one record per chapter. For duplicates, prefer records that
        # are embedded/completed and more recently updated.
        chapter_to_record: Dict[int, Dict] = {}
        for book_record in mongo_books:
            chapter_num = _to_chapter_number(book_record.get("chapter_number"), 1)
            selected = chapter_to_record.get(chapter_num)
            if selected is None or _record_rank(book_record) > _record_rank(selected):
                chapter_to_record[chapter_num] = book_record

        deduped_books = [chapter_to_record[ch] for ch in sorted(chapter_to_record.keys())]
        if len(deduped_books) != len(mongo_books):
            logger.info(
                f"[Lessons Source] Deduplicated chapter records: {len(mongo_books)} -> {len(deduped_books)}"
            )
        
        lessons = []

        for book_record in deduped_books:
            chapter_num = _to_chapter_number(book_record.get("chapter_number"), 1)
            vector_count = int(book_record.get("embedding_count", 0))
            has_ai_support = bool(book_record.get("has_embeddings", False))

            lessons.append({
                "id": f"{namespace}_{class_level}_{chapter_num}_{str(book_record['_id'])}",
                "number": chapter_num,
                "title": book_record.get("title") or f"Chapter {chapter_num}",
                "description": f"{vector_count} AI-indexed content blocks" if has_ai_support else "Embeddings pending",
                "pdfUrl": book_record.get("pdf_url", ""),
                "subject": subject,
                "classLevel": class_level,
                "has_ai_support": has_ai_support,
                "chapter_number": chapter_num,
                "book_id": str(book_record["_id"]),
                "embedding_namespace": book_record.get("embedding_namespace", namespace),
                "processing_status": book_record.get("processing_status", "uploaded"),
            })
        
        logger.info(
            f"Found {len(lessons)} chapters for {subject} Class {class_level} "
            f"(deduplicated by chapter from uploaded records)"
        )
        
        return {
            "lessons": lessons,
            "total": len(lessons),
            "subject": subject,
            "class_level": class_level
        }
        
    except Exception as e:
        logger.error(f" Get lessons failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pdf/{file_path:path}")
async def serve_pdf(file_path: str):
    """
    Serve a book PDF file from organized folder structure.
    Path format: class_XX/subject/chapter_XX/filename.pdf
    
    Enhanced for PDF.js:
    - Adds Accept-Ranges header for partial content support
    - Adds CORS headers for cross-origin access
    - Handles Unicode filenames properly
    """
    from urllib.parse import unquote, quote
    from starlette.responses import FileResponse as StarletteFileResponse
    
    try:
        decoded_path = unquote(file_path)
        
        full_path = os.path.join(BOOKS_UPLOAD_DIR, decoded_path)
        
        real_books_dir = os.path.realpath(BOOKS_UPLOAD_DIR)
        real_file_path = os.path.realpath(full_path)
        
        if not real_file_path.startswith(real_books_dir):
            raise HTTPException(status_code=403, detail="Access denied")
        
        if not os.path.exists(full_path):
            logger.error(f"PDF not found: {full_path}")
            raise HTTPException(status_code=404, detail=f"PDF not found: {decoded_path}")
        
        filename = os.path.basename(decoded_path)
        file_size = os.path.getsize(full_path)
        
        logger.info(f"📄 Serving PDF: {decoded_path} ({file_size} bytes)")
        
        encoded_filename = quote(filename, safe='')
        
        content_disposition = f"inline; filename=\"document.pdf\"; filename*=UTF-8''{encoded_filename}"
        
        response = StarletteFileResponse(
            full_path,
            media_type="application/pdf",
            headers={
                "Content-Disposition": content_disposition,
                "Accept-Ranges": "bytes",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
                "Cache-Control": "public, max-age=86400"
            }
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Serve PDF failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pdf-page/{file_path:path}")
async def render_pdf_page(file_path: str, page: int = 1, scale: float = 1.5):
    """
    Render a specific PDF page as a PNG image.
    
    Uses PyMuPDF (fitz) to render the page, which handles all image formats
    including JPEG2000 that react-pdf cannot decode.
    
    Args:
        file_path: Path to the PDF file (same format as serve_pdf)
        page: Page number (1-indexed)
        scale: Rendering scale/zoom factor (default 1.5 for good quality)
    
    Returns:
        PNG image of the rendered page
    """
    import fitz
    from fastapi.responses import Response
    from urllib.parse import unquote
    import io
    
    try:
        decoded_path = unquote(file_path)
        
        full_path = os.path.join(BOOKS_UPLOAD_DIR, decoded_path)
        
        real_books_dir = os.path.realpath(BOOKS_UPLOAD_DIR)
        real_file_path = os.path.realpath(full_path)
        
        if not real_file_path.startswith(real_books_dir):
            raise HTTPException(status_code=403, detail="Access denied")
        
        if not os.path.exists(full_path):
            logger.error(f"PDF not found for rendering: {full_path}")
            raise HTTPException(status_code=404, detail=f"PDF not found: {decoded_path}")
        
        doc = fitz.open(full_path)
        
        if page < 1 or page > len(doc):
            doc.close()
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid page number. PDF has {len(doc)} pages."
            )
        
        pdf_page = doc[page - 1]
        
        mat = fitz.Matrix(scale, scale)
        pix = pdf_page.get_pixmap(matrix=mat, alpha=False)
        
        img_bytes = pix.tobytes("png")
        
        num_pages = len(doc)
        doc.close()
        
        logger.info(f"📄 Rendered PDF page {page}/{num_pages}: {decoded_path}")
        
        return Response(
            content=img_bytes,
            media_type="image/png",
            headers={
                "Cache-Control": "public, max-age=3600",
                "Access-Control-Allow-Origin": "*",
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Render PDF page failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pdf-info/{file_path:path}")
async def get_pdf_info(file_path: str):
    """
    Get PDF metadata including total page count.
    
    Args:
        file_path: Path to the PDF file
    
    Returns:
        JSON with page count and other metadata
    """
    import fitz
    from urllib.parse import unquote
    
    try:
        decoded_path = unquote(file_path)
        
        full_path = os.path.join(BOOKS_UPLOAD_DIR, decoded_path)
        
        real_books_dir = os.path.realpath(BOOKS_UPLOAD_DIR)
        real_file_path = os.path.realpath(full_path)
        
        if not real_file_path.startswith(real_books_dir):
            raise HTTPException(status_code=403, detail="Access denied")
        
        if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail=f"PDF not found: {decoded_path}")
        
        doc = fitz.open(full_path)
        
        info = {
            "numPages": len(doc),
            "title": doc.metadata.get("title", "") or os.path.basename(decoded_path),
            "author": doc.metadata.get("author", ""),
            "subject": doc.metadata.get("subject", ""),
        }
        
        doc.close()
        
        return info
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Get PDF info failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/render/{book_id}/info")
async def get_book_pdf_info(book_id: str):
    """
    Get PDF info (page count) for a book by ID.
    Downloads from Cloudinary if needed and caches locally.
    """
    import fitz
    from app.services.pdf_cache import get_cached_pdf
    
    try:
        book = db.books.find_one({"_id": ObjectId(book_id)})
        if not book:
            raise HTTPException(status_code=404, detail="Book not found")
        
        pdf_url = book.get("cloudinary_url") or book.get("pdf_url")
        if not pdf_url:
            raise HTTPException(status_code=404, detail="PDF URL not found")
        
        pdf_path = get_cached_pdf(pdf_url)
        if not pdf_path:
            raise HTTPException(status_code=500, detail="Failed to download PDF")
        
        doc = fitz.open(pdf_path)
        info = {
            "numPages": len(doc),
            "title": book.get("title", ""),
            "subject": book.get("subject", ""),
            "chapter_number": book.get("chapter_number", 1),
            "class_level": book.get("class_level", 11)
        }
        doc.close()
        
        return info
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Get book PDF info failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/render/{book_id}/page/{page_number}")
async def render_book_pdf_page(book_id: str, page_number: int, scale: float = 1.5):
    """
    Render a PDF page as PNG image for a book by ID.
    Downloads from Cloudinary if needed and caches locally.
    """
    import fitz
    from fastapi.responses import Response
    from app.services.pdf_cache import get_cached_pdf
    
    try:
        book = db.books.find_one({"_id": ObjectId(book_id)})
        if not book:
            raise HTTPException(status_code=404, detail="Book not found")
        
        pdf_url = book.get("cloudinary_url") or book.get("pdf_url")
        if not pdf_url:
            raise HTTPException(status_code=404, detail="PDF URL not found")
        
        pdf_path = get_cached_pdf(pdf_url)
        if not pdf_path:
            raise HTTPException(status_code=500, detail="Failed to download PDF")
        
        doc = fitz.open(pdf_path)
        
        if page_number < 1 or page_number > len(doc):
            doc.close()
            raise HTTPException(
                status_code=400,
                detail=f"Invalid page number. PDF has {len(doc)} pages."
            )
        
        pdf_page = doc[page_number - 1]
        mat = fitz.Matrix(scale, scale)
        pix = pdf_page.get_pixmap(matrix=mat, alpha=False)
        img_bytes = pix.tobytes("png")
        
        num_pages = len(doc)
        doc.close()
        
        logger.info(f"📄 Rendered page {page_number}/{num_pages} for book {book_id}")
        
        return Response(
            content=img_bytes,
            media_type="image/png",
            headers={
                "Cache-Control": "public, max-age=3600",
                "Access-Control-Allow-Origin": "*",
                "X-Total-Pages": str(num_pages)
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Render book PDF page failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/admin/sync-existing")
async def sync_existing_books():
    """
    Sync existing books from frontend lessons.js to MongoDB.
    This preserves the current math books that are already in Pinecone.
    """
    try:
        existing_count = db.books.count_documents({})
        if existing_count > 0:
            return {
                "success": True,
                "message": f"Already have {existing_count} books in database",
                "synced": 0
            }
        
        math_lessons = [
            {"number": 1, "title": "Patterns in Mathematics", "description": "Exploring patterns in numbers, shapes, and their relationships.", "pdfUrl": "/fegp101.pdf"},
            {"number": 2, "title": "Lines and Angles", "description": "Understanding different types of lines, angles, and their properties.", "pdfUrl": "/fegp102.pdf"},
            {"number": 3, "title": "Number Play", "description": "Playing with numbers, divisibility rules, and number patterns.", "pdfUrl": "/fegp103.pdf"},
            {"number": 4, "title": "Data Handling and Presentation", "description": "Collecting, organizing, and representing data using graphs and charts.", "pdfUrl": "/fegp104.pdf"},
            {"number": 5, "title": "Prime Time", "description": "Understanding prime numbers, factors, and multiples.", "pdfUrl": "/fegp105.pdf"},
            {"number": 6, "title": "Perimeter and Area", "description": "Calculating perimeter and area of various shapes.", "pdfUrl": "/fegp106.pdf"},
            {"number": 7, "title": "Fractions", "description": "Understanding fractions, equivalent fractions, and operations.", "pdfUrl": "/fegp107.pdf"},
            {"number": 8, "title": "Playing with Constructions", "description": "Geometric constructions using compass and ruler.", "pdfUrl": "/fegp108.pdf"},
            {"number": 9, "title": "Symmetry", "description": "Exploring symmetry in shapes and patterns.", "pdfUrl": "/fegp109.pdf"},
            {"number": 10, "title": "The Other Side of Zero", "description": "Introduction to negative numbers and integers.", "pdfUrl": "/fegp110.pdf"},
        ]
        
        math_book = {
            "title": "Mathematics - Class 6",
            "subject": "Mathematics",
            "class_level": 6,
            "description": "NCERT Mathematics textbook for Class 6",
            "pdf_filename": "fegp101.pdf",
            "pdf_url": "/fegp101.pdf",
            "has_embeddings": True,
            "embedding_count": 2193,
            "embedding_namespace": "maths",
            "chapters": [
                {
                    "chapter_number": lesson["number"],
                    "title": lesson["title"],
                    "description": lesson["description"],
                    "pdf_url": lesson["pdfUrl"]
                }
                for lesson in math_lessons
            ],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        db.books.insert_one(math_book)
        
        for lesson in math_lessons:
            chapter_book = {
                "title": lesson["title"],
                "subject": "Mathematics",
                "class_level": 6,
                "description": lesson["description"],
                "pdf_filename": lesson["pdfUrl"].replace("/", ""),
                "pdf_url": lesson["pdfUrl"],
                "has_embeddings": True,
                "embedding_count": 0,
                "embedding_namespace": "maths",
                "chapter_number": lesson["number"],
                "is_chapter": True,
                "chapters": [],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            db.books.insert_one(chapter_book)
        
        logger.info("Synced existing Math lessons to MongoDB")
        
        return {
            "success": True,
            "message": "Synced existing books to MongoDB",
            "synced": len(math_lessons) + 1
        }
        
    except Exception as e:
        logger.error(f" Sync existing books failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin/pinecone-stats")
async def get_pinecone_stats():
    """Get Pinecone index statistics."""
    try:
        from pinecone import Pinecone
        pc = Pinecone(api_key=settings.PINECONE_API_KEY)
        index = pc.Index(host=settings.PINECONE_HOST)
        
        stats = index.describe_index_stats()
        
        namespaces_dict = {}
        raw_namespaces = stats.get("namespaces", {})
        
        if isinstance(raw_namespaces, dict):
            for ns_name, ns_data in raw_namespaces.items():
                if hasattr(ns_data, 'vector_count'):
                    namespaces_dict[ns_name] = {
                        "vector_count": ns_data.vector_count
                    }
                elif isinstance(ns_data, dict):
                    namespaces_dict[ns_name] = {
                        "vector_count": ns_data.get("vector_count", 0)
                    }
                else:
                    try:
                        namespaces_dict[ns_name] = {"vector_count": int(ns_data)}
                    except:
                        namespaces_dict[ns_name] = {"vector_count": 0}
        
        return {
            "success": True,
            "stats": {
                "total_vector_count": int(stats.get("total_vector_count", 0)),
                "dimension": int(stats.get("dimension", 0)),
                "namespaces": namespaces_dict
            }
        }
        
    except Exception as e:
        logger.error(f" Get Pinecone stats failed: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e),
            "stats": {
                "total_vector_count": 0,
                "dimension": 0,
                "namespaces": {}
            }
        }

@router.post("/admin/fix-missing-fields")
async def fix_missing_fields():
    """
    Fix any books in the database that are missing required fields.
    This is a migration endpoint to handle legacy data.
    """
    try:
        all_books = list(db.books.find())
        fixed_count = 0
        
        for book in all_books:
            needs_update = False
            update_data = {}
            
            if "class_level" not in book:
                update_data["class_level"] = 6
                needs_update = True
            
            if "title" not in book or not book.get("title"):
                update_data["title"] = f"Untitled Book ({book['_id']})"
                needs_update = True
            
            if "subject" not in book or not book.get("subject"):
                update_data["subject"] = "Unknown"
                needs_update = True
            
            if "pdf_filename" not in book or not book.get("pdf_filename"):
                update_data["pdf_filename"] = ""
                needs_update = True
            
            if "pdf_url" not in book or not book.get("pdf_url"):
                update_data["pdf_url"] = ""
                needs_update = True
            
            if needs_update:
                db.books.update_one(
                    {"_id": book["_id"]},
                    {"$set": update_data}
                )
                fixed_count += 1
                logger.info(f"Fixed book {book['_id']}: {update_data}")
        
        return {
            "success": True,
            "message": f"Fixed {fixed_count} books with missing fields",
            "total_books": len(all_books),
            "fixed_count": fixed_count
        }
        
    except Exception as e:
        logger.error(f" Fix missing fields failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin/hierarchical-structure")
async def get_hierarchical_structure():
    """
    Get the hierarchical structure of books from Pinecone metadata.
    Returns: { subjects: { [subject]: { classes: { [class]: { chapters: [chapter_numbers] } } } } }
    
    This queries actual Pinecone data to show what's really stored.
    """
    try:
        from pinecone import Pinecone
        
        pc = Pinecone(api_key=settings.PINECONE_API_KEY)
        index = pc.Index(
            name=settings.PINECONE_MASTER_INDEX,
            host=settings.PINECONE_MASTER_HOST
        )
        
        stats = index.describe_index_stats()
        namespaces = stats.get("namespaces", {})
        
        structure = {}
        
        for namespace_name, namespace_info in namespaces.items():
            if namespace_info.get("vector_count", 0) == 0:
                continue
            
            query_response = index.query(
                namespace=namespace_name,
                vector=[0.0] * 768,
                top_k=1000,
                include_metadata=True
            )
            
            classes = {}
            for match in query_response.get("matches", []):
                metadata = match.get("metadata", {})
                
                class_level = metadata.get("class_level") or metadata.get("class")
                chapter_number = metadata.get("chapter_number") or metadata.get("chapter")
                
                if class_level:
                    if isinstance(class_level, str):
                        import re
                        match_num = re.search(r'(\d+)', str(class_level))
                        if match_num:
                            class_level = int(match_num.group(1))
                        else:
                            continue
                    class_level = int(class_level)
                    
                    class_key = str(class_level)
                    if class_key not in classes:
                        classes[class_key] = {
                            "class_level": class_level,
                            "chapters": set(),
                            "vector_count": 0
                        }
                    
                    if chapter_number:
                        if isinstance(chapter_number, str):
                            import re
                            match_ch = re.search(r'(\d+)', str(chapter_number))
                            if match_ch:
                                chapter_number = int(match_ch.group(1))
                        if isinstance(chapter_number, (int, float)):
                            classes[class_key]["chapters"].add(int(chapter_number))
                    
                    classes[class_key]["vector_count"] += 1
            
            for class_key in classes:
                classes[class_key]["chapters"] = sorted(list(classes[class_key]["chapters"]))
            
            if classes:
                structure[namespace_name] = {
                    "total_vectors": namespace_info.get("vector_count", 0),
                    "classes": classes
                }
        
        return {
            "success": True,
            "structure": structure,
            "total_namespaces": len(structure)
        }
        
    except Exception as e:
        logger.error(f" Get hierarchical structure failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/admin/delete-subject/{subject}")
async def delete_subject(subject: str, confirmation: str = Query(...)):
    """
    Delete ALL vectors for a subject (entire namespace).
    Requires typing the subject name as confirmation.
    
    This deletes:
    - All vectors in Pinecone namespace for this subject
    - All book records in MongoDB for this subject
    """
    try:
        if confirmation.lower() != subject.lower():
            raise HTTPException(
                status_code=400, 
                detail=f"Confirmation '{confirmation}' does not match subject '{subject}'"
            )
        
        from pinecone import Pinecone
        
        pc = Pinecone(api_key=settings.PINECONE_API_KEY)
        index = pc.Index(
            name=settings.PINECONE_MASTER_INDEX,
            host=settings.PINECONE_MASTER_HOST
        )
        
        namespace = subject.lower().replace(' ', '_')
        
        stats_before = index.describe_index_stats()
        namespace_info = stats_before.get("namespaces", {}).get(namespace, {})
        vectors_to_delete = namespace_info.get("vector_count", 0)
        
        if vectors_to_delete == 0:
            raise HTTPException(status_code=404, detail=f"No vectors found in namespace '{namespace}'")
        
        logger.info(f" Deleting namespace '{namespace}' with {vectors_to_delete} vectors...")
        index.delete(delete_all=True, namespace=namespace)
        
        books_to_delete = list(db.books.find({"subject": {"$regex": f"^{subject}$", "$options": "i"}}))
        
        mongo_result = db.books.delete_many({"subject": {"$regex": f"^{subject}$", "$options": "i"}})
        books_deleted = mongo_result.deleted_count
        
        logger.info(f"Deleted subject '{subject}': {vectors_to_delete} vectors, {books_deleted} book records")
        
        return {
            "success": True,
            "message": f"Subject '{subject}' deleted successfully",
            "deleted": {
                "subject": subject,
                "namespace": namespace,
                "vectors_deleted": vectors_to_delete,
                "books_deleted": books_deleted
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Delete subject failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/admin/delete-class/{subject}/{class_level}")
async def delete_class(subject: str, class_level: int, confirmation: str = Query(...)):
    """
    Delete all vectors for a specific class within a subject.
    Requires typing "Class {class_level}" as confirmation.
    
    This deletes:
    - All vectors in Pinecone with matching subject & class_level metadata
    - All book records in MongoDB for this subject and class
    """
    try:
        expected_confirmation = f"Class {class_level}"
        if confirmation != expected_confirmation:
            raise HTTPException(
                status_code=400,
                detail=f"Confirmation '{confirmation}' does not match expected '{expected_confirmation}'"
            )
        
        from pinecone import Pinecone
        
        pc = Pinecone(api_key=settings.PINECONE_API_KEY)
        index = pc.Index(
            name=settings.PINECONE_MASTER_INDEX,
            host=settings.PINECONE_MASTER_HOST
        )
        
        namespace = subject.lower().replace(' ', '_')
        
        all_vector_ids = []
        
        query_response = index.query(
            namespace=namespace,
            vector=[0.0] * 768,
            top_k=10000,
            include_metadata=True,
            filter={
                "$or": [
                    {"class_level": class_level},
                    {"class_level": str(class_level)},
                    {"class": class_level},
                    {"class": str(class_level)},
                    {"class": f"Class {class_level}"}
                ]
            }
        )
        
        for match in query_response.get("matches", []):
            all_vector_ids.append(match["id"])
        
        vectors_to_delete = len(all_vector_ids)
        
        if vectors_to_delete == 0:
            raise HTTPException(
                status_code=404, 
                detail=f"No vectors found for Class {class_level} in {subject}"
            )
        
        logger.info(f" Deleting {vectors_to_delete} vectors for {subject} Class {class_level}...")
        
        for i in range(0, len(all_vector_ids), 1000):
            batch = all_vector_ids[i:i+1000]
            index.delete(ids=batch, namespace=namespace)
            logger.info(f"  ✓ Deleted batch of {len(batch)} vectors")
        
        books_to_delete = list(db.books.find({
            "subject": {"$regex": f"^{subject}$", "$options": "i"},
            "class_level": class_level
        }))
        
        mongo_result = db.books.delete_many({
            "subject": {"$regex": f"^{subject}$", "$options": "i"},
            "class_level": class_level
        })
        books_deleted = mongo_result.deleted_count
        
        logger.info(f"Deleted Class {class_level} from {subject}: {vectors_to_delete} vectors, {books_deleted} book records")
        
        return {
            "success": True,
            "message": f"Class {class_level} deleted from {subject}",
            "deleted": {
                "subject": subject,
                "class_level": class_level,
                "vectors_deleted": vectors_to_delete,
                "books_deleted": books_deleted
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Delete class failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/admin/delete-chapter/{subject}/{class_level}/{chapter_number}")
async def delete_chapter(subject: str, class_level: int, chapter_number: int, confirmation: str = Query(...)):
    """
    Delete all vectors for a specific chapter.
    Requires typing "Chapter {chapter_number}" as confirmation.
    
    This deletes:
    - All vectors in Pinecone with matching subject, class_level & chapter_number metadata
    - The book record in MongoDB for this chapter
    """
    try:
        expected_confirmation = f"Chapter {chapter_number}"
        if confirmation != expected_confirmation:
            raise HTTPException(
                status_code=400,
                detail=f"Confirmation '{confirmation}' does not match expected '{expected_confirmation}'"
            )
        
        from pinecone import Pinecone
        
        pc = Pinecone(api_key=settings.PINECONE_API_KEY)
        index = pc.Index(
            name=settings.PINECONE_MASTER_INDEX,
            host=settings.PINECONE_MASTER_HOST
        )
        
        namespace = subject.lower().replace(' ', '_')
        
        all_vector_ids = []
        
        query_response = index.query(
            namespace=namespace,
            vector=[0.0] * 768,
            top_k=10000,
            include_metadata=True,
            filter={
                "$and": [
                    {"$or": [
                        {"class_level": class_level},
                        {"class_level": str(class_level)},
                        {"class": class_level},
                        {"class": str(class_level)},
                        {"class": f"Class {class_level}"}
                    ]},
                    {"$or": [
                        {"chapter_number": chapter_number},
                        {"chapter_number": str(chapter_number)},
                        {"chapter": chapter_number},
                        {"chapter": str(chapter_number)},
                        {"chapter": f"Chapter {chapter_number}"}
                    ]}
                ]
            }
        )
        
        for match in query_response.get("matches", []):
            all_vector_ids.append(match["id"])
        
        vectors_to_delete = len(all_vector_ids)
        
        if vectors_to_delete == 0:
            raise HTTPException(
                status_code=404,
                detail=f"No vectors found for {subject} Class {class_level} Chapter {chapter_number}"
            )
        
        logger.info(f" Deleting {vectors_to_delete} vectors for {subject} Class {class_level} Chapter {chapter_number}...")
        
        for i in range(0, len(all_vector_ids), 1000):
            batch = all_vector_ids[i:i+1000]
            index.delete(ids=batch, namespace=namespace)
        
        books_to_delete = list(db.books.find({
            "subject": {"$regex": f"^{subject}$", "$options": "i"},
            "class_level": class_level,
            "chapter_number": chapter_number
        }))
        
        mongo_result = db.books.delete_many({
            "subject": {"$regex": f"^{subject}$", "$options": "i"},
            "class_level": class_level,
            "chapter_number": chapter_number
        })
        books_deleted = mongo_result.deleted_count
        
        from app.services.summary_cache_service import summary_cache_service
        cache_result = await summary_cache_service.delete_chapter_summaries(
            subject=subject,
            class_level=class_level,
            chapter=chapter_number
        )
        summaries_deleted = cache_result.get("summaries_deleted", 0)
        
        logger.info(f"Deleted Chapter {chapter_number} from {subject} Class {class_level}: {vectors_to_delete} vectors, {books_deleted} book records, {summaries_deleted} cached summaries")
        
        return {
            "success": True,
            "message": f"Chapter {chapter_number} deleted from {subject} Class {class_level}",
            "deleted": {
                "subject": subject,
                "class_level": class_level,
                "chapter_number": chapter_number,
                "vectors_deleted": vectors_to_delete,
                "books_deleted": books_deleted,
                "summaries_deleted": summaries_deleted
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Delete chapter failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
