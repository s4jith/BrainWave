"""Script to fix the Cloudinary URL for the uploaded book"""
from dotenv import load_dotenv
load_dotenv()

import os
from pymongo import MongoClient
import cloudinary
import cloudinary.api

# Connect to MongoDB - correct database name
client = MongoClient(os.getenv('MONGO_URI'))
db = client['ncert_learning_db']

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key=os.getenv('CLOUDINARY_API_KEY'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET'),
    secure=True
)

# Find all books
books = list(db.books.find({}))
print(f"Found {len(books)} books total")

for book in books:
    print(f"\nBook: {book.get('title')}")
    print(f"  Subject: {book.get('subject')}, Class: {book.get('class_level')}")
    print(f"  Current pdf_url: {book.get('pdf_url', 'N/A')}")
    print(f"  Cloudinary public_id: {book.get('cloudinary_public_id', 'N/A')}")
    
    # Try to get the correct URL from Cloudinary
    public_id = book.get('cloudinary_public_id')
    if public_id:
        try:
            # Get resource info from Cloudinary
            info = cloudinary.api.resource(public_id, resource_type='raw')
            correct_url = info.get('secure_url')
            print(f"  Correct URL from Cloudinary: {correct_url}")
            
            # Update the book record
            db.books.update_one(
                {"_id": book["_id"]},
                {"$set": {
                    "pdf_url": correct_url,
                    "cloudinary_url": correct_url
                }}
            )
            print("  ✅ Book record updated!")
        except Exception as e:
            print(f"  ❌ Error: {e}")
    else:
        print("  ⚠️ No cloudinary_public_id found")
