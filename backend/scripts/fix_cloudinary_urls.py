from app.db.mongo import db

# Find all books with Cloudinary URLs
books = list(db.books.find({"cloudinary_public_id": {"$exists": True}}))

print(f"Found {len(books)} books with Cloudinary URLs\n")

for book in books:
    old_url = book.get('cloudinary_url', '')
    public_id = book.get('cloudinary_public_id', '')
    
    if old_url and public_id:
        # Generate the correct URL with v1
        new_url = f"https://res.cloudinary.com/do776tbxr/raw/upload/v1/{public_id}.pdf"
        
        print(f"Book: {book.get('title', 'Unknown')}")
        print(f"  Old URL: {old_url}")
        print(f"  New URL: {new_url}")
        
        # Update the URL
        db.books.update_one(
            {"_id": book["_id"]},
            {"$set": {"cloudinary_url": new_url, "pdf_url": new_url}}
        )
        print("  ✓ Updated\n")

print("All URLs updated successfully!")
