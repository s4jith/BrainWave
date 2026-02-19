
import React, { useState, useEffect } from "react";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import { BarChart3, TrendingUp, Users, CheckCircle, Search, FileText } from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

export default function TeacherReports() {
    const { getAuthHeader } = useUserStore();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/api/teacher/reports`, { headers: getAuthHeader() });
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            } else {
                console.warn("Using mock report data - endpoint returned error");
                setStats({
                    total_assessments: 0,
                    total_students: 0,
                    avg_score: 0,
                    pass_rate: 0,
                    recent_performance: [],
                    distribution: [
                        { name: "Excellent (>90)", value: 0 },
                        { name: "Good (70-90)", value: 0 },
                        { name: "Average (50-70)", value: 0 },
                        { name: "Needs Improvement (<50)", value: 0 },
                    ],
                    test_reports: []
                });
            }
        } catch (err) {
            console.error("Error fetching reports:", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <AdminLayout title="Reports & Analytics" icon={BarChart3}>
                <div className="flex items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gray-900 dark:border-white"></div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="Reports & Analytics" icon={BarChart3}>
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <StatCard label="Total Tests" value={stats?.total_assessments || 0} icon={FileText} color="text-blue-500" />
                <StatCard label="Students" value={stats?.total_students || 0} icon={Users} color="text-purple-500" />
                <StatCard label="Avg Score" value={`${stats?.avg_score || 0}%`} icon={TrendingUp} color="text-green-500" />
                <StatCard label="Pass Rate" value={`${stats?.pass_rate || 0}%`} icon={CheckCircle} color="text-orange-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Performance Chart */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Recent Performance</h2>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats?.recent_performance || []}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                <XAxis dataKey="name" stroke="#888888" />
                                <YAxis stroke="#888888" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px", color: "#fff" }}
                                />
                                <Bar dataKey="avg" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Average Score" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Score Distribution</h2>
                    <div className="h-80 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats?.distribution || []}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {(stats?.distribution || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Detailed Test Reports</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300">
                            <tr>
                                <th className="px-6 py-4 font-medium text-sm">Test Name</th>
                                <th className="px-6 py-4 font-medium text-sm">Type</th>
                                <th className="px-6 py-4 font-medium text-sm">Date</th>
                                <th className="px-6 py-4 font-medium text-sm">Taken By</th>
                                <th className="px-6 py-4 font-medium text-sm">Avg Score</th>
                                <th className="px-6 py-4 font-medium text-sm">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {(stats?.test_reports || []).length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        No test data available yet. Create assessments and have students take them to see analytics.
                                    </td>
                                </tr>
                            ) : (
                                (stats?.test_reports || []).map((report) => (
                                    <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                        <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">{report.name}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                                report.type === 'AI Test'
                                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                            }`}>{report.type || 'Staff Test'}</span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{report.date}</td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{report.taken_by} Students</td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{report.avg_score}%</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${report.status === 'Completed'
                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                                }`}>{report.status}{report.pending_count > 0 ? ` (${report.pending_count} pending)` : ''}</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </AdminLayout>
    );
}

function StatCard({ label, value, icon: Icon, color }) {
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center ${color}`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            </div>
        </div>
    );
}
