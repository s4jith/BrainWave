"""
Fix MongoDB books namespace from 'mathematics' to 'maths'
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.mongo import db

# Update all books with mathematics namespace to maths
result = db.books.update_many(
    {"embedding_namespace": "mathematics"},
    {"$set": {"embedding_namespace": "maths"}}
)

print(f"Updated {result.modified_count} books from 'mathematics' to 'maths' namespace")

# Verify
count = db.books.count_documents({"embedding_namespace": "maths"})
print(f"📊 Total books with 'maths' namespace: {count}")
