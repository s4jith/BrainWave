# NCERT AI Learning Platform -- Context-Grounded Educational Assistant

An AI-powered learning platform that helps students read NCERT textbooks with **context-aware explanations, smart assessments, and persistent notes**. Unlike generic chat tools, this system uses retrieval-grounded generation so responses stay anchored to textbook context.

## Problems Solved
- Students get stuck on textbook paragraphs and need instant simplified explanations.
- Generic AI tools can hallucinate and provide syllabus-inaccurate answers.
- Practice assessment creation is time-consuming for teachers and students.
- Notes, highlights, and progress are fragmented across tools.
- Learning flow breaks when PDF reading and AI Q&A are in separate apps.

## How It Works

```text
Student opens chapter PDF and highlights text
         |
FastAPI receives query + mode + chapter context
         |
RAG service retrieves relevant chunks from Pinecone
         |
Gemini generates grounded explanation using retrieved context
         |
System returns explanation in selected mode (Simple/Meaning/Story/Example/Summary)
         |
Student can save notes, create MCQs, and review history
         |
Assessment, annotation, and progress workflows persist in MongoDB
```

## Architecture Overview

```text
[Browser]
   |
   | HTTP (localhost:5173 -> localhost:8000)
   v
[React + Vite Frontend]
   |  Components, hooks, context, PDF viewer, route pages
   |
   v
[FastAPI Backend]
   |  Routers: chat, notes, mcq, evaluate, assessment, auth, student, teacher, admin
   |
   |--- Google Gemini API         (LLM generation)
   |--- Pinecone                  (vector retrieval for RAG)
   |--- MongoDB Atlas             (users, notes, assessments, platform data)
   |--- PDF toolchain             (PyMuPDF, pdf2image, PyPDF2)
   |
   v
[AI + Services Layer]
   |--- Retrieval and ranking
   |--- Prompt/mode orchestration
   |--- MCQ generation + evaluation
   |--- Annotation/history services
```

## Demo Flow

**Classroom Usage Flow**

| Step | Action | Output |
|------|--------|--------|
| 1 | Open chapter PDF | Full text visible in embedded reader |
| 2 | Highlight difficult paragraph | Query context captured |
| 3 | Choose explanation mode | AI returns mode-specific grounded answer |
| 4 | Generate assessment | MCQs created from chapter context |
| 5 | Save to notes/history | Student gets persistent revision material |

## Features

### Core Learning
- **Context-aware AI explanations** with multi-mode output.
- **Strict retrieval grounding** to reduce hallucination risk.
- **PDF-integrated workflow** for highlight-to-explain interaction.
- **Assessment generation and evaluation** inside the same platform.
- **Notes, annotations, and history** for revision continuity.

### AI and Assessment
- **RAG-based chat** with Pinecone-backed context retrieval.
- **Mode-driven response shaping** (`Simple`, `Meaning`, `Story`, `Example`, `Summary`).
- **MCQ generation** from chapter-level learning context.
- **Answer evaluation pipeline** for objective scoring workflows.
- **Question bank support** through dedicated API modules.

### Platform and User Modules
- **Role-oriented API modules** for student, teacher, head, and admin.
- **Curriculum + books management** for class/subject/chapter workflows.
- **Support, suggestions, notifications** for operational communication.
- **Gradebook and course modules** for structured assessments.

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 19 | Component-driven UI |
| Vite (Rolldown) | Fast build/dev tooling |
| Tailwind CSS | Utility-first styling |
| react-pdf / pdfjs-dist | PDF rendering and interactions |
| Zustand + Context | State and UI flow management |
| Framer Motion | UI motion and transitions |
| React Router | Route navigation |

### Backend
| Technology | Purpose |
|------------|---------|
| FastAPI | Async API framework |
| Uvicorn | ASGI server |
| Pydantic v2 | Validation and settings |
| Motor + PyMongo | MongoDB async/data access |
| PyJWT | JWT auth workflows |
| python-dotenv | Environment loading |

### AI / Data Layer
| Technology | Purpose |
|------------|---------|
| Google Gemini API | Response generation |
| Pinecone | Vector retrieval for RAG |
| NumPy | Numeric utilities |
| PyMuPDF / PyPDF2 / pdf2image | PDF parsing and preprocessing |
| Pillow | Image operations in processing pipeline |

