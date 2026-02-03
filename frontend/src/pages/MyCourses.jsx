/**
 * MyCourses - Student course view
 * Browse and access enrolled courses
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    BookOpen,
    Play,
    Clock,
    Users,
    Search,
    Filter,
    GraduationCap,
    ChevronRight,
    Star
} from "lucide-react";
import useUserStore from "../stores/userStore";
import useCourseStore from "../stores/courseStore";

export default function MyCourses() {
    const navigate = useNavigate();
    const { user, isTeacher, isAdmin } = useUserStore();
    const {
        courses,
        enrolledCourses,
        myCourses,
        fetchCourses,
        fetchEnrolledCourses,
        fetchMyCourses,
        enrollInCourse,
        loading,
        error
    } = useCourseStore();

    const [activeTab, setActiveTab] = useState("enrolled");
    const [searchQuery, setSearchQuery] = useState("");

    const isInstructor = isTeacher() || isAdmin();

    useEffect(() => {
        if (isInstructor) {
            fetchMyCourses();
        } else {
            fetchEnrolledCourses();
            fetchCourses(); // For browsing
        }
    }, []);

    const displayedCourses = isInstructor
        ? myCourses
        : (activeTab === "enrolled" ? enrolledCourses : courses);

    const filteredCourses = displayedCourses?.filter(course =>
        course.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    const handleEnroll = async (courseId) => {
        await enrollInCourse(courseId);
        fetchEnrolledCourses();
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* Header */}
            <header className="bg-gray-800/50 border-b border-gray-700 px-6 py-4">
                <div className="max-w-6xl mx-auto">
                    <h1 className="text-2xl font-bold">
                        {isInstructor ? "My Courses" : "Courses"}
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">
                        {isInstructor
                            ? "Manage and view your created courses"
                            : "Browse and access your learning materials"
                        }
                    </p>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-8">
                {/* Search and Tabs */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search courses..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    {!isInstructor && (
                        <div className="flex bg-gray-800 rounded-lg p-1">
                            <button
                                onClick={() => setActiveTab("enrolled")}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "enrolled"
                                        ? "bg-blue-600 text-white"
                                        : "text-gray-400 hover:text-white"
                                    }`}
                            >
                                My Courses
                            </button>
                            <button
                                onClick={() => setActiveTab("browse")}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "browse"
                                        ? "bg-blue-600 text-white"
                                        : "text-gray-400 hover:text-white"
                                    }`}
                            >
                                Browse All
                            </button>
                        </div>
                    )}

                    {isInstructor && (
                        <button
                            onClick={() => navigate("/course-builder")}
                            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center gap-2"
                        >
                            <BookOpen size={18} />
                            Create Course
                        </button>
                    )}
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 mb-6">
                        {error}
                    </div>
                )}

                {/* Empty State */}
                {!loading && filteredCourses.length === 0 && (
                    <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
                        <GraduationCap size={48} className="mx-auto text-gray-600 mb-4" />
                        <h3 className="text-lg font-medium mb-2">
                            {activeTab === "browse" ? "No courses available" : "No courses yet"}
                        </h3>
                        <p className="text-gray-400 mb-4">
                            {isInstructor
                                ? "Create your first course to get started"
                                : activeTab === "enrolled"
                                    ? "Enroll in a course to start learning"
                                    : "Check back later for new courses"
                            }
                        </p>
                        {isInstructor ? (
                            <button
                                onClick={() => navigate("/course-builder")}
                                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
                            >
                                Create Course
                            </button>
                        ) : activeTab === "enrolled" && (
                            <button
                                onClick={() => setActiveTab("browse")}
                                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
                            >
                                Browse Courses
                            </button>
                        )}
                    </div>
                )}

                {/* Course Grid */}
                {!loading && filteredCourses.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredCourses.map((course) => (
                            <CourseCard
                                key={course.id}
                                course={course}
                                isEnrolled={enrolledCourses?.some(c => c.id === course.id)}
                                isInstructor={isInstructor}
                                onEnroll={() => handleEnroll(course.id)}
                                onView={() => navigate(`/courses/${course.id}`)}
                                onEdit={() => navigate(`/course-builder/${course.id}`)}
                                onGradebook={() => navigate(`/gradebook/${course.id}`)}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

function CourseCard({ course, isEnrolled, isInstructor, onEnroll, onView, onEdit, onGradebook }) {
    const statusColors = {
        draft: "bg-yellow-500/20 text-yellow-400",
        published: "bg-emerald-500/20 text-emerald-400",
        archived: "bg-gray-500/20 text-gray-400"
    };

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:border-blue-500/30 transition-all group">
            {/* Cover Image */}
            {course.thumbnail_url ? (
                <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    className="w-full h-36 object-cover"
                />
            ) : (
                <div className="w-full h-36 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center">
                    <BookOpen size={40} className="text-white/50" />
                </div>
            )}

            <div className="p-4">
                {/* Status Badge */}
                {isInstructor && (
                    <span className={`text-xs px-2 py-1 rounded-full ${statusColors[course.status] || statusColors.draft}`}>
                        {course.status}
                    </span>
                )}

                <h3 className="font-semibold text-lg mt-2 line-clamp-1">{course.title}</h3>
                <p className="text-sm text-gray-400 line-clamp-2 mt-1">{course.description}</p>

                {/* Meta Info */}
                <div className="flex items-center gap-4 mt-3 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                        <Users size={14} />
                        {course.total_enrollments || 0}
                    </span>
                    {course.module_count > 0 && (
                        <span className="flex items-center gap-1">
                            <BookOpen size={14} />
                            {course.module_count} modules
                        </span>
                    )}
                    {course.average_rating > 0 && (
                        <span className="flex items-center gap-1">
                            <Star size={14} className="text-yellow-400" />
                            {course.average_rating.toFixed(1)}
                        </span>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                    {isInstructor ? (
                        <>
                            <button
                                onClick={onEdit}
                                className="flex-1 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm transition-colors"
                            >
                                Edit
                            </button>
                            <button
                                onClick={onGradebook}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-sm transition-colors"
                            >
                                Gradebook
                            </button>
                        </>
                    ) : isEnrolled ? (
                        <button
                            onClick={onView}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
                        >
                            <Play size={16} />
                            Continue Learning
                        </button>
                    ) : (
                        <button
                            onClick={onEnroll}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg transition-colors"
                        >
                            Enroll Now
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
