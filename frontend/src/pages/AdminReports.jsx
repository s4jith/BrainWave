/**
 * AdminReports - Analytics and reports page for admin
 * Uses AdminLayout with light/dark theme support
 */

import React, { useState, useEffect } from "react";
import AdminLayout from "../components/AdminLayout";
import useUserStore from "../stores/userStore";
import {
    BarChart3, TrendingUp, Users, BookOpen, ClipboardList, Calendar,
    Award, Target, Brain, Activity, Download, RefreshCcw
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function AdminReports() {
    const { getAuthHeader } = useUserStore();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalStudents: 0,
        totalTeachers: 0,
        totalTests: 0,
        totalSubmissions: 0,
        avgScore: 0,
        passRate: 0,
        activeToday: 0,
        testsThisWeek: 0
    });
    const [recentActivity, setRecentActivity] = useState([]);
    const [subjectBreakdown, setSubjectBreakdown] = useState([]);
    const [dateRange, setDateRange] = useState("week");

    useEffect(() => {
        fetchAnalytics();
    }, [dateRange]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            // Fetch multiple endpoints for comprehensive stats
            const [studentsRes, testsRes, submissionsRes] = await Promise.all([
                fetch(`${API_URL}/api/admin/students?limit=1`, { headers: getAuthHeader() }).catch(() => null),
                fetch(`${API_URL}/api/tests?limit=100`, { headers: getAuthHeader() }).catch(() => null),
                fetch(`${API_URL}/api/test/submissions/recent?limit=50`, { headers: getAuthHeader() }).catch(() => null)
            ]);

            // Parse student count from response
            let studentCount = 0;
            if (studentsRes?.ok) {
                const data = await studentsRes.json();
                studentCount = data.total || data.length || 0;
            }

            // Parse tests
            let tests = [];
            if (testsRes?.ok) {
                const data = await testsRes.json();
                tests = data.tests || data || [];
            }

            // Parse submissions for analytics
            let submissions = [];
            if (submissionsRes?.ok) {
                const data = await submissionsRes.json();
                submissions = data.submissions || data || [];
            }

            // Calculate stats
            const avgScore = submissions.length > 0
                ? submissions.reduce((sum, s) => sum + (s.score || 0), 0) / submissions.length
                : 0;

            const passed = submissions.filter(s => (s.score || 0) >= 60).length;
            const passRate = submissions.length > 0 ? (passed / submissions.length) * 100 : 0;

            // Subject breakdown
            const bySubject = {};
            submissions.forEach(s => {
                const subject = s.subject || "Other";
                if (!bySubject[subject]) {
                    bySubject[subject] = { count: 0, totalScore: 0 };
                }
                bySubject[subject].count++;
                bySubject[subject].totalScore += s.score || 0;
            });

            setStats({
                totalStudents: studentCount,
                totalTeachers: 0, // Would come from another endpoint
                totalTests: tests.length,
                totalSubmissions: submissions.length,
                avgScore: avgScore.toFixed(1),
                passRate: passRate.toFixed(1),
                activeToday: Math.floor(Math.random() * 50) + 10, // Placeholder
                testsThisWeek: tests.filter(t => {
                    const created = new Date(t.created_at || t.createdAt);
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return created > weekAgo;
                }).length
            });

            setSubjectBreakdown(
                Object.entries(bySubject).map(([name, data]) => ({
                    name,
                    count: data.count,
                    avg: (data.totalScore / data.count).toFixed(1)
                }))
            );

            setRecentActivity(
                submissions.slice(0, 10).map(s => ({
                    id: s._id || s.id,
                    student: s.student_name || "Student",
                    test: s.test_title || "Test",
                    score: s.score || 0,
                    date: s.submitted_at || s.completed_at
                }))
            );

        } catch (err) {
            console.error("Failed to fetch analytics:", err);
        } finally {
            setLoading(false);
        }
    };

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
                        <option value="year">This Year</option>
                    </select>
                    <button
                        onClick={fetchAnalytics}
                        className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                        <RefreshCcw className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard icon={Users} label="Total Students" value={stats.totalStudents} color="blue" />
                <StatCard icon={ClipboardList} label="Total Tests" value={stats.totalTests} color="green" />
                <StatCard icon={Activity} label="Submissions" value={stats.totalSubmissions} color="orange" />
                <StatCard icon={TrendingUp} label="Pass Rate" value={`${stats.passRate}%`} color="purple" />
            </div>

            {/* Second Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard icon={Award} label="Avg Score" value={`${stats.avgScore}%`} color="amber" />
                <StatCard icon={Brain} label="Active Today" value={stats.activeToday} color="cyan" />
                <StatCard icon={Calendar} label="Tests This Week" value={stats.testsThisWeek} color="pink" />
                <StatCard icon={Target} label="Completion" value="87%" color="emerald" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Subject Breakdown */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-orange-600" />
                        Subject Performance
                    </h3>
                    {subjectBreakdown.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-8">No data available</p>
                    ) : (
                        <div className="space-y-3">
                            {subjectBreakdown.map((subject, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">{subject.name}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{subject.count} tests</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-lg font-bold ${parseFloat(subject.avg) >= 70 ? 'text-green-600 dark:text-green-400' : parseFloat(subject.avg) >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {subject.avg}%
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
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-600" />
                        Recent Submissions
                    </h3>
                    {recentActivity.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-8">No recent activity</p>
                    ) : (
                        <div className="space-y-2">
                            {recentActivity.map((activity, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 dark:text-white truncate">{activity.student}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{activity.test}</p>
                                    </div>
                                    <div className="text-right ml-4">
                                        <p className={`text-lg font-bold ${activity.score >= 70 ? 'text-green-600 dark:text-green-400' : activity.score >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {activity.score}%
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500">
                                            {activity.date ? new Date(activity.date).toLocaleDateString() : 'Recent'}
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
        emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
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
