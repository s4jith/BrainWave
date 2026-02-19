# Dead Code Analysis Report — Models, Core, DB, Utils & Main

**Scope:** `backend/app/models/`, `backend/app/core/`, `backend/app/db/`, `backend/app/utils/`, `backend/app/main.py`, `backend/app/__init__.py`  
**Generated:** February 19, 2026  

---

## Summary

| Category | Count |
|---|---|
| **Unused Imports** | 7 |
| **Dead/Unused Functions or Methods** | 11 |
| **Dead/Unused Classes/Models** | 13 |
| **Entirely Unused Files** | 2 |
| **Missing Functions (Referenced but undefined)** | 2 |
| **Commented-Out Code** | 1 |

---

## 1. ENTIRELY UNUSED FILES

### 1.1 `backend/app/models/admin_models.py` — EMPTY FILE
- **Lines:** 0 (completely empty)
- **Imports from elsewhere:** None — zero references across the entire codebase
- **Action:** Delete file.

### 1.2 `backend/app/models/question_bank.py` — NEVER IMPORTED
- **Lines:** 1–87 (entire file)
- **Imports from elsewhere:** Zero — no file in routers/, services/, or anywhere imports from `app.models.question_bank`
- **Contains 5 classes, all dead:**
  - `Question` (L11) — shadows `assessment_models.Question` and `topic_questions.TopicQuestion`
  - `QuestionSet` (L22)
  - `StudentAssessmentAttempt` (L42)
  - `QuestionGenerationRequest` (L68)
  - `QuestionRetrievalRequest` (L79)
- **Note:** `app/routers/question_bank.py` and `app/services/question_bank_service.py` define their own inline models and do NOT import from this file.
- **Action:** Delete file.

---

## 2. UNUSED MODEL CLASSES (defined but never imported/used externally)

### 2.1 `backend/app/models/schemas.py`
The Voice Assessment schemas (L133–L165) are **never imported** by any router or service. The `routers/assessment.py` router defines its own inline Pydantic models instead.

| Line | Class | Status |
|---|---|---|
| L133 | `AssessmentAnswer` | ❌ Never imported |
| L140 | `AssessmentSubmitRequest` | ❌ Never imported |
| L149 | `AssessmentResult` | ❌ Never imported |
| L158 | `AssessmentResponse` (voice) | ❌ Never imported |

**Action:** Remove lines 130–165 (the `ASSESSMENT SCHEMAS (VOICE)` section).

### 2.2 `backend/app/models/curriculum_models.py`

| Line | Class | Status |
|---|---|---|
| L64 | `SubjectDocument` | ❌ Never imported — routers/services use raw dicts for MongoDB docs |

**Action:** Remove `SubjectDocument` class (L64–L82).

### 2.3 `backend/app/models/rbac_models.py`

| Line | Symbol | Status |
|---|---|---|
| L159 | `has_all_permissions()` | ❌ Never called — only `has_permission` and `has_any_permission` are imported by `permissions.py` |
| L167 | `UserBase` | ❌ Never imported directly — only used as base class for `UserCreate` (internal use only) |
| L181 | `UserUpdate` | ❌ Never imported by any router/service |
| L191 | `UserInDB` | ❌ Never imported externally — only referenced internally by `UserResponse.from_db()` type hint |

**Notes:**
- `UserBase` / `UserInDB` are used internally as base/type-hint within the same file, so they're not truly dead — but no consumer outside `rbac_models.py` imports them.
- `UserUpdate` is completely unused anywhere.
- `has_all_permissions()` is never called anywhere.

### 2.4 `backend/app/models/topic_questions.py`

| Line | Class | Status |
|---|---|---|
| L191 | `SubjectInfo` | ❌ Never imported — zero references outside its own file |

**Action:** Remove `SubjectInfo` class (L191–L204).

---

## 3. UNUSED IMPORTS

### 3.1 `backend/app/db/mongo.py` — Line 7
```python
from pinecone import Pinecone, ServerlessSpec
```
`ServerlessSpec` is **never used** in this file. It's only used in `scripts/setup_namespace_architecture.py` which imports it separately.

### 3.2 `backend/app/core/permissions.py` — Line 7
```python
from functools import wraps
```
`wraps` is **never used**. No decorators in this file use `@wraps`.

### 3.3 `backend/app/core/permissions.py` — Line 8
```python
from typing import List, Optional, Callable
```
`Callable` is **never used** as a type hint in this file.

### 3.4 `backend/app/core/permissions.py` — Line 9
```python
from fastapi import Depends, HTTPException, status, Request
```
`Request` is **never used** in this file.

### 3.5 `backend/app/models/curriculum_models.py` — Line 9
```python
from bson import ObjectId
```
`ObjectId` is **never used** in this file. (It IS used in `topic_questions.py` but not here.)

### 3.6 `backend/app/utils/performance_logger.py` — Line 12
```python
from typing import Optional, Dict, Any, Callable
```
`Any` is **never used** as a type hint in this file.

