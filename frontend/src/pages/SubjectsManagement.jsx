/**
 * SubjectsManagement - Admin page to manage subjects, chapters, and topics
 * Hierarchical content organization for curriculum management
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../components/AdminLayout";
import AIExtractionModal from "../components/AIExtractionModal";
import PendingCurriculumReview from "../components/PendingCurriculumReview";
import {
  BookOpen, Plus, Search, Trash2, Edit2, ChevronDown, ChevronRight,
  Loader2, FileText, List, BookMarked, X, Check, Save, AlertCircle, Sparkles, Clock
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function SubjectsManagement() {
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");
  
  // Modals
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [showAIExtractionModal, setShowAIExtractionModal] = useState(false);
  const [showPendingReview, setShowPendingReview] = useState(false);
  
  // Forms
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
  
  // Expansion states
  const [expandedSubjects, setExpandedSubjects] = useState({});
  const [expandedChapters, setExpandedChapters] = useState({});
  
  // Editing states
  const [editingSubject, setEditingSubject] = useState(null);
  const [editingChapter, setEditingChapter] = useState(null);
  const [editingTopic, setEditingTopic] = useState(null);
  
  const [submitting, setSubmitting] = useState(false);

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
      
      const response = await fetch(url);
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
      const response = await fetch(`${API_URL}/api/curriculum/subjects/${subjectId}`);
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
      const response = await fetch(`${API_URL}/api/curriculum/subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subjectForm)
      });
      
      if (response.ok) {
        alert("Subject created successfully!");
        setShowAddSubjectModal(false);
        setSubjectForm({
          subject_name: "",
          class_level: 10,
          description: "",
          icon: "📚",
          color: "#3B82F6"
        });
        fetchSubjects();
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail}`);
      }
    } catch (err) {
      alert("Failed to create subject");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddChapter = async (e) => {
    e.preventDefault();
    if (!selectedSubject) return;
    
    setSubmitting(true);
    
    try {
      const response = await fetch(
        `${API_URL}/api/curriculum/subjects/${selectedSubject.subject_id}/chapters`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(chapterForm)
        }
      );
      
      if (response.ok) {
        alert("Chapter added successfully!");
        setChapterForm({
          chapter_number: 1,
          chapter_name: "",
          description: ""
        });
        fetchSubjects();
        
        // Refresh selected subject details
        const updated = await fetchSubjectDetails(selectedSubject.subject_id);
        if (updated) {
          setSelectedSubject(updated);
        }
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail}`);
      }
    } catch (err) {
      alert("Failed to add chapter");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTopic = async (subjectId, chapterId) => {
    if (!topicForm.topic_name.trim()) {
      alert("Please enter a topic name");
      return;
    }
    
    setSubmitting(true);
    
    try {
      const response = await fetch(
        `${API_URL}/api/curriculum/subjects/${subjectId}/chapters/${chapterId}/topics`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(topicForm)
        }
      );
      
      if (response.ok) {
        alert("Topic added successfully!");
        setTopicForm({
          topic_name: "",
          description: "",
          page_range: "",
          difficulty_level: "medium"
        });
        fetchSubjects();
        
        // Refresh selected subject details
        if (selectedSubject && selectedSubject.subject_id === subjectId) {
          const updated = await fetchSubjectDetails(subjectId);
          if (updated) {
            setSelectedSubject(updated);
          }
        }
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail}`);
      }
    } catch (err) {
      alert("Failed to add topic");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubject = async (subjectId) => {
    if (!confirm("Are you sure you want to delete this subject? This will hide it from students.")) {
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/api/curriculum/subjects/${subjectId}`, {
        method: "DELETE"
      });
      
      if (response.ok) {
        // Optimistically remove from local state immediately
        setSubjects(prev => prev.filter(s => s.subject_id !== subjectId));
        
        if (selectedSubject && selectedSubject.subject_id === subjectId) {
          setSelectedSubject(null);
          setShowChapterModal(false);
        }
        
        alert("Subject deleted successfully!");
        // Refresh from server to ensure consistency
        fetchSubjects();
      } else {
        const error = await response.json();
        alert(`Failed to delete subject: ${error.detail || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Delete subject error:", err);
      alert("Failed to delete subject");
    }
  };

  const toggleSubject = (subjectId) => {
    setExpandedSubjects(prev => ({ ...prev, [subjectId]: !prev[subjectId] }));
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
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search subjects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Classes</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(cls => (
            <option key={cls} value={cls}>Class {cls}</option>
          ))}
        </select>
        
        <button
          onClick={() => setShowPendingReview(true)}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-2 transition whitespace-nowrap"
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
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition whitespace-nowrap"
        >
          <Plus className="w-5 h-5" /> Add Manual
        </button>
      </div>

      {/* Subjects Grid */}
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
              style={{ borderLeftColor: subject.color, borderLeftWidth: "4px" }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-4xl">{subject.icon}</div>
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
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
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
                  <div className="text-3xl">{selectedSubject.icon}</div>
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
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 flex items-center gap-2"
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
                      <div
                        onClick={() => toggleChapter(chapter.chapter_id)}
                        className="p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex items-center justify-between transition"
                      >
                        <div className="flex items-center gap-3 flex-1">
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
                      </div>
                      
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
                                <div
                                  key={topic.topic_id}
                                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg text-sm"
                                >
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
                                    <span className={`text-xs px-2 py-1 rounded ${
                                      topic.difficulty_level === "easy"
                                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                        : topic.difficulty_level === "hard"
                                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                        : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                                    }`}>
                                      {topic.difficulty_level}
                                    </span>
                                  </div>
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
    </AdminLayout>
  );
}
