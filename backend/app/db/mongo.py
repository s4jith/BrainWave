"""
Database connections for MongoDB Atlas and Pinecone Vector Database.
"""

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
from pinecone import Pinecone
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class MongoDB:
    """MongoDB Atlas connection manager."""
    
    def __init__(self):
        self.client = None
        self.db = None
    
    async def connect(self):
        """Initialize MongoDB connection."""
        try:
            self.client = AsyncIOMotorClient(settings.MONGO_URI)
            self.db = self.client.ncert_learning_db
            
            await self.client.admin.command('ping')
            logger.info("Connected to MongoDB Atlas successfully")
            
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise
    
    async def close(self):
        """Close MongoDB connection."""
        if self.client:
            self.client.close()
            logger.info("MongoDB connection closed")
    
    def get_collection(self, collection_name: str):
        """Get a collection from the database."""
        return self.db[collection_name]

mongodb = MongoDB()

class SyncMongoDB:
    """
    Synchronous MongoDB client for routes that need blocking operations.
    Used by auth.py and admin_dashboard.py for user management.
    """
    
    def __init__(self):
        self._client = None
        self._db = None
    
    @property
    def client(self):
        """Lazy initialization of MongoDB client."""
        if self._client is None:
            self._client = MongoClient(settings.MONGO_URI)
            self._db = self._client.ncert_learning_db
            logger.info("Sync MongoDB client initialized")
        return self._client
    
    @property
    def db(self):
        """Get the database instance."""
        if self._db is None:
            self.client
        return self._db
    
    @property
    def users(self):
        """Get users collection."""
        return self.db.users
    
    @property
    def support_tickets(self):
        """Get support tickets collection."""
        return self.db.support_tickets
    
    @property
    def student_counters(self):
        """Get student counters collection for ID generation."""
        return self.db.student_counters
    
    @property
    def tests(self):
        """Get tests collection for test management."""
        return self.db.tests
    
    @property
    def test_submissions(self):
        """Get test submissions collection."""
        return self.db.test_submissions

    @property
    def test_sessions(self):
        """Get test sessions collection."""
        return self.db.test_sessions
    
    @property
    def notifications(self):
        """Get notifications collection."""
        return self.db.notifications
    
    @property
    def dismissed_notifications(self):
        """Get dismissed notifications collection."""
        return self.db.dismissed_notifications
    
    @property
    def books(self):
        """Get books collection for book management."""
        return self.db.books
    
    @property
    def book_chapters(self):
        """Get book chapters collection."""
        return self.db.book_chapters
    
    @property
    def groups(self):
        """Get groups collection for group management."""
        return self.db.groups
    
    @property
    def teacher_counters(self):
        """Get teacher counters collection for ID generation."""
        return self.db.teacher_counters
    
    @property
    def questions(self):
        """Get questions collection for question bank."""
        return self.db.questions

    @property
    def question_delete_requests(self):
        """Get question delete requests collection."""
        return self.db.question_delete_requests

    @property
    def assessments(self):
        """Get assessments collection."""
        return self.db.assessments
    
    @property
    def submissions(self):
        """Get submissions collection (for assessment submissions)."""
        return self.db.submissions
    
    @property
    def subjects(self):
        """Get subjects collection (for curriculum)."""
        return self.db.subjects

    @property
    def platform_settings(self):
        """Get platform_settings collection for admin settings."""
        return self.db.platform_settings

    @property
    def queries(self):
        """Get queries collection for student-teacher queries."""
        return self.db.queries

    @property
    def head_counters(self):
        """Get head counters collection for ID generation."""
        return self.db.head_counters
    
    def get_collection(self, name: str):
        """Get a collection by name."""
        return self.db[name]
    
    def close(self):
        """Close the connection."""
        if self._client:
            self._client.close()
            self._client = None
            self._db = None
            logger.info("Sync MongoDB client closed")

db = SyncMongoDB()

