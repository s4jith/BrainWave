
import { useState, useEffect } from "react";
import { Clock, CheckCircle, XCircle, Loader2, ChevronDown, ChevronRight, FileText, User, Calendar, Sparkles, Edit2, Save, X } from "lucide-react";
import useUserStore from "../stores/userStore";
import authFetch from "../utils/authFetch";
import { useToast } from "../contexts/ToastContext";

const API_URL = import.meta.env.VITE_API_URL;

export default function PendingCurriculumReview({ isOpen, onClose, onApproved }) {
  const { user } = useUserStore();
  const { toast } = useToast();
  
  const [pendingItems, setPendingItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState({});
  const [processing, setProcessing] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);
  
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({
    subject_name: '',
    class_level: 10,
    extracted_chapters: []
  });
  
  const [approvalForm, setApprovalForm] = useState({
    action: "approve",
    rejection_reason: "",
    subject_name_override: "",
    icon: "book",
    color: "#3B82F6"
  });

  const countTopicsWithSubtopics = (chapters = []) => {
    return (chapters || []).reduce((sum, ch) => {
      const topicCount = (ch.topics || []).length;
      const subtopicCount = (ch.topics || []).reduce(
        (subSum, topic) => subSum + ((topic.subtopics || []).length),
        0
      );
      return sum + topicCount + subtopicCount;
    }, 0);
  };

  useEffect(() => {
    if (isOpen) {
      fetchPendingItems();
    }
  }, [isOpen]);

  const fetchPendingItems = async () => {
    setLoading(true);
    try {
      const response = await authFetch(`${API_URL}/api/curriculum/pending?status=pending`);
      if (response.ok) {
        const data = await response.json();
        setPendingItems(data);
      }
    } catch (err) {
      console.error("Fetch pending items error:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (itemId) => {
    setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleApprove = async (pendingId) => {
    const item = pendingItems.find(i => i.pending_id === pendingId);
    if (!item) return;

    if (!confirm(`Approve and create subject "${item.subject_name}" for Class ${item.class_level}?`)) {
      return;
    }

    setProcessing(prev => ({ ...prev, [pendingId]: true }));

    try {
      const formData = new FormData();
      formData.append("action", "approve");
      formData.append("reviewed_by", user?.user_id || "admin");
      
      if (approvalForm.subject_name_override) {
        formData.append("subject_name_override", approvalForm.subject_name_override);
      }
      formData.append("icon", approvalForm.icon);
      formData.append("color", approvalForm.color);

      const response = await authFetch(
        `${API_URL}/api/curriculum/pending/${pendingId}/approve`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (response.ok) {
        const result = await response.json();
        toast.success(`Subject created! ${result.total_chapters} chapters, ${result.total_topics} topics`);
        
        setPendingItems(prev => prev.filter(i => i.pending_id !== pendingId));
        
        if (onApproved) {
          onApproved();
        }
      } else {
        const error = await response.json();
        toast.error(`Error: ${error.detail}`);
      }
    } catch (err) {
      console.error("Approve error:", err);
      toast.error("Failed to approve item");
    } finally {
      setProcessing(prev => ({ ...prev, [pendingId]: false }));
    }
  };

  const handleReject = async (pendingId) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;

    setProcessing(prev => ({ ...prev, [pendingId]: true }));

    try {
      const formData = new FormData();
      formData.append("action", "reject");
      formData.append("rejection_reason", reason);
      formData.append("reviewed_by", user?.user_id || "admin");

      const response = await authFetch(
        `${API_URL}/api/curriculum/pending/${pendingId}/approve`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (response.ok) {
        toast.info("Item rejected");
        setPendingItems(prev => prev.filter(i => i.pending_id !== pendingId));
      } else {
        const error = await response.json();
        toast.error(`Error: ${error.detail}`);
      }
    } catch (err) {
      console.error("Reject error:", err);
      toast.error("Failed to reject item");
    } finally {
      setProcessing(prev => ({ ...prev, [pendingId]: false }));
    }
  };

  const handleDelete = async (pendingId) => {
    if (!confirm("Delete this pending item? This cannot be undone.")) {
      return;
    }

    setProcessing(prev => ({ ...prev, [pendingId]: true }));

    try {
      const response = await authFetch(`${API_URL}/api/curriculum/pending/${pendingId}`, {
        method: "DELETE"
      });

      if (response.ok) {
        setPendingItems(prev => prev.filter(i => i.pending_id !== pendingId));
      } else {
        toast.error("Failed to delete item");
      }
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete item");
    } finally {
      setProcessing(prev => ({ ...prev, [pendingId]: false }));
    }
  };

  const handleStartEdit = (item) => {
    setEditingItem(item.pending_id);
    setEditForm({
      subject_name: item.subject_name,
      class_level: item.class_level,
      extracted_chapters: JSON.parse(JSON.stringify(item.extracted_chapters)) 
    });
    
    setExpandedItems(prev => ({ ...prev, [item.pending_id]: true }));
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditForm({
      subject_name: "",
      class_level: 10,
      extracted_chapters: []
    });
  };

  const handleSaveEdit = async (pendingId) => {
    setProcessing(prev => ({ ...prev, [pendingId]: true }));

    try {
      const formData = new FormData();
      formData.append("subject_name", editForm.subject_name);
      formData.append("class_level", editForm.class_level);
      formData.append("extracted_chapters", JSON.stringify(editForm.extracted_chapters));

      const response = await authFetch(`${API_URL}/api/curriculum/pending/${pendingId}`, {
        method: "PUT",
        body: formData
      });

      if (response.ok) {
        const updated = await response.json();
        
        setPendingItems(prev => prev.map(item =>
          item.pending_id === pendingId ? updated : item
        ));
        setEditingItem(null);
        toast.success("Changes saved successfully!");
      } else {
        const error = await response.json();
        toast.error(`Error: ${error.detail}`);
      }
    } catch (err) {
      console.error("Save edit error:", err);
      toast.error("Failed to save changes");
    } finally {
      setProcessing(prev => ({ ...prev, [pendingId]: false }));
    }
  };

  const updateChapterInEdit = (chapterIndex, field, value) => {
    setEditForm(prev => ({
      ...prev,
      extracted_chapters: prev.extracted_chapters.map((ch, idx) =>
        idx === chapterIndex ? { ...ch, [field]: value } : ch
      )
    }));
  };

  const updateTopicInEdit = (chapterIndex, topicIndex, field, value) => {
    setEditForm(prev => ({
      ...prev,
      extracted_chapters: prev.extracted_chapters.map((ch, chIdx) =>
        chIdx === chapterIndex
          ? {
              ...ch,
              topics: ch.topics.map((topic, topIdx) =>
                topIdx === topicIndex ? { ...topic, [field]: value } : topic
              )
            }
          : ch
      )
    }));
  };

  const deleteChapterInEdit = (chapterIndex) => {
    if (confirm("Remove this chapter?")) {
      setEditForm(prev => ({
        ...prev,
        extracted_chapters: prev.extracted_chapters.filter((_, idx) => idx !== chapterIndex)
      }));
    }
  };

  const deleteTopicInEdit = (chapterIndex, topicIndex) => {
    if (confirm("Remove this topic?")) {
      setEditForm(prev => ({
        ...prev,
        extracted_chapters: prev.extracted_chapters.map((ch, chIdx) =>
          chIdx === chapterIndex
            ? {
                ...ch,
                topics: ch.topics.filter((_, topIdx) => topIdx !== topicIndex)
              }
            : ch
        )
      }));
    }
  };

  const updateSubtopicInEdit = (chapterIndex, topicIndex, subtopicIndex, field, value) => {
    setEditForm(prev => ({
      ...prev,
      extracted_chapters: prev.extracted_chapters.map((ch, chIdx) =>
        chIdx === chapterIndex
          ? {
              ...ch,
              topics: (ch.topics || []).map((topic, topIdx) =>
                topIdx === topicIndex
                  ? {
                      ...topic,
                      subtopics: (topic.subtopics || []).map((subtopic, subIdx) =>
                        subIdx === subtopicIndex ? { ...subtopic, [field]: value } : subtopic
                      )
                    }
                  : topic
              )
            }
          : ch
      )
    }));
  };

  const deleteSubtopicInEdit = (chapterIndex, topicIndex, subtopicIndex) => {
    if (confirm("Remove this subtopic?")) {
      setEditForm(prev => ({
        ...prev,
        extracted_chapters: prev.extracted_chapters.map((ch, chIdx) =>
          chIdx === chapterIndex
            ? {
                ...ch,
                topics: (ch.topics || []).map((topic, topIdx) =>
                  topIdx === topicIndex
                    ? {
                        ...topic,
                        subtopics: (topic.subtopics || []).filter((_, subIdx) => subIdx !== subtopicIndex)
                      }
                    : topic
                )
              }
            : ch
        )
      }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Clock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Pending Review
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {pendingItems.length} items awaiting approval
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              Close
            </button>
          </div>
        </div>

        {}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Loading pending items...</p>
            </div>
          ) : pendingItems.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
              <p className="text-lg text-gray-700 dark:text-gray-300 font-medium">
                All caught up!
              </p>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                No pending curriculum items to review
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingItems.map((item) => (
                <div
                  key={item.pending_id}
                  className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {/* Item Header */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {item.subject_name}
                          </h3>
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                            Class {item.class_level}
                          </span>
                          <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full">
                            {item.board}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            <span>{item.source_file_name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            <span>{item.uploaded_by}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(item.uploaded_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => toggleItem(item.pending_id)}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
                      >
                        {expandedItems[item.pending_id] ? (
                          <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        )}
                      </button>
                    </div>

                    {/* Summary */}
                    <div className="flex items-center gap-4 text-sm mb-4">
                      <span className="px-3 py-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        {editingItem === item.pending_id ? editForm.extracted_chapters?.length : item.extracted_chapters?.length || 0} Chapters
                      </span>
                      <span className="px-3 py-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" /> {editingItem === item.pending_id
                          ? countTopicsWithSubtopics(editForm.extracted_chapters)
                          : countTopicsWithSubtopics(item.extracted_chapters)} Topics
                      </span>
                    </div>

                    {/* Action Buttons */}
                    {editingItem === item.pending_id ? (
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleSaveEdit(item.pending_id)}
                          disabled={processing[item.pending_id]}
                          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
                        >
                          {processing[item.pending_id] ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4" />
                              Save Changes
                            </>
                          )}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={processing[item.pending_id]}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center gap-2 transition disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApprove(item.pending_id)}
                          disabled={processing[item.pending_id]}
                          className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
                        >
                          {processing[item.pending_id] ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Approve & Create
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleStartEdit(item)}
                          disabled={processing[item.pending_id]}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition disabled:opacity-50"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleReject(item.pending_id)}
                          disabled={processing[item.pending_id]}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {expandedItems[item.pending_id] && (
                    <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                        {editingItem === item.pending_id ? "Edit Chapters:" : "Extracted Chapters:"}
                      </h4>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {(editingItem === item.pending_id ? editForm.extracted_chapters : item.extracted_chapters)?.map((chapter, idx) => (
                          <div
                            key={`ch-${chapter.chapter_number}-${idx}`}
                            className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg flex items-center justify-center font-bold text-sm">
                                {editingItem === item.pending_id ? (
                                  <input
                                    type="number"
                                    value={chapter.chapter_number}
                                    onChange={(e) => updateChapterInEdit(idx, 'chapter_number', parseInt(e.target.value) || 1)}
                                    className="w-full text-center bg-transparent font-bold"
                                    min="1"
                                  />
                                ) : (
                                  chapter.chapter_number
                                )}
                              </div>
                              <div className="flex-1">
                                {editingItem === item.pending_id ? (
                                  <input
                                    type="text"
                                    value={chapter.chapter_name}
                                    onChange={(e) => updateChapterInEdit(idx, 'chapter_name', e.target.value)}
                                    className="w-full px-2 py-1 mb-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium"
                                  />
                                ) : (
                                  <h5 className="font-medium text-gray-900 dark:text-white mb-1">
                                    {chapter.chapter_name}
                                  </h5>
                                )}
                                {chapter.author && (
                                  editingItem === item.pending_id ? (
                                    <input
                                      type="text"
                                      value={chapter.author}
                                      onChange={(e) => updateChapterInEdit(idx, 'author', e.target.value)}
                                      placeholder="Author (optional)"
                                      className="w-full px-2 py-1 mb-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400"
                                    />
                                  ) : (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                      By {chapter.author}
                                    </p>
                                  )
                                )}
                                {chapter.topics && chapter.topics.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {chapter.topics.map((topic, topicIdx) => (
                                      <div key={`topic-${chapter.chapter_number}-${topicIdx}`} className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full flex-shrink-0"></span>
                                        {editingItem === item.pending_id ? (
                                          <div className="flex-1 flex items-center gap-2">
                                            <input
                                              type="text"
                                              value={topic.topic_name}
                                              onChange={(e) => updateTopicInEdit(idx, topicIdx, 'topic_name', e.target.value)}
                                              className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400"
                                            />
                                            {topic.page_range && (
                                              <input
                                                type="text"
                                                value={topic.page_range}
                                                onChange={(e) => updateTopicInEdit(idx, topicIdx, 'page_range', e.target.value)}
                                                placeholder="Pages"
                                                className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400"
                                              />
                                            )}
                                            <button
                                              onClick={() => deleteTopicInEdit(idx, topicIdx)}
                                              className="text-red-500 hover:text-red-700 p-1"
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          </div>
                                        ) : (
                                          <>
                                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                              {topic.section_number ? `${topic.section_number} ` : ""}{topic.topic_name}
                                            </span>
                                            {topic.page_range && (
                                              <span className="text-xs text-gray-400">
                                                (pg. {topic.page_range})
                                              </span>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    ))}

                                    {chapter.topics.map((topic, topicIdx) =>
                                      (topic.subtopics && topic.subtopics.length > 0) ? (
                                        <div key={`subtopics-${chapter.chapter_number}-${topicIdx}`} className="ml-7 space-y-1">
                                          {(topic.subtopics || []).map((subtopic, subIdx) => (
                                            <div key={`subtopic-${chapter.chapter_number}-${topicIdx}-${subIdx}`} className="flex items-center gap-2">
                                              <span className="w-1 h-1 bg-gray-300 rounded-full flex-shrink-0"></span>
                                              {editingItem === item.pending_id ? (
                                                <div className="flex-1 flex items-center gap-2">
                                                  <input
                                                    type="text"
                                                    value={subtopic.topic_name}
                                                    onChange={(e) => updateSubtopicInEdit(idx, topicIdx, subIdx, 'topic_name', e.target.value)}
                                                    className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400"
                                                  />
                                                  {subtopic.page_range && (
                                                    <input
                                                      type="text"
                                                      value={subtopic.page_range}
                                                      onChange={(e) => updateSubtopicInEdit(idx, topicIdx, subIdx, 'page_range', e.target.value)}
                                                      placeholder="Pages"
                                                      className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400"
                                                    />
                                                  )}
                                                  <button
                                                    onClick={() => deleteSubtopicInEdit(idx, topicIdx, subIdx)}
                                                    className="text-red-500 hover:text-red-700 p-1"
                                                  >
                                                    <X className="w-3 h-3" />
                                                  </button>
                                                </div>
                                              ) : (
                                                <>
                                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                                    {subtopic.section_number ? `${subtopic.section_number} ` : ""}{subtopic.topic_name}
                                                  </span>
                                                  {subtopic.page_range && (
                                                    <span className="text-xs text-gray-400">
                                                      (pg. {subtopic.page_range})
                                                    </span>
                                                  )}
                                                </>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      ) : null
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {chapter.page_number && (
                                  editingItem === item.pending_id ? (
                                    <input
                                      type="number"
                                      value={chapter.page_number}
                                      onChange={(e) => updateChapterInEdit(idx, 'page_number', parseInt(e.target.value) || 1)}
                                      placeholder="Page"
                                      className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 text-center"
                                      min="1"
                                    />
                                  ) : (
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      Page {chapter.page_number}
                                    </span>
                                  )
                                )}
                                {editingItem === item.pending_id && (
                                  <button
                                    onClick={() => deleteChapterInEdit(idx)}
                                    className="text-red-500 hover:text-red-700 p-1"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
