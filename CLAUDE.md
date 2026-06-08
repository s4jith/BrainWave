# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BrainWave is an NCERT AI Learning Platform — a RAG-based educational assistant for students (Classes 5-10). It consists of three parts:

- `backend/` — FastAPI REST API (Python)
- `frontend/` — React 19 + Vite web app
- `app/` — Flutter cross-platform mobile/desktop app (currently a placeholder)

## Commands

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # fill in credentials
python run.py                    # starts on http://localhost:8000
```

Interactive API docs: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env
npm run dev      # starts on http://localhost:5173
npm run build
npm run lint
npm run preview
```

### Flutter App

```bash
cd app
flutter pub get
flutter run      # pick target device
flutter test     # runs widget_test.dart
```

## Architecture

### Backend

**Entry point:** `backend/run.py` (includes a Python 3.14 Protobuf compatibility workaround — do not remove the `sys.modules["google._upb._message"] = None` lines). Loads `.env` first, then starts uvicorn.

**FastAPI app:** `backend/app/main.py` registers all routers and two global middlewares: `CORSMiddleware` and `AuthMiddleware`.

**Auth flow:**
- `AuthMiddleware` (`core/auth_middleware.py`) validates JWT Bearer tokens on every `/api/` route. Public paths are whitelisted in `PUBLIC_PATHS`.
- Route-level guards: `get_current_user` (JWT only), `require_role([UserRole.X])` (role check), `require_permission(Permission.X)` (fine-grained for courses/assessments/gradebook).
- Roles: `STUDENT`, `TEACHER`, `HEAD`, `ADMIN`. Permissions are derived from roles in `models/rbac_models.py`.

**Database layer** (`db/mongo.py`):
- `mongodb` (Motor async client) — used by most routers for async ops; database name is `ncert_learning_db`.
- `db` (PyMongo sync client) — used by `auth.py` and `admin_dashboard.py`.
- Pinecone: one index per subject (`PINECONE_MATH_INDEX`, `PINECONE_PHYSICS_INDEX`, etc. + a master index). Each index has its own `HOST` env var.

**Services layer** (`services/`):
- `rag_service.py` — core RAG pipeline: embeds query → Pinecone retrieval → Gemini generation. Similarity threshold is 0.3.
- `gemini_service.py` + `gemini_key_manager.py` — wraps Gemini API with key rotation support.
- `mcq_service.py`, `eval_service.py` — MCQ generation and answer evaluation.
- `cloudinary_service.py` — PDF/file upload and CDN storage.
- Other services are domain-specific (notes, flashcards, career, courses, etc.).

**Router organization** — 25+ router files in `routers/`. Most have their prefix defined in the router file itself and are mounted with `app.include_router(router)`. Exceptions that receive an extra `prefix="/api"` at mount time: `chat`, `mcq`, `evaluate`, `notes`, `assessment`, `annotation`, `history`, `admin`, `user`, `test`, `suggestions`.

### Frontend

**Router:** `src/App.jsx` uses React Router v7. All pages are lazy-loaded except `LandingPage` and `Login`. Three route guard types:
- `ProtectedRoute` — requires any authenticated user.
- `StaffRoute` — requires TEACHER, ADMIN, or HEAD role.
- `FeatureGatedRoute` — feature-flag controlled (fetches from `/api/student/my-features`).

**State management:** Zustand for global state; React Context for Toast notifications (`contexts/ToastContext.jsx`).

**Key feature areas:**
- `features/annotations/` — PDF highlight-to-explain workflow (AI panel, selection dialog, history).
- `features/pdf/` — PDF viewer with annotation support using `react-pdf`/`pdfjs-dist`.
- `features/lessons/` — lesson navigation.
- `components/dashboard/` — shared dashboard layout and chatbot panel.

**API calls:** All services in `src/services/` communicate with `VITE_API_URL` (default `http://localhost:8000`). Auth token is read from localStorage and sent as `Authorization: Bearer <token>`.

**UI:** Tailwind CSS + shadcn-style primitives in `components/ui/`. Mantine v8 and Radix UI are also available. `lucide-react` for icons, `framer-motion` for animations, `recharts` for charts.

## Environment Variables

### Backend (`backend/.env`)

```env
MONGO_URI=mongodb+srv://...
GEMINI_API_KEY=...
PINECONE_API_KEY=...
PINECONE_INDEX=...           # legacy single index
PINECONE_HOST=...
PINECONE_MASTER_INDEX=...
PINECONE_MASTER_HOST=...
PINECONE_MATH_INDEX=...      # per-subject indices follow this pattern
PINECONE_MATH_HOST=...
# ...PHYSICS, CHEMISTRY, BIOLOGY, SOCIAL, ENGLISH, HINDI
JWT_SECRET_KEY=...           # must be ≥32 chars or a random one is used per-session
FRONTEND_URL=http://localhost:5173
DEBUG=True
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:8000
```

## Key Conventions

- **Adding a new router:** define prefix in the router file, call `app.include_router(router)` in `main.py`. Add any public paths to `PUBLIC_PATHS` in `core/auth_middleware.py`.
- **MongoDB collections:** accessed via `db.get_collection("collection_name")` on the `db` singleton (sync) or `mongodb.get_collection(...)` (async Motor). Database name is always `ncert_learning_db`.
- **Explanation modes:** `Simple`, `Meaning`, `Story`, `Example`, `Summary` — passed as a `mode` parameter through chat and RAG endpoints and drive Gemini prompt shaping.