class PineconeDB:
    """Pinecone Vector Database connection manager."""
    
    def __init__(self):
        self.pc = None
        self.index = None
    
    def connect(self):
        """Initialize Pinecone connection."""
        try:
            self.pc = Pinecone(api_key=settings.PINECONE_API_KEY)
            
            self.index = self.pc.Index(
                name=settings.PINECONE_INDEX,
                host=settings.PINECONE_HOST
            )
            
            stats = self.index.describe_index_stats()
            logger.info(f"Connected to Pinecone successfully")
            logger.info(f"Index: {settings.PINECONE_INDEX}")
            logger.info(f"Total vectors: {stats.get('total_vector_count', 0)}")
            
        except Exception as e:
            logger.error(f"Failed to connect to Pinecone: {e}")
            logger.warning("Pinecone connection failed - RAG features will not work")
            logger.warning("Please check PINECONE_HOST in .env file")
            logger.warning("Get correct host from: https://app.pinecone.io/")
    
    def query(self, vector: list[float], top_k: int = 5, filter: dict = None):
        """
        Query Pinecone index with a vector.
        
        Args:
            vector: Query embedding vector
            top_k: Number of results to return
            filter: Metadata filter (e.g., {"class": 6, "subject": "Geography"})
        
        Returns:
            Query results from Pinecone
        """
        try:
            if not self.index:
                logger.warning("Pinecone index not connected, attempting to reconnect...")
                self.connect()
                if not self.index:
                    raise Exception("Failed to reconnect to Pinecone")
            
            results = self.index.query(
                vector=vector,
                top_k=top_k,
                filter=filter,
                include_metadata=True
            )
            return results
        except Exception as e:
            logger.error(f"Pinecone query failed: {e}")
            try:
                logger.info("Attempting to reconnect to Pinecone...")
                self.connect()
                if self.index:
                    results = self.index.query(
                        vector=vector,
                        top_k=top_k,
                        filter=filter,
                        include_metadata=True
                    )
                    logger.info("Reconnection successful, query completed")
                    return results
            except Exception as reconnect_error:
                logger.error(f"Reconnection failed: {reconnect_error}")
            raise
    
    def upsert(self, vectors: list[tuple]):
        """
        Upsert vectors into Pinecone index.
        
        Args:
            vectors: List of (id, vector, metadata) tuples
        """
        try:
            self.index.upsert(vectors=vectors)
            logger.info(f"Upserted {len(vectors)} vectors to Pinecone")
        except Exception as e:
            logger.error(f"Pinecone upsert failed: {e}")
            raise

pinecone_db = PineconeDB()

