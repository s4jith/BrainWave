"""
Migration: Rename "Mathematics" → "Maths" in all MongoDB collections.
Run once from the backend directory:
    python scripts/migrate_mathematics_to_maths.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.mongo import db

COLLECTIONS = [
    ("questions",       "subject"),
    ("books",           "subject"),
    ("groups",          "subject"),
    ("question_papers", "subject"),
    ("question_bank",   "subject"),
]

def migrate():
    total = 0
    # Access raw pymongo database for collections not exposed as SyncMongoDB properties
    raw_db = db.db
    for collection_name, field in COLLECTIONS:
        col = raw_db[collection_name]
        result = col.update_many(
            {field: "Mathematics"},
            {"$set": {field: "Maths"}}
        )
        print(f"  {collection_name}.{field}: {result.modified_count} documents updated")
        total += result.modified_count

    print(f"\nDone — {total} total documents updated.")

if __name__ == "__main__":
    print("Migrating 'Mathematics' → 'Maths' in MongoDB...\n")
    migrate()
