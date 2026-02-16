
import React, { useState, useEffect } from "react";
import { Copy, Edit, Trash2, Plus, Filter, Search, RotateCcw } from "lucide-react";
import AdminLayout from "../components/AdminLayout";
import QuestionModal from "../components/QuestionModal";
import useUserStore from "../stores/userStore";
import { getCombinedClassSubjectOptions, parseCombinedValue, createCombinedValue, parseGroupName } from "../constants/academicConstants";

const QuestionBank = () => {
    const { user, accessToken } = useUserStore();
    const isTeacher = user.role === "teacher";
    const Layout = AdminLayout;

    const [activeTab, setActiveTab] = useState("bank"); // "bank" or "approvals"
    const [questions, setQuestions] = useState([]);
    const [subjects, setSubjects] = useState([]); // Dynamic subjects
    const [groups, setGroups] = useState([]); // User's groups
    const [curriculumSubjects, setCurriculumSubjects] = useState([]); // Curriculum subjects from API
    const [loadingGroups, setLoadingGroups] = useState(true); // Loading state for groups
    const [loadingCurriculum, setLoadingCurriculum] = useState(true); // Loading state for curriculum
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedQuestion, setSelectedQuestion] = useState(null);

    // Generate combined options from user's groups (for teachers) or curriculum subjects (for admin)
    const combinedOptions = React.useMemo(() => {
        if (isTeacher && groups.length > 0) {
            // Use group names directly as options
            return groups.map(group => ({
                value: group.name,  // Use group name as value
                label: group.name,  // Display group name
                class: group.class_level,
                subject: group.subject
            })).sort((a, b) => {
                if (a.class !== b.class) return a.class - b.class;
                return a.subject.localeCompare(b.subject);
            });
        }
        // Admin sees curriculum subjects from database
        return curriculumSubjects.map(subj => ({
            value: `${subj.class_level}-${subj.subject_name}`,
            label: `Class ${subj.class_level} - ${subj.subject_name}`,
            class: subj.class_level,
            subject: subj.subject_name
        })).sort((a, b) => {
            if (a.class !== b.class) return a.class - b.class;
            return a.subject.localeCompare(b.subject);
        });
    }, [isTeacher, groups, curriculumSubjects]);

    // Filters
    const [filters, setFilters] = useState({
        groupName: "",  // Group name filter (for teachers) or class-subject (for admins)
        type: "",
        difficulty: "",
        search: ""
    });

    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        pages: 1
    });

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    useEffect(() => {
        fetchSubjects();
        fetchCurriculumSubjects();
        if (isTeacher) {
            fetchGroups();
        }
    }, []);

    useEffect(() => {
        fetchQuestions();
    }, [pagination.page, filters, activeTab]);

    const fetchGroups = async () => {
        setLoadingGroups(true);
        try {
            const response = await fetch(`${apiUrl}/api/teacher/groups`, {
                headers: { "Authorization": `Bearer ${accessToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                setGroups(data.groups || []);
            }
        } catch (error) {
            console.error("Error fetching groups:", error);
        } finally {
            setLoadingGroups(false);
        }
    };

    const fetchSubjects = async () => {
        try {
            const response = await fetch(`${apiUrl}/api/question-bank/subjects`, {
                headers: { "Authorization": `Bearer ${accessToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                setSubjects(data.subjects || []);
            }
        } catch (error) {
            console.error("Error fetching subjects:", error);
        }
    };

    const fetchCurriculumSubjects = async () => {
        setLoadingCurriculum(true);
        try {
            const response = await fetch(`${apiUrl}/api/curriculum/subjects`, {
                headers: { "Authorization": `Bearer ${accessToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                setCurriculumSubjects(data || []);
            }
        } catch (error) {
            console.error("Error fetching curriculum subjects:", error);
        } finally {
            setLoadingCurriculum(false);
        }
    };

    const fetchQuestions = async () => {
        setLoading(true);
        try {
            const status = activeTab === "approvals" ? "pending" : "approved";
            
            // Parse filter value
            let classLevel = null;
            let subject = null;
            
            if (filters.groupName) {
                if (isTeacher && groups.length > 0) {
                    // For teachers, groupName is the actual group name
                    const parsed = parseGroupName(filters.groupName);
                    classLevel = parsed.class;
                    subject = parsed.subject;
                } else {
                    // For admins, it's the combined value format
                    const parsed = parseCombinedValue(filters.groupName);
                    classLevel = parsed.class;
                    subject = parsed.subject;
                }
            }
            
            const queryParams = new URLSearchParams({
                limit: pagination.limit,
                offset: (pagination.page - 1) * pagination.limit,
                status: status
            });
            
            // Add individual filters
            if (classLevel) queryParams.append('class_level', classLevel);
            if (subject) queryParams.append('subject', subject);
            if (filters.type) queryParams.append('type', filters.type);
            if (filters.difficulty) queryParams.append('difficulty', filters.difficulty);
            if (filters.search) queryParams.append('search', filters.search);

            const response = await fetch(`${apiUrl}/api/question-bank/questions?${queryParams}`, {
                headers: {
                    "Authorization": `Bearer ${accessToken}`
                }
            });

            if (!response.ok) throw new Error("Failed to fetch questions");

            const data = await response.json();
            setQuestions(data.questions);
            setPagination(prev => ({ ...prev, total: data.total, pages: data.pages }));
        } catch (error) {
            console.error("Error fetching questions:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this question?")) return;

        try {
            const response = await fetch(`${apiUrl}/api/question-bank/questions/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${accessToken}` }
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Failed to delete");
            }
            fetchQuestions();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleApprove = async (id) => {
        try {
            const response = await fetch(`${apiUrl}/api/question-bank/questions/${id}/approve`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${accessToken}` }
            });
            if (!response.ok) throw new Error("Failed to approve");
            fetchQuestions();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleReject = async (id) => {
        if (!window.confirm("Reject and delete this question?")) return;
        try {
            const response = await fetch(`${apiUrl}/api/question-bank/questions/${id}/reject`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${accessToken}` }
            });
            if (!response.ok) throw new Error("Failed to reject");
            fetchQuestions();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleEdit = (question) => {
        setSelectedQuestion(question);
        setShowModal(true);
    };

    const handleAddNew = () => {
        setSelectedQuestion(null);
        setShowModal(true);
    }

    const handleModalClose = (refresh = false) => {
        setShowModal(false);
        if (refresh) fetchQuestions();
    };

    return (
        <Layout>
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold">Question Bank</h1>
                        <p className="text-gray-400">Manage and organize all test questions</p>
                    </div>
                    <button
                        onClick={handleAddNew}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
                    >
                        <Plus size={20} /> Add Question
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-6 border-b border-gray-700">
                    <button
                        onClick={() => setActiveTab("bank")}
                        className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === "bank"
                            ? "border-blue-500 text-blue-500"
                            : "border-transparent text-gray-400 hover:text-gray-300"
                            }`}
                    >
                        Question Bank
                    </button>
                    <button
                        onClick={() => setActiveTab("approvals")}
                        className={`px-4 py-2 font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === "approvals"
                            ? "border-yellow-500 text-yellow-500"
                            : "border-transparent text-gray-400 hover:text-gray-300"
                            }`}
                    >
                        Pending Approvals
                    </button>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-gray-800 p-4 rounded-xl border border-gray-700">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search questions..."
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-blue-500"
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                        />
                    </div>

                    <select
                        className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                        value={filters.groupName}
                        onChange={(e) => setFilters({ ...filters, groupName: e.target.value })}
                    >
                        <option value="">All Classes & Subjects</option>
                        {(isTeacher ? loadingGroups : loadingCurriculum) ? (
                            <option disabled>Loading...</option>
                        ) : combinedOptions.length === 0 ? (
                            <option disabled>{isTeacher ? "No groups assigned" : "No subjects found"}</option>
                        ) : (
                            combinedOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))
                        )}
                    </select>

                    <select
                        className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                        value={filters.difficulty}
                        onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
                    >
                        <option value="">All Difficulties</option>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                        <option value="advanced">Advanced</option>
                    </select>

                    <select
                        className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                        value={filters.type}
                        onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                    >
                        <option value="">All Types</option>
                        <option value="mcq">MCQ</option>
                        <option value="fillup">Fill-ups</option>
                        <option value="short_answer">Short Answer</option>
                        <option value="long_answer">Long Answer</option>
                    </select>
                </div>

                {/* Questions List */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-400">Loading questions...</div>
                    ) : questions.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">No questions found. Try adjusting filters or add a new one.</div>
                    ) : (
                        <div className="divide-y divide-gray-700">
                            {questions.map((q) => (
                                <div key={q.id} className="p-4 hover:bg-gray-750 transition-colors">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex gap-2 mb-2">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium 
                                            ${q.difficulty === 'easy' ? 'bg-green-900 text-green-300' :
                                                        q.difficulty === 'medium' ? 'bg-yellow-900 text-yellow-300' :
                                                            'bg-red-900 text-red-300'}`}>
                                                    {q.difficulty.toUpperCase()}
                                                </span>
                                                <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded text-xs">
                                                    {q.type.replace('_', ' ').toUpperCase()}
                                                </span>
                                                <span className="bg-blue-900 text-blue-300 px-2 py-0.5 rounded text-xs">
                                                    {q.subject} • Class {q.class_level}
                                                </span>
                                                <span className="bg-purple-900 text-purple-300 px-2 py-0.5 rounded text-xs">
                                                    {q.marks} Mark{q.marks > 1 ? 's' : ''}
                                                </span>
                                                {q.status === 'pending' && (
                                                    <span className="bg-yellow-900 text-yellow-300 px-2 py-0.5 rounded text-xs border border-yellow-700">
                                                        Pending Approval
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-lg font-medium text-white mb-2">{q.text}</h3>

                                            {q.type === 'mcq' && (
                                                <div className="grid grid-cols-2 gap-2 mt-2">
                                                    {q.options.map((opt, idx) => (
                                                        <div key={idx} className={`p-2 rounded text-sm ${opt === q.correct_answer ? 'bg-green-900/30 border border-green-700' : 'bg-gray-700/30'}`}>
                                                            <span className="font-bold mr-2">{String.fromCharCode(65 + idx)}.</span> {opt}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {q.type !== 'mcq' && (
                                                <div className="mt-2 text-sm text-gray-400">
                                                    <span className="font-semibold text-gray-300">Answer:</span> {q.correct_answer}
                                                </div>
                                            )}

                                            <div className="mt-2 text-xs text-gray-500">
                                                Chapter {q.chapter} • {q.is_ai_generated ? `Triggered by ${q.triggered_by || q.created_by}` : `Created by ${q.created_by}`} • {new Date(q.created_at).toLocaleDateString()}
                                                {q.is_ai_generated && <span className="ml-2 text-blue-400 flex items-center inline-flex gap-1">✨ AI Generated</span>}
                                                {q.status === 'pending' && q.expires_at && (() => {
                                                    const daysLeft = Math.ceil((new Date(q.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
                                                    return daysLeft > 0 ? (
                                                        <span className={`ml-2 ${daysLeft <= 2 ? 'text-red-400' : 'text-yellow-400'}`}>
                                                            ⏱️ Auto-deletes in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                                                        </span>
                                                    ) : (
                                                        <span className="ml-2 text-red-400">⏱️ Expired</span>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        <div className="flex gap-2 ml-4">
                                            {activeTab === "approvals" && (
                                                <>
                                                    <button
                                                        onClick={() => handleApprove(q.id)}
                                                        className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-xs text-white transition-colors"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(q.id)}
                                                        className="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-xs text-white transition-colors"
                                                    >
                                                        Reject
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={() => handleEdit(q)}
                                                className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Edit"
                                                disabled={isTeacher && q.created_role !== 'teacher' && q.created_by !== user.user_id && q.triggered_by !== user.user_id}
                                            >
                                                <Edit size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(q.id)}
                                                className="p-2 hover:bg-red-900/30 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pagination settings */}
                    <div className="p-4 border-t border-gray-700 flex justify-between items-center text-sm text-gray-400">
                        <div>Showing {questions.length} of {pagination.total} questions</div>
                        <div className="flex gap-2">
                            <button
                                disabled={pagination.page === 1}
                                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                                className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="px-2 py-1">Page {pagination.page} of {pagination.pages}</span>
                            <button
                                disabled={pagination.page === pagination.pages}
                                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                                className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {showModal && (
                <QuestionModal
                    question={selectedQuestion}
                    onClose={handleModalClose}
                    isTeacher={isTeacher}
                    userSubjects={user.subjects || []}
                    availableSubjects={subjects} // Pass dynamic subjects to modal
                />
            )}
        </Layout>
    );
};

export default QuestionBank;
