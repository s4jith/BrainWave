# RAG Architecture & Gemini API Integration

## Complete Technical Documentation

---

## 1. System Overview

The NCERT Learning Platform uses a **Retrieval-Augmented Generation (RAG)** system to answer student questions from their textbooks. Instead of relying on Gemini's general knowledge, the system retrieves relevant textbook content first, then uses Gemini only to format/explain that content.

```
Student Question
       │
       ▼
┌──────────────┐
│  Embedding   │  Gemini gemini-embedding-001 (768-dim)
│  Generation  │  Task: RETRIEVAL_QUERY
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────┐
│     Triple-Index Pinecone Query      │
│  ┌────────────┐ ┌──────┐ ┌───────┐  │
│  │  Textbook  │ │ LLM  │ │  Web  │  │
│  │   Index    │ │Cache │ │Content│  │
│  └────────────┘ └──────┘ └───────┘  │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────┐
│   Cache Hit Check        │
│   Score >= 0.80 ?        │
│   YES → Return cached    │
│   NO  → Continue to LLM  │
└──────────┬───────────────┘
           │ (Cache Miss)
           ▼
┌──────────────────────────┐
│  Gemini 2.5 Flash        │
│  Stream=True (SSE)       │
│  Prompt + Textbook       │
│  Context → Answer        │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│  Store Answer in LLM     │
│  Cache (Pinecone ncert-  │
│  llm) for future reuse   │
└──────────────────────────┘
```

---

## 2. Embedding Model

| Property | Value |
|----------|-------|
| **Model** | `gemini-embedding-001` |
| **API** | Gemini REST API (direct HTTP, no SDK) |
| **Dimension** | 768 (truncated via `outputDimensionality`) |
| **Task Types** | `RETRIEVAL_DOCUMENT` (indexing), `RETRIEVAL_QUERY` (search) |
| **File** | `backend/app/utils/embedding_helper.py` |

### How Embeddings Work
1. Student types a question → converted to 768-dim vector using `RETRIEVAL_QUERY` task type
2. Textbook content was pre-indexed using `RETRIEVAL_DOCUMENT` task type
3. Cosine similarity between query vector and stored vectors finds relevant content
4. **Critical**: Same model must be used for both indexing and querying

### Embedding Generation Code
```python
# backend/app/utils/embedding_helper.py
url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent"
payload = {
    "model": "models/gemini-embedding-001",
    "content": {"parts": [{"text": text}]},
    "taskType": "RETRIEVAL_QUERY",  # or RETRIEVAL_DOCUMENT for indexing
    "outputDimensionality": 768     # Match Pinecone index dimension
}
```

---

## 3. Pinecone Vector Database (3 Indexes)

### 3.1 Textbook Index: `ncert-all-subjects`
| Property | Value |
|----------|-------|
| **Purpose** | Store textbook content (PDFs) |
| **Dimension** | 768 |
| **Namespaces** | `mathematics`, `physics`, `chemistry`, `english`, `hindi` |
| **Total Vectors** | ~502 |
| **Metadata** | `class_level` (int), `chapter_number` (int), `subject` (str), `page_number` (int), `text` (str) |

