/**
 * Gradebook - View grades and analytics
 * Shows student grades, course analytics, and export options
 */

import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
    ArrowLeft,
    Download,
    TrendingUp,
    Users,
    BarChart3,
    CheckCircle,
    XCircle,
    BookOpen,
    Award
} from "lucide-react";
import useUserStore from "../stores/userStore";
import LoadingSpinner from "../components/ui/LoadingSpinner";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// StatCard Component for displaying grade statistics
function StatCard({ icon: Icon, label, value, color }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 transition-colors">
            <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-700 ${color}`}>
                    <Icon size={20} />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
    );
}

export default function Gradebook() {
    const { courseId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user, getAuthHeader, isTeacher, isAdmin } = useUserStore();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [gradebook, setGradebook] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [myGrades, setMyGrades] = useState(null);
    const [viewMode, setViewMode] = useState("gradebook"); // gradebook | analytics

    const isInstructor = isTeacher() || isAdmin();

    useEffect(() => {
        if (isInstructor && courseId) {
            fetchGradebook();
            fetchAnalytics();
        } else {
            fetchMyGrades();
        }
    }, [courseId]);

    const fetchGradebook = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/gradebook/course/${courseId}`, {
                headers: getAuthHeader()
            });
            if (!res.ok) throw new Error("Failed to load gradebook");
            setGradebook(await res.json());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchAnalytics = async () => {
        try {
            const res = await fetch(`${API_URL}/api/gradebook/course/${courseId}/analytics`, {
                headers: getAuthHeader()
            });
            if (res.ok) {
                setAnalytics(await res.json());
            }
        } catch (err) {
            console.error("Analytics error:", err);
        }
    };

    const fetchMyGrades = async () => {
        setLoading(true);
        try {
            const params = courseId ? `?course_id=${courseId}` : '';
            const res = await fetch(`${API_URL}/api/gradebook/my-grades${params}`, {
                headers: getAuthHeader()
            });
            if (!res.ok) throw new Error("Failed to load grades");
            setMyGrades(await res.json());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            const res = await fetch(`${API_URL}/api/gradebook/course/${courseId}/export`, {
                headers: getAuthHeader()
            });
            if (!res.ok) throw new Error("Export failed");

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `gradebook_${courseId}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Export error:", err);
        }
    };

    if (loading) {
        return <LoadingSpinner message="Loading grades..." submessage="Fetching your assessment data" />;
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white flex items-center justify-center transition-colors">
                <div className="text-center">
                    <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
                    <button onClick={() => navigate(-1)} className="text-blue-600 dark:text-blue-400">Go Back</button>
                </div>
            </div>
        );
    }

    // Student view
    if (!isInstructor) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors">
                <header className="bg-white dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                    <div className="max-w-4xl mx-auto flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="text-xl font-bold">My Grades</h1>
                    </div>
                </header>

                <main className="max-w-4xl mx-auto px-6 py-8">
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <StatCard
                            icon={Award}
                            label="Overall"
                            value={`${myGrades?.overall_percentage || 0}%`}
                            color="text-emerald-500 dark:text-emerald-400"
                        />
                        <StatCard
                            icon={BookOpen}
                            label="Assessments"
                            value={myGrades?.grade_count || 0}
                            color="text-blue-500 dark:text-blue-400"
                        />
                        <StatCard
                            icon={TrendingUp}
                            label="Total Points"
                            value={`${myGrades?.total_score || 0}/${myGrades?.total_max_score || 0}`}
                            color="text-purple-500 dark:text-purple-400"
                        />
                    </div>

                    {/* Grades List */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="font-semibold">Assessment Grades</h2>
                        </div>

                        {myGrades?.grades?.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                No grades yet
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                {myGrades?.grades?.map((grade) => (
                                    <div key={grade.submission_id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <div>
                                            <p className="font-medium">{grade.assessment_title}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{grade.assessment_type}</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className={`font-bold ${grade.passed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                                    {grade.percentage}%
                                                </p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">{grade.score}/{grade.max_score}</p>
                                            </div>
                                            {grade.passed ? (
                                                <CheckCircle className="text-emerald-600 dark:text-emerald-400" size={20} />
                                            ) : (
                                                <XCircle className="text-red-600 dark:text-red-400" size={20} />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        );
    }

    // Instructor view
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors">
            <header className="bg-white dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold">{gradebook?.course_title || "Gradebook"}</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{gradebook?.total_students || 0} students</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode("gradebook")}
                                className={`px-3 py-1 rounded text-sm transition-colors ${viewMode === "gradebook" ? "bg-blue-600 text-white" : "text-gray-700 dark:text-gray-300"}`}
                            >
                                Gradebook
                            </button>
                            <button
                                onClick={() => setViewMode("analytics")}
                                className={`px-3 py-1 rounded text-sm transition-colors ${viewMode === "analytics" ? "bg-blue-600 text-white" : "text-gray-700 dark:text-gray-300"}`}
                            >
                                Analytics
                            </button>
                        </div>
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                            <Download size={16} />
                            Export CSV
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-8">
                {viewMode === "analytics" && analytics ? (
                    <AnalyticsView analytics={analytics} />
                ) : (
                    <GradebookTable gradebook={gradebook} />
                )}
            </main>
        </div>
    );
}

