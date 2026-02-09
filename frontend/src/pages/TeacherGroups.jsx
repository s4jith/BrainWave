/**
 * TeacherGroups - View assigned student groups
 * Uses AdminLayout
 */

import React, { useState, useEffect } from "react";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import { Users, Search, FolderKanban } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function TeacherGroups() {
    const { getAuthHeader } = useUserStore();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        fetchTeacherGroups();
    }, []);

    const fetchTeacherGroups = async () => {
        try {
            setLoading(true);
            // innovative: we will use a specific endpoint for teacher's groups
            const response = await fetch(`${API_URL}/api/teacher/groups`, {
                headers: getAuthHeader()
            });

            if (response.ok) {
                const data = await response.json();
                setGroups(data.groups || []);
            } else {
                // Fallback for development/demo until backend is ready
                console.warn("Using mock group data");
                setGroups([]);
            }
        } catch (err) {
            console.error("Error fetching groups:", err);
        } finally {
            setLoading(false);
        }
    };

    const filteredGroups = groups.filter(g => g.name?.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <AdminLayout title="Student Groups" icon={Users}>
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search your groups..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Group List */}
                <div className="lg:col-span-1 space-y-3">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">Your Groups</h2>
                    {loading ? (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gray-900 dark:border-white mx-auto"></div>
                        </div>
                    ) : filteredGroups.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                            <FolderKanban className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                            <p className="text-gray-500 dark:text-gray-400">No groups assigned yet.</p>
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
                                    <h3 className="font-medium text-gray-900 dark:text-white">{group.name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{group.student_count || 0} students</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Group Details */}
                <div className="lg:col-span-2">
                    {selectedGroup ? (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                            <div className="mb-6">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedGroup.name}</h2>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">Assigned Group</p>
                            </div>

                            <h3 className="font-medium text-gray-900 dark:text-white mb-4">Students ({selectedGroup.students?.length || 0})</h3>

                            {!selectedGroup.students || selectedGroup.students.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">No students in this group</div>
                            ) : (
                                <div className="space-y-2">
                                    {selectedGroup.students.map((student, idx) => (
                                        <div key={student.id || idx} className="flex items-center justify-between p-3 border border-gray-100 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">{student.name}</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">{student.email} • Class {student.class_level}</p>
                                            </div>
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
