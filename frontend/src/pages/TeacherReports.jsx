
import React, { useState, useEffect } from "react";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import LoadingSpinner from "../components/LoadingSpinner";
import { BarChart3, TrendingUp, Users, CheckCircle, FileText, Award } from "lucide-react";
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
} from "recharts";
import authFetch from "../utils/authFetch";

const API_URL = import.meta.env.VITE_API_URL;

const DIST_COLORS = [
    { fill: "#6366f1", light: "bg-indigo-50 dark:bg-indigo-900/20", text: "text-indigo-600 dark:text-indigo-400" },
    { fill: "#10b981", light: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-600 dark:text-emerald-400" },
    { fill: "#f59e0b", light: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-600 dark:text-amber-400" },
    { fill: "#ef4444", light: "bg-red-50 dark:bg-red-900/20", text: "text-red-600 dark:text-red-400" },
];

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-gray-900 dark:bg-gray-700 text-white px-3 py-2 rounded-lg shadow-lg text-sm border border-gray-700 dark:border-gray-600">
                <p className="font-medium mb-1">{label}</p>
                {payload.map((p, i) => (
                    <p key={i} style={{ color: p.color }}>{p.name}: {p.value}%</p>
                ))}
            </div>
        );
    }
    return null;
};

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
            const response = await authFetch(`${API_URL}/api/teacher/reports`, { headers: getAuthHeader() });
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            } else {
                setStats({
                    total_assessments: 0, total_students: 0, avg_score: 0, pass_rate: 0,
                    recent_performance: [], distribution: [
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
                    <LoadingSpinner size="lg" text="Loading analytics…" />
                </div>
            </AdminLayout>
        );
    }

    const hasPerformanceData = (stats?.recent_performance || []).length > 0;
    const hasDistributionData = (stats?.distribution || []).some(d => d.value > 0);
    const totalDistribution = (stats?.distribution || []).reduce((s, d) => s + d.value, 0);

    return (
        <AdminLayout title="Reports & Analytics" icon={BarChart3}>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                    label="Total Tests" value={stats?.total_assessments || 0}
                    icon={FileText}
                    gradient="from-indigo-500 to-indigo-600"
                    bg="bg-indigo-50 dark:bg-indigo-900/20"
                />
                <StatCard
                    label="Students" value={stats?.total_students || 0}
                    icon={Users}
                    gradient="from-emerald-500 to-emerald-600"
                    bg="bg-emerald-50 dark:bg-emerald-900/20"
                />
                <StatCard
                    label="Avg Score" value={`${stats?.avg_score || 0}%`}
                    icon={TrendingUp}
                    gradient="from-amber-500 to-amber-600"
                    bg="bg-amber-50 dark:bg-amber-900/20"
                />
                <StatCard
                    label="Pass Rate" value={`${stats?.pass_rate || 0}%`}
                    icon={CheckCircle}
                    gradient="from-rose-500 to-rose-600"
                    bg="bg-rose-50 dark:bg-rose-900/20"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
                {/* Recent Performance – Area Chart */}
                <div className="lg:col-span-3 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Recent Performance</h2>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Latest test scores trend</p>
                        </div>
                        {hasPerformanceData && (
                            <span className="text-xs px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full">
                                {stats.recent_performance.length} tests
                            </span>
                        )}
                    </div>

                    {!hasPerformanceData ? (
                        <div className="flex flex-col items-center justify-center h-52 text-center">
                            <BarChart3 className="w-10 h-10 text-gray-200 dark:text-gray-700 mb-3" />
                            <p className="text-sm text-gray-400 dark:text-gray-500">No test data yet</p>
                            <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Create assessments and have students take them</p>
                        </div>
                    ) : (
                        <div className="h-52">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats.recent_performance} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156,163,175,0.2)" />
                                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#6366f1", strokeWidth: 1, strokeDasharray: "4 4" }} />
                                    <Area
                                        type="monotone"
                                        dataKey="avg"
                                        stroke="#6366f1"
                                        strokeWidth={2.5}
                                        fill="url(#perfGrad)"
                                        dot={{ fill: "#6366f1", r: 4, strokeWidth: 0 }}
                                        activeDot={{ r: 6, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }}
                                        name="Avg Score"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Score Distribution – Donut + custom legend */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="mb-4">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Score Distribution</h2>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Student performance bands</p>
                    </div>

                    {!hasDistributionData ? (
                        <div className="flex flex-col items-center justify-center h-52 text-center">
                            <Award className="w-10 h-10 text-gray-200 dark:text-gray-700 mb-3" />
                            <p className="text-sm text-gray-400 dark:text-gray-500">No scores yet</p>
                        </div>
                    ) : (
                        <>
                            <div className="h-36">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={stats.distribution}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={42}
                                            outerRadius={64}
                                            paddingAngle={3}
                                            dataKey="value"
                                            strokeWidth={0}
                                        >
                                            {stats.distribution.map((_, i) => (
                                                <Cell key={i} fill={DIST_COLORS[i % DIST_COLORS.length].fill} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(v) => [`${v} students (${totalDistribution ? Math.round(v/totalDistribution*100) : 0}%)`, ""]}
                                            contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px", color: "#fff", fontSize: "12px" }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            {/* Legend */}
                            <div className="space-y-2 mt-2">
                                {stats.distribution.map((item, i) => {
                                    const pct = totalDistribution ? Math.round((item.value / totalDistribution) * 100) : 0;
                                    return (
                                        <div key={i} className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: DIST_COLORS[i].fill }} />
                                            <span className="text-xs text-gray-600 dark:text-gray-400 flex-1 truncate">{item.name}</span>
                                            <span className="text-xs font-semibold text-gray-900 dark:text-white">{item.value}</span>
                                            <span className="text-xs text-gray-400 dark:text-gray-500 w-8 text-right">{pct}%</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Detailed Test Reports Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">Detailed Test Reports</h2>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Per-test breakdown with submission counts and averages</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                {["Test Name", "Type", "Date", "Taken By", "Avg Score", "Status"].map(h => (
                                    <th key={h} className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {(stats?.test_reports || []).length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center">
                                        <FileText className="w-10 h-10 mx-auto text-gray-200 dark:text-gray-700 mb-3" />
                                        <p className="text-sm text-gray-500 dark:text-gray-400">No test data available yet.</p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                            Create assessments and have <span className="text-indigo-500">students</span> take them to see analytics.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                (stats.test_reports).map((report) => (
                                    <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white max-w-[200px] truncate">{report.name}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                                report.type === "AI Test"
                                                    ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                                                    : "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                            }`}>{report.type || "Staff Test"}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{report.date || "–"}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{report.taken_by} students</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 max-w-[60px] h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${report.avg_score >= 70 ? "bg-emerald-500" : report.avg_score >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                                                        style={{ width: `${Math.min(report.avg_score, 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm font-semibold text-gray-900 dark:text-white">{report.avg_score}%</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                                report.status === "Completed"
                                                    ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                                                    : report.status === "No submissions"
                                                    ? "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                                                    : "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                                            }`}>
                                                {report.status}{report.pending_count > 0 ? ` (${report.pending_count} pending)` : ""}
                                            </span>
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

function StatCard({ label, value, icon: Icon, gradient, bg }) {
    return (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <div className={`w-full h-full rounded-xl bg-gradient-to-br ${gradient} opacity-90 flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                </div>
            </div>
            <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">{value}</p>
            </div>
        </div>
    );
}
