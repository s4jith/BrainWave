 # Frontend Dead Code & Unused Code Report

**Generated:** February 19, 2026  
**Scope:** `frontend/src/`

---

## 1. ENTIRELY UNUSED FILES (never imported anywhere)

These files are never imported/referenced by any other file in the project and can be safely deleted.

### Pages

| File | Reason |
|------|--------|
| `pages/BookManagement.jsx` | Superseded by `BookManagementHierarchical.jsx` (which is the one imported in `App.jsx` as `BookManagement`). This 822-line file is completely dead. |
| `pages/MyCourses.jsx` | Never imported in `App.jsx` or any other file. No route points to it. |
| `pages/Login.jsx.backup` | Backup file — not a valid import target. |

### Components

| File | Reason |
|------|--------|
| `components/PDFViewer.jsx` | Never imported. `BookToBot.jsx` imports `features/pdf/PDFViewer.jsx` instead. This is a 214-line orphan. |
| `components/LessonNavigation.jsx` | Never imported. `BookToBot.jsx` imports `features/lessons/LessonNavigation.jsx` instead. 67-line duplicate. |
| `components/ErrorBoundary.jsx` | Never imported or used anywhere. 44-line dead component. |
| `components/analytics/PerformanceChart.jsx` | Never imported anywhere. |
| `components/analytics/TopicBreakdown.jsx` | Never imported anywhere. |
| `components/analytics/TopicHeatmap.jsx` | Never imported anywhere. |
| `components/dashboard/ProgressCard.jsx` | Never imported anywhere. |
| `components/dashboard/QuoteCard.jsx` | Never imported anywhere (Dashboard.jsx imports `quotes.json` directly and handles display inline). |
| `components/dashboard/StreakCard.jsx` | Never imported anywhere. |
| `components/dashboard/SupportCard.jsx` | Never imported anywhere. Has TODO placeholder code. |
| `components/dashboard/NotesDeckCard.jsx` | Never imported anywhere. |
| `components/test/AITestCard.jsx` | Never imported anywhere. |
| `components/test/AITestModal.jsx` | Never imported anywhere. |
| `components/test/StaffTestCard.jsx` | Never imported anywhere. |
| `components/ui/container-scroll-animation.jsx` | Never imported anywhere. |
| `components/ui/InfiniteGridBackground.jsx` | Never imported anywhere. |
| `components/ui/label.jsx` | Never imported anywhere. |
| `components/ui/checkbox.jsx` | Never imported anywhere. |

### Entire `annotations/` directory (root src level)

The entire `src/annotations/` directory is a **dead duplicate** of `src/features/annotations/`. All 6 files are never imported by any active code path:

| File | Reason |
|------|--------|
| `annotations/AIPanel.jsx` | Duplicate of `features/annotations/AIPanel.jsx`. Only imported by dead `components/PDFViewer.jsx`. |
| `annotations/HighlightOverlay.jsx` | Duplicate of `features/annotations/HighlightOverlay.jsx`. Only imported by dead `components/PDFViewer.jsx`. |
| `annotations/HistoryPanel.jsx` | Duplicate of `features/annotations/HistoryPanel.jsx`. Only imported by dead `components/PDFViewer.jsx`. |
| `annotations/NotesPanel.jsx` | Duplicate of `features/annotations/NotesPanel.jsx`. Only imported by dead `components/PDFViewer.jsx`. |
| `annotations/SelectionDialog.jsx` | Duplicate of `features/annotations/SelectionDialog.jsx`. Only imported by dead `components/PDFViewer.jsx`. |
| `annotations/StudentChatbot.jsx` | Duplicate of `features/annotations/StudentChatbot.jsx`. Never imported by any file. |

### Features

| File | Reason |
|------|--------|
| `features/assessment/VoiceAssessment.jsx` | Never imported anywhere. Contains placeholder/simulated code with commented-out API calls. |
| `features/annotations/SelectionDialog.jsx` | Exported but never actually rendered — `features/pdf/PDFViewer.jsx` does not import it (only the dead `components/PDFViewer.jsx` uses `annotations/SelectionDialog.jsx`). |
| `features/annotations/StudentChatbot.jsx` | Never imported by any active code path. |

### Stores

| File | Reason |
|------|--------|
| `stores/teacherDoubtsStore.js` | Never imported anywhere. Contains TODO/placeholder code with commented-out API calls. |

### Contexts

| File | Reason |
|------|--------|
| `contexts/AnnotationContext.jsx` | Only imported by dead `components/PDFViewer.jsx`. `AnnotationProvider` is exported but never used as a wrapping component anywhere. |

### Assets

| File | Reason |
|------|--------|
| `assets/index.js` | Imports 14 PDF files (`fees101.pdf` through `fees114.pdf`) that don't exist. Never imported by any file. Dead asset manifest. |

### Data

| File | Reason |
|------|--------|
| `data/users.json` | Never imported anywhere. |

