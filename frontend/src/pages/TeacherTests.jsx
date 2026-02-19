
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import {
    ClipboardList, Plus, Search, Edit, Trash2, Calendar, CheckCircle,
    Clock, Eye, AlertTriangle, Save, X, User
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function TeacherTests() {
    const navigate = useNavigate();
    const { getAuthHeader, isAdmin } = useUserStore();
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const showAITestTabs = isAdmin();

    const [teacherSubjects, setTeacherSubjects] = useState([]);
    const [loadingSubjects, setLoadingSubjects] = useState(true);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [selectedStatus, setSelectedStatus] = useState("");

    const [activeTab, setActiveTab] = useState("tests");

    const [pendingSessions, setPendingSessions] = useState([]);
    const [loadingPending, setLoadingPending] = useState(false);

    const [completedSessions, setCompletedSessions] = useState([]);
    const [loadingCompleted, setLoadingCompleted] = useState(false);

    const [evaluatingSession, setEvaluatingSession] = useState(null);
    const [evaluationDetail, setEvaluationDetail] = useState(null);
    const [loadingEvalDetail, setLoadingEvalDetail] = useState(false);
    const [manualGrades, setManualGrades] = useState({});
    const [submittingGrades, setSubmittingGrades] = useState(false);

    useEffect(() => {
        fetchTeacherGroups();
        fetchTests();
    }, []);

    useEffect(() => {
        
        if (showAITestTabs) {
            if (activeTab === "evaluations") fetchPendingEvaluations();
            if (activeTab === "completed") fetchCompletedSessions();
        }
    }, [activeTab, showAITestTabs]);

    const fetchTeacherGroups = async () => {
        try {
            setLoadingSubjects(true);
            const response = await fetch(`${API_URL}/api/teacher/groups`, { headers: getAuthHeader() });
            if (response.ok) {
                const data = await response.json();
                const groups = data.groups || [];
                const subjects = [...new Set(groups.map(g => g.subject).filter(Boolean))];
                setTeacherSubjects(subjects.sort());
            }
        } catch (err) {
            console.error("Failed to fetch teacher groups:", err);
        } finally {
            setLoadingSubjects(false);
        }
    };

    const fetchTests = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/api/assessments`, { headers: getAuthHeader() });
            if (response.ok) {
                const data = await response.json();
                setTests(data.assessments || []);
            } else {
                setTests([]);
            }
        } catch (err) {
            console.error("Error fetching tests:", err);
            setTests([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingEvaluations = async () => {
        try {
            setLoadingPending(true);
            const response = await fetch(`${API_URL}/api/teacher/pending-evaluations`, { headers: getAuthHeader() });
            if (response.ok) {
                const data = await response.json();
                setPendingSessions(data.pending_sessions || []);
            }
        } catch (err) {
            console.error("Error fetching pending evaluations:", err);
        } finally {
            setLoadingPending(false);
        }
    };

    const fetchCompletedSessions = async () => {
        try {
            setLoadingCompleted(true);
            const response = await fetch(`${API_URL}/api/teacher/completed-tests`, { headers: getAuthHeader() });
            if (response.ok) {
                const data = await response.json();
                setCompletedSessions(data.sessions || []);
            }
        } catch (err) {
            console.error("Error fetching completed sessions:", err);
        } finally {
            setLoadingCompleted(false);
        }
    };

    const openEvaluation = async (session) => {
        setEvaluatingSession(session);
        setLoadingEvalDetail(true);
        try {
            const response = await fetch(
                `${API_URL}/api/teacher/evaluation/${session.session_id}`,
                { headers: getAuthHeader() }
            );
            if (response.ok) {
                const data = await response.json();
                setEvaluationDetail(data);
                
                const grades = {};
                (data.evaluations || []).forEach(e => {
                    if (e.evaluation_status === "pending") {
                        grades[e.question_id] = { score: 0, max_score: e.max_score || 10, feedback: "" };
                    }
                });
                setManualGrades(grades);
            }
        } catch (err) {
            console.error("Error loading evaluation:", err);
        } finally {
            setLoadingEvalDetail(false);
        }
    };

    const submitManualGrades = async () => {
        if (!evaluationDetail) return;
        setSubmittingGrades(true);
        try {
            const grades = Object.entries(manualGrades).map(([question_id, g]) => ({
                question_id,
                score: parseFloat(g.score) || 0,
                max_score: g.max_score || 10,
                feedback: g.feedback || ""
            }));

            const response = await fetch(`${API_URL}/api/teacher/evaluate`, {
                method: "POST",
                headers: { ...getAuthHeader(), "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: evaluationDetail.session_id,
                    grades
                })
            });

            if (response.ok) {
                const data = await response.json();
                alert(`Evaluation submitted! New score: ${data.new_score}%`);
                setEvaluatingSession(null);
                setEvaluationDetail(null);
                if (activeTab === "evaluations") fetchPendingEvaluations();
                if (activeTab === "completed") fetchCompletedSessions();
            } else {
                const err = await response.json();
                alert(`Error: ${err.detail || "Failed to submit evaluation"}`);
            }
        } catch (err) {
            alert("Error submitting evaluation: " + err.message);
        } finally {
            setSubmittingGrades(false);
        }
    };

    const handleDelete = async (test) => {
        if (!window.confirm(`Delete "${test.title}"?`)) return;
        const previousTests = [...tests];
        setTests(tests.filter(t => t.id !== test.id));
        try {
            const response = await fetch(`${API_URL}/api/assessments/${test.id}`, {
                method: 'DELETE', headers: getAuthHeader()
            });
            if (!response.ok) throw new Error('Failed');
        } catch (err) {
            setTests(previousTests);
            alert("Failed to delete test.");
        }
    };

    const filteredTests = tests.filter(t => {
        const matchesSearch = t.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.subject?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSubject = !selectedSubject || t.subject === selectedSubject;
        const matchesStatus = !selectedStatus || t.status === selectedStatus.toLowerCase();
        return matchesSearch && matchesSubject && matchesStatus;
    });

    return (
        <AdminLayout title="Tests Management" icon={ClipboardList}>
            {}
            <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
                {[
                    { key: "tests", label: "My Tests", icon: ClipboardList, show: true },
                    { key: "evaluations", label: "Pending Evaluation", icon: Clock, count: pendingSessions.length, show: showAITestTabs },
                    { key: "completed", label: "Completed AI Tests", icon: CheckCircle, show: showAITestTabs }
                ].filter(tab => tab.show).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition ${
                            activeTab === tab.key
                                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                        {tab.count > 0 && (
                            <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{tab.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* My Tests Tab */}
            {activeTab === "tests" && (
                <>
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-6">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search tests..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400"
                            />
                        </div>
                        <div className="flex gap-2">
                            <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}
                                className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm">
                                <option value="">All Subjects</option>
                                {teacherSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}
                                className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm">
                                <option value="">All Status</option>
                                <option value="Published">Published</option>
                                <option value="Draft">Draft</option>
                            </select>
                            <button onClick={() => navigate("/create-test")}
                                className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition flex items-center gap-2 font-medium">
                                <Plus className="w-4 h-4" /> Create Test
                            </button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {loading ? (
                            <div className="p-12 text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gray-900 dark:border-white mx-auto"></div>
                            </div>
                        ) : filteredTests.length === 0 ? (
                            <div className="p-16 text-center">
                                <ClipboardList className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Tests Found</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-6">Get started by creating your first test</p>
                                <button onClick={() => navigate("/create-test")}
                                    className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition inline-flex items-center gap-2 font-medium">
                                    <Plus className="w-4 h-4" /> Create Test
                                </button>
                            </div>
                        ) : (
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300">
                                    <tr>
                                        <th className="px-6 py-4 font-medium text-sm">Title</th>
                                        <th className="px-6 py-4 font-medium text-sm">Subject</th>
                                        <th className="px-6 py-4 font-medium text-sm">Questions</th>
                                        <th className="px-6 py-4 font-medium text-sm">Status</th>
                                        <th className="px-6 py-4 font-medium text-sm">Date</th>
                                        <th className="px-6 py-4 font-medium text-sm text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {filteredTests.map((test) => (
                                        <tr key={test.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <p className="text-gray-900 dark:text-white font-medium">{test.title}</p>
                                                {test.class_level && <p className="text-xs text-gray-500">Class {test.class_level}</p>}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{test.subject}</td>
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{test.questions?.length || test.questions_count || 0}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${test.status === 'published'
                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'}`}>
                                                    {test.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                                                <div className="flex items-center gap-1.5 text-sm">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    {test.created_at ? new Date(test.created_at).toLocaleDateString() : '-'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => navigate(`/create-test/${test.id}`)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg"
                                                        title="Edit Test"><Edit className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDelete(test)}
                                                        className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg"
                                                        title="Delete Test"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            )}

            {/* Pending Evaluations Tab */}
            {activeTab === "evaluations" && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {loadingPending ? (
                        <div className="p-12 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gray-900 dark:border-white mx-auto"></div>
                        </div>
                    ) : pendingSessions.length === 0 ? (
                        <div className="p-16 text-center">
                            <CheckCircle className="w-16 h-16 text-green-300 dark:text-green-600 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">All Caught Up!</h3>
                            <p className="text-gray-500 dark:text-gray-400">No pending evaluations. All subjective questions have been reviewed.</p>
                        </div>
                    ) : (
                        <div>
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                                    {pendingSessions.length} Test(s) Pending Manual Evaluation
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    MCQ and Fill-up have been auto-evaluated. Short answer and long answer questions need your review.
                                </p>
                            </div>
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300">
                                    <tr>
                                        <th className="px-6 py-3 font-medium text-sm">Student</th>
                                        <th className="px-6 py-3 font-medium text-sm">Subject</th>
                                        <th className="px-6 py-3 font-medium text-sm">Chapter</th>
                                        <th className="px-6 py-3 font-medium text-sm">Questions</th>
                                        <th className="px-6 py-3 font-medium text-sm">Auto Score</th>
                                        <th className="px-6 py-3 font-medium text-sm">Completed</th>
                                        <th className="px-6 py-3 font-medium text-sm text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {pendingSessions.map(s => (
                                        <tr key={s.session_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <User className="w-4 h-4 text-gray-400" />
                                                    <span className="text-gray-900 dark:text-white font-medium">{s.student_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{s.subject}</td>
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-400">Ch. {s.chapter_number}</td>
                                            <td className="px-6 py-4">
                                                <span className="text-green-600 dark:text-green-400 text-sm">{s.auto_evaluated} auto</span>
                                                <span className="mx-1 text-gray-300">/</span>
                                                <span className="text-amber-600 dark:text-amber-400 text-sm">{s.pending_evaluation} pending</span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{s.auto_score}%</td>
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-sm">
                                                {s.completed_at ? new Date(s.completed_at).toLocaleString() : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => openEvaluation(s)}
                                                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 ml-auto">
                                                    <Edit className="w-4 h-4" /> Evaluate
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Completed Tests Tab */}
            {activeTab === "completed" && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {loadingCompleted ? (
                        <div className="p-12 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gray-900 dark:border-white mx-auto"></div>
                        </div>
                    ) : completedSessions.length === 0 ? (
                        <div className="p-16 text-center">
                            <ClipboardList className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Completed Tests</h3>
                            <p className="text-gray-500 dark:text-gray-400">Students haven't completed any tests yet.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300">
                                <tr>
                                    <th className="px-6 py-3 font-medium text-sm">Student</th>
                                    <th className="px-6 py-3 font-medium text-sm">Subject</th>
                                    <th className="px-6 py-3 font-medium text-sm">Chapter</th>
                                    <th className="px-6 py-3 font-medium text-sm">Score</th>
                                    <th className="px-6 py-3 font-medium text-sm">Questions</th>
                                    <th className="px-6 py-3 font-medium text-sm">Status</th>
                                    <th className="px-6 py-3 font-medium text-sm">Date</th>
                                    <th className="px-6 py-3 font-medium text-sm text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {completedSessions.map(s => (
                                    <tr key={s.session_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                        <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">{s.student_name}</td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{s.subject}</td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">Ch. {s.chapter_number}</td>
                                        <td className="px-6 py-4">
                                            <span className={`font-semibold ${s.score >= 70 ? 'text-green-600' : s.score >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                                                {s.score}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                                            {s.correct_count}/{s.total_questions}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                                s.evaluation_status === 'completed'
                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                            }`}>
                                                {s.evaluation_status === 'completed' ? 'Fully Evaluated' : 'Pending Review'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-sm">
                                            {s.completed_at ? new Date(s.completed_at).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={() => openEvaluation(s)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg"
                                                title="View / Evaluate">
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Evaluation Modal */}
            {evaluatingSession && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700 shadow-2xl">
                        {/* Header */}
                        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center z-10">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                    Evaluate Test - {evaluatingSession.student_name}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {evaluatingSession.subject} Ch. {evaluatingSession.chapter_number}
                                </p>
                            </div>
                            <button onClick={() => { setEvaluatingSession(null); setEvaluationDetail(null); }}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><X className="w-5 h-5" /></button>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            {loadingEvalDetail ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gray-900 dark:border-white"></div>
                                </div>
                            ) : evaluationDetail ? (
                                <div className="space-y-6">
                                    {/* Summary */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                                            <p className="text-sm text-blue-600 dark:text-blue-400">Current Score</p>
                                            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{evaluationDetail.score}%</p>
                                        </div>
                                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                                            <p className="text-sm text-green-600 dark:text-green-400">Auto Evaluated</p>
                                            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                                                {evaluationDetail.evaluations?.filter(e => e.evaluation_status === 'auto_evaluated').length || 0}
                                            </p>
                                        </div>
                                        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
                                            <p className="text-sm text-amber-600 dark:text-amber-400">Pending Review</p>
                                            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                                                {evaluationDetail.evaluations?.filter(e => e.evaluation_status === 'pending').length || 0}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Questions */}
                                    <div className="space-y-4">
                                        {(evaluationDetail.evaluations || []).map((e, idx) => (
                                            <div key={e.question_id || idx}
                                                className={`p-4 rounded-lg border ${
                                                    e.evaluation_status === 'pending'
                                                        ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10'
                                                        : e.is_correct
                                                            ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
                                                            : 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
                                                }`}>
                                                <div className="flex items-start justify-between mb-2">
                                                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                        Q{idx + 1} {e.topic && `· ${e.topic}`}
                                                    </span>
                                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                                        e.evaluation_status === 'pending'
                                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                                            : e.evaluation_status === 'auto_evaluated'
                                                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                                : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                                    }`}>
                                                        {e.evaluation_status === 'pending' ? 'Pending' :
                                                            e.evaluation_status === 'auto_evaluated' ? `Auto: ${e.score}/${e.max_score}` :
                                                            `Manual: ${e.score}/${e.max_score}`}
                                                    </span>
                                                </div>

                                                <p className="text-gray-900 dark:text-white font-medium mb-2">{e.question_text}</p>

                                                <div className="mb-2">
                                                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Student's Answer:</span>
                                                    <p className="text-gray-800 dark:text-gray-200 bg-white/50 dark:bg-gray-900/50 p-2 rounded mt-1 text-sm">
                                                        {e.student_answer || <em className="text-gray-400">No answer provided</em>}
                                                    </p>
                                                </div>

                                                {e.correct_answer && (
                                                    <div className="mb-2">
                                                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Expected Answer:</span>
                                                        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{e.correct_answer}</p>
                                                    </div>
                                                )}

                                                {e.evaluation_status !== 'pending' && e.feedback && (
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 italic mt-1">{e.feedback}</p>
                                                )}

                                                {/* Manual grade inputs for pending questions */}
                                                {e.evaluation_status === 'pending' && manualGrades[e.question_id] && (
                                                    <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800 space-y-2">
                                                        <div className="flex items-center gap-4">
                                                            <div>
                                                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Score</label>
                                                                <div className="flex items-center gap-1 mt-1">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        max={manualGrades[e.question_id].max_score}
                                                                        step="0.5"
                                                                        value={manualGrades[e.question_id].score}
                                                                        onChange={ev => setManualGrades(prev => ({
                                                                            ...prev,
                                                                            [e.question_id]: { ...prev[e.question_id], score: ev.target.value }
                                                                        }))}
                                                                        className="w-20 p-1.5 text-center bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-sm"
                                                                    />
                                                                    <span className="text-sm text-gray-500">/ {manualGrades[e.question_id].max_score}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex-1">
                                                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Feedback</label>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Optional feedback for student..."
                                                                    value={manualGrades[e.question_id].feedback}
                                                                    onChange={ev => setManualGrades(prev => ({
                                                                        ...prev,
                                                                        [e.question_id]: { ...prev[e.question_id], feedback: ev.target.value }
                                                                    }))}
                                                                    className="w-full mt-1 p-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-sm"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Submit Button */}
                                    {Object.keys(manualGrades).length > 0 && (
                                        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                                            <button onClick={submitManualGrades} disabled={submittingGrades}
                                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50">
                                                {submittingGrades ? (
                                                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                                                ) : (
                                                    <Save className="w-4 h-4" />
                                                )}
                                                Submit Evaluation
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-center text-gray-500 py-8">Failed to load evaluation details.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
