
import React, { useState, useEffect } from "react";
import { Edit, Trash2, Plus, Search, BookOpen } from "lucide-react";
import AdminLayout from "../components/AdminLayout";
import LoadingSpinner from "../components/LoadingSpinner";
import QuestionModal from "../components/QuestionModal";
import useUserStore from "../stores/userStore";
import { getCombinedClassSubjectOptions, parseCombinedValue, createCombinedValue, parseGroupName } from "../constants/academicConstants";

const QuestionBank = () => {
    const { user, accessToken } = useUserStore();
    const isTeacher = user.role === "teacher";

    const [activeTab, setActiveTab] = useState("bank"); 
    const [questions, setQuestions] = useState([]);
    const [subjects, setSubjects] = useState([]); 
    const [groups, setGroups] = useState([]); 
    const [curriculumSubjects, setCurriculumSubjects] = useState([]); 
    const [loadingGroups, setLoadingGroups] = useState(true); 
    const [loadingCurriculum, setLoadingCurriculum] = useState(true); 
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedQuestion, setSelectedQuestion] = useState(null);

    const combinedOptions = React.useMemo(() => {
        if (isTeacher && groups.length > 0) {
            
            return groups.map(group => ({
                value: group.name,  
                label: group.name,  
                class: group.class_level,
                subject: group.subject
            })).sort((a, b) => {
                if (a.class !== b.class) return a.class - b.class;
                return a.subject.localeCompare(b.subject);
            });
        }
        
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

    const [filters, setFilters] = useState({
        groupName: "",  
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
            
            let classLevel = null;
            let subject = null;
            
            if (filters.groupName) {
                if (isTeacher && groups.length > 0) {
                    
                    const parsed = parseGroupName(filters.groupName);
                    classLevel = parsed.class;
                    subject = parsed.subject;
                } else {
                    
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
        <AdminLayout title="Question Bank" icon={BookOpen}>
            <div>
                <div className="flex justify-between items-center mb-6">
                    <p className="text-gray-500 dark:text-gray-400">Manage and organize all test questions</p>
                    <button
                        onClick={handleAddNew}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 font-medium transition"
                    >
                        <Plus size={18} /> Add Question
                    </button>
                </div>

                <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
                    <button
                        onClick={() => setActiveTab("bank")}
                        className={`px-4 py-2.5 font-medium border-b-2 transition-colors text-sm ${activeTab === "bank"
                            ? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
                            : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300"
                            }`}
                    >
                        Question Bank
                    </button>
                    <button
                        onClick={() => setActiveTab("approvals")}
                        className={`px-4 py-2.5 font-medium border-b-2 transition-colors flex items-center gap-2 text-sm ${activeTab === "approvals"
                            ? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
                            : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300"
                            }`}
                    >
                        Pending Approvals
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3 mb-6">
                    <div className="relative flex-1 min-w-48">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
                        <input
                            type="text"
                            placeholder="Search questions..."
                            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500"
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                        />
                    </div>
                    <select
                        className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500"
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
                        className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500"
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
                        className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500"
                        value={filters.type}
                        onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                    >
                        <option value="">All Types</option>
                        <option value="mcq">MCQ</option>
                        <option value="fillup">Fill-ups</option>
                        <option value="true_false">True / False</option>
                        <option value="short_answer">Short Answer</option>
                        <option value="long_answer">Long Answer</option>
                    </select>
                </div>

                {/* Questions List */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center">
                            <LoadingSpinner size="lg" text="Loading questions…" />
                        </div>
                    ) : questions.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 dark:text-gray-400">No questions found. Try adjusting filters or add a new one.</div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {questions.map((q) => (
                                <div key={q.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold 
                                                    ${q.difficulty === 'easy' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                                    q.difficulty === 'medium' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                                                    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
                                                    {q.difficulty.toUpperCase()}
                                                </span>
                                                <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-0.5 rounded-full text-xs font-medium">
                                                    {q.type.replace('_', ' ').toUpperCase()}
                                                </span>
                                                <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-full text-xs font-medium">
                                                    {q.subject} • Class {q.class_level}
                                                </span>
                                                <span className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2.5 py-0.5 rounded-full text-xs font-medium">
                                                    {q.marks} Mark{q.marks > 1 ? 's' : ''}
                                                </span>
                                                {q.status === 'pending' && (
                                                    <span className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 rounded-full text-xs font-medium border border-amber-200 dark:border-amber-700">
                                                        Pending Approval
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-base font-medium text-gray-900 dark:text-white mb-3 leading-relaxed">{q.text}</p>

                                            {q.type === 'mcq' && (
                                                <div className="grid grid-cols-2 gap-2 mb-3">
                                                    {q.options.map((opt, idx) => (
                                                        <div key={idx} className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${opt === q.correct_answer ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-200' : 'bg-gray-50 dark:bg-gray-700/40 text-gray-700 dark:text-gray-300'}`}>
                                                            <span className="font-semibold text-xs w-5 h-5 rounded-full bg-white dark:bg-gray-600 flex items-center justify-center flex-shrink-0 border border-gray-200 dark:border-gray-500">{String.fromCharCode(65 + idx)}</span>
                                                            {opt}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {q.type === 'true_false' && (
                                                <div className="flex gap-2 mb-3">
                                                    <span className={`px-4 py-2 rounded-lg text-sm font-medium ${q.correct_answer === 'True' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-200' : 'bg-gray-50 dark:bg-gray-700/40 text-gray-700 dark:text-gray-300'}`}>
                                                        True
                                                    </span>
                                                    <span className={`px-4 py-2 rounded-lg text-sm font-medium ${q.correct_answer === 'False' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-200' : 'bg-gray-50 dark:bg-gray-700/40 text-gray-700 dark:text-gray-300'}`}>
                                                        False
                                                    </span>
                                                </div>
                                            )}

                                            {q.type !== 'mcq' && q.type !== 'true_false' && q.correct_answer && (
                                                <div className="mb-3 text-sm">
                                                    <span className="font-semibold text-gray-700 dark:text-gray-300">Answer: </span>
                                                    <span className="text-gray-600 dark:text-gray-400">{q.correct_answer}</span>
                                                </div>
                                            )}

                                            <div className="text-xs text-gray-400 dark:text-gray-500 flex flex-wrap items-center gap-x-1">
                                                <span>Chapter {q.chapter}</span>
                                                <span>•</span>
                                                <span>{q.is_ai_generated ? `Triggered by ${q.triggered_by || q.created_by}` : `Created by ${q.created_by}`}</span>
                                                <span>•</span>
                                                <span>{new Date(q.created_at).toLocaleDateString('en-GB')}</span>
                                                {q.is_ai_generated && <span className="ml-1 text-indigo-500 dark:text-indigo-400">✨ AI Generated</span>}
                                                {q.status === 'pending' && q.expires_at && (() => {
                                                    const daysLeft = Math.ceil((new Date(q.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
                                                    return daysLeft > 0 ? (
                                                        <span className={`ml-1 ${daysLeft <= 2 ? 'text-red-500' : 'text-amber-500'}`}>
                                                            ⏱️ Auto-deletes in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                                                        </span>
                                                    ) : (
                                                        <span className="ml-1 text-red-500">⏱️ Expired</span>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            {activeTab === "approvals" && (
                                                <>
                                                    <button
                                                        onClick={() => handleApprove(q.id)}
                                                        className="px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 border border-green-200 dark:border-green-700 rounded-lg text-xs font-medium transition"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(q.id)}
                                                        className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-700 rounded-lg text-xs font-medium transition"
                                                    >
                                                        Reject
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={() => handleEdit(q)}
                                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Edit"
                                                disabled={isTeacher && q.created_role !== 'teacher' && q.created_by !== user.user_id && q.triggered_by !== user.user_id}
                                            >
                                                <Edit size={17} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(q.id)}
                                                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition"
                                                title="Delete"
                                            >
                                                <Trash2 size={17} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Showing {questions.length} of {pagination.total} questions</p>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={pagination.page === 1}
                                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                                className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 transition"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-gray-500 dark:text-gray-400 px-2">Page {pagination.page} of {pagination.pages}</span>
                            <button
                                disabled={pagination.page === pagination.pages}
                                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                                className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 transition"
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
                    availableSubjects={subjects}
                />
            )}
        </AdminLayout>
    );
};

export default QuestionBank;
