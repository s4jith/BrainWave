
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
    Award,
    ChevronDown,
    ChevronUp,
    Brain,
    Target,
    AlertTriangle,
    Sparkles,
    FileText,
    Clock
} from "lucide-react";
import useUserStore from "../stores/userStore";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import {
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

function TopicBar({ topic, accuracy, status }) {
    const barColor = status === "strong" ? "bg-emerald-500" : status === "moderate" ? "bg-amber-500" : "bg-red-500";
    const textColor = status === "strong" ? "text-emerald-600 dark:text-emerald-400" : status === "moderate" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
    return (
        <div className="flex items-center gap-3">
            <p className="text-sm text-gray-700 dark:text-gray-300 w-40 truncate" title={topic}>{topic}</p>
            <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.max(accuracy, 4)}%` }} />
            </div>
            <p className={`text-sm font-semibold w-14 text-right ${textColor}`}>{accuracy}%</p>
        </div>
    );
}

function EvaluationCard({ ev, index }) {
    const isPending = ev.evaluation_status === "pending";
    const borderClass = isPending
        ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20"
        : ev.is_correct
            ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20"
            : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20";

    return (
        <div className={`p-3 rounded-lg border ${borderClass}`}>
            <div className="flex items-start justify-between mb-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Q{index + 1}. {ev.question || ev.question_text || ""}</p>
                {isPending ? (
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300 whitespace-nowrap">
                        Pending Review
                    </span>
                ) : (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${ev.is_correct ? "bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300" : "bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300"}`}>
                        {ev.score ?? 0}/{ev.max_score ?? 10}
                    </span>
                )}
            </div>
            {ev.student_answer && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1"><strong>Your Answer:</strong> {ev.student_answer}</p>
            )}
            {!isPending && ev.correct_answer && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5"><strong>Correct Answer:</strong> {ev.correct_answer}</p>
            )}
            {isPending && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 italic">This answer will be evaluated by your teacher.</p>
            )}
            {!isPending && ev.explanation && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">{ev.explanation}</p>
            )}
            {!isPending && ev.feedback && !ev.explanation && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">{ev.feedback}</p>
            )}
        </div>
    );
}

