# Quick Start Guide: Curriculum Management System

## What's New?

A comprehensive Subject/Chapter/Topic management system has been added to organize your academic content hierarchically. This provides:

**Centralized curriculum structure**  
**Easy subject, chapter, and topic management**  
**Visual organization with icons and colors**  
**Integration with existing book and question systems**  
**Admin-friendly interface**

## File Changes

### Backend (New Files)
- `backend/app/models/curriculum_models.py` - Data models for subjects/chapters/topics
- `backend/app/routers/curriculum.py` - API endpoints for curriculum management
- `backend/scripts/migrate_curriculum.py` - Migration script to populate from existing data
- `backend/CURRICULUM_README.md` - Comprehensive documentation

### Backend (Modified Files)
- `backend/app/main.py` - Added curriculum router registration

### Frontend (New Files)
- `frontend/src/pages/SubjectsManagement.jsx` - Main management interface

### Frontend (Modified Files)
- `frontend/src/App.jsx` - Added route for `/subjects-management`
- `frontend/src/components/AdminLayout.jsx` - Added "Subjects" navigation item
- `frontend/src/constants/academicConstants.js` - Added curriculum API utilities

## Quick Start (3 Steps)

### Step 1: Run Migration (Optional but Recommended)

Populate the curriculum from your existing books and questions:

```bash
cd backend
python -m scripts.migrate_curriculum
```

This will:
- Create subjects from your existing book data
- Add chapters with proper numbering
- Link topics from your question bank
- Set up initial structure

### Step 2: Access the Interface

1. Start your backend server (if not running):
   ```bash
   cd backend
   python run.py
   ```

2. Start your frontend (if not running):
   ```bash
   cd frontend
   npm run dev
   ```

3. Login as admin and navigate to **"Subjects"** in the sidebar

### Step 3: Manage Your Curriculum

**Add a New Subject:**
1. Click "Add Subject" button
2. Enter subject name (e.g., "Physics")
3. Select class level (5-12)
4. Choose an icon and color
5. Add description (optional)
6. Click "Create Subject"

**Add Chapters:**
1. Click "View & Edit Chapters" on a subject card
2. Use the chapter form at the top
3. Enter chapter number and name
4. Click "Add"

**Add Topics:**
1. Expand a chapter by clicking on it
2. Enter topic name, page range, and difficulty
3. Click the green plus button to add

## Features at a Glance

### Subject Cards
- Visual icons and custom colors
- Chapter and topic counts
- Quick access to edit chapters
- Delete with confirmation

### Chapter Management
- Hierarchical view (collapsible)
- Chapter numbering
- Topic lists within each chapter
- Inline topic creation

### Topic Management
- Page ranges for textbook reference
- Difficulty levels (easy/medium/hard)
- Question counts (from question bank)
- Learning objectives and keywords

### Search & Filter
- Search subjects by name
- Filter by class level (5-12)
- Real-time updates

## API Integration

### Frontend Usage

```javascript
import { fetchCurriculumSubjects, fetchSubjectDetails } from '../constants/academicConstants';

// Get all subjects for Class 10
const subjects = await fetchCurriculumSubjects(10);

// Get subject with full details
const details = await fetchSubjectDetails('mathematics_10');
```

### Backend Usage

```python
from app.db.mongo import mongodb
from app.models.curriculum_models import SUBJECTS_COLLECTION

collection = mongodb.db[SUBJECTS_COLLECTION]
subject = await collection.find_one({"subject_id": "mathematics_10"})
```

## Common Tasks

### Update Existing Book References

Your existing book management page still works! The curriculum system complements it:
- Books store PDFs and generate embeddings
- Curriculum provides organizational structure
- Both systems work together seamlessly

### Link Questions to Topics

Questions in your question bank can reference curriculum topics:
```python
question = {
    "topic_id": "real_numbers_intro",  # From curriculum
    "question_text": "What is a real number?",
    # ... other fields
}
```

### Create Tests from Curriculum

When creating tests, you can now:
1. Select a subject from curriculum
2. Choose a chapter
3. Pick specific topics
4. Generate questions for those topics

## Navigation

Access the Subjects Management page:
- **Admin Sidebar**: Click "Subjects" (Layers icon)
- **Direct URL**: `/subjects-management`
- **Position**: Between "Student Groups" and "Books"

## Troubleshooting

**"No subjects found"**
- Run the migration script to populate from existing data
- Or manually add subjects using "Add Subject" button

**"API not responding"**
- Ensure backend server is running
- Check console for errors
- Verify API_URL in environment variables

**"Changes not saving"**
- Check network tab for API errors
- Verify you're logged in as admin
- Check backend logs for error messages

## Next Steps

1. Run migration to populate initial data
2. Review auto-created subjects
3. Add missing chapters or topics
4. Customize icons and colors for subjects
5. Add learning objectives and keywords to topics
6. Link questions to curriculum topics
7. Create tests using the new structure

## Need Help?

- Read the full documentation: `backend/CURRICULUM_README.md`
- Check API endpoints: Navigate to `/docs` on your backend server
- Review the code: `frontend/src/pages/SubjectsManagement.jsx`

---

**Enjoy your new Curriculum Management System! 🎓**
