
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    BookOpen,
    Award,
    TrendingUp,
    Clock,
    ChevronRight,
    Play,
    BarChart3,
    CheckCircle,
    Calendar,
    Users,
    FileText,
    MessageCircle,
    GraduationCap
} from "lucide-react";
import useUserStore from "../stores/userStore";
import authFetch from "../utils/authFetch";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function StudentDashboard() {
    const navigate = useNavigate();
    const { user, getAuthHeader } = useUserStore();

    const [stats, setStats] = useState({
        completedAssessments: 0,
        averageScore: 0,
        upcomingDeadlines: 0
    });
    const [recentGrades, setRecentGrades] = useState([]);
    const [groups, setGroups] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [features, setFeatures] = useState({ ai_chatbot: false, test_center: false, my_grades: false, book_to_bot: true });

    useEffect(() => {
        fetchStudentStats();
        fetchRecentGrades();
        fetchGroups();
        fetchSubjects();
        fetchFeatures();
    }, []);

    const fetchFeatures = async () => {
        try {
            const res = await authFetch(`${API_URL}/api/student/my-features`, {
                headers: getAuthHeader()
            });
            if (res.ok) {
                const data = await res.json();
                setFeatures(data.features || { ai_chatbot: false, test_center: false, my_grades: false, book_to_bot: true });
            }
        } catch (err) {
            console.error("Features error:", err);
        }
    };

    const fetchGroups = async () => {
        try {
            const res = await authFetch(`${API_URL}/api/student/groups`, {
                headers: getAuthHeader()
            });
            if (res.ok) {
                const data = await res.json();
                setGroups(data.groups || []);
            }
        } catch (err) {
            console.error("Groups error:", err);
        }
    };

    const fetchStudentStats = async () => {
        try {
            const res = await authFetch(`${API_URL}/api/gradebook/stats/student`, {
                headers: getAuthHeader()
            });
            if (res.ok) {
                const data = await res.json();
                setStats({
                    completedAssessments: data.completed_assessments,
                    averageScore: data.average_score,
                    upcomingDeadlines: data.upcoming_deadlines
                });
            }
        } catch (err) {
            console.error("Stats error:", err);
        }
    };

    const fetchRecentGrades = async () => {
        try {
            const res = await authFetch(`${API_URL}/api/gradebook/my-grades`, {
                headers: getAuthHeader()
            });
            if (res.ok) {
                const data = await res.json();
                setRecentGrades(data.grades?.slice(0, 5) || []);
            }
        } catch (err) {
            console.error("Grades error:", err);
        }
    };

    const fetchSubjects = async () => {
        try {
            const res = await authFetch(`${API_URL}/api/student/my-subjects`, {
                headers: getAuthHeader()
            });
            if (res.ok) {
                const data = await res.json();
                setSubjects(data.subjects || []);
            }
        } catch (err) {
            console.error("Subjects error:", err);
        }
    };

    const quickActions = [
        {
            title: "My Groups",
            description: "View your groups",
            icon: Users,
            color: "bg-indigo-500",
            onClick: () => navigate("/my-groups")
        },
        {
            title: "My Grades",
            description: "View your progress",
            icon: Award,
            color: "bg-emerald-500",
            onClick: () => navigate("/my-grades"),
            featureKey: "my_grades"
        },
        {
            title: "Test Center",
            description: "AI & Staff tests",
            icon: CheckCircle,
            color: "bg-purple-500",
            onClick: () => navigate("/my-tests"),
            featureKey: "test_center"
        },
        {
            title: "Book to Bot",
            description: "AI-powered learning",
            icon: BookOpen,
            color: "bg-orange-500",
            onClick: () => navigate("/book-to-bot"),
            featureKey: "book_to_bot"
        },
        {
            title: "Notes",
            description: "AI-powered notes",
            icon: BarChart3,
            color: "bg-amber-500",
            onClick: () => navigate("/notes")
        },
        {
            title: "Suggestions",
            description: "Share feedback",
            icon: MessageCircle,
            color: "bg-rose-500",
            onClick: () => navigate("/suggestions")
        },
        {
            title: "Statistics",
            description: "View your stats",
            icon: TrendingUp,
            color: "bg-cyan-500",
            onClick: () => navigate("/report-card")
        }
    ];

    const visibleActions = quickActions.map(action => ({
        ...action,
        isLocked: action.featureKey && !features[action.featureKey]
    }));

    return (
        <div className="min-h-screen text-gray-900 dark:text-white">
            {}
            <header className="bg-white/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-2xl font-bold">Welcome back, {user.name || "Student"}!</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                        Track your progress and continue learning
                    </p>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <StatCard
                        icon={CheckCircle}
                        label="Completed"
                        value={stats.completedAssessments}
                        color="text-emerald-400"
                    />
                    <StatCard
                        icon={TrendingUp}
                        label="Average Score"
                        value={`${stats.averageScore}%`}
                        color="text-purple-400"
                    />
                    <StatCard
                        icon={Calendar}
                        label="Upcoming"
                        value={stats.upcomingDeadlines}
                        color="text-amber-400"
                    />
                </div>

                {/* Quick Actions */}
                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {visibleActions.map((action, idx) => (
                            <button
                                key={idx}
                                onClick={action.onClick}
                                className={`relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 transition-all group ${action.isLocked ? 'opacity-80' : 'hover:border-blue-500/50 hover:bg-gray-50 dark:hover:bg-gray-800/80'}`}
                            >
                                {action.isLocked && (
                                    <div className="absolute top-2 right-2 w-5 h-5 bg-gray-700 dark:bg-gray-600 rounded-full flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                    </div>
                                )}
                                <div className={`${action.color} w-10 h-10 rounded-lg flex items-center justify-center mb-3`}>
                                    <action.icon size={20} className="text-white" />
                                </div>
                                <h3 className="font-medium text-gray-900 dark:text-white">{action.title}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{action.isLocked ? 'Locked by admin' : action.description}</p>
                            </button>
                        ))}
                    </div>
                </section>

                {/* My Groups */}
                <section className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">My Groups</h2>
                        <button
                            onClick={() => navigate("/my-groups")}
                            className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                        >
                            View All <ChevronRight size={16} />
                        </button>
                    </div>
                    {groups.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center text-gray-500 dark:text-gray-400">
                            <Users size={32} className="mx-auto mb-2 opacity-50" />
                            <p>You are not assigned to any groups yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {groups.map(group => (
                                <div
                                    key={group.id}
                                    onClick={() => navigate("/my-groups")}
                                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:border-blue-500/50 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="bg-blue-500/10 p-2 rounded-lg">
                                            <Users size={20} className="text-blue-400" />
                                        </div>
                                        {group.teacher && (
                                            <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-600 dark:text-gray-300">
                                                <GraduationCap size={12} className="inline mr-1" />
                                                {group.teacher.name}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-1">{group.name}</h3>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                        {group.subject && (
                                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-xs">
                                                {group.subject}
                                            </span>
                                        )}
                                        {group.class_level && (
                                            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs">
                                                Class {group.class_level}
                                            </span>
                                        )}
                                    </div>
                                    {group.description && (
                                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-2">{group.description}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* My Subjects */}
                {subjects.length > 0 && (
                    <section className="mb-8">
                        <h2 className="text-xl font-semibold mb-4">My Subjects</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {subjects.map(subject => (
                                <div key={subject.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="bg-emerald-500/10 p-2 rounded-lg">
                                            <BookOpen size={20} className="text-emerald-400" />
                                        </div>
                                        <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-600 dark:text-gray-300">
                                            Class {subject.class_level}
                                        </span>
                                    </div>
                                    <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-1">{subject.subject_name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {subject.total_chapters} chapter{subject.total_chapters !== 1 ? 's' : ''}
                                    </p>
                                    {subject.chapters && subject.chapters.length > 0 && (
                                        <div className="mt-3 space-y-1">
                                            {subject.chapters.slice(0, 3).map((ch, idx) => (
                                                <div key={idx} className="text-xs text-gray-500 flex items-center gap-1">
                                                    <FileText size={10} />
                                                    Ch {ch.chapter_number}: {ch.title}
                                                </div>
                                            ))}
                                            {subject.chapters.length > 3 && (
                                                <div className="text-xs text-blue-400">
                                                    +{subject.chapters.length - 3} more
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Grades */}
                    <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <h2 className="font-semibold">Recent Grades</h2>
                            <button
                                onClick={() => navigate("/my-grades")}
                                className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                            >
                                View All <ChevronRight size={16} />
                            </button>
                        </div>

                        {recentGrades.length === 0 ? (
                            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                                <Award size={32} className="mx-auto mb-2 opacity-50" />
                                <p>No grades yet</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                {recentGrades.map((grade) => (
                                    <div key={grade.submission_id} className="px-4 py-3 flex items-center justify-between">
                                        <div>
                                            <p className="font-medium">{grade.assessment_title}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{grade.assessment_type}</p>
                                        </div>
                                        <div className={`font-bold ${grade.passed ? "text-emerald-400" : "text-red-400"}`}>
                                            {grade.percentage}%
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}

function StatCard({ icon: Icon, label, value, color }) {
    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
                <div className={`${color} bg-opacity-10 p-2 rounded-lg`}>
                    <Icon size={20} className={color} />
                </div>
                <div>
                    <p className="text-2xl font-bold">{value}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                </div>
            </div>
        </div>
    );
}
