"""
Pinecone Uploader for Multimodal Math Content

Uploads chunks with 768-dim embeddings to Pinecone mathematics namespace.
Handles batch uploads with comprehensive metadata.

Features:
- Batch upsert to Pinecone
- Automatic namespace routing
- Metadata validation
- Progress tracking
- Error handling and retry logic
"""

from typing import List, Dict, Optional, Tuple
import logging
from pinecone import Pinecone
import numpy as np
from tqdm import tqdm
import time

logger = logging.getLogger(__name__)

class PineconeUploader:
    """
    Uploads multimodal math chunks to Pinecone.
    
    Usage:
        uploader = PineconeUploader(api_key, index_name)
        uploader.upload_chunks(chunks, embeddings, namespace="maths")
    """
    
    def __init__(
        self,
        api_key: str,
        index_name: str,
        index_host: Optional[str] = None
    ):
        """
        Initialize Pinecone uploader.
        
        Args:
            api_key: Pinecone API key
            index_name: Pinecone index name
            index_host: Optional index host URL
        """
        logger.info(f"📤 Initializing Pinecone Uploader")
        logger.info(f"   Index: {index_name}")
        
        try:
            self.pc = Pinecone(api_key=api_key)
            
            if index_host:
                self.index = self.pc.Index(index_name, host=index_host)
            else:
                self.index = self.pc.Index(index_name)
            
            stats = self.index.describe_index_stats()
            logger.info(f"Connected to Pinecone index")
            logger.info(f"   Total vectors: {stats.get('total_vector_count', 0)}")
            logger.info(f"   Dimension: {stats.get('dimension', 'unknown')}")
            
            self.index_name = index_name
        
        except Exception as e:
            logger.error(f" Failed to initialize Pinecone: {e}")
            raise
    
    def upload_chunks(
        self,
        chunks: List[Dict],
        embeddings: List[np.ndarray] = None,
        namespace: str = "maths",
        batch_size: int = 100,
        show_progress: bool = True
    ) -> Dict:
        """
        Upload chunks with embeddings to Pinecone.
        
        Args:
            chunks: List of chunk dictionaries (with or without 'embedding' key)
            embeddings: List of 768-dim embeddings (optional if chunks have 'embedding' key)
            namespace: Pinecone namespace
            batch_size: Batch size for upsert
            show_progress: Show progress bar
        
        Returns:
            Upload statistics
        """
        if embeddings is None:
            embeddings = [chunk.get('embedding') for chunk in chunks]
            valid_indices = [i for i, emb in enumerate(embeddings) if emb is not None]
            chunks = [chunks[i] for i in valid_indices]
            embeddings = [embeddings[i] for i in valid_indices]
        
        if len(chunks) != len(embeddings):
            raise ValueError(f"Chunks ({len(chunks)}) and embeddings ({len(embeddings)}) count mismatch")
        
        logger.info(f"📤 Uploading {len(chunks)} chunks to namespace: {namespace}")
        
        vectors = []
        for chunk, embedding in zip(chunks, embeddings):
            vector_id = chunk['chunk_id']
            metadata = self._prepare_metadata(chunk)
            
            vectors.append({
                "id": vector_id,
                "values": embedding.tolist() if isinstance(embedding, np.ndarray) else embedding,
                "metadata": metadata
            })
        
        total_uploaded = 0
        failed_uploads = []
        
        iterator = tqdm(range(0, len(vectors), batch_size), desc="Uploading") if show_progress else range(0, len(vectors), batch_size)
        
        for i in iterator:
            batch = vectors[i:i + batch_size]
            
            try:
                self.index.upsert(
                    vectors=batch,
                    namespace=namespace
                )
                
                total_uploaded += len(batch)
                logger.debug(f"   Uploaded batch {i // batch_size + 1}: {len(batch)} vectors")
                
                time.sleep(0.1)
            
            except Exception as e:
                logger.error(f" Failed to upload batch starting at {i}: {e}")
                failed_uploads.extend([v['id'] for v in batch])
                continue
        
        logger.info(f"Upload complete!")
        logger.info(f"   Successful: {total_uploaded}")
        logger.info(f"   Failed: {len(failed_uploads)}")
        
        return {
            "total": len(chunks),
            "uploaded": total_uploaded,
            "failed": len(failed_uploads),
            "failed_ids": failed_uploads,
            "namespace": namespace
        }
    
    def _prepare_metadata(self, chunk: Dict) -> Dict:
        """
        Prepare and validate metadata for Pinecone.
        
        Args:
            chunk: Chunk dictionary
        
        Returns:
            Clean metadata dictionary
        """
        base_metadata = chunk.get('metadata', {}).copy()
        
        base_metadata.update({
            "text": chunk.get('raw_text', '')[:1000],
            "has_formula": chunk.get('has_formula', False),
            "has_image": chunk.get('has_image', False),
            "content_type": chunk.get('content_type', 'unknown'),
        })
        
        if chunk.get('latex_formula'):
            base_metadata['formula'] = chunk['latex_formula'][:500]
        
        if chunk.get('image_path'):
            base_metadata['image_path'] = str(chunk['image_path'])
        
        if chunk.get('step_number') is not None:
            base_metadata['solution_step_number'] = chunk['step_number']
        
        if 'topics' in base_metadata and isinstance(base_metadata['topics'], list):
            base_metadata['topics'] = ','.join(base_metadata['topics'])
        
        clean_metadata = {}
        for key, value in base_metadata.items():
            if value is not None:
                if isinstance(value, bool):
                    clean_metadata[key] = "True" if value else "False"
                elif isinstance(value, (int, float)):
                    clean_metadata[key] = str(value)
                elif isinstance(value, str):
                    clean_metadata[key] = value
                else:
                    clean_metadata[key] = str(value)
        
        return clean_metadata
    
    def query_namespace(
        self,
        query_vector: np.ndarray,
        namespace: str = "maths",
        top_k: int = 10,
        filter_dict: Optional[Dict] = None
    ) -> Dict:
        """
        Query Pinecone namespace with vector.
        
        Args:
            query_vector: 768-dim query vector
            namespace: Namespace to query
            top_k: Number of results
            filter_dict: Metadata filters
        
        Returns:
            Query results
        """
        try:
            results = self.index.query(
                vector=query_vector.tolist() if isinstance(query_vector, np.ndarray) else query_vector,
                namespace=namespace,
                top_k=top_k,
                filter=filter_dict,
                include_metadata=True
            )
            
            logger.debug(f"   Query returned {len(results.get('matches', []))} results")
            return results
        
        except Exception as e:
            logger.error(f" Query failed: {e}")
            raise
    
    def delete_namespace(self, namespace: str):
        """
        Delete all vectors in a namespace.
        
        Args:
            namespace: Namespace to delete
        """
        logger.warning(f"🗑️  Deleting all vectors in namespace: {namespace}")
        
        try:
            self.index.delete(delete_all=True, namespace=namespace)
            logger.info(f"Namespace '{namespace}' cleared")
        
        except Exception as e:
            logger.error(f" Failed to delete namespace: {e}")
            raise
    
    def get_namespace_stats(self, namespace: str) -> Dict:
        """
        Get statistics for a specific namespace.
        
        Args:
            namespace: Namespace name
        
        Returns:
            Statistics dictionary
        """
        try:
            stats = self.index.describe_index_stats()
            namespaces = stats.get('namespaces', {})
            
            if namespace in namespaces:
                ns_stats = namespaces[namespace]
                return {
                    "namespace": namespace,
                    "vector_count": ns_stats.get('vector_count', 0)
                }
            else:
                return {
                    "namespace": namespace,
                    "vector_count": 0,
                    "note": "Namespace not found or empty"
                }
        
        except Exception as e:
            logger.error(f" Failed to get namespace stats: {e}")
            return {"error": str(e)}
    
    def update_metadata_batch(
        self,
        vector_ids: List[str],
        metadata_updates: List[Dict],
        namespace: str = "maths"
    ):
        """
        Update metadata for existing vectors.
        
        Args:
            vector_ids: List of vector IDs to update
            metadata_updates: List of metadata dictionaries
            namespace: Namespace
        """
        if len(vector_ids) != len(metadata_updates):
            raise ValueError("vector_ids and metadata_updates must have same length")
        
        logger.info(f"📝 Updating metadata for {len(vector_ids)} vectors...")
        
        for vector_id, metadata in zip(vector_ids, metadata_updates):
            try:
                self.index.update(
                    id=vector_id,
                    set_metadata=metadata,
                    namespace=namespace
                )
            except Exception as e:
                logger.error(f"Failed to update {vector_id}: {e}")
                continue
        
        logger.info(f"Metadata updates complete")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    print("Pinecone uploader ready for production use")
