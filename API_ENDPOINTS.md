# NCERT AI Learning Platform — API Endpoints Reference

> **Auto-generated structured summary of all 20 router files.**
> Base URL: `http://localhost:8000`

---

## Table of Contents

1. [Book Management](#1-book-management) — `book_management.py`
2. [Curriculum Management](#2-curriculum-management) — `curriculum.py`
3. [User Stats](#3-user-stats) — `user.py`
4. [Student](#4-student) — `student.py`
5. [Student Profile](#5-student-profile) — `student_level.py`
6. [Teacher](#6-teacher) — `teacher.py`
7. [Tests (AI / QB / Staff)](#7-tests-ai--qb--staff) — `test.py`
8. [Test Management](#8-test-management) — `test_management.py`
9. [Support](#9-support) — `support.py`
10. [Support Tickets](#10-support-tickets) — `support_tickets.py`
11. [Suggestions](#11-suggestions) — `suggestions.py`
12. [Notifications](#12-notifications) — `notifications.py`
13. [Question Bank](#13-question-bank) — `question_bank.py`
14. [Question Papers](#14-question-papers) — `question_papers.py`
15. [Queries](#15-queries) — `queries.py`
16. [Head Approval](#16-head-approval) — `head_approval.py`
17. [Top Questions](#17-top-questions) — `top_questions.py`
18. [Courses](#18-courses) — `courses.py`
19. [Assessments](#19-assessments) — `assessments.py`
20. [Gradebook](#20-gradebook) — `gradebook.py`

---

## Mounting Info (from `main.py`)

| Router file | Router prefix in file | Mounted with | **Resolved base path** |
|---|---|---|---|
| book_management | `/api/books` | `app.include_router(books_router)` | `/api/books` |
| curriculum | `/api/curriculum` | `app.include_router(curriculum_router)` | `/api/curriculum` |
| user | `/user` | `app.include_router(user_router, prefix="/api")` | `/api/user` |
| student | `/api/student` | `app.include_router(student_router)` | `/api/student` |
| student_level | `/api/v1/student` | `app.include_router(student_level_router)` | `/api/v1/student` |
| teacher | `/api/teacher` | `app.include_router(teacher_router)` | `/api/teacher` |
| test | `/test` | `app.include_router(test_router, prefix="/api")` | `/api/test` |
| test_management | `/api/tests` | `app.include_router(test_management_router)` | `/api/tests` |
| support | `/api/support` | `app.include_router(support_router)` | `/api/support` |
| support_tickets | `/api/support-tickets` | `app.include_router(support_tickets_router)` | `/api/support-tickets` |
| suggestions | `/suggestions` | `app.include_router(suggestions_router, prefix="/api")` | `/api/suggestions` |
| notifications | `/api/notifications` | `app.include_router(notifications_router)` | `/api/notifications` |
| question_bank | `/api/question-bank` | `app.include_router(question_bank_router)` | `/api/question-bank` |
| question_papers | `/api/question-papers` | `app.include_router(question_papers_router)` | `/api/question-papers` |
| queries | `/api/queries` | `app.include_router(queries_router)` | `/api/queries` |
| head_approval | `/api/head` | `app.include_router(head_approval_router)` | `/api/head` |
| top_questions | `/api/top-questions` | `app.include_router(top_questions_router)` | `/api/top-questions` |
| courses | `/api/courses` | `app.include_router(courses_router)` | `/api/courses` |
| assessments | `/api/assessments` | `app.include_router(assessments_router)` | `/api/assessments` |
| gradebook | `/api/gradebook` | `app.include_router(gradebook_router)` | `/api/gradebook` |

---

## Auth System

| Dependency | Description |
|---|---|
| `get_current_user` | Extracts and validates JWT token from `Authorization: Bearer <token>` header. Returns `TokenData`. |
| `require_role([UserRole.X, ...])` | Validates JWT **and** checks the user's role is one of the allowed roles. Roles: `STUDENT`, `TEACHER`, `HEAD`, `ADMIN`. |
| `require_permission(Permission.X)` | Validates JWT **and** checks the user has a specific permission (derived from their role). |

**Permission Enum** (used by courses, assessments, gradebook):
```
CREATE_COURSE, UPDATE_COURSE, DELETE_COURSE, PUBLISH_COURSE
CREATE_MODULE, UPLOAD_CONTENT, ENROLL_COURSE
CREATE_ASSESSMENT, UPDATE_ASSESSMENT, DELETE_ASSESSMENT, TAKE_ASSESSMENT
GRADE_SUBMISSION, VIEW_CLASS_ANALYTICS, EXPORT_DATA
```

---

## 1. Book Management

**File:** `backend/app/routers/book_management.py` (1 819 lines)  
**Router:** `APIRouter(prefix="/api/books", tags=["Book Management"])`  
**Resolved Base:** `/api/books`  
**Auth:** None (all public)

### Pydantic Models

```
BookCreate:
  title: str
  subject: str
  class_level: int
  description: Optional[str]

ChapterCreate:
  book_id: str
  chapter_number: int
  title: str
  description: Optional[str]

BookResponse:
  id, title, subject, class_level, description,
  pdf_filename, pdf_url, has_embeddings, embedding_count,
  chapters: List[dict], created_at, updated_at
```

### Endpoints

| # | Method | Path | Function | Parameters | Notes |
|---|---|---|---|---|---|
| 1 | `POST` | `/upload` | `upload_book()` | Form: title, subject, class_level, chapter_number, description, generate_embeddings; File: pdf_file | Uploads PDF to Cloudinary, stores in MongoDB |
| 2 | `POST` | `/{book_id}/regenerate-embeddings` | `regenerate_embeddings(book_id)` | Path: book_id | Re-generates Pinecone embeddings |
| 3 | `POST` | `/{book_id}/chapters` | `add_chapter(book_id, chapter)` | Path: book_id; Body: ChapterCreate | |
| 4 | `GET` | `/admin/list` | `list_all_books()` | — | Returns `{books[], total}` |
| 5 | `DELETE` | `/{book_id}` | `delete_book(book_id)` | Path: book_id; Query: delete_embeddings(bool=True) | |
| 6 | `POST` | `/{book_id}/generate-embeddings` | `generate_embeddings(book_id)` | Path: book_id | |
| 7 | `PUT` | `/{book_id}/embeddings-status` | `update_embedding_status(book_id)` | Query: has_embeddings, embedding_count | |
| 8 | `GET` | `/student/subjects` | `get_available_subjects()` | Query: class_level, student_id? | |
| 9 | `GET` | `/student/books` | `get_books_for_student()` | Query: class_level, subject | |
| 10 | `GET` | `/flashcards` | `generate_flashcards()` | Query: subject, class_level, count | AI-generated via Gemini |
| 11 | `GET` | `/notes/generate` | `generate_smart_notes()` | Query: subject, class_level, chapter? | AI-generated notes |
| 12 | `POST` | `/notes/save` | `save_smart_notes()` | Body: user_id, subject, class_level, title, content | |
| 13 | `GET` | `/notes/{user_id}` | `get_user_notes(user_id)` | Query: subject?, limit | |
| 14 | `GET` | `/student/lessons` | `get_lessons_for_student()` | Query: class_level, subject | |
| 15 | `GET` | `/pdf/{file_path:path}` | `serve_pdf(file_path)` | Path: file_path | Serves PDF with CORS |
| 16 | `GET` | `/pdf-page/{file_path:path}` | `render_pdf_page(file_path)` | Query: page, scale | Renders as PNG via PyMuPDF |
| 17 | `GET` | `/pdf-info/{file_path:path}` | `get_pdf_info(file_path)` | — | `{numPages, title, author}` |
| 18 | `GET` | `/render/{book_id}/info` | `get_book_pdf_info(book_id)` | Path: book_id | Downloads from Cloudinary if needed |
| 19 | `GET` | `/render/{book_id}/page/{page_number}` | `render_book_pdf_page(book_id, page_number)` | Query: scale | Renders page as PNG |
| 20 | `POST` | `/admin/sync-existing` | `sync_existing_books()` | — | Seeds Math Class 6 books |
| 21 | `GET` | `/admin/pinecone-stats` | `get_pinecone_stats()` | — | Pinecone index stats |
| 22 | `POST` | `/admin/fix-missing-fields` | `fix_missing_fields()` | — | Migration fix |
| 23 | `GET` | `/admin/hierarchical-structure` | `get_hierarchical_structure()` | — | Pinecone namespace tree |
| 24 | `DELETE` | `/admin/delete-subject/{subject}` | `delete_subject(subject)` | Query: confirmation | Deletes Pinecone namespace + MongoDB |
| 25 | `DELETE` | `/admin/delete-class/{subject}/{class_level}` | `delete_class(subject, class_level)` | Query: confirmation | |
| 26 | `DELETE` | `/admin/delete-chapter/{subject}/{class_level}/{chapter_number}` | `delete_chapter(...)` | Query: confirmation | |

---

## 2. Curriculum Management

**File:** `backend/app/routers/curriculum.py` (1 380 lines)  
**Router:** `APIRouter(prefix="/api/curriculum", tags=["Curriculum Management"])`  
**Resolved Base:** `/api/curriculum`  
**Auth:** None (all public)

### Pydantic Models

Imported from `app.models.curriculum_models`:
```
Subject, Chapter, Topic
CreateSubjectRequest, UpdateSubjectRequest
CreateChapterRequest, UpdateChapterRequest
CreateTopicRequest, UpdateTopicRequest
SubjectSummary, ChapterSummary, TopicSummary
PendingCurriculumItem, ExtractedChapter
```

Local:
```
UpdateChapterSummaryRequest:
  summary: str
```

### Endpoints

| # | Method | Path | Function | Parameters | Response Model |
|---|---|---|---|---|---|
| 1 | `GET` | `/subjects` | `get_all_subjects()` | Query: class_level?, is_active? | `List[SubjectSummary]` |
| 2 | `GET` | `/subjects/{subject_id}` | `get_subject_details(subject_id)` | — | `Subject` |
| 3 | `POST` | `/subjects` | `create_subject(request)` | Body: CreateSubjectRequest | `Subject` |
| 4 | `PUT` | `/subjects/{subject_id}` | `update_subject(subject_id, request)` | Body: UpdateSubjectRequest | `Subject` |
| 5 | `DELETE` | `/subjects/{subject_id}` | `delete_subject(subject_id)` | — | `{success, message}` |
| 6 | `GET` | `/subjects/{subject_id}/chapters` | `get_chapters(subject_id)` | — | `List[ChapterSummary]` |
| 7 | `POST` | `/subjects/{subject_id}/chapters` | `create_chapter(subject_id, request)` | Body: CreateChapterRequest | `Chapter` |
| 8 | `PUT` | `/subjects/{subject_id}/chapters/{chapter_id}` | `update_chapter(...)` | Body: UpdateChapterRequest | `Chapter` |
| 9 | `DELETE` | `/subjects/{subject_id}/chapters/{chapter_id}` | `delete_chapter(...)` | — | `{success}` |
| 10 | `PUT` | `/subjects/{subject_id}/chapters/{chapter_id}/summary` | `update_chapter_summary(...)` | Body: UpdateChapterSummaryRequest | `{success}` |
| 11 | `GET` | `/subjects/{subject_id}/chapters/{chapter_id}/summary` | `get_chapter_summary(...)` | — | `{chapter_id, chapter_name, summary, has_summary}` |
| 12 | `GET` | `/chapter-summary-by-book` | `get_chapter_summary_by_book()` | Query: subject_name, class_level, chapter_number | `{summary, has_summary}` |
| 13 | `GET` | `/subjects/{subject_id}/chapters/{chapter_id}/topics` | `get_topics(...)` | — | `List[TopicSummary]` |
| 14 | `POST` | `/subjects/{subject_id}/chapters/{chapter_id}/topics` | `create_topic(...)` | Body: CreateTopicRequest | `Topic` |
| 15 | `PUT` | `/subjects/{subject_id}/chapters/{chapter_id}/topics/{topic_id}` | `update_topic(...)` | Body: UpdateTopicRequest | `Topic` |
| 16 | `DELETE` | `/subjects/{subject_id}/chapters/{chapter_id}/topics/{topic_id}` | `delete_topic(...)` | — | `{success}` (soft delete) |
| 17 | `GET` | `/available-books` | `get_available_books()` | — | `{subjects[], classes[], subject_class_map}` |
| 18 | `POST` | `/extract-from-upload` | `extract_curriculum_from_upload()` | Form: subject_name, class_level, board, uploaded_by; File: file (PDF/image) | `PendingCurriculumItem` |
| 19 | `GET` | `/pending` | `get_pending_curriculum_items()` | Query: status? | `List[PendingCurriculumItem]` |
| 20 | `GET` | `/pending/{pending_id}` | `get_pending_curriculum_item(pending_id)` | — | `PendingCurriculumItem` |
| 21 | `PUT` | `/pending/{pending_id}` | `update_pending_curriculum_item(pending_id)` | Form: subject_name?, class_level?, extracted_chapters?(JSON) | `PendingCurriculumItem` |
| 22 | `POST` | `/pending/{pending_id}/approve` | `approve_or_reject_pending_item(pending_id)` | Form: action, reviewed_by, rejection_reason?, subject_name_override?, icon?, color? | Creates subject if approved |
| 23 | `DELETE` | `/pending/{pending_id}` | `delete_pending_item(pending_id)` | — | `{success}` |

---

## 3. User Stats

**File:** `backend/app/routers/user.py` (~278 lines)  
**Router:** `APIRouter(prefix="/user", tags=["User Stats"])`  
**Resolved Base:** `/api/user`  
**Auth:** None

### Pydantic Models

```
DailyActivity: day, active, hours, date
StreakData: current_streak, longest_streak, weekly_activity: List[DailyActivity], last_activity_date
ProgressData: overall_progress, total_tests, completed_tests, total_chapters, completed_chapters, average_score
NoteSummary: id, title, lesson, date, subject
DashboardData: streak: StreakData, progress: ProgressData, recent_notes: List[NoteSummary], total_notes
```

### Endpoints

| # | Method | Path | Function | Parameters | Response Model |
|---|---|---|---|---|---|
| 1 | `GET` | `/streak/{student_id}` | `get_streak_data(student_id)` | — | `StreakData` |
| 2 | `GET` | `/progress/{student_id}` | `get_progress_data(student_id)` | Query: subject? | `ProgressData` |
| 3 | `GET` | `/dashboard/{student_id}` | `get_dashboard_data(student_id)` | Query: subject? | `DashboardData` |
| 4 | `POST` | `/activity/log` | `log_activity()` | Query: student_id, hours(=0.5) | `{message, date, hours_added}` |
| 5 | `GET` | `/analytics/{student_id}` | `get_student_analytics(student_id)` | Query: period(="week") | Analytics dict |

---

## 4. Student

**File:** `backend/app/routers/student.py` (~230 lines)  
**Router:** `APIRouter(prefix="/api/student", tags=["student"])`  
**Resolved Base:** `/api/student`  
**Auth:** All `require_role([STUDENT])`

### Endpoints

| # | Method | Path | Function | Auth | Notes |
|---|---|---|---|---|---|
| 1 | `GET` | `/groups` | `get_student_groups()` | STUDENT | `{groups[]}` |
| 2 | `GET` | `/upcoming-tests` | `get_upcoming_tests()` | STUDENT | `{tests[], total}` |
| 3 | `GET` | `/my-features` | `get_student_features()` | STUDENT | `{features{}}` |
| 4 | `GET` | `/my-subjects` | `get_student_subjects()` | STUDENT | `{subjects[], total}` |

---

## 5. Student Profile

**File:** `backend/app/routers/student_level.py` (~127 lines)  
**Router:** `APIRouter(prefix="/api/v1/student", tags=["Student Profile"])`  
**Resolved Base:** `/api/v1/student`  
**Auth:** None

### Pydantic Models

```
StudentLevel: level: Literal["beginner", "intermediate", "advanced"]
StudentLevelResponse: student_id, level, explanation_mode, updated_at
```

### Endpoints

| # | Method | Path | Function | Parameters | Response Model |
|---|---|---|---|---|---|
| 1 | `GET` | `/level/{student_id}` | `get_student_level(student_id)` | — | `StudentLevelResponse` |
| 2 | `PUT` | `/level/{student_id}` | `update_student_level(student_id)` | Body: StudentLevel | `StudentLevelResponse` |
| 3 | `GET` | `/level/mode-mapping` | `get_mode_mapping()` | — | Static mapping dict |

---

## 6. Teacher

**File:** `backend/app/routers/teacher.py` (583 lines)  
**Router:** `APIRouter(prefix="/api/teacher", tags=["teacher"])`  
**Resolved Base:** `/api/teacher`  
**Auth:** All `require_role([TEACHER, ADMIN])`

### Pydantic Models

```
QuestionCreate:
  text, subject, class_level, chapter, type, difficulty, marks, options, correct_answer

QuestionUpdate:
  (all fields Optional)
```

### Endpoints

| # | Method | Path | Function | Parameters | Notes |
|---|---|---|---|---|---|
| 1 | `GET` | `/groups` | `get_teacher_groups()` | — | `{groups[]}` |
| 2 | `GET` | `/questions` | `get_questions()` | Query: subject?, class_level? | `{questions[]}` |
| 3 | `POST` | `/questions` | `create_question(question)` | Body: QuestionCreate | `{success, id, message}` |
| 4 | `PUT` | `/questions/{question_id}` | `update_question(question_id)` | Body: QuestionUpdate | |
| 5 | `DELETE` | `/questions/{question_id}` | `delete_question(question_id)` | — | |
| 6 | `GET` | `/stats` | `get_teacher_stats()` | — | `{my_questions, my_tests, evaluated, pending}` |
| 7 | `GET` | `/reports` | `get_teacher_reports()` | — | `{total_assessments, total_students, avg_score, pass_rate, ...}` |

---

## 7. Tests (AI / QB / Staff)

**File:** `backend/app/routers/test.py` (2 074 lines)  
**Router:** `APIRouter(prefix="/test", tags=["Tests"])`  
**Resolved Base:** `/api/test`  
**Auth:** None (uses student_id params)

### Pydantic Models

```
SubjectResponse: subject, total_chapters, total_questions
ChapterInfo: chapter_number, chapter_name, total_topics, total_questions, average_score
TopicInfo: topic_id, topic_name, description, page_range, total_questions, difficulty_distribution, student_score, tests_taken, trend, is_weak, is_recommended

StartTestRequest: student_id, class_level, subject, chapter_number, topic_id, num_questions, difficulty
StartTestRequestV2: student_id, class_level, subject, chapter_number, topic_id?, difficulty?, num_questions?
StartAITestRequest: student_id, class_level, subject, chapter_number, topic_ids: List[str], difficulty?, num_questions?
StartChapterTestRequest: student_id, class_level, subject, chapter_number
GenerateQuestionsRequest: class_level, subject, chapter_number, num_questions, difficulty, topic?

StartQBTestRequest:
  student_id, class_level, subject, chapter, difficulty,
  mcq_count, fillup_count, true_false_count,
  short_answer_count, long_answer_count, time_limit_minutes?

SubmitAnswerRequest: session_id, question_id, question_number, answer
CompleteTestRequest: session_id, student_id, answers: List[AnswerItem]

TestQuestionItem: question_number, question_id, question_text, difficulty, question_type, marks, time_estimate, options, correct_option
StartTestResponse: session_id, topic_id, topic_name, questions[], total_questions, time_limit_minutes, started_at

StudentAnalytics:
  total_tests_taken, tests_this_week, overall_average, best_score,
  topics_strong, topics_moderate, topics_weak, weak_topics,
  performance_history, topic_breakdown, recommendations

StaffTestItem: id, subject, chapter, title, description?, due_date?, max_score, question_paper_url, created_by, created_at, submission_status?, score?
```

### Endpoints

| # | Method | Path | Function | Parameters | Notes |
|---|---|---|---|---|---|
| 1 | `GET` | `/subjects/{class_level}` | `get_available_subjects(class_level)` | — | `List[SubjectResponse]` |
| 2 | `GET` | `/chapters/{class_level}/{subject}` | `get_chapters_for_subject(...)` | Query: student_id? | |
| 3 | `GET` | `/topics/{class_level}/{subject}/{chapter}` | `get_topics_for_chapter(...)` | Query: student_id? | |
| 4 | `GET` | `/recommendations/{class_level}/{subject}/{student_id}` | `get_topic_recommendations(...)` | — | |
| 5 | `POST` | `/start-chapter` | `start_chapter_test(request)` | Body: StartChapterTestRequest | `ChapterTestResponse` |
| 6 | `POST` | `/generate-questions` | `generate_questions_on_demand(...)` | Body: GenerateQuestionsRequest | `GenerateQuestionsResponse` |
| 7 | `GET` | `/check-questions/{class_level}/{subject}/{chapter_number}` | `check_questions_available(...)` | — | |
| 8 | `POST` | `/start-v2` | `start_test_v2(request)` | Body: StartTestRequestV2 | `StartTestResponseV2` |
| 9 | `POST` | `/start` | `start_test(request)` | Body: StartTestRequest | `StartTestResponse` |
| 10 | `POST` | `/start-v3` | `start_test_v3(request)` | Body: StartTestRequestV2 | Dict |
| 11 | `POST` | `/ai-test/start` | `start_ai_test_with_topics(request)` | Body: StartAITestRequest | `StartAITestResponse` |
| 12 | `GET` | `/qb-test/subjects/{class_level}` | `get_qb_subjects(class_level)` | — | Aggregates approved Qs from QB |
| 13 | `GET` | `/qb-test/chapters/{class_level}/{subject}` | `get_qb_chapters(...)` | — | Per-type counts by chapter |
| 14 | `POST` | `/qb-test/start` | `start_qb_test(request)` | Body: StartQBTestRequest | Pulls approved Qs from question bank |
| 15 | `POST` | `/answer` | `submit_answer(request)` | Body: SubmitAnswerRequest | Single answer during test |
| 16 | `POST` | `/complete` | `complete_test(request)` | Body: CompleteTestRequest | Triggers RAG evaluation |
| 17 | `GET` | `/staff-tests` | `get_staff_tests()` | Query: subject?, chapter?, student_id? | `List[StaffTestItem]` |
| 18 | `POST` | `/staff-tests` | `create_staff_test()` | Form: subject, chapter, class_level, title, description?, due_date?, max_score, created_by; File: question_paper | |
| 19 | `GET` | `/staff-tests/{test_id}/download` | `download_question_paper(test_id)` | — | PDF FileResponse |
| 20 | `POST` | `/staff-tests/{test_id}/submit` | `submit_answer_sheet(test_id)` | Form: student_id; File: answer_sheet | |
| 21 | `GET` | `/analytics/{student_id}` | `get_student_analytics(student_id)` | Query: class_level, subject? | `StudentAnalytics` |
| 22 | `GET` | `/question-bank/stats` | `get_question_bank_stats()` | — | Topic question bank stats |
| 23 | `GET` | `/debug/pinecone/{namespace}` | `debug_pinecone_namespace(namespace)` | — | Debug endpoint |
| 24 | `GET` | `/history/{student_id}` | `get_test_history(student_id)` | Query: limit, offset | Completed tests + analytics |
| 25 | `GET` | `/result/{session_id}` | `get_test_result(session_id)` | — | Full result for session |
| 26 | `DELETE` | `/history/{session_id}` | `delete_test_history_item(session_id)` | — | |
| 27 | `DELETE` | `/history/all/{student_id}` | `delete_all_test_history(student_id)` | — | |

> **Note:** `test.py` has duplicate route registrations for `GET /analytics/{student_id}` and `GET /history/{student_id}` (two implementations each). Only the last-registered will be active.

---

## 8. Test Management

**File:** `backend/app/routers/test_management.py` (794 lines)  
**Router:** `APIRouter(prefix="/api/tests", tags=["Test Management"])`  
**Resolved Base:** `/api/tests`  
**Auth:** Mixed

### Pydantic Models

```
TestCreate (Form): title, description, class_level, subject, is_timed, start_datetime?, end_datetime?, duration_minutes?
TestUpdate: (all Optional)
CommentCreate: comment: str
```

### Endpoints

| # | Method | Path | Function | Parameters | Auth | Notes |
|---|---|---|---|---|---|---|
| 1 | `POST` | `/create` | `create_test()` | Form + File: pdf_file | None | |
| 2 | `GET` | `/admin` | `get_admin_tests()` | Query: class_level?, subject?, status?, skip, limit | None | |
| 3 | `GET` | `/head` | `get_head_tests()` | Query: class_level?, subject?, status?, skip, limit | `require_role([HEAD, ADMIN])` | |
| 4 | `GET` | `/student/{student_id}` | `get_student_tests(student_id)` | Query: status? | None | |
| 5 | `GET` | `/{test_id}` | `get_test(test_id)` | — | None | |
| 6 | `PUT` | `/{test_id}` | `update_test(test_id)` | Body: TestUpdate | None | |
| 7 | `DELETE` | `/{test_id}` | `delete_test(test_id)` | — | None | |
| 8 | `GET` | `/pdf/{filename}` | `get_test_pdf(filename)` | — | None | PDF FileResponse |
| 9 | `GET` | `/submission-pdf/{filename}` | `get_submission_pdf(filename)` | — | None | PDF FileResponse |
| 10 | `POST` | `/submit` | `submit_test()` | Form: test_id, student_id; File: pdf_file | None | |
| 11 | `GET` | `/submissions/{test_id}` | `get_test_submissions(test_id)` | — | None | |
| 12 | `GET` | `/my-submissions/{student_id}` | `get_student_submissions(student_id)` | — | None | |
| 13 | `POST` | `/submissions/{submission_id}/comment` | `add_comment(submission_id)` | Body: CommentCreate | None | |
| 14 | `GET` | `/submission/{submission_id}` | `get_submission(submission_id)` | — | None | |
| 15 | `GET` | `/notifications/{user_id}` | `get_user_notifications(user_id)` | Query: unread_only?, limit? | None | |
| 16 | `PUT` | `/notifications/{notification_id}/read` | `mark_notification_read(notification_id)` | — | None | |
| 17 | `PUT` | `/notifications/{user_id}/read-all` | `mark_all_notifications_read(user_id)` | — | None | |
| 18 | `GET` | `/stats/overview` | `get_test_stats()` | — | None | |

---

## 9. Support

**File:** `backend/app/routers/support.py` (~370 lines)  
**Router:** `APIRouter(prefix="/api/support", tags=["Support"])`  
**Resolved Base:** `/api/support`  
**Auth:** None

### Pydantic Models

```
FAQCreate: question, answer, category, order
FAQUpdate: (all Optional + is_active)
ContactMessage: name, email, subject, message
FeedbackSubmission: rating(1-5), feedback_type, message, page
```

### Endpoints

| # | Method | Path | Function | Parameters | Notes |
|---|---|---|---|---|---|
| 1 | `GET` | `/faqs` | `get_faqs()` | Query: category?, search?, is_active | |
| 2 | `POST` | `/faqs` | `create_faq(faq)` | Body: FAQCreate | |
| 3 | `PUT` | `/faqs/{faq_id}` | `update_faq(faq_id)` | Body: FAQUpdate | |
| 4 | `DELETE` | `/faqs/{faq_id}` | `delete_faq(faq_id)` | — | |
| 5 | `POST` | `/faqs/{faq_id}/helpful` | `mark_faq_helpful(faq_id)` | — | |
| 6 | `POST` | `/faqs/{faq_id}/view` | `increment_faq_views(faq_id)` | — | |
| 7 | `POST` | `/contact` | `submit_contact_message(message)` | Body: ContactMessage | |
| 8 | `GET` | `/contact/messages` | `get_contact_messages()` | Query: status?, limit | |
| 9 | `POST` | `/feedback` | `submit_feedback(feedback)` | Body: FeedbackSubmission; Query: user_id? | |
| 10 | `GET` | `/feedback` | `get_feedback()` | Query: feedback_type?, min_rating?, limit | |
| 11 | `GET` | `/feedback/stats` | `get_feedback_stats()` | — | |
| 12 | `GET` | `/help` | `get_help_topics()` | — | Static content |
| 13 | `GET` | `/status` | `get_system_status()` | — | |

---

## 10. Support Tickets

**File:** `backend/app/routers/support_tickets.py` (684 lines)  
**Router:** `APIRouter(prefix="/api/support-tickets", tags=["Support Tickets"])`  
**Resolved Base:** `/api/support-tickets`  
**Auth:** None (uses query params for user_id/is_admin)

### Pydantic Models

```
TicketCreate: title, description, category, priority
TicketUpdate: (all Optional + status)
TicketReply: message, is_admin, author_name
```

### Endpoints

| # | Method | Path | Function | Parameters | Notes |
|---|---|---|---|---|---|
| 1 | `GET` | `/` | `get_tickets()` | Query: user_id?, status?, category?, priority?, limit, skip, is_admin | |
| 2 | `POST` | `/` | `create_ticket(ticket)` | Body: TicketCreate; Query: user_id, user_name | |
| 3 | `GET` | `/{ticket_id}` | `get_ticket(ticket_id)` | — | |
| 4 | `PUT` | `/{ticket_id}` | `update_ticket(ticket_id)` | Body: TicketUpdate | |
| 5 | `POST` | `/{ticket_id}/reply` | `add_reply(ticket_id)` | Body: TicketReply | |
| 6 | `DELETE` | `/{ticket_id}` | `delete_ticket(ticket_id)` | — | |
| 7 | `POST` | `/{ticket_id}/close` | `close_ticket(ticket_id)` | — | |
| 8 | `POST` | `/{ticket_id}/resolve` | `resolve_ticket(ticket_id)` | — | |
| 9 | `POST` | `/{ticket_id}/mark-read` | `mark_ticket_read(ticket_id)` | Query: by_admin | |
| 10 | `GET` | `/stats/summary` | `get_ticket_stats()` | — | |
| 11 | `GET` | `/notifications/admin` | `get_admin_notifications()` | Query: limit, unread_only | |
| 12 | `GET` | `/notifications/user/{user_id}` | `get_user_notifications(user_id)` | Query: limit, unread_only | |
| 13 | `POST` | `/notifications/{notification_id}/mark-read` | `mark_notification_read(notification_id)` | — | |
| 14 | `POST` | `/notifications/mark-all-read` | `mark_all_notifications_read()` | Query: user_id?, is_admin | |
| 15 | `DELETE` | `/notifications/{notification_id}` | `delete_notification(notification_id)` | — | |
| 16 | `DELETE` | `/notifications/all` | `delete_all_notifications()` | Query: user_id?, is_admin | |

---

## 11. Suggestions

**File:** `backend/app/routers/suggestions.py` (~220 lines)  
**Router:** `APIRouter(prefix="/suggestions", tags=["Suggestions"])`  
**Resolved Base:** `/api/suggestions`  
**Auth:** None

### Pydantic Models

```
CreateSuggestionRequest: student_id, student_name, class_level, category, subject?, content, email?
```

### Endpoints

| # | Method | Path | Function | Parameters | Notes |
|---|---|---|---|---|---|
| 1 | `POST` | `` (root) | `create_suggestion(request)` | Body: CreateSuggestionRequest | |
| 2 | `GET` | `/student/{student_id}` | `get_student_suggestions(student_id)` | — | |
| 3 | `GET` | `/all` | `get_all_suggestions()` | Query: status?, category?, limit | |
| 4 | `PUT` | `/{suggestion_id}/respond` | `respond_to_suggestion(suggestion_id)` | Query: response, status | |
| 5 | `DELETE` | `/{suggestion_id}` | `delete_suggestion(suggestion_id)` | — | |

---

## 12. Notifications

**File:** `backend/app/routers/notifications.py` (510 lines)  
**Router:** `APIRouter(prefix="/api/notifications", tags=["notifications"])`  
**Resolved Base:** `/api/notifications`  
**Auth:** All `Depends(get_current_user)` (JWT required)

### Endpoints

| # | Method | Path | Function | Auth | Notes |
|---|---|---|---|---|---|
| 1 | `GET` | `` (root) | `get_notifications()` | JWT | Query: limit(=20). Returns `{notifications[], unread_count}` |
| 2 | `POST` | `/{notification_id}/read` | `mark_notification_read(notification_id)` | JWT | |
| 3 | `POST` | `/{notification_id}/save` | `save_notification(notification_id)` | JWT | Bookmark |
| 4 | `POST` | `/{notification_id}/unsave` | `unsave_notification(notification_id)` | JWT | |
| 5 | `DELETE` | `/{notification_id}` | `delete_notification(notification_id)` | JWT | |
| 6 | `POST` | `/read-all` | `mark_all_notifications_read()` | JWT | `{success, modified_count}` |

---

## 13. Question Bank

**File:** `backend/app/routers/question_bank.py` (619 lines)  
**Router:** `APIRouter(prefix="/api/question-bank", tags=["question-bank"])`  
**Resolved Base:** `/api/question-bank`  
**Auth:** Role-based

### Pydantic Models

```
QuestionCreate: text, subject, class_level, chapter, topic?, type, difficulty, marks, options, correct_answer, status
QuestionUpdate: (all Optional)
GenerateRequest: class_level, subject, chapter, config: dict
DeleteRequestBody: reason?
```

### Endpoints

| # | Method | Path | Function | Parameters | Auth | Notes |
|---|---|---|---|---|---|---|
| 1 | `GET` | `/subjects` | `get_subjects()` | — | ADMIN/TEACHER/HEAD | Distinct subjects |
| 2 | `GET` | `/questions` | `get_questions()` | Query: class_level?, subject?, search?, type?, difficulty?, status?, limit, offset | ADMIN/TEACHER/HEAD | |
| 3 | `POST` | `/questions` | `create_question(question)` | Body: QuestionCreate | ADMIN/TEACHER | |
| 4 | `PUT` | `/questions/{question_id}` | `update_question(question_id)` | Body: update dict | ADMIN/TEACHER | |
| 5 | `PUT` | `/questions/{question_id}/approve` | `approve_question(question_id)` | — | ADMIN/HEAD | |
| 6 | `PUT` | `/questions/{question_id}/reject` | `reject_question(question_id)` | Query: reason? | ADMIN/HEAD | |
| 7 | `DELETE` | `/questions/{question_id}` | `delete_question(question_id)` | — | ADMIN/TEACHER/HEAD | |
| 8 | `POST` | `/questions/{question_id}/archive` | `archive_question(question_id)` | — | TEACHER | |
| 9 | `POST` | `/questions/{question_id}/request-delete` | `request_question_delete(question_id)` | Body: DeleteRequestBody | TEACHER | Soft delete request |
| 10 | `GET` | `/delete-requests` | `get_delete_requests()` | Query: status? | HEAD/ADMIN | |
| 11 | `POST` | `/delete-requests/{request_id}/approve` | `approve_delete_request(request_id)` | — | HEAD/ADMIN | |
| 12 | `POST` | `/delete-requests/{request_id}/reject` | `reject_delete_request(request_id)` | Body: DeleteRequestBody | HEAD/ADMIN | |
| 13 | `POST` | `/generate` | `generate_questions(request)` | Body: GenerateRequest | ADMIN/TEACHER | AI generation via service |
| 14 | `POST` | `/cleanup-expired` | `cleanup_expired_questions()` | — | ADMIN | Removes stale pending Qs (>7 days) |

---

## 14. Question Papers

**File:** `backend/app/routers/question_papers.py` (830 lines)  
**Router:** `APIRouter(prefix="/api/question-papers", tags=["question-papers"])`  
**Resolved Base:** `/api/question-papers`  
**Auth:** Role-based

### Pydantic Models

```
ManualQuestion: text, type, marks, options, correct_answer, section
CreatePaperManual: title, paper_type, class_level, subject, year, questions: List[ManualQuestion]
UpdatePaperData: (all Optional, including questions)
```

### Endpoints

| # | Method | Path | Function | Parameters | Auth | Notes |
|---|---|---|---|---|---|---|
| 1 | `GET` | `/metadata` | `get_metadata()` | — | ADMIN/TEACHER/HEAD | Subjects, types, years |
| 2 | `GET` | `` (root) | `list_papers()` | Query: class_level?, subject?, paper_type?, year?, status?, limit, offset | ADMIN/TEACHER/HEAD | |
| 3 | `GET` | `/{paper_id}` | `get_paper(paper_id)` | — | ADMIN/TEACHER/HEAD | |
| 4 | `POST` | `` (root) | `create_paper_manual(data)` | Body: CreatePaperManual | ADMIN/TEACHER/HEAD | |
| 5 | `POST` | `/extract-pdf` | `extract_from_pdf()` | Form: title, paper_type, class_level, subject, year; File: pdf_file | ADMIN/TEACHER/HEAD | AI PDF extraction via Gemini |
| 6 | `POST` | `/{paper_id}/approve` | `approve_paper(paper_id)` | — | ADMIN/HEAD | |
| 7 | `POST` | `/{paper_id}/reject` | `reject_paper(paper_id)` | — | ADMIN/HEAD | |
| 8 | `PUT` | `/{paper_id}` | `update_paper(paper_id)` | Body: UpdatePaperData | ADMIN/TEACHER/HEAD | Teacher edits go to pending |
| 9 | `DELETE` | `/{paper_id}` | `delete_paper(paper_id)` | — | ADMIN/TEACHER/HEAD | Teacher → delete request |
| 10 | `POST` | `/{paper_id}/approve-delete` | `approve_delete(paper_id)` | — | ADMIN/HEAD | |
| 11 | `POST` | `/{paper_id}/reject-delete` | `reject_delete(paper_id)` | — | ADMIN/HEAD | |
| 12 | `POST` | `/{paper_id}/add-to-bank` | `add_paper_questions_to_bank(paper_id)` | — | ADMIN/TEACHER/HEAD | Copies Qs to question bank |

---

## 15. Queries

**File:** `backend/app/routers/queries.py` (~145 lines)  
**Router:** `APIRouter(prefix="/api/queries", tags=["queries"])`  
**Resolved Base:** `/api/queries`  
**Auth:** Role-based

### Pydantic Models

```
CreateQueryRequest: group_id, subject, message
ReplyRequest: reply
```

### Endpoints

| # | Method | Path | Function | Parameters | Auth | Notes |
|---|---|---|---|---|---|---|
| 1 | `POST` | `` (root) | `create_query(body)` | Body: CreateQueryRequest | STUDENT | |
| 2 | `GET` | `/student` | `get_student_queries()` | — | STUDENT | Own queries |
| 3 | `GET` | `/teacher` | `get_teacher_queries()` | Query: status? | TEACHER/ADMIN | |
| 4 | `POST` | `/{query_id}/reply` | `reply_to_query(query_id)` | Body: ReplyRequest | TEACHER/ADMIN | |

---

## 16. Head Approval

**File:** `backend/app/routers/head_approval.py` (672 lines)  
**Router:** `APIRouter(prefix="/api/head", tags=["Head Approval"])`  
**Resolved Base:** `/api/head`  
**Auth:** All `require_role([HEAD, ADMIN])`

### Endpoints

| # | Method | Path | Function | Parameters | Notes |
|---|---|---|---|---|---|
| 1 | `GET` | `/my-assignment` | `get_my_assignment()` | — | Head's assigned subjects/classes |
| 2 | `GET` | `/pending-questions` | `get_pending_questions()` | Query: subject?, class_level?, teacher_id?, limit, offset | |
| 3 | `POST` | `/approve-question/{question_id}` | `approve_question(question_id)` | — | Notifies teacher |
| 4 | `POST` | `/reject-question/{question_id}` | `reject_question(question_id)` | Body/Query: reason? | Notifies teacher |
| 5 | `POST` | `/bulk-approve-questions` | `bulk_approve_questions()` | Body: `{question_ids: []}` | |
| 6 | `GET` | `/pending-papers` | `get_pending_papers()` | Query: subject?, class_level?, teacher_id?, limit, offset | |
| 7 | `POST` | `/approve-paper/{paper_id}` | `approve_paper(paper_id)` | — | Notifies teacher |
| 8 | `POST` | `/reject-paper/{paper_id}` | `reject_paper(paper_id)` | Body/Query: reason? | Notifies teacher |
| 9 | `GET` | `/dashboard-stats` | `get_head_dashboard_stats()` | — | Pending counts, recent activity |
| 10 | `GET` | `/groups` | `get_head_groups()` | — | Groups filtered by assignment |
| 11 | `GET` | `/reports` | `get_head_reports()` | — | `{overview, subject_breakdown, class_breakdown, teacher_performance}` |

---

## 17. Top Questions

**File:** `backend/app/routers/top_questions.py` (552 lines)  
**Router:** `APIRouter(prefix="/api/top-questions", tags=["Top Questions"])`  
**Resolved Base:** `/api/top-questions`  
**Auth:** None

### Pydantic Models

Imported from `app.models.top_questions`:
```
GetTopQuestionsRequest / Response
GetRecommendationsRequest / Response
TrackQuestionRequest / Response
UpdateFeedbackRequest / Response
TrendingQuestionsRequest / Response
```

### Endpoints

| # | Method | Path | Function | Parameters | Response Model |
|---|---|---|---|---|---|
| 1 | `POST` | `/top` | `get_top_questions(request)` | Body: GetTopQuestionsRequest | `GetTopQuestionsResponse` |
| 2 | `POST` | `/recommendations` | `get_recommendations(request)` | Body: GetRecommendationsRequest | `GetRecommendationsResponse` |
| 3 | `POST` | `/track` | `track_question(request)` | Body: TrackQuestionRequest | `TrackQuestionResponse` |
| 4 | `POST` | `/feedback` | `update_feedback(request)` | Body: UpdateFeedbackRequest | `UpdateFeedbackResponse` |
| 5 | `POST` | `/trending` | `get_trending_questions(request)` | Body: TrendingQuestionsRequest | `TrendingQuestionsResponse` |
| 6 | `GET` | `/top/{subject}/{class_level}` | `get_top_questions_simple(...)` | Query: mode?, limit? | List |
| 7 | `GET` | `/recommendations/{user_id}/{subject}/{class_level}` | `get_recommendations_simple(...)` | — | List |
| 8 | `GET` | `/subjects/{class_level}` | `get_available_subjects(class_level)` | — | List |
| 9 | `GET` | `/subjects/{class_level}/stats` | `get_subject_stats(class_level)` | Query: subject? | Stats dict |
| 10 | `GET` | `/doubts/{user_id}` | `get_doubt_history(user_id)` | Query: subject?, limit, offset, search? | History list |

---

## 18. Courses

**File:** `backend/app/routers/courses.py` (~340 lines)  
**Router:** `APIRouter(prefix="/api/courses", tags=["courses"])`  
**Resolved Base:** `/api/courses`  
**Auth:** Permission-based

### Pydantic Models

Imported from `app.models.course_models`:
```
CourseCreateRequest: title, description, category, difficulty, class_level?, tags?
CourseUpdateRequest: (all Optional)
ModuleCreateRequest: title, description?, order?
ContentItemCreateRequest: title, content_type, content_url?, content_text?, duration_minutes?, order?
RatingRequest: rating, review?
CourseResponse, CourseDetailResponse, CourseListResponse
```

### Endpoints

| # | Method | Path | Function | Parameters | Auth | Notes |
|---|---|---|---|---|---|---|
| 1 | `POST` | `` (root) | `create_course(request)` | Body: CourseCreateRequest | `CREATE_COURSE` | |
| 2 | `GET` | `` (root) | `list_courses()` | Query: page, page_size, category?, difficulty?, class_level?, instructor_id?, enrolled_only | `get_current_user` | `CourseListResponse` |
| 3 | `GET` | `/my-courses` | `get_my_courses()` | Query: page, page_size | `get_current_user` | `CourseListResponse` |
| 4 | `GET` | `/categories/list` | `get_categories()` | — | None | Static |
| 5 | `GET` | `/{course_id}` | `get_course(course_id)` | — | `get_current_user` | `CourseDetailResponse` |
| 6 | `PUT` | `/{course_id}` | `update_course(course_id)` | Body: CourseUpdateRequest | `UPDATE_COURSE` | |
| 7 | `DELETE` | `/{course_id}` | `delete_course(course_id)` | — | `DELETE_COURSE` | |
| 8 | `POST` | `/{course_id}/publish` | `publish_course(course_id)` | — | `PUBLISH_COURSE` | |
| 9 | `POST` | `/{course_id}/modules` | `add_module(course_id)` | Body: ModuleCreateRequest | `CREATE_MODULE` | |
| 10 | `POST` | `/{course_id}/modules/{module_id}/content` | `add_content(...)` | Body: ContentItemCreateRequest | `UPLOAD_CONTENT` | |
| 11 | `POST` | `/{course_id}/enroll` | `enroll_in_course(course_id)` | — | `ENROLL_COURSE` | |
| 12 | `DELETE` | `/{course_id}/enroll` | `unenroll_from_course(course_id)` | — | `get_current_user` | |
| 13 | `POST` | `/{course_id}/rate` | `rate_course(course_id)` | Body: RatingRequest | `get_current_user` | |

---

## 19. Assessments

**File:** `backend/app/routers/assessments.py` (516 lines)  
**Router:** `APIRouter(prefix="/api/assessments", tags=["assessments"])`  
**Resolved Base:** `/api/assessments`  
**Auth:** Permission-based

### Pydantic Models

Imported from `app.models.assessment_models`:
```
AssessmentCreateRequest: course_id, title, description?, assessment_type, time_limit_minutes?, max_attempts?, passing_score?
AssessmentUpdateRequest: (all Optional)
QuestionCreateRequest: question_text, question_type, points, options?, correct_answer?, explanation?, order?
SubmitAssessmentRequest: answers: List[AnswerItem]
GradeSubmissionRequest: grades: List[QuestionGrade], feedback?
```

Local:
```
CommentRequest: comment: str
```

### Endpoints

| # | Method | Path | Function | Parameters | Auth | Notes |
|---|---|---|---|---|---|---|
| 1 | `POST` | `` (root) | `create_assessment(request)` | Body: AssessmentCreateRequest | `CREATE_ASSESSMENT` | |
| 2 | `GET` | `` (root) | `list_assessments()` | Query: course_id?, page, page_size | `get_current_user` | `AssessmentListResponse` |
| 3 | `GET` | `/{assessment_id}` | `get_assessment(assessment_id)` | — | `get_current_user` | `AssessmentDetailResponse` |
| 4 | `PUT` | `/{assessment_id}` | `update_assessment(assessment_id)` | Body: AssessmentUpdateRequest | `UPDATE_ASSESSMENT` | |
| 5 | `POST` | `/{assessment_id}/publish` | `publish_assessment(assessment_id)` | — | `CREATE_ASSESSMENT` | |
| 6 | `DELETE` | `/{assessment_id}` | `delete_assessment(assessment_id)` | — | `DELETE_ASSESSMENT` | |
| 7 | `POST` | `/{assessment_id}/questions` | `add_question(assessment_id)` | Body: QuestionCreateRequest | `CREATE_ASSESSMENT` | |
| 8 | `PUT` | `/{assessment_id}/questions/{question_id}` | `update_question(...)` | Body: QuestionCreateRequest | `UPDATE_ASSESSMENT` | |
| 9 | `DELETE` | `/{assessment_id}/questions/{question_id}` | `delete_question(...)` | — | `UPDATE_ASSESSMENT` | |
| 10 | `GET` | `/{assessment_id}/start` | `start_assessment(assessment_id)` | — | `TAKE_ASSESSMENT` | `StudentAssessmentView` |
| 11 | `POST` | `/{assessment_id}/submit` | `submit_assessment(assessment_id)` | Body: SubmitAssessmentRequest | `TAKE_ASSESSMENT` | `SubmissionDetailResponse` |
| 12 | `GET` | `/{assessment_id}/submissions` | `get_submissions(assessment_id)` | — | `GRADE_SUBMISSION` | `SubmissionListResponse` |
| 13 | `GET` | `/submissions/my` | `get_my_submissions()` | — | `get_current_user` | `SubmissionListResponse` |
| 14 | `POST` | `/submissions/{submission_id}/grade` | `grade_submission(submission_id)` | Body: GradeSubmissionRequest | `GRADE_SUBMISSION` | |
| 15 | `POST` | `/submissions/{submission_id}/comment` | `add_submission_comment(submission_id)` | Body: CommentRequest | `GRADE_SUBMISSION` | |
| 16 | `GET` | `/submissions/{submission_id}/detail` | `get_submission_detail(submission_id)` | — | `get_current_user` | |

---

## 20. Gradebook

**File:** `backend/app/routers/gradebook.py` (~172 lines)  
**Router:** `APIRouter(prefix="/api/gradebook", tags=["gradebook"])`  
**Resolved Base:** `/api/gradebook`  
**Auth:** Permission-based / JWT

### Endpoints

| # | Method | Path | Function | Parameters | Auth | Notes |
|---|---|---|---|---|---|---|
| 1 | `GET` | `/my-grades` | `get_my_grades()` | Query: course_id? | `get_current_user` | Student's own grades |
| 2 | `GET` | `/student/{student_id}` | `get_student_grades(student_id)` | Query: course_id? | `VIEW_CLASS_ANALYTICS` | |
| 3 | `GET` | `/course/{course_id}/analytics` | `get_course_analytics(course_id)` | — | `VIEW_CLASS_ANALYTICS` | |
| 4 | `GET` | `/assessment/{assessment_id}/analytics` | `get_assessment_analytics(assessment_id)` | — | `VIEW_CLASS_ANALYTICS` | |
| 5 | `GET` | `/course/{course_id}` | `get_class_gradebook(course_id)` | — | `VIEW_CLASS_ANALYTICS` | Full gradebook |
| 6 | `GET` | `/course/{course_id}/export` | `export_grades(course_id)` | — | `EXPORT_DATA` | CSV FileResponse |
| 7 | `GET` | `/stats/teacher` | `get_teacher_stats()` | — | `get_current_user` | |
| 8 | `GET` | `/stats/student` | `get_student_stats()` | — | `get_current_user` | |

---

## Summary

| Metric | Count |
|---|---|
| **Router files** | 20 |
| **Total endpoints** | ~185 |
| **Public (no auth)** | ~120 |
| **Auth-protected** | ~65 |
| **Pydantic models** | ~60+ |
| **File uploads** | book_management, curriculum, test, test_management, question_papers |
| **AI/Gemini endpoints** | flashcards, smart notes, curriculum extraction, question generation, PDF extraction, test evaluation |
| **Pinecone endpoints** | book embeddings, debug namespace, hierarchical structure, delete operations |

### Auth Pattern by Router

| Auth Type | Routers |
|---|---|
| **None (public)** | book_management, curriculum, user, student_level, support, support_tickets, suggestions, top_questions, test (AI/QB) |
| **`require_role([STUDENT])`** | student, queries (create/list) |
| **`require_role([TEACHER, ADMIN])`** | teacher, queries (reply) |
| **`require_role([HEAD, ADMIN])`** | head_approval, test_management (partial) |
| **`require_role([ADMIN, TEACHER, HEAD])`** | question_bank, question_papers |
| **`require_role([ADMIN])`** | question_bank (`cleanup-expired`) |
| **`require_permission(Permission.X)`** | courses, assessments, gradebook |
| **`get_current_user` (JWT)** | notifications |
