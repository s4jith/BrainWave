
import React, { useState, useEffect, useCallback, useMemo } from "react";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import { ReportsPageSkeleton } from "../components/LoadingSpinner";
import {
    BarChart3, BookOpen, GraduationCap, Users, FileText,
    CheckCircle, RefreshCw, TrendingUp, Award
} from "lucide-react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import authFetch from "../utils/authFetch";

const API_URL = import.meta.env.VITE_API_URL;

const DIST_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444"];

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

export default function HeadReports() {
    const { getAuthHeader } = useUserStore();
    const [assignment, setAssignment] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("");
    const [studentSummaries, setStudentSummaries] = useState([]);
    const [loadingStudentSummaries, setLoadingStudentSummaries] = useState(false);
    const [studentDetail, setStudentDetail] = useState(null);
    const [loadingStudentDetail, setLoadingStudentDetail] = useState(false);

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

    const fetchTestAnalytics = useCallback(async (classFilter, subjectFilter) => {
        try {
            const params = new URLSearchParams();
            if (classFilter) params.set("class_level", classFilter);
            if (subjectFilter) params.set("subject", subjectFilter);

            const url = `${API_URL}/api/head/reports/test-analytics${params.toString() ? `?${params.toString()}` : ""}`;
            const res = await authFetch(url, {
                headers: getAuthHeader()
            });
            if (res.ok) {
                setAnalytics(await res.json());
            } else {
                throw new Error("Failed to fetch test analytics");
            }
        } catch (err) {
            setError(err.message);
        }
    }, [getAuthHeader]);

    const fetchStudentSummaries = useCallback(async (classFilter, subjectFilter) => {
        try {
            setLoadingStudentSummaries(true);
            const params = new URLSearchParams();
            if (classFilter) params.set("class_level", classFilter);
            if (subjectFilter) params.set("subject", subjectFilter);

            const url = `${API_URL}/api/head/reports/student-results${params.toString() ? `?${params.toString()}` : ""}`;
            const res = await authFetch(url, {
                headers: getAuthHeader()
            });
            if (!res.ok) {
                throw new Error("Failed to fetch student results");
            }
            const data = await res.json();
            setStudentSummaries(data.students || []);
        } catch (err) {
            setError(err.message);
            setStudentSummaries([]);
        } finally {
            setLoadingStudentSummaries(false);
        }
    }, [getAuthHeader]);

    const fetchStudentDetail = useCallback(async (studentId) => {
        try {
            setLoadingStudentDetail(true);
            const params = new URLSearchParams();
            if (selectedClass) params.set("class_level", selectedClass);
            if (selectedSubject) params.set("subject", selectedSubject);

            const url = `${API_URL}/api/head/reports/student-results/${studentId}${params.toString() ? `?${params.toString()}` : ""}`;
            const res = await authFetch(url, {
                headers: getAuthHeader()
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.detail || "Failed to fetch student result detail");
            }
            setStudentDetail(await res.json());
        } catch (err) {
            setError(err.message);
            setStudentDetail(null);
        } finally {
            setLoadingStudentDetail(false);
        }
    }, [getAuthHeader, selectedClass, selectedSubject]);

    const loadAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        await Promise.all([
            fetchAssignment(),
            fetchTestAnalytics(selectedClass, selectedSubject),
            fetchStudentSummaries(selectedClass, selectedSubject)
        ]);
        setLoading(false);
    }, [fetchAssignment, fetchTestAnalytics, fetchStudentSummaries, selectedClass, selectedSubject]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    useEffect(() => {
        setStudentDetail(null);
    }, [selectedClass, selectedSubject]);

    const classOptions = useMemo(() => Array.from(new Set([
        ...(assignment?.assigned_classes || []),
        ...((analytics?.available_classes || []).filter((c) => c !== null && c !== undefined))
    ])).sort((a, b) => a - b), [assignment, analytics]);

    const subjectOptions = useMemo(() => Array.from(new Set([
        ...(assignment?.head_subjects || []),
        ...(assignment?.assigned_subjects || []),
        ...((analytics?.available_subjects || []).filter(Boolean))
    ])).sort((a, b) => a.localeCompare(b)), [assignment, analytics]);

    const hasPerformanceData = (analytics?.recent_performance || []).length > 0;
    const hasDistributionData = (analytics?.distribution || []).some(d => d.value > 0);
    const totalDistribution = (analytics?.distribution || []).reduce((sum, row) => sum + row.value, 0);

    if (loading) {
        return (
            <AdminLayout title="Reports & Analytics" icon={BarChart3}>
                <ReportsPageSkeleton />
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="Reports & Analytics" icon={BarChart3}>
            <div className="max-w-7xl mx-auto space-y-6">
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

                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4 flex flex-col md:flex-row gap-3 md:items-end">
                    <div className="min-w-40">
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Class</label>
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white px-3 py-2 text-sm"
                        >
                            <option value="">All classes</option>
                            {classOptions.map((c) => (
                                <option key={c} value={c}>Class {c}</option>
                            ))}
                        </select>
                    </div>
                    <div className="min-w-48">
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Subject</label>
                        <select
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white px-3 py-2 text-sm"
                        >
                            <option value="">All subjects</option>
                            {subjectOptions.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={loadAll}
                        className="md:ml-auto px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                    >
                        Apply Filters
                    </button>
                </div>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <StatCard label="Total Tests" value={analytics?.total_assessments || 0} icon={FileText} gradient="from-indigo-500 to-indigo-600" bg="bg-indigo-50 dark:bg-indigo-900/20" />
                    <StatCard label="Students" value={analytics?.total_students || 0} icon={Users} gradient="from-emerald-500 to-emerald-600" bg="bg-emerald-50 dark:bg-emerald-900/20" />
                    <StatCard label="Teachers" value={analytics?.total_teachers || 0} icon={Users} gradient="from-violet-500 to-violet-600" bg="bg-violet-50 dark:bg-violet-900/20" />
                    <StatCard label="Avg Score" value={`${analytics?.avg_score || 0}%`} icon={TrendingUp} gradient="from-amber-500 to-amber-600" bg="bg-amber-50 dark:bg-amber-900/20" />
                    <StatCard label="Pass Rate" value={`${analytics?.pass_rate || 0}%`} icon={CheckCircle} gradient="from-rose-500 to-rose-600" bg="bg-rose-50 dark:bg-rose-900/20" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3 bg-white dark:bg-zinc-900 p-6 rounded-xl border border-gray-200 dark:border-zinc-800">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Recent Performance</h2>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Latest test scores trend</p>
                            </div>
                            {hasPerformanceData && (
                                <span className="text-xs px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full">
                                    {analytics.recent_performance.length} tests
                                </span>
                            )}
                        </div>

                        {!hasPerformanceData ? (
                            <div className="flex flex-col items-center justify-center h-52 text-center">
                                <BarChart3 className="w-10 h-10 text-gray-200 dark:text-gray-700 mb-3" />
                                <p className="text-sm text-gray-400 dark:text-gray-500">No test data yet</p>
                            </div>
                        ) : (
                            <div className="h-52">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={analytics.recent_performance} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="perfGradHead" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156,163,175,0.25)" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area
                                            type="monotone"
                                            dataKey="avg"
                                            stroke="#4f46e5"
                                            strokeWidth={3}
                                            fill="url(#perfGradHead)"
                                            dot={{ fill: "#4f46e5", r: 4, strokeWidth: 0 }}
                                            activeDot={{ r: 7, fill: "#4f46e5", stroke: "#fff", strokeWidth: 2 }}
                                            name="Avg Score"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-xl border border-gray-200 dark:border-zinc-800">
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
                                                data={analytics.distribution}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={42}
                                                outerRadius={64}
                                                paddingAngle={3}
                                                dataKey="value"
                                                strokeWidth={0}
                                            >
                                                {analytics.distribution.map((_, i) => (
                                                    <Cell key={i} fill={DIST_COLORS[i % DIST_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(v) => [`${v} students (${totalDistribution ? Math.round((v / totalDistribution) * 100) : 0}%)`, ""]}
                                                contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px", color: "#fff", fontSize: "12px" }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="space-y-2 mt-2">
                                    {(analytics?.distribution || []).map((item, i) => {
                                        const pct = totalDistribution ? Math.round((item.value / totalDistribution) * 100) : 0;
                                        return (
                                            <div key={i} className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: DIST_COLORS[i % DIST_COLORS.length] }} />
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

                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-800">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Detailed Test Reports</h2>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Teacher-style analytics for tests in your assigned class/subject scope</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-zinc-800/50">
                                <tr>
                                    {["Test Name", "Class", "Subject", "Date", "Taken By", "Avg Score", "Status"].map(h => (
                                        <th key={h} className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {(analytics?.test_reports || []).length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-12 text-center text-gray-400">No test data available for selected filters</td>
                                    </tr>
                                ) : (
                                    (analytics?.test_reports || []).map((report) => (
                                        <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white max-w-[260px] truncate">{report.name}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{report.class_level ? `Class ${report.class_level}` : "-"}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{report.subject || "-"}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{report.date || "-"}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{report.taken_by} students</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 max-w-[60px] h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
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
                                                            ? "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400"
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

                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
                    <div className="p-6 border-b border-gray-200 dark:border-zinc-800">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Student Results Review</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Click a student to open detailed test-by-test performance</p>
                    </div>
                    {loadingStudentSummaries ? (
                        <div className="p-10 text-center text-gray-400">Loading student results...</div>
                    ) : studentSummaries.length === 0 ? (
                        <div className="p-10 text-center text-gray-400">No student results found for selected filters</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-zinc-800/50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Student</th>
                                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Class</th>
                                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Attempts</th>
                                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Avg %</th>
                                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Best %</th>
                                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Passed</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                    {studentSummaries.map((student) => (
                                        <tr
                                            key={student.student_id}
                                            onClick={() => fetchStudentDetail(student.student_id)}
                                            className="hover:bg-gray-50 dark:hover:bg-zinc-800/30 cursor-pointer"
                                        >
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-white">{student.student_name}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">{student.student_id}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center text-gray-800 dark:text-gray-200">{student.class_level || "-"}</td>
                                            <td className="px-6 py-4 text-center font-semibold text-gray-900 dark:text-white">{student.attempt_count || 0}</td>
                                            <td className="px-6 py-4 text-center text-gray-900 dark:text-white">{student.average_percentage || 0}%</td>
                                            <td className="px-6 py-4 text-center text-gray-900 dark:text-white">{student.best_percentage || 0}%</td>
                                            <td className="px-6 py-4 text-center text-green-600 dark:text-green-400 font-medium">{student.passed_count || 0}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {(loadingStudentDetail || studentDetail) && (
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
                        <div className="p-6 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {loadingStudentDetail ? "Loading result details..." : `${studentDetail?.student?.student_name || "Student"} - Detailed Results`}
                                </h3>
                                {!loadingStudentDetail && studentDetail?.summary && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        Attempts: {studentDetail.summary.attempt_count || 0} | Avg: {studentDetail.summary.average_percentage || 0}% | Best: {studentDetail.summary.best_percentage || 0}%
                                    </p>
                                )}
                            </div>
                            {!loadingStudentDetail && (
                                <button
                                    onClick={() => setStudentDetail(null)}
                                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                    Close
                                </button>
                            )}
                        </div>

                        {loadingStudentDetail ? (
                            <div className="p-8 text-center text-gray-400">Loading...</div>
                        ) : (studentDetail?.results || []).length === 0 ? (
                            <div className="p-8 text-center text-gray-400">No results found for this student</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-zinc-800/50">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Test</th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Subject</th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Class</th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Score</th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Percentage</th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Evaluation</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Review</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Question Marks</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                        {(studentDetail?.results || []).map((result) => (
                                            <tr key={result.submission_id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                                                <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">{result.assessment_title}</td>
                                                <td className="px-6 py-4 text-center text-gray-700 dark:text-gray-300">{result.subject || "-"}</td>
                                                <td className="px-6 py-4 text-center text-gray-700 dark:text-gray-300">{result.class_level || "-"}</td>
                                                <td className="px-6 py-4 text-center text-gray-900 dark:text-white">{result.total_score || 0}/{result.max_score || 0}</td>
                                                <td className="px-6 py-4 text-center text-gray-900 dark:text-white">{result.percentage || 0}%</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${result.is_evaluated ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"}`}>
                                                        {result.is_evaluated ? "Evaluated" : "Pending"}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 max-w-[260px]">
                                                    <div className="line-clamp-2">{result.overall_feedback || "No review added"}</div>
                                                </td>
                                                <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-400 max-w-[260px]">
                                                    <div className="line-clamp-2">{formatQuestionFeedback(result.question_feedback)}</div>
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

function StatCard({ label, value, icon, gradient, bg }) {
    return (
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-gray-200 dark:border-zinc-800 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <div className={`w-full h-full rounded-xl bg-gradient-to-br ${gradient} opacity-90 flex items-center justify-center`}>
                    {React.createElement(icon, { className: "w-5 h-5 text-white" })}
                </div>
            </div>
            <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">{value}</p>
            </div>
        </div>
    );
}

function formatQuestionFeedback(feedbackItems) {
    if (!Array.isArray(feedbackItems) || feedbackItems.length === 0) return "-";
    return feedbackItems
        .slice(0, 4)
        .map((item) => `${item.question}: ${item.marks}`)
        .join(" | ");
}