class PineconeLLMDB:
    """Pinecone Vector Database for storing LLM-generated answers."""
    
    def __init__(self):
        self.pc = None
        self.index = None
    
    def connect(self):
        """Initialize Pinecone LLM content connection."""
        try:
            self.pc = Pinecone(api_key=settings.PINECONE_API_KEY)
            
            if settings.PINECONE_LLM_HOST:
                self.index = self.pc.Index(
                    name=settings.PINECONE_LLM_INDEX,
                    host=settings.PINECONE_LLM_HOST
                )
                
                stats = self.index.describe_index_stats()
                logger.info(f"Connected to Pinecone LLM Content DB successfully")
                logger.info(f"Index: {settings.PINECONE_LLM_INDEX}")
                logger.info(f"Total LLM vectors: {stats.get('total_vector_count', 0)}")
            else:
                logger.warning(" PINECONE_LLM_HOST not configured - LLM storage disabled")
                logger.warning("To enable: Create 'ncert-llm' index (768 dim) and add PINECONE_LLM_HOST to .env")
            
        except Exception as e:
            logger.error(f"Failed to connect to Pinecone LLM DB: {e}")
            logger.warning("LLM content DB connection failed - LLM storage will be disabled")
    
    def store_llm_response(
        self,
        vector_id: str,
        question: str,
        answer: str,
        subject: str,
        topic: str,
        class_level: int,
        embedding: list[float],
        quality_score: float = 0.9
    ):
        """
        Store LLM-generated answer with metadata.
        
        Args:
            vector_id: Unique identifier for the vector
            question: Student's question
            answer: LLM-generated answer
            subject: Subject name (Mathematics, Physics, etc.)
            topic: Specific topic (algebra, trigonometry, etc.)
            class_level: Student's class (6, 7, 8, etc.)
            embedding: Question embedding vector (768 dimensions)
            quality_score: Answer quality score (0-1)
        """
        try:
            if not self.index:
                logger.warning("LLM DB not connected - skipping storage")
                return False
            
            from datetime import datetime
            
            metadata = {
                "question": question[:2000],
                "answer": answer[:30000],
                "subject": subject,
                "topic": topic.lower(),
                "class": str(class_level),
                "quality_score": quality_score,
                "created_date": datetime.now().isoformat(),
                "usage_count": 0
            }
            
            self.index.upsert(
                vectors=[(vector_id, embedding, metadata)],
                namespace=subject.lower()
            )
            
            logger.info(f"Stored LLM answer: {vector_id} in {subject} namespace")
            return True
            
        except Exception as e:
            logger.error(f"Failed to store LLM response: {e}")
            return False
    
    def query(self, vector: list[float], subject: str, top_k: int = 3, filter: dict = None):
        """
        Query Pinecone LLM content index with a vector.
        
        Args:
            vector: Query embedding vector
            subject: Subject namespace to query
            top_k: Number of results to return
            filter: Additional metadata filter
        
        Returns:
            Query results from Pinecone
        """
        try:
            if not self.index:
                logger.debug("LLM DB not connected - returning empty results")
                return {"matches": []}
            
            results = self.index.query(
                namespace=subject.lower(),
                vector=vector,
                top_k=top_k,
                filter=filter,
                include_metadata=True
            )
            return results
            
        except Exception as e:
            logger.error(f"Pinecone LLM query failed: {e}")
            return {"matches": []}
    
    def increment_usage(self, vector_id: str, subject: str):
        """Increment usage counter for a stored answer."""
        try:
            if not self.index:
                return
            
            fetch_result = self.index.fetch(ids=[vector_id], namespace=subject.lower())
            if vector_id in fetch_result.get('vectors', {}):
                vector_data = fetch_result['vectors'][vector_id]
                metadata = vector_data.get('metadata', {})
                
                metadata['usage_count'] = metadata.get('usage_count', 0) + 1
                
                self.index.upsert(
                    vectors=[(vector_id, vector_data['values'], metadata)],
                    namespace=subject.lower()
                )
                
                logger.debug(f"Incremented usage count for {vector_id}")
                
        except Exception as e:
            logger.error(f"Failed to increment usage count: {e}")

pinecone_llm_db = PineconeLLMDB()