### 3.7 `backend/app/utils/performance_logger.py` — Line 13
```python
from dataclasses import dataclass, field
```
`field` is **never used**. The `@dataclass` class `LatencyMetrics` uses plain defaults, not `field()`.

---

## 4. DEAD/UNUSED FUNCTIONS

### 4.1 `backend/app/core/permissions.py`

| Line | Function/Variable | Status |
|---|---|---|
| L92 | `get_optional_user()` | ❌ Never imported or used by any router |
| L154 | `require_any_permission()` | ❌ Never imported by any router — only defined |
| L183 | `require_admin` | ❌ Never imported — routers call `require_role([UserRole.ADMIN])` directly |
| L184 | `require_teacher` | ❌ Never imported — routers call `require_role([...])` directly |
| L185 | `require_student` | ❌ Never imported — routers call `require_role([...])` directly |

**Notes:**
- `check_resource_ownership()` (L189) is called by `ensure_ownership()` internally, so it's not dead.
- `ensure_ownership` IS imported by `routers/courses.py`, so keep it.

### 4.2 `backend/app/utils/performance_logger.py`

| Line | Symbol | Status |
|---|---|---|
| L56 | `PerformanceLogger.get_metrics()` | ❌ Never called by any external module |
| L99 | `PerformanceLogger.get_avg_latencies()` | ❌ Never called by any external module |
| L185 | `performance_logger` (singleton instance) | ❌ Never imported — callers use `measure_latency` decorator or `LatencyContext` directly |

### 4.3 `backend/app/db/mongo.py` — Unused helper functions

These collection-getter functions are defined but **never imported** by any module:

| Line | Function | Status |
|---|---|---|
| L1091 | `get_quiz_results_collection()` | ❌ Never imported |
| L1096 | `get_question_sets_collection()` | ❌ Never imported |
| L1101 | `get_assessment_attempts_collection()` | ❌ Never imported |
| L1106 | `get_user_activities_collection()` | ❌ Never imported |
| L1112 | `get_users_collection()` | ❌ Never imported |

**Note:** Services access MongoDB collections directly via `mongodb.get_collection("...")` or `mongodb.db["..."]` instead.

### 4.4 `backend/app/db/mongo.py` — `SubjectWisePineconeDB` class (L555–L751) + `subject_wise_db` instance (L751)
- **Never imported** by any module. The codebase uses `namespace_db` (the `NamespaceDB` class) instead.
- This is the legacy subject-wise approach that was superseded by the namespace architecture.
- **Action:** Remove the entire `SubjectWisePineconeDB` class and its instance `subject_wise_db`.

---

## 5. MISSING FUNCTIONS (Referenced in code but NOT defined anywhere)

### 5.1 `get_database()` — Referenced but doesn't exist in `mongo.py`

Referenced by 4+ files via `from app.db.mongo import get_database`:
- `app/utils/performance_logger.py` (L83)
- `app/services/orchestrator_service.py` (L187)
- `app/routers/multilingual_chat.py` (L198)
- `app/routers/student_level.py` (L60, L118)
- `app/routers/voice_chat.py` (L143)

**This function does not exist in `mongo.py`** — it will raise `ImportError` at runtime when these code paths are hit.

**Fix:** Either add the function to `mongo.py` or update the callers to use `mongodb.db` directly.

### 5.2 `get_pinecone_index()` — Referenced but doesn't exist in `mongo.py`

Referenced by:
- `app/services/optimized_rag_service.py` (L256)

**This function does not exist in `mongo.py`** — will raise `ImportError` at runtime.

**Fix:** Either add the function or update the caller to use `pinecone_db.index` directly.

---

## 6. COMMENTED-OUT CODE

### 6.1 `backend/app/db/mongo.py` — Line 1056
```python
    # Connect to Legacy Pinecone (textbook content) - will be deprecated
    # logger.info("\n  Legacy DB (will be deprecated):")
```
Minor commented-out log line in `init_databases()`.

---

## 7. FILES WITH NO ISSUES ✅

| File | Status |
|---|---|
| `backend/app/__init__.py` | Clean (single comment line) |
| `backend/app/main.py` | Clean — all imports used |
| `backend/app/models/__init__.py` | Clean (single comment line) |
| `backend/app/models/assessment_models.py` | All classes used by `routers/assessments.py` and `services/assessment_service.py` |
| `backend/app/models/course_models.py` | All classes used by `routers/courses.py` and `services/course_service.py` |
| `backend/app/models/top_questions.py` | All classes used by `routers/top_questions.py` and `services/top_question_service.py` |
| `backend/app/core/__init__.py` | Clean (single comment line) |
| `backend/app/core/config.py` | Clean — `settings` is heavily used across the codebase |
| `backend/app/db/__init__.py` | Clean (single comment line) |
| `backend/app/utils/__init__.py` | Clean (single comment line) |
| `backend/app/utils/email.py` | Clean — both functions imported/used |
| `backend/app/utils/embedding_helper.py` | Clean — `generate_embedding`, `generate_embeddings_batch`, `EMBEDDING_MODEL` all used |
| `backend/app/utils/language_detection.py` | Clean — all public functions imported by `multilingual_chat.py` |

