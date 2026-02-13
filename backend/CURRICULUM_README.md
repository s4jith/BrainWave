# Curriculum Management System

## Overview

The Curriculum Management System provides a centralized, hierarchical structure for organizing academic content across subjects, chapters, and topics. This replaces the previous ad-hoc approach where subjects and chapters were scattered across different collections.

## Architecture

### Data Hierarchy

```
Subject (Class 10 - Mathematics)
├── Chapter 1: Real Numbers
│   ├── Topic 1.1: Introduction to Real Numbers
│   ├── Topic 1.2: Euclid's Division Lemma
│   └── Topic 1.3: The Fundamental Theorem of Arithmetic
├── Chapter 2: Polynomials
│   ├── Topic 2.1: Introduction to Polynomials
│   └── Topic 2.2: Geometrical Meaning of Zeroes
└── ...
```

### Collections

#### `subjects` Collection
Stores the complete curriculum structure for each subject-class combination.

**Document Structure:**
```javascript
{
  subject_id: "mathematics_10",
  subject_name: "Mathematics",
  class_level: 10,
  board: "CBSE",
  description: "Class 10 Mathematics curriculum",
  icon: "📐",
  color: "#3B82F6",
  chapters: [
    {
      chapter_id: "mathematics_10_ch1",
      chapter_number: 1,
      chapter_name: "Real Numbers",
      description: "Introduction to real numbers...",
      topics: [
        {
          topic_id: "real_numbers_intro",
          topic_name: "Introduction to Real Numbers",
          description: "Basic concepts of real numbers",
          page_range: "1-5",
          learning_objectives: ["Understand real numbers", "..."],
          keywords: ["real numbers", "rational", "irrational"],
          estimated_time_minutes: 45,
          difficulty_level: "medium",
          prerequisites: [],
          order: 1,
          is_active: true,
          question_count: 15
        }
      ],
      pdf_url: "https://...",
      video_url: "",
      total_pages: 20,
      order: 1,
      is_active: true
    }
  ],
  total_topics: 25,
  total_chapters: 15,
  is_active: true,
  created_at: ISODate("..."),
  updated_at: ISODate("...")
}
```

## API Endpoints

### Subjects

- **GET** `/api/curriculum/subjects` - Get all subjects
  - Query params: `class_level`, `is_active`
  - Returns: Array of subject summaries

- **GET** `/api/curriculum/subjects/{subject_id}` - Get subject details
  - Returns: Complete subject with chapters and topics

- **POST** `/api/curriculum/subjects` - Create new subject
  - Body: `CreateSubjectRequest`

- **PUT** `/api/curriculum/subjects/{subject_id}` - Update subject
  - Body: `UpdateSubjectRequest`

- **DELETE** `/api/curriculum/subjects/{subject_id}` - Delete subject (soft delete)

### Chapters

- **GET** `/api/curriculum/subjects/{subject_id}/chapters` - Get all chapters

- **POST** `/api/curriculum/subjects/{subject_id}/chapters` - Create chapter
  - Body: `CreateChapterRequest`

- **PUT** `/api/curriculum/subjects/{subject_id}/chapters/{chapter_id}` - Update chapter
  - Body: `UpdateChapterRequest`

- **DELETE** `/api/curriculum/subjects/{subject_id}/chapters/{chapter_id}` - Delete chapter

### Topics

- **GET** `/api/curriculum/subjects/{subject_id}/chapters/{chapter_id}/topics` - Get topics

- **POST** `/api/curriculum/subjects/{subject_id}/chapters/{chapter_id}/topics` - Create topic
  - Body: `CreateTopicRequest`

- **PUT** `/api/curriculum/subjects/{subject_id}/chapters/{chapter_id}/topics/{topic_id}` - Update topic
  - Body: `UpdateTopicRequest`

- **DELETE** `/api/curriculum/subjects/{subject_id}/chapters/{chapter_id}/topics/{topic_id}` - Delete topic

## Frontend Components

### SubjectsManagement Page

Location: `frontend/src/pages/SubjectsManagement.jsx`

**Features:**
- View all subjects organized by class
- Search subjects
- Filter by class level
- Add new subjects with custom icons and colors
- View and edit chapters within subjects
- Add topics to chapters with difficulty levels
- Hierarchical expansion for chapters/topics
- Visual subject cards with statistics

**Access:** Admin only via `/subjects-management`

### Navigation