### Hooks

| File | Reason |
|------|--------|
| `hooks/useAutoRefresh.js` | Never imported anywhere. |

---

## 2. UNUSED IMPORTS (imported but never used in the file)

### `pages/Login.jsx`
- **`setUser`** from `useUserStore` (line 12) — destructured but never called; only `login` is used.

### `pages/TestCenter.jsx`
- **`User`** icon from lucide-react (line 19) — imported but never used as a component (only `user` from store is used).
- **`ArrowRight`** icon from lucide-react (line 14) — imported but never rendered.

### `pages/TestSession.jsx`
- **`BookOpen`** icon from lucide-react (line 15) — imported but never rendered.

### `pages/ReportCard.jsx`
- **`Zap`** icon from lucide-react (line 18) — imported but never rendered.

### `pages/CourseBuilder.jsx`
- **`Upload`** icon from lucide-react (line 15) — imported but never rendered.

### `pages/AssessmentBuilder.jsx`
- **`Eye`** icon from lucide-react (line 23) — imported but never rendered.
- **`Clock`** icon from lucide-react (line 21) — imported but never rendered.

---

## 3. UNUSED EXPORTS (exported but never imported by consuming code)

### `constants/academicConstants.js`
- **`SUBJECTS`** — only used internally by `getCombinedClassSubjectOptions()`, never imported by other files.
- **`CLASSES`** — only used internally, never imported by other files.
- **`DIFFICULTY_LEVELS`** — never imported anywhere.
- **`QUESTION_TYPES`** — never imported anywhere.
- **`fetchCurriculumSubjects()`** — never imported anywhere.
- **`fetchSubjectDetails()`** — never imported anywhere.

### `constants/lessons.js`
- **`SAMPLE_LESSONS`** — exported as alias of `MATH_LESSONS` for "backward compatibility" but never imported anywhere.
- **`ALL_SUBJECTS`** — exported but never imported anywhere.
- **`MATH_LESSONS`** — exported but never directly imported (only used internally by `getLessonsForSubject()`).
- **`getLessonsForSubject()`** — the function defined in this file is never imported anywhere (the entire file's static lesson data is unused except `SUBJECTS_WITH_RAG`).
- **Social Science lessons** (SOCIAL_SCIENCE_LESSONS) — also never imported.

### `services/api.js`
- **`assessmentService`** — exported but never imported anywhere (the assessment store uses its own fetch logic).
- **`healthCheck`** — exported but never imported anywhere.
- **Default export** — the default export object re-exports all services, but nothing imports it via default import.

### `contexts/AnnotationContext.jsx`
- **`AnnotationProvider`** — exported but never used as a wrapper component.
- **`useAnnotations`** — only imported by dead `components/PDFViewer.jsx`.

---

## 4. COMMENTED-OUT CODE BLOCKS

### `stores/teacherDoubtsStore.js` (lines 46-51)
```javascript
// const response = await fetch('/api/doubts', {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify(doubtData)
// });
// const result = await response.json();
```

### `features/assessment/VoiceAssessment.jsx` (lines 132-140)
```javascript
// const response = await fetch('/api/assessments/evaluate', {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({
//     lessonId,
//     answers: allAnswers
//   })
// });
// const result = await response.json();
```

### `components/dashboard/SupportCard.jsx` (line 27)
```javascript
// await api.post('/support/tickets', { message });
```

---

## 5. SUMMARY

### By impact (estimated removable lines):

| Category | Files | Est. Lines |
|----------|-------|------------|
| Dead pages | 3 files | ~1,200 |
| Dead `annotations/` directory (full duplicate) | 6 files | ~800 |
| Dead components | 17 files | ~2,500 |
| Dead features | 3 files | ~600 |
| Dead stores/contexts/hooks | 3 files | ~260 |
| Dead assets/data | 2 files | ~50 |
| **Total removable** | **34 files** | **~5,400 lines** |

### Quick wins:
1. **Delete `src/annotations/`** — entire directory is a duplicate of `src/features/annotations/`
2. **Delete `pages/BookManagement.jsx`** — replaced by `BookManagementHierarchical.jsx`
3. **Delete `pages/MyCourses.jsx`** — no route, never imported
4. **Delete `pages/Login.jsx.backup`** — backup file
5. **Delete `components/PDFViewer.jsx`** and `components/LessonNavigation.jsx` — duplicated in `features/`
6. **Delete `stores/teacherDoubtsStore.js`** — never used
7. **Delete entire `components/analytics/`** — 3 files, none imported
8. **Delete 5 unused dashboard cards** — `ProgressCard`, `QuoteCard`, `StreakCard`, `SupportCard`, `NotesDeckCard`
9. **Delete 3 unused test components** — `AITestCard`, `AITestModal`, `StaffTestCard`
10. **Delete `hooks/useAutoRefresh.js`** and `assets/index.js`
