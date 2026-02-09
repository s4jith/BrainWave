/**
 * GroupManagement - Admin page to manage student groups
 * Uses AdminLayout with light/dark theme support
 */

import React, { useState, useEffect } from "react";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import { Trash2, Users, UserPlus, FolderKanban, Search, X, Check } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function GroupManagement() {
    const { getAuthHeader } = useUserStore();
    const [groups, setGroups] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [showAddGroup, setShowAddGroup] = useState(false);
    const [showAssignStudents, setShowAssignStudents] = useState(false);

    const [selectedGroup, setSelectedGroup] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [saving, setSaving] = useState(false);

    const [availableStudents, setAvailableStudents] = useState([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [studentSearchTerm, setStudentSearchTerm] = useState("");
    const [studentClassFilter, setStudentClassFilter] = useState("");

    const [groupForm, setGroupForm] = useState({ name: "", teacher_id: "" });

    useEffect(() => {
        fetchGroups();
        fetchTeachers();
        fetchAvailableStudents();
    }, []);

    const fetchGroups = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/api/admin/groups`, { headers: getAuthHeader() });
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
            const response = await fetch(`${API_URL}/api/admin/teachers`, { headers: getAuthHeader() });
            if (response.ok) setTeachers(await response.json());
        } catch (err) { console.error(err); }
    };

    const fetchAvailableStudents = async () => {
        try {
            const response = await fetch(`${API_URL}/api/admin/students?limit=500`);
            if (response.ok) setAvailableStudents(await response.json());
        } catch (err) { console.error(err); }
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!groupForm.teacher_id) return alert("Please select a teacher for this group");
        if (selectedStudentIds.length === 0) return alert("Please select at least one student");

        setSaving(true);
        try {
            const response = await fetch(`${API_URL}/api/admin/groups`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...getAuthHeader() },
                body: JSON.stringify({
                    name: groupForm.name,
                    teacher_id: groupForm.teacher_id,
                    student_ids: selectedStudentIds
                })
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Failed to create group");
            }
            await response.json();
            setShowAddGroup(false);
            setGroupForm({ name: "", teacher_id: "" });
            setSelectedStudentIds([]);
            fetchGroups();
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteGroup = async (groupId) => {
        if (!confirm("Are you sure you want to delete this group?")) return;
        try {
            const response = await fetch(`${API_URL}/api/admin/groups/${groupId}`, {
                method: "DELETE",
                headers: getAuthHeader()
            });
            if (!response.ok) throw new Error("Failed to delete group");
            setGroups(groups.filter(g => g.id !== groupId));
            if (selectedGroup?.id === groupId) setSelectedGroup(null);
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    const handleRemoveStudentFromGroup = async (studentId) => {
        if (!selectedGroup) return;
        if (!confirm("Remove this student from the group?")) return;
        try {
            const response = await fetch(`${API_URL}/api/admin/groups/${selectedGroup.id}/students/${studentId}`, {
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
            alert("Error: " + err.message);
        }
    };

    const handleAssignStudents = async () => {
        if (!selectedGroup || selectedStudentIds.length === 0) return;
        setSaving(true);
        try {
            const response = await fetch(`${API_URL}/api/admin/groups/${selectedGroup.id}/students`, {
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
            alert("Error: " + err.message);
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

    return (
        <AdminLayout title="Group Management" icon={FolderKanban}>
            {/* Search and Actions */}
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

            {/* Stats */}
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
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gray-900 dark:border-white mx-auto"></div>
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
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }}
                                            className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
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
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Group Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={groupForm.name}
                                    onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                    placeholder="e.g., Batch 2026"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Assign Teacher *</label>
                                <select
                                    value={groupForm.teacher_id}
                                    onChange={(e) => setGroupForm({ ...groupForm, teacher_id: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                    required
                                >
                                    <option value="">Select a teacher</option>
                                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
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
                                        {[5, 6, 7, 8, 9, 10, 11, 12].map(c => <option key={c} value={c}>Class {c}</option>)}
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
                                {[5, 6, 7, 8, 9, 10, 11, 12].map(c => <option key={c} value={c}>Class {c}</option>)}
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
        </AdminLayout>
    );
}
