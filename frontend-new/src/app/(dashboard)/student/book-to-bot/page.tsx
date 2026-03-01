'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PDFViewer from '@/components/features/pdf/PDFViewer';
import LessonNavigation from '@/components/features/lessons/LessonNavigation';
import UserSettingsPanel from '@/components/common/UserSettingsPanel';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { SUBJECTS_WITH_RAG } from '@/constants/lessons';
import { Menu, X, Settings, MessageCircle, ArrowLeft, BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import useUserStore from '@/stores/userStore';
import type { Subject, Lesson } from '@/types/api.types';


const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function BookToBot() {
    const router = useRouter();
    const { user, setPreferredSubject, getAuthHeader } = useUserStore();

    const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingLessons, setLoadingLessons] = useState(false);

    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [aiChatUnlocked, setAiChatUnlocked] = useState(false);


    const hasAISupport = currentLesson?.has_ai_support || (user?.preferredSubject && SUBJECTS_WITH_RAG?.includes(user?.preferredSubject));

    useEffect(() => {
        fetchAvailableSubjects();
        if (user?.role === "student") {
            const headers = getAuthHeader();
            fetch(`${API_BASE}/api/student/my-features`, { headers })
                .then(r => r.ok ? r.json() : null)
                .then(data => { if (data) setAiChatUnlocked(data.features?.ai_chatbot === true); })
                .catch(() => { });
        } else {
            setAiChatUnlocked(true); // teachers/admins always have access
        }
    }, [user?.classLevel]);

    useEffect(() => {
        if (user?.preferredSubject) {
            fetchLessons(user.preferredSubject);
        }
    }, [user?.preferredSubject, user?.classLevel]);

    const fetchAvailableSubjects = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE}/api/books/student/subjects?class_level=${user?.classLevel || 6}`);

            if (response.ok) {
                const data = await response.json();
                const subjects: Subject[] = data.subjects || [];
                setAvailableSubjects(subjects);

                if (subjects.length === 0) {
                    setLessons([]);
                    setCurrentLesson(null);
                } else {
                    const subjectNames = subjects.map(s => s.name);
                    if (user?.preferredSubject && !subjectNames.includes(user.preferredSubject)) {
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

    const fetchLessons = async (subject: string) => {
        try {
            setLoadingLessons(true);
            const response = await fetch(
                `${API_BASE}/api/books/student/lessons?class_level=${user?.classLevel || 6}&subject=${encodeURIComponent(subject)}`
            );

            if (response.ok) {
                const data = await response.json();
                const fetchedLessons: Lesson[] = data.lessons || [];

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

    const handleLessonSelect = (lesson: Lesson) => {
        setCurrentLesson(lesson);
    };

    const handleSubjectChange = (subject: string) => {
        setPreferredSubject(subject);
    };

    if (loading) {
        return <LoadingSpinner message="Loading your books..." submessage="Preparing your learning materials" />;
    }

    return (
        <div className="flex h-[calc(100vh-theme(spacing.16))] w-full overflow-hidden bg-background">
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
                                        variant={user?.preferredSubject === subject.name ? "default" : "outline"}
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
                                        variant={user?.preferredSubject === subject ? "default" : "outline"}
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
                            Class {user?.classLevel || 6} • {lessons.length} Lessons Available
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
                        onClick={() => router.push('/student')}
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
                            <p className="text-xs text-muted-foreground">Class {user?.classLevel || 6}</p>
                            <p className="text-xs font-medium">{user?.preferredSubject}</p>
                        </div>

                        {aiChatUnlocked ? (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => router.push('/ai-chat')}
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
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
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
        </div>
    );
}

export default BookToBot;
