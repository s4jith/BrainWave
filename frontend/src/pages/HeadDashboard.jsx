
import React, { useState, useEffect, useCallback } from "react";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import LoadingSpinner from "../components/LoadingSpinner";
import {
    CheckCircle, XCircle, Clock, FileText, HelpCircle,
    ChevronDown, ChevronUp, Filter, RefreshCw, CheckSquare,
    BarChart3, Users, AlertCircle, BookOpen, GraduationCap
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function HeadDashboard() {
    const { getAuthHeader } = useUserStore();
    const [activeTab, setActiveTab] = useState("questions");
    const [questions, setQuestions] = useState([]);
    const [papers, setPapers] = useState([]);
    const [stats, setStats] = useState(null);
    const [assignment, setAssignment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState({});
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);
    const [expandedQuestion, setExpandedQuestion] = useState(null);
    const [expandedPaper, setExpandedPaper] = useState(null);
    const [selectedQuestions, setSelectedQuestions] = useState([]);
    const [filterSubject, setFilterSubject] = useState("");
    const [filterClass, setFilterClass] = useState("");

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/head/dashboard-stats`, {
                headers: getAuthHeader()
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            console.error("Error fetching stats:", err);
        }
    }, [getAuthHeader]);

    const fetchAssignment = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/head/my-assignment`, {
                headers: getAuthHeader()
            });
            if (res.ok) {
                const data = await res.json();
                setAssignment(data);
            }
        } catch (err) {
            console.error("Error fetching assignment:", err);
        }
    }, [getAuthHeader]);

    const fetchPendingQuestions = useCallback(async () => {
        try {
            let url = `${API_URL}/api/head/pending-questions?limit=100`;
            if (filterSubject) url += `&subject=${encodeURIComponent(filterSubject)}`;
            if (filterClass) url += `&class_level=${filterClass}`;
            const res = await fetch(url, { headers: getAuthHeader() });
            if (res.ok) {
                const data = await res.json();
                setQuestions(data.questions || []);
            }
        } catch (err) {
            console.error("Error fetching questions:", err);
        }
    }, [getAuthHeader, filterSubject, filterClass]);

    const fetchPendingPapers = useCallback(async () => {
        try {
            let url = `${API_URL}/api/head/pending-papers?limit=100`;
            if (filterSubject) url += `&subject=${encodeURIComponent(filterSubject)}`;
            if (filterClass) url += `&class_level=${filterClass}`;
            const res = await fetch(url, { headers: getAuthHeader() });
            if (res.ok) {
                const data = await res.json();
                setPapers(data.papers || []);
            }
        } catch (err) {
            console.error("Error fetching papers:", err);
        }
    }, [getAuthHeader, filterSubject, filterClass]);

    const loadAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        await Promise.all([fetchStats(), fetchAssignment(), fetchPendingQuestions(), fetchPendingPapers()]);
        setLoading(false);
    }, [fetchStats, fetchAssignment, fetchPendingQuestions, fetchPendingPapers]);

    useEffect(() => { loadAll(); }, [loadAll]);

    const showSuccess = (msg) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(null), 3000);
    };

    const handleApproveQuestion = async (id) => {
        setActionLoading(prev => ({ ...prev, [id]: "approve" }));
        try {
            const res = await fetch(`${API_URL}/api/head/approve-question/${id}`, {
                method: "POST",
                headers: getAuthHeader()
            });
            if (res.ok) {
                setQuestions(prev => prev.filter(q => q.id !== id));
                setSelectedQuestions(prev => prev.filter(qid => qid !== id));
                showSuccess("Question approved!");
                fetchStats();
            } else {
                const data = await res.json();
                setError(data.detail || "Failed to approve");
            }
        } catch (err) {
            setError("Network error");
        }
        setActionLoading(prev => ({ ...prev, [id]: null }));
    };

    const handleRejectQuestion = async (id) => {
        setActionLoading(prev => ({ ...prev, [id]: "reject" }));
        try {
            const res = await fetch(`${API_URL}/api/head/reject-question/${id}`, {
                method: "POST",
                headers: getAuthHeader()
            });
            if (res.ok) {
                setQuestions(prev => prev.filter(q => q.id !== id));
                setSelectedQuestions(prev => prev.filter(qid => qid !== id));
                showSuccess("Question rejected");
                fetchStats();
            } else {
                const data = await res.json();
                setError(data.detail || "Failed to reject");
            }
        } catch (err) {
            setError("Network error");
        }
        setActionLoading(prev => ({ ...prev, [id]: null }));
    };

    const handleBulkApprove = async () => {
        if (selectedQuestions.length === 0) return;
        setActionLoading(prev => ({ ...prev, bulk: true }));
        try {
            const res = await fetch(`${API_URL}/api/head/bulk-approve-questions`, {
                method: "POST",
                headers: { ...getAuthHeader(), "Content-Type": "application/json" },
                body: JSON.stringify(selectedQuestions)
            });
            if (res.ok) {
                const data = await res.json();
                setQuestions(prev => prev.filter(q => !selectedQuestions.includes(q.id)));
                setSelectedQuestions([]);
                showSuccess(`Approved ${data.approved_count} questions!`);
                fetchStats();
            }
        } catch (err) {
            setError("Network error");
        }
        setActionLoading(prev => ({ ...prev, bulk: null }));
    };

    const handleApprovePaper = async (id) => {
        setActionLoading(prev => ({ ...prev, [id]: "approve" }));
        try {
            const res = await fetch(`${API_URL}/api/head/approve-paper/${id}`, {
                method: "POST",
                headers: getAuthHeader()
            });
            if (res.ok) {
                setPapers(prev => prev.filter(p => p.id !== id));
                showSuccess("Paper approved!");
                fetchStats();
            } else {
                const data = await res.json();
                setError(data.detail || "Failed to approve");
            }
        } catch (err) {
            setError("Network error");
        }
        setActionLoading(prev => ({ ...prev, [id]: null }));
    };

    const handleRejectPaper = async (id) => {
        setActionLoading(prev => ({ ...prev, [id]: "reject" }));
        try {
            const res = await fetch(`${API_URL}/api/head/reject-paper/${id}`, {
                method: "POST",
                headers: getAuthHeader()
            });
            if (res.ok) {
                setPapers(prev => prev.filter(p => p.id !== id));
                showSuccess("Paper rejected");
                fetchStats();
            } else {
                const data = await res.json();
                setError(data.detail || "Failed to reject");
            }
        } catch (err) {
            setError("Network error");
        }
        setActionLoading(prev => ({ ...prev, [id]: null }));
    };

    const toggleSelectQuestion = (id) => {
        setSelectedQuestions(prev =>
            prev.includes(id) ? prev.filter(qid => qid !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedQuestions.length === questions.length) {
            setSelectedQuestions([]);
        } else {
            setSelectedQuestions(questions.map(q => q.id));
        }
    };

    const difficultyColors = {
        easy: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
        hard: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        advanced: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
    };

    const typeLabels = {
        mcq: "MCQ", fillup: "Fill Up", true_false: "True/False",
        short_answer: "Short Answer", long_answer: "Long Answer"
    };

    if (loading) {
        return (
            <AdminLayout title="Head Dashboard" icon={BarChart3}>
                <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="Head Dashboard" icon={BarChart3}>
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Success/Error Messages */}
                {successMsg && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        {successMsg}
                    </div>
                )}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        {error}
                        <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">×</button>
                    </div>
                )}

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pending_questions}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Pending Questions</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pending_papers}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Pending Papers</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.approved_today}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Approved Today</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_teachers}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Active Teachers</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Assignment Info */}
                {assignment && (
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4 flex items-center gap-3 flex-wrap">
                        {assignment.assignment_type === "subject" ? (
                            <>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                                    <BookOpen className="w-4 h-4" /> Assigned by Subject
                                </span>
                                {(assignment.assigned_subjects || []).map(s => (
                                    <span key={s} className="px-2.5 py-1 rounded-lg text-sm bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800">{s}</span>
                                ))}
                                {(!assignment.assigned_subjects || assignment.assigned_subjects.length === 0) && (
                                    <span className="text-sm text-gray-400">No subjects assigned yet</span>
                                )}
                            </>
                        ) : (
                            <>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                                    <GraduationCap className="w-4 h-4" /> Assigned by Class
                                </span>
                                {(assignment.assigned_classes || []).map(c => (
                                    <span key={c} className="px-2.5 py-1 rounded-lg text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800">Class {c}</span>
                                ))}
                                {(!assignment.assigned_classes || assignment.assigned_classes.length === 0) && (
                                    <span className="text-sm text-gray-400">No classes assigned yet</span>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Tab Switcher */}
                <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-1.5">
                    <button
                        onClick={() => setActiveTab("questions")}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            activeTab === "questions"
                                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        }`}
                    >
                        <HelpCircle className="w-4 h-4" />
                        Pending Questions ({questions.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("papers")}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            activeTab === "papers"
                                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        }`}
                    >
                        <FileText className="w-4 h-4" />
                        Pending Papers ({papers.length})
                    </button>
                </div>

                {/* Filters + Refresh */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Filter by subject..."
                            value={filterSubject}
                            onChange={e => setFilterSubject(e.target.value)}
                            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-zinc-600"
                        />
                        <input
                            type="number"
                            placeholder="Class"
                            value={filterClass}
                            onChange={e => setFilterClass(e.target.value)}
                            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white w-20 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-zinc-600"
                            min="1" max="12"
                        />
                    </div>
                    <button
                        onClick={loadAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" /> Refresh
                    </button>

                    {activeTab === "questions" && selectedQuestions.length > 0 && (
                        <button
                            onClick={handleBulkApprove}
                            disabled={actionLoading.bulk}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <CheckSquare className="w-4 h-4" />
                            Approve Selected ({selectedQuestions.length})
                        </button>
                    )}
                </div>

                {/* Questions Tab */}
                {activeTab === "questions" && (
                    <div className="space-y-3">
                        {questions.length === 0 ? (
                            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-12 text-center">
                                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                                <p className="text-gray-600 dark:text-gray-400 font-medium">No pending questions</p>
                                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">All questions have been reviewed</p>
                            </div>
                        ) : (
                            <>
                                {/* Select All */}
                                <div className="flex items-center gap-2 px-2">
                                    <input
                                        type="checkbox"
                                        checked={selectedQuestions.length === questions.length && questions.length > 0}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 rounded border-gray-300 dark:border-zinc-600"
                                    />
                                    <span className="text-sm text-gray-500 dark:text-gray-400">Select All</span>
                                </div>
                                {questions.map(q => (
                                    <div key={q.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
                                        <div className="p-4 flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedQuestions.includes(q.id)}
                                                onChange={() => toggleSelectQuestion(q.id)}
                                                className="w-4 h-4 mt-1 rounded border-gray-300 dark:border-zinc-600"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">{q.text}</p>
                                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                                                                {q.subject} — Class {q.class_level}
                                                            </span>
                                                            <span className={`text-xs px-2 py-0.5 rounded-full ${difficultyColors[q.difficulty] || "bg-gray-100 text-gray-600"}`}>
                                                                {q.difficulty}
                                                            </span>
                                                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400">
                                                                {typeLabels[q.type] || q.type}
                                                            </span>
                                                            <span className="text-xs text-gray-400">
                                                                {q.marks} mark{q.marks !== 1 ? "s" : ""}
                                                            </span>
                                                            {q.is_ai_generated && (
                                                                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">AI</span>
                                                            )}
                                                        </div>
                                                        {q.teacher_name && (
                                                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                                By: {q.teacher_name}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <button
                                                            onClick={() => handleApproveQuestion(q.id)}
                                                            disabled={!!actionLoading[q.id]}
                                                            className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors disabled:opacity-50"
                                                            title="Approve"
                                                        >
                                                            <CheckCircle className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleRejectQuestion(q.id)}
                                                            disabled={!!actionLoading[q.id]}
                                                            className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
                                                            title="Reject"
                                                        >
                                                            <XCircle className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setExpandedQuestion(expandedQuestion === q.id ? null : q.id)}
                                                            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                                                        >
                                                            {expandedQuestion === q.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Expanded Details */}
                                        {expandedQuestion === q.id && (
                                            <div className="px-4 pb-4 pt-0 ml-7 border-t border-gray-100 dark:border-zinc-800 mt-0 pt-3 space-y-2">
                                                {q.options && q.options.length > 0 && (
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Options:</p>
                                                        <ul className="space-y-1">
                                                            {q.options.map((opt, i) => (
                                                                <li key={i} className={`text-sm px-2 py-1 rounded ${opt === q.correct_answer ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-medium" : "text-gray-600 dark:text-gray-400"}`}>
                                                                    {String.fromCharCode(65 + i)}. {opt}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    <span className="font-medium text-gray-500">Answer:</span> {q.correct_answer}
                                                </p>
                                                {q.chapter && (
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        Chapter: {q.chapter} {q.topic ? `— ${q.topic}` : ""}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                )}

                {/* Papers Tab */}
                {activeTab === "papers" && (
                    <div className="space-y-3">
                        {papers.length === 0 ? (
                            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-12 text-center">
                                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                                <p className="text-gray-600 dark:text-gray-400 font-medium">No pending papers</p>
                                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">All papers have been reviewed</p>
                            </div>
                        ) : (
                            papers.map(p => (
                                <div key={p.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
                                    <div className="p-4 flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">{p.title}</p>
                                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                                                    {p.subject} — Class {p.class_level}
                                                </span>
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400">
                                                    {p.paper_type}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {p.question_count} questions
                                                </span>
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                                    {p.source}
                                                </span>
                                                {p.year && (
                                                    <span className="text-xs text-gray-400">Year: {p.year}</span>
                                                )}
                                            </div>
                                            {p.teacher_name && (
                                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                    By: {p.teacher_name}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => handleApprovePaper(p.id)}
                                                disabled={!!actionLoading[p.id]}
                                                className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors disabled:opacity-50"
                                                title="Approve"
                                            >
                                                <CheckCircle className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleRejectPaper(p.id)}
                                                disabled={!!actionLoading[p.id]}
                                                className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
                                                title="Reject"
                                            >
                                                <XCircle className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => setExpandedPaper(expandedPaper === p.id ? null : p.id)}
                                                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                                            >
                                                {expandedPaper === p.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
