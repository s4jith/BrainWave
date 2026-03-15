
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../components/AdminLayout";
import AIExtractionModal from "../components/AIExtractionModal";
import PendingCurriculumReview from "../components/PendingCurriculumReview";
import SubjectIcon from "../components/SubjectIcon";
import {
  BookOpen, Plus, Search, Trash2, Edit2, ChevronDown, ChevronRight,
  Loader2, FileText, List, BookMarked, X, Check, Save, AlertCircle, Sparkles, Clock
} from "lucide-react";
import authFetch from "../utils/authFetch";

import { useToast } from "../contexts/ToastContext";
const API_URL = import.meta.env.VITE_API_URL;

export default function SubjectsManagement() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");

  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [showAIExtractionModal, setShowAIExtractionModal] = useState(false);
  const [showPendingReview, setShowPendingReview] = useState(false);

  const [subjectForm, setSubjectForm] = useState({
    subject_name: "",
    class_level: 10,
    description: ""
  });

  const [chapterForm, setChapterForm] = useState({
    chapter_number: 1,
    chapter_name: "",
    description: ""
  });

  const [topicForm, setTopicForm] = useState({
    topic_name: "",
    description: "",
    page_range: "",
    difficulty_level: "medium"
  });

  const [expandedSubjects, setExpandedSubjects] = useState({});
  const [expandedChapters, setExpandedChapters] = useState({});

  const [editingSubject, setEditingSubject] = useState(null);
  const [editingChapter, setEditingChapter] = useState(null);
  const [editingTopic, setEditingTopic] = useState(null);

  const [submitting, setSubmitting] = useState(false);

  const [summaryModal, setSummaryModal] = useState(null); 
  const [summarySaving, setSummarySaving] = useState(false);
  const [summarySaveStatus, setSummarySaveStatus] = useState(null);
  const summaryEditorRef = useRef(null);

  const execFormat = useCallback((command, value = null) => {
    summaryEditorRef.current?.focus();
    document.execCommand(command, false, value);
  }, []);

  const openSummaryEditor = (chapter) => {
    setSummaryModal({
      subjectId: selectedSubject.subject_id,
      chapterId: chapter.chapter_id,
      chapterName: chapter.chapter_name,
      chapterNumber: chapter.chapter_number,
      summary: chapter.summary || ""
    });
    setSummarySaveStatus(null);
  };

  useEffect(() => {
    if (summaryModal && summaryEditorRef.current) {
      summaryEditorRef.current.innerHTML = summaryModal.summary || "";
      summaryEditorRef.current.focus();
    }
  }, [summaryModal]);

  const handleSaveSummary = async () => {
    if (!summaryModal) return;
    setSummarySaving(true);
    setSummarySaveStatus(null);
    try {
      const html = summaryEditorRef.current?.innerHTML || "";
      const res = await authFetch(
        `${API_URL}/api/curriculum/subjects/${summaryModal.subjectId}/chapters/${summaryModal.chapterId}/summary`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summary: html })
        }
      );
      if (!res.ok) throw new Error("Save failed");
      setSummarySaveStatus("success");
      
      if (selectedSubject) {
        const updatedChapters = selectedSubject.chapters.map(ch =>
          ch.chapter_id === summaryModal.chapterId ? { ...ch, summary: html } : ch
        );
        setSelectedSubject({ ...selectedSubject, chapters: updatedChapters });
      }
      setTimeout(() => { setSummaryModal(null); setSummarySaveStatus(null); }, 1000);
    } catch (err) {
      setSummarySaveStatus("error");
    } finally {
      setSummarySaving(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, [selectedClass]);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/curriculum/subjects`;
      if (selectedClass !== "all") {
        url += `?class_level=${selectedClass}`;
      }

      const response = await authFetch(url);
      if (response.ok) {
        const data = await response.json();
        setSubjects(data);
      }
    } catch (err) {
      console.error("Fetch subjects error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjectDetails = async (subjectId) => {
    try {
      const response = await authFetch(`${API_URL}/api/curriculum/subjects/${subjectId}`);
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (err) {
      console.error("Fetch subject details error:", err);
    }
    return null;
  };

  const handleAddSubject = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await authFetch(`${API_URL}/api/curriculum/subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subjectForm)
      });

      if (response.ok) {
        toast.success("Subject created successfully!")
        setShowAddSubjectModal(false);
        setSubjectForm({
          subject_name: "",
          class_level: 10,
          description: "",
          icon: "book",
          color: "#3B82F6"
        });
        fetchSubjects();
      } else {
        const error = await response.json();
        toast.error(`Error: ${error.detail}`)
      }
    } catch (err) {
      toast.error("Failed to create subject")
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddChapter = async (e) => {
    e.preventDefault();
    if (!selectedSubject) return;

    setSubmitting(true);

    try {
      const response = await authFetch(
        `${API_URL}/api/curriculum/subjects/${selectedSubject.subject_id}/chapters`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(chapterForm)
        }
      );

      if (response.ok) {
        toast.success("Chapter added successfully!")
        setChapterForm({
          chapter_number: 1,
          chapter_name: "",
          description: ""
        });
        fetchSubjects();

        const updated = await fetchSubjectDetails(selectedSubject.subject_id);
        if (updated) {
          setSelectedSubject(updated);
        }
      } else {
        const error = await response.json();
        toast.error(`Error: ${error.detail}`)
      }
    } catch (err) {
      toast.error("Failed to add chapter")
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTopic = async (subjectId, chapterId) => {
    if (!topicForm.topic_name.trim()) {
      toast.warning("Please enter a topic name")
      return;
    }

    setSubmitting(true);

    try {
      const response = await authFetch(
        `${API_URL}/api/curriculum/subjects/${subjectId}/chapters/${chapterId}/topics`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(topicForm)
        }
      );

      if (response.ok) {
        toast.success("Topic added successfully!")
        setTopicForm({
          topic_name: "",
          description: "",
          page_range: "",
          difficulty_level: "medium"
        });
        fetchSubjects();

        if (selectedSubject && selectedSubject.subject_id === subjectId) {
          const updated = await fetchSubjectDetails(subjectId);
          if (updated) {
            setSelectedSubject(updated);
          }
        }
      } else {
        const error = await response.json();
        toast.error(`Error: ${error.detail}`)
      }
    } catch (err) {
      toast.error("Failed to add topic")
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubject = async (subjectId) => {
    if (!confirm("Are you sure you want to delete this subject? This will hide it from students.")) {
      return;
    }

    try {
      const response = await authFetch(`${API_URL}/api/curriculum/subjects/${subjectId}`, {
        method: "DELETE"
      });

      if (response.ok) {
        
        setSubjects(prev => prev.filter(s => s.subject_id !== subjectId));

        if (selectedSubject && selectedSubject.subject_id === subjectId) {
          setSelectedSubject(null);
          setShowChapterModal(false);
        }

        toast.success("Subject deleted successfully!")
        
        fetchSubjects();
      } else {
        const error = await response.json();
        toast.error(`Failed to delete subject: ${error.detail || 'Unknown error'}`)
      }
    } catch (err) {
      console.error("Delete subject error:", err);
      toast.error("Failed to delete subject")
    }
  };

  const toggleSubject = (subjectId) => {
    setExpandedSubjects(prev => ({ ...prev, [subjectId]: !prev[subjectId] }));
  };

  const handleEditChapter = (chapter) => {
    setEditingChapter({
      ...chapter,
      originalChapterName: chapter.chapter_name
    });
  };

  const handleCancelEditChapter = () => {
    setEditingChapter(null);
  };

  const handleSaveChapter = async () => {
    if (!editingChapter || !selectedSubject) return;

    try {
      setSubmitting(true);
      const response = await authFetch(
        `${API_URL}/api/curriculum/subjects/${selectedSubject.subject_id}/chapters/${editingChapter.chapter_id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chapter_name: editingChapter.chapter_name,
            description: editingChapter.description || ""
          })
        }
      );

      if (response.ok) {
        
        const updated = await fetchSubjectDetails(selectedSubject.subject_id);
        if (updated) {
          setSelectedSubject(updated);
        }
        setEditingChapter(null);
        toast.success("Chapter updated successfully!")
        fetchSubjects();
      } else {
        const error = await response.json();
        toast.error(`Error: ${error.detail}`)
      }
    } catch (err) {
      toast.error("Failed to update chapter")
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteChapter = async (chapterId) => {
    if (!confirm("Are you sure you want to delete this chapter? All topics in this chapter will also be deleted.")) {
      return;
    }

    try {
      setSubmitting(true);
      const response = await authFetch(
        `${API_URL}/api/curriculum/subjects/${selectedSubject.subject_id}/chapters/${chapterId}`,
        {
          method: "DELETE"
        }
      );

      if (response.ok) {
        
        const updated = await fetchSubjectDetails(selectedSubject.subject_id);
        if (updated) {
          setSelectedSubject(updated);
        }
        toast.success("Chapter deleted successfully!")
        fetchSubjects();
      } else {
        const error = await response.json();
        toast.error(`Error: ${error.detail}`)
      }
    } catch (err) {
      toast.error("Failed to delete chapter")
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditTopic = (topic, chapterId) => {
    setEditingTopic({
      ...topic,
      chapterId,
      originalTopicName: topic.topic_name
    });
  };

  const handleCancelEditTopic = () => {
    setEditingTopic(null);
  };

  const handleSaveTopic = async () => {
    if (!editingTopic || !selectedSubject) return;

    try {
      setSubmitting(true);
      const response = await authFetch(
        `${API_URL}/api/curriculum/subjects/${selectedSubject.subject_id}/chapters/${editingTopic.chapterId}/topics/${editingTopic.topic_id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic_name: editingTopic.topic_name,
            description: editingTopic.description || "",
            page_range: editingTopic.page_range || "",
            difficulty_level: editingTopic.difficulty_level
          })
        }
      );

      if (response.ok) {
        
        const updated = await fetchSubjectDetails(selectedSubject.subject_id);
        if (updated) {
          setSelectedSubject(updated);
        }
        setEditingTopic(null);
        toast.success("Topic updated successfully!")
        fetchSubjects();
      } else {
        const error = await response.json();
        toast.error(`Error: ${error.detail}`)
      }
    } catch (err) {
      toast.error("Failed to update topic")
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTopic = async (topicId, chapterId) => {
    if (!confirm("Are you sure you want to delete this topic?")) {
      return;
    }

    try {
      setSubmitting(true);
      const response = await authFetch(
        `${API_URL}/api/curriculum/subjects/${selectedSubject.subject_id}/chapters/${chapterId}/topics/${topicId}`,
        {
          method: "DELETE"
        }
      );

      if (response.ok) {
        
        const updated = await fetchSubjectDetails(selectedSubject.subject_id);
        if (updated) {
          setSelectedSubject(updated);
        }
        toast.success("Topic deleted successfully!")
        fetchSubjects();
      } else {
        const error = await response.json();
        toast.error(`Error: ${error.detail}`)
      }
    } catch (err) {
      toast.error("Failed to delete topic")
    } finally {
      setSubmitting(false);
    }
  };

  const toggleChapter = (chapterId) => {
    setExpandedChapters(prev => ({ ...prev, [chapterId]: !prev[chapterId] }));
  };

  const handleViewChapters = async (subject) => {
    const details = await fetchSubjectDetails(subject.subject_id);
    if (details) {
      setSelectedSubject(details);
      setShowChapterModal(true);
    }
  };

  const filteredSubjects = subjects.filter(subject =>
    subject.subject_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <AdminLayout title="Subjects, Chapters and Topics" icon={BookOpen}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gray-900 dark:text-white" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Subjects, Chapters and Topics" icon={BookOpen}>
      {}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search subjects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 dark:focus:ring-zinc-500 focus:border-transparent"
          />
        </div>

        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 dark:focus:ring-zinc-500"
        >
          <option value="all">All Classes</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(cls => (
            <option key={cls} value={cls}>Class {cls}</option>
          ))}
        </select>

        <button
          onClick={() => setShowPendingReview(true)}
          className="px-4 py-2 bg-gray-700 dark:bg-zinc-700 hover:bg-gray-800 dark:hover:bg-zinc-600 text-white rounded-lg flex items-center gap-2 transition whitespace-nowrap"
        >
          <Clock className="w-5 h-5" /> Pending Review
        </button>

        <button
          onClick={() => setShowAIExtractionModal(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition whitespace-nowrap"
        >
          <Sparkles className="w-5 h-5" /> AI Extract
        </button>

        <button
          onClick={() => setShowAddSubjectModal(true)}
          className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg flex items-center gap-2 transition whitespace-nowrap hover:bg-gray-800 dark:hover:bg-gray-100"
        >
          <Plus className="w-5 h-5" /> Add Manual
        </button>
      </div>

      {}
      {filteredSubjects.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <BookOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-lg">No subjects found</p>
          <p className="text-gray-400 dark:text-gray-500 mt-2">Create your first subject to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSubjects.map((subject) => (
            <div
              key={subject.subject_id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition"
              style={{ borderLeftColor: "#111827", borderLeftWidth: "4px" }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100 dark:bg-zinc-800">
                    <SubjectIcon name={subject.subject_name} size="w-6 h-6" className="text-gray-700 dark:text-gray-200" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {subject.subject_name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Class {subject.class_level}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteSubject(subject.subject_id)}
                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-4 mb-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">{subject.total_chapters} chapters</span>
                </div>
                <div className="pl-4 border-l border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">{subject.total_topics} topics</span>
                </div>
              </div>

              <button
                onClick={() => handleViewChapters(subject)}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" /> View & Edit Chapters
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Subject Modal */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add New Subject</h2>
              <button
                onClick={() => setShowAddSubjectModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleAddSubject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subject Name
                </label>
                <input
                  type="text"
                  value={subjectForm.subject_name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, subject_name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  placeholder="e.g., Mathematics, Physics, English"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Class Level
                </label>
                <select
                  value={subjectForm.class_level}
                  onChange={(e) => setSubjectForm({ ...subjectForm, class_level: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(cls => (
                    <option key={cls} value={cls}>Class {cls}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={subjectForm.description}
                  onChange={(e) => setSubjectForm({ ...subjectForm, description: e.target.value })}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  placeholder="Brief description..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-gray-800 dark:hover:bg-gray-100"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Chapters & Topics Modal */}
      {showChapterModal && selectedSubject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full my-8">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100 dark:bg-zinc-800">
                    <SubjectIcon name={selectedSubject.subject_name} size="w-6 h-6" className="text-gray-700 dark:text-gray-200" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {selectedSubject.subject_name}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Class {selectedSubject.class_level} • {selectedSubject.chapters?.length || 0} chapters
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowChapterModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Add Chapter Form */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Add New Chapter</h3>
                <form onSubmit={handleAddChapter} className="flex gap-3">
                  <input
                    type="number"
                    min="1"
                    value={chapterForm.chapter_number}
                    onChange={(e) => setChapterForm({ ...chapterForm, chapter_number: parseInt(e.target.value) })}
                    className="w-20 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="No."
                  />
                  <input
                    type="text"
                    value={chapterForm.chapter_name}
                    onChange={(e) => setChapterForm({ ...chapterForm, chapter_name: e.target.value })}
                    required
                    className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="Chapter name..."
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg transition disabled:opacity-50 flex items-center gap-2 hover:bg-gray-800 dark:hover:bg-gray-100"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add
                  </button>
                </form>
              </div>

              {/* Chapters List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selectedSubject.chapters?.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <BookMarked className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No chapters yet. Add your first chapter above.</p>
                  </div>
                ) : (
                  selectedSubject.chapters?.map((chapter) => (
                    <div key={chapter.chapter_id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      {editingChapter?.chapter_id === chapter.chapter_id ? (
                        <div className="p-4 bg-white dark:bg-gray-800">
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Chapter Name
                              </label>
                              <input
                                type="text"
                                value={editingChapter.chapter_name}
                                onChange={(e) => setEditingChapter({ ...editingChapter, chapter_name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                placeholder="Chapter name"
                              />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={handleCancelEditChapter}
                                className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleSaveChapter}
                                disabled={submitting || !editingChapter.chapter_name.trim()}
                                className="px-3 py-2 text-sm bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg transition disabled:opacity-50 flex items-center gap-2 hover:bg-gray-800 dark:hover:bg-gray-100"
                              >
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                          <div className="flex items-center justify-between">
                            <div
                              onClick={() => toggleChapter(chapter.chapter_id)}
                              className="flex items-center gap-3 flex-1 cursor-pointer"
                            >
                              {expandedChapters[chapter.chapter_id] ? (
                                <ChevronDown className="w-5 h-5 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-gray-400" />
                              )}
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
                                  Ch {chapter.chapter_number}
                                </span>
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {chapter.chapter_name}
                                </span>
                              </div>
                              <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto mr-4">
                                {chapter.topics?.length || 0} topics
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openSummaryEditor(chapter);
                                }}
                                className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition"
                                title="Edit chapter summary"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditChapter(chapter);
                                }}
                                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                                title="Edit chapter"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteChapter(chapter.chapter_id);
                                }}
                                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                                title="Delete chapter"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {expandedChapters[chapter.chapter_id] && (
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                          {/* Add Topic Form */}
                          <div className="mb-3">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={topicForm.topic_name}
                                onChange={(e) => setTopicForm({ ...topicForm, topic_name: e.target.value })}
                                className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                placeholder="Add topic name..."
                              />
                              <input
                                type="text"
                                value={topicForm.page_range}
                                onChange={(e) => setTopicForm({ ...topicForm, page_range: e.target.value })}
                                className="w-24 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                placeholder="Pages"
                              />
                              <select
                                value={topicForm.difficulty_level}
                                onChange={(e) => setTopicForm({ ...topicForm, difficulty_level: e.target.value })}
                                className="w-28 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                              >
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                              </select>
                              <button
                                onClick={() => handleAddTopic(selectedSubject.subject_id, chapter.chapter_id)}
                                disabled={submitting}
                                className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50 text-sm"
                              >
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {/* Topics List */}
                          {chapter.topics?.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                              No topics yet. Add topics above.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {chapter.topics?.map((topic, idx) => (
                                <div key={topic.topic_id}>
                                  {editingTopic?.topic_id === topic.topic_id ? (
                                    <div className="p-3 bg-white dark:bg-gray-800 rounded-lg space-y-3">
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                          Topic Name
                                        </label>
                                        <input
                                          type="text"
                                          value={editingTopic.topic_name}
                                          onChange={(e) => setEditingTopic({ ...editingTopic, topic_name: e.target.value })}
                                          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                          placeholder="Topic name"
                                        />
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Page Range
                                          </label>
                                          <input
                                            type="text"
                                            value={editingTopic.page_range || ""}
                                            onChange={(e) => setEditingTopic({ ...editingTopic, page_range: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                            placeholder="e.g., 1-10"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Difficulty
                                          </label>
                                          <select
                                            value={editingTopic.difficulty_level}
                                            onChange={(e) => setEditingTopic({ ...editingTopic, difficulty_level: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                          >
                                            <option value="easy">Easy</option>
                                            <option value="medium">Medium</option>
                                            <option value="hard">Hard</option>
                                          </select>
                                        </div>
                                      </div>
                                      <div className="flex gap-2 justify-end">
                                        <button
                                          onClick={handleCancelEditTopic}
                                          className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={handleSaveTopic}
                                          disabled={submitting || !editingTopic.topic_name.trim()}
                                          className="px-3 py-1.5 text-xs bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg transition disabled:opacity-50 flex items-center gap-1 hover:bg-gray-800 dark:hover:bg-gray-100"
                                        >
                                          {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                          Save
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg text-sm">
                                      <div className="flex items-center gap-3">
                                        <span className="text-gray-400 dark:text-gray-500 font-mono">
                                          {idx + 1}.
                                        </span>
                                        <span className="text-gray-900 dark:text-white">
                                          {topic.topic_name}
                                        </span>
                                        {topic.page_range && (
                                          <span className="text-gray-500 dark:text-gray-400 text-xs">
                                            (p. {topic.page_range})
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className={`text-xs px-2 py-1 rounded ${topic.difficulty_level === "easy"
                                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                            : topic.difficulty_level === "hard"
                                              ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                              : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                                          }`}>
                                          {topic.difficulty_level}
                                        </span>
                                        <button
                                          onClick={() => handleEditTopic(topic, chapter.chapter_id)}
                                          className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                                          title="Edit topic"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteTopic(topic.topic_id, chapter.chapter_id)}
                                          className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                                          title="Delete topic"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Extraction Modal */}
      <AIExtractionModal
        isOpen={showAIExtractionModal}
        onClose={() => setShowAIExtractionModal(false)}
        onSuccess={() => {
          setShowAIExtractionModal(false);
          setShowPendingReview(true);
        }}
      />

      {/* Pending Review Modal */}
      <PendingCurriculumReview
        isOpen={showPendingReview}
        onClose={() => setShowPendingReview(false)}
        onApproved={() => {
          fetchSubjects();
        }}
      />

      {/* Chapter Summary Rich Text Editor Modal */}
      {summaryModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Chapter {summaryModal.chapterNumber} Summary</p>
                  <h2 className="font-bold text-gray-900 dark:text-white text-lg leading-tight">{summaryModal.chapterName}</h2>
                </div>
              </div>
              <button onClick={() => setSummaryModal(null)} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1 px-4 py-2 border-b bg-white dark:bg-gray-900">
              <button onClick={() => execFormat("bold")} className="smry-btn font-bold" title="Bold">B</button>
              <button onClick={() => execFormat("italic")} className="smry-btn italic" title="Italic">I</button>
              <button onClick={() => execFormat("underline")} className="smry-btn underline" title="Underline">U</button>
              <button onClick={() => execFormat("strikeThrough")} className="smry-btn line-through" title="Strikethrough">S</button>
              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
              <span className="text-xs text-gray-400 mr-1">Size:</span>
              {[["S", "1"], ["M", "3"], ["L", "5"], ["XL", "7"]].map(([label, val]) => (
                <button key={val} onClick={() => execFormat("fontSize", val)} className="smry-btn text-xs px-2">{label}</button>
              ))}
              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
              <span className="text-xs text-gray-400 mr-1">Font:</span>
              {[["Sans", "Arial, sans-serif"], ["Serif", "Georgia, serif"], ["Mono", "Courier New, monospace"]].map(([label, val]) => (
                <button key={label} onClick={() => execFormat("fontName", val)} className="smry-btn text-xs px-2" style={{ fontFamily: val }}>{label}</button>
              ))}
              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
              <button onClick={() => execFormat("insertUnorderedList")} className="smry-btn text-xs px-2">• List</button>
              <button onClick={() => execFormat("insertOrderedList")} className="smry-btn text-xs px-2">1. List</button>
              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
              <span className="text-xs text-gray-400 mr-1">Color:</span>
              {["#1e293b", "#dc2626", "#2563eb", "#16a34a", "#9333ea", "#ea580c"].map(c => (
                <button key={c} onClick={() => execFormat("foreColor", c)} className="w-5 h-5 rounded-full border border-gray-200 hover:scale-110 transition-transform" style={{ backgroundColor: c }} />
              ))}
              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
              <span className="text-xs text-gray-400 mr-1">Highlight:</span>
              {["#fef08a", "#bbf7d0", "#bfdbfe", "#fecaca"].map(c => (
                <button key={c} onClick={() => execFormat("hiliteColor", c)} className="w-5 h-5 rounded border border-gray-200 hover:scale-110 transition-transform" style={{ backgroundColor: c }} />
              ))}
              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
              <button onClick={() => execFormat("removeFormat")} className="smry-btn text-xs text-red-500 px-2">Clear</button>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-auto p-6">
              <div
                ref={summaryEditorRef}
                contentEditable
                suppressContentEditableWarning
                className="min-h-full outline-none text-gray-800 dark:text-gray-200 text-base leading-relaxed"
                style={{ minHeight: "300px" }}
                data-placeholder="Write the chapter summary here..."
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 dark:bg-gray-800">
              <p className="text-xs text-gray-500">This summary is shown to students in Book to Bot when they click "Summarize Chapter"</p>
              <div className="flex items-center gap-3">
                {summarySaveStatus === "success" && <span className="text-sm text-green-600 flex items-center gap-1"><Check className="h-4 w-4" /> Saved!</span>}
                {summarySaveStatus === "error" && <span className="text-sm text-red-500 flex items-center gap-1"><AlertCircle className="h-4 w-4" /> Failed</span>}
                <button onClick={() => setSummaryModal(null)} className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm">Cancel</button>
                <button onClick={handleSaveSummary} disabled={summarySaving} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition text-sm flex items-center gap-2 disabled:opacity-50">
                  {summarySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {summarySaving ? "Saving..." : "Save Summary"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .smry-btn {
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
        .smry-btn:hover { background: #f3f4f6; border-color: #e5e7eb; }
        .dark .smry-btn { color: #d1d5db; }
        .dark .smry-btn:hover { background: #374151; border-color: #4b5563; }
        [contenteditable]:empty:before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; }
      `}</style>
    </AdminLayout>
  );
}
