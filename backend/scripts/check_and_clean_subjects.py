"""
Check and clean subjects database
Shows all subjects (active and inactive) and allows selective deletion
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.mongo import mongodb

async def check_and_clean():
    """Check database and clean if needed"""
    
    # Connect to MongoDB
    await mongodb.connect()
    
    subjects_collection = mongodb.get_collection("subjects")
    
    # Get all subjects (active and inactive)
    all_subjects = await subjects_collection.find({}).to_list(length=None)
    
    print(f"\n{'='*70}")
    print(f"Total documents in subjects collection: {len(all_subjects)}")
    print(f"{'='*70}\n")
    
    if len(all_subjects) == 0:
        print("✓ Database is clean - no subjects found")
    else:
        print("Found subjects:\n")
        for idx, subj in enumerate(all_subjects, 1):
            active_status = "✓ ACTIVE" if subj.get("is_active", True) else "✗ INACTIVE"
            print(f"{idx}. {active_status} | {subj.get('subject_name')} - Class {subj.get('class_level')} | ID: {subj.get('subject_id')}")
        
        print(f"\n{'='*70}")
        choice = input("\nWhat would you like to do?\n1. Delete ALL subjects\n2. Delete only INACTIVE subjects\n3. Exit without changes\n\nChoice (1/2/3): ")
        
        if choice == "1":
            result = await subjects_collection.delete_many({})
            print(f"\n✓ Deleted ALL {result.deleted_count} subjects")
        elif choice == "2":
            result = await subjects_collection.delete_many({"is_active": False})
            print(f"\n✓ Deleted {result.deleted_count} inactive subjects")
            remaining = await subjects_collection.count_documents({})
            print(f"  Remaining active subjects: {remaining}")
        else:
            print("\n✓ No changes made")
    
    # Close MongoDB connection
    await mongodb.close()

if __name__ == "__main__":
    print("\n" + "="*70)
    print("Subject Database Inspector & Cleaner")
    print("="*70)
    
    asyncio.run(check_and_clean())
