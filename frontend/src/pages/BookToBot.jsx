import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PDFViewer from "../features/pdf/PDFViewer";
import LessonNavigation from "../features/lessons/LessonNavigation";
import UserSettingsPanel from "../components/UserSettingsPanel";
import ChatbotPanel from "../components/dashboard/ChatbotPanel";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { SUBJECTS_WITH_RAG } from "../constants/lessons";
import { Menu, X, Settings, MessageCircle, ArrowLeft, BookOpen, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import useUserStore from "../stores/userStore";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function BookToBot() {
  const navigate = useNavigate();
  const { user, setPreferredSubject, getAuthHeader } = useUserStore();

  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [currentLesson, setCurrentLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingLessons, setLoadingLessons] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [aiChatUnlocked, setAiChatUnlocked] = useState(false);

  const hasAISupport = currentLesson?.has_ai_support || SUBJECTS_WITH_RAG.includes(user.preferredSubject);

  useEffect(() => {
    fetchAvailableSubjects();
    if (user?.role === "student") {
      fetch(`${API_BASE}/api/student/my-features`, { headers: getAuthHeader() })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setAiChatUnlocked(data.features?.ai_chatbot === true); })
        .catch(() => {});
    } else {
      setAiChatUnlocked(true); // teachers/admins always have access
    }
  }, [user.classLevel]);

  useEffect(() => {
    if (user.preferredSubject) {
      fetchLessons(user.preferredSubject);
    }
  }, [user.preferredSubject, user.classLevel]);

  const fetchAvailableSubjects = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/books/student/subjects?class_level=${user.classLevel}`);

      if (response.ok) {
        const data = await response.json();
        const subjects = data.subjects || [];
        setAvailableSubjects(subjects);

        if (subjects.length === 0) {
          setLessons([]);
          setCurrentLesson(null);
        } else {
          
          const subjectNames = subjects.map(s => s.name);
          if (!subjectNames.includes(user.preferredSubject)) {
            
            setPreferredSubject(subjectNames[0]);
          }
        }
      } else {
        
        setLessons([]);
        setCurrentLesson(null);
      }
    } catch (err) {

      
      setLessons([]);
      setCurrentLesson(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchLessons = async (subject) => {
    try {
      setLoadingLessons(true);
      const response = await fetch(
        `${API_BASE}/api/books/student/lessons?class_level=${user.classLevel}&subject=${encodeURIComponent(subject)}`
      );

      if (response.ok) {
        const data = await response.json();
        const fetchedLessons = data.lessons || [];

        const lessonsWithAbsoluteUrls = fetchedLessons.map(lesson => ({
          ...lesson,
          pdfUrl: lesson.pdfUrl?.startsWith('http') ? lesson.pdfUrl : `${API_BASE}${lesson.pdfUrl}`
        }));

        setLessons(lessonsWithAbsoluteUrls);
        setCurrentLesson(lessonsWithAbsoluteUrls.length > 0 ? lessonsWithAbsoluteUrls[0] : null);
      } else {
        
        setLessons([]);
        setCurrentLesson(null);
      }
    } catch (err) {

      
      setLessons([]);
      setCurrentLesson(null);
    } finally {
      setLoadingLessons(false);
    }
  };

  const handleLessonSelect = (lesson) => {
    setCurrentLesson(lesson);
  };

  const handleSubjectChange = (subject) => {
    setPreferredSubject(subject);
  };

  if (loading) {
    return <LoadingSpinner message="Loading your books..." submessage="Preparing your learning materials" />;
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <div
        className={`flex-shrink-0 transition-all duration-300 ease-in-out ${sidebarOpen ? "w-80" : "w-0"
          } overflow-hidden border-r`}
      >
        <div className="h-full flex flex-col">
          <div className="p-4 border-b bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Select Subject</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableSubjects.length > 0 ? (
                availableSubjects.map((subject) => (
                  <Button
                    key={subject.name}
                    variant={user.preferredSubject === subject.name ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSubjectChange(subject.name)}
                    className="text-xs"
                  >
                    {subject.name}
                    {subject.has_ai_support && (
                      <span className="ml-1 text-[10px] bg-green-500/20 text-green-700 px-1 rounded">AI</span>
                    )}
                  </Button>
                ))
              ) : (
                ["Maths", "Social Science"].map((subject) => (
                  <Button
                    key={subject}
                    variant={user.preferredSubject === subject ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSubjectChange(subject)}
                    className="text-xs"
                  >
                    {subject}
                  </Button>
                ))
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Class {user.classLevel} • {lessons.length} Lessons Available
            </p>
          </div>

          {loadingLessons ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <LessonNavigation
              lessons={lessons}
              currentLesson={currentLesson}
              onLessonSelect={handleLessonSelect}
            />
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="px-6 py-4 border-b bg-card flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="hover:bg-primary/10 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Button>

          <div className="w-px h-6 bg-border" />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hover:bg-primary/10"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          <div className="flex-1">
            <h1 className="text-2xl font-bold text-primary">
              {currentLesson?.title || "Select a lesson"}
            </h1>
            {currentLesson?.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {currentLesson.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right mr-2">
              <p className="text-xs text-muted-foreground">Class {user.classLevel}</p>
              <p className="text-xs font-medium">{user.preferredSubject}</p>
            </div>

            {aiChatUnlocked ? (
              <Button
                variant="default"
                size="sm"
                onClick={() => setChatbotOpen(true)}
                className="bg-primary hover:bg-primary/90"
                disabled={!hasAISupport}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                AI Chat
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled
                className="opacity-50 cursor-not-allowed"
                title="AI Chat is locked for your account"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                AI Chat
              </Button>
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              className="hover:bg-primary/10"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {currentLesson ? (
            <PDFViewer
              pdfUrl={currentLesson.pdfUrl}
              currentLesson={currentLesson}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-muted-foreground">No lessons available</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Select a different subject or contact your admin
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <UserSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <ChatbotPanel
        isOpen={chatbotOpen && aiChatUnlocked}
        onClose={() => setChatbotOpen(false)}
      />
    </div>
  );
}

export default BookToBot;
