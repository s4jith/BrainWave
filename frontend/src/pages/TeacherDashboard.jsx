/**
 * TeacherDashboard - Main dashboard for teachers
 * Shows courses created, quick actions, and analytics
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    BookOpen,
    Plus,
    Users,
    TrendingUp,
    FileText,
    BarChart3,
    Clock,
    Edit,
    Eye,
    ChevronRight,
    AlertCircle,
    ClipboardCheck
} from "lucide-react";
import useUserStore from "../stores/userStore";
import useCourseStore from "../stores/courseStore";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function TeacherDashboard() {
    const navigate = useNavigate();
    const { user, getAuthHeader } = useUserStore();
    const { myCourses, fetchMyCourses, loading, error } = useCourseStore();

    const [stats, setStats] = useState({
        totalCourses: 0,
        publishedCourses: 0,
        totalStudents: 0,
        avgRating: 0,
        pendingGrading: 0,
        totalAssessments: 0
    });

    useEffect(() => {
        fetchMyCourses();
        fetchTeacherStats();
    }, [fetchMyCourses]);

    const fetchTeacherStats = async () => {
        try {
            const res = await fetch(`${API_URL}/api/gradebook/stats/teacher`, {
                headers: getAuthHeader()
            });
            if (res.ok) {
                const data = await res.json();
                setStats(prev => ({
                    ...prev,
                    totalCourses: data.total_courses,
                    totalStudents: data.total_students,
                    totalAssessments: data.total_assessments,
                    pendingGrading: data.pending_grading
                }));
            }
        } catch (err) {
            console.error("Stats error:", err);
        }
    };

    useEffect(() => {
        if (myCourses.length > 0) {
            const published = myCourses.filter(c => c.status === "published");
            const ratings = myCourses.filter(c => c.average_rating > 0);
            const avgRating = ratings.length > 0
                ? ratings.reduce((sum, c) => sum + c.average_rating, 0) / ratings.length
                : 0;

            setStats(prev => ({
                ...prev,
                publishedCourses: published.length,
                avgRating: avgRating.toFixed(1)
            }));
        }
    }, [myCourses]);

    const quickActions = [
        {
            title: "Create Course",
            description: "Start a new course",
            icon: Plus,
            color: "bg-blue-500",
            onClick: () => navigate("/course-builder")
        },
        {
            title: "Create Quiz",
            description: "Build an assessment",
            icon: ClipboardCheck,
            color: "bg-purple-500",
            onClick: () => navigate("/assessment-builder")
        },
        {
            title: "View Courses",
            description: "Manage your courses",
            icon: BookOpen,
            color: "bg-emerald-500",
            onClick: () => navigate("/my-courses")
        },
        {
            title: "Gradebook",
            description: "View student grades",
            icon: BarChart3,
            color: "bg-amber-500",
            onClick: () => myCourses.length > 0 ? navigate(`/gradebook/${myCourses[0].id}`) : null
        }
    ];

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* Header */}
            <header className="bg-gray-800/50 border-b border-gray-700 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Welcome back, {user.name || "Teacher"}!</h1>
                        <p className="text-gray-400 text-sm mt-1">
                            Manage your courses and track student progress
                        </p>
                    </div>
                    <button
                        onClick={() => navigate("/course-builder")}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
                    >
                        <Plus size={18} />
                        New Course
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <StatCard
                        icon={BookOpen}
                        label="Total Courses"
                        value={stats.totalCourses}
                        color="text-blue-400"
                    />
                    <StatCard
                        icon={Eye}
                        label="Published"
                        value={stats.publishedCourses}
                        color="text-emerald-400"
                    />
                    <StatCard
                        icon={Users}
                        label="Total Students"
                        value={stats.totalStudents}
                        color="text-purple-400"
                    />
                    <StatCard
                        icon={TrendingUp}
                        label="Avg Rating"
                        value={stats.avgRating}
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

                {/* Recent Courses */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">Your Courses</h2>
                        <button
                            onClick={() => navigate("/my-courses")}
                            className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                        >
                            View All <ChevronRight size={16} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                        </div>
                    ) : error ? (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
                            {error}
                        </div>
                    ) : myCourses.length === 0 ? (
                        <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
                            <BookOpen size={48} className="mx-auto text-gray-600 mb-4" />
                            <h3 className="text-lg font-medium mb-2">No courses yet</h3>
                            <p className="text-gray-400 mb-4">Create your first course to get started</p>
                            <button
                                onClick={() => navigate("/course-builder")}
                                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
                            >
                                Create Course
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {myCourses.slice(0, 6).map((course) => (
                                <CourseCard
                                    key={course.id}
                                    course={course}
                                    onEdit={() => navigate(`/course-builder/${course.id}`)}
                                    onView={() => navigate(`/courses/${course.id}`)}
                                />
                            ))}
                        </div>
                    )}
                </section>
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

function CourseCard({ course, onEdit, onView }) {
    const statusColors = {
        draft: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
        published: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
        archived: "bg-gray-500/20 text-gray-400 border-gray-500/30"
    };

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:border-blue-500/30 transition-colors">
            {course.thumbnail_url ? (
                <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    className="w-full h-32 object-cover"
                />
            ) : (
                <div className="w-full h-32 bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                    <BookOpen size={40} className="text-white/50" />
                </div>
            )}

            <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs px-2 py-1 rounded-full border ${statusColors[course.status] || statusColors.draft}`}>
                        {course.status}
                    </span>
                    <span className="text-xs text-gray-400">Class {course.class_level}</span>
                </div>

                <h3 className="font-medium mb-1 line-clamp-1">{course.title}</h3>
                <p className="text-sm text-gray-400 line-clamp-2 mb-3">{course.description}</p>

                <div className="flex items-center justify-between text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                        <Users size={14} /> {course.total_enrollments || 0}
                    </span>
                    <span className="flex items-center gap-1">
                        <FileText size={14} /> {course.module_count || 0} modules
                    </span>
                </div>

                <div className="flex gap-2 mt-4">
                    <button
                        onClick={onEdit}
                        className="flex-1 flex items-center justify-center gap-1 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm transition-colors"
                    >
                        <Edit size={14} /> Edit
                    </button>
                    <button
                        onClick={onView}
                        className="flex-1 flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-sm transition-colors"
                    >
                        <Eye size={14} /> View
                    </button>
                </div>
            </div>
        </div>
    );
}
