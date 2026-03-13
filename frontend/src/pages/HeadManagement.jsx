
import React, { useState, useEffect } from "react";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import LoadingSpinner from "../components/LoadingSpinner";
import { Shield, Search, UserPlus, Edit, Trash2, Key, CheckCircle, Clipboard, BookOpen, GraduationCap, User, X, Info } from "lucide-react";
import { CLASSES } from "../constants/academicConstants";
import authFetch from "../utils/authFetch";

const API_URL = import.meta.env.VITE_API_URL;

function parseApiError(detail, fallback) {
    if (!detail) return fallback;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
        const msgs = detail
            .map((item) => item?.msg || item?.message)
            .filter(Boolean);
        return msgs.length ? msgs.join(", ") : fallback;
    }
    if (typeof detail === "object") return detail.message || fallback;
    return fallback;
}

export default function HeadManagement() {
    const { getAuthHeader } = useUserStore();
    const [heads, setHeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [infoMessage, setInfoMessage] = useState(null);
    const [selectedHead, setSelectedHead] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [saving, setSaving] = useState(false);

    // Available teachers for the Add modal
    const [availableTeachers, setAvailableTeachers] = useState([]);
    const [teacherSearch, setTeacherSearch] = useState("");

    // Available subjects from curriculum API
    const [availableSubjects, setAvailableSubjects] = useState([]);

    // Add form: pick a teacher + assign classes/subjects
    const [addForm, setAddForm] = useState({
        teacher_id: "",
        assigned_classes: [],
        assigned_subjects: [],
    });

    // Edit form: update assignments + active status
    const [editForm, setEditForm] = useState({
        assigned_classes: [],
        assigned_subjects: [],
        is_active: true,
    });

    useEffect(() => {
        fetchHeads();
        loadTeachers();
        loadSubjects();
    }, []);

    const loadTeachers = async () => {
        try {
            const resp = await authFetch(`${API_URL}/api/admin/teachers?is_active=true&limit=500`, {
                headers: getAuthHeader()
            });
            if (resp.ok) {
                const data = await resp.json();
                // Only show pure teachers (not already promoted to head) in the picker
                const pureTeachers = (Array.isArray(data) ? data : []).filter(t => t.role !== "head");
                setAvailableTeachers(pureTeachers);
            }
        } catch {
            setAvailableTeachers([]);
        }
    };

    const loadSubjects = async () => {
        try {
            const resp = await authFetch(`${API_URL}/api/curriculum/subjects?is_active=true`, {
                headers: getAuthHeader()
            });
            if (resp.ok) {
                const data = await resp.json();
                const subjects = [...new Set(
                    (Array.isArray(data) ? data : (data.subjects || []))
                        .map(s => s.subject_name || s.name || s)
                        .filter(Boolean)
                )].sort();
                setAvailableSubjects(subjects.length > 0 ? subjects : ["Maths", "English", "Hindi", "Science", "Social Science"]);
            } else {
                setAvailableSubjects(["Maths", "English", "Hindi", "Science", "Social Science"]);
            }
        } catch {
            setAvailableSubjects(["Maths", "English", "Hindi", "Science", "Social Science"]);
        }
    };

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
        if (!addForm.teacher_id) return alert("Please select a teacher to designate as head.");
        if (addForm.assigned_classes.length === 0 && addForm.assigned_subjects.length === 0) {
            return alert("Please assign at least one class or subject to this head.");
        }
        try {
            setSaving(true);
            const payload = {
                teacher_id: String(addForm.teacher_id || "").trim(),
                assigned_classes: addForm.assigned_classes
                    .map((c) => Number(c))
                    .filter((c) => Number.isInteger(c) && c >= 1 && c <= 12),
                assigned_subjects: addForm.assigned_subjects
                    .map((s) => String(s).trim())
                    .filter(Boolean),
            };

            const response = await authFetch(`${API_URL}/api/admin/heads`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...getAuthHeader() },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(parseApiError(err.detail, "Failed to designate head"));
            }
            const newHead = await response.json();
            setHeads([newHead, ...heads]);
            setShowAddModal(false);
            resetAddForm();
            setInfoMessage({
                title: "Head Designated Successfully",
                user_id: newHead.user_id,
                name: newHead.name,
                note: newHead.note || `${newHead.name} can now log in with their existing credentials.`
            });
            setShowInfoModal(true);
            // Reload teachers to exclude the promoted one
            loadTeachers();
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleEditHead = async (e) => {
        e.preventDefault();
        if (editForm.assigned_classes.length === 0 && editForm.assigned_subjects.length === 0) {
            return alert("Please assign at least one class or subject.");
        }
        try {
            setSaving(true);
            const response = await authFetch(`${API_URL}/api/admin/heads/${selectedHead.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...getAuthHeader() },
                body: JSON.stringify({
                    assigned_classes: editForm.assigned_classes,
                    assigned_subjects: editForm.assigned_subjects,
                    is_active: editForm.is_active,
                })
            });
            if (!response.ok) throw new Error("Failed to update head");
            const updated = await response.json();
            setHeads(heads.map(h => h.id === selectedHead.id ? { ...h, ...updated } : h));
            setShowEditModal(false);
            setSelectedHead(null);
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveHead = async (head) => {
        const isPromoted = head.promoted_from_teacher;
        const msg = isPromoted
            ? `Remove ${head.name} as head? They will be demoted back to teacher.`
            : `Delete head ${head.name}? This cannot be undone.`;
        if (!confirm(msg)) return;
        try {
            const response = await authFetch(`${API_URL}/api/admin/heads/${head.id}`, {
                method: "DELETE",
                headers: getAuthHeader()
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Failed to remove head");
            }
            const result = await response.json();
            setHeads(heads.filter(h => h.id !== head.id));
            if (result.demoted) loadTeachers(); // Back to teacher pool
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
            setInfoMessage({
                title: "Password Reset",
                user_id: head.user_id,
                name: head.name,
                password: result.new_password,
                note: "Share the new password with the head."
            });
            setShowInfoModal(true);
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    const resetAddForm = () => {
        setAddForm({ teacher_id: "", assigned_classes: [], assigned_subjects: [] });
        setTeacherSearch("");
    };

    const openEditModal = (head) => {
        setSelectedHead(head);
        setEditForm({
            assigned_classes: head.assigned_classes || [],
            assigned_subjects: head.assigned_subjects || [],
            is_active: head.is_active !== false,
        });
        setShowEditModal(true);
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    const filteredHeads = heads.filter(h =>
        h.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.user_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredTeachers = availableTeachers.filter(t =>
        t.name?.toLowerCase().includes(teacherSearch.toLowerCase()) ||
        t.email?.toLowerCase().includes(teacherSearch.toLowerCase()) ||
        t.user_id?.toLowerCase().includes(teacherSearch.toLowerCase())
    );

    const selectedTeacher = availableTeachers.find(t => t.id === addForm.teacher_id);

    // Toggle helper for class/subject selection
    const toggleClass = (c, form, setForm) => {
        const updated = form.assigned_classes.includes(c)
            ? form.assigned_classes.filter(x => x !== c)
            : [...form.assigned_classes, c];
        setForm({ ...form, assigned_classes: updated });
    };

    const toggleSubject = (s, form, setForm) => {
        const updated = form.assigned_subjects.includes(s)
            ? form.assigned_subjects.filter(x => x !== s)
            : [...form.assigned_subjects, s];
        setForm({ ...form, assigned_subjects: updated });
    };

    // Shared assignment section JSX
    const AssignmentSection = ({ form, setForm }) => (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Assign Classes
                    <span className="ml-2 text-xs font-normal text-gray-500">({form.assigned_classes.length} selected)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                    {CLASSES.map(c => (
                        <button
                            key={c}
                            type="button"
                            onClick={() => toggleClass(c, form, setForm)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                                form.assigned_classes.includes(c)
                                    ? "bg-blue-500 text-white border-blue-500"
                                    : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-300"
                            }`}
                        >
                            Class {c}
                        </button>
                    ))}
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Assign Subjects
                    <span className="ml-2 text-xs font-normal text-gray-500">({form.assigned_subjects.length} selected)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                    {availableSubjects.map(s => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => toggleSubject(s, form, setForm)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                                form.assigned_subjects.includes(s)
                                    ? "bg-purple-500 text-white border-purple-500"
                                    : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-purple-300"
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>
            {form.assigned_classes.length === 0 && form.assigned_subjects.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">Assign at least one class or subject</p>
            )}
        </div>
    );

    return (
        <AdminLayout title="Head Management" icon={Shield}>
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search by name, email or user ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    />
                </div>
                <button
                    onClick={() => { resetAddForm(); setShowAddModal(true); }}
                    className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition flex items-center gap-2 font-medium"
                >
                    <UserPlus className="w-4 h-4" /> Designate Head
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
                        <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                            <User className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">From Teachers</p>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{heads.filter(h => h.promoted_from_teacher).length}</p>
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
                        <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">No heads designated yet</p>
                        <p className="text-gray-400 dark:text-gray-500 text-sm mb-6">Select a teacher to designate as head</p>
                        <button
                            onClick={() => { resetAddForm(); setShowAddModal(true); }}
                            className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition font-medium"
                        >
                            Designate First Head
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Name</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">User ID</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Classes</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Subjects</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredHeads.map((head) => (
                                    <tr key={head.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">{head.name}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{head.email}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded">{head.user_id}</code>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1 max-w-[160px]">
                                                {(head.assigned_classes || []).length > 0 ? (
                                                    (head.assigned_classes || []).map(c => (
                                                        <span key={c} className="px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">C{c}</span>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-gray-400">—</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                {(head.assigned_subjects || []).length > 0 ? (
                                                    (head.assigned_subjects || []).map(s => (
                                                        <span key={s} className="px-2 py-0.5 rounded-full text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">{s}</span>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-gray-400">—</span>
                                                )}
                                            </div>
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
                                                    title="Edit assignments"
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
                                                    onClick={() => handleRemoveHead(head)}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                                    title={head.promoted_from_teacher ? "Demote to teacher" : "Delete head"}
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

            {/* ── Designate Head Modal ── */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-xl mx-auto border dark:border-gray-700 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700 flex-shrink-0">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Designate Head</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Select a teacher to promote as head</p>
                            </div>
                            <button onClick={() => { setShowAddModal(false); resetAddForm(); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="overflow-y-auto flex-1 p-6">
                            <form onSubmit={handleAddHead} id="add-head-form" className="space-y-5">
                                {/* Step 1: Select Teacher */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                        <span className="inline-flex items-center gap-1.5">
                                            <User className="w-4 h-4" /> Select Teacher *
                                        </span>
                                    </label>
                                    <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                                        <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search teachers by name or email..."
                                                    value={teacherSearch}
                                                    onChange={e => setTeacherSearch(e.target.value)}
                                                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-400"
                                                />
                                            </div>
                                        </div>
                                        <div className="max-h-44 overflow-y-auto">
                                            {availableTeachers.length === 0 ? (
                                                <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                                                    No teachers available
                                                </div>
                                            ) : filteredTeachers.length === 0 ? (
                                                <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                                                    No teachers match "{teacherSearch}"
                                                </div>
                                            ) : (
                                                filteredTeachers.map(teacher => (
                                                    <label
                                                        key={teacher.id}
                                                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition ${addForm.teacher_id === teacher.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name="teacher_select"
                                                            value={teacher.id}
                                                            checked={addForm.teacher_id === teacher.id}
                                                            onChange={() => setAddForm({ ...addForm, teacher_id: teacher.id })}
                                                            className="w-4 h-4 text-blue-600 border-gray-300"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{teacher.name}</p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                                {teacher.user_id}
                                                                {teacher.email ? ` • ${teacher.email}` : ""}
                                                            </p>
                                                            {teacher.subjects?.length > 0 && (
                                                                <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">{teacher.subjects.join(", ")}</p>
                                                            )}
                                                        </div>
                                                    </label>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                    {selectedTeacher && (
                                        <div className="mt-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-300">
                                            Selected: <strong>{selectedTeacher.name}</strong> ({selectedTeacher.user_id})
                                        </div>
                                    )}
                                    {!addForm.teacher_id && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Select a teacher to designate as head</p>
                                    )}
                                </div>

                                <hr className="border-gray-200 dark:border-gray-700" />

                                {/* Step 2: Assign Classes & Subjects */}
                                <AssignmentSection form={addForm} setForm={setAddForm} />
                            </form>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t dark:border-gray-700 flex gap-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => { setShowAddModal(false); resetAddForm(); }}
                                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-gray-700 dark:text-gray-300"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="add-head-form"
                                disabled={saving}
                                className="flex-1 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 font-medium"
                            >
                                {saving ? "Designating..." : "Designate as Head"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Edit Head Modal ── */}
            {showEditModal && selectedHead && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-xl mx-auto border dark:border-gray-700 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700 flex-shrink-0">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Head</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{selectedHead.name} ({selectedHead.user_id})</p>
                            </div>
                            <button onClick={() => { setShowEditModal(false); setSelectedHead(null); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="overflow-y-auto flex-1 p-6">
                            <form onSubmit={handleEditHead} id="edit-head-form" className="space-y-5">
                                {/* Assignment */}
                                <AssignmentSection form={editForm} setForm={setEditForm} />

                                <hr className="border-gray-200 dark:border-gray-700" />

                                {/* Active Status */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Account Status</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Disable to temporarily restrict access</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setEditForm({ ...editForm, is_active: !editForm.is_active })}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.is_active ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${editForm.is_active ? "translate-x-6" : "translate-x-1"}`} />
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t dark:border-gray-700 flex gap-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => { setShowEditModal(false); setSelectedHead(null); }}
                                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-gray-700 dark:text-gray-300"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="edit-head-form"
                                disabled={saving}
                                className="flex-1 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 font-medium"
                            >
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Info Modal (after designation or reset) ── */}
            {showInfoModal && infoMessage && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md mx-auto border dark:border-gray-700">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{infoMessage.title}</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{infoMessage.name}</p>
                        </div>

                        <div className="space-y-3 mb-6">
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">User ID</p>
                                <div className="flex items-center justify-between">
                                    <code className="font-mono text-base font-semibold text-gray-900 dark:text-white">{infoMessage.user_id}</code>
                                    <button onClick={() => copyToClipboard(infoMessage.user_id)} className="p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg" title="Copy">
                                        <Clipboard className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            {infoMessage.password && (
                                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">New Password</p>
                                    <div className="flex items-center justify-between">
                                        <code className="font-mono text-base font-semibold text-gray-900 dark:text-white">{infoMessage.password}</code>
                                        <button onClick={() => copyToClipboard(infoMessage.password)} className="p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg" title="Copy">
                                            <Clipboard className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 mb-5 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                            <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
                            <span>{infoMessage.note}</span>
                        </div>

                        <button
                            onClick={() => { setShowInfoModal(false); setInfoMessage(null); }}
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

