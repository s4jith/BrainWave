
import React, { useState, useEffect } from "react";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import LoadingSpinner from "../components/LoadingSpinner";
import { Shield, Search, UserPlus, Edit, Trash2, Key, CheckCircle, Clipboard, Lightbulb, BookOpen, GraduationCap } from "lucide-react";
import { CLASSES } from "../constants/academicConstants";
import authFetch from "../utils/authFetch";

const API_URL = import.meta.env.VITE_API_URL;

export default function HeadManagement() {
    const { getAuthHeader } = useUserStore();
    const [heads, setHeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showCredentialsModal, setShowCredentialsModal] = useState(false);
    const [newCredentials, setNewCredentials] = useState(null);
    const [selectedHead, setSelectedHead] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        mobile: "",
        age: "",
        assignment_type: "class",
        assigned_classes: [],
        assigned_subjects: [],
    });

    // Load available subjects from curriculum API (exact names matching DB)
    const [availableSubjects, setAvailableSubjects] = useState([]);
    useEffect(() => {
        fetch(`${API_URL}/api/curriculum/subjects?is_active=true`, { headers: getAuthHeader() })
            .then(r => r.ok ? r.json() : [])
            .then(data => {
                const subjects = [...new Set(
                    (Array.isArray(data) ? data : (data.subjects || []))
                        .map(s => s.subject_name || s.name || s)
                        .filter(Boolean)
                )].sort();
                setAvailableSubjects(subjects.length > 0 ? subjects : ["Maths", "English", "Hindi", "Science", "Social Science"]);
            })
            .catch(() => setAvailableSubjects(["Maths", "English", "Hindi", "Science", "Social Science"]));
    }, []);

    useEffect(() => {
        fetchHeads();
    }, []);

    const fetchHeads = async () => {
        try {
            setLoading(true);
            const response = await authFetch(`${API_URL}/api/admin/heads`, {
                headers: getAuthHeader()
            });
            if (!response.ok) throw new Error("Failed to fetch heads");
            const data = await response.json();
            setHeads(data);
        } catch (err) {
            setError(err.message);
            setHeads([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAddHead = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            const dataToSend = {
                name: formData.name,
                email: formData.email,
                mobile: formData.mobile,
                age: formData.age ? parseInt(formData.age, 10) : null,
                subjects: [],
                assignment_type: formData.assignment_type,
                assigned_classes: formData.assignment_type === "class" ? formData.assigned_classes : [],
                assigned_subjects: formData.assignment_type === "subject" ? formData.assigned_subjects : []
            };
            const response = await authFetch(`${API_URL}/api/admin/heads`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...getAuthHeader() },
                body: JSON.stringify(dataToSend)
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Failed to add head");
            }
            const newHead = await response.json();
            if (newHead.generated_credentials) {
                setNewCredentials(newHead.generated_credentials);
                setShowCredentialsModal(true);
            }
            setHeads([newHead, ...heads]);
            setShowAddModal(false);
            resetForm();
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleEditHead = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            const dataToSend = {
                ...formData,
                assignment_type: formData.assignment_type,
                assigned_classes: formData.assignment_type === "class" ? formData.assigned_classes : [],
                assigned_subjects: formData.assignment_type === "subject" ? formData.assigned_subjects : []
            };
            if (dataToSend.age) dataToSend.age = parseInt(dataToSend.age, 10);

            const response = await authFetch(`${API_URL}/api/admin/heads/${selectedHead.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...getAuthHeader() },
                body: JSON.stringify(dataToSend)
            });
            if (!response.ok) throw new Error("Failed to update head");
            const updated = await response.json();
            setHeads(heads.map(h => h.id === selectedHead.id ? { ...h, ...updated } : h));
            setShowEditModal(false);
            setSelectedHead(null);
            resetForm();
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteHead = async (headId) => {
        if (!confirm("Are you sure you want to delete this head?")) return;
        try {
            const response = await authFetch(`${API_URL}/api/admin/heads/${headId}`, {
                method: "DELETE",
                headers: getAuthHeader()
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Failed to delete head");
            }
            setHeads(heads.filter(h => h.id !== headId));
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    const handleResetPassword = async (head) => {
        if (!confirm(`Reset password for ${head.name}?`)) return;
        try {
            const response = await authFetch(`${API_URL}/api/admin/heads/${head.id}/reset-password`, {
                method: "POST",
                headers: getAuthHeader()
            });
            if (!response.ok) throw new Error("Failed to reset password");
            const result = await response.json();
            setNewCredentials({
                user_id: head.user_id,
                password: result.new_password,
                note: "Password has been reset"
            });
            setShowCredentialsModal(true);
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    const resetForm = () => {
        setFormData({ name: "", email: "", mobile: "", age: "", assignment_type: "class", assigned_classes: [], assigned_subjects: [] });
    };

    const openEditModal = (head) => {
        setSelectedHead(head);
        setFormData({
            name: head.name,
            email: head.email,
            mobile: head.mobile || "",
            age: head.age || "",
            assignment_type: head.assignment_type || "class",
            assigned_classes: head.assigned_classes || [],
            assigned_subjects: head.assigned_subjects || []
        });
        setShowEditModal(true);
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert("Copied to clipboard!");
    };

    const filteredHeads = heads.filter(h =>
        h.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AdminLayout title="Head Management" icon={Shield}>
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    />
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition flex items-center gap-2 font-medium"
                >
                    <UserPlus className="w-4 h-4" /> Add New Head
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                            <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Total Heads</p>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{heads.length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{heads.filter(h => h.is_active !== false).length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                            <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Inactive</p>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{heads.filter(h => h.is_active === false).length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center">
                        <LoadingSpinner size="lg" text="Loading heads..." />
                    </div>
                ) : heads.length === 0 ? (
                    <div className="p-12 text-center">
                        <Shield className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">No heads found</p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition font-medium"
                        >
                            Add Your First Head
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Name</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">User ID</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Assignment</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Email</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredHeads.map((head) => (
                                    <tr key={head.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                                        <td className="px-6 py-4">
                                            <p className="font-medium text-gray-900 dark:text-white">{head.name}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded">{head.user_id}</code>
                                        </td>
                                        <td className="px-6 py-4">
                                            {head.assignment_type === "subject" ? (
                                                <div className="flex flex-wrap gap-1">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 mb-0.5">
                                                        <BookOpen className="w-3 h-3" /> Subject
                                                    </span>
                                                    {(head.assigned_subjects || []).map(s => (
                                                        <span key={s} className="px-2 py-0.5 rounded-full text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300">{s}</span>
                                                    ))}
                                                    {(!head.assigned_subjects || head.assigned_subjects.length === 0) && <span className="text-xs text-gray-400">None set</span>}
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap gap-1">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 mb-0.5">
                                                        <GraduationCap className="w-3 h-3" /> Class
                                                    </span>
                                                    {(head.assigned_classes || []).map(c => (
                                                        <span key={c} className="px-2 py-0.5 rounded-full text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300">Class {c}</span>
                                                    ))}
                                                    {(!head.assigned_classes || head.assigned_classes.length === 0) && <span className="text-xs text-gray-400">None set</span>}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-gray-600 dark:text-gray-300">{head.email}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${head.is_active !== false ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"}`}>
                                                {head.is_active !== false ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => openEditModal(head)}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-3.5 h-3.5" /> Edit
                                                </button>
                                                <button
                                                    onClick={() => handleResetPassword(head)}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                                                    title="Reset Password"
                                                >
                                                    <Key className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteHead(head.id)}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
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

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg mx-4 border dark:border-gray-700">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add New Head</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg flex items-start gap-2">
                            <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                            <span>User ID and Password will be auto-generated based on name. The head will be able to approve or reject teacher-created questions and papers.</span>
                        </p>
                        <form onSubmit={handleAddHead} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                                    placeholder="Head name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email *</label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                                    placeholder="email@example.com"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Mobile</label>
                                    <input
                                        type="tel"
                                        value={formData.mobile}
                                        onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                                        placeholder="10-digit number"
                                        maxLength={10}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Age</label>
                                    <input
                                        type="number"
                                        min={18}
                                        max={100}
                                        value={formData.age}
                                        onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                                        placeholder="Age"
                                    />
                                </div>
                            </div>

                            {/* Assignment Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assignment Type *</label>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, assignment_type: "class", assigned_subjects: [] })}
                                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition font-medium text-sm ${formData.assignment_type === "class" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" : "border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300"}`}
                                    >
                                        <GraduationCap className="w-4 h-4" /> By Class
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, assignment_type: "subject", assigned_classes: [] })}
                                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition font-medium text-sm ${formData.assignment_type === "subject" ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400" : "border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300"}`}
                                    >
                                        <BookOpen className="w-4 h-4" /> By Subject
                                    </button>
                                </div>
                            </div>

                            {/* Class Selection */}
                            {formData.assignment_type === "class" && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Classes</label>
                                    <div className="flex flex-wrap gap-2">
                                        {CLASSES.map(c => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => {
                                                    const updated = formData.assigned_classes.includes(c)
                                                        ? formData.assigned_classes.filter(x => x !== c)
                                                        : [...formData.assigned_classes, c];
                                                    setFormData({ ...formData, assigned_classes: updated });
                                                }}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${formData.assigned_classes.includes(c) ? "bg-blue-500 text-white border-blue-500" : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-300"}`}
                                            >
                                                Class {c}
                                            </button>
                                        ))}
                                    </div>
                                    {formData.assigned_classes.length === 0 && <p className="text-xs text-amber-500 mt-1">Select at least one class</p>}
                                </div>
                            )}

                            {/* Subject Selection */}
                            {formData.assignment_type === "subject" && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Subjects</label>
                                    <div className="flex flex-wrap gap-2">
                                        {availableSubjects.map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => {
                                                    const updated = formData.assigned_subjects.includes(s)
                                                        ? formData.assigned_subjects.filter(x => x !== s)
                                                        : [...formData.assigned_subjects, s];
                                                    setFormData({ ...formData, assigned_subjects: updated });
                                                }}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${formData.assigned_subjects.includes(s) ? "bg-purple-500 text-white border-purple-500" : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-purple-300"}`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                    {formData.assigned_subjects.length === 0 && <p className="text-xs text-amber-500 mt-1">Select at least one subject</p>}
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => { setShowAddModal(false); resetForm(); }}
                                    className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-gray-700 dark:text-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 font-medium"
                                >
                                    {saving ? "Adding..." : "Add Head"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg mx-4 border dark:border-gray-700">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-5">Edit Head</h2>
                        <form onSubmit={handleEditHead} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Name</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Mobile</label>
                                    <input
                                        type="tel"
                                        value={formData.mobile}
                                        onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                                        placeholder="10-digit number"
                                        maxLength={10}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Age</label>
                                    <input
                                        type="number"
                                        min={18}
                                        max={100}
                                        value={formData.age}
                                        onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                                        placeholder="Age"
                                    />
                                </div>
                            </div>

                            {/* Assignment Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assignment Type</label>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, assignment_type: "class", assigned_subjects: [] })}
                                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition font-medium text-sm ${formData.assignment_type === "class" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" : "border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300"}`}
                                    >
                                        <GraduationCap className="w-4 h-4" /> By Class
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, assignment_type: "subject", assigned_classes: [] })}
                                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition font-medium text-sm ${formData.assignment_type === "subject" ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400" : "border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300"}`}
                                    >
                                        <BookOpen className="w-4 h-4" /> By Subject
                                    </button>
                                </div>
                            </div>

                            {formData.assignment_type === "class" && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Classes</label>
                                    <div className="flex flex-wrap gap-2">
                                        {CLASSES.map(c => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => {
                                                    const updated = formData.assigned_classes.includes(c)
                                                        ? formData.assigned_classes.filter(x => x !== c)
                                                        : [...formData.assigned_classes, c];
                                                    setFormData({ ...formData, assigned_classes: updated });
                                                }}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${formData.assigned_classes.includes(c) ? "bg-blue-500 text-white border-blue-500" : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-300"}`}
                                            >
                                                Class {c}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {formData.assignment_type === "subject" && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Subjects</label>
                                    <div className="flex flex-wrap gap-2">
                                        {availableSubjects.map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => {
                                                    const updated = formData.assigned_subjects.includes(s)
                                                        ? formData.assigned_subjects.filter(x => x !== s)
                                                        : [...formData.assigned_subjects, s];
                                                    setFormData({ ...formData, assigned_subjects: updated });
                                                }}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${formData.assigned_subjects.includes(s) ? "bg-purple-500 text-white border-purple-500" : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-purple-300"}`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => { setShowEditModal(false); setSelectedHead(null); resetForm(); }}
                                    className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-gray-700 dark:text-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 font-medium"
                                >
                                    {saving ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Credentials Modal */}
            {showCredentialsModal && newCredentials && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md mx-4 border dark:border-gray-700">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Credentials Generated</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Share these with the head</p>
                        </div>
                        <div className="space-y-4 mb-6">
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">User ID</p>
                                <div className="flex items-center justify-between">
                                    <code className="font-mono text-lg font-semibold text-gray-900 dark:text-white">{newCredentials.user_id}</code>
                                    <button onClick={() => copyToClipboard(newCredentials.user_id)} className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg">
                                        <Clipboard className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Password</p>
                                <div className="flex items-center justify-between">
                                    <code className="font-mono text-lg font-semibold text-gray-900 dark:text-white">{newCredentials.password}</code>
                                    <button onClick={() => copyToClipboard(newCredentials.password)} className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg">
                                        <Clipboard className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-4">{newCredentials.note}</p>
                        <button
                            onClick={() => { setShowCredentialsModal(false); setNewCredentials(null); }}
                            className="w-full px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 font-medium transition"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