function GradeRow({ grade }) {
    const [expanded, setExpanded] = useState(false);
    const isAI = grade.source === "ai_test";
    const hasEvaluations = grade.evaluations && grade.evaluations.length > 0;
    const hasFeedback = grade.feedback || (grade.strengths && grade.strengths.length > 0) || (grade.improvements && grade.improvements.length > 0);
    const hasTopicAnalytics = grade.topic_analytics && grade.topic_analytics.topics && grade.topic_analytics.topics.length > 0;
    const canExpand = hasEvaluations || hasFeedback || hasTopicAnalytics;
    const isPendingReview = grade.evaluation_status === "pending_manual_review";
    const pendingCount = isPendingReview
        ? (grade.evaluations || []).filter(e => e.evaluation_status === "pending").length
        : 0;

    const formatDate = (dt) => {
        if (!dt) return "";
        const d = typeof dt === "string" ? new Date(dt) : dt;
        return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    };

    return (
        <div className="border-b border-gray-200 dark:border-gray-700 last:border-0">
            <div
                className={`px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${canExpand ? "cursor-pointer" : ""}`}
                onClick={() => canExpand && setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`p-1.5 rounded-lg ${isAI ? "bg-purple-100 dark:bg-purple-900/30" : "bg-blue-100 dark:bg-blue-900/30"}`}>
                        {isAI ? <Brain size={16} className="text-purple-600 dark:text-purple-400" /> : <FileText size={16} className="text-blue-600 dark:text-blue-400" />}
                    </div>
                    <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{grade.title}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span className={`px-1.5 py-0.5 rounded ${isAI ? "bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300" : "bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300"}`}>
                                {isAI ? "AI Test" : "Staff Test"}
                            </span>
                            {isPendingReview && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300">
                                    {pendingCount} Q pending review
                                </span>
                            )}
                            {grade.subject && <span>{grade.subject}</span>}
                            {formatDate(grade.completed_at) && <span>{formatDate(grade.completed_at)}</span>}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className={`font-bold ${isPendingReview ? "text-amber-600 dark:text-amber-400" : grade.passed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                            {grade.percentage}%{isPendingReview ? "*" : ""}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {isPendingReview ? "Partial" : `${grade.score}/${grade.max_score}`}
                        </p>
                    </div>
                    {isPendingReview ? (
                        <Clock className="text-amber-500 dark:text-amber-400 shrink-0" size={20} />
                    ) : grade.passed ? (
                        <CheckCircle className="text-emerald-600 dark:text-emerald-400 shrink-0" size={20} />
                    ) : (
                        <XCircle className="text-red-600 dark:text-red-400 shrink-0" size={20} />
                    )}
                    {canExpand && (
                        expanded ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />
                    )}
                </div>
            </div>

            {expanded && (
                <div className="px-4 pb-4 space-y-4 bg-gray-50 dark:bg-gray-800/50">
                    {}
                    {grade.feedback && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                            <p className="text-sm text-gray-700 dark:text-gray-300">{grade.feedback}</p>
                        </div>
                    )}

                    {}
                    {(grade.strengths?.length > 0 || grade.improvements?.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {grade.strengths?.length > 0 && (
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800 p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Target size={14} className="text-emerald-600 dark:text-emerald-400" />
                                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Strengths</p>
                                    </div>
                                    <ul className="space-y-1">
                                        {grade.strengths.map((s, i) => (
                                            <li key={i} className="text-xs text-emerald-700 dark:text-emerald-400">• {s}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {grade.improvements?.length > 0 && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400" />
                                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Needs Improvement</p>
                                    </div>
                                    <ul className="space-y-1">
                                        {grade.improvements.map((s, i) => (
                                            <li key={i} className="text-xs text-amber-700 dark:text-amber-400">• {s}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Topic-Level Performance Analytics */}
                    {hasTopicAnalytics && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                            <div className="flex items-center gap-2 mb-3">
                                <Target size={14} className="text-purple-600 dark:text-purple-400" />
                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    Performance by Topic
                                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">
                                        ({grade.topic_analytics.total_topics_covered} topics)
                                    </span>
                                </p>
                            </div>

                            {/* Strong Topics */}
                            {grade.topic_analytics.strong_topics?.length > 0 && (
                                <div className="mb-3">
                                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-1 flex items-center gap-1">
                                        <TrendingUp size={12} /> Strong Topics ({grade.topic_analytics.strong_topics.length})
                                    </p>
                                    <div className="space-y-1">
                                        {grade.topic_analytics.strong_topics.map((t, i) => (
                                            <div key={i} className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1.5 rounded border border-emerald-100 dark:border-emerald-800">
                                                <span className="text-xs text-emerald-800 dark:text-emerald-300">{t.name}</span>
                                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{Math.round(t.score)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Weak Topics */}
                            {grade.topic_analytics.weak_topics?.length > 0 && (
                                <div className="mb-3">
                                    <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1 flex items-center gap-1">
                                        <AlertTriangle size={12} /> Topics Needing Practice ({grade.topic_analytics.weak_topics.length})
                                    </p>
                                    <div className="space-y-1">
                                        {grade.topic_analytics.weak_topics.map((t, i) => (
                                            <div key={i} className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 px-2 py-1.5 rounded border border-red-100 dark:border-red-800">
                                                <span className="text-xs text-red-800 dark:text-red-300">{t.name}</span>
                                                <span className="text-xs font-bold text-red-600 dark:text-red-400">{Math.round(t.score)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* All Topics with progress bars */}
                            <div>
                                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">All Topics</p>
                                <div className="space-y-2">
                                    {grade.topic_analytics.topics.map((t, i) => (
                                        <div key={i}>
                                            <div className="flex items-center justify-between mb-0.5">
                                                <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[70%]" title={t.topic_name}>{t.topic_name}</span>
                                                <span className={`text-xs font-bold ${
                                                    t.score_percentage >= 70 ? 'text-emerald-600 dark:text-emerald-400' :
                                                    t.score_percentage >= 50 ? 'text-amber-600 dark:text-amber-400' :
                                                    'text-red-600 dark:text-red-400'
                                                }`}>{Math.round(t.score_percentage)}%</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full transition-all ${
                                                        t.score_percentage >= 70 ? 'bg-emerald-500' :
                                                        t.score_percentage >= 50 ? 'bg-amber-500' :
                                                        'bg-red-500'
                                                    }`} style={{ width: `${Math.max(t.score_percentage, 3)}%` }} />
                                                </div>
                                                <span className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                    {t.correct_answers}/{t.total_questions} correct
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Question-by-question evaluation */}
                    {hasEvaluations && (
                        <div>
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Question-wise Evaluation</p>
                            <div className="space-y-2">
                                {grade.evaluations.map((ev, i) => (
                                    <EvaluationCard key={i} ev={ev} index={i} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Topics to review */}
                    {grade.topics_to_review?.length > 0 && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-3">
                            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">Topics to Review</p>
                            <div className="flex flex-wrap gap-2">
                                {grade.topics_to_review.map((t, i) => (
                                    <span key={i} className="text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">{t}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
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
    const [viewMode, setViewMode] = useState("gradebook");
    const [filter, setFilter] = useState("all");

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
            const res = await authFetch(`${API_URL}/api/gradebook/course/${courseId}`, {
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
            const res = await authFetch(`${API_URL}/api/gradebook/course/${courseId}/analytics`, {
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
            const res = await authFetch(`${API_URL}/api/gradebook/my-grades${params}`, {
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
            const res = await authFetch(`${API_URL}/api/gradebook/course/${courseId}/export`, {
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

    const filteredGrades = (myGrades?.grades || []).filter(g => {
        if (filter === "all") return true;
        return g.source === filter;
    });

    const aiCount = (myGrades?.grades || []).filter(g => g.source === "ai_test").length;
    const staffCount = (myGrades?.grades || []).filter(g => g.source === "staff_test").length;

    if (!isInstructor) {
        return (
            <DashboardLayout>
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Grades</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">View your scores, topic analysis, and detailed evaluations</p>
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <StatCard
                            icon={Award}
                            label="Overall"
                            value={`${myGrades?.overall_percentage || 0}%`}
                            color="text-emerald-500 dark:text-emerald-400"
                        />
                        <StatCard
                            icon={BookOpen}
                            label="Total Tests"
                            value={myGrades?.grade_count || 0}
                            color="text-blue-500 dark:text-blue-400"
                        />
                        <StatCard
                            icon={Brain}
                            label="AI Tests"
                            value={aiCount}
                            color="text-purple-500 dark:text-purple-400"
                        />
                        <StatCard
                            icon={TrendingUp}
                            label="Points"
                            value={`${myGrades?.total_score || 0}/${myGrades?.total_max_score || 0}`}
                            color="text-indigo-500 dark:text-indigo-400"
                        />
                    </div>

                    {/* Topic Analysis Panel */}
                    {myGrades?.topic_analysis?.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Sparkles size={18} className="text-purple-500" />
                                <h2 className="font-semibold text-gray-900 dark:text-white">Topic Analysis</h2>
                            </div>

                            {/* Strength / Weakness Summary */}
                            {(myGrades.strong_topics?.length > 0 || myGrades.weak_topics?.length > 0) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                                    {myGrades.strong_topics?.length > 0 && (
                                        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">
                                            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-1">Strong Topics</p>
                                            <div className="flex flex-wrap gap-1">
                                                {myGrades.strong_topics.map((t, i) => (
                                                    <span key={i} className="text-xs bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded">{t}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {myGrades.weak_topics?.length > 0 && (
                                        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
                                            <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Needs Improvement</p>
                                            <div className="flex flex-wrap gap-1">
                                                {myGrades.weak_topics.map((t, i) => (
                                                    <span key={i} className="text-xs bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 px-2 py-0.5 rounded">{t}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Topic bars */}
                            <div className="space-y-2">
                                {myGrades.topic_analysis.map((t, i) => (
                                    <TopicBar key={i} topic={t.topic} accuracy={t.accuracy} status={t.status} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Performance Analytics Charts */}
                    {(myGrades?.grades?.length > 1 || myGrades?.topic_analysis?.length > 0) && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            {/* Score Trend Bar Chart */}
                            {myGrades?.grades?.length > 1 && (
                                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                        <BarChart3 size={16} className="text-blue-500" />
                                        Score Trend
                                    </h3>
                                    <div className="h-48">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={[...myGrades.grades].reverse().slice(-10).map((g, i) => ({
                                                name: `Test ${i + 1}`,
                                                score: g.percentage,
                                            }))}>
                                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#888" />
                                                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#888" />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px", color: "#fff" }}
                                                    formatter={(v) => [`${v}%`, "Score"]}
                                                />
                                                <Bar dataKey="score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* Topic Accuracy Pie Chart */}
                            {myGrades?.topic_analysis?.length > 0 && (
                                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                        <Target size={16} className="text-purple-500" />
                                        Topic Distribution
                                    </h3>
                                    <div className="h-48">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={(() => {
                                                        const strong = myGrades.topic_analysis.filter(t => t.status === "strong").length;
                                                        const moderate = myGrades.topic_analysis.filter(t => t.status === "moderate").length;
                                                        const weak = myGrades.topic_analysis.filter(t => t.status === "weak").length;
                                                        return [
                                                            { name: "Strong", value: strong },
                                                            { name: "Moderate", value: moderate },
                                                            { name: "Weak", value: weak },
                                                        ].filter(d => d.value > 0);
                                                    })()}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={40}
                                                    outerRadius={70}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {[
                                                        { name: "Strong", color: "#10b981" },
                                                        { name: "Moderate", color: "#f59e0b" },
                                                        { name: "Weak", color: "#ef4444" },
                                                    ].filter(d => {
                                                        const ct = myGrades.topic_analysis.filter(t => t.status === d.name.toLowerCase()).length;
                                                        return ct > 0;
                                                    }).map((entry, i) => (
                                                        <Cell key={i} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-2 mb-4">
                        {[
                            { key: "all", label: `All (${myGrades?.grade_count || 0})` },
                            { key: "ai_test", label: `AI Tests (${aiCount})` },
                            { key: "staff_test", label: `Staff Tests (${staffCount})` }
                        ].map(f => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filter === f.key ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {/* Grades List */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="font-semibold text-gray-900 dark:text-white">Assessment Results</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Click on a test to see detailed evaluation</p>
                        </div>

                        {filteredGrades.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                No grades yet
                            </div>
                        ) : (
                            <div>
                                {filteredGrades.map((grade) => (
                                    <GradeRow key={grade.id} grade={grade} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </DashboardLayout>
        );
    }

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
