
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import LoadingSpinner from "../components/LoadingSpinner";
import {
    ClipboardList, Plus, Search, Edit, Trash2, Calendar
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function TeacherTests() {
    const navigate = useNavigate();
    const { getAuthHeader } = useUserStore();
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const [teacherSubjects, setTeacherSubjects] = useState([]);
    const [teacherClassLevels, setTeacherClassLevels] = useState([]);
    const [loadingSubjects, setLoadingSubjects] = useState(true);
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("");
    const [selectedStatus, setSelectedStatus] = useState("");

    useEffect(() => {
        fetchTeacherGroups();
        fetchTests();
    }, []);

    const fetchTeacherGroups = async () => {
        try {
            setLoadingSubjects(true);
            const response = await fetch(`${API_URL}/api/teacher/groups`, { headers: getAuthHeader() });
            if (response.ok) {
                const data = await response.json();
                const groups = data.groups || [];
                const subjects = [...new Set(groups.map(g => g.subject).filter(Boolean))];
                setTeacherSubjects(subjects.sort());
                const classes = [...new Set(groups.map(g => g.class_level).filter(Boolean))];
                setTeacherClassLevels(classes.sort((a, b) => a - b));
            }
        } catch (err) {
            console.error("Failed to fetch teacher groups:", err);
        } finally {
            setLoadingSubjects(false);
        }
    };

    const getTestStatus = (test) => {
        if (!test.start_datetime || !test.end_datetime) {
            return test.status === 'published' ? 'active' : test.status;
        }
        const now = new Date();
        const start = new Date(test.start_datetime);
        const end = new Date(test.end_datetime);
        if (now < start) return 'upcoming';
        if (now > end) return 'completed';
        return 'active';
    };

    const getStatusBadge = (testStatus) => {
        const styles = {
            active: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
            upcoming: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
            completed: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
            closed: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
            published: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
            draft: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
        };
        return <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[testStatus] || styles.draft}`}>{testStatus}</span>;
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
        const matchesClass = !selectedClass || String(t.class_level) === String(selectedClass);
        const matchesSubject = !selectedSubject || t.subject === selectedSubject;
        const computedStatus = getTestStatus(t);
        const matchesStatus = !selectedStatus ||
            (selectedStatus === "active" && computedStatus === "active") ||
            (selectedStatus === "upcoming" && computedStatus === "upcoming") ||
            (selectedStatus === "completed" && (computedStatus === "completed" || computedStatus === "closed" || computedStatus === "draft"));
        return matchesSearch && matchesClass && matchesSubject && matchesStatus;
    });

    return (
        <AdminLayout title="Tests Management" icon={ClipboardList}>
            {/* Filter bar */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
                <div className="flex flex-wrap gap-3 justify-between items-center">
                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search tests..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 text-sm w-52"
                            />
                        </div>
                        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}
                            className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm">
                            <option value="">All Classes</option>
                            {teacherClassLevels.map(c => <option key={c} value={c}>Class {c}</option>)}
                        </select>
                        <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}
                            className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm">
                            <option value="">All Subjects</option>
                            {teacherSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}
                            className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm">
                            <option value="">All Status</option>
                            <option value="active">Active</option>
                            <option value="upcoming">Upcoming</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                    <button onClick={() => navigate("/create-test")}
                        className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition flex items-center gap-2 font-medium">
                        <Plus className="w-4 h-4" /> Create Test
                    </button>
                </div>
            </div>

            {/* Test Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center">
                        <LoadingSpinner size="lg" text="Loading testsâ€¦" />
                    </div>
                ) : filteredTests.length === 0 ? (
                    <div className="p-16 text-center">
                        <ClipboardList className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                            {tests.length === 0 ? "No Tests Found" : "No Tests Match Filters"}
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">
                            {tests.length === 0 ? "Get started by creating your first test" : "Try changing your filter selections"}
                        </p>
                        {tests.length === 0 && (
                            <button onClick={() => navigate("/create-test")}
                                className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition inline-flex items-center gap-2 font-medium">
                                <Plus className="w-4 h-4" /> Create Test
                            </button>
                        )}
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
                                        {getStatusBadge(getTestStatus(test))}
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
        </AdminLayout>
    );
}
