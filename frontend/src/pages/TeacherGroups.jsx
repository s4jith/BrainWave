
import React, { useState, useEffect } from "react";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import LoadingSpinner from "../components/LoadingSpinner";
import { Users, Search, FolderKanban, Filter } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function TeacherGroups() {
    const { getAuthHeader } = useUserStore();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterClass, setFilterClass] = useState("");
    const [filterSubject, setFilterSubject] = useState("");

    useEffect(() => {
        fetchTeacherGroups();
    }, []);

    const fetchTeacherGroups = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/api/teacher/groups`, {
                headers: getAuthHeader()
            });
            if (response.ok) {
                const data = await response.json();
                setGroups(data.groups || []);
            } else {
                setGroups([]);
            }
        } catch (err) {
            console.error("Error fetching groups:", err);
        } finally {
            setLoading(false);
        }
    };

    // Derive unique class levels and subjects from actual groups only
    const availableClasses = [...new Set(groups.map(g => g.class_level).filter(Boolean))].sort((a, b) => a - b);
    const availableSubjects = [...new Set(groups.map(g => g.subject).filter(Boolean))].sort();

    const filteredGroups = groups.filter(g => {
        const matchSearch = !searchTerm || g.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchClass = !filterClass || String(g.class_level) === String(filterClass);
        const matchSubject = !filterSubject || g.subject === filterSubject;
        return matchSearch && matchClass && matchSubject;
    });

    const hasActiveFilters = searchTerm || filterClass || filterSubject;

    const clearFilters = () => {
        setSearchTerm("");
        setFilterClass("");
        setFilterSubject("");
    };

    return (
        <AdminLayout title="Student Groups" icon={Users}>
            {/* Filter Bar */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search groups…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-500"
                        />
                    </div>
                    <select
                        value={filterClass}
                        onChange={(e) => setFilterClass(e.target.value)}
                        className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-500"
                    >
                        <option value="">All Classes</option>
                        {availableClasses.map(c => (
                            <option key={c} value={c}>Class {c}</option>
                        ))}
                    </select>
                    <select
                        value={filterSubject}
                        onChange={(e) => setFilterSubject(e.target.value)}
                        className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-500"
                    >
                        <option value="">All Subjects</option>
                        {availableSubjects.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-gray-300 transition"
                        >
                            Clear
                        </button>
                    )}
                    {!loading && (
                        <span className="ml-auto text-sm text-gray-400 dark:text-gray-500">
                            {filteredGroups.length} of {groups.length} groups
                        </span>
                    )}
                </div>

                {/* Active filter pills */}
                {hasActiveFilters && (
                    <div className="flex flex-wrap gap-2 mt-3">
                        {filterClass && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-xs rounded-full border border-indigo-200 dark:border-indigo-800">
                                Class {filterClass}
                                <button onClick={() => setFilterClass("")} className="hover:opacity-70">×</button>
                            </span>
                        )}
                        {filterSubject && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-xs rounded-full border border-emerald-200 dark:border-emerald-800">
                                {filterSubject}
                                <button onClick={() => setFilterSubject("")} className="hover:opacity-70">×</button>
                            </span>
                        )}
                        {searchTerm && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full border border-gray-200 dark:border-gray-600">
                                "{searchTerm}"
                                <button onClick={() => setSearchTerm("")} className="hover:opacity-70">×</button>
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Group List */}
                <div className="lg:col-span-1 space-y-3">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Your Groups
                        {!loading && (
                            <span className="ml-2 text-sm font-normal text-gray-400 dark:text-gray-500">
                                ({filteredGroups.length})
                            </span>
                        )}
                    </h2>

                    {loading ? (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                            <LoadingSpinner text="Loading groups…" />
                        </div>
                    ) : groups.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                            <FolderKanban className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                            <p className="text-gray-500 dark:text-gray-400 text-sm">No groups assigned yet.</p>
                        </div>
                    ) : filteredGroups.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                            <Filter className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                            <p className="text-gray-500 dark:text-gray-400 text-sm">No groups match the filters.</p>
                            <button onClick={clearFilters} className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                                Clear filters
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredGroups.map(group => (
                                <div
                                    key={group.id}
                                    onClick={() => setSelectedGroup(group)}
                                    className={`bg-white dark:bg-gray-800 p-4 rounded-xl border cursor-pointer transition hover:shadow-md
                                        ${selectedGroup?.id === group.id
                                            ? "border-gray-900 dark:border-white ring-1 ring-gray-900 dark:ring-white"
                                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                        }`}
                                >
                                    <h3 className="font-medium text-gray-900 dark:text-white text-sm">{group.name}</h3>
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        {group.class_level && (
                                            <span className="text-xs px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-full">
                                                Class {group.class_level}
                                            </span>
                                        )}
                                        {group.subject && (
                                            <span className="text-xs px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-full">
                                                {group.subject}
                                            </span>
                                        )}
                                        <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                                            {group.student_count || 0} students
                                        </span>
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
                            <div className="mb-6 flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedGroup.name}</h2>
                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                        {selectedGroup.class_level && (
                                            <span className="text-xs px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-full">
                                                Class {selectedGroup.class_level}
                                            </span>
                                        )}
                                        {selectedGroup.subject && (
                                            <span className="text-xs px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-full">
                                                {selectedGroup.subject}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-2 text-center flex-shrink-0">
                                    <p className="text-xl font-bold text-gray-900 dark:text-white">{selectedGroup.students?.length || 0}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Students</p>
                                </div>
                            </div>

                            <h3 className="font-medium text-gray-900 dark:text-white mb-3 text-sm">Student List</h3>

                            {!selectedGroup.students || selectedGroup.students.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                    <Users className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                                    <p className="text-sm">No students in this group</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {selectedGroup.students.map((student, idx) => (
                                        <div
                                            key={student.id || idx}
                                            className="flex items-center justify-between p-3 border border-gray-100 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30 transition"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                                                    {(student.name || "?")[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-white text-sm">{student.name}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">{student.email}</p>
                                                </div>
                                            </div>
                                            {student.class_level && (
                                                <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                                                    Class {student.class_level}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                            <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-500 dark:text-gray-400">Select a group to view students</p>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
