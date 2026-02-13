"""
Clear all subjects from curriculum database
Use this to start fresh and let admins create subjects manually through UI
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.mongo import mongodb

async def clear_subjects():
    """Remove all subjects from the curriculum database"""
    
    # Connect to MongoDB
    await mongodb.connect()
    
    subjects_collection = mongodb.get_collection("subjects")
    
    # Count current subjects
    count = await subjects_collection.count_documents({})
    print(f"Current subjects in database: {count}")
    
    if count == 0:
        print("Database is already empty!")
    else:
        # Ask for confirmation
        confirm = input(f"\nAre you sure you want to delete all {count} subjects? (yes/no): ")
        
        if confirm.lower() == 'yes':
            # Delete all subjects
            result = await subjects_collection.delete_many({})
            print(f"\n✓ Deleted {result.deleted_count} subjects")
            print("Database is now clean! Admins can create subjects through the UI.")
        else:
            print("\nOperation cancelled.")
    
    # Close MongoDB connection
    await mongodb.close()

if __name__ == "__main__":
    print("=" * 60)
    print("Clear Curriculum Database")
    print("=" * 60)
    print("\nThis script will delete ALL subjects, chapters, and topics")
    print("from the curriculum database.\n")
    
    asyncio.run(clear_subjects())
