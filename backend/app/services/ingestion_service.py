"""
Ingestion Service

PDF processing pipeline: PDF → Extract → Chunk → Embed → Pinecone Upsert.
"""

import logging
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass

from app.utils.performance_logger import measure_latency
from app.services.pdf_processor import AdvancedPDFProcessor, PineconeEmbeddingUploader, ProcessingResult

logger = logging.getLogger(__name__)

@dataclass
class IngestionConfig:
    """Configuration for Ingestion Service."""
    component_name: str = "IngestionService"
    
    chunk_size: int = 800
    chunk_overlap: int = 150
    dpi: int = 300
    use_gemini_vision: bool = True

class IngestionService:
    """
    Ingestion Service for document processing pipeline.
    
    Pipeline:
        1. PDF loading and page extraction
        2. Text extraction (Gemini Vision)
        3. Content chunking with metadata
        4. Embedding generation (Gemini embedding-001)
        5. Vector upsert to Pinecone
    """
    
    def __init__(self, config: Optional[IngestionConfig] = None):
        self.config = config or IngestionConfig()
        
        self.pdf_processor = AdvancedPDFProcessor(
            chunk_size=self.config.chunk_size,
            chunk_overlap=self.config.chunk_overlap,
            dpi=self.config.dpi,
            use_gemini_vision=self.config.use_gemini_vision
        )
        
        self.embedding_uploader = PineconeEmbeddingUploader()
        
        logger.info(f"{self.config.component_name} initialized")
    
    @measure_latency("ingestion_full_pipeline")
    def ingest_pdf(
        self,
        pdf_path: str,
        book_metadata: Dict,
        progress_callback: Optional[Callable[[int, int, str], None]] = None
    ) -> ProcessingResult:
        """
        Ingest a PDF document into the vector database.
        
        Args:
            pdf_path: Path to the PDF file
            book_metadata: Metadata dict with title, subject, class_level, chapter
            progress_callback: Optional callback for progress updates
        
        Returns:
            ProcessingResult with success status and statistics
        """
        logger.info(f"📥 [IngestionService] Starting PDF ingestion: {pdf_path}")
        logger.info(f"   Metadata: {book_metadata}")
        
        result = self.pdf_processor.process_pdf(
            pdf_path=pdf_path,
            book_metadata=book_metadata,
            progress_callback=progress_callback
        )
        
        if not result.success:
            logger.error(f" [IngestionService] PDF processing failed: {result.errors}")
            return result
        
        chunks = self.pdf_processor.create_chunks(result.pages, book_metadata)
        result.total_chunks = len(chunks)
        
        logger.info(f"📦 [IngestionService] Created {len(chunks)} chunks from {result.processed_pages} pages")
        
        namespace = book_metadata.get("subject", "general").lower().replace(" ", "_")
        
        upload_result = self.embedding_uploader.upload_chunks(
            chunks=chunks,
            namespace=namespace
        )
        
        result.total_embeddings = upload_result.get("uploaded", 0)
        
        logger.info(f"[IngestionService] Ingestion complete: {result.total_embeddings} embeddings uploaded")
        
        return result
    
    def get_status(self) -> Dict:
        """Get service status."""
        return {
            "service": self.config.component_name,
            "embedding_model": "Gemini embedding-001",
            "vector_db": "Pinecone"
        }

ingestion_service = IngestionService()