class NamespaceDB:
    """
    Architecture:
    - Master Index: ncert-all-subjects
    - Namespaces: mathematics, physics, chemistry, biology, social-science, english, hindi
    - Each namespace contains content for all relevant classes
    """
    
    def __init__(self):
        self.pc = None
        self.index = None
        
        self.subject_namespaces = {
            "Maths": "maths",
            "Mathematics": "maths",
            "Math": "maths",
            "Physics": "physics",
            "Chemistry": "chemistry",
            "Biology": "biology",
            "Social Science": "social-science",
            "English": "english",
            "Hindi": "hindi"
        }
        
        self.subject_classes = {
            "Maths": list(range(5, 13)),
            "Mathematics": list(range(5, 13)),
            "Math": list(range(5, 13)),
            "Physics": list(range(9, 13)),
            "Chemistry": list(range(9, 13)),
            "Biology": list(range(9, 13)),
            "Social Science": list(range(5, 11)),
            "English": list(range(5, 13)),
            "Hindi": list(range(5, 13))
        }
    
    def connect(self):
        """Initialize connection to master Pinecone index."""
        try:
            self.pc = Pinecone(api_key=settings.PINECONE_API_KEY)
            
            self.index = self.pc.Index(
                name=settings.PINECONE_MASTER_INDEX,
                host=settings.PINECONE_MASTER_HOST
            )
            
            stats = self.index.describe_index_stats()
            
            logger.info("="*60)
            logger.info("Connected to Master Index (Namespace Architecture)")
            logger.info(f"   Index: {settings.PINECONE_MASTER_INDEX}")
            logger.info(f"   Total vectors: {stats.get('total_vector_count', 0)}")
            
            namespaces = stats.get('namespaces', {})
            if namespaces:
                logger.info(f"   Active namespaces: {len(namespaces)}")
                for ns_name, ns_stats in namespaces.items():
                    logger.info(f"      • {ns_name}: {ns_stats.get('vector_count', 0)} vectors")
            else:
                logger.info("   No data uploaded yet - namespaces will be created on upload")
            
            logger.info("="*60)
            
        except Exception as e:
            logger.error(f"Failed to connect to master index: {e}")
            logger.warning("Namespace DB connection failed - progressive learning unavailable")
    
    def get_namespace(self, subject: str) -> str:
        """
        Get namespace name for a subject.
        
        Args:
            subject: Subject name (e.g., "Mathematics", "Social Science")
        
        Returns:
            Namespace string (e.g., "mathematics", "social-science")
        """
        return self.subject_namespaces.get(subject, subject.lower().replace(" ", "-"))
    
    def get_prerequisite_classes(self, student_class: int, subject: str, mode: str = "quick") -> list[str]:
        """
        Determine which classes to search based on student's class and mode.
        
        Args:
            student_class: Student's current class (5-12)
            subject: Subject name
            mode: Query mode ("quick" or "deepdive")
        
        Returns:
            List of class strings to search
        """
        available_classes = self.subject_classes.get(subject, [])
        
        if mode == "quick":
            classes = [student_class]
            if student_class > min(available_classes):
                classes.append(student_class - 1)
        else:
            classes = [c for c in available_classes if c <= student_class]
        
        return [str(c) for c in classes]
    
    def query(
        self,
        vector: list[float],
        subject: str,
        class_filter: list[str] = None,
        top_k: int = 10,
        additional_filters: dict = None
    ):
        """
        Query subject namespace with optional class filtering.
        
        Args:
            vector: Query embedding vector
            subject: Subject name (e.g., "Mathematics", "Physics")
            class_filter: List of class levels to search (e.g., ["9", "10", "11"])
            top_k: Number of results to return
            additional_filters: Additional metadata filters
        
        Returns:
            Query results from Pinecone
        """
        if not self.index:
            logger.error("Namespace DB not connected")
            return {"matches": []}
        
        try:
            namespace = self.get_namespace(subject)
            
            filter_dict = {}
            
            if class_filter:
                if len(class_filter) == 1:
                    filter_dict["class"] = class_filter[0]
                else:
                    filter_dict["class"] = {"$in": class_filter}
            
            if additional_filters:
                filter_dict.update(additional_filters)
            
            results = self.index.query(
                vector=vector,
                namespace=namespace,
                top_k=top_k,
                filter=filter_dict if filter_dict else None,
                include_metadata=True
            )
            
            logger.info(f"📖 Queried namespace '{namespace}' with classes {class_filter}: {len(results.get('matches', []))} results")
            
            return results
            
        except Exception as e:
            logger.error(f"Namespace query failed for {subject}: {e}")
            try:
                logger.info("Attempting to reconnect...")
                self.connect()
                if self.index:
                    results = self.index.query(
                        vector=vector,
                        namespace=self.get_namespace(subject),
                        top_k=top_k,
                        filter=filter_dict if filter_dict else None,
                        include_metadata=True
                    )
                    logger.info("Reconnection successful, query completed")
                    return results
            except Exception as reconnect_error:
                logger.error(f"Reconnection failed: {reconnect_error}")
            return {"matches": []}
    
    def query_progressive(
        self,
        vector: list[float],
        subject: str,
        student_class: int,
        mode: str = "quick",
        top_k: int = 10
    ):
        """
        Progressive learning query: retrieves content from multiple class levels.
        
        Args:
            vector: Query embedding
            subject: Subject name
            student_class: Student's current class
            mode: Query mode ("quick" or "deepdive")
            top_k: Total results to return
        
        Returns:
            Dictionary with combined results and progressive breakdown
        """
        if not self.index:
            logger.error("Namespace DB not connected")
            return {"matches": [], "progressive_results": {}, "classes_searched": []}
        
        try:
            classes_to_search = self.get_prerequisite_classes(student_class, subject, mode)
            
            logger.info(f"🎓 Progressive query for {subject} (Student: Class {student_class}, Mode: {mode})")
            logger.info(f"   Searching classes: {', '.join(classes_to_search)}")
            
            results = self.query(
                vector=vector,
                subject=subject,
                class_filter=classes_to_search,
                top_k=top_k
            )
            
            progressive_results = {}
            for match in results.get("matches", []):
                class_level = match.get("metadata", {}).get("class", "unknown")
                if class_level not in progressive_results:
                    progressive_results[class_level] = []
                progressive_results[class_level].append(match)
            
            logger.info(f"   Found content from {len(progressive_results)} class levels")
            for class_level in sorted(progressive_results.keys()):
                logger.info(f"      Class {class_level}: {len(progressive_results[class_level])} chunks")
            
            return {
                "matches": results.get("matches", []),
                "progressive_results": progressive_results,
                "classes_searched": classes_to_search
            }
            
        except Exception as e:
            logger.error(f"Progressive query failed: {e}")
            return {"matches": [], "progressive_results": {}, "classes_searched": []}
    
    def upsert(self, vectors: list[tuple], subject: str):
        """
        Upsert vectors into subject namespace.
        
        Args:
            vectors: List of (id, vector, metadata) tuples
            subject: Subject name (determines namespace)
        """
        if not self.index:
            logger.error("Namespace DB not connected")
            return
        
        try:
            namespace = self.get_namespace(subject)
            self.index.upsert(vectors=vectors, namespace=namespace)
            logger.info(f"Upserted {len(vectors)} vectors to namespace '{namespace}'")
        except Exception as e:
            logger.error(f"Upsert failed for {subject}: {e}")
            raise
    
    def get_available_subjects(self):
        """Get list of all configured subjects."""
        return list(self.subject_namespaces.keys())
    
    def get_subject_info(self, subject: str):
        """Get information about a subject."""
        return {
            "subject": subject,
            "namespace": self.get_namespace(subject),
            "classes": self.subject_classes.get(subject, [])
        }

