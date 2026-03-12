
import React, { useState, useEffect, useCallback, useMemo } from "react";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import LoadingSpinner from "../components/LoadingSpinner";
import {
    Users, FolderKanban, BookOpen, GraduationCap,
    ChevronDown, ChevronUp, Search, RefreshCw, Filter, X,
    AlertTriangle
} from "lucide-react";
import authFetch from "../utils/authFetch";

const API_URL = import.meta.env.VITE_API_URL;

export default function HeadGroups() {
    const { getAuthHeader } = useUserStore();
    const [groups, setGroups] = useState([]);
    const [assignment, setAssignment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedGroup, setExpandedGroup] = useState(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [filterClass, setFilterClass] = useState("");
    const [filterSubject, setFilterSubject] = useState("");
    const [filterTeacher, setFilterTeacher] = useState("");

    const fetchAssignment = useCallback(async () => {
        try {
            const res = await authFetch(`${API_URL}/api/head/my-assignment`, {
                headers: getAuthHeader()
            });
            if (res.ok) {
                const data = await res.json();
                setAssignment(data);
            }
        } catch (err) {
            console.error("Error fetching assignment:", err);
        }
    }, [getAuthHeader]);

    const fetchGroups = useCallback(async () => {
        try {
            const res = await authFetch(`${API_URL}/api/head/groups`, {
                headers: getAuthHeader()
            });
            if (res.ok) {
                const data = await res.json();
                setGroups(data.groups || []);
            } else {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || "Failed to fetch groups");
            }
        } catch (err) {
            setError(err.message);
        }
    }, [getAuthHeader]);

    const loadAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        await Promise.all([fetchAssignment(), fetchGroups()]);
        setLoading(false);
    }, [fetchAssignment, fetchGroups]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    // Derive unique filter options from fetched groups
    const classOptions = useMemo(() => [...new Set(groups.map(g => g.class_level).filter(Boolean))].sort((a, b) => a - b), [groups]);
    const subjectOptions = useMemo(() => [...new Set(groups.map(g => g.subject).filter(Boolean))].sort(), [groups]);
    const teacherOptions = useMemo(() => [...new Set(groups.map(g => g.teacher_name).filter(Boolean))].sort(), [groups]);

    const hasActiveFilters = filterClass || filterSubject || filterTeacher || searchTerm;

    const clearFilters = () => {
        setSearchTerm("");
        setFilterClass("");
        setFilterSubject("");
        setFilterTeacher("");
    };

    const filteredGroups = useMemo(() => groups.filter(g => {
        if (filterClass && String(g.class_level) !== String(filterClass)) return false;
        if (filterSubject && g.subject !== filterSubject) return false;
        if (filterTeacher && g.teacher_name !== filterTeacher) return false;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return (
                g.name?.toLowerCase().includes(term) ||
                g.subject?.toLowerCase().includes(term) ||
                g.teacher_name?.toLowerCase().includes(term) ||
                String(g.class_level)?.includes(term)
            );
        }
        return true;
    }), [groups, filterClass, filterSubject, filterTeacher, searchTerm]);

    const totalStudents = groups.reduce((sum, g) => sum + (g.student_count || 0), 0);
    const isNotAssigned = assignment &&
        ((assignment.assignment_type === "class" && (assignment.assigned_classes || []).length === 0) ||
         (assignment.assignment_type === "subject" && (assignment.assigned_subjects || []).length === 0));

    if (loading) {
        return (
            <AdminLayout title="Groups" icon={FolderKanban}>
                <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="Groups" icon={FolderKanban}>
            <div className="max-w-7xl mx-auto space-y-5">

                {/* Assignment Info Banner */}
                {assignment && (
                    <div className={`rounded-xl border p-4 flex items-center gap-3 flex-wrap ${
                        isNotAssigned
                            ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                            : assignment.assignment_type === "subject"
                                ? "bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800"
                                : "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
                    }`}>
                        {isNotAssigned ? (
                            <span className="inline-flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-medium">
                                <AlertTriangle className="w-4 h-4" />
                                No assignment configured — contact admin to assign classes or subjects
                            </span>
                        ) : assignment.assignment_type === "subject" ? (
                            <>
                                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-700 dark:text-purple-400">
                                    <BookOpen className="w-4 h-4" /> Assigned Subjects:
                                </span>
                                {(assignment.assigned_subjects || []).map(s => (
                                    <span key={s} className="px-2.5 py-1 rounded-lg text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 font-medium">{s}</span>
                                ))}
                            </>
                        ) : (
                            <>
                                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-blue-400">
                                    <GraduationCap className="w-4 h-4" /> Assigned Classes:
                                </span>
                                {(assignment.assigned_classes || []).map(c => (
                                    <span key={c} className="px-2.5 py-1 rounded-lg text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 font-medium">Class {c}</span>
                                ))}
                            </>
                        )}
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                <FolderKanban className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{groups.length}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Total Groups</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalStudents}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Total Students</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <GraduationCap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{classOptions.length}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Class Levels</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters</span>
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 transition"
                            >
                                <X className="w-3 h-3" /> Clear filters
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search group name..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white placeholder-gray-400"
                            />
                        </div>

                        {/* Class filter */}
                        <select
                            value={filterClass}
                            onChange={e => setFilterClass(e.target.value)}
                            className="w-full py-2 px-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                        >
                            <option value="">All Classes</option>
                            {classOptions.map(c => (
                                <option key={c} value={c}>Class {c}</option>
                            ))}
                        </select>

                        {/* Subject filter */}
                        <select
                            value={filterSubject}
                            onChange={e => setFilterSubject(e.target.value)}
                            className="w-full py-2 px-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                        >
                            <option value="">All Subjects</option>
                            {subjectOptions.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>

                        {/* Teacher filter */}
                        <select
                            value={filterTeacher}
                            onChange={e => setFilterTeacher(e.target.value)}
                            className="w-full py-2 px-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                        >
                            <option value="">All Teachers</option>
                            {teacherOptions.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Results count + Refresh */}
                <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Showing <span className="font-semibold text-gray-700 dark:text-gray-200">{filteredGroups.length}</span>
                        {" "}of <span className="font-semibold text-gray-700 dark:text-gray-200">{groups.length}</span> groups
                    </p>
                    <button
                        onClick={loadAll}
                        className="px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"
                    >
                        <RefreshCw className="w-4 h-4" /> Refresh
                    </button>
                </div>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
                        {error}
                    </div>
                )}

                {/* Groups List */}
                {filteredGroups.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-12 text-center">
                        <FolderKanban className="w-14 h-14 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                        <p className="text-gray-600 dark:text-gray-400 font-medium">
                            {isNotAssigned
                                ? "No assignment configured — contact admin"
                                : hasActiveFilters
                                    ? "No groups match your filters"
                                    : "No groups found for your assignment"}
                        </p>
                        {hasActiveFilters && (
                            <button onClick={clearFilters} className="mt-3 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredGroups.map((group) => (
                            <div key={group.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
                                {/* Group Header */}
                                <div
                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition"
                                    onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                                >
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                                            <FolderKanban className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-semibold text-gray-900 dark:text-white truncate">{group.name}</h3>
                                            <div className="flex items-center flex-wrap gap-3 mt-1 text-sm">
                                                <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                                                    <GraduationCap className="w-3.5 h-3.5" /> Class {group.class_level}
                                                </span>
                                                <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium">
                                                    <BookOpen className="w-3.5 h-3.5" /> {group.subject}
                                                </span>
                                                <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                                    <Users className="w-3.5 h-3.5" /> {group.student_count} students
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                                        <div className="text-right hidden sm:block">
                                            <p className="text-xs text-gray-400 dark:text-gray-500">Teacher</p>
                                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{group.teacher_name}</p>
                                        </div>
                                        {expandedGroup === group.id
                                            ? <ChevronUp className="w-5 h-5 text-gray-400" />
                                            : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {expandedGroup === group.id && (
                                    <div className="border-t border-gray-200 dark:border-zinc-800 p-4 space-y-4">
                                        {/* Group Info Row */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Class</p>
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white">Class {group.class_level}</p>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Subject</p>
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{group.subject}</p>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Teacher</p>
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{group.teacher_name}</p>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Batch Year</p>
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{group.batch_year || "—"}</p>
                                            </div>
                                        </div>

                                        {/* Students Table */}
                                        <div>
                                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                                                Students ({group.students?.length || 0})
                                            </p>
                                            {group.students && group.students.length > 0 ? (
                                                <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-zinc-800">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50 dark:bg-zinc-800">
                                                            <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                                                                <th className="py-2.5 px-4">#</th>
                                                                <th className="py-2.5 px-4">Name</th>
                                                                <th className="py-2.5 px-4">User ID</th>
                                                                <th className="py-2.5 px-4">Email</th>
                                                                <th className="py-2.5 px-4">Class</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                                            {group.students.map((student, idx) => (
                                                                <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition">
                                                                    <td className="py-2.5 px-4 text-gray-400">{idx + 1}</td>
                                                                    <td className="py-2.5 px-4 font-medium text-gray-900 dark:text-white">{student.name}</td>
                                                                    <td className="py-2.5 px-4">
                                                                        <code className="text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 px-2 py-0.5 rounded">{student.user_id}</code>
                                                                    </td>
                                                                    <td className="py-2.5 px-4 text-gray-600 dark:text-gray-400">{student.email}</td>
                                                                    <td className="py-2.5 px-4 text-gray-600 dark:text-gray-400">{student.class_level || "—"}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                                                    No students in this group
                                                </p>
                                            )}
                                        </div>

                                        {/* Feature Flags */}
                                        {group.feature_flags && Object.keys(group.feature_flags).length > 0 && (
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Features</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {Object.entries(group.feature_flags).map(([key, value]) => (
                                                        <span
                                                            key={key}
                                                            className={`px-2.5 py-1 rounded-lg text-xs font-medium ${value
                                                                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                                                : "bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-gray-500"}`}
                                                        >
                                                            {key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())} {value ? "ON" : "OFF"}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