## Project Structure

```text
ncert-working-2/
|-- README.md
|-- API_ENDPOINTS.md
|-- PROJECT_ANALYSIS.md
|-- backend/
|   |-- run.py
|   |-- requirements.txt
|   |-- .env.example
|   |-- app/
|   |   |-- main.py
|   |   |-- core/            # config, middleware, auth
|   |   |-- db/              # mongo initialization and access
|   |   |-- models/          # data models
|   |   |-- routers/         # API route groups
|   |   |-- services/        # RAG, chat, MCQ, evaluation logic
|   |   |-- utils/
|   |-- scripts/             # setup, seeding, processing utilities
|-- frontend/
|   |-- package.json
|   |-- src/
|   |   |-- components/
|   |   |-- pages/
|   |   |-- hooks/
|   |   |-- services/
|   |   |-- contexts/
|   |   |-- features/
|   |-- public/
|-- Books/                    # NCERT source material
```

## Installation and Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm
- MongoDB Atlas project
- Pinecone project
- Google Gemini API key

### 1. Clone Repository

```bash
git clone https://github.com/<your-username>/ncert-working-2.git
cd ncert-working-2
```

### 2. Setup Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

### 3. Setup Frontend

```bash
cd ../frontend
npm install
cat > .env << 'EOF'
VITE_API_URL=http://localhost:8000
EOF
```

### 4. Run Services

```bash
# Terminal 1
cd backend
source .venv/bin/activate
python run.py
```

```bash
# Terminal 2
cd frontend
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend docs: `http://localhost:8000/docs`

## Environment Variables

### Backend (`backend/.env`)

```env
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>/<db>?retryWrites=true&w=majority
GEMINI_API_KEY=<your-api-key>
PINECONE_API_KEY=<your-api-key>
PINECONE_INDEX=ncert-learning-rag
PINECONE_HOST=https://<your-index-host>.pinecone.io
APP_NAME=NCERT AI Learning Backend
APP_VERSION=1.0.0
DEBUG=True
FRONTEND_URL=http://localhost:5173
HOST=0.0.0.0
PORT=8000
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:8000
```

## Usage
1. Start backend and frontend.
2. Open `http://localhost:5173`.
3. Select class, subject, and chapter/book content.
4. Highlight any difficult text.
5. Choose an explanation mode.
6. Generate assessments and save notes for revision.

## API Endpoints

Base URL: `http://localhost:8000`

### Common Route Groups
- `/api/chat` and related chat workflows
- `/api/mcq` and evaluation flows
- `/api/assessment` and `/api/assessments`
- `/api/notes`, `/api/annotation`, `/api/history`
- `/api/books`, `/api/curriculum`
- `/api/student`, `/api/v1/student`, `/api/teacher`
- `/api/tests`, `/api/test`, `/api/question-bank`, `/api/question-papers`
- `/api/support`, `/api/support-tickets`, `/api/notifications`
- `/api/courses`, `/api/gradebook`

### Health and System
- `GET /` - service status
- `GET /health` - health check

For full API mapping, refer to `API_ENDPOINTS.md`.

## Architecture / How It Works

### RAG Pipeline
1. **Content ingestion**
   NCERT textbook content is parsed and prepared for chunk-level retrieval.
2. **Embedding and indexing**
   Context chunks are indexed in Pinecone vector storage.
3. **Context retrieval**
   User question + chapter context retrieves top relevant chunks.
4. **Grounded generation**
   Gemini receives prompt + retrieved context + explanation mode.
5. **Learning actions**
   Response is consumed by notes, assessment, and history workflows.

### Why this architecture
- Keeps educational responses anchored to syllabus content.
- Supports low-latency contextual help while reading PDFs.
- Enables modular growth into gradebook, courses, and analytics.

## Future Improvements
- Fine-grained RBAC hardening and audit trails.
- Streaming token responses for faster perceived latency.
- Better chapter-level analytics and teacher dashboards.
- Multi-language explanation modes and voice support.
- CI/CD and production deployment templates.

## Contributing Guidelines
1. Fork the repo.
2. Create a feature branch: `git checkout -b feature/<name>`.
3. Keep commits small and meaningful.
4. Run lint/tests before pushing.
5. Open a PR with summary and validation notes.

## License
MIT License. See `LICENSE`.
