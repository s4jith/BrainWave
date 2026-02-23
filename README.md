# NCERT AI Learning Platform - Production Ready 🚀

##  Features

### Fully Integrated RAG Chatbot
- **AI Explanations**: 5 modes (Simple, Meaning, Story, Example, Summary)
- **Greeting Detection**: Cost-optimized (no LLM calls for greetings)
- **Strict RAG**: No hallucination - only context-based answers
- **Vector Database**: 2,193 embeddings from 16 NCERT PDFs in Pinecone
- **AI Model**: Gemini 2.5 Flash

### Backend (FastAPI)
- **RAG Chat API**: `/api/chat/` - Context-aware explanations
- **MCQ Generation**: `/api/mcq/generate` - Auto-generate questions
- **Evaluation**: `/api/evaluate/mcq` & `/api/evaluate/assessment`
- **Notes Management**: `/api/notes/` - CRUD operations
- **MongoDB Atlas**: Persistent storage
- **Pinecone**: Vector search

### Frontend (React + Vite)
- **PDF Viewer**: 16 NCERT Social Science lessons
- **AI Panel**: Real-time explanations via backend
- **Notes System**: Highlight and save notes
- **Assessment**: Voice-based testing (coming soon)

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- MongoDB Atlas account
- Pinecone account
- Google Gemini API key

### 1. Backend Setup

```bash
cd ncert_backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file (copy from .env.example)
copy .env.example .env

# Add your API keys to .env:
# - GEMINI_API_KEY
# - PINECONE_API_KEY
# - PINECONE_HOST
# - MONGO_URI

# Run backend
python run.py
```

Backend will start at: **http://localhost:8000**  
API Docs: **http://localhost:8000/docs**

### 2. Frontend Setup

```bash
cd client

# Install dependencies
npm install

# Run frontend
npm run dev
```

Frontend will start at: **http://localhost:5173**

---

## Usage

### 1. Open the App
Visit **http://localhost:5173** in your browser

### 2. Select a Lesson
Choose from 14 NCERT Social Science lessons

### 3. Highlight Text
Select any text in the PDF viewer

### 4. Ask AI
- Click the AI icon
- Choose explanation mode (Simple, Meaning, Story, Example, Summary)
- Get instant AI-powered explanations from the backend!

### 5. Save Notes
- Add heading and content
- Notes are saved to MongoDB
- Access them anytime

---

## 🔧 API Endpoints

### Chat / RAG
```
POST /api/chat/
Body: {
  "class_level": 6,
  "subject": "Social Science",
  "chapter": 1,
  "highlight_text": "What are latitudes?",
  "mode": "simple"
}
```

### Generate MCQs
```
POST /api/mcq/generate
Body: {
  "class_level": 6,
  "subject": "Social Science",
  "chapter": 1,
  "num_questions": 5
}
```

### Create Note
```
POST /api/notes/
Body: {
  "student_id": "student123",
  "class_level": 6,
  "subject": "Social Science",
  "chapter": 1,
  "page_number": 5,
  "highlight_text": "Selected text",
  "note_content": "My note",
  "heading": "Important concept"
}
```

---

## 🗂️ Project Structure

```
ncert-working-2/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── services/         # API integration
│   │   ├── contexts/         # React contexts
│   │   └── assets/           # PDFs and images
│   └── package.json
│
├── ncert_backend/            # FastAPI backend
│   ├── app/
│   │   ├── routers/         # API endpoints
│   │   ├── services/        # Business logic
│   │   ├── models/          # Pydantic schemas
│   │   └── db/              # Database connections
│   ├── scripts/             # Utility scripts
│   └── requirements.txt
│
└── README.md
```

---

## 🧪 Testing

### Test Backend
```bash
cd ncert_backend
python scripts/test_chatbot.py
```

### Test Frontend
1. Start backend (`python run.py`)
2. Start frontend (`npm run dev`)
3. Open browser and test AI panel with text selection

---

## 🎨 Frontend Integration

The frontend is fully integrated with the backend:

### `client/src/services/api.js`
- **chatService**: AI explanations via RAG
- **mcqService**: MCQ generation and evaluation
- **notesService**: CRUD operations for notes
- **assessmentService**: Voice assessment submission

### `client/src/components/annotations/AIPanel.jsx`
- Real-time AI explanations
- 5 explanation modes
- Error handling
- Loading states

---

## 📦 Technologies

### Backend
- **Framework**: FastAPI
- **AI**: Google Gemini 2.5 Flash
- **Vector DB**: Pinecone (2,193 embeddings)
- **Database**: MongoDB Atlas
- **OCR**: Tesseract + Poppler

### Frontend
- **Framework**: React 18 + Vite
- **UI**: Tailwind CSS + shadcn/ui
- **PDF**: react-pdf
- **State**: React Context API

---

## 🔐 Environment Variables

### Backend (`.env`)
```env
# API Keys
GEMINI_API_KEY=your_gemini_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_HOST=your_pinecone_host
MONGO_URI=your_mongodb_connection_string

# Server Config
HOST=0.0.0.0
PORT=8000
DEBUG=true
FRONTEND_URL=http://localhost:5173
```

### Frontend (`.env`)
```env
VITE_API_BASE_URL=http://localhost:8000/api
```

---

## 📈 Performance

- **Vector Search**: 0.7084 similarity score (excellent!)
- **Response Time**: <2 seconds for AI explanations
- **Database**: 2,193 vectors, 768 dimensions
- **Greeting Detection**: 0ms (no API calls)

---

##  Next Steps

- [ ] Add authentication (JWT)
- [ ] Deploy to production (Vercel + Railway)
- [ ] Add more subjects and classes
- [ ] Implement voice assessment UI
- [ ] Add real-time collaboration
- [ ] Add progress tracking

---

## 🤝 Contributing

This is a production-ready educational platform. To contribute:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📝 License

MIT License - See LICENSE file for details

---

## 🙏 Acknowledgments

- NCERT for educational content
- Google Gemini for AI capabilities
- Pinecone for vector search
- MongoDB for database
- FastAPI & React communities

---

## 💡 Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/Winterbear0701/ncert-working-2/issues)
- Documentation: Check `/docs` endpoint on backend

---

**Made with ❤️ for NCERT Students**
