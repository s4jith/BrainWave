/**
 * QuestionBank - Manage questions manually
 * Uses AdminLayout
 */

import React, { useState, useEffect } from "react";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import { HelpCircle, Plus, Search, Filter, Edit, Trash2, Eye } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function QuestionBank() {
    const { getAuthHeader } = useUserStore();
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        text: "",
        type: "short_answer", // short_answer, multiple_choice, etc.
        subject: "Mathematics",
        class_level: 10,
        chapter: 1,
        difficulty: "medium", // easy, medium, hard
        marks: 1
    });

    useEffect(() => {
        fetchQuestions();
    }, []);

    const fetchQuestions = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/api/teacher/questions`, { headers: getAuthHeader() });
            if (response.ok) {
                const data = await response.json();
                setQuestions(data.questions || []);
            } else {
                console.warn("Using mock question data");
                setQuestions([
                    { id: 1, text: "What is the capital of France?", subject: "Geography", class_level: 9, type: "short_answer", difficulty: "easy" },
                    { id: 2, text: "Explain Newton's Second Law.", subject: "Physics", class_level: 10, type: "long_answer", difficulty: "medium" },
                ]);
            }
        } catch (err) {
            console.error("Error fetching questions:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        // Implement save logic (POST/PUT)
        console.log("Saving question:", formData);

        // Mock update UI
        if (editingQuestion) {
            setQuestions(questions.map(q => q.id === editingQuestion.id ? { ...q, ...formData } : q));
        } else {
            setQuestions([...questions, { id: Date.now(), ...formData }]);
        }

        setShowModal(false);
        setEditingQuestion(null);
        setFormData({
            text: "",
            type: "short_answer",
            subject: "Mathematics",
            class_level: 10,
            chapter: 1,
            difficulty: "medium",
            marks: 1
        });
    };

    const handleEdit = (question) => {
        setEditingQuestion(question);
        setFormData({ ...question });
        setShowModal(true);
    };

    const handleDelete = (id) => {
        if (confirm("Delete this question?")) {
            setQuestions(questions.filter(q => q.id !== id));
        }
    };

    const filteredQuestions = questions.filter(q =>
        q.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.subject.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AdminLayout title="Question Bank" icon={HelpCircle}>
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search questions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    />
                </div>
                <button
                    onClick={() => { setEditingQuestion(null); setShowModal(true); }}
                    className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition flex items-center gap-2 font-medium"
                >
                    <Plus className="w-4 h-4" /> Create Question
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300">
                            <tr>
                                <th className="px-6 py-4 font-medium text-sm">Question</th>
                                <th className="px-6 py-4 font-medium text-sm">Subject</th>
                                <th className="px-6 py-4 font-medium text-sm">Class</th>
                                <th className="px-6 py-4 font-medium text-sm">Type</th>
                                <th className="px-6 py-4 font-medium text-sm">Difficulty</th>
                                <th className="px-6 py-4 font-medium text-sm text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Loading...</td>
                                </tr>
                            ) : filteredQuestions.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">No questions found</td>
                                </tr>
                            ) : (
                                filteredQuestions.map((q) => (
                                    <tr key={q.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <p className="text-gray-900 dark:text-white font-medium line-clamp-1">{q.text}</p>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{q.subject}</td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{q.class_level}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                                {q.type?.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400 capitalize">{q.difficulty}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => handleEdit(q)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(q.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto border dark:border-gray-700">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                            {editingQuestion ? "Edit Question" : "Create Question"}
                        </h2>

                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Question Text *</label>
                                <textarea
                                    required
                                    rows={3}
                                    value={formData.text}
                                    onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white outline-none"
                                    placeholder="Enter your question here..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Subject</label>
                                    <select
                                        value={formData.subject}
                                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                    >
                                        <option value="Mathematics">Mathematics</option>
                                        <option value="Science">Science</option>
                                        <option value="English">English</option>
                                        <option value="Social Science">Social Science</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Class</label>
                                    <select
                                        value={formData.class_level}
                                        onChange={(e) => setFormData({ ...formData, class_level: parseInt(e.target.value) })}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                    >
                                        {[...Array(8)].map((_, i) => (
                                            <option key={i + 5} value={i + 5}>Class {i + 5}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Type</label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                    >
                                        <option value="short_answer">Short Answer</option>
                                        <option value="long_answer">Long Answer</option>
                                        <option value="multiple_choice">Multiple Choice</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Difficulty</label>
                                    <select
                                        value={formData.difficulty}
                                        onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                    >
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                                >
                                    {editingQuestion ? "Update" : "Create"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
