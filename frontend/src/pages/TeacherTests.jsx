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

    useEffect(() => {
        fetchTests();
    }, []);

    const fetchTests = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/api/assessments`, { headers: getAuthHeader() });
            if (response.ok) {
                const data = await response.json();
                setTests(data.assessments || []); // Adjust based on actual API response structure
            } else {
                console.warn("Using mock test data");
                setTests([
                    { id: 1, title: "Mid-Term Mathematics", subject: "Math", class_level: 10, created_at: "2026-02-01", status: "published", questions_count: 20 },
                    { id: 2, title: "Physics Unit 1 Quiz", subject: "Science", class_level: 9, created_at: "2026-02-03", status: "draft", questions_count: 10 },
                ]);
            }
        } catch (err) {
            console.error("Error fetching tests:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (id) => {
        if (confirm("Delete this test?")) {
            setTests(tests.filter(t => t.id !== id));
        }
    };

    const filteredTests = tests.filter(t =>
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.subject.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                    <select className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm">
                        <option>All Subjects</option>
                        <option>Mathematics</option>
                        <option>Science</option>
                    </select>
                    <select className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm">
                        <option>All Status</option>
                        <option>Published</option>
                        <option>Draft</option>
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
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Class {test.class_level}</p>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{test.subject}</td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{test.questions_count}</td>
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
                                                {test.created_at}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => navigate(`/create-test/${test.id}`)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(test.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
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