**Query Flow:**
1. Build filter: `{"class_level": {"$in": [10]}}` (student's class)
2. ANN search with cosine similarity
3. Threshold: 0.03 (Gemini embeddings produce lower similarity scores)
4. Fallback: If no results with filter, retry without filter

### 3.2 LLM Cache Index: `ncert-llm`
| Property | Value |
|----------|-------|
| **Purpose** | Cache previously generated answers |
| **Dimension** | 768 |
| **Namespaces** | Per subject (e.g., `mathematics`) |
| **Metadata** | `question`, `answer`, `subject`, `topic`, `class_level`, `quality_score` |

**Cache Hit Flow:**
1. Generate embedding for student's question (same Gemini model)
2. Query LLM cache with embedding
3. If score >= 0.80 → **Cache Hit** → Return cached answer (saves Gemini API call)
4. If score < 0.80 → **Cache Miss** → Generate new answer with Gemini

### 3.3 Web Content Index: `ncert-web-content`
| Property | Value |
|----------|-------|
| **Purpose** | Supplementary web-scraped content |
| **Usage** | Deep Dive mode only |
| **Status** | Currently disabled to save API calls |

---

## 4. Gemini API Integration

### 4.1 Model Configuration
| Property | Value |
|----------|-------|
| **Model** | `gemini-2.5-flash` |
| **API Keys** | 9 keys with rotation (20 req/key/day = 180 total) |
| **Key Rotation** | Automatic on 429 rate limit or invalid key |
| **File** | `backend/app/services/gemini_service.py` |

### 4.2 Key Rotation System
```python
# backend/app/services/gemini_key_manager.py
# Keys loaded from .env: GEMINI_API_KEY_1 through GEMINI_API_KEY_9
# On 429 error → rotate to next key
# On invalid key → mark as invalid, skip in future
# Each key: ~20 requests/day (resets midnight Pacific Time)
```

### 4.3 Non-Streaming (Regular) Response
```python
# Used for: annotation, assessment, non-chat endpoints
model = genai.GenerativeModel('models/gemini-2.5-flash')
response = model.generate_content(prompt)
return response.text
```

### 4.4 Streaming Response
```python
# Used for: chat endpoint (real-time typing effect)
response = model.generate_content(prompt, stream=True)
for chunk in response:
    if chunk.text:
        yield chunk.text  # Each chunk sent immediately via SSE
```

---

## 5. Chat Streaming Pipeline (End-to-End)

### Backend Flow (`backend/app/routers/chat.py`)
```
1. POST /api/chat/student/stream
   │
2. Generate embedding (Gemini gemini-embedding-001, 768-dim)
   │  ~500ms
   │
3. Query Pinecone textbook index (parallel)
   │  ~300ms
   │
4. Query Pinecone LLM cache (parallel)
   │  ~300ms
   │
5. Cache hit? (score >= 0.80)
   │  YES → Stream cached answer in 50-char chunks → DONE
   │  NO  → Continue
   │
6. Build prompt with retrieved textbook context
   │
7. Gemini streaming (stream=True)
   │  Each chunk → SSE: data: {"text": "chunk..."}\n\n
   │  ~2-5 seconds for full response
   │
8. Send done signal: data: {"done": true, "sources": [...]}\n\n
   │
9. Store answer in LLM cache (background, non-blocking)
```

### SSE (Server-Sent Events) Format
```
data: {"text": "An irrational number"}

data: {"text": " is a number that cannot"}

data: {"text": " be expressed as a fraction."}

data: {"done": true, "sources": [...], "total_length": 156}
```

### Frontend Flow (`frontend/src/services/api.js` + `ChatbotPanel.jsx`)
```
1. fetch('/api/chat/student/stream', { method: 'POST', body: {...} })
   │
2. ReadableStream reader = response.body.getReader()
   │
3. While not done:
   │  Read chunk from stream
   │  Decode to text
   │  Split by "\n\n" (SSE message boundary)
   │  Parse JSON from "data: {...}"
   │
4. On each text chunk:
   │  fullAnswer += chunk.text
   │  setMessages(prev => update message content)
   │  → React re-renders → user sees text appear incrementally
   │
5. On done signal:
   │  Mark streaming complete
   │  Track question for analytics
   │  Refresh frequent questions list
```

### Threading Architecture for Real-Time Streaming
```python
# The Gemini SDK streaming is synchronous (blocks event loop)
# Solution: Run in background thread, communicate via queue

chunk_queue = Queue()

Thread → gemini_service.generate_response_streaming(prompt)
       → for each chunk: queue.put(("chunk", text))
       → queue.put(("done", None))

Async Generator → while True:
                → await asyncio.sleep(0.01)  # Non-blocking poll
                → msg = queue.get()
                → yield SSE data
```

---

## 6. Two Chat Modes

### Quick Mode
- Searches only student's current class (e.g., Class 10)
- Returns top 3 textbook chunks
- Prompt: Direct, exam-style answer
- Speed: Fastest

### Deep Dive Mode
- Searches from earliest available class up to current
- Includes web content (if enabled)
- Prompt: Comprehensive explanation with fundamentals → core → deep dive → key takeaways
- Speed: Slower but more thorough

---

## 7. Anti-Hallucination System

### Problem
Gemini may generate answers using its own knowledge instead of textbook content, leading to incorrect information for students.

### Solution: Multi-Layer Defense

1. **RAG-First Architecture**: Gemini only receives textbook content as context, not asked to use general knowledge
2. **Prompt Engineering**: Explicit instructions to use ONLY the provided content
3. **Not-Found Detection**: If retrieved content doesn't match the question topic, Gemini returns: *"The content is not found in the book, ask some other questions related to your subject."*
4. **No General Knowledge Fallback**: When no content is found, system returns the not-found message instead of letting Gemini answer freely
5. **Source Tracking**: Every answer tracks which textbook chunks (class, chapter, page) were used

### When "Not Found" is Returned
- Student asks about a topic NOT in their textbook (e.g., "what is animal" in math class)
- Retrieved textbook chunks are about a completely different topic
- No content found in Pinecone for the query

### When Answer IS Given
- Retrieved textbook content directly relates to the question
- Content from the same chapter/topic exists in the database

---

## 8. LLM Caching System

### Purpose
Avoid calling Gemini API for the same/similar questions, saving API quota and reducing response time.

### How It Works
```
Question: "Explain Fundamental Theorem of Arithmetic"
         │
         ▼
  Generate Gemini Embedding (768-dim)
         │
         ▼
  Query ncert-llm index (namespace: mathematics)
         │
         ▼
  Score >= 0.80? ──YES──► Return cached answer (~50ms)
         │
         NO
         │
         ▼
  Generate new answer with Gemini (~3-5s)
         │
         ▼
  Store answer with Gemini embedding in ncert-llm
  (Same embedding model for store & query = consistent similarity scores)
```

### Key Design Decision
Both storing and querying use the **same Gemini embedding model** (`gemini-embedding-001`). This ensures similarity scores are meaningful — identical questions score ~0.95+, similar questions ~0.80-0.90.

**File:** `backend/app/services/llm_storage_service.py`

---

## 9. Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Embedding generation | ~500ms | Gemini REST API call |
| Pinecone query (textbook) | ~200-400ms | Depends on filter complexity |
| Pinecone query (LLM cache) | ~200-300ms | Parallel with textbook query |
| Cache hit response | ~100ms | Stream cached text in chunks |
| Gemini streaming (first token) | ~1-2s | Time to first token from Gemini |
| Gemini streaming (full response) | ~3-8s | Depends on answer length |
| **Total (cache hit)** | **~1s** | No Gemini API call needed |
| **Total (cache miss)** | **~4-10s** | Full pipeline with streaming |

### Speed Optimizations
1. **Single embedding generation** — one embedding used for both textbook and LLM cache queries
2. **LLM caching** — repeated questions served from cache (~1s vs ~5-10s)
3. **Streaming** — user sees text appear as Gemini generates (real-time typing effect)
4. **Thread-based streaming** — Gemini synchronous SDK doesn't block FastAPI async event loop
5. **Background storage** — caching answer doesn't block response delivery

---

## 10. File Reference

| File | Purpose |
|------|---------|
| `backend/app/routers/chat.py` | Chat endpoints (streaming SSE, non-streaming, image chat) |
| `backend/app/services/enhanced_rag_service.py` | Core RAG service with multi-index retrieval |
| `backend/app/services/gemini_service.py` | Gemini API wrapper with key rotation and streaming |
| `backend/app/services/gemini_key_manager.py` | Multi-key rotation and quota management |
| `backend/app/services/llm_storage_service.py` | LLM answer caching with Gemini embeddings |
| `backend/app/utils/embedding_helper.py` | Gemini embedding REST API helper (768-dim) |
| `backend/app/db/mongo.py` | MongoDB + Pinecone database connections |
| `frontend/src/services/api.js` | Frontend API service with SSE streaming |
| `frontend/src/components/dashboard/ChatbotPanel.jsx` | Chat UI with real-time streaming display |

---

## 11. Environment Variables

```env
# Gemini API Keys (9 keys, ~20 req/key/day)
GEMINI_API_KEY_1=...
GEMINI_API_KEY_2=...
...
GEMINI_API_KEY_9=...

# Pinecone
PINECONE_API_KEY=...
PINECONE_MASTER_INDEX=ncert-all-subjects      # Textbook content
PINECONE_MASTER_HOST=https://ncert-all-subjects-xxx.pinecone.io
PINECONE_LLM_INDEX=ncert-llm                  # LLM answer cache
PINECONE_LLM_HOST=https://ncert-llm-xxx.pinecone.io
PINECONE_WEB_INDEX=ncert-web-content           # Web content (deep dive)
PINECONE_WEB_HOST=https://ncert-web-content-xxx.pinecone.io
```

---

## 12. Data Flow Diagram

```
┌─────────────┐    ┌──────────────┐    ┌───────────────────┐
│   Student    │───►│   Frontend   │───►│   FastAPI Backend  │
│   Browser    │◄───│  React+Vite  │◄───│   Python 3.14      │
└─────────────┘    └──────────────┘    └─────────┬─────────┘
     SSE Stream          SSE Stream              │
     (typing effect)     (ReadableStream)        │
                                                 ▼
                                    ┌────────────────────────┐
                                    │   Enhanced RAG Service  │
                                    │                        │
                                    │  1. Generate Embedding  │
                                    │  2. Query Pinecone ×3   │
                                    │  3. Check LLM Cache     │
                                    │  4. Build Prompt        │
                                    │  5. Stream from Gemini  │
                                    │  6. Cache Answer        │
                                    └────────┬───────────────┘
                                             │
                              ┌──────────────┼──────────────┐
                              ▼              ▼              ▼
                    ┌──────────────┐ ┌────────────┐ ┌────────────┐
                    │   Pinecone   │ │  Pinecone  │ │   Gemini   │
                    │  Textbook    │ │  LLM Cache │ │  2.5 Flash │
                    │  (768-dim)   │ │  (768-dim) │ │  (Stream)  │
                    └──────────────┘ └────────────┘ └────────────┘
```
