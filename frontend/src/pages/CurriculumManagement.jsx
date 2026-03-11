import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    BookOpen, ChevronRight, ChevronDown, Save, Edit3, X, Check,
    ArrowLeft, Loader2, BookMarked, FileText, AlertCircle
} from "lucide-react";
import { Button } from "../components/ui/button";
import SubjectIcon from "../components/SubjectIcon";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function CurriculumManagement() {
    const navigate = useNavigate();
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedSubject, setExpandedSubject] = useState(null);
    const [editingChapter, setEditingChapter] = useState(null); 
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null); 
    const editorRef = useRef(null);

    useEffect(() => {
        fetchSubjects();
    }, []);

    const fetchSubjects = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/api/curriculum/subjects?is_active=true`);
            if (!res.ok) throw new Error("Failed to fetch subjects");
            const data = await res.json();
            setSubjects(data);
        } catch (err) {
            console.error("Failed to fetch subjects:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSubjectDetails = async (subjectId) => {
        try {
            const res = await fetch(`${API_BASE}/api/curriculum/subjects/${subjectId}`);
            if (!res.ok) throw new Error("Failed to fetch subject details");
            const data = await res.json();
            return data;
        } catch (err) {
            console.error("Failed to fetch subject details:", err);
            return null;
        }
    };

    const handleExpandSubject = async (subject) => {
        if (expandedSubject?.subject_id === subject.subject_id) {
            setExpandedSubject(null);
            return;
        }
        const details = await fetchSubjectDetails(subject.subject_id);
        if (details) {
            setExpandedSubject(details);
        }
    };

    const openEditor = (subjectId, chapter) => {
        setEditingChapter({
            subjectId,
            chapterId: chapter.chapter_id,
            chapterName: chapter.chapter_name,
            chapterNumber: chapter.chapter_number,
            summary: chapter.summary || ""
        });
        setSaveStatus(null);
    };

    useEffect(() => {
        if (editingChapter && editorRef.current) {
            editorRef.current.innerHTML = editingChapter.summary || "";
            editorRef.current.focus();
        }
    }, [editingChapter]);

    const execFormat = useCallback((command, value = null) => {
        editorRef.current?.focus();
        document.execCommand(command, false, value);
    }, []);

    const handleSave = async () => {
        if (!editingChapter) return;
        setSaving(true);
        setSaveStatus(null);
        try {
            const summaryHtml = editorRef.current?.innerHTML || "";
            const res = await fetch(
                `${API_BASE}/api/curriculum/subjects/${editingChapter.subjectId}/chapters/${editingChapter.chapterId}/summary`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ summary: summaryHtml })
                }
            );
            if (!res.ok) throw new Error("Failed to save summary");
            setSaveStatus("success");
            
            if (expandedSubject) {
                const updatedChapters = expandedSubject.chapters.map(ch =>
                    ch.chapter_id === editingChapter.chapterId
                        ? { ...ch, summary: summaryHtml }
                        : ch
                );
                setExpandedSubject({ ...expandedSubject, chapters: updatedChapters });
            }
            setTimeout(() => {
                setEditingChapter(null);
                setSaveStatus(null);
            }, 1200);
        } catch (err) {
            console.error("Save failed:", err);
            setSaveStatus("error");
        } finally {
            setSaving(false);
        }
    };

    const FONT_SIZES = [
        { label: "S", value: "1" },
        { label: "M", value: "3" },
        { label: "L", value: "5" },
        { label: "XL", value: "7" },
    ];

    const FONT_FAMILIES = [
        { label: "Sans", value: "Arial, sans-serif" },
        { label: "Serif", value: "Georgia, serif" },
        { label: "Mono", value: "Courier New, monospace" },
    ];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
            {}
            <div className="bg-white dark:bg-gray-900 border-b px-6 py-4 flex items-center gap-4 shadow-sm">
                <Button variant="ghost" size="sm" onClick={() => navigate("/admin-dashboard")} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Dashboard
                </Button>
                <div className="w-px h-6 bg-border" />
                <BookMarked className="h-5 w-5 text-indigo-600" />
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Curriculum Management</h1>
                    <p className="text-xs text-gray-500">Write chapter summaries shown to students in Book to Bot</p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto p-6">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                    </div>
                ) : subjects.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
                        <p className="text-lg font-medium">No subjects found</p>
                        <p className="text-sm mt-1">Create subjects in Subjects Management first</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {subjects.map((subject) => (
                            <div key={subject.subject_id} className="bg-white dark:bg-gray-900 rounded-xl border shadow-sm overflow-hidden">
                                {/* Subject Header */}
                                <button
                                    onClick={() => handleExpandSubject(subject)}
                                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                                            style={{ backgroundColor: subject.color + "20" }}
                                        >
                                            <SubjectIcon name={subject.subject_name} size="w-5 h-5" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-semibold text-gray-900 dark:text-white">{subject.subject_name}</p>
                                            <p className="text-xs text-gray-500">Class {subject.class_level} · {subject.total_chapters} chapters</p>
                                        </div>
                                    </div>
                                    {expandedSubject?.subject_id === subject.subject_id
                                        ? <ChevronDown className="h-5 w-5 text-gray-400" />
                                        : <ChevronRight className="h-5 w-5 text-gray-400" />
                                    }
                                </button>

                                {/* Chapters List */}
                                {expandedSubject?.subject_id === subject.subject_id && (
                                    <div className="border-t divide-y dark:divide-gray-800">
                                        {expandedSubject.chapters.length === 0 ? (
                                            <p className="px-5 py-4 text-sm text-gray-400">No chapters found</p>
                                        ) : (
                                            expandedSubject.chapters.map((chapter) => (
                                                <div key={chapter.chapter_id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs font-bold text-gray-400 w-8">Ch.{chapter.chapter_number}</span>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{chapter.chapter_name}</p>
                                                            {chapter.summary ? (
                                                                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mt-0.5">
                                                                    <Check className="h-3 w-3" /> Summary written
                                                                </p>
                                                            ) : (
                                                                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                                                    <AlertCircle className="h-3 w-3" /> No summary yet
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant={chapter.summary ? "outline" : "default"}
                                                        onClick={() => openEditor(subject.subject_id, chapter)}
                                                        className="gap-1.5 text-xs"
                                                    >
                                                        <Edit3 className="h-3.5 w-3.5" />
                                                        {chapter.summary ? "Edit Summary" : "Write Summary"}
                                                    </Button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Rich Text Editor Modal */}
            {editingChapter && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 dark:bg-gray-800">
                            <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-indigo-600" />
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Chapter {editingChapter.chapterNumber} Summary</p>
                                    <h2 className="font-bold text-gray-900 dark:text-white text-lg leading-tight">{editingChapter.chapterName}</h2>
                                </div>
                            </div>
                            <button
                                onClick={() => setEditingChapter(null)}
                                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            >
                                <X className="h-5 w-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Toolbar */}
                        <div className="flex flex-wrap items-center gap-1 px-4 py-2 border-b bg-white dark:bg-gray-900">
                            {/* Text style */}
                            <button onClick={() => execFormat("bold")} className="toolbar-btn font-bold" title="Bold (Ctrl+B)">B</button>
                            <button onClick={() => execFormat("italic")} className="toolbar-btn italic" title="Italic (Ctrl+I)">I</button>
                            <button onClick={() => execFormat("underline")} className="toolbar-btn underline" title="Underline (Ctrl+U)">U</button>
                            <button onClick={() => execFormat("strikeThrough")} className="toolbar-btn line-through" title="Strikethrough">S</button>

                            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

                            {/* Font size */}
                            <span className="text-xs text-gray-400 mr-1">Size:</span>
                            {FONT_SIZES.map(({ label, value }) => (
                                <button
                                    key={value}
                                    onClick={() => execFormat("fontSize", value)}
                                    className="toolbar-btn text-xs px-2"
                                    title={`Font size ${label}`}
                                >
                                    {label}
                                </button>
                            ))}

                            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

                            {/* Font family */}
                            <span className="text-xs text-gray-400 mr-1">Font:</span>
                            {FONT_FAMILIES.map(({ label, value }) => (
                                <button
                                    key={label}
                                    onClick={() => execFormat("fontName", value)}
                                    className="toolbar-btn text-xs px-2"
                                    style={{ fontFamily: value }}
                                    title={`${label} font`}
                                >
                                    {label}
                                </button>
                            ))}

                            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

                            {/* Lists & alignment */}
                            <button onClick={() => execFormat("insertUnorderedList")} className="toolbar-btn" title="Bullet list">• List</button>
                            <button onClick={() => execFormat("insertOrderedList")} className="toolbar-btn" title="Numbered list">1. List</button>

                            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

                            {/* Colors */}
                            <span className="text-xs text-gray-400 mr-1">Color:</span>
                            {["#1e293b", "#dc2626", "#2563eb", "#16a34a", "#9333ea", "#ea580c"].map(color => (
                                <button
                                    key={color}
                                    onClick={() => execFormat("foreColor", color)}
                                    className="w-5 h-5 rounded-full border border-gray-200 hover:scale-110 transition-transform"
                                    style={{ backgroundColor: color }}
                                    title={color}
                                />
                            ))}

                            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

                            {/* Highlight */}
                            <span className="text-xs text-gray-400 mr-1">Highlight:</span>
                            {["#fef08a", "#bbf7d0", "#bfdbfe", "#fecaca"].map(color => (
                                <button
                                    key={color}
                                    onClick={() => execFormat("hiliteColor", color)}
                                    className="w-5 h-5 rounded border border-gray-200 hover:scale-110 transition-transform"
                                    style={{ backgroundColor: color }}
                                    title="Highlight"
                                />
                            ))}

                            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
                            <button onClick={() => execFormat("removeFormat")} className="toolbar-btn text-xs text-red-500" title="Clear formatting">Clear</button>
                        </div>

                        {/* Editor Area */}
                        <div className="flex-1 overflow-auto p-6">
                            <div
                                ref={editorRef}
                                contentEditable
                                suppressContentEditableWarning
                                className="min-h-full outline-none text-gray-800 dark:text-gray-200 text-base leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                                style={{ minHeight: "300px" }}
                                data-placeholder="Write the chapter summary here... Use the toolbar above to format text with bold, italic, colors, and more."
                            />
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 dark:bg-gray-800">
                            <p className="text-xs text-gray-500">
                                This summary will be shown to students when they click "Summarize Chapter" in Book to Bot
                            </p>
                            <div className="flex items-center gap-3">
                                {saveStatus === "success" && (
                                    <span className="text-sm text-green-600 flex items-center gap-1">
                                        <Check className="h-4 w-4" /> Saved!
                                    </span>
                                )}
                                {saveStatus === "error" && (
                                    <span className="text-sm text-red-500 flex items-center gap-1">
                                        <AlertCircle className="h-4 w-4" /> Save failed
                                    </span>
                                )}
                                <Button variant="outline" onClick={() => setEditingChapter(null)}>Cancel</Button>
                                <Button onClick={handleSave} disabled={saving} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    {saving ? "Saving..." : "Save Summary"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        .toolbar-btn {
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          background: transparent;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all 0.15s;
          line-height: 1.4;
        }
        .toolbar-btn:hover {
          background: #f3f4f6;
          border-color: #e5e7eb;
        }
        .dark .toolbar-btn {
          color: #d1d5db;
        }
        .dark .toolbar-btn:hover {
          background: #374151;
          border-color: #4b5563;
        }
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>
        </div>
    );
}
