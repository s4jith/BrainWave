/**
 * AdminReports - Analytics and reports page for admin
 * Uses AdminLayout with light/dark theme support
 * Fetches REAL data from /api/admin/analytics endpoint
 */

import React, { useState, useEffect } from "react";
import AdminLayout from "../components/AdminLayout";
import useUserStore from "../stores/userStore";
import {
    BarChart3, TrendingUp, Users, BookOpen, ClipboardList, Calendar,
    Award, Target, AlertTriangle, Activity, Download, RefreshCcw, UserCheck, UserX
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function AdminReports() {
    const { getAuthHeader } = useUserStore();
    const [loading, setLoading] = useState(true);
    const [analytics, setAnalytics] = useState(null);
    const [dateRange, setDateRange] = useState("week");
    const [classFilter, setClassFilter] = useState("all");
    const [subjectFilter, setSubjectFilter] = useState("all");

    useEffect(() => {
        fetchAnalytics();
    }, [dateRange]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/admin/analytics`, {
                headers: getAuthHeader()
            });

            if (response.ok) {
                const data = await response.json();
                setAnalytics(data);
            } else {
                console.error("Failed to fetch analytics");
                setAnalytics(null);
            }
        } catch (err) {
            console.error("Failed to fetch analytics:", err);
            setAnalytics(null);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <AdminLayout title="Reports & Analytics" icon={BarChart3}>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-gray-900 dark:border-white"></div>
                </div>
            </AdminLayout>
        );
    }

    const userStats = analytics?.user_stats || {};
    const testStats = analytics?.test_stats || {};
    const subjectStats = analytics?.subject_stats || [];
    const topPerformers = analytics?.top_performers || [];
    const weakStudents = analytics?.weak_students || [];
    const recentActivities = analytics?.recent_activities || [];

    // Get unique classes and subjects for filter dropdowns
    const uniqueClasses = [...new Set(recentActivities.map(a => a.class_level).filter(Boolean))].sort((a, b) => a - b);
    const uniqueSubjects = [...new Set(recentActivities.map(a => a.subject).filter(Boolean))];

    // Filter recent activities
    const filteredActivities = recentActivities.filter(activity => {
        const matchesClass = classFilter === "all" || activity.class_level === parseInt(classFilter);
        const matchesSubject = subjectFilter === "all" || activity.subject === subjectFilter;
        return matchesClass && matchesSubject;
    });

    return (
        <AdminLayout title="Reports & Analytics" icon={BarChart3}>
            {/* Header with Date Range */}
            <div className="flex justify-between items-center mb-6">
                <p className="text-gray-500 dark:text-gray-400">
                    Platform performance and student analytics
                </p>
                <div className="flex items-center gap-3">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm"
                    >
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                    </select>
                    <button
                        onClick={fetchAnalytics}
                        className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                        <RefreshCcw className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                </div>
            </div>

            {/* Stats Grid - Row 1: User Activity Focus */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard icon={Users} label="Total Students" value={userStats.total_students || 0} color="blue" />
                <StatCard icon={UserCheck} label="Active This Week" value={userStats.active_this_week || 0} color="green" />
                <StatCard icon={UserX} label="Inactive Users" value={userStats.inactive_users || 0} color="red" />
                <StatCard icon={TrendingUp} label="New This Month" value={userStats.new_users_this_month || 0} color="purple" />
            </div>

            {/* Stats Grid - Row 2: Test Performance Focus */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard icon={Award} label="Avg Score" value={`${testStats.average_score || 0}%`} color="amber" />
                <StatCard icon={Target} label="Pass Rate" value={`${testStats.pass_rate || 0}%`} color="emerald" />
                <StatCard icon={ClipboardList} label="Tests This Week" value={testStats.tests_this_week || 0} color="cyan" />
                <StatCard icon={Activity} label="In Progress" value={testStats.tests_in_progress || 0} color="pink" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Top Performers */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Award className="w-5 h-5 text-yellow-500" />
                        Top Performers
                    </h3>
                    {topPerformers.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-8">No data available</p>
                    ) : (
                        <div className="space-y-3">
                            {topPerformers.map((student, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-600' : 'bg-gray-300'}`}>
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">{student.name}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{student.tests_completed} tests</p>
                                        </div>
                                    </div>
                                    <p className="text-lg font-bold text-green-600 dark:text-green-400">{student.avg_score}%</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Students Needing Help */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                        Students Needing Attention
                    </h3>
                    {weakStudents.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-8">All students performing well!</p>
                    ) : (
                        <div className="space-y-3">
                            {weakStudents.map((student, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-800/30">
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">{student.name}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {student.days_inactive > 0 ? `${student.days_inactive} days inactive` : 'Recently active'}
                                        </p>
                                    </div>
                                    <p className="text-lg font-bold text-red-600 dark:text-red-400">{student.avg_score}%</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Subject Breakdown */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-orange-600" />
                        Subject Performance
                    </h3>
                    {subjectStats.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-8">No data available</p>
                    ) : (
                        <div className="space-y-3">
                            {subjectStats.map((subject, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">{subject.subject || 'Unknown'}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{subject.total_tests} tests • {subject.total_students} students</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-lg font-bold ${(subject.avg_score || 0) >= 70 ? 'text-green-600 dark:text-green-400' : (subject.avg_score || 0) >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {subject.avg_score || 0}%
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500">avg score</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Activity */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Activity className="w-5 h-5 text-blue-600" />
                            Recent Test Completions
                        </h3>
                        <div className="flex gap-2">
                            <select
                                value={classFilter}
                                onChange={(e) => setClassFilter(e.target.value)}
                                className="px-2 py-1 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                            >
                                <option value="all">All Classes</option>
                                {uniqueClasses.map(c => (
                                    <option key={c} value={c}>Class {c}</option>
                                ))}
                            </select>
                            <select
                                value={subjectFilter}
                                onChange={(e) => setSubjectFilter(e.target.value)}
                                className="px-2 py-1 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                            >
                                <option value="all">All Subjects</option>
                                {uniqueSubjects.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {filteredActivities.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-8">No matching activities</p>
                    ) : (
                        <div className="space-y-2">
                            {filteredActivities.slice(0, 10).map((activity, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-gray-900 dark:text-white truncate">{activity.student_name || 'Unknown Student'}</p>
                                            {activity.class_level && (
                                                <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">Class {activity.class_level}</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{activity.subject || 'Test'}</p>
                                    </div>
                                    <div className="text-right ml-4">
                                        <p className={`text-lg font-bold ${(activity.score || 0) >= 70 ? 'text-green-600 dark:text-green-400' : (activity.score || 0) >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {activity.score || 0}%
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500">
                                            {activity.created_at ? new Date(activity.created_at).toLocaleDateString() : 'Recent'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Export Button */}
            <div className="mt-6 flex justify-end">
                <button className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition flex items-center gap-2 font-medium">
                    <Download className="w-4 h-4" /> Export Report
                </button>
            </div>
        </AdminLayout>
    );
}

// Stat Card Component
function StatCard({ icon: Icon, label, value, color }) {
    const colorClasses = {
        blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
        green: "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400",
        orange: "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400",
        purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
        amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
        cyan: "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400",
        pink: "bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400",
        emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
        red: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colorClasses[color]}`}>
                <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{label}</p>
        </div>
    );
}