function GradebookTable({ gradebook }) {
    if (!gradebook) return null;

    return (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-700/50">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium sticky left-0 bg-gray-700">Student</th>
                            {gradebook.assessments?.map(a => (
                                <th key={a.id} className="px-4 py-3 text-center font-medium whitespace-nowrap">
                                    <div>{a.title}</div>
                                    <div className="text-xs text-gray-400">{a.max_points} pts</div>
                                </th>
                            ))}
                            <th className="px-4 py-3 text-center font-medium">Overall</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {gradebook.students?.map(student => (
                            <tr key={student.student_id} className="hover:bg-gray-700/30">
                                <td className="px-4 py-3 sticky left-0 bg-gray-800">
                                    <p className="font-medium">{student.student_name}</p>
                                    <p className="text-xs text-gray-400">{student.email}</p>
                                </td>
                                {gradebook.assessments?.map(a => {
                                    const grade = student.grades[a.id];
                                    return (
                                        <td key={a.id} className="px-4 py-3 text-center">
                                            {grade ? (
                                                <span className={grade.passed ? "text-emerald-400" : "text-red-400"}>
                                                    {grade.percentage}%
                                                </span>
                                            ) : (
                                                <span className="text-gray-500">-</span>
                                            )}
                                        </td>
                                    );
                                })}
                                <td className="px-4 py-3 text-center font-bold">
                                    {student.overall_percentage}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function AnalyticsView({ analytics }) {
    const distribution = analytics.score_distribution || {};
    const maxCount = Math.max(...Object.values(distribution), 1);

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
                <StatCard icon={Users} label="Students" value={analytics.total_students} color="text-blue-400" />
                <StatCard icon={BookOpen} label="Assessments" value={analytics.total_assessments} color="text-purple-400" />
                <StatCard icon={TrendingUp} label="Avg Score" value={`${analytics.average_score}%`} color="text-emerald-400" />
                <StatCard icon={CheckCircle} label="Pass Rate" value={`${analytics.pass_rate}%`} color="text-amber-400" />
            </div>

            {/* Score Distribution */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="font-semibold mb-4">Score Distribution</h3>
                <div className="flex items-end gap-2 h-40">
                    {Object.entries(distribution).map(([range, count]) => (
                        <div key={range} className="flex-1 flex flex-col items-center">
                            <div
                                className="w-full bg-blue-600 rounded-t"
                                style={{ height: `${(count / maxCount) * 100}%`, minHeight: count > 0 ? '20px' : '0' }}
                            />
                            <p className="text-xs text-gray-400 mt-2">{range}</p>
                            <p className="text-sm font-medium">{count}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Assessment Stats */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-700">
                    <h3 className="font-semibold">Assessment Performance</h3>
                </div>
                <div className="divide-y divide-gray-700">
                    {analytics.assessment_stats?.map(stat => (
                        <div key={stat.assessment_id} className="px-4 py-3 flex items-center justify-between">
                            <div>
                                <p className="font-medium">{stat.title}</p>
                                <p className="text-sm text-gray-400">{stat.submission_count} submissions</p>
                            </div>
                            <div className="flex items-center gap-6 text-sm">
                                <div className="text-center">
                                    <p className="text-gray-400">Average</p>
                                    <p className="font-bold text-blue-400">{stat.average_score}%</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-gray-400">Highest</p>
                                    <p className="font-bold text-emerald-400">{stat.highest_score}%</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-gray-400">Lowest</p>
                                    <p className="font-bold text-red-400">{stat.lowest_score}%</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
