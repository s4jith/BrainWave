
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../components/AdminLayout";
import AIExtractionModal from "../components/AIExtractionModal";
import PendingCurriculumReview from "../components/PendingCurriculumReview";
import SubjectIcon from "../components/SubjectIcon";
import { CardLoader } from "../components/LoadingSpinner";
import {
  BookOpen, Plus, Search, Trash2, Edit2, ChevronDown, ChevronRight, ChevronUp,
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
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");

  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [draftSubject, setDraftSubject] = useState(null);
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
  const [dragChapterId, setDragChapterId] = useState(null);
  const [dragTopic, setDragTopic] = useState(null);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedClass]);

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

  const reorderItems = (items, fromIndex, toIndex) => {
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  };

  const normalizeDraftOrders = (subjectDraft) => {
    const chapters = (subjectDraft.chapters || []).map((chapter, chapterIndex) => ({
      ...chapter,
      order: chapterIndex + 1,
      chapter_number: chapter.chapter_number || chapterIndex + 1,
      topics: (chapter.topics || []).map((topic, topicIndex) => ({
        ...topic,
        order: topicIndex + 1,
      })),
    }));
    return { ...subjectDraft, chapters };
  };

  const handleDraftSubjectChange = (field, value) => {
    setDraftSubject((prev) => ({ ...prev, [field]: value }));
  };

  const handleDraftAddChapter = () => {
    setDraftSubject((prev) => {
      if (!prev) return prev;
      const nextChapterNumber = (prev.chapters?.length || 0) + 1;
      const newChapter = {
        chapter_id: `tmp_ch_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
        chapter_number: nextChapterNumber,
        chapter_name: `Chapter ${nextChapterNumber}`,
        description: "",
        summary: "",
        order: nextChapterNumber,
        is_active: true,
        topics: [],
      };
      return { ...prev, chapters: [...(prev.chapters || []), newChapter] };
    });
  };

  const handleDraftDeleteChapter = (chapterId) => {
    setDraftSubject((prev) => {
      if (!prev) return prev;
      const chapters = (prev.chapters || []).filter((ch) => ch.chapter_id !== chapterId);
      return normalizeDraftOrders({ ...prev, chapters });
    });
  };

  const handleDraftChapterChange = (chapterId, field, value) => {
    setDraftSubject((prev) => {
      if (!prev) return prev;
      const chapters = (prev.chapters || []).map((ch) =>
        ch.chapter_id === chapterId ? { ...ch, [field]: value } : ch
      );
      return { ...prev, chapters };
    });
  };

  const handleDraftAddTopic = (chapterId) => {
    setDraftSubject((prev) => {
      if (!prev) return prev;
      const chapters = (prev.chapters || []).map((ch) => {
        if (ch.chapter_id !== chapterId) return ch;
        const nextOrder = (ch.topics?.length || 0) + 1;
        return {
          ...ch,
          topics: [
            ...(ch.topics || []),
            {
              topic_id: `tmp_tp_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
              topic_name: "",
              description: "",
              page_range: "",
              difficulty_level: "medium",
              order: nextOrder,
              is_active: true,
            },
          ],
        };
      });
      return { ...prev, chapters };
    });
  };

  const handleDraftDeleteTopic = (chapterId, topicId) => {
    setDraftSubject((prev) => {
      if (!prev) return prev;
      const chapters = (prev.chapters || []).map((ch) => {
        if (ch.chapter_id !== chapterId) return ch;
        const topics = (ch.topics || []).filter((tp) => tp.topic_id !== topicId)
          .map((tp, idx) => ({ ...tp, order: idx + 1 }));
        return { ...ch, topics };
      });
      return { ...prev, chapters };
    });
  };

  const handleDraftTopicChange = (chapterId, topicId, field, value) => {
    setDraftSubject((prev) => {
      if (!prev) return prev;
      const chapters = (prev.chapters || []).map((ch) => {
        if (ch.chapter_id !== chapterId) return ch;
        const topics = (ch.topics || []).map((tp) =>
          tp.topic_id === topicId ? { ...tp, [field]: value } : tp
        );
        return { ...ch, topics };
      });
      return { ...prev, chapters };
    });
  };

  const handleSaveDraftSubject = async () => {
    if (!selectedSubject || !draftSubject) return;
    setSubmitting(true);
    try {
      const normalized = normalizeDraftOrders(draftSubject);
      const response = await authFetch(`${API_URL}/api/curriculum/subjects/${selectedSubject.subject_id}/bulk`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_name: normalized.subject_name,
          class_level: normalized.class_level,
          description: normalized.description || "",
          chapters: (normalized.chapters || []).map((chapter) => ({
            chapter_id: chapter.chapter_id?.startsWith("tmp_") ? null : chapter.chapter_id,
            chapter_number: chapter.chapter_number,
            chapter_name: chapter.chapter_name,
            description: chapter.description || "",
            summary: chapter.summary || "",
            order: chapter.order,
            is_active: chapter.is_active !== false,
            topics: (chapter.topics || []).filter((tp) => tp.topic_name?.trim()).map((topic) => ({
              topic_id: topic.topic_id?.startsWith("tmp_") ? null : topic.topic_id,
              topic_name: topic.topic_name,
              description: topic.description || "",
              page_range: topic.page_range || "",
              difficulty_level: topic.difficulty_level || "medium",
              order: topic.order,
              is_active: topic.is_active !== false,
            })),
          })),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to save changes");
      }

      const updated = await response.json();
      setSelectedSubject(updated);
      setDraftSubject(updated);
      toast.success("Subject changes saved successfully!");
      fetchSubjects();
    } catch (err) {
      toast.error(err.message || "Failed to save changes");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubject = (subject) => {
    setEditingSubject(subject);
    setSubjectForm({
      subject_name: subject.subject_name,
      class_level: subject.class_level,
      description: subject.description || ""
    });
    setShowAddSubjectModal(true);
  };

  const handleSaveSubject = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const isEditing = Boolean(editingSubject);
      const url = isEditing
        ? `${API_URL}/api/curriculum/subjects/${editingSubject.subject_id}`
        : `${API_URL}/api/curriculum/subjects`;
      const method = isEditing ? "PUT" : "POST";

      const response = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subjectForm)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to save subject");
      }

      toast.success(isEditing ? "Subject updated successfully!" : "Subject created successfully!")
      setShowAddSubjectModal(false);
      setEditingSubject(null);
      setSubjectForm({ subject_name: "", class_level: 10, description: "" });
      await fetchSubjects();
      if (isEditing && selectedSubject?.subject_id === editingSubject.subject_id) {
        const updated = await fetchSubjectDetails(editingSubject.subject_id);
        if (updated) setSelectedSubject(updated);
      }
    } catch (err) {
      toast.error(err.message || "Failed to save subject")
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

  const handleMoveChapter = async (chapter, direction) => {
    if (!selectedSubject?.chapters?.length) return;
    const chapters = [...selectedSubject.chapters].sort((a, b) => (a.order ?? a.chapter_number) - (b.order ?? b.chapter_number));
    const idx = chapters.findIndex((ch) => ch.chapter_id === chapter.chapter_id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= chapters.length) return;

    const current = chapters[idx];
    const target = chapters[swapIdx];

    try {
      setSubmitting(true);
      const [resp1, resp2] = await Promise.all([
        authFetch(`${API_URL}/api/curriculum/subjects/${selectedSubject.subject_id}/chapters/${current.chapter_id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: target.order ?? target.chapter_number })
        }),
        authFetch(`${API_URL}/api/curriculum/subjects/${selectedSubject.subject_id}/chapters/${target.chapter_id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: current.order ?? current.chapter_number })
        })
      ]);

      if (!resp1.ok || !resp2.ok) throw new Error("Failed to reorder chapters");
      const updated = await fetchSubjectDetails(selectedSubject.subject_id);
      if (updated) setSelectedSubject(updated);
      fetchSubjects();
    } catch (err) {
      toast.error("Failed to reorder chapters")
    } finally {
      setSubmitting(false);
    }
  };

  const handleMoveTopic = async (chapterId, topics, topic, direction) => {
    const idx = topics.findIndex((t) => t.topic_id === topic.topic_id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= topics.length) return;

    const current = topics[idx];
    const target = topics[swapIdx];
    const currentOrder = current.order ?? idx + 1;
    const targetOrder = target.order ?? swapIdx + 1;

    try {
      setSubmitting(true);
      const [resp1, resp2] = await Promise.all([
        authFetch(`${API_URL}/api/curriculum/subjects/${selectedSubject.subject_id}/chapters/${chapterId}/topics/${current.topic_id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: targetOrder })
        }),
        authFetch(`${API_URL}/api/curriculum/subjects/${selectedSubject.subject_id}/chapters/${chapterId}/topics/${target.topic_id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: currentOrder })
        })
      ]);

      if (!resp1.ok || !resp2.ok) throw new Error("Failed to reorder topics");
      const updated = await fetchSubjectDetails(selectedSubject.subject_id);
      if (updated) setSelectedSubject(updated);
      fetchSubjects();
    } catch (err) {
      toast.error("Failed to reorder topics")
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewChapters = async (subject) => {
    const details = await fetchSubjectDetails(subject.subject_id);
    if (details) {
      setSelectedSubject(details);
      setDraftSubject(details);
      setShowChapterModal(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const filteredSubjects = subjects.filter(subject =>
    subject.subject_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredSubjects.length / pageSize));
  const paginatedSubjects = filteredSubjects.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (loading) {
    return (
      <AdminLayout title="Subjects, Chapters and Topics" icon={BookOpen}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <CardLoader key={idx} rows={3} />
          ))}
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
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedSubjects.map((subject) => (
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

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEditSubject(subject)}
                    className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteSubject(subject.subject_id)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
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
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 transition"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400 px-2">Page {currentPage} of {totalPages}</span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 transition"
            >
              Next
            </button>
          </div>
        )}
        </>
      )}

      {/* Add Subject Modal */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{editingSubject ? "Edit Subject" : "Add New Subject"}</h2>
              <button
                onClick={() => {
                  setShowAddSubjectModal(false);
                  setEditingSubject(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSaveSubject} className="space-y-4">
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
                  onClick={() => {
                    setShowAddSubjectModal(false);
                    setEditingSubject(null);
                  }}
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
                  {editingSubject ? "Save Subject" : "Create Subject"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Chapters & Topics Editor (page section) */}
      {showChapterModal && selectedSubject && draftSubject && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100 dark:bg-zinc-800">
                    <SubjectIcon name={draftSubject.subject_name} size="w-6 h-6" className="text-gray-700 dark:text-gray-200" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Edit Subject
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Manage chapters and topics for this subject.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowChapterModal(false);
                    setDraftSubject(null);
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Subject Name</label>
                <input
                  type="text"
                  value={draftSubject.subject_name || ""}
                  onChange={(e) => handleDraftSubjectChange("subject_name", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Class Level</label>
                <select
                  value={draftSubject.class_level}
                  onChange={(e) => handleDraftSubjectChange("class_level", parseInt(e.target.value))}
                  className="w-full max-w-xs px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(cls => (
                    <option key={cls} value={cls}>Class {cls}</option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Chapters & Topics</h3>
                  <span className="text-xs text-gray-500">Drag to reorder</span>
                </div>

                <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                  {(draftSubject.chapters || []).map((chapter, chapterIndex) => (
                    <div
                      key={chapter.chapter_id}
                      draggable
                      onDragStart={() => setDragChapterId(chapter.chapter_id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (!dragChapterId || dragChapterId === chapter.chapter_id) return;
                        const fromIndex = (draftSubject.chapters || []).findIndex((c) => c.chapter_id === dragChapterId);
                        const toIndex = chapterIndex;
                        if (fromIndex < 0) return;
                        const reordered = reorderItems(draftSubject.chapters || [], fromIndex, toIndex);
                        setDraftSubject((prev) => normalizeDraftOrders({ ...prev, chapters: reordered }));
                        setDragChapterId(null);
                      }}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40"
                    >
                      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                        <span className="text-gray-400 text-sm cursor-grab">::</span>
                        <input
                          type="text"
                          value={chapter.chapter_name || ""}
                          onChange={(e) => handleDraftChapterChange(chapter.chapter_id, "chapter_name", e.target.value)}
                          className="flex-1 px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                        />
                        <span className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {(chapter.topics || []).length} topics
                        </span>
                        <button
                          onClick={() => handleDraftDeleteChapter(chapter.chapter_id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="p-3 space-y-2">
                        {(chapter.topics || []).map((topic, topicIndex) => (
                          <div
                            key={topic.topic_id}
                            draggable
                            onDragStart={() => setDragTopic({ chapterId: chapter.chapter_id, topicId: topic.topic_id })}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (!dragTopic) return;
                              if (dragTopic.chapterId !== chapter.chapter_id) return;
                              const topics = chapter.topics || [];
                              const fromIndex = topics.findIndex((t) => t.topic_id === dragTopic.topicId);
                              const toIndex = topicIndex;
                              if (fromIndex < 0 || fromIndex === toIndex) return;
                              const reorderedTopics = reorderItems(topics, fromIndex, toIndex)
                                .map((t, idx) => ({ ...t, order: idx + 1 }));
                              setDraftSubject((prev) => ({
                                ...prev,
                                chapters: (prev.chapters || []).map((ch) =>
                                  ch.chapter_id === chapter.chapter_id ? { ...ch, topics: reorderedTopics } : ch
                                ),
                              }));
                              setDragTopic(null);
                            }}
                            className="grid grid-cols-[auto,1fr,120px,auto] gap-2 items-center rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2"
                          >
                            <span className="text-gray-400 text-sm cursor-grab">::</span>
                            <input
                              type="text"
                              value={topic.topic_name || ""}
                              onChange={(e) => handleDraftTopicChange(chapter.chapter_id, topic.topic_id, "topic_name", e.target.value)}
                              placeholder="Topic name"
                              className="px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
                            />
                            <select
                              value={topic.difficulty_level || "medium"}
                              onChange={(e) => handleDraftTopicChange(chapter.chapter_id, topic.topic_id, "difficulty_level", e.target.value)}
                              className="px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
                            >
                              <option value="easy">Easy</option>
                              <option value="medium">Medium</option>
                              <option value="hard">Hard</option>
                            </select>
                            <button
                              onClick={() => handleDraftDeleteTopic(chapter.chapter_id, topic.topic_id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}

                        <button
                          onClick={() => handleDraftAddTopic(chapter.chapter_id)}
                          className="w-full py-2 rounded border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          + Add Topic
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleDraftAddChapter}
                  className="mt-3 w-full py-2 rounded border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  + Add Chapter
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowChapterModal(false);
                    setDraftSubject(null);
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraftSubject}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-gray-800 dark:hover:bg-gray-100"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
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
