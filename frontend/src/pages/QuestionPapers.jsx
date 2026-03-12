import { useState, useEffect, useCallback } from "react";
import AdminLayout from "../components/AdminLayout";
import QuestionImageRenderer from "../components/QuestionImageRenderer";
import QuestionImageUploadPanel from "../components/QuestionImageUploadPanel";
import useUserStore from "../stores/userStore";
import {
  FileText, Plus, Upload, Edit2, Trash2, Search, Filter,
  ChevronDown, ChevronUp, X, Loader2, CheckCircle, AlertCircle,
  BookOpen, Calendar, GraduationCap, ClipboardList, ArrowRight,
  Check, Ban, Save
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
  const [createMode, setCreateMode] = useState(null);
  const [expandedPaper, setExpandedPaper] = useState(null);
  const [expandedQuestions, setExpandedQuestions] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(null);
  const [metadata, setMetadata] = useState({ subjects: [], years: [] });
  const [addingToBank, setAddingToBank] = useState(null);
  const [editPaper, setEditPaper] = useState(null);

  const fetchPapers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.class_level) params.append("class_level", filters.class_level);
      if (filters.subject) params.append("subject", filters.subject);
      if (filters.paper_type) params.append("paper_type", filters.paper_type);
      if (filters.year) params.append("year", filters.year);
      if (filters.status) params.append("status", filters.status);

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
  }, [filters, getAuthHeader]);

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
            onClick={() => { setShowCreate(true); setCreateMode(null); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Paper
          </button>
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
                  onClick={() => handleExpand(paper.id)}
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

                    {paper.status === "approved" && !paper.delete_requested && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAddToBank(paper.id); }}
                        disabled={addingToBank === paper.id}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                        title="Add to Question Bank"
                      >
                        {addingToBank === paper.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(paper.id); }}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title={isTeacher ? "Edit (requires approval)" : "Edit"}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {!(isTeacher && paper.delete_requested) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(paper.id); }}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title={isTeacher ? "Request Delete" : "Delete"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {loadingDetail === paper.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    ) : expandedPaper === paper.id ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {expandedPaper === paper.id && (
                  <div className="border-t border-gray-100 dark:border-zinc-800 p-4">
                    {expandedQuestions.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No questions</p>
                    ) : (
                      <div className="space-y-3">
                        {(() => {
                          const sections = {};
                          expandedQuestions.forEach(q => {
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
                                              <span key={oi} className={`text-xs px-2 py-1 rounded ${isCorrect ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 font-medium" : "bg-white dark:bg-zinc-700 text-gray-600 dark:text-gray-300"}`}>
                                                {String.fromCharCode(65 + oi)}. {opt}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      )}
                                      {q.type === "fillup" && q.correct_answer && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                          <span className="text-xs text-gray-500">Answer(s):</span>
                                          {q.correct_answer.split("|").filter(Boolean).map((ans, ai) => (
                                            <span key={ai} className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-medium">{ans}</span>
                                          ))}
                                        </div>
                                      )}
                                      {q.type === "true_false" && q.correct_answer && (
                                        <p className="text-xs mt-1 text-gray-500">
                                          Answer: <span className={q.correct_answer.toLowerCase() === "true" ? "text-green-600 font-medium" : "text-red-600 font-medium"}>{q.correct_answer}</span>
                                        </p>
                                      )}
                                      {q.type !== "mcq" && q.type !== "true_false" && q.type !== "fillup" && q.correct_answer && (
                                        <p className="text-xs mt-1 text-gray-500">Answer: {q.correct_answer}</p>
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
            onClose={() => { setShowCreate(false); setCreateMode(null); }}
            onCreated={() => { setShowCreate(false); setCreateMode(null); fetchPapers(); }}
            createMode={createMode}
            setCreateMode={setCreateMode}
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


function CreatePaperModal({ metadata, onClose, onCreated, createMode, setCreateMode }) {
  const { getAuthHeader, user } = useUserStore();
  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [title, setTitle] = useState("");
  const [paperType, setPaperType] = useState("");
  const [customPaperType, setCustomPaperType] = useState("");
  const [classLevel, setClassLevel] = useState("");
  const [subject, setSubject] = useState("");
  const [year, setYear] = useState("");

  const [pdfFile, setPdfFile] = useState(null);

  const [questions, setQuestions] = useState([
    { text: "", type: "mcq", marks: 1, options: ["", "", "", ""], correct_answer: "", section: "Section A", image_ids: [], answer_image_ids: [] },
  ]);

  const [extractedQuestions, setExtractedQuestions] = useState(null);

  // Auto-select subject when teacher has only one assigned subject
  useEffect(() => {
    if (!isAdmin && metadata.subjects && metadata.subjects.length === 1 && !subject) {
      setSubject(metadata.subjects[0].subject);
    }
  }, [metadata.subjects, isAdmin]);

  // Auto-select subject when the selected class has only one matching subject
  useEffect(() => {
    if (!classLevel) return;
    const filtered = (metadata.subjects || []).filter(s => (s.class_levels || []).includes(Number(classLevel)));
    if (filtered.length === 1) setSubject(filtered[0].subject);
  }, [classLevel, metadata.subjects]);

  const effectivePaperType = paperType === "other" ? customPaperType.trim() : paperType;

  const isFormValid = title.trim() && effectivePaperType && subject && classLevel && year;
  const isPdfFormValid = isFormValid && pdfFile;
  const isManualFormValid = isFormValid && questions.some(q => q.text.trim());

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

  const handlePdfExtract = async () => {
    if (!pdfFile) return;
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("pdf_file", pdfFile);
      formData.append("title", title || pdfFile.name.replace(".pdf", ""));
      formData.append("paper_type", effectivePaperType);
      formData.append("class_level", classLevel);
      formData.append("subject", subject);
      formData.append("year", year);

      const res = await authFetch(`${API_URL}/api/question-papers/extract-pdf`, {
        method: "POST",
        headers: getAuthHeader(),
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setExtractedQuestions(data.questions || []);
        setSuccess(data.message || `Extracted ${data.question_count} questions from PDF`);
        onCreated();
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to extract questions");
      }
    } catch (err) {
      setError("Failed to extract questions from PDF");
    }
    setLoading(false);
  };

  const handleManualCreate = async () => {
    if (!title.trim()) { setError("Title is required"); return; }
    if (!subject.trim()) { setError("Subject is required"); return; }
    if (!classLevel) { setError("Class is required"); return; }
    if (!year) { setError("Year is required"); return; }
    if (!effectivePaperType) { setError("Paper type is required"); return; }

    const validQuestions = questions.filter(q => q.text.trim());
    if (validQuestions.length === 0) { setError("Add at least one question"); return; }

    // Validate answers for 1-mark objective questions
    for (let i = 0; i < validQuestions.length; i++) {
      const q = validQuestions[i];
      const qLabel = `Question ${i + 1}`;
      if (q.type === "mcq") {
        const correctAnswers = (q.correct_answer || "").split("|").filter(Boolean);
        if (correctAnswers.length === 0) { setError(`${qLabel}: Select at least one correct answer for MCQ`); return; }
      } else if (q.type === "fillup") {
        const answers = (q.correct_answer || "").split("|").filter(Boolean);
        if (answers.length === 0) { setError(`${qLabel}: Enter at least one correct answer for Fill-in-the-blank`); return; }
      } else if (q.type === "true_false") {
        if (!q.correct_answer || (q.correct_answer !== "True" && q.correct_answer !== "False")) {
          setError(`${qLabel}: Select True or False as the correct answer`); return;
        }
      }
    }

    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`${API_URL}/api/question-papers`, {
        method: "POST",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          paper_type: effectivePaperType,
          class_level: Number(classLevel),
          subject: subject,
          year: Number(year),
          questions: validQuestions,
        }),
      });

      if (res.ok) {
        onCreated();
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to create paper");
      }
    } catch (err) {
      setError("Failed to create paper");
    }
    setLoading(false);
  };

  if (!createMode) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Question Paper</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"><X className="w-5 h-5" /></button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setCreateMode("pdf")}
              className="flex flex-col items-center gap-3 p-6 border-2 border-gray-200 dark:border-zinc-700 rounded-xl hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/10 transition-all"
            >
              <div className="w-14 h-14 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <Upload className="w-7 h-7 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="text-center">
                <p className="font-medium text-gray-900 dark:text-white">Upload PDF</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">AI extracts questions automatically</p>
              </div>
            </button>

            <button
              onClick={() => setCreateMode("manual")}
              className="flex flex-col items-center gap-3 p-6 border-2 border-gray-200 dark:border-zinc-700 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Edit2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="font-medium text-gray-900 dark:text-white">Manual Entry</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enter questions manually</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <button onClick={() => setCreateMode(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">
              <ChevronDown className="w-4 h-4 rotate-90" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {createMode === "pdf" ? "Upload Question Paper PDF" : "Manual Question Entry"}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" /> {success}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Title <span className="text-red-500">*</span></label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Quarterly Exam 2024 - Maths"
                className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Paper Type <span className="text-red-500">*</span></label>
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
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Class <span className="text-red-500">*</span></label>
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
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Subject <span className="text-red-500">*</span></label>
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
                      <option key={s.subject} value={s.subject}>{s.subject}</option>
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
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Year <span className="text-red-500">*</span></label>
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

          {createMode === "pdf" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Question Paper PDF</label>
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${pdfFile ? "border-violet-300 bg-violet-50 dark:bg-violet-900/10" : "border-gray-200 dark:border-zinc-700 hover:border-gray-300"}`}
                >
                  {pdfFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="w-8 h-8 text-violet-500" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{pdfFile.name}</p>
                        <p className="text-xs text-gray-500">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button onClick={() => setPdfFile(null)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg ml-3">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <Upload className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">Click to upload or drag & drop</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">PDF only, max 20MB</p>
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => { if (e.target.files[0]) setPdfFile(e.target.files[0]); }}
                      />
                    </label>
                  )}
                </div>
              </div>

              {extractedQuestions && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <span className="font-medium text-amber-700 dark:text-amber-300 text-sm">
                      {extractedQuestions.length} questions extracted - Pending admin approval
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {createMode === "manual" && (
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
                    {questions.length > 1 && (
                      <button onClick={() => removeQuestion(idx)} className="p-1 text-gray-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <textarea
                    value={q.text}
                    onChange={(e) => updateQuestion(idx, "text", e.target.value)}
                    placeholder="Enter question text... Use the image panel below to embed images."
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
                            updateQuestion(idx, "marks", 1);
                          } else if (e.target.value === "fillup" || e.target.value === "true_false") {
                            updateQuestion(idx, "options", []);
                            updateQuestion(idx, "marks", 1);
                          } else if (e.target.value === "short_answer") {
                            updateQuestion(idx, "options", []);
                            updateQuestion(idx, "marks", 2);
                          } else {
                            updateQuestion(idx, "options", []);
                            updateQuestion(idx, "marks", 5);
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
          )}
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-zinc-800">
          {isTeacher && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              Your paper will be submitted for admin/head approval before it becomes active.
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            {createMode === "pdf" ? (
              <button
                onClick={handlePdfExtract}
                disabled={loading || !isPdfFormValid}
                className="flex items-center gap-2 px-5 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {loading ? "Extracting..." : "Extract & Save"}
              </button>
            ) : (
              <button
                onClick={handleManualCreate}
                disabled={loading || !isManualFormValid}
                className="flex items-center gap-2 px-5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {loading ? "Creating..." : isTeacher ? "Submit for Approval" : "Create Paper"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


function EditPaperModal({ paper, metadata, onClose, onSaved }) {
  const { getAuthHeader, user } = useUserStore();
  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  const handleSave = async () => {
    if (!title.trim()) { setError("Title is required"); return; }

    // Validate answers for 1-mark objective questions
    const validQuestions = questions.filter(q => q.text.trim());
    for (let i = 0; i < validQuestions.length; i++) {
      const q = validQuestions[i];
      const qLabel = `Question ${i + 1}`;
      if (q.type === "mcq") {
        const correctAnswers = (q.correct_answer || "").split("|").filter(Boolean);
        if (correctAnswers.length === 0) { setError(`${qLabel}: Select at least one correct answer for MCQ`); return; }
      } else if (q.type === "fillup") {
        const answers = (q.correct_answer || "").split("|").filter(Boolean);
        if (answers.length === 0) { setError(`${qLabel}: Enter at least one correct answer for Fill-in-the-blank`); return; }
      } else if (q.type === "true_false") {
        if (!q.correct_answer || (q.correct_answer !== "True" && q.correct_answer !== "False")) {
          setError(`${qLabel}: Select True or False as the correct answer`); return;
        }
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
                      <option key={s.subject} value={s.subject}>{s.subject}</option>
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
                  {questions.length > 1 && (
                    <button onClick={() => removeQuestion(idx)} className="p-1 text-gray-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
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
          {isTeacher && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              Your changes will be submitted for admin/head approval.
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
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {loading ? "Saving..." : isTeacher ? "Submit for Approval" : "Save Changes"}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
