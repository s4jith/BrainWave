/**
 * TeacherTests - Manage assessments
 * Uses AdminLayout
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import { ClipboardList, Plus, Search, Filter, Edit, Trash2, Eye, Calendar, Clock } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function TeacherTests() {
    const navigate = useNavigate();
    const { getAuthHeader } = useUserStore();
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    
    // Teacher's subjects from groups
    const [teacherSubjects, setTeacherSubjects] = useState([]);
    const [loadingSubjects, setLoadingSubjects] = useState(true);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [selectedStatus, setSelectedStatus] = useState("");

    useEffect(() => {
        fetchTeacherGroups();
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
                
                // Extract unique subjects
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
                console.log("Fetched tests:", data.assessments); // Debug log
                setTests(data.assessments || []);
            } else {
                console.error("Failed to fetch tests:", response.status);
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
        if (!window.confirm(`Are you sure you want to delete "${test.title}"?`)) {
            return;
        }

        // Optimistic update - remove from UI immediately
        const previousTests = [...tests];
        setTests(tests.filter(t => t.id !== test.id));

        try {
            const response = await fetch(`${API_URL}/api/assessments/${test.id}`, {
                method: 'DELETE',
                headers: getAuthHeader()
            });

            if (!response.ok) {
                throw new Error('Failed to delete test');
            }
        } catch (err) {
            // Revert on error
            console.error("Delete failed:", err);
            setTests(previousTests);
            alert("Failed to delete test. Please try again.");
        }
    };

    const filteredTests = tests.filter(t => {
        const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.subject.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSubject = !selectedSubject || t.subject === selectedSubject;
        const matchesStatus = !selectedStatus || t.status === selectedStatus.toLowerCase();
        return matchesSearch && matchesSubject && matchesStatus;
    });

    return (
        <AdminLayout title="Tests Management" icon={ClipboardList}>
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search tests..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    />
                </div>

                <div className="flex gap-2">
                    <select 
                        value={selectedSubject} 
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm"
                    >
                        <option value="">All Subjects</option>
                        {loadingSubjects ? (
                            <option disabled>Loading...</option>
                        ) : teacherSubjects.length > 0 ? (
                            teacherSubjects.map(s => <option key={s} value={s}>{s}</option>)
                        ) : (
                            <option disabled>No subjects assigned</option>
                        )}
                    </select>
                    <select 
                        value={selectedStatus} 
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm"
                    >
                        <option value="">All Status</option>
                        <option value="Published">Published</option>
                        <option value="Draft">Draft</option>
                    </select>
                    <button
                        onClick={() => navigate("/create-test")} // Redirect to existing builder or new one
                        className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition flex items-center gap-2 font-medium"
                    >
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
                        <button
                            onClick={() => navigate("/create-test")}
                            className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition inline-flex items-center gap-2 font-medium"
                        >
                            <Plus className="w-4 h-4" /> Create Test
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
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
                                            {test.class_level && <p className="text-xs text-gray-500 dark:text-gray-400">Class {test.class_level}</p>}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{test.subject}</td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{test.questions?.length || test.questions_count || 0}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${test.status === 'published'
                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                                }`}>
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
                                                <button 
                                                    onClick={() => navigate(`/create-test/${test.id}`)} 
                                                    className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                    title="Edit Test"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(test)} 
                                                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Delete Test"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