The Subjects page is accessible from:
- Admin sidebar: "Subjects" menu item (Layers icon)
- Direct URL: `/subjects-management`

## Integration with Existing Systems

### Book Management
The new curriculum system complements the existing book management:
- Books are still stored in the `books` collection with PDFs and embeddings
- Curriculum provides the organizational structure
- Book chapters can reference curriculum chapters via `chapter_id`

### Question Bank
Questions are linked to curriculum topics:
- `topic_question_bank` collection references curriculum `topic_id`
- Topics in curriculum display question counts
- Question generation uses curriculum structure

### Test Management
Tests can be created based on curriculum structure:
- Select subject → chapter → topic
- Pre-generated questions from curriculum
- Student performance tracked by topic

### Group Management
Student groups are organized by subject and class:
- Groups reference curriculum subjects
- Group naming: `Subject_ClassX_Year`
- Teachers assigned to specific subject groups

## Migration

### Initial Setup

Run the migration script to populate the curriculum from existing data:

```bash
cd backend
python -m scripts.migrate_curriculum
```

This will:
1. Scan the `books` collection for subject/class/chapter data
2. Create subjects in the `subjects` collection
3. Scan `topic_question_bank` for topics
4. Add topics to appropriate chapters
5. Set question counts for topics

### Manual Setup

Alternatively, use the UI to manually create subjects:
1. Navigate to `/subjects-management`
2. Click "Add Subject"
3. Fill in subject details (name, class, icon, color)
4. Add chapters using the chapter form
5. Expand chapters and add topics

## Usage Examples

### Frontend: Fetching Subjects

```javascript
import { fetchCurriculumSubjects, fetchSubjectDetails } from '../constants/academicConstants';

// Get all subjects for Class 10
const subjects = await fetchCurriculumSubjects(10);

// Get detailed subject with chapters and topics
const mathDetails = await fetchSubjectDetails('mathematics_10');
```

### Backend: Querying Curriculum

```python
from app.db.mongo import mongodb
from app.models.curriculum_models import SUBJECTS_COLLECTION

# Get subject
subjects_collection = mongodb.db[SUBJECTS_COLLECTION]
subject = await subjects_collection.find_one({"subject_id": "mathematics_10"})

# Get specific chapter
chapter = next(
    (ch for ch in subject["chapters"] if ch["chapter_number"] == 1),
    None
)

# Get topics for chapter
topics = chapter["topics"]
```

## Best Practices

1. **Consistent Naming**: Use descriptive names for subjects, chapters, and topics
2. **Page Ranges**: Always specify page ranges for topics (e.g., "10-15")
3. **Learning Objectives**: Add clear learning objectives for each topic
4. **Keywords**: Tag topics with relevant keywords for searchability
5. **Difficulty Levels**: Assign appropriate difficulty (easy/medium/hard)
6. **Prerequisites**: Link topics that require prior knowledge

## Maintenance

### Adding New Content

1. **New Subject**: Use "Add Subject" button in UI
2. **New Chapter**: Expand subject and use chapter form
3. **New Topic**: Expand chapter and add topic with metadata

### Updating Content

1. Click edit icon next to subject/chapter/topic
2. Modify fields and save
3. Changes reflect immediately

### Deleting Content

- Deletion is soft delete (sets `is_active: false`)
- Content remains in database but hidden from students
- Can be restored by updating `is_active: true`

## Future Enhancements

- [ ] Bulk import from CSV/Excel
- [ ] Topic prerequisites visualization
- [ ] Learning path recommendations
- [ ] Content review workflow
- [ ] Version history for curriculum changes
- [ ] Multi-language support for content
- [ ] Integration with external content providers
- [ ] AI-assisted topic generation from PDFs

## Troubleshooting

**Issue**: Subjects not appearing in dropdown
- Check `is_active: true` in database
- Verify API endpoint is accessible
- Check browser console for errors

**Issue**: Topics not linking to questions
- Ensure `topic_id` matches between curriculum and question bank
- Run migration script to sync data
- Verify question bank has questions for the topic

**Issue**: Chapters out of order
- Check `order` field in chapter documents
- Re-order using UI edit functionality
- Sort query results by `chapter_number` or `order`

## Support

For issues or questions:
- Check API logs: `backend/logs/`
- Review browser console for frontend errors
- Run migration script to fix data inconsistencies
- Contact development team

---

**Version**: 1.0.0  
**Last Updated**: February 2026  
**Maintainer**: Development Team
