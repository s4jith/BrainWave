import { useState, useEffect, useCallback } from "react";
import AdminLayout from "../components/AdminLayout";
import QuestionImageRenderer from "../components/QuestionImageRenderer";
import QuestionImageUploadPanel from "../components/QuestionImageUploadPanel";
import useUserStore from "../stores/userStore";
import {
  FileText, Plus, Upload, Edit2, Trash2, Search, Filter,
  ChevronDown, ChevronUp, X, Loader2, CheckCircle, AlertCircle,
  BookOpen, Calendar, GraduationCap, ClipboardList, ArrowRight,
  Check, Ban, Save, Database, SlidersHorizontal, RefreshCw, Layers
} from "lucide-react";
import authFetch from "../utils/authFetch";

const API_URL = import.meta.env.VITE_API_URL;

const PAPER_TYPES = [
  { value: "quarterly", label: "Quarterly" },
  { value: "half_yearly", label: "Half Yearly" },
  { value: "annual", label: "Annual" },
  { value: "unit_test", label: "Unit Test" },
  { value: "pre_board", label: "Pre Board" },
  { value: "other", label: "Other" },
];

const QUESTION_TYPES = [
  { value: "mcq", label: "MCQ" },
  { value: "fillup", label: "Fill in the Blank" },
  { value: "true_false", label: "True / False" },
  { value: "short_answer", label: "Short Answer" },
  { value: "long_answer", label: "Long Answer" },
];

const TYPE_COLORS = {
  mcq: "bg-purple-100 text-purple-700",
  fillup: "bg-blue-100 text-blue-700",
  true_false: "bg-teal-100 text-teal-700",
  short_answer: "bg-green-100 text-green-700",
  long_answer: "bg-orange-100 text-orange-700",
};

const PAPER_TYPE_COLORS = {
  quarterly: "bg-blue-100 text-blue-700",
  half_yearly: "bg-indigo-100 text-indigo-700",
  annual: "bg-purple-100 text-purple-700",
  unit_test: "bg-amber-100 text-amber-700",
  pre_board: "bg-red-100 text-red-700",
  other: "bg-gray-100 text-gray-700",
};