namespace_db = NamespaceDB()

async def init_databases():
    """Initialize all database connections."""
    logger.info("Initializing database connections...")
    
    try:
        await mongodb.connect()
        # Create indexes for commonly queried fields (idempotent — safe to call on every startup)
        try:
            await mongodb.db.users.create_index("email", unique=True)
            await mongodb.db.users.create_index("user_id", unique=True)
            await mongodb.db.users.create_index("email_normalized")
            await mongodb.db.users.create_index("role")
            await mongodb.db.tests.create_index([("class_level", 1), ("subject", 1)])
            await mongodb.db.tests.create_index("created_by")
            await mongodb.db.test_submissions.create_index("student_id")
            await mongodb.db.test_sessions.create_index("student_id")
            await mongodb.db.notifications.create_index("user_id")
            await mongodb.db.questions.create_index([("class_level", 1), ("subject", 1)])
            await mongodb.db.groups.create_index("created_by")
            logger.info("MongoDB indexes ensured")
        except Exception as e:
            logger.warning(f"Index creation skipped (non-critical): {e}")
    except Exception as e:
        logger.warning(f"MongoDB unavailable at startup (will retry on first request): {e}")
    
    pinecone_db.connect()
    
    pinecone_llm_db.connect()
    
    logger.info("\nConnecting to Production Namespace Architecture:")
    namespace_db.connect()
    
    logger.info("\nAll databases initialized successfully")

async def close_databases():
    """Close all database connections."""
    logger.info("Closing database connections...")
    await mongodb.close()
    logger.info("All databases closed")

def get_notes_collection():
    """Get notes collection from MongoDB."""
    return mongodb.get_collection("notes")

def get_evaluations_collection():
    """Get evaluations collection from MongoDB."""
    return mongodb.get_collection("evaluations")

def get_annotation_history_collection():
    """Get annotation history collection from MongoDB."""
    return mongodb.get_collection("annotation_history")

def get_database():
    """Get the MongoDB database instance."""
    return db.db

def get_pinecone_index():
    """Get the primary Pinecone index."""
    return pinecone_db.index if pinecone_db else None