---

## 8. CROSS-FILE MODEL USAGE MATRIX

### `models/schemas.py`
| Class | Imported By |
|---|---|
| `ChatRequest`, `ChatResponse` | `routers/chat.py` ✅ |
| `ErrorResponse` | `routers/chat.py` ✅ |
| `MCQ` | `services/eval_service.py`, `services/mcq_service.py` ✅ |
| `MCQAnswer`, `EvaluationResult` | `services/eval_service.py` ✅ |
| `MCQGenerationRequest`, `MCQGenerationResponse` | `routers/mcq.py` ✅ |
| `EvaluationRequest`, `EvaluationResponse` | `routers/evaluate.py` ✅ |
| `NoteCreateRequest`, `Note`, `NotesListResponse` | `routers/notes.py`, `services/notes_service.py` ✅ |
| `SuccessResponse` | `routers/notes.py`, `routers/history.py` ✅ |
| `AnnotationHistory*` | `routers/history.py`, `services/annotation_history_service.py` ✅ |
| **`AssessmentAnswer`** | ❌ UNUSED |
| **`AssessmentSubmitRequest`** | ❌ UNUSED |
| **`AssessmentResult`** | ❌ UNUSED |
| **`AssessmentResponse`** (voice) | ❌ UNUSED |

### `models/rbac_models.py`
| Class | Imported By |
|---|---|
| `UserRole` | 8+ routers, `permissions.py` ✅ |
| `Permission` | 4+ routers, `permissions.py` ✅ |
| `TokenData` | 7+ routers, `permissions.py` ✅ |
| `UserCreate`, `UserResponse`, `get_role_permissions` | `routers/auth.py` ✅ |
| `has_permission`, `has_any_permission` | `core/permissions.py` ✅ |
| **`UserUpdate`** | ❌ UNUSED |
| **`has_all_permissions()`** | ❌ UNUSED |

### `models/topic_questions.py`
| Class | Imported By |
|---|---|
| `TopicQuestion`, `Topic`, `ChapterQuestionBank` | `services/topic_question_bank_service.py` ✅ |
| `StudentTopicPerformance`, `StudentSubjectProgress`, `TestSession` | `services/topic_question_bank_service.py` ✅ |
| **`SubjectInfo`** | ❌ UNUSED |

### `models/question_bank.py`
| Class | Status |
|---|---|
| **ALL 5 classes** | ❌ ENTIRE FILE UNUSED |

---

## 9. RECOMMENDED CLEANUP ACTIONS

### High Priority (dead files / missing functions)
1. **Delete** `backend/app/models/admin_models.py` (empty file)
2. **Delete** `backend/app/models/question_bank.py` (entirely unused)
3. **Add** `get_database()` and `get_pinecone_index()` functions to `backend/app/db/mongo.py`, or fix the 6+ files that import them

### Medium Priority (unused code removal)
4. **Remove** voice `AssessmentAnswer`, `AssessmentSubmitRequest`, `AssessmentResult`, `AssessmentResponse` from `schemas.py` (L130–165)
5. **Remove** `SubjectDocument` from `curriculum_models.py` (L64–82)
6. **Remove** `SubjectInfo` from `topic_questions.py` (L191–204)
7. **Remove** `has_all_permissions()` from `rbac_models.py` (L159–162)
8. **Remove** `UserUpdate` from `rbac_models.py` (L181–189)
9. **Remove** `SubjectWisePineconeDB` class + `subject_wise_db` from `mongo.py` (~200 lines, L555–751)
10. **Remove** 5 unused collection helpers from `mongo.py` (L1091–1117)
11. **Remove** convenience aliases `require_admin`, `require_teacher`, `require_student` from `permissions.py` (L183–185)
12. **Remove** `get_optional_user()`, `require_any_permission()` from `permissions.py` (unless planned for future use)
13. **Remove** `performance_logger` singleton instance from `performance_logger.py` (L185)
14. **Remove** `get_metrics()`, `get_avg_latencies()` from `PerformanceLogger` class

### Low Priority (unused imports)
15. Remove `ServerlessSpec` from `mongo.py` L7: `from pinecone import Pinecone, ServerlessSpec` → `from pinecone import Pinecone`
16. Remove `wraps` from `permissions.py` L7: `from functools import wraps` → delete line
17. Remove `Callable` from `permissions.py` L8: `from typing import List, Optional, Callable` → `from typing import List, Optional`
18. Remove `Request` from `permissions.py` L9: `from fastapi import Depends, HTTPException, status, Request` → `from fastapi import Depends, HTTPException, status`
19. Remove `ObjectId` from `curriculum_models.py` L9: `from bson import ObjectId` → delete line
20. Remove `Any` from `performance_logger.py` L12: `from typing import Optional, Dict, Any, Callable` → `from typing import Optional, Dict, Callable`
21. Remove `field` from `performance_logger.py` L13: `from dataclasses import dataclass, field` → `from dataclasses import dataclass`
