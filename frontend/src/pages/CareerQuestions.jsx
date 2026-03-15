import React, { useState, useEffect, useCallback } from "react";
import AdminLayout from "../components/AdminLayout";
import {
  Compass, Plus, Trash2, Edit3, Search, ChevronLeft, ChevronRight,
  BarChart3, AlertCircle, Check, X, Loader2, Filter, Brain,
  ClipboardList, Power, PowerOff
} from "lucide-react";
import useUserStore from "../stores/userStore";
import authFetch from "../utils/authFetch";

import { useToast } from "../contexts/ToastContext";
const API_URL = import.meta.env.VITE_API_URL;

const ALL_DOMAINS = [
  { code: "QA", label: "Quantitative Aptitude" },
  { code: "SCI", label: "Scientific Reasoning" },
  { code: "LOG", label: "Logical Thinking" },
  { code: "COMP", label: "Computational Thinking" },
  { code: "BIO", label: "Biological Orientation" },
  { code: "VERB", label: "Communication" },
  { code: "CREA", label: "Creativity" },
  { code: "SOC", label: "Social Understanding" },
];

const SUBJECTS = [
  "Math", "Physics", "Biology", "Programming", "Logic",
  "English", "Art & Design", "Social Studies", "General Knowledge",
];

export default function CareerQuestions() {
  const { toast } = useToast();
  const { accessToken } = useUserStore();
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };

  // ── State ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("questions"); // "questions" | "assignments"
  const [questions, setQuestions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  // Filters
  const [filterSubject, setFilterSubject] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [form, setForm] = useState({
    subject: "",
    question_text: "",
    options: ["", "", "", ""],
    correct_answer: 0,
    difficulty: 1,
    domain_weights: {},
  });

  // Assignment state
  const [assignments, setAssignments] = useState([]);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [assignmentTitle, setAssignmentTitle] = useState("Career Analysis Test");
  const [assignmentDesc, setAssignmentDesc] = useState("");
  const [assignmentError, setAssignmentError] = useState("");
  const [creatingAssignment, setCreatingAssignment] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────
  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (filterSubject) params.set("subject", filterSubject);
      if (filterDifficulty) params.set("difficulty", filterDifficulty);

      const res = await authFetch(`${API_URL}/api/career/questions?${params}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to load");

      setQuestions(data.questions || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, filterSubject, filterDifficulty, accessToken]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/career/questions/stats`, { headers });
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch (e) {
      console.error(e);
    }
  }, [accessToken]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ── Assignment fetch & handlers ────────────────────────────────────────
  const fetchAssignments = useCallback(async () => {
    setLoadingAssignments(true);
    try {
      const [listRes, activeRes] = await Promise.all([
        authFetch(`${API_URL}/api/career/assignments`),
        authFetch(`${API_URL}/api/career/assignment/active`),
      ]);
      const listData = await listRes.json();
      const activeData = await activeRes.json();
      if (listRes.ok) setAssignments(listData.assignments || []);
      if (activeRes.ok) setActiveAssignment(activeData.active ? activeData.assignment : null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAssignments(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (activeTab === "assignments") fetchAssignments();
  }, [activeTab, fetchAssignments]);

  const handleCreateAssignment = async () => {
    setAssignmentError("");
    if (!assignmentTitle.trim()) return setAssignmentError("Title is required");
    setCreatingAssignment(true);
    try {
      const res = await authFetch(`${API_URL}/api/career/assignment`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title: assignmentTitle.trim(), description: assignmentDesc.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create assignment");
      setAssignmentTitle("Career Analysis Test");
      setAssignmentDesc("");
      fetchAssignments();
    } catch (e) {
      setAssignmentError(e.message);
    } finally {
      setCreatingAssignment(false);
    }
  };

  const handleDeactivateAssignment = async (id) => {
    if (!confirm("Deactivate this assignment? Students will no longer be able to start the career test.")) return;
    try {
      const res = await authFetch(`${API_URL}/api/career/assignment/${id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error("Failed to deactivate");
      fetchAssignments();
    } catch (e) {
      toast.info(e.message)
    }
  };

  // ── Handlers ───────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingQuestion(null);
    setForm({
      subject: "",
      question_text: "",
      options: ["", "", "", ""],
      correct_answer: 0,
      difficulty: 1,
      domain_weights: {},
    });
    setError("");
    setShowModal(true);
  };

  const openEdit = (q) => {
    setEditingQuestion(q);
    setForm({
      subject: q.subject,
      question_text: q.question_text,
      options: [...q.options],
      correct_answer: q.correct_answer,
      difficulty: q.difficulty,
      domain_weights: { ...q.domain_weights },
    });
    setError("");
    setShowModal(true);
  };

  const handleDomainWeight = (code, value) => {
    const numVal = parseFloat(value);
    setForm((prev) => {
      const next = { ...prev.domain_weights };
      if (!value || isNaN(numVal) || numVal <= 0) {
        delete next[code];
      } else {
        next[code] = Math.min(1, numVal);
      }
      return { ...prev, domain_weights: next };
    });
  };

  const handleSave = async () => {
    setError("");
    // Validate
    if (!form.subject) return setError("Subject is required");
    if (!form.question_text || form.question_text.length < 10) return setError("Question must be at least 10 characters");
    if (form.options.some((o) => !o.trim())) return setError("All 4 options must be filled");
    if (Object.keys(form.domain_weights).length === 0) return setError("At least one domain weight is required");

    const wsum = Object.values(form.domain_weights).reduce((a, b) => a + b, 0);
    if (wsum < 0.95 || wsum > 1.05) return setError(`Domain weights must sum to ~1.0 (current: ${wsum.toFixed(2)})`);

    setSaving(true);
    try {
      const url = editingQuestion
        ? `${API_URL}/api/career/questions/${editingQuestion.id}`
        : `${API_URL}/api/career/questions`;

      const res = await authFetch(url, {
        method: editingQuestion ? "PUT" : "POST",
        headers,
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = Array.isArray(data.detail)
          ? data.detail.map((d) => d.msg || JSON.stringify(d)).join("; ")
          : data.detail || "Save failed";
        throw new Error(msg);
      }
      setShowModal(false);
      fetchQuestions();
      fetchStats();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this question permanently?")) return;
    try {
      const res = await authFetch(`${API_URL}/api/career/questions/${id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error("Delete failed");
      fetchQuestions();
      fetchStats();
    } catch (e) {
      toast.info(e.message)
    }
  };

  const diffLabel = (d) => ({ 1: "Easy", 2: "Medium", 3: "Hard" }[d] || d);
  const diffColor = (d) => ({
    1: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    2: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    3: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  }[d] || "");

  const filtered = searchQuery
    ? questions.filter((q) =>
        q.question_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.subject.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : questions;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <AdminLayout title="Career Analysis" icon={Compass}>
      {/* Tab switcher */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("questions")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "questions"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          <Brain className="w-4 h-4" /> Questions
        </button>
        <button
          onClick={() => setActiveTab("assignments")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "assignments"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          <ClipboardList className="w-4 h-4" /> Assignments
          {activeAssignment && (
            <span className="ml-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded text-xs font-semibold">Active</span>
          )}
        </button>
      </div>

      {/* ── Assignments tab ───────────────────────────────────────────── */}
      {activeTab === "assignments" && (
        <div className="space-y-6">
          {/* Current status banner */}
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${
            activeAssignment
              ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
              : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
          }`}>
            {activeAssignment ? (
              <Power className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            ) : (
              <PowerOff className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            )}
            <div>
              <p className={`text-sm font-semibold ${activeAssignment ? "text-emerald-800 dark:text-emerald-300" : "text-amber-800 dark:text-amber-300"}`}>
                {activeAssignment ? `Test is OPEN: "${activeAssignment.title}"` : "Test is CLOSED — no active assignment"}
              </p>
              <p className={`text-xs mt-0.5 ${activeAssignment ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                {activeAssignment
                  ? `Activated on ${new Date(activeAssignment.created_at).toLocaleString()}`
                  : "Students cannot start the career test until you create an assignment below."
                }
              </p>
            </div>
            {activeAssignment && (
              <button
                onClick={() => handleDeactivateAssignment(activeAssignment.id)}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded-lg text-xs font-medium transition-colors"
              >
                <PowerOff className="w-3.5 h-3.5" /> Deactivate
              </button>
            )}
          </div>

          {/* Create new assignment */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Create New Assignment
            </h3>
            {assignmentError && (
              <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {assignmentError}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
                <input
                  type="text"
                  value={assignmentTitle}
                  onChange={(e) => setAssignmentTitle(e.target.value)}
                  placeholder="Career Analysis Test"
                  className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description (optional)</label>
                <textarea
                  value={assignmentDesc}
                  onChange={(e) => setAssignmentDesc(e.target.value)}
                  placeholder="Instructions or notes for students..."
                  rows={2}
                  className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                />
              </div>
              <button
                onClick={handleCreateAssignment}
                disabled={creatingAssignment}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {creatingAssignment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                {activeAssignment ? "Replace Active Assignment" : "Activate Career Test"}
              </button>
              {activeAssignment && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Creating a new assignment will automatically deactivate the current one.
                </p>
              )}
            </div>
          </div>

          {/* Assignment history */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Assignment History</h3>
            {loadingAssignments ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : assignments.length === 0 ? (
              <div className="text-center py-10 text-gray-400 dark:text-gray-500 text-sm">
                No assignments created yet.
              </div>
            ) : (
              <div className="space-y-2">
                {assignments.map((a) => (
                  <div
                    key={a.id}
                    className={`flex items-center justify-between p-4 rounded-xl border ${
                      a.is_active
                        ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800"
                        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{a.title}</p>
                        {a.is_active && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full text-xs font-semibold">Active</span>
                        )}
                      </div>
                      {a.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{a.description}</p>
                      )}
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Created: {new Date(a.created_at).toLocaleString()}
                        {a.deactivated_at && ` · Closed: ${new Date(a.deactivated_at).toLocaleString()}`}
                      </p>
                    </div>
                    {a.is_active && (
                      <button
                        onClick={() => handleDeactivateAssignment(a.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <PowerOff className="w-3.5 h-3.5" /> Deactivate
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Questions tab ─────────────────────────────────────────────── */}
      {activeTab === "questions" && (
        <>
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Questions</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.subjects?.length || 0}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Subjects Covered</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.avg_difficulty}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Avg Difficulty</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Question
        </button>

        <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 text-gray-900 dark:text-white"
            />
          </div>
          <select
            value={filterSubject}
            onChange={(e) => { setFilterSubject(e.target.value); setPage(1); }}
            className="px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
          >
            <option value="">All Subjects</option>
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filterDifficulty}
            onChange={(e) => { setFilterDifficulty(e.target.value); setPage(1); }}
            className="px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
          >
            <option value="">All Difficulty</option>
            <option value="1">Easy</option>
            <option value="2">Medium</option>
            <option value="3">Hard</option>
          </select>
        </div>
      </div>

      {/* Questions Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-500 dark:text-gray-400">
          <Brain className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No career questions yet</p>
          <p className="text-sm mt-1">Click "Add Question" to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((q, idx) => (
            <div
              key={q.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-xs font-medium">
                      {q.subject}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${diffColor(q.difficulty)}`}>
                      {diffLabel(q.difficulty)}
                    </span>
                    {Object.entries(q.domain_weights || {}).map(([d, w]) => (
                      <span key={d} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-300">
                        {d}: {(w * 100).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed">
                    {q.question_text}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {q.options.map((opt, oi) => (
                      <div
                        key={oi}
                        className={`text-xs px-3 py-1.5 rounded-lg border ${
                          oi === q.correct_answer
                            ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 font-semibold"
                            : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        {String.fromCharCode(65 + oi)}. {opt}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => openEdit(q)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit3 className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => handleDelete(q.id)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Page {page} of {pages} · {total} questions
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      </>
      )}

      {/* ── Create/Edit Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl border dark:border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingQuestion ? "Edit Question" : "New Career Question"}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Subject + Difficulty */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject *</label>
                  <select
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white"
                  >
                    <option value="">Select Subject</option>
                    {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Difficulty *</label>
                  <select
                    value={form.difficulty}
                    onChange={(e) => setForm({ ...form, difficulty: parseInt(e.target.value) })}
                    className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white"
                  >
                    <option value={1}>1 – Easy</option>
                    <option value={2}>2 – Medium</option>
                    <option value={3}>3 – Hard</option>
                  </select>
                </div>
              </div>

              {/* Question text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Question Text *</label>
                <textarea
                  value={form.question_text}
                  onChange={(e) => setForm({ ...form, question_text: e.target.value })}
                  rows={3}
                  placeholder="Enter the MCQ question text..."
                  className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white"
                />
              </div>

              {/* Options */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Options * (click radio to mark correct)</label>
                <div className="space-y-2">
                  {form.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correct"
                        checked={form.correct_answer === i}
                        onChange={() => setForm({ ...form, correct_answer: i })}
                        className="w-4 h-4 text-emerald-600 accent-emerald-600"
                      />
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-6">
                        {String.fromCharCode(65 + i)}.
                      </span>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const next = [...form.options];
                          next[i] = e.target.value;
                          setForm({ ...form, options: next });
                        }}
                        placeholder={`Option ${String.fromCharCode(65 + i)}`}
                        className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Domain Weights */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Domain Weights * <span className="font-normal text-gray-400">(must sum to 1.0)</span>
                </label>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                  Enter weight (0.0 - 1.0) for each relevant domain. Leave blank for irrelevant domains.
                  Current sum: <span className={`font-semibold ${
                    Math.abs(Object.values(form.domain_weights).reduce((a, b) => a + b, 0) - 1) <= 0.05
                      ? "text-emerald-600" : "text-red-500"
                  }`}>
                    {Object.values(form.domain_weights).reduce((a, b) => a + b, 0).toFixed(2)}
                  </span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ALL_DOMAINS.map((d) => (
                    <div key={d.code} className="flex flex-col">
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">{d.code}</label>
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        value={form.domain_weights[d.code] ?? ""}
                        onChange={(e) => handleDomainWeight(d.code, e.target.value)}
                        placeholder="0.0"
                        className="px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white text-center"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3 sticky bottom-0 bg-white dark:bg-gray-800">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? "Saving..." : editingQuestion ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
