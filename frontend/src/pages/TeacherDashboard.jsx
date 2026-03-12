
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import LoadingSpinner from "../components/LoadingSpinner";
import {
    LayoutDashboard, ClipboardList, CheckCircle, Clock,
    Users, HelpCircle, TrendingUp, BarChart2, FileText, Award
} from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from "recharts";

const API_URL = import.meta.env.VITE_API_URL;

const DIST_COLORS = [
    { fill: "#6366f1", light: "#ede9fe" },
    { fill: "#10b981", light: "#d1fae5" },
    { fill: "#f59e0b", light: "#fef3c7" },
    { fill: "#ef4444", light: "#fee2e2" },
];

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm shadow-xl">
            <p className="font-medium mb-1">{label}</p>
            <p className="text-indigo-300">{payload[0].name}: <span className="font-bold text-white">{payload[0].value}%</span></p>
        </div>
    );
};

export default function TeacherDashboard() {
    const navigate = useNavigate();
    const { user, getAuthHeader } = useUserStore();

    const [stats, setStats] = useState(null);
    const [reports, setReports] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAll();
    }, []);

    useEffect(() => {
        const handleFocus = () => fetchAll();
        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [statsRes, reportsRes] = await Promise.all([
                fetch(`${API_URL}/api/teacher/stats`, { headers: getAuthHeader() }),
                fetch(`${API_URL}/api/teacher/reports`, { headers: getAuthHeader() }),
            ]);
            if (statsRes.ok) {
                const d = await statsRes.json();
                setStats(d);
            }
            if (reportsRes.ok) {
                const d = await reportsRes.json();
                setReports(d);
            }
        } catch (err) {
            console.error("Dashboard fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    const avgScore = reports?.avg_score ?? 0;
    const passRate = reports?.pass_rate ?? 0;
    const totalStudents = reports?.total_students ?? 0;
    // Use total_assessments from reports (authoritative), fall back to stats.my_tests
    const totalTests = reports?.total_assessments ?? stats?.my_tests ?? 0;
    const myQuestions = stats?.my_questions ?? 0;
    const pending = stats?.pending ?? 0;

    const perfData = reports?.recent_performance || [];
    const distData = reports?.distribution || [];
    const testReports = reports?.test_reports || [];

    const hasPerf = perfData.length > 0;
    const hasDist = distData.length > 0 && distData.some(d => d.value > 0);
    const totalDist = distData.reduce((s, d) => s + d.value, 0);

    // count by computed status returned from backend
    const activeTests = testReports.filter(t => t.status === "active").length;
    const completedTests = testReports.filter(t => t.status === "completed" || t.status === "closed").length;

    if (loading) {
        return (
            <AdminLayout title="Teacher Dashboard" icon={LayoutDashboard}>
                <div className="flex items-center justify-center min-h-[400px]">
                    <LoadingSpinner size="lg" text="Loading dashboard…" />
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="Teacher Dashboard" icon={LayoutDashboard}>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                    label="Total Tests"
                    value={totalTests}
                    icon={ClipboardList}
                    gradient="from-indigo-500 to-indigo-600"
                    bg="bg-indigo-50 dark:bg-indigo-900/20"
                    sub={`${activeTests} active · ${completedTests} completed`}
                />
                <StatCard
                    label="Total Students"
                    value={totalStudents}
                    icon={Users}
                    gradient="from-emerald-500 to-emerald-600"
                    bg="bg-emerald-50 dark:bg-emerald-900/20"
                    sub="Across all groups"
                />
                <StatCard
                    label="Average Score"
                    value={`${avgScore}%`}
                    icon={TrendingUp}
                    gradient="from-amber-500 to-amber-600"
                    bg="bg-amber-50 dark:bg-amber-900/20"
                    sub="Across all tests"
                />
                <StatCard
                    label="Pass Rate"
                    value={`${passRate}%`}
                    icon={Award}
                    gradient="from-rose-500 to-rose-600"
                    bg="bg-rose-50 dark:bg-rose-900/20"
                    sub="Students passing"
                />
            </div>

            {/* Secondary row: Questions + Pending */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                        <HelpCircle className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{myQuestions}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Questions Created</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-orange-500">{pending}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Pending Evaluations</p>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
                {/* Bar Chart — Recent Performance */}
                <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="mb-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Recent Test Performance</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Average score per test</p>
                    </div>
                    {hasPerf ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={perfData} barSize={32} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#818cf8" stopOpacity={0.7} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(99,102,241,0.07)" }} />
                                <Bar dataKey="avg" name="Avg Score" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[220px] text-gray-400 dark:text-gray-600">
                            <BarChart2 className="w-10 h-10 mb-2" />
                            <p className="text-sm">No performance data yet</p>
                        </div>
                    )}
                </div>

                {/* Donut — Score Distribution */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="mb-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Score Distribution</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Student performance bands</p>
                    </div>
                    {hasDist ? (
                        <div className="flex flex-col items-center gap-4">
                            <ResponsiveContainer width="100%" height={160}>
                                <PieChart>
                                    <Pie data={distData} cx="50%" cy="50%" innerRadius={48} outerRadius={72}
                                        dataKey="value" strokeWidth={0}>
                                        {distData.map((_, i) => (
                                            <Cell key={i} fill={DIST_COLORS[i % DIST_COLORS.length].fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(v, n) => [`${v} students`, n]} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="w-full space-y-2">
                                {distData.map((d, i) => {
                                    const pct = totalDist > 0 ? Math.round((d.value / totalDist) * 100) : 0;
                                    const c = DIST_COLORS[i % DIST_COLORS.length];
                                    return (
                                        <div key={i} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.fill }} />
                                                <span className="text-gray-600 dark:text-gray-400">{d.name}</span>
                                            </div>
                                            <span className="font-semibold text-gray-900 dark:text-white">{d.value} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[220px] text-gray-400 dark:text-gray-600">
                            <CheckCircle className="w-10 h-10 mb-2" />
                            <p className="text-sm">No distribution data yet</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Tests Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">Recent Tests</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Latest assessments and their results</p>
                    </div>
                    <button onClick={() => navigate("/teacher-tests")}
                        className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                        View All
                    </button>
                </div>
                {testReports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-gray-400 dark:text-gray-600">
                        <FileText className="w-10 h-10 mb-2" />
                        <p className="text-sm">No tests found. Create your first test!</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                    <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Test Name</th>
                                    <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Students</th>
                                    <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Avg Score</th>
                                    <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Status</th>
                                    <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {testReports.slice(0, 6).map((t, i) => {
                                    const score = t.avg_score ?? 0;
                                    const barColor = score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-500";
                                    const statusStyle = t.status === "active" || t.status === "published"
                                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                        : t.status === "upcoming"
                                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400";
                                    return (
                                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">{t.name}</td>
                                            <td className="px-6 py-3 text-gray-600 dark:text-gray-400">{t.taken_by}</td>
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-20 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${score}%` }} />
                                                    </div>
                                                    <span className="text-gray-700 dark:text-gray-300 font-medium text-xs">{score}%</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle}`}>{t.status}</span>
                                            </td>
                                            <td className="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs">{t.date ? new Date(t.date).toLocaleDateString() : "-"}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

function StatCard({ label, value, icon: Icon, gradient, bg, sub }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                    <Icon className="w-4 h-4 text-white" />
                </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
        </div>
    );
}
