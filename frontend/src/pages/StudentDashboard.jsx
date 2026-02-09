/**
 * StudentDashboard - Main dashboard for students
 * Shows enrolled courses, recent grades, and upcoming deadlines
 */

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
    Users
} from "lucide-react";
import useUserStore from "../stores/userStore";
import useCourseStore from "../stores/courseStore";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function StudentDashboard() {
    const navigate = useNavigate();
    const { user, getAuthHeader } = useUserStore();
    const { courses, enrolledCourses, fetchEnrolledCourses, loading } = useCourseStore();

    const [stats, setStats] = useState({
        enrolledCourses: 0,
        completedAssessments: 0,
        averageScore: 0,
        upcomingDeadlines: 0
    });
    const [recentGrades, setRecentGrades] = useState([]);
    const [groups, setGroups] = useState([]);

    useEffect(() => {
        fetchEnrolledCourses();
        fetchStudentStats();
        fetchRecentGrades();
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            const res = await fetch(`${API_URL}/api/student/groups`, {
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
            const res = await fetch(`${API_URL}/api/gradebook/stats/student`, {
                headers: getAuthHeader()
            });
            if (res.ok) {
                const data = await res.json();
                setStats({
                    enrolledCourses: data.enrolled_courses,
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
            const res = await fetch(`${API_URL}/api/gradebook/my-grades`, {
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

    const quickActions = [
        {
            title: "My Courses",
            description: "Continue learning",
            icon: BookOpen,
            color: "bg-blue-500",
            onClick: () => navigate("/my-courses")
        },
        {
            title: "My Grades",
            description: "View your progress",
            icon: Award,
            color: "bg-emerald-500",
            onClick: () => navigate("/my-grades")
        },
        {
            title: "Assessments",
            description: "Take a quiz or test",
            icon: CheckCircle,
            color: "bg-purple-500",
            onClick: () => navigate("/my-tests")
        },
        {
            title: "Notes",
            description: "AI-powered notes",
            icon: BarChart3,
            color: "bg-amber-500",
            onClick: () => navigate("/notes")
        }
    ];

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* Header */}
            <header className="bg-gray-800/50 border-b border-gray-700 px-6 py-4">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-2xl font-bold">Welcome back, {user.name || "Student"}!</h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Track your progress and continue learning
                    </p>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <StatCard
                        icon={BookOpen}
                        label="Enrolled Courses"
                        value={stats.enrolledCourses}
                        color="text-blue-400"
                    />
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
                        {quickActions.map((action, idx) => (
                            <button
                                key={idx}
                                onClick={action.onClick}
                                className="bg-gray-800 border border-gray-700 rounded-xl p-4 hover:border-blue-500/50 hover:bg-gray-800/80 transition-all group"
                            >
                                <div className={`${action.color} w-10 h-10 rounded-lg flex items-center justify-center mb-3`}>
                                    <action.icon size={20} className="text-white" />
                                </div>
                                <h3 className="font-medium text-white">{action.title}</h3>
                                <p className="text-sm text-gray-400">{action.description}</p>
                            </button>
                        ))}
                    </div>
                </section>

                {/* My Groups */}
                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">My Groups</h2>
                    {groups.length === 0 ? (
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 text-center text-gray-400">
                            <Users size={32} className="mx-auto mb-2 opacity-50" />
                            <p>You are not assigned to any groups yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {groups.map(group => (
                                <div key={group.id} className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-blue-500/50 transition-colors">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="bg-blue-500/10 p-2 rounded-lg">
                                            <Users size={20} className="text-blue-400" />
                                        </div>
                                        {group.teacher && (
                                            <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">
                                                {group.teacher.name}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="font-semibold text-lg text-white mb-1">{group.name}</h3>
                                    <p className="text-sm text-gray-400 line-clamp-2">{group.description}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Grades */}
                    <section className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                            <h2 className="font-semibold">Recent Grades</h2>
                            <button
                                onClick={() => navigate("/my-grades")}
                                className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                            >
                                View All <ChevronRight size={16} />
                            </button>
                        </div>

                        {recentGrades.length === 0 ? (
                            <div className="p-6 text-center text-gray-400">
                                <Award size={32} className="mx-auto mb-2 opacity-50" />
                                <p>No grades yet</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-700">
                                {recentGrades.map((grade) => (
                                    <div key={grade.submission_id} className="px-4 py-3 flex items-center justify-between">
                                        <div>
                                            <p className="font-medium">{grade.assessment_title}</p>
                                            <p className="text-sm text-gray-400 capitalize">{grade.assessment_type}</p>
                                        </div>
                                        <div className={`font-bold ${grade.passed ? "text-emerald-400" : "text-red-400"}`}>
                                            {grade.percentage}%
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Continue Learning */}
                    <section className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                            <h2 className="font-semibold">Continue Learning</h2>
                            <button
                                onClick={() => navigate("/my-courses")}
                                className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                            >
                                View All <ChevronRight size={16} />
                            </button>
                        </div>

                        {loading ? (
                            <div className="p-6 flex justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                            </div>
                        ) : enrolledCourses?.length === 0 ? (
                            <div className="p-6 text-center">
                                <BookOpen size={32} className="mx-auto mb-2 text-gray-500" />
                                <p className="text-gray-400 mb-3">No courses enrolled</p>
                                <button
                                    onClick={() => navigate("/courses")}
                                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm"
                                >
                                    Browse Courses
                                </button>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-700">
                                {enrolledCourses?.slice(0, 4).map((course) => (
                                    <button
                                        key={course.id}
                                        onClick={() => navigate(`/courses/${course.id}`)}
                                        className="w-full px-4 py-3 flex items-center gap-4 hover:bg-gray-700/50 text-left"
                                    >
                                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                                            <BookOpen size={20} className="text-white/70" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{course.title}</p>
                                            <p className="text-sm text-gray-400">{course.instructor_name}</p>
                                        </div>
                                        <Play size={18} className="text-gray-400" />
                                    </button>
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
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
                <div className={`${color} bg-opacity-10 p-2 rounded-lg`}>
                    <Icon size={20} className={color} />
                </div>
                <div>
                    <p className="text-2xl font-bold">{value}</p>
                    <p className="text-sm text-gray-400">{label}</p>
                </div>
            </div>
        </div>
    );
}
