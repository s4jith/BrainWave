import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PDFViewer from "../features/pdf/PDFViewer";
import LessonNavigation from "../features/lessons/LessonNavigation";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { Menu, X, ArrowLeft, BookOpen, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../components/ui/button";
import useUserStore from "../stores/userStore";
import authFetch from "../utils/authFetch";

const API_BASE = import.meta.env.VITE_API_URL;

function BookToBot() {
  const navigate = useNavigate();
  const { user, setPreferredSubject, getAuthHeader } = useUserStore();

  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [currentLesson, setCurrentLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingLessons, setLoadingLessons] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    fetchAvailableSubjects();
  }, [user.classLevel]);

  useEffect(() => {
    if (user.preferredSubject) {
      fetchLessons(user.preferredSubject);
    }
  }, [user.preferredSubject, user.classLevel]);

  const fetchAvailableSubjects = async () => {
    try {
      setLoading(true);
      const response = await authFetch(`${API_BASE}/api/books/student/subjects?class_level=${user.classLevel}`);

      if (response.ok) {
        const data = await response.json();
        const allSubjects = data.subjects || [];
        const pineconeSubjects = allSubjects.filter((s) => s?.has_ai_support === true);
        const subjects = pineconeSubjects.length > 0 ? pineconeSubjects : allSubjects;
        setAvailableSubjects(subjects);

        if (subjects.length === 0) {
          setLessons([]);
          setCurrentLesson(null);
        } else {
          
          const subjectNames = subjects.map((s) => s?.name).filter(Boolean);
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
      const response = await authFetch(
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
    <div className="flex h-full w-full overflow-hidden bg-background relative">
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
            <select
              value={user.preferredSubject || ""}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {availableSubjects.length > 0 ? (
                availableSubjects.map((subject) => (
                  <option key={subject.name} value={subject.name}>
                    {subject.name}
                  </option>
                ))
              ) : (
                <option value="" disabled>
                  No AI-ready subjects available
                </option>
              )}
            </select>
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

      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="hidden lg:flex absolute top-1/2 -translate-y-1/2 z-40 w-7 h-14 items-center justify-center rounded-r-xl border border-l-0 border-gray-200 bg-white text-gray-500 hover:text-orange-600 hover:border-orange-300 transition-all"
        style={{ left: sidebarOpen ? 320 : 12 }}
        title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

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

    </div>
  );
}

export default BookToBot;
