
import React, { useState, useEffect, useCallback } from "react";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import LoadingSpinner from "../components/LoadingSpinner";
import {
    BarChart3, BookOpen, GraduationCap, Users, FileText,
    CheckCircle, Clock, XCircle, RefreshCw, TrendingUp
} from "lucide-react";
import authFetch from "../utils/authFetch";

const API_URL = import.meta.env.VITE_API_URL;

export default function HeadReports() {
    const { getAuthHeader } = useUserStore();
    const [reports, setReports] = useState(null);
    const [assignment, setAssignment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeSection, setActiveSection] = useState("overview");

    const fetchAssignment = useCallback(async () => {
        try {
            const res = await authFetch(`${API_URL}/api/head/my-assignment`, {
                headers: getAuthHeader()
            });
            if (res.ok) setAssignment(await res.json());
        } catch (err) {
            console.error("Error fetching assignment:", err);
        }
    }, [getAuthHeader]);

    const fetchReports = useCallback(async () => {
        try {
            const res = await authFetch(`${API_URL}/api/head/reports`, {
                headers: getAuthHeader()
            });
            if (res.ok) {
                setReports(await res.json());
            } else {
                throw new Error("Failed to fetch reports");
            }
        } catch (err) {
            setError(err.message);
        }
    }, [getAuthHeader]);

    const loadAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        await Promise.all([fetchAssignment(), fetchReports()]);
        setLoading(false);
    }, [fetchAssignment, fetchReports]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    if (loading) {
        return (
            <AdminLayout title="Reports" icon={BarChart3}>
                <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>
            </AdminLayout>
        );
    }

    const overview = reports?.overview || {};

    return (
        <AdminLayout title="Reports" icon={BarChart3}>
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Assignment Info */}
                {assignment && (
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4 flex items-center gap-3 flex-wrap">
                        {assignment.assignment_type === "subject" ? (
                            <>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                                    <BookOpen className="w-4 h-4" /> Reports for subjects:
                                </span>
                                {(assignment.assigned_subjects || []).map(s => (
                                    <span key={s} className="px-2.5 py-1 rounded-lg text-sm bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800">{s}</span>
                                ))}
                            </>
                        ) : (
                            <>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                                    <GraduationCap className="w-4 h-4" /> Reports for classes:
                                </span>
                                {(assignment.assigned_classes || []).map(c => (
                                    <span key={c} className="px-2.5 py-1 rounded-lg text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800">Class {c}</span>
                                ))}
                            </>
                        )}
                        <button
                            onClick={loadAll}
                            className="ml-auto px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-1"
                        >
                            <RefreshCw className="w-3.5 h-3.5" /> Refresh
                        </button>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl">
                        {error}
                    </div>
                )}

                {/* Section Tabs */}
                <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-1.5">
                    {["overview", "subjects", "teachers"].map(section => (
                        <button
                            key={section}
                            onClick={() => setActiveSection(section)}
                            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition capitalize ${activeSection === section ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"}`}
                        >
                            {section}
                        </button>
                    ))}
                </div>

                {/* Overview Section */}
                {activeSection === "overview" && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                        <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{overview.total_groups || 0}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Groups</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                        <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{overview.total_students || 0}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Students</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                        <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{(reports?.teacher_performance || []).length}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Total Teachers</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{(overview.approved_papers || 0) + (overview.pending_papers || 0)}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Total Papers</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Question Status Breakdown */}
                        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Question Status</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center p-4 bg-green-50 dark:bg-green-900/10 rounded-xl">
                                    <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">{overview.approved_questions || 0}</p>
                                    <p className="text-sm text-green-600 dark:text-green-500">Approved</p>
                                </div>
                                <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl">
                                    <Clock className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                                    <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{overview.pending_questions || 0}</p>
                                    <p className="text-sm text-orange-600 dark:text-orange-500">Pending</p>
                                </div>
                                <div className="text-center p-4 bg-red-50 dark:bg-red-900/10 rounded-xl">
                                    <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                                    <p className="text-2xl font-bold text-red-700 dark:text-red-400">{overview.rejected_questions || 0}</p>
                                    <p className="text-sm text-red-600 dark:text-red-500">Rejected</p>
                                </div>
                            </div>
                            {overview.total_questions > 0 && (
                                <div className="mt-4">
                                    <div className="w-full bg-gray-200 dark:bg-zinc-800 rounded-full h-3 overflow-hidden">
                                        <div className="h-full flex">
                                            <div
                                                className="bg-green-500 h-full"
                                                style={{ width: `${(overview.approved_questions / overview.total_questions) * 100}%` }}
                                            />
                                            <div
                                                className="bg-orange-400 h-full"
                                                style={{ width: `${(overview.pending_questions / overview.total_questions) * 100}%` }}
                                            />
                                            <div
                                                className="bg-red-400 h-full"
                                                style={{ width: `${(overview.rejected_questions / overview.total_questions) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        <span>{Math.round((overview.approved_questions / overview.total_questions) * 100)}% approved</span>
                                        <span>{Math.round((overview.pending_questions / overview.total_questions) * 100)}% pending</span>
                                        <span>{Math.round((overview.rejected_questions / overview.total_questions) * 100)}% rejected</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Subject Breakdown */}
                {activeSection === "subjects" && (
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
                        <div className="p-6 border-b border-gray-200 dark:border-zinc-800">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Subject-wise Breakdown</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Questions by subject and status</p>
                        </div>
                        {(reports?.subject_breakdown || []).length === 0 ? (
                            <div className="p-12 text-center text-gray-400">No data available</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-zinc-800/50">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Subject</th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Total</th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Approved</th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Pending</th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Rejected</th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Approval Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                        {(reports?.subject_breakdown || []).map((row) => (
                                            <tr key={row.subject} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <BookOpen className="w-4 h-4 text-gray-400" />
                                                        <span className="font-medium text-gray-900 dark:text-white">{row.subject}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center font-semibold text-gray-900 dark:text-white">{row.total}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">{row.approved}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">{row.pending}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">{row.rejected}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <div className="w-16 bg-gray-200 dark:bg-zinc-800 rounded-full h-2">
                                                            <div
                                                                className="bg-green-500 h-2 rounded-full"
                                                                style={{ width: `${row.total > 0 ? (row.approved / row.total) * 100 : 0}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-sm text-gray-600 dark:text-gray-300">{row.total > 0 ? Math.round((row.approved / row.total) * 100) : 0}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Teacher Performance */}
                {activeSection === "teachers" && (
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
                        <div className="p-6 border-b border-gray-200 dark:border-zinc-800">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Teacher Performance</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Question creation and approval rates by teacher</p>
                        </div>
                        {(reports?.teacher_performance || []).length === 0 ? (
                            <div className="p-12 text-center text-gray-400">No teacher data available</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-zinc-800/50">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Teacher</th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Total</th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Approved</th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Pending</th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Rejected</th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Approval Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                        {(reports?.teacher_performance || []).map((teacher, idx) => (
                                            <tr key={teacher.teacher_id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                                                            {idx + 1}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-gray-900 dark:text-white">{teacher.teacher_name}</p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">{teacher.teacher_id}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center font-semibold text-gray-900 dark:text-white">{teacher.total_questions}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-green-600 dark:text-green-400 font-medium">{teacher.approved}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-orange-600 dark:text-orange-400 font-medium">{teacher.pending}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-red-600 dark:text-red-400 font-medium">{teacher.rejected}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <div className="w-16 bg-gray-200 dark:bg-zinc-800 rounded-full h-2">
                                                            <div
                                                                className="bg-green-500 h-2 rounded-full"
                                                                style={{ width: `${teacher.approval_rate}%` }}
                                                            />
                                                        </div>
                                                        <span className={`text-sm font-medium ${teacher.approval_rate >= 70 ? "text-green-600 dark:text-green-400" : teacher.approval_rate >= 40 ? "text-orange-600 dark:text-orange-400" : "text-red-600 dark:text-red-400"}`}>
                                                            {teacher.approval_rate}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
