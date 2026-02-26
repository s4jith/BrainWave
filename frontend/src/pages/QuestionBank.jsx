
import React, { useState, useEffect } from "react";
import { Edit, Trash2, Plus, Search, BookOpen, Loader2, X } from "lucide-react";
import AdminLayout from "../components/AdminLayout";
import LoadingSpinner from "../components/LoadingSpinner";
import QuestionModal from "../components/QuestionModal";
import useUserStore from "../stores/userStore";
import { getCombinedClassSubjectOptions, parseCombinedValue, createCombinedValue, parseGroupName } from "../constants/academicConstants";

const QuestionBank = () => {
    const { user, accessToken } = useUserStore();
    const isTeacher = user.role === "teacher";
    const isHead = user.role === "head";

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

    // Head assignment (from /api/head/my-assignment)
    const [headSubjects, setHeadSubjects] = useState([]);
    const [headAssignment, setHeadAssignment] = useState(null);
    const [headClassOptions, setHeadClassOptions] = useState([]);

    // Teacher: request-deletion confirm modal
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestQuestion, setRequestQuestion] = useState(null);
    const [requestNote, setRequestNote] = useState("");
    const [requestSubmitting, setRequestSubmitting] = useState(false);

    // Head: delete requests tab
    const [deleteRequests, setDeleteRequests] = useState([]);
    const [drLoading, setDrLoading] = useState(false);
    const [drActionId, setDrActionId] = useState(null); // request id being processed

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
        if (isHead) return []; // head uses headSubjects dropdown instead
        return curriculumSubjects.map(subj => ({
            value: `${subj.class_level}-${subj.subject_name}`,
            label: `Class ${subj.class_level} - ${subj.subject_name}`,
            class: subj.class_level,
            subject: subj.subject_name
        })).sort((a, b) => {
            if (a.class !== b.class) return a.class - b.class;
            return a.subject.localeCompare(b.subject);
        });
    }, [isTeacher, isHead, groups, curriculumSubjects]);

    const [filters, setFilters] = useState({
        groupName: "",  
        subject: "", // head subject filter (class-assigned HEAD)
        class_level: "", // head class filter (subject-assigned HEAD)
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
        if (isHead) {
            fetchHeadSubjects();
        }
    }, []);

    useEffect(() => {
        fetchQuestions();
    }, [pagination.page, filters, activeTab, headAssignment]);

    useEffect(() => {
        if (activeTab === "delete-requests" && isHead) {
            loadDeleteRequests();
        }
    }, [activeTab]);

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

    const fetchHeadSubjects = async () => {
        try {
            const res = await fetch(`${apiUrl}/api/head/my-assignment`, {
                headers: { "Authorization": `Bearer ${accessToken}` }
            });
            if (res.ok) {
                const data = await res.json();
                setHeadAssignment(data);
                if (data.assignment_type === "class") {
                    setHeadSubjects(data.head_subjects || []);
                }
            }
        } catch (e) {
            console.error("Error fetching head subjects:", e);
        }
    };

    const loadDeleteRequests = async () => {
        setDrLoading(true);
        try {
            const res = await fetch(`${apiUrl}/api/question-bank/delete-requests?status=pending`, {
                headers: { "Authorization": `Bearer ${accessToken}` }
            });
            if (res.ok) {
                const data = await res.json();
                setDeleteRequests(data.requests || []);
            }
        } catch (e) {
            console.error("Error loading delete requests:", e);
        } finally {
            setDrLoading(false);
        }
    };

    const fetchQuestions = async () => {
        if (activeTab === "delete-requests") return; // handled separately
        setLoading(true);
        try {
            const status = activeTab === "approvals" ? "pending" : "approved";
            
            let classLevel = null;
            let subject = null;
            
            if (isHead) {
                if (headAssignment?.assignment_type === "subject") {
                    // Subject-assigned HEAD: can filter by class
                    if (filters.class_level) classLevel = parseInt(filters.class_level);
                } else {
                    // Class-assigned HEAD: can filter by subject
                    if (filters.subject) subject = filters.subject;
                }
            } else if (filters.groupName) {
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
            if (isHead && headAssignment?.assignment_type === "subject") {
                const cls = [...new Set((data.questions || []).map(q => q.class_level).filter(Boolean))].sort((a, b) => a - b);
                setHeadClassOptions(cls);
            }
        } catch (error) {
            console.error("Error fetching questions:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (question) => {
        if (isTeacher) {
            // Teacher: open request-deletion confirmation modal
            setRequestQuestion(question);
            setRequestNote("");
            setShowRequestModal(true);
            return;
        }
        // Head / Admin: direct delete with confirmation
        if (!window.confirm("Are you sure you want to delete this question?")) return;
        try {
            const response = await fetch(`${apiUrl}/api/question-bank/questions/${question.id}`, {
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

    const handleSendDeleteRequest = async () => {
        if (!requestQuestion) return;
        setRequestSubmitting(true);
        try {
            const res = await fetch(`${apiUrl}/api/question-bank/questions/${requestQuestion.id}/request-delete`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
                body: JSON.stringify({ reason: requestNote })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Failed to send request");
            }
            setShowRequestModal(false);
            alert("Delete request sent to head.");
        } catch (err) {
            alert(err.message);
        } finally {
            setRequestSubmitting(false);
        }
    };

    const handleApproveRequest = async (reqId) => {
        setDrActionId(reqId);
        try {
            const res = await fetch(`${apiUrl}/api/question-bank/delete-requests/${reqId}/approve`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${accessToken}` }
            });
            if (!res.ok) throw new Error((await res.json()).detail || "Failed");
            loadDeleteRequests();
        } catch (err) {
            alert(err.message);
        } finally {
            setDrActionId(null);
        }
    };

    const handleRejectRequest = async (reqId) => {
        setDrActionId(reqId);
        try {
            const res = await fetch(`${apiUrl}/api/question-bank/delete-requests/${reqId}/reject`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
                body: JSON.stringify({ reason: "" })
            });
            if (!res.ok) throw new Error((await res.json()).detail || "Failed");
            loadDeleteRequests();
        } catch (err) {
            alert(err.message);
        } finally {
            setDrActionId(null);
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
                    {!isTeacher && (
                    <button
                        onClick={() => setActiveTab("approvals")}
                        className={`px-4 py-2.5 font-medium border-b-2 transition-colors flex items-center gap-2 text-sm ${activeTab === "approvals"
                            ? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
                            : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300"
                            }`}
                    >
                        Pending Approvals
                    </button>
                    )}
                    {isHead && (
                    <button
                        onClick={() => setActiveTab("delete-requests")}
                        className={`px-4 py-2.5 font-medium border-b-2 transition-colors flex items-center gap-2 text-sm ${activeTab === "delete-requests"
                            ? "border-red-600 dark:border-red-400 text-red-600 dark:text-red-400"
                            : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300"
                            }`}
                    >
                        <Trash2 size={14} />
                        Delete Requests
                    </button>
                    )}
                </div>

                {/* Filters — hidden on delete-requests tab */}
                {activeTab !== "delete-requests" && (
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
                    {/* Filter dropdown: class-assigned HEAD gets subject filter; subject-assigned HEAD gets class filter; others get combined */}
                    {isHead ? (
                        headAssignment?.assignment_type === "subject" ? (
                            <select
                                className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500"
                                value={filters.class_level}
                                onChange={(e) => setFilters({ ...filters, class_level: e.target.value })}
                            >
                                <option value="">All Classes</option>
                                {headClassOptions.length === 0 ? (
                                    <option disabled>No classes found</option>
                                ) : headClassOptions.map(c => (
                                    <option key={c} value={c}>Class {c}</option>
                                ))}
                            </select>
                        ) : (
                            <select
                                className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500"
                                value={filters.subject}
                                onChange={(e) => setFilters({ ...filters, subject: e.target.value })}
                            >
                                <option value="">All Subjects</option>
                                {headSubjects.length === 0 ? (
                                    <option disabled>No subjects assigned</option>
                                ) : headSubjects.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        )
                    ) : (
                        <select
                            className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500"
                            value={filters.groupName}
                            onChange={(e) => setFilters({ ...filters, groupName: e.target.value })}
                        >
                            <option value="">All Classes &amp; Subjects</option>
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
                    )}
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
                )}

                {/* Head: Delete Requests Tab */}
                {activeTab === "delete-requests" && isHead && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {drLoading ? (
                            <div className="p-12 text-center"><LoadingSpinner size="lg" text="Loading delete requests…" /></div>
                        ) : deleteRequests.length === 0 ? (
                            <div className="p-12 text-center text-gray-500 dark:text-gray-400">No pending delete requests from teachers.</div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                {deleteRequests.map(req => (
                                    <div key={req.id} className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap gap-2 mb-1">
                                                <span className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-2.5 py-0.5 rounded-full text-xs font-semibold">Delete Request</span>
                                                <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-full text-xs">{req.question_subject} • Class {req.question_class_level}</span>
                                            </div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white mb-1 leading-snug">{req.question_text}</p>
                                            <p className="text-xs text-gray-400 dark:text-gray-500">Requested by <span className="font-medium text-gray-600 dark:text-gray-300">{req.teacher_name}</span>{req.reason ? ` · Reason: ${req.reason}` : ""} · {req.created_at ? new Date(req.created_at).toLocaleDateString("en-GB") : ""}</p>
                                        </div>
                                        <div className="flex gap-2 flex-shrink-0">
                                            <button
                                                onClick={() => handleApproveRequest(req.id)}
                                                disabled={drActionId === req.id}
                                                className="px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 border border-green-200 dark:border-green-700 rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center gap-1"
                                            >
                                                {drActionId === req.id ? <Loader2 size={12} className="animate-spin" /> : null} Approve &amp; Delete
                                            </button>
                                            <button
                                                onClick={() => handleRejectRequest(req.id)}
                                                disabled={drActionId === req.id}
                                                className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700/40 text-gray-700 dark:text-gray-300 hover:bg-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-medium transition disabled:opacity-50"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Questions List */}
                {activeTab !== "delete-requests" && (
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
                                                onClick={() => handleDelete(q)}
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
                )}
            </div>

            {showModal && (
                <QuestionModal
                    question={selectedQuestion}
                    onClose={handleModalClose}
                    isTeacher={isTeacher}
                    userSubjects={user.subjects || []}
                    availableSubjects={subjects}
                    groups={isTeacher ? groups : []}
                />
            )}

            {/* Teacher: Send Delete Request Modal */}
            {showRequestModal && requestQuestion && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md border border-gray-200 dark:border-gray-700 shadow-2xl">
                        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Request Question Deletion</h2>
                            <button onClick={() => setShowRequestModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X size={20} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Your request will be sent to the head for approval. The question will only be deleted after the head approves.</p>
                            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{requestQuestion.subject} • Class {requestQuestion.class_level}</p>
                                <p className="text-sm text-gray-800 dark:text-gray-200 font-medium leading-snug">{requestQuestion.text?.slice(0, 120)}{(requestQuestion.text?.length || 0) > 120 ? "..." : ""}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason <span className="text-gray-400 font-normal">(optional)</span></label>
                                <textarea
                                    rows={2}
                                    placeholder="Why should this question be deleted?"
                                    value={requestNote}
                                    onChange={e => setRequestNote(e.target.value)}
                                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-gray-400"
                                />
                            </div>
                        </div>
                        <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                            <button
                                onClick={() => setShowRequestModal(false)}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSendDeleteRequest}
                                disabled={requestSubmitting}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-2"
                            >
                                {requestSubmitting && <Loader2 size={14} className="animate-spin" />}
                                Send Delete Request
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default QuestionBank;
