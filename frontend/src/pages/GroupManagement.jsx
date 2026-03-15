
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import LoadingSpinner from "../components/LoadingSpinner";
import { Trash2, Users, UserPlus, FolderKanban, Search, X, Check, Plus, BookOpen, Shield } from "lucide-react";
import { getCombinedClassSubjectOptions, parseCombinedValue, createCombinedValue } from "../constants/academicConstants";
import authFetch from "../utils/authFetch";

import { useToast } from "../contexts/ToastContext";
const API_URL = import.meta.env.VITE_API_URL;

export default function GroupManagement() {
  const { toast } = useToast();
    const navigate = useNavigate();
    const { getAuthHeader } = useUserStore();
    const [groups, setGroups] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [curriculumSubjects, setCurriculumSubjects] = useState([]); 
    const [loadingCurriculum, setLoadingCurriculum] = useState(true);

    const [showAddGroup, setShowAddGroup] = useState(false);
    const [showAssignStudents, setShowAssignStudents] = useState(false);

    const [selectedGroup, setSelectedGroup] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [saving, setSaving] = useState(false);

    const [availableStudents, setAvailableStudents] = useState([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [studentSearchTerm, setStudentSearchTerm] = useState("");
    const [studentClassFilter, setStudentClassFilter] = useState("");

    const [teacherSearchTerm, setTeacherSearchTerm] = useState("");

    const [savingFeatures, setSavingFeatures] = useState(false);

    const featureLabels = {
        ai_chatbot: "AI Chatbot",
        test_center: "Test Center",
        my_grades: "My Grades",
        book_to_bot: "Book to Bot",
        book_to_bot_doubt: "Book to Bot Doubt Button"
    };

    const featureDefaults = {
        ai_chatbot: false,
        test_center: false,
        my_grades: false,
        book_to_bot: true,
        book_to_bot_doubt: false
    };

    const handleToggleGroupFeature = async (groupId, featureKey, newValue) => {
        // Optimistic update
        setGroups(prev => prev.map(g => {
            if (g.id === groupId) {
                return { ...g, feature_flags: { ...g.feature_flags, [featureKey]: newValue } };
            }
            return g;
        }));
        if (selectedGroup?.id === groupId) {
            setSelectedGroup(prev => ({
                ...prev,
                feature_flags: { ...prev.feature_flags, [featureKey]: newValue }
            }));
        }

        try {
            const response = await authFetch(`${API_URL}/api/admin/groups/${groupId}/features`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...getAuthHeader() },
                body: JSON.stringify({ [featureKey]: newValue })
            });
            if (!response.ok) throw new Error("Failed to update feature");
        } catch (err) {
            // Revert on error
            setGroups(prev => prev.map(g => {
                if (g.id === groupId) {
                    return { ...g, feature_flags: { ...g.feature_flags, [featureKey]: !newValue } };
                }
                return g;
            }));
            if (selectedGroup?.id === groupId) {
                setSelectedGroup(prev => ({
                    ...prev,
                    feature_flags: { ...prev.feature_flags, [featureKey]: !newValue }
                }));
            }
            toast.error("Error: " + err.message)
        }
    };

    const [groupForm, setGroupForm] = useState({
        teacher_ids: [],
        classSubject: "",  
        batch_year: ""
    });

    useEffect(() => {
        fetchGroups();
        fetchTeachers();
        fetchAvailableStudents();
        fetchCurriculumSubjects();
    }, []);

    useEffect(() => {
        const handleFocus = () => {
            fetchGroups();
            fetchAvailableStudents();
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, []);

    const fetchGroups = async () => {
        try {
            setLoading(true);
            const response = await authFetch(`${API_URL}/api/admin/groups`, { headers: getAuthHeader() });
            if (response.ok) {
                const data = await response.json();
                setGroups(data.groups || []);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchTeachers = async () => {
        try {
            const response = await authFetch(`${API_URL}/api/admin/teachers`, { headers: getAuthHeader() });
            if (response.ok) setTeachers(await response.json());
        } catch (err) { console.error(err); }
    };

    const fetchAvailableStudents = async () => {
        try {
            const response = await authFetch(`${API_URL}/api/admin/students?limit=500`);
            if (response.ok) setAvailableStudents(await response.json());
        } catch (err) { console.error(err); }
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
        } catch (error) {
            console.error("Error fetching curriculum subjects:", error);
        } finally {
            setLoadingCurriculum(false);
        }
    };

    const classSubjectOptions = React.useMemo(() => {
        return curriculumSubjects.map(subj => ({
            value: `${subj.class_level}-${subj.subject_name}`,
            label: `Class ${subj.class_level} - ${subj.subject_name}`
        })).sort((a, b) => a.label.localeCompare(b.label));
    }, [curriculumSubjects]);

    const availableClassLevels = React.useMemo(() => {
        return [...new Set(curriculumSubjects.map(s => s.class_level))].sort((a, b) => a - b);
    }, [curriculumSubjects]);

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (groupForm.teacher_ids.length === 0) return toast.info("Please select at least one teacher for this group")
        if (selectedStudentIds.length === 0) return toast.info("Please select at least one student")
        
        const { class: classLevel, subject } = parseCombinedValue(groupForm.classSubject);
        if (!classLevel || !subject || !groupForm.batch_year) return toast.info("Please fill all required fields")

        const tempId = `temp_${Date.now()}`;
        const teacherNames = teachers
            .filter(t => groupForm.teacher_ids.includes(t.id))
            .map(t => t.name)
            .join(", ");
        const optimisticGroup = {
            id: tempId,
            class_level: classLevel,
            subject: subject,
            batch_year: parseInt(groupForm.batch_year),
            teacher_ids: groupForm.teacher_ids,
            teacher_name: teacherNames,
            student_count: selectedStudentIds.length,
            students: []
        };
        
        setGroups([optimisticGroup, ...groups]);
        setShowAddGroup(false);

        setSaving(true);
        try {
            const response = await authFetch(`${API_URL}/api/admin/groups`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...getAuthHeader() },
                body: JSON.stringify({
                    class_level: classLevel,
                    subject: subject,
                    batch_year: parseInt(groupForm.batch_year),
                    teacher_ids: groupForm.teacher_ids,
                    student_ids: selectedStudentIds
                })
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Failed to create group");
            }
            const newGroup = await response.json();
            
            setGroups(prev => prev.map(g => g.id === tempId ? newGroup : g));
            setGroupForm({ teacher_ids: [], classSubject: "", batch_year: "" });
            setSelectedStudentIds([]);
        } catch (err) {
            
            setGroups(prev => prev.filter(g => g.id !== tempId));
            setShowAddGroup(true);
            toast.error("Error: " + err.message)
        } finally {
            setSaving(false);
        }
    };

    const [showEditGroup, setShowEditGroup] = useState(false);
    const [editGroupForm, setEditGroupForm] = useState({ id: "", name: "", teacher_ids: [] });
    const [editTeacherSearch, setEditTeacherSearch] = useState("");
    const [editStudentSearch, setEditStudentSearch] = useState("");
    const [editStudentClassFilter, setEditStudentClassFilter] = useState("");
    const [editPendingAddStudentIds, setEditPendingAddStudentIds] = useState([]);
    const [editGroupStudents, setEditGroupStudents] = useState([]);
    const [editRemovedStudentIds, setEditRemovedStudentIds] = useState([]);

    const handleEditClick = (group, e) => {
        e.stopPropagation();
        setEditGroupForm({
            id: group.id,
            name: group.name,
            teacher_ids: group.teacher_ids || (group.teacher_id ? [group.teacher_id] : [])
        });
        setEditGroupStudents(group.students || []);
        setEditTeacherSearch("");
        setEditStudentSearch("");
        setEditStudentClassFilter("");
        setEditPendingAddStudentIds([]);
        setEditRemovedStudentIds([]);
        setShowEditGroup(true);
    };

    const handleUpdateGroup = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const response = await authFetch(`${API_URL}/api/admin/groups/${editGroupForm.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...getAuthHeader() },
                body: JSON.stringify({
                    name: editGroupForm.name,
                    teacher_ids: editGroupForm.teacher_ids
                })
            });
            if (!response.ok) throw new Error("Failed to update group");
            const updatedGroup = await response.json();

            // Remove students
            for (const sid of editRemovedStudentIds) {
                await authFetch(`${API_URL}/api/admin/groups/${editGroupForm.id}/students/${sid}`, {
                    method: "DELETE", headers: getAuthHeader()
                });
            }
            // Add students
            if (editPendingAddStudentIds.length > 0) {
                await authFetch(`${API_URL}/api/admin/groups/${editGroupForm.id}/students`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...getAuthHeader() },
                    body: JSON.stringify({ student_ids: editPendingAddStudentIds })
                });
            }

            const finalStudents = [
                ...editGroupStudents.filter(s => !editRemovedStudentIds.includes(s.id)),
                ...availableStudents.filter(s => editPendingAddStudentIds.includes(s.id))
            ];

            setGroups(groups.map(g => g.id === updatedGroup.id ? {
                ...g, ...updatedGroup, students: finalStudents, student_count: finalStudents.length
            } : g));
            if (selectedGroup?.id === updatedGroup.id) {
                setSelectedGroup(prev => ({ ...prev, ...updatedGroup, students: finalStudents }));
            }
            setShowEditGroup(false);
        } catch (err) {
            toast.error("Error: " + err.message)
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteGroup = async (groupId) => {
        if (!confirm("Are you sure you want to delete this group?")) return;
        
        const deletedGroup = groups.find(g => g.id === groupId);
        const updatedGroups = groups.filter(g => g.id !== groupId);
        setGroups(updatedGroups);
        if (selectedGroup?.id === groupId) setSelectedGroup(null);
        
        try {
            const response = await authFetch(`${API_URL}/api/admin/groups/${groupId}`, {
                method: "DELETE",
                headers: getAuthHeader()
            });
            if (!response.ok) {
                throw new Error("Failed to delete group");
            }
        } catch (err) {
            
            toast.error("Error: " + err.message)
            setGroups([...updatedGroups, deletedGroup]);
        }
    };

    const handleRemoveStudentFromGroup = async (studentId) => {
        if (!selectedGroup) return;
        if (!confirm("Remove this student from the group?")) return;
        try {
            const response = await authFetch(`${API_URL}/api/admin/groups/${selectedGroup.id}/students/${studentId}`, {
                method: "DELETE",
                headers: getAuthHeader()
            });
            if (!response.ok) throw new Error("Failed to remove student");
            setSelectedGroup({
                ...selectedGroup,
                students: selectedGroup.students.filter(s => s.id !== studentId)
            });
            setGroups(groups.map(g => g.id === selectedGroup.id ? { ...g, student_count: g.student_count - 1 } : g));
        } catch (err) {
            toast.error("Error: " + err.message)
        }
    };

    const handleAssignStudents = async () => {
        if (!selectedGroup || selectedStudentIds.length === 0) return;
        setSaving(true);
        try {
            const response = await authFetch(`${API_URL}/api/admin/groups/${selectedGroup.id}/students`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...getAuthHeader() },
                body: JSON.stringify({ student_ids: selectedStudentIds })
            });
            if (!response.ok) throw new Error("Failed to assign students");
            const data = await response.json();
            setSelectedGroup({ ...selectedGroup, students: data.students || [] });
            setGroups(groups.map(g => g.id === selectedGroup.id ? { ...g, student_count: data.students?.length || 0 } : g));
            setShowAssignStudents(false);
            setSelectedStudentIds([]);
        } catch (err) {
            toast.error("Error: " + err.message)
        } finally {
            setSaving(false);
        }
    };

    const toggleStudentSelection = (studentId) => {
        setSelectedStudentIds(prev =>
            prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
        );
    };

    const filteredGroups = groups.filter(g => g.name?.toLowerCase().includes(searchTerm.toLowerCase()));
    const currentGroupStudentIds = selectedGroup?.students?.map(s => s.id) || [];

    const filteredAvailableStudents = availableStudents.filter(student => {
        const matchesSearch = student.name?.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
            student.email?.toLowerCase().includes(studentSearchTerm.toLowerCase());
        const matchesClass = !studentClassFilter || student.class_level?.toString() === studentClassFilter;
        const notInGroup = !currentGroupStudentIds.includes(student.id);
        return matchesSearch && matchesClass && (showAssignStudents ? notInGroup : true);
    });

    const filteredTeachers = teachers.filter(teacher => {
        const matchesSearch = teacher.name?.toLowerCase().includes(teacherSearchTerm.toLowerCase()) ||
            teacher.user_id?.toLowerCase().includes(teacherSearchTerm.toLowerCase()) ||
            teacher.email?.toLowerCase().includes(teacherSearchTerm.toLowerCase());
        return matchesSearch;
    });

    return (
        <AdminLayout title="Group Management" icon={FolderKanban}>
            {}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search groups..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    />
                </div>
                <button
                    onClick={() => setShowAddGroup(true)}
                    className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition flex items-center gap-2 font-medium"
                >
                    <UserPlus className="w-4 h-4" /> Create Group
                </button>
            </div>

            {}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{groups.length}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Groups</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{teachers.length}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Available Teachers</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{groups.reduce((sum, g) => sum + (g.student_count || 0), 0)}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Students in Groups</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{availableStudents.length}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Students</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Group List */}
                <div className="lg:col-span-1 space-y-3">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">Groups</h2>
                    {loading ? (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                            <LoadingSpinner text="Loading groups…" />
                        </div>
                    ) : filteredGroups.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                            <FolderKanban className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                            <p className="text-gray-500 dark:text-gray-400">No groups found</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredGroups.map(group => (
                                <div
                                    key={group.id}
                                    onClick={() => setSelectedGroup(group)}
                                    className={`bg-white dark:bg-gray-800 p-4 rounded-xl border cursor-pointer transition hover:shadow-md
                                        ${selectedGroup?.id === group.id ? "border-gray-900 dark:border-white ring-1 ring-gray-900 dark:ring-white" : "border-gray-200 dark:border-gray-700"}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-medium text-gray-900 dark:text-white">{group.name}</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Teacher: {group.teacher_name}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{group.student_count || 0} students</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={(e) => handleEditClick(group, e)}
                                                className="p-2 text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                                                title="Edit Group"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }}
                                                className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                                title="Delete Group"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Group Details */}
                <div className="lg:col-span-2">
                    {selectedGroup ? (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedGroup.name}</h2>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm">Teacher: {selectedGroup.teacher_name}</p>
                                </div>
                                <button
                                    onClick={() => { setShowAssignStudents(true); setSelectedStudentIds([]); }}
                                    className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 flex items-center gap-2 text-sm font-medium"
                                >
                                    <UserPlus className="w-4 h-4" /> Add Students
                                </button>
                            </div>

                            <h3 className="font-medium text-gray-900 dark:text-white mb-4">Students ({selectedGroup.students?.length || 0})</h3>

                            {!selectedGroup.students || selectedGroup.students.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">No students in this group</div>
                            ) : (
                                <div className="space-y-2">
                                    {selectedGroup.students.map(student => (
                                        <div key={student.id} className="flex items-center justify-between p-3 border border-gray-100 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">{student.name}</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">{student.email} • Class {student.class_level}</p>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveStudentFromGroup(student.id)}
                                                className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                            <FolderKanban className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-500 dark:text-gray-400">Select a group to view details</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Group Modal */}
            {showAddGroup && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto border dark:border-gray-700">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Create New Group</h2>
                        <form onSubmit={handleCreateGroup} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Class & Subject *</label>
                                    {classSubjectOptions.length === 0 && !loadingCurriculum ? (
                                        <div className="space-y-2">
                                            <select
                                                disabled
                                                className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400"
                                            >
                                                <option>No subjects found</option>
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => navigate('/subjects-management')}
                                                className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition"
                                            >
                                                <Plus className="w-4 h-4" />
                                                <BookOpen className="w-4 h-4" />
                                                Create Subject First
                                            </button>
                                        </div>
                                    ) : (
                                        <select
                                            required
                                            value={groupForm.classSubject}
                                            onChange={(e) => setGroupForm({ ...groupForm, classSubject: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                        >
                                            <option value="">Select Class & Subject</option>
                                            {loadingCurriculum ? (
                                                <option disabled>Loading...</option>
                                            ) : (
                                                classSubjectOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)
                                            )}
                                        </select>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Batch Year *</label>
                                    <select
                                        required
                                        value={groupForm.batch_year}
                                        onChange={(e) => setGroupForm({ ...groupForm, batch_year: parseInt(e.target.value) })}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                    >
                                        <option value="">Select Year</option>
                                        {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Preview Name: <span className="font-medium text-gray-900 dark:text-white">
                                        {(() => {
                                            const { class: classLevel, subject } = parseCombinedValue(groupForm.classSubject);
                                            return (groupForm.classSubject && groupForm.batch_year)
                                                ? `${subject}_Class${classLevel}_${groupForm.batch_year}`
                                                : "Subject_Class_BatchYear";
                                        })()}
                                    </span>
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Assign Teachers *</label>
                                <div className="mb-2">
                                    <input
                                        type="text"
                                        placeholder="Search teachers..."
                                        value={teacherSearchTerm}
                                        onChange={(e) => setTeacherSearchTerm(e.target.value)}
                                        className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                                    {filteredTeachers.length === 0 ? (
                                        <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                                            {teacherSearchTerm ? "No teachers match your search" : "No teachers found"}
                                        </div>
                                    ) : (
                                        filteredTeachers.map(teacher => (
                                            <label key={teacher.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0">
                                                <input
                                                    type="checkbox"
                                                    checked={groupForm.teacher_ids.includes(teacher.id)}
                                                    onChange={() => {
                                                        const newIds = groupForm.teacher_ids.includes(teacher.id)
                                                            ? groupForm.teacher_ids.filter(id => id !== teacher.id)
                                                            : [...groupForm.teacher_ids, teacher.id];
                                                        setGroupForm({ ...groupForm, teacher_ids: newIds });
                                                    }}
                                                    className="w-4 h-4 text-gray-900 rounded border-gray-300"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-900 dark:text-white truncate">{teacher.name}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">{teacher.user_id} {teacher.email ? `• ${teacher.email}` : ""}</p>
                                                </div>
                                            </label>
                                        ))
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{groupForm.teacher_ids.length} teachers selected</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Select Students *</label>
                                <div className="flex gap-2 mb-3">
                                    <input
                                        type="text"
                                        placeholder="Search students..."
                                        value={studentSearchTerm}
                                        onChange={(e) => setStudentSearchTerm(e.target.value)}
                                        className="flex-1 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                    />
                                    <select value={studentClassFilter} onChange={(e) => setStudentClassFilter(e.target.value)}
                                        className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white">
                                        <option value="">All Classes</option>
                                        {availableClassLevels.map(c => <option key={c} value={c}>Class {c}</option>)}
                                    </select>
                                </div>
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                                    {filteredAvailableStudents.length === 0 ? (
                                        <div className="p-4 text-center text-gray-500 dark:text-gray-400">No students found</div>
                                    ) : (
                                        filteredAvailableStudents.slice(0, 50).map(student => (
                                            <label key={student.id}
                                                className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0">
                                                <input type="checkbox" checked={selectedStudentIds.includes(student.id)}
                                                    onChange={() => toggleStudentSelection(student.id)}
                                                    className="w-4 h-4 text-gray-900 rounded border-gray-300" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-900 dark:text-white truncate">{student.name}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">Class {student.class_level} • {student.email}</p>
                                                </div>
                                            </label>
                                        ))
                                    )}
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{selectedStudentIds.length} selected</p>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => { setShowAddGroup(false); setSelectedStudentIds([]); }}
                                    className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300">Cancel</button>
                                <button type="submit" disabled={saving}
                                    className="flex-1 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg disabled:opacity-50 font-medium">
                                    {saving ? "Creating..." : "Create Group"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assign Students Modal */}
            {showAssignStudents && selectedGroup && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-xl mx-4 max-h-[80vh] overflow-y-auto border dark:border-gray-700">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add Students to {selectedGroup.name}</h2>
                        <div className="flex gap-2 mb-4">
                            <input type="text" placeholder="Search students..."
                                value={studentSearchTerm} onChange={(e) => setStudentSearchTerm(e.target.value)}
                                className="flex-1 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white" />
                            <select value={studentClassFilter} onChange={(e) => setStudentClassFilter(e.target.value)}
                                className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white">
                                <option value="">All Classes</option>
                                {availableClassLevels.map(c => <option key={c} value={c}>Class {c}</option>)}
                            </select>
                        </div>
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-72 overflow-y-auto mb-4">
                            {filteredAvailableStudents.length === 0 ? (
                                <div className="p-4 text-center text-gray-500 dark:text-gray-400">No available students</div>
                            ) : (
                                filteredAvailableStudents.slice(0, 50).map(student => (
                                    <label key={student.id}
                                        className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0">
                                        <input type="checkbox" checked={selectedStudentIds.includes(student.id)}
                                            onChange={() => toggleStudentSelection(student.id)}
                                            className="w-4 h-4 text-gray-900 rounded border-gray-300" />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 dark:text-white truncate">{student.name}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Class {student.class_level}</p>
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{selectedStudentIds.length} selected</p>
                        <div className="flex gap-3">
                            <button onClick={() => { setShowAssignStudents(false); setSelectedStudentIds([]); }}
                                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300">Cancel</button>
                            <button onClick={handleAssignStudents} disabled={saving || selectedStudentIds.length === 0}
                                className="flex-1 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg disabled:opacity-50 font-medium">
                                {saving ? "Adding..." : "Add Students"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Edit Group Modal — wide two-panel */}
            {showEditGroup && (() => {
                const editFilteredTeachers = teachers.filter(t =>
                    t.name?.toLowerCase().includes(editTeacherSearch.toLowerCase()) ||
                    t.user_id?.toLowerCase().includes(editTeacherSearch.toLowerCase()) ||
                    t.email?.toLowerCase().includes(editTeacherSearch.toLowerCase())
                );
                const currentEditStudents = editGroupStudents.filter(s => !editRemovedStudentIds.includes(s.id));
                const currentEditStudentIds = currentEditStudents.map(s => s.id);
                const editAvailableToAdd = availableStudents.filter(s => {
                    const notInGroup = !currentEditStudentIds.includes(s.id);
                    const matchSearch = !editStudentSearch ||
                        s.name?.toLowerCase().includes(editStudentSearch.toLowerCase()) ||
                        s.email?.toLowerCase().includes(editStudentSearch.toLowerCase());
                    const matchClass = !editStudentClassFilter || s.class_level?.toString() === editStudentClassFilter;
                    return notInGroup && matchSearch && matchClass;
                });
                const editAvailableClassLevels = [...new Set(availableStudents.map(s => s.class_level).filter(Boolean))].sort((a,b) => a-b);
                return (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border dark:border-gray-700 shadow-2xl">
                            {/* Header */}
                            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Group</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage teachers and students for this group</p>
                                </div>
                                <button onClick={() => setShowEditGroup(false)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Body — two columns */}
                            <form onSubmit={handleUpdateGroup} className="flex flex-col flex-1 min-h-0">
                                <div className="grid grid-cols-1 lg:grid-cols-2 flex-1 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-gray-200 dark:divide-gray-700">

                                    {/* LEFT — Group info + Teachers */}
                                    <div className="flex flex-col p-6 gap-5 overflow-y-auto">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Group Name</label>
                                            <input
                                                type="text" required
                                                value={editGroupForm.name}
                                                onChange={(e) => setEditGroupForm({ ...editGroupForm, name: e.target.value })}
                                                className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500"
                                                placeholder="e.g. Maths_Class10_2026"
                                            />
                                        </div>

                                        {/* Feature Access */}
                                        {(() => {
                                            const editingGroup = groups.find(g => g.id === editGroupForm.id);
                                            return (
                                                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-700">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <Shield className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Feature Access</span>
                                                        <span className="text-xs text-gray-400 dark:text-gray-500">(all students in group)</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {Object.entries(featureLabels).map(([key, label]) => {
                                                            const rawValue = editingGroup?.feature_flags?.[key];
                                                            const enabled = rawValue === undefined ? (featureDefaults[key] ?? false) : rawValue === true;
                                                            return (
                                                                <button
                                                                    key={key}
                                                                    type="button"
                                                                    onClick={() => handleToggleGroupFeature(editGroupForm.id, key, !enabled)}
                                                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition ${
                                                                        enabled
                                                                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
                                                                            : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600"
                                                                    }`}
                                                                >
                                                                    <div className={`w-8 h-4 rounded-full relative transition-colors shrink-0 ${enabled ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                                                                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                                                                    </div>
                                                                    {label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        <div className="flex flex-col flex-1 min-h-0">
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Assigned Teachers</label>
                                                <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">{editGroupForm.teacher_ids.length} selected</span>
                                            </div>
                                            <div className="relative mb-2">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                <input
                                                    type="text" placeholder="Search teachers..."
                                                    value={editTeacherSearch}
                                                    onChange={(e) => setEditTeacherSearch(e.target.value)}
                                                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white outline-none"
                                                />
                                            </div>
                                            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-y-auto flex-1" style={{minHeight: '200px', maxHeight: '320px'}}>
                                                {editFilteredTeachers.length === 0 ? (
                                                    <div className="text-center text-gray-400 dark:text-gray-500 py-8 text-sm">
                                                        {editTeacherSearch ? "No teachers match your search" : "No teachers available"}
                                                    </div>
                                                ) : editFilteredTeachers.map(teacher => {
                                                    const selected = editGroupForm.teacher_ids.includes(teacher.id);
                                                    return (
                                                        <label key={teacher.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0 transition ${
                                                            selected ? "bg-gray-50 dark:bg-gray-700/50" : "hover:bg-gray-50 dark:hover:bg-gray-700/30"
                                                        }`}>
                                                            <input
                                                                type="checkbox" checked={selected}
                                                                onChange={() => {
                                                                    const newIds = selected
                                                                        ? editGroupForm.teacher_ids.filter(id => id !== teacher.id)
                                                                        : [...editGroupForm.teacher_ids, teacher.id];
                                                                    setEditGroupForm({ ...editGroupForm, teacher_ids: newIds });
                                                                }}
                                                                className="w-4 h-4 rounded border-gray-300 accent-gray-900"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{teacher.name}</p>
                                                                <p className="text-xs text-gray-500 dark:text-gray-400">{teacher.user_id}{teacher.email ? ` · ${teacher.email}` : ""}</p>
                                                            </div>
                                                            {selected && <Check className="w-4 h-4 text-green-500 shrink-0" />}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* RIGHT — Students */}
                                    <div className="flex flex-col p-6 gap-4 overflow-y-auto">
                                        {/* Current students */}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Students</label>
                                                <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">{currentEditStudents.length}</span>
                                            </div>
                                            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-y-auto" style={{maxHeight: '200px'}}>
                                                {currentEditStudents.length === 0 ? (
                                                    <div className="text-center text-gray-400 dark:text-gray-500 py-6 text-sm">No students in this group</div>
                                                ) : currentEditStudents.map(student => (
                                                    <div key={student.id} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{student.name}</p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">Class {student.class_level} · {student.email}</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditRemovedStudentIds(prev => [...prev, student.id])}
                                                            className="ml-2 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition shrink-0"
                                                            title="Remove from group"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                            {editRemovedStudentIds.length > 0 && (
                                                <p className="text-xs text-red-500 mt-1">{editRemovedStudentIds.length} student(s) will be removed on save</p>
                                            )}
                                        </div>

                                        {/* Add students */}
                                        <div className="flex flex-col flex-1 min-h-0">
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Add Students</label>
                                                {editPendingAddStudentIds.length > 0 && (
                                                    <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">+{editPendingAddStudentIds.length} to add</span>
                                                )}
                                            </div>
                                            <div className="flex gap-2 mb-2">
                                                <div className="relative flex-1">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                    <input
                                                        type="text" placeholder="Search students..."
                                                        value={editStudentSearch}
                                                        onChange={(e) => setEditStudentSearch(e.target.value)}
                                                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white outline-none"
                                                    />
                                                </div>
                                                <select
                                                    value={editStudentClassFilter}
                                                    onChange={(e) => setEditStudentClassFilter(e.target.value)}
                                                    className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white outline-none"
                                                >
                                                    <option value="">All Classes</option>
                                                    {editAvailableClassLevels.map(c => <option key={c} value={c}>Class {c}</option>)}
                                                </select>
                                            </div>
                                            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-y-auto flex-1" style={{minHeight: '150px', maxHeight: '220px'}}>
                                                {editAvailableToAdd.length === 0 ? (
                                                    <div className="text-center text-gray-400 dark:text-gray-500 py-8 text-sm">
                                                        {editStudentSearch || editStudentClassFilter ? "No students match your filters" : "All students already in group"}
                                                    </div>
                                                ) : editAvailableToAdd.slice(0, 60).map(student => {
                                                    const pending = editPendingAddStudentIds.includes(student.id);
                                                    return (
                                                        <label key={student.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0 transition ${
                                                            pending ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-700/30"
                                                        }`}>
                                                            <input
                                                                type="checkbox" checked={pending}
                                                                onChange={() => setEditPendingAddStudentIds(prev =>
                                                                    pending ? prev.filter(id => id !== student.id) : [...prev, student.id]
                                                                )}
                                                                className="w-4 h-4 rounded border-gray-300 accent-gray-900"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{student.name}</p>
                                                                <p className="text-xs text-gray-500 dark:text-gray-400">Class {student.class_level} · {student.email}</p>
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 rounded-b-2xl shrink-0">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {editGroupForm.teacher_ids.length} teacher(s) · {currentEditStudents.length + editPendingAddStudentIds.length} student(s)
                                    </p>
                                    <div className="flex gap-3">
                                        <button type="button" onClick={() => setShowEditGroup(false)}
                                            className="px-5 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition text-sm">
                                            Cancel
                                        </button>
                                        <button type="submit" disabled={saving}
                                            className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition disabled:opacity-50 font-medium text-sm">
                                            {saving ? "Saving..." : "Save Changes"}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                );
            })()}
        </AdminLayout>
    );
}
