"""
Migration Script: Initialize Subjects Collection from Existing Data
Scans existing books and creates curriculum structure
"""

import asyncio
import logging
from datetime import datetime
from app.db.mongo import mongodb
from app.models.curriculum_models import SUBJECTS_COLLECTION

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def migrate_subjects_from_books():
    """
    Scan books collection and create subjects in curriculum
    """
    try:
        # Get all distinct subject/class combinations from books
        books_collection = mongodb.db.books
        
        pipeline = [
            {
                "$group": {
                    "_id": {
                        "subject": "$subject",
                        "class_level": "$class_level"
                    },
                    "chapters": {"$addToSet": "$chapter_number"},
                    "count": {"$sum": 1}
                }
            },
            {"$sort": {"_id.class_level": 1, "_id.subject": 1}}
        ]
        
        book_groups = await books_collection.aggregate(pipeline).to_list(200)
        
        logger.info(f"📚 Found {len(book_groups)} subject-class combinations in books")
        
        subjects_collection = mongodb.db[SUBJECTS_COLLECTION]
        created_count = 0
        updated_count = 0
        
        # Subject icons mapping
        subject_icons = {
            "mathematics": "📐",
            "science": "🔬",
            "physics": "⚛️",
            "chemistry": "🧪",
            "biology": "🌿",
            "social science": "🌍",
            "english": "📖",
            "hindi": "📚",
            "computer science": "💻"
        }
        
        # Subject colors mapping
        subject_colors = {
            "mathematics": "#3B82F6",  # Blue
            "science": "#10B981",      # Green
            "physics": "#8B5CF6",      # Purple
            "chemistry": "#F59E0B",    # Orange
            "biology": "#14B8A6",      # Teal
            "social science": "#EF4444", # Red
            "english": "#EC4899",      # Pink
            "hindi": "#F97316",        # Orange-dark
            "computer science": "#6366F1" # Indigo
        }
        
        for group in book_groups:
            subject_name = group["_id"]["subject"]
            class_level = group["_id"]["class_level"]
            chapter_numbers = sorted(group["chapters"])
            
            subject_id = f"{subject_name.lower().replace(' ', '_')}_{class_level}"
            
            # Check if subject already exists
            existing = await subjects_collection.find_one({"subject_id": subject_id})
            
            if existing:
                logger.info(f"✓ Subject already exists: {subject_name} Class {class_level}")
                updated_count += 1
                continue
            
            # Create chapters array from book data
            chapters = []
            for ch_num in chapter_numbers:
                # Get chapter name from book
                book = await books_collection.find_one({
                    "subject": subject_name,
                    "class_level": class_level,
                    "chapter_number": ch_num
                })
                
                chapter_name = book.get("title", f"Chapter {ch_num}") if book else f"Chapter {ch_num}"
                
                chapter_doc = {
                    "chapter_id": f"{subject_id}_ch{ch_num}",
                    "chapter_number": ch_num,
                    "chapter_name": chapter_name,
                    "description": book.get("description", "") if book else "",
                    "topics": [],  # Will be populated later
                    "pdf_url": book.get("pdf_url", "") if book else "",
                    "video_url": "",
                    "total_pages": 0,
                    "order": ch_num,
                    "is_active": True,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                chapters.append(chapter_doc)
            
            # Create subject document
            subject_doc = {
                "subject_id": subject_id,
                "subject_name": subject_name,
                "class_level": class_level,
                "board": "CBSE",
                "description": f"{subject_name} curriculum for Class {class_level}",
                "icon": subject_icons.get(subject_name.lower(), "📚"),
                "color": subject_colors.get(subject_name.lower(), "#3B82F6"),
                "chapters": chapters,
                "total_topics": 0,
                "total_chapters": len(chapters),
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            await subjects_collection.insert_one(subject_doc)
            logger.info(f"✅ Created subject: {subject_name} Class {class_level} with {len(chapters)} chapters")
            created_count += 1
        
        logger.info(f"\n📊 Migration Summary:")
        logger.info(f"   ✅ Created: {created_count} subjects")
        logger.info(f"   ✓ Skipped (existing): {updated_count} subjects")
        logger.info(f"   📚 Total: {created_count + updated_count} subjects")
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()


async def migrate_topics_from_question_bank():
    """
    Scan topic_question_bank and add topics to curriculum chapters
    """
    try:
        question_bank = mongodb.db.topic_question_bank
        subjects_collection = mongodb.db[SUBJECTS_COLLECTION]
        
        # Get all question bank entries
        banks = await question_bank.find({"is_active": True}).to_list(500)
        
        logger.info(f"📝 Found {len(banks)} question banks with topics")
        
        updated_count = 0
        
        for bank in banks:
            subject_name = bank["subject"]
            class_level = bank["class_level"]
            chapter_number = bank["chapter_number"]
            
            subject_id = f"{subject_name.lower().replace(' ', '_')}_{class_level}"
            chapter_id = f"{subject_id}_ch{chapter_number}"
            
            # Get topics from bank (each bank entry IS a topic)
            topic_doc = {
                "topic_id": bank["topic_id"],
                "topic_name": bank["topic_name"],
                "description": bank.get("topic_description", ""),
                "page_range": bank.get("page_range", ""),
                "learning_objectives": [],
                "keywords": [],
                "estimated_time_minutes": 45,
                "difficulty_level": "medium",
                "prerequisites": [],
                "order": 1,
                "is_active": True,
                "question_count": bank.get("total_questions", 0)
            }
            
            # Update subject with topic
            result = await subjects_collection.update_one(
                {
                    "subject_id": subject_id,
                    "chapters.chapter_id": chapter_id
                },
                {
                    "$push": {"chapters.$.topics": topic_doc},
                    "$set": {"updated_at": datetime.utcnow()}
                }
            )
            
            if result.modified_count > 0:
                updated_count += 1
                logger.info(f"✅ Added topic '{bank['topic_name']}' to {subject_name} Ch.{chapter_number}")
        
        logger.info(f"\n📊 Topic Migration Summary:")
        logger.info(f"   ✅ Added {updated_count} topics to curriculum")
        
    except Exception as e:
        logger.error(f"❌ Topic migration failed: {e}")
        import traceback
        traceback.print_exc()


async def main():
    """Run all migrations"""
    logger.info("🚀 Starting curriculum migration...")
    
    await mongodb.connect()
    
    logger.info("\n📚 Step 1: Migrating subjects and chapters from books...")
    await migrate_subjects_from_books()
    
    logger.info("\n📝 Step 2: Migrating topics from question bank...")
    await migrate_topics_from_question_bank()
    
    logger.info("\n✅ Migration complete!")
    
    await mongodb.close()


if __name__ == "__main__":
    asyncio.run(main())
