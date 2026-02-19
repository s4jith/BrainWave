"""
Initialize basic subjects in curriculum database
Adds Mathematics, Physics, and Chemistry for classes 6-12
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.mongo import mongodb

async def init_basic_subjects():
    """Initialize Mathematics, Physics, and Chemistry for classes 6-12"""
    
    # Connect to MongoDB
    await mongodb.connect()
    
    subjects_collection = mongodb.get_collection("subjects")
    
    # Define core subjects
    subjects_data = [
        {
            "subject_name": "Mathematics",
            "icon": "calculator",
            "color": "#3B82F6"
        },
        {
            "subject_name": "Physics",
            "icon": "atom",
            "color": "#8B5CF6"
        },
        {
            "subject_name": "Chemistry",
            "icon": "flask-conical",
            "color": "#10B981"
        },
        {
            "subject_name": "English",
            "icon": "book-open",
            "color": "#F59E0B"
        },
        {
            "subject_name": "Hindi",
            "icon": "languages",
            "color": "#EF4444"
        }
    ]
    
    # Classes 6-12
    classes = [6, 7, 8, 9, 10, 11, 12]
    
    inserted_count = 0
    updated_count = 0
    
    for subject_data in subjects_data:
        for class_level in classes:
            subject_id = f"{subject_data['subject_name'].lower()}_{class_level}"
            
            # Check if already exists
            existing = await subjects_collection.find_one({"subject_id": subject_id})
            
            if existing:
                # Update to ensure is_active is true
                await subjects_collection.update_one(
                    {"subject_id": subject_id},
                    {"$set": {"is_active": True}}
                )
                updated_count += 1
                print(f"✓ Updated: {subject_data['subject_name']} - Class {class_level}")
            else:
                # Create new subject document
                doc = {
                    "subject_id": subject_id,
                    "subject_name": subject_data['subject_name'],
                    "class_level": class_level,
                    "icon": subject_data['icon'],
                    "color": subject_data['color'],
                    "chapters": [],
                    "is_active": True
                }
                
                await subjects_collection.insert_one(doc)
                inserted_count += 1
                print(f"✓ Created: {subject_data['subject_name']} - Class {class_level}")
    
    print(f"\n{'='*50}")
    print(f"Summary:")
    print(f"  Subjects created: {inserted_count}")
    print(f"  Subjects updated: {updated_count}")
    print(f"  Total subjects: {inserted_count + updated_count}")
    print(f"{'='*50}")
    
    # Display all subjects
    print("\nCurrent subjects in database:")
    all_subjects = await subjects_collection.find(
        {"is_active": True},
        {"subject_id": 1, "subject_name": 1, "class_level": 1}
    ).sort([("class_level", 1), ("subject_name", 1)]).to_list(length=None)
    
    for subj in all_subjects:
        print(f"  • {subj['subject_name']} - Class {subj['class_level']} (ID: {subj['subject_id']})")
    
    # Close MongoDB connection
    await mongodb.close()

if __name__ == "__main__":
    print("Initializing basic subjects (Mathematics, Physics, Chemistry for Classes 6-12)...\n")
    asyncio.run(init_basic_subjects())
    print("\n✓ Initialization complete!")