const STATUS_COLORS = {
  draft_answer: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export default function QuestionPapers() {
  const { getAuthHeader, user } = useUserStore();
  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";
  const isHead = user?.role === "head";
  const [headAssignment, setHeadAssignment] = useState(null);
  const [papers, setPapers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ class_level: "", subject: "", paper_type: "", year: "", status: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [expandedPaper, setExpandedPaper] = useState(null);
  const [expandedQuestions, setExpandedQuestions] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(null);
  const [metadata, setMetadata] = useState({ subjects: [], years: [] });
  const [addingToBank, setAddingToBank] = useState(null);
  const [editPaper, setEditPaper] = useState(null);
  const [activeTab, setActiveTab] = useState("papers");

  const fetchPapers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.class_level) params.append("class_level", filters.class_level);
      if (filters.subject) params.append("subject", filters.subject);
      if (filters.paper_type) params.append("paper_type", filters.paper_type);
      if (filters.year) params.append("year", filters.year);
      const requestedStatus = filters.status || (activeTab === "answers" ? "draft_answer" : activeTab === "pending-papers" ? "pending" : "");
      if (requestedStatus) params.append("status", requestedStatus);
      if (activeTab === "answers" || activeTab === "pending-papers") {
        params.append("include_questions", "true");
      }

      const res = await authFetch(`${API_URL}/api/question-papers?${params}`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        setPapers(data.papers || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      //
    }
    setLoading(false);
  }, [filters, getAuthHeader, activeTab]);

  const fetchMetadata = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/question-papers/metadata`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        setMetadata(data);
      }
    } catch (err) {
      //
    }
  }, [getAuthHeader]);

  useEffect(() => {
    if (isHead) {
      authFetch(`${API_URL}/api/head/my-assignment`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setHeadAssignment(d); })
        .catch(() => {});
    }
  }, [isHead]);

  useEffect(() => {
    fetchPapers();
    fetchMetadata();
  }, [fetchPapers, fetchMetadata]);

  const handleExpand = async (paperId) => {
    if (expandedPaper === paperId) {
      setExpandedPaper(null);
      setExpandedQuestions([]);
      return;
    }
    setLoadingDetail(paperId);
    try {
      const res = await authFetch(`${API_URL}/api/question-papers/${paperId}`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        setExpandedQuestions(data.questions || []);
        setExpandedPaper(paperId);
      }
    } catch (err) {
      //
    }
    setLoadingDetail(null);
  };

  const handleDelete = async (paperId) => {
    const msg = isTeacher
      ? "Request deletion of this paper? It will need admin/head approval."
      : "Delete this question paper?";
    if (!confirm(msg)) return;
    try {
      const res = await authFetch(`${API_URL}/api/question-papers/${paperId}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        if (isTeacher && data.message) alert(data.message);
        fetchPapers();
        if (expandedPaper === paperId) {
          setExpandedPaper(null);
          setExpandedQuestions([]);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.detail || "Failed to delete paper");
      }
    } catch (err) {
      //
    }
  };

  const handleAddToBank = async (paperId) => {
    setAddingToBank(paperId);
    try {
      const res = await authFetch(`${API_URL}/api/question-papers/${paperId}/add-to-bank`, {
        method: "POST",
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message);
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to add to bank");
      }
    } catch (err) {
      //
    }
    setAddingToBank(null);
  };

  const handleApprove = async (paperId) => {
    try {
      const res = await authFetch(`${API_URL}/api/question-papers/${paperId}/approve`, {
        method: "POST",
        headers: getAuthHeader(),
      });
      if (res.ok) {
        fetchPapers();
      }
    } catch (err) {
      //
    }
  };

  const handleReject = async (paperId) => {
    if (!confirm("Reject this question paper?")) return;
    try {
      const res = await authFetch(`${API_URL}/api/question-papers/${paperId}/reject`, {
        method: "POST",
        headers: getAuthHeader(),
      });
      if (res.ok) {
        fetchPapers();
      }
    } catch (err) {
      //
    }
  };

  const handleApproveDelete = async (paperId) => {
    if (!confirm("Approve deletion? The paper will be permanently deleted.")) return;
    try {
      const res = await authFetch(`${API_URL}/api/question-papers/${paperId}/approve-delete`, {
        method: "POST",
        headers: getAuthHeader(),
      });
      if (res.ok) {
        fetchPapers();
      }
    } catch (err) {
      //
    }
  };

  const handleRejectDelete = async (paperId) => {
    try {
      const res = await authFetch(`${API_URL}/api/question-papers/${paperId}/reject-delete`, {
        method: "POST",
        headers: getAuthHeader(),
      });
      if (res.ok) {
        fetchPapers();
      }
    } catch (err) {
      //
    }
  };

  const handleEdit = async (paperId) => {
    try {
      const res = await authFetch(`${API_URL}/api/question-papers/${paperId}`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        setEditPaper(data);
      }
    } catch (err) {
      //
    }
  };

  const handleSendToPending = async (paperId) => {
    if (!confirm("Send this paper to pending for admin/head review?")) return;
    try {
      const res = await authFetch(`${API_URL}/api/question-papers/${paperId}/send-to-pending`, {
        method: "POST",
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.message) alert(data.message);
        fetchPapers();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.detail || "Failed to send paper to pending");
      }
    } catch (err) {
      alert("Failed to send paper to pending");
    }
  };

  const getPaperTypeLabel = (val) => PAPER_TYPES.find(p => p.value === val)?.label || val;
  const getTypeLabel = (val) => QUESTION_TYPES.find(t => t.value === val)?.label || val;

  const pendingCount = papers.filter(p => p.status === "pending").length;
  const deleteRequestedCount = papers.filter(p => p.delete_requested).length;
  const myUserId = user?.user_id || user?.id;
  const canApprove = isAdmin || isHead;

  const allClassLevels = [...new Set(papers.map(p => p.class_level).filter(Boolean))].sort((a, b) => a - b);
  const filterSubjectNames = [...new Set(papers.map(p => p.subject).filter(Boolean))].sort();
  const filterYears = [...new Set(papers.map(p => p.year).filter(Boolean))].sort((a, b) => b - a);

  return (
    <AdminLayout title="Question Papers" icon={FileText}>
      <div className="p-6 space-y-6">
        {(pendingCount > 0 || deleteRequestedCount > 0) && canApprove && (
          <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {pendingCount > 0 && `${pendingCount} paper${pendingCount !== 1 ? "s" : ""} pending approval`}
              {pendingCount > 0 && deleteRequestedCount > 0 && " · "}
              {deleteRequestedCount > 0 && `${deleteRequestedCount} delete request${deleteRequestedCount !== 1 ? "s" : ""}`}
            </span>
            {pendingCount > 0 && (
              <button
                onClick={() => setFilters(f => ({ ...f, status: "pending" }))}
                className="ml-auto text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline"
              >
                View pending →
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {total} paper{total !== 1 ? "s" : ""} found
            </p>
          </div>
          <button
            onClick={() => { setShowCreate(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Paper
          </button>
        </div>

        <div className="flex gap-1 border-b border-gray-200 dark:border-zinc-800 pb-1">
          <button
            onClick={() => { setActiveTab("papers"); setFilters((f) => ({ ...f, status: "" })); }}
            className={`px-3 py-2 text-sm font-medium rounded-lg ${activeTab === "papers" ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"}`}
          >
            Papers
          </button>
          {(isTeacher || isAdmin || isHead) && (
            <button
              onClick={() => { setActiveTab("answers"); setFilters((f) => ({ ...f, status: "" })); }}
              className={`px-3 py-2 text-sm font-medium rounded-lg ${activeTab === "answers" ? "bg-indigo-600 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"}`}
            >
              Answer Page
            </button>
          )}
          {canApprove && (
            <button
              onClick={() => { setActiveTab("pending-papers"); setFilters((f) => ({ ...f, status: "" })); }}
              className={`px-3 py-2 text-sm font-medium rounded-lg ${activeTab === "pending-papers" ? "bg-amber-600 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"}`}
            >
              Pending Papers
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {(!isHead || headAssignment?.assignment_type === "subject") && (
          <select
            value={filters.class_level}
            onChange={(e) => setFilters(f => ({ ...f, class_level: e.target.value }))}
            className="px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
          >
            <option value="">All Classes</option>
            {allClassLevels.map(cl => (
              <option key={cl} value={cl}>Class {cl}</option>
            ))}
          </select>
          )}

          {(!isHead || headAssignment?.assignment_type === "class") && (
          <select
            value={filters.subject}
            onChange={(e) => setFilters(f => ({ ...f, subject: e.target.value }))}
            className="px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
          >
            <option value="">All Subjects</option>
            {filterSubjectNames.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          )}

          <select
            value={filters.paper_type}
            onChange={(e) => setFilters(f => ({ ...f, paper_type: e.target.value }))}
            className="px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
          >
            <option value="">All Types</option>
            {(metadata.paper_types && metadata.paper_types.length > 0
              ? metadata.paper_types.map(t => {
                  const found = PAPER_TYPES.find(p => p.value === t);
                  return <option key={t} value={t}>{found ? found.label : t}</option>;
                })
              : PAPER_TYPES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))
            )}
          </select>

          <select
            value={filters.year}
            onChange={(e) => setFilters(f => ({ ...f, year: e.target.value }))}
            className="px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
          >
            <option value="">All Years</option>
            {filterYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
            className="px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
          >
            <option value="">All Status</option>
            {(isTeacher || isAdmin || isHead) && <option value="draft_answer">Draft Answer</option>}
            <option value="approved">Approved</option>
            {!isTeacher && <option value="pending">Pending</option>}
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : papers.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">No question papers found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {papers.map((paper) => (
              <div key={paper.id} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                  onClick={() => {
                    if (activeTab === "papers") handleExpand(paper.id);
                  }}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-gray-900 dark:text-white text-sm truncate">{paper.title}</h3>
                        {paper.created_by === myUserId
                          ? <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 flex-shrink-0">Your paper</span>
                          : <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-zinc-700 dark:text-gray-400 flex-shrink-0" title={paper.created_by}>By {paper.created_by?.includes("@") ? paper.created_by.split("@")[0] : "staff"}</span>
                        }
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <GraduationCap className="w-3 h-3" /> Class {paper.class_level}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <BookOpen className="w-3 h-3" /> {paper.subject}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {paper.year}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {paper.question_count} Q
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PAPER_TYPE_COLORS[paper.paper_type] || "bg-gray-100 text-gray-700"}`}>
                      {getPaperTypeLabel(paper.paper_type)}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[paper.status] || STATUS_COLORS.approved}`}>
                      {paper.status || "approved"}
                    </span>
                    {paper.delete_requested && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 animate-pulse">
                        Delete Requested
                      </span>
                    )}
                    {paper.source === "pdf_extracted" && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">AI</span>
                    )}

                    {activeTab === "answers" && paper.status === "draft_answer" && (isTeacher || isAdmin || isHead) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSendToPending(paper.id); }}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 rounded-lg transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" /> Send to Pending
                      </button>
                    )}

                    {/* Approve/Reject for pending papers — admin & head only */}
                    {paper.status === "pending" && canApprove && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleApprove(paper.id); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50 rounded-lg transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleReject(paper.id); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                        >
                          <Ban className="w-3.5 h-3.5" /> Reject
                        </button>
                      </>
                    )}

                    {/* Approve/Reject delete request — admin & head only */}
                    {paper.delete_requested && canApprove && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleApproveDelete(paper.id); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50 rounded-lg transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve Delete
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRejectDelete(paper.id); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 rounded-lg transition-colors"
                        >
                          <Ban className="w-3.5 h-3.5" /> Reject Delete
                        </button>
                      </>
                    )}

                    {activeTab === "papers" && paper.status === "approved" && !paper.delete_requested && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAddToBank(paper.id); }}
                        disabled={addingToBank === paper.id}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                        title="Add to Question Bank"
                      >
                        {addingToBank === paper.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                      </button>
                    )}
                    {activeTab !== "pending-papers" && <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(paper.id); }}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title={isTeacher ? "Edit (requires approval)" : "Edit"}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>}
                    {activeTab !== "pending-papers" && !(isTeacher && paper.delete_requested) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(paper.id); }}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title={isTeacher ? "Request Delete" : "Delete"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {activeTab === "papers" && (loadingDetail === paper.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    ) : expandedPaper === paper.id ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ))}
                  </div>
                </div>

                {(expandedPaper === paper.id || activeTab === "answers" || activeTab === "pending-papers") && (
                  <div className="border-t border-gray-100 dark:border-zinc-800 p-4">
                    {((activeTab === "answers" || activeTab === "pending-papers") ? (paper.questions || []) : expandedQuestions).length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No questions</p>
                    ) : (
                      <div className="space-y-3">
                        {(() => {
                          const sections = {};
                          const sourceQuestions = (activeTab === "answers" || activeTab === "pending-papers") ? (paper.questions || []) : expandedQuestions;
                          sourceQuestions.forEach(q => {
                            const sec = q.section || "General";
                            if (!sections[sec]) sections[sec] = [];
                            sections[sec].push(q);
                          });
                          return Object.entries(sections).map(([section, qs]) => (
                            <div key={section}>
                              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{section}</h4>
                              <div className="space-y-2">
                                {qs.map((q, idx) => (
                                  <div key={idx} className="flex gap-3 p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg">
                                    <span className="text-xs font-mono text-gray-400 mt-0.5 w-6 flex-shrink-0">{q.order || idx + 1}</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-gray-800 dark:text-gray-200">
                                        <QuestionImageRenderer text={q.text} />
                                      </p>
                                      {q.type === "mcq" && q.options?.length > 0 && (
                                        <div className="mt-2 grid grid-cols-2 gap-1">
                                          {q.options.map((opt, oi) => {
                                            const correctAnswers = (q.correct_answer || "").split("|").filter(Boolean);
                                            const isCorrect = correctAnswers.includes(opt);
                                            return (
                                              <span key={oi} className={`text-xs px-2 py-1 rounded border ${isCorrect ? "bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:text-green-300 font-medium" : "bg-white dark:bg-zinc-700 border-gray-200 dark:border-zinc-600 text-gray-600 dark:text-gray-300"}`}>
                                                {String.fromCharCode(65 + oi)}. {opt}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      )}
                                      {q.type === "fillup" && activeTab === "papers" && q.correct_answer && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                          <span className="text-xs text-gray-500">Answer(s):</span>
                                          {q.correct_answer.split("|").filter(Boolean).map((ans, ai) => (
                                            <span key={ai} className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-medium">{ans}</span>
                                          ))}
                                        </div>
                                      )}
                                      {q.type === "true_false" && activeTab === "papers" && q.correct_answer && (
                                        <p className="text-xs mt-1 text-gray-500">
                                          Answer: <span className={q.correct_answer.toLowerCase() === "true" ? "text-green-600 font-medium" : "text-red-600 font-medium"}>{q.correct_answer}</span>
                                        </p>
                                      )}
                                      {q.type !== "mcq" && q.type !== "true_false" && q.type !== "fillup" && activeTab === "papers" && q.correct_answer && (
                                        <p className="text-xs mt-1 text-gray-500">Answer: {q.correct_answer}</p>
                                      )}

                                      {(activeTab === "answers" || activeTab === "pending-papers") && q.type !== "mcq" && (
                                        <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 rounded px-2 py-1.5 whitespace-pre-wrap">
                                          Answer: {q.correct_answer || "[Write answer here]"}
                                        </div>
                                      )}
                                      {(activeTab === "answers" || activeTab === "pending-papers") && !q.correct_answer && (
                                        <p className="text-xs mt-1 text-red-500">Missing answer</p>
                                      )}
                                    </div>
                                    <div className="flex items-start gap-2 flex-shrink-0">
                                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[q.type] || "bg-gray-100 text-gray-600"}`}>
                                        {getTypeLabel(q.type)}
                                      </span>
                                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300">
                                        {q.marks}M
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {showCreate && (
          <CreatePaperModal
            metadata={metadata}
            onClose={() => { setShowCreate(false); }}
            onCreated={() => { setShowCreate(false); fetchPapers(); }}
          />
        )}

        {editPaper && (
          <EditPaperModal
            paper={editPaper}
            metadata={metadata}
            onClose={() => setEditPaper(null)}
            onSaved={() => { setEditPaper(null); fetchPapers(); if (expandedPaper === editPaper.id) { setExpandedPaper(null); setExpandedQuestions([]); } }}
          />
        )}
      </div>
    </AdminLayout>
  );
}


function CreatePaperModal({ metadata, onClose, onCreated }) {
  const { getAuthHeader, user } = useUserStore();
  const isTeacher = user?.role === "teacher";
  const [createMode, setCreateMode] = useState(null); // null | "bank" | "pdf"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Shared paper details ─────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [paperType, setPaperType] = useState("");
  const [customPaperType, setCustomPaperType] = useState("");
  const [classLevel, setClassLevel] = useState("");
  const [subject, setSubject] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());

  // ── PDF Mode ─────────────────────────────────────────────────────────────
  const [pdfFile, setPdfFile] = useState(null);

  // ── Bank Mode: sections ──────────────────────────────────────────────────
  const SECTION_NAMES = ["Section A","Section B","Section C","Section D","Section E","Section F","Section G","Section H"];
  const [sections, setSections] = useState([{ id: 1, name: "Section A", questions: [] }]);
  const [sectionCounter, setSectionCounter] = useState(2);
  const [activeSection, setActiveSection] = useState(0);

  // ── Bank Mode: QB browser ────────────────────────────────────────────────
  const [qbFilters, setQbFilters] = useState({ chapter: "", bloom_level: "", difficulty: "", q_type: "", search: "" });
  const [qbResults, setQbResults] = useState([]);
  const [qbLoading, setQbLoading] = useState(false);
  const [qbTotal, setQbTotal] = useState(0);
  const [qbSearched, setQbSearched] = useState(false);

  // Auto-select when metadata has only one subject
  useEffect(() => {
    if (metadata.subjects?.length === 1 && !subject) setSubject(metadata.subjects[0].subject);
  }, [metadata.subjects]);
  useEffect(() => {
    if (!classLevel) return;
    const filtered = (metadata.subjects || []).filter(s => s.class_levels?.includes(Number(classLevel)));
    if (filtered.length === 1) setSubject(filtered[0].subject);
  }, [classLevel, metadata.subjects]);

  const effectivePaperType = paperType === "other" ? customPaperType.trim() : paperType;
  const isDetailsValid = title.trim() && effectivePaperType && classLevel && subject && year;
  const totalMarks = sections.reduce((sum, sec) => sum + sec.questions.reduce((s, q) => s + (q.marks || 0), 0), 0);
  const totalQuestions = sections.reduce((sum, sec) => sum + sec.questions.length, 0);

  // ── QB browser logic ─────────────────────────────────────────────────────
  const browseQB = async () => {
    if (!classLevel || !subject) return;
    setQbLoading(true);
    setQbResults([]);
    setQbSearched(true);
    try {
      const params = new URLSearchParams({ class_level: classLevel, subject, status: "approved", limit: 50 });
      if (qbFilters.chapter) params.append("chapter", qbFilters.chapter);
      if (qbFilters.bloom_level) params.append("bloom_level", qbFilters.bloom_level);
      if (qbFilters.difficulty) params.append("difficulty", qbFilters.difficulty);
      if (qbFilters.q_type) params.append("type", qbFilters.q_type);
      if (qbFilters.search) params.append("search", qbFilters.search);
      const res = await authFetch(`${API_URL}/api/question-bank/questions?${params}`, { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        setQbResults(data.questions || []);
        setQbTotal(data.total || 0);
      }
    } catch {}
    setQbLoading(false);
  };

  const isAddedToActiveSection = (qId) =>
    sections[activeSection]?.questions.some(q => q.question_bank_id === qId);

  const addQuestionToSection = (q) => {
    if (isAddedToActiveSection(q.id)) return;
    setSections(prev => prev.map((s, i) =>
      i === activeSection
        ? { ...s, questions: [...s.questions, { question_bank_id: q.id, text: q.text, type: q.type, marks: q.marks, difficulty: q.difficulty, bloom_level: q.bloom_level, options: q.options || [], correct_answer: q.correct_answer || "", chapter: q.chapter, chapter_name: q.chapter_name }] }
        : s
    ));
  };

  const removeQuestion = (secIdx, qIdx) =>
    setSections(prev => prev.map((s, i) => i === secIdx ? { ...s, questions: s.questions.filter((_, qi) => qi !== qIdx) } : s));

  const addSection = () => {
    const name = SECTION_NAMES[sectionCounter - 1] || `Section ${sectionCounter}`;
    setSections(prev => [...prev, { id: sectionCounter, name, questions: [] }]);
    setActiveSection(sections.length);
    setSectionCounter(c => c + 1);
  };

  const removeSection = (idx) => {
    if (sections.length === 1) return;
    setSections(prev => prev.filter((_, i) => i !== idx));
    setActiveSection(prev => (prev >= idx && prev > 0) ? prev - 1 : prev);
  };

  const updateSectionName = (idx, name) =>
    setSections(prev => prev.map((s, i) => i === idx ? { ...s, name } : s));

  // ── Save from bank ────────────────────────────────────────────────────────
  const handleCreateFromBank = async () => {
    if (!isDetailsValid) { setError("Please fill all paper details"); return; }
    if (totalQuestions === 0) { setError("Add at least one question to the paper"); return; }
    setLoading(true); setError("");
    try {
      const allQuestions = sections.flatMap(sec =>
        sec.questions.map(q => ({
          text: q.text, type: q.type, marks: q.marks,
          options: q.options || [], correct_answer: q.correct_answer || "",
          section: sec.name, bloom_level: q.bloom_level || null,
          difficulty: q.difficulty || null, question_bank_id: q.question_bank_id || null,
        }))
      );
      const res = await authFetch(`${API_URL}/api/question-papers`, {
        method: "POST",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), paper_type: effectivePaperType, class_level: Number(classLevel), subject, year: Number(year), questions: allQuestions }),
      });
      if (res.ok) { onCreated(); }
      else { const d = await res.json(); setError(d.detail || "Failed to create paper"); }
    } catch { setError("Failed to create paper"); }
    setLoading(false);
  };

  // ── Save PDF extraction ───────────────────────────────────────────────────
  const handlePdfExtract = async () => {
    if (!pdfFile) return;
    const isPdf = pdfFile.type === "application/pdf" || pdfFile.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("Please upload a valid PDF file");
      return;
    }
    setLoading(true); setError("");
    try {
      const formData = new FormData();
      formData.append("pdf_file", pdfFile);
      formData.append("title", title || pdfFile.name.replace(".pdf", ""));
      formData.append("paper_type", effectivePaperType);
      formData.append("class_level", classLevel);
      formData.append("subject", subject);
      formData.append("year", year);
      const res = await authFetch(`${API_URL}/api/question-papers/extract-pdf`, {
        method: "POST", headers: getAuthHeader(), body: formData,
      });
      if (res.ok) { onCreated(); }
      else { const d = await res.json(); setError(d.detail || "Failed to extract questions"); }
    } catch { setError("Failed to extract questions from PDF"); }
    setLoading(false);
  };

  const handlePdfFileChange = (file) => {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("Only PDF files are allowed");
      setPdfFile(null);
      return;
    }
    setError("");
    setPdfFile(file);
  };

  // ── Paper details form (reusable in both modes) ───────────────────────────
  const renderPaperDetailsForm = () => (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Exam Name / Title <span className="text-red-500">*</span></label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Quarterly Exam 2025 – Maths"
          className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Exam Type <span className="text-red-500">*</span></label>
        <select value={paperType} onChange={e => setPaperType(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white">
          <option value="">Select type</option>
          {PAPER_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        {paperType === "other" && (
          <input value={customPaperType} onChange={e => setCustomPaperType(e.target.value)} placeholder="Custom type name"
            className="w-full mt-1.5 px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white" />
        )}
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Year <span className="text-red-500">*</span></label>
        <input type="number" min="2000" max="2099" value={year} onChange={e => setYear(e.target.value)} placeholder="2025"
          className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Class <span className="text-red-500">*</span></label>
        <select value={classLevel} onChange={e => { setClassLevel(e.target.value); setSubject(""); setQbResults([]); setQbSearched(false); }}
          className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white">
          <option value="">Select class</option>
          {((metadata.subjects || []).length > 0
            ? [...new Set(metadata.subjects.flatMap(s => s.class_levels || []))].sort((a, b) => a - b)
            : Array.from({ length: 12 }, (_, i) => i + 1)
          ).map(cl => <option key={cl} value={cl}>Class {cl}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Subject <span className="text-red-500">*</span></label>
        {(metadata.subjects || []).length > 0 ? (
          <select value={subject} onChange={e => { setSubject(e.target.value); setQbResults([]); setQbSearched(false); }}
            className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white">
            <option value="">Select subject</option>
            {(metadata.subjects || []).filter(s => !classLevel || (s.class_levels || []).includes(Number(classLevel)))
              .map((s, idx) => <option key={`${s.subject}-${idx}`} value={s.subject}>{s.subject}</option>)}
          </select>
        ) : (
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Maths"
            className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white" />
        )}
      </div>
    </div>
  );

  // ── Mode picker ───────────────────────────────────────────────────────────
  if (!createMode) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Question Paper</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setCreateMode("bank")}
              className="flex flex-col items-center gap-3 p-6 border-2 border-gray-200 dark:border-zinc-700 rounded-xl hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all">
              <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Database className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-center">
                <p className="font-medium text-gray-900 dark:text-white">From Question Bank</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Pick questions from the bank, organise into sections</p>
              </div>
            </button>
            <button onClick={() => setCreateMode("pdf")}
              className="flex flex-col items-center gap-3 p-6 border-2 border-gray-200 dark:border-zinc-700 rounded-xl hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/10 transition-all">
              <div className="w-14 h-14 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <Upload className="w-7 h-7 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="text-center">
                <p className="font-medium text-gray-900 dark:text-white">Upload PDF</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">AI extracts questions automatically</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── PDF mode ──────────────────────────────────────────────────────────────
  if (createMode === "pdf") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <button onClick={() => setCreateMode(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">
                <ChevronDown className="w-4 h-4 rotate-90" />
              </button>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Upload Question Paper PDF</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {error && <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
            {renderPaperDetailsForm()}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Question Paper PDF</label>
              <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${pdfFile ? "border-violet-300 bg-violet-50 dark:bg-violet-900/10" : "border-gray-200 dark:border-zinc-700 hover:border-gray-300"}`}>
                {pdfFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="w-8 h-8 text-violet-500" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{pdfFile.name}</p>
                      <p className="text-xs text-gray-500">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button onClick={() => setPdfFile(null)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg ml-3"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Click to upload or drag & drop</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">PDF only, max 20MB</p>
                    <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={e => { if (e.target.files[0]) handlePdfFileChange(e.target.files[0]); }} />
                  </label>
                )}
              </div>
            </div>
          </div>
          <div className="p-5 border-t border-gray-100 dark:border-zinc-800 flex justify-end gap-3">
            {isTeacher && <p className="text-xs text-amber-600 dark:text-amber-400 mr-auto flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" />Submitted for approval</p>}
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">Cancel</button>
            <button onClick={handlePdfExtract} disabled={loading || !isDetailsValid || !pdfFile}
              className="flex items-center gap-2 px-5 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {loading ? "Extracting..." : "Extract & Save"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Bank mode (main new feature) ──────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-6xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setCreateMode(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">
              <ChevronDown className="w-4 h-4 rotate-90" />
            </button>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" /> Build Paper from Question Bank
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {totalQuestions > 0 && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-gray-800 dark:text-white">{totalQuestions}</span> questions · <span className="font-semibold text-gray-800 dark:text-white">{totalMarks}</span> marks
              </span>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-3 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm flex-shrink-0">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        {/* Body: 2-column */}
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* LEFT: Paper details + sections */}
          <div className="w-[38%] flex-shrink-0 border-r border-gray-100 dark:border-zinc-800 overflow-y-auto p-4 space-y-4">

            {/* Paper details */}
            <div className="bg-gray-50 dark:bg-zinc-800/60 rounded-xl p-3 space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Paper Details</h3>
              {renderPaperDetailsForm()}
            </div>

            {/* Sections */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Sections
                </h3>
                <button onClick={addSection} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20">
                  <Plus className="w-3 h-3" /> Add Section
                </button>
              </div>

              <div className="space-y-2">
                {sections.map((sec, secIdx) => (
                  <div key={sec.id} className={`rounded-xl border-2 transition-all ${activeSection === secIdx ? "border-blue-400 bg-blue-50 dark:bg-blue-900/10" : "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40"}`}>
                    <div
                      className="flex items-center gap-2 p-2.5 cursor-pointer"
                      onClick={() => setActiveSection(secIdx)}
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${activeSection === secIdx ? "bg-blue-500" : "bg-gray-300 dark:bg-zinc-600"}`} />
                      <input
                        value={sec.name}
                        onChange={e => updateSectionName(secIdx, e.target.value)}
                        onClick={e => e.stopPropagation()}
                        className="flex-1 text-sm font-medium bg-transparent text-gray-800 dark:text-white outline-none min-w-0"
                        placeholder="Section name"
                      />
                      <span className="text-xs text-gray-400 flex-shrink-0">{sec.questions.length}Q · {sec.questions.reduce((s, q) => s + q.marks, 0)}M</span>
                      {sections.length > 1 && (
                        <button onClick={e => { e.stopPropagation(); removeSection(secIdx); }} className="p-1 text-gray-300 hover:text-red-500 flex-shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {activeSection === secIdx && sec.questions.length > 0 && (
                      <div className="border-t border-blue-200 dark:border-blue-800/50 px-2.5 pb-2 space-y-1 max-h-48 overflow-y-auto">
                        {sec.questions.map((q, qi) => (
                          <div key={qi} className="flex items-start gap-2 py-1.5">
                            <span className="text-xs text-blue-400 font-mono mt-0.5 flex-shrink-0 w-4">{qi + 1}.</span>
                            <p className="flex-1 text-xs text-gray-700 dark:text-gray-300 line-clamp-2 min-w-0">{q.text}</p>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className={`text-xs px-1 py-0.5 rounded ${TYPE_COLORS[q.type] || "bg-gray-100 text-gray-600"}`}>{q.type.replace("_"," ")}</span>
                              <span className="text-xs text-gray-400">{q.marks}M</span>
                              <button onClick={() => removeQuestion(secIdx, qi)} className="p-0.5 text-gray-300 hover:text-red-500"><X className="w-3 h-3" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: QB browser */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0 space-y-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter Question Bank</span>
                {(!classLevel || !subject) && (
                  <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">Set class & subject first</span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <input
                  type="number" min="1" max="99"
                  value={qbFilters.chapter}
                  onChange={e => setQbFilters(p => ({ ...p, chapter: e.target.value }))}
                  placeholder="Chapter no."
                  className="px-2.5 py-1.5 border border-gray-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                />
                <select value={qbFilters.bloom_level} onChange={e => setQbFilters(p => ({ ...p, bloom_level: e.target.value }))}
                  className="px-2.5 py-1.5 border border-gray-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-gray-900 dark:text-white">
                  <option value="">Any Cognitive Level</option>
                  <option value="remember">Remember</option>
                  <option value="understand">Understand</option>
                  <option value="apply">Apply</option>
                  <option value="analyze">Analyze</option>
                  <option value="evaluate">Evaluate</option>
                  <option value="create">Create</option>
                </select>
                <select value={qbFilters.difficulty} onChange={e => setQbFilters(p => ({ ...p, difficulty: e.target.value }))}
                  className="px-2.5 py-1.5 border border-gray-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-gray-900 dark:text-white">
                  <option value="">Any Difficulty</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
                <select value={qbFilters.q_type} onChange={e => setQbFilters(p => ({ ...p, q_type: e.target.value }))}
                  className="px-2.5 py-1.5 border border-gray-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-gray-900 dark:text-white">
                  <option value="">Any Type</option>
                  {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input value={qbFilters.search} onChange={e => setQbFilters(p => ({ ...p, search: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && browseQB()}
                  placeholder="Search keywords..."
                  className="px-2.5 py-1.5 border border-gray-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-gray-900 dark:text-white col-span-1 sm:col-span-1" />
                <button onClick={browseQB} disabled={!classLevel || !subject || qbLoading}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  {qbLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  {qbLoading ? "Loading..." : "Browse"}
                </button>
              </div>
              {qbSearched && !qbLoading && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {qbTotal === 0 ? "No questions found. Try different filters." : `Showing ${qbResults.length} of ${qbTotal} questions`}
                  {activeSection < sections.length && <span className="ml-2 text-blue-600 font-medium">→ Adding to: {sections[activeSection].name}</span>}
                </p>
              )}
            </div>

            {/* QB Results */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {!qbSearched && !qbLoading && (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <Database className="w-12 h-12 text-gray-200 dark:text-zinc-700 mb-3" />
                  <p className="text-sm text-gray-400">Set paper details and click <strong>Browse</strong> to load questions</p>
                </div>
              )}
              {qbLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
                </div>
              )}
              {qbResults.map(q => {
                const added = isAddedToActiveSection(q.id);
                return (
                  <div key={q.id} className={`p-3 rounded-xl border transition-all ${added ? "border-green-300 bg-green-50 dark:bg-green-900/10" : "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40 hover:border-blue-300"}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{q.text}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[q.type] || "bg-gray-100 text-gray-600"}`}>{QUESTION_TYPES.find(t => t.value === q.type)?.label || q.type}</span>
                          {q.difficulty && <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${q.difficulty === "easy" ? "bg-green-100 text-green-700" : q.difficulty === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-orange-100 text-orange-700"}`}>{q.difficulty}</span>}
                          {q.bloom_level && <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 capitalize">{q.bloom_level}</span>}
                          {q.chapter && <span className="text-xs text-gray-400">Ch.{q.chapter}{q.chapter_name ? ` – ${q.chapter_name}` : ""}</span>}
                          <span className="text-xs text-gray-400 font-medium">{q.marks}M</span>
                        </div>
                      </div>
                      <button
                        onClick={() => addQuestionToSection(q)}
                        disabled={added}
                        className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${added ? "bg-green-100 text-green-700 dark:bg-green-900/20 cursor-default" : "bg-blue-600 text-white hover:bg-blue-700"}`}
                      >
                        {added ? <><Check className="w-3 h-3" /> Added</> : <><Plus className="w-3 h-3" /> Add</>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between flex-shrink-0 bg-white dark:bg-zinc-900">
          {isTeacher && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> Will be submitted for approval
            </p>
          )}
          {!isTeacher && <span />}
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">Cancel</button>
            <button onClick={handleCreateFromBank} disabled={loading || !isDetailsValid || totalQuestions === 0}
              className="flex items-center gap-2 px-5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {loading ? "Creating..." : isTeacher ? "Submit for Approval" : `Create Paper (${totalQuestions}Q · ${totalMarks}M)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}




function EditPaperModal({ paper, metadata, onClose, onSaved }) {
  const { getAuthHeader, user } = useUserStore();
  const isTeacher = user?.role === "teacher";
  const isAnswerDraftMode = paper.status === "draft_answer";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);

  const [title, setTitle] = useState(paper.title || "");
  const [paperType, setPaperType] = useState(
    PAPER_TYPES.find(p => p.value === paper.paper_type) ? paper.paper_type : "other"
  );
  const [customPaperType, setCustomPaperType] = useState(
    PAPER_TYPES.find(p => p.value === paper.paper_type) ? "" : (paper.paper_type || "")
  );
  const [classLevel, setClassLevel] = useState(paper.class_level || "");
  const [subject, setSubject] = useState(paper.subject || "");
  const [year, setYear] = useState(paper.year || "");
  const [questions, setQuestions] = useState(
    (paper.questions || []).map(q => ({
      text: q.text || "",
      type: q.type || "short_answer",
      marks: q.marks || 1,
      options: q.options || [],
      correct_answer: q.correct_answer || "",
      section: q.section || "",
      image_ids: q.image_ids || [],
      answer_image_ids: q.answer_image_ids || [],
    }))
  );

  const effectivePaperType = paperType === "other" ? customPaperType.trim() : paperType;

  const addQuestion = () => {
    setQuestions(prev => [...prev, { text: "", type: "mcq", marks: 1, options: ["", "", "", ""], correct_answer: "", section: "", image_ids: [], answer_image_ids: [] }]);
  };

  const removeQuestion = (idx) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx, field, value) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };

  const updateOption = (qIdx, oIdx, value) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = [...q.options];
      opts[oIdx] = value;
      return { ...q, options: opts };
    }));
  };

  const validateQuestionForPending = (q, idx) => {
    const qLabel = `Question ${idx + 1}`;
    if (!q.text?.trim()) {
      return `${qLabel}: Question text is required`;
    }

    if (q.type === "mcq") {
      const options = (q.options || []).map(opt => (opt || "").trim()).filter(Boolean);
      const correctAnswers = (q.correct_answer || "").split("|").filter(Boolean);
      if (options.length < 2) return `${qLabel}: Add at least 2 options for MCQ`;
      if (correctAnswers.length === 0) return `${qLabel}: Select at least one correct answer for MCQ`;
    } else if (q.type === "fillup") {
      const answers = (q.correct_answer || "").split("|").filter(Boolean);
      if (answers.length === 0) return `${qLabel}: Enter at least one correct answer for Fill-in-the-blank`;
    } else if (q.type === "true_false") {
      if (!q.correct_answer || (q.correct_answer !== "True" && q.correct_answer !== "False")) {
        return `${qLabel}: Select True or False as the correct answer`;
      }
    } else if (!(q.correct_answer || "").trim()) {
      return `${qLabel}: Answer is required before pending submission`;
    }
    return "";
  };

  const saveDraftToServer = async () => {
    const validQuestions = questions.filter(q => q.text.trim());
    setSavingDraft(true);
    setError("");
    try {
      const res = await authFetch(`${API_URL}/api/question-papers/${paper.id}`, {
        method: "PUT",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          paper_type: effectivePaperType || undefined,
          class_level: classLevel ? Number(classLevel) : undefined,
          subject: subject || undefined,
          year: year ? Number(year) : undefined,
          questions: validQuestions,
          submit_for_approval: false,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Failed to save draft");
        return false;
      }
      return true;
    } catch {
      setError("Failed to save draft");
      return false;
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) { setError("Title is required"); return; }

    const validQuestions = questions.filter(q => q.text.trim());

    // In draft answer mode, normal save should not force all answers to be filled.
    if (!isAnswerDraftMode) {
      for (let i = 0; i < validQuestions.length; i++) {
        const validationError = validateQuestionForPending(validQuestions[i], i);
        if (validationError) { setError(validationError); return; }
      }
    }

    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`${API_URL}/api/question-papers/${paper.id}`, {
        method: "PUT",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          paper_type: effectivePaperType || undefined,
          class_level: classLevel ? Number(classLevel) : undefined,
          subject: subject || undefined,
          year: year ? Number(year) : undefined,
          questions: validQuestions.length > 0 ? validQuestions : undefined,
          submit_for_approval: !isAnswerDraftMode,
        }),
      });

      if (res.ok) {
        onSaved();
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to update paper");
      }
    } catch (err) {
      setError("Failed to update paper");
    }
    setLoading(false);
  };

  const handleSendAll = async () => {
    const validQuestions = questions.filter(q => q.text.trim());
    for (let i = 0; i < validQuestions.length; i++) {
      const validationError = validateQuestionForPending(validQuestions[i], i);
      if (validationError) { setError(validationError); return; }
    }

    const saved = await saveDraftToServer();
    if (!saved) return;

    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`${API_URL}/api/question-papers/${paper.id}/send-to-pending`, {
        method: "POST",
        headers: getAuthHeader(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Failed to send paper to pending");
        return;
      }
      onSaved();
    } catch {
      setError("Failed to send paper to pending");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Question Paper</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Paper Type</label>
              <select
                value={paperType}
                onChange={(e) => setPaperType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
              >
                <option value="">Select paper type</option>
                {PAPER_TYPES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              {paperType === "other" && (
                <input
                  value={customPaperType}
                  onChange={(e) => setCustomPaperType(e.target.value)}
                  placeholder="Enter custom paper type name"
                  className="w-full mt-2 px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                />
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Class</label>
              <select
                value={classLevel}
                onChange={(e) => { setClassLevel(e.target.value); setSubject(""); }}
                className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
              >
                <option value="">Select class</option>
                {((metadata.subjects || []).length > 0
                  ? [...new Set(metadata.subjects.flatMap(s => s.class_levels || []))].sort((a, b) => a - b)
                  : Array.from({ length: 12 }, (_, i) => i + 1)
                ).map(cl => (
                  <option key={cl} value={cl}>Class {cl}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Subject</label>
              {metadata.subjects && metadata.subjects.length > 0 ? (
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                >
                  <option value="">Select subject</option>
                  {(metadata.subjects || [])
                    .filter(s => !classLevel || (s.class_levels || []).includes(Number(classLevel)))
                    .map(s => (
                      <option key={`${s.subject}-${(s.class_levels || []).join("-")}`} value={s.subject}>{s.subject}</option>
                    ))}
                </select>
              ) : (
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Maths, Physics, English"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                />
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Year</label>
              <input
                type="number"
                min="2000"
                max="2099"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 2025"
                className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Questions ({questions.length})</h3>
              <button
                onClick={addQuestion}
                className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <Plus className="w-4 h-4" />
                Add Question
              </button>
            </div>

            {questions.map((q, idx) => (
              <div key={idx} className="p-4 border border-gray-200 dark:border-zinc-700 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Question {idx + 1}</span>
                  <div className="flex items-center gap-2">
                  {questions.length > 1 && (
                    <button onClick={() => removeQuestion(idx)} className="p-1 text-gray-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  </div>
                </div>

                <textarea
                  value={q.text}
                  onChange={(e) => updateQuestion(idx, "text", e.target.value)}
                  placeholder="Enter question text... Use image panel below to embed images."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white resize-none font-mono"
                />

                <div className={`grid gap-3 ${['mcq','fillup','true_false'].includes(q.type) ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                  <QuestionImageUploadPanel
                    title="Question Attachments"
                    placeholder="Click to upload"
                    text={q.text}
                    onTextChange={(newText) => updateQuestion(idx, "text", newText)}
                    imageIds={q.image_ids || []}
                    onImageIdsChange={(newIds) => updateQuestion(idx, "image_ids", newIds)}
                  />
                  {!['mcq','fillup','true_false'].includes(q.type) && (
                    <QuestionImageUploadPanel
                      title="Answer Attachments"
                      placeholder="Click to upload answer ref"
                      imageIds={q.answer_image_ids || []}
                      onImageIdsChange={(newIds) => updateQuestion(idx, "answer_image_ids", newIds)}
                    />
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Type</label>
                    <select
                      value={q.type}
                      onChange={(e) => {
                        updateQuestion(idx, "type", e.target.value);
                        if (e.target.value === "mcq") {
                          updateQuestion(idx, "options", ["", "", "", ""]);
                        } else {
                          updateQuestion(idx, "options", []);
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-gray-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                    >
                      {QUESTION_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Marks</label>
                    <input
                      type="number"
                      min={1}
                      value={q.marks}
                      onChange={(e) => updateQuestion(idx, "marks", parseInt(e.target.value) || 1)}
                      className="w-full px-2 py-1.5 border border-gray-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Section</label>
                    <input
                      value={q.section}
                      onChange={(e) => updateQuestion(idx, "section", e.target.value)}
                      placeholder="e.g. Section A"
                      className="w-full px-2 py-1.5 border border-gray-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {q.type === "mcq" && (
                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-500 block">Options <span className="text-red-500">*</span></label>
                    {(q.options || []).map((opt, oi) => {
                      const letter = String.fromCharCode(65 + oi);
                      const correctAnswers = (q.correct_answer || "").split("|").filter(Boolean);
                      const isCorrect = opt.trim() !== "" && correctAnswers.includes(opt);
                      return (
                        <div key={oi} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
                          isCorrect ? "border-green-400 bg-green-50 dark:bg-green-900/20" : "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                        }`}>
                          <span className="text-xs font-medium text-gray-400 w-4 shrink-0">{letter}</span>
                          <input
                            value={opt}
                            onChange={(e) => {
                              const correctAns = (q.correct_answer || "").split("|").filter(Boolean);
                              const wasCorrect = correctAns.includes(opt);
                              updateOption(idx, oi, e.target.value);
                              if (wasCorrect && e.target.value) {
                                const updated = correctAns.filter(a => a !== opt).concat(e.target.value);
                                updateQuestion(idx, "correct_answer", updated.join("|"));
                              } else if (wasCorrect) {
                                updateQuestion(idx, "correct_answer", correctAns.filter(a => a !== opt).join("|"));
                              }
                            }}
                            placeholder={`Option ${letter}`}
                            className="flex-1 text-xs bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400"
                          />
                          <input
                            type="checkbox"
                            checked={isCorrect}
                            onChange={() => {
                              const correctAns = (q.correct_answer || "").split("|").filter(Boolean);
                              const updated = isCorrect
                                ? correctAns.filter(a => a !== opt)
                                : [...correctAns, opt];
                              updateQuestion(idx, "correct_answer", updated.join("|"));
                            }}
                            className="w-4 h-4 rounded accent-green-500 shrink-0 cursor-pointer"
                            title="Mark as correct answer"
                          />
                        </div>
                      );
                    })}
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Select one or more checkboxes for correct answer(s).</p>
                    {!(q.correct_answer || "").split("|").filter(Boolean).length && (
                      <p className="text-xs text-red-500 mt-1">⚠ Please select at least one correct answer</p>
                    )}
                  </div>
                )}

                {q.type === "fillup" && (
                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-500 block">Acceptable Answers <span className="text-red-500">*</span></label>
                    <p className="text-xs text-gray-400 mb-1">Add all acceptable answers (case-insensitive match).</p>
                    {(() => {
                      const answers = (q.correct_answer || "").split("|");
                      const display = answers.length === 1 && answers[0] === "" ? [""] : [...answers, ""];
                      return display.slice(0, 10).map((ans, ai) => (
                        <div key={ai} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-4 shrink-0">{ai + 1}.</span>
                          <input
                            value={ans}
                            onChange={(e) => {
                              const newAnswers = [...answers];
                              while (newAnswers.length <= ai) newAnswers.push("");
                              newAnswers[ai] = e.target.value;
                              updateQuestion(idx, "correct_answer", newAnswers.filter(Boolean).join("|"));
                            }}
                            placeholder={ai === 0 ? "Primary answer (required)" : `Alternative answer ${ai + 1}`}
                            className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                          />
                          {ai > 0 && ans && (
                            <button
                              type="button"
                              onClick={() => {
                                const newAnswers = answers.filter((_, i) => i !== ai);
                                updateQuestion(idx, "correct_answer", newAnswers.filter(Boolean).join("|"));
                              }}
                              className="p-1 text-red-400 hover:text-red-600"
                            ><X className="w-3 h-3" /></button>
                          )}
                        </div>
                      ));
                    })()}
                    {!(q.correct_answer || "").split("|").filter(Boolean).length && (
                      <p className="text-xs text-red-500 mt-1">⚠ Please enter at least one answer</p>
                    )}
                  </div>
                )}

                {q.type === "true_false" ? (
                  <div>
                    <label className="text-xs text-gray-500 mb-2 block">Correct Answer <span className="text-red-500">*</span></label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => updateQuestion(idx, "correct_answer", "True")}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all ${q.correct_answer === "True" ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20" : "border-gray-200 dark:border-zinc-700 text-gray-500 hover:border-green-300"}`}
                      >
                        True
                      </button>
                      <button
                        type="button"
                        onClick={() => updateQuestion(idx, "correct_answer", "False")}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all ${q.correct_answer === "False" ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20" : "border-gray-200 dark:border-zinc-700 text-gray-500 hover:border-red-300"}`}
                      >
                        False
                      </button>
                    </div>
                    {!q.correct_answer && (
                      <p className="text-xs text-red-500 mt-1">⚠ Please select True or False</p>
                    )}
                  </div>
                ) : q.type !== "mcq" && q.type !== "fillup" ? (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Answer / Key Points</label>
                    <textarea
                      value={q.correct_answer}
                      onChange={(e) => updateQuestion(idx, "correct_answer", e.target.value)}
                      placeholder="Enter the answer or key points"
                      rows={2}
                      className="w-full px-2 py-1.5 border border-gray-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 text-gray-900 dark:text-white resize-none"
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-zinc-800">
          {isTeacher && !isAnswerDraftMode && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              Your changes will be submitted for admin/head approval.
            </p>
          )}
          {isAnswerDraftMode && (
            <p className="text-xs text-indigo-600 dark:text-indigo-300 mb-3 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              You can send one question at a time or submit all answered questions together.
            </p>
          )}
          <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || savingDraft}
            className="flex items-center gap-2 px-5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {loading ? "Saving..." : isAnswerDraftMode ? "Save Draft" : isTeacher ? "Submit for Approval" : "Save Changes"}
          </button>
          {isAnswerDraftMode && (
            <button
              onClick={handleSendAll}
              disabled={loading || savingDraft}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {loading ? "Submitting..." : "Send All To Pending"}
            </button>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
