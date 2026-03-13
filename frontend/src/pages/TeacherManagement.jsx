
import React, { useState, useEffect } from "react";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import LoadingSpinner from "../components/LoadingSpinner";
import { GraduationCap, Shield, Search, UserPlus, Edit, Trash2, Key, CheckCircle, Clipboard, Lightbulb, Users, ChevronDown, ChevronUp, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
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

export default function TeacherManagement() {
    const { getAuthHeader } = useUserStore();
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showCredentialsModal, setShowCredentialsModal] = useState(false);
    const [newCredentials, setNewCredentials] = useState(null);
    const [selectedTeacher, setSelectedTeacher] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [saving, setSaving] = useState(false);
    const [expandedTeacherGroups, setExpandedTeacherGroups] = useState({});
    const [teacherGroupConflict, setTeacherGroupConflict] = useState(null);

    // Promote to Head
    const [showPromoteModal, setShowPromoteModal] = useState(false);
    const [promoteTeacher, setPromoteTeacher] = useState(null);
    const [promoteForm, setPromoteForm] = useState({ assigned_classes: [], assigned_subjects: [] });
    const [availableSubjects, setAvailableSubjects] = useState([]);

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        mobile: "",
        age: "",
        preferred_subject: ""
    });

    const [curriculumSubjects, setCurriculumSubjects] = useState([]);
    const [loadingCurriculum, setLoadingCurriculum] = useState(true);
    const currSubjectNames = [...new Set(curriculumSubjects.map(s => s.subject_name))].sort();

    useEffect(() => {
        fetchTeachers();
        fetchCurriculumSubjects();
        fetchAvailableSubjects();
    }, []);

    useEffect(() => {
        const handleFocus = () => {
            fetchTeachers();
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, []);

    const fetchTeachers = async () => {
        try {
            setLoading(true);
            const response = await authFetch(`${API_URL}/api/admin/teachers`, {
                headers: getAuthHeader()
            });
            if (!response.ok) throw new Error("Failed to fetch teachers");
            const data = await response.json();
            setTeachers(data);
        } catch (err) {
            setError(err.message);
            setTeachers([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchCurriculumSubjects = async () => {
        setLoadingCurriculum(true);
        try {
            const response = await authFetch(`${API_URL}/api/curriculum/subjects?is_active=true`, {
                headers: getAuthHeader()
            });
            if (response.ok) {
                const data = await response.json();
                setCurriculumSubjects(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error("Failed to fetch curriculum:", err);
        } finally {
            setLoadingCurriculum(false);
        }
    };

    const fetchAvailableSubjects = async () => {
        try {
            const response = await authFetch(`${API_URL}/api/curriculum/subjects?is_active=true`, {
                headers: getAuthHeader()
            });
            if (response.ok) {
                const data = await response.json();
                const items = (Array.isArray(data) ? data : (data.subjects || []))
                    .filter(s => s.subject_name && s.class_level != null);
                setAvailableSubjects(items);
            }
        } catch {
            setAvailableSubjects([]);
        }
    };

    const handleAddTeacher = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            const dataToSend = { ...formData, age: parseInt(formData.age, 10) };
            const response = await authFetch(`${API_URL}/api/admin/teachers`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...getAuthHeader() },
                body: JSON.stringify(dataToSend)
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Failed to add teacher");
            }
            const newTeacher = await response.json();
            if (newTeacher.generated_credentials) {
                setNewCredentials(newTeacher.generated_credentials);
                setShowCredentialsModal(true);
            }
            setTeachers([newTeacher, ...teachers]);
            setShowAddModal(false);
            resetForm();
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleEditTeacher = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            const dataToSend = { ...formData };
            if (dataToSend.age) dataToSend.age = parseInt(dataToSend.age, 10);

            const response = await authFetch(`${API_URL}/api/admin/teachers/${selectedTeacher.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...getAuthHeader() },
                body: JSON.stringify(dataToSend)
            });
            if (!response.ok) throw new Error("Failed to update teacher");
            const updated = await response.json();
            setTeachers(teachers.map(t => t.id === selectedTeacher.id ? updated : t));
            setShowEditModal(false);
            setSelectedTeacher(null);
            resetForm();
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTeacher = async (teacherId) => {
        const teacher = teachers.find(t => t.id === teacherId);

        if (teacher && teacher.group_count > 0) {
            setTeacherGroupConflict({ teacherName: teacher.name, groups: teacher.group_names || [] });
            return;
        }

        if (!confirm("Are you sure you want to delete this teacher?")) return;

        const deletedTeacher = teacher;
        const updatedTeachers = teachers.filter(t => t.id !== teacherId);
        setTeachers(updatedTeachers);

        try {
            const response = await authFetch(`${API_URL}/api/admin/teachers/${teacherId}`, {
                method: "DELETE",
                headers: getAuthHeader()
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 409 && errorData.detail?.groups) {
                    setTeachers(prev => [...prev.filter(t => t.id !== teacherId), deletedTeacher]);
                    setTeacherGroupConflict({ teacherName: deletedTeacher?.name || "This teacher", groups: errorData.detail.groups });
                    return;
                }
                throw new Error(errorData.detail?.message || errorData.detail || "Failed to delete teacher");
            }
        } catch (err) {
            alert("Error: " + err.message);
            setTeachers(prev => [...prev.filter(t => t.id !== teacherId), deletedTeacher]);
        }
    };

    const handleResetPassword = async (teacher) => {
        if (!confirm(`Reset password for ${teacher.name}?`)) return;
        try {
            const response = await authFetch(`${API_URL}/api/admin/teachers/${teacher.id}/reset-password`, {
                method: "POST",
                headers: getAuthHeader()
            });
            if (!response.ok) throw new Error("Failed to reset password");
            const result = await response.json();
            setNewCredentials({
                user_id: teacher.user_id,
                password: result.new_password,
                note: "Password has been reset"
            });
            setShowCredentialsModal(true);
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    const resetForm = () => {
        setFormData({ name: "", email: "", mobile: "", age: "", preferred_subject: "" });
    };

    const openPromoteModal = (teacher) => {
        setPromoteTeacher(teacher);
        setPromoteForm({ assigned_classes: [], assigned_subjects: [] });
        setShowPromoteModal(true);
    };

    const handlePromoteToHead = async () => {
        if (!promoteForm.assigned_classes.length && !promoteForm.assigned_subjects.length) {
            alert("Please assign at least one class or subject.");
            return;
        }
        try {
            setSaving(true);
            const payload = {
                teacher_id: String(promoteTeacher.id || promoteTeacher.user_id || "").trim(),
                assigned_classes: promoteForm.assigned_classes
                    .map((c) => Number(c))
                    .filter((c) => Number.isInteger(c) && c >= 1 && c <= 12),
                assigned_subjects: promoteForm.assigned_subjects
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
                throw new Error(parseApiError(err.detail, "Failed to promote teacher"));
            }
            setShowPromoteModal(false);
            setPromoteTeacher(null);
            fetchTeachers();
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDemoteToTeacher = async (teacher) => {
        if (!confirm(`Demote ${teacher.name} back to teacher? Their head assignments will be removed.`)) return;
        try {
            const response = await authFetch(`${API_URL}/api/admin/heads/${teacher.id}`, {
                method: "DELETE",
                headers: getAuthHeader()
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Failed to demote");
            }
            fetchTeachers();
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    const togglePromoteClass = (cls) => {
        setPromoteForm(f => {
            const newClasses = f.assigned_classes.includes(cls)
                ? f.assigned_classes.filter(c => c !== cls)
                : [...f.assigned_classes, cls];
            const validSubjects = new Set(
                availableSubjects
                    .filter(s => newClasses.includes(s.class_level))
                    .map(s => s.subject_name)
            );
            return {
                assigned_classes: newClasses,
                assigned_subjects: f.assigned_subjects.filter(s => validSubjects.has(s))
            };
        });
    };

    const togglePromoteSubject = (sub) => {
        setPromoteForm(f => ({
            ...f,
            assigned_subjects: f.assigned_subjects.includes(sub)
                ? f.assigned_subjects.filter(s => s !== sub)
                : [...f.assigned_subjects, sub]
        }));
    };

    const openEditModal = (teacher) => {
        setSelectedTeacher(teacher);
        setFormData({
            name: teacher.name,
            email: teacher.email,
            mobile: teacher.mobile || "",
            age: teacher.age || "",
            preferred_subject: teacher.preferred_subject || ""
        });
        setShowEditModal(true);
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert("Copied to clipboard!");
    };

    const filteredTeachers = teachers.filter(t =>
        t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AdminLayout title="Teacher Management" icon={GraduationCap}>
            {}
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
                    <UserPlus className="w-4 h-4" /> Add New Teacher
                </button>
            </div>

            {}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900/30 rounded-lg flex items-center justify-center">
                            <GraduationCap className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Total Teachers</p>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{teachers.length}</p>
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
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{teachers.filter(t => t.is_active !== false).length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                            <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">With Groups</p>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{teachers.filter(t => t.group_count > 0).length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                            <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Subjects</p>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{[...new Set(teachers.map(t => t.preferred_subject))].length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Teachers Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center">
                        <LoadingSpinner size="lg" text="Loading teachers…" />
                    </div>
                ) : teachers.length === 0 ? (
                    <div className="p-12 text-center">
                        <GraduationCap className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">No teachers found</p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition font-medium"
                        >
                            Add Your First Teacher
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Name</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Email</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Role</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Assigned Groups</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Created</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredTeachers.map((teacher) => (
                                    <tr key={teacher.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                                        <td className="px-6 py-4">
                                            <p className="font-medium text-gray-900 dark:text-white">{teacher.name}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-gray-600 dark:text-gray-300">{teacher.email}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            {teacher.role === "head" ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                                                    <Shield className="w-3 h-3" /> Head
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
                                                    <GraduationCap className="w-3 h-3" /> Teacher
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {teacher.group_names && teacher.group_names.length > 0 ? (
                                                <div>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-sm px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md font-medium">
                                                            {teacher.group_names[0]}
                                                        </span>
                                                        {teacher.group_names.length > 1 && (
                                                            <button
                                                                onClick={() => setExpandedTeacherGroups(prev => ({ ...prev, [teacher.id]: !prev[teacher.id] }))}
                                                                className="text-xs px-1.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition flex items-center gap-0.5"
                                                            >
                                                                +{teacher.group_names.length - 1}
                                                                {expandedTeacherGroups[teacher.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                            </button>
                                                        )}
                                                    </div>
                                                    {expandedTeacherGroups[teacher.id] && teacher.group_names.length > 1 && (
                                                        <div className="mt-1.5 flex flex-col gap-1">
                                                            {teacher.group_names.slice(1).map((gn, i) => (
                                                                <span key={i} className="text-sm px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md font-medium w-fit">
                                                                    {gn}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400 dark:text-gray-500 italic">No groups assigned</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                                {teacher.created_at ? new Date(teacher.created_at).toLocaleDateString() : "-"}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            {teacher.role === "head" ? (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleDemoteToTeacher(teacher)}
                                                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition"
                                                    >
                                                        <ArrowDownCircle className="w-3.5 h-3.5" /> Demote
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2 flex-wrap">
                                                    <button
                                                        onClick={() => openEditModal(teacher)}
                                                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                                                    >
                                                        <Edit className="w-3.5 h-3.5" /> Edit
                                                    </button>
                                                    <button
                                                        onClick={() => openPromoteModal(teacher)}
                                                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition"
                                                    >
                                                        <ArrowUpCircle className="w-3.5 h-3.5" /> Promote
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteTeacher(teacher.id)}
                                                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" /> Delete
                                                    </button>
                                                </div>
                                            )}
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
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add New Teacher</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg flex items-start gap-2">
                            <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                            <span>User ID and Password will be auto-generated based on name.</span>
                        </p>
                        <form onSubmit={handleAddTeacher} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                                    placeholder="Teacher name"
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
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Mobile Number *</label>
                                    <input
                                        type="tel"
                                        required
                                        value={formData.mobile}
                                        onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                                        placeholder="10-digit number"
                                        pattern="[0-9]{10}"
                                        maxLength={10}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Age *</label>
                                    <input
                                        type="number"
                                        required
                                        min={18}
                                        max={100}
                                        value={formData.age}
                                        onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                                        placeholder="Age"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Subject</label>
                                <select
                                    value={formData.preferred_subject}
                                    onChange={(e) => setFormData({ ...formData, preferred_subject: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                                >
                                    <option value="">Select Subject</option>
                                    {loadingCurriculum ? (
                                        <option disabled>Loading...</option>
                                    ) : (
                                        currSubjectNames.map(s => <option key={s} value={s}>{s}</option>)
                                    )}
                                </select>
                            </div>
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
                                    {saving ? "Adding..." : "Add Teacher"}
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
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-5">Edit Teacher</h2>
                        <form onSubmit={handleEditTeacher} className="space-y-4">
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
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Mobile Number</label>
                                    <input
                                        type="tel"
                                        required
                                        value={formData.mobile}
                                        onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                                        placeholder="10-digit number"
                                        pattern="[0-9]{10}"
                                        maxLength={10}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Age</label>
                                    <input
                                        type="number"
                                        required
                                        min={18}
                                        max={100}
                                        value={formData.age}
                                        onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                                        placeholder="Age"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Subject</label>
                                <select
                                    value={formData.preferred_subject}
                                    onChange={(e) => setFormData({ ...formData, preferred_subject: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                                >
                                    <option value="">Select Subject</option>
                                    {loadingCurriculum ? (
                                        <option disabled>Loading...</option>
                                    ) : (
                                        currSubjectNames.map(s => <option key={s} value={s}>{s}</option>)
                                    )}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => { setShowEditModal(false); setSelectedTeacher(null); resetForm(); }}
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

            {/* Teacher Group Conflict Modal */}
            {teacherGroupConflict && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md mx-4 border dark:border-gray-700">
                        <div className="flex items-start gap-4 mb-5">
                            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                                <Users className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Cannot Delete Teacher</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">{teacherGroupConflict.teacherName}</span> is assigned to the following group{teacherGroupConflict.groups.length !== 1 ? "s" : ""}. Please remove them from all groups before deleting.
                                </p>
                            </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-5">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Assigned Groups</p>
                            <ul className="space-y-2">
                                {teacherGroupConflict.groups.map((g, i) => (
                                    <li key={i} className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                                        <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0"></span>
                                        {g}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <button
                            onClick={() => setTeacherGroupConflict(null)}
                            className="w-full px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 font-medium transition"
                        >
                            OK, Got It
                        </button>
                    </div>
                </div>
            )}

            {/* Promote to Head Modal */}
            {showPromoteModal && promoteTeacher && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg mx-4 border dark:border-gray-700 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Promote to Head</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    <span className="font-medium text-amber-600 dark:text-amber-400">{promoteTeacher.name}</span> will be designated as a Head
                                </p>
                            </div>
                            <button onClick={() => setShowPromoteModal(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
                        </div>

                        <div className="mb-5">
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                Assign Classes <span className="font-normal text-gray-400">({promoteForm.assigned_classes.length} selected)</span>
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {CLASSES.map(cls => (
                                    <button
                                        key={cls}
                                        type="button"
                                        onClick={() => togglePromoteClass(cls)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                                            promoteForm.assigned_classes.includes(cls)
                                                ? "bg-amber-500 text-white"
                                                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                                        }`}
                                    >
                                        Class {cls}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mb-6">
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                Assign Subjects <span className="font-normal text-gray-400">({promoteForm.assigned_subjects.length} selected)</span>
                            </p>
                            {promoteForm.assigned_classes.length === 0 ? (
                                <p className="text-sm text-gray-400 dark:text-gray-500 italic">Select classes above to see available subjects</p>
                            ) : (() => {
                                const filtered = [...new Set(
                                    availableSubjects
                                        .filter(s => promoteForm.assigned_classes.includes(s.class_level))
                                        .map(s => s.subject_name)
                                )].sort();
                                return filtered.length === 0 ? (
                                    <p className="text-sm text-gray-400 dark:text-gray-500 italic">No subjects found for selected classes</p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {filtered.map(sub => (
                                            <button
                                                key={sub}
                                                type="button"
                                                onClick={() => togglePromoteSubject(sub)}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                                                    promoteForm.assigned_subjects.includes(sub)
                                                        ? "bg-amber-500 text-white"
                                                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                                                }`}
                                            >
                                                {sub}
                                            </button>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowPromoteModal(false)}
                                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-gray-700 dark:text-gray-300"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handlePromoteToHead}
                                disabled={saving}
                                className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg disabled:opacity-50 font-medium transition flex items-center justify-center gap-2"
                            >
                                <ArrowUpCircle className="w-4 h-4" />
                                {saving ? "Promoting..." : "Promote to Head"}
                            </button>
                        </div>
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
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Share these with the teacher</p>
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
