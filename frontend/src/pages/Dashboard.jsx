import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  ArrowRight,
  Mail,
  Flame,
  BookOpen,
  Bell,
  BarChart3,
  Users,
  ChevronRight,
  ChevronLeft,
  Heart,
  Play,
  Award,
  Target,
  Clock,
  MessageCircle,
  User,
  TrendingUp,
  Plus,
  StickyNote,
  Calendar,
  Trash2
} from "lucide-react";
import useUserStore from "../stores/userStore";
import useNotesStore from "../stores/notesStore";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import StickyNotesCard from "../components/dashboard/StickyNotesCard";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Sample course data
const courses = [
  { id: 1, title: "Social Studies", watched: 2, total: 8, icon: Target, color: "bg-amber-100 text-amber-600" },
  { id: 2, title: "Mathematics", watched: 3, total: 8, icon: BarChart3, color: "bg-blue-100 text-blue-600" },
  { id: 3, title: "Physics", watched: 6, total: 12, icon: BookOpen, color: "bg-green-100 text-green-600" },
];

// Quick action cards data
const quickActions = [
  {
    id: 1,
    title: "My Tests",
    description: "View and submit your assigned tests, track your progress",
    icon: FileText,
    color: "bg-blue-600",
    bgColor: "bg-blue-50",
    textColor: "text-blue-600",
    route: "/test"
  },
  {
    id: 2,
    title: "Book to Bot",
    description: "Upload any textbook and chat with AI to understand concepts",
    icon: BookOpen,
    color: "bg-blue-500",
    bgColor: "bg-blue-50",
    textColor: "text-blue-600",
    route: "/book-to-bot"
  },
  {
    id: 3,
    title: "AI Helper",
    description: "Get instant answers and explanations from our AI assistant",
    icon: MessageCircle,
    color: "bg-blue-400",
    bgColor: "bg-blue-50",
    textColor: "text-blue-600",
    route: "/book-to-bot"
  },
];



// Stats data
const statsData = [
  { label: "1-10 Jan", value: 45 },
  { label: "11-20 Jan", value: 50 },
  { label: "21-30 Jan", value: 35 },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, calendar } = useUserStore();
  const { getRecentNotes } = useNotesStore();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [streakDays, setStreakDays] = useState(0);
  const [pendingTests, setPendingTests] = useState([]);
  const [loadingTests, setLoadingTests] = useState(true);

  // Dynamic dashboard data
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [activityData, setActivityData] = useState([]);
  const [dynamicCourses, setDynamicCourses] = useState([]);
  const [loadingProgress, setLoadingProgress] = useState(true);

  // Daily motivational quotes - rotates based on day of year
  const motivationalQuotes = [
    "Bringing AI to the place to where you are and everywhere ❤️",
    "Every expert was once a beginner. Keep learning! 📚",
    "Success is the sum of small efforts repeated daily 🌟",
    "Education is the passport to the future 🚀",
    "Your potential is limitless. Believe in yourself! 💪",
    "Knowledge is power. Power to change the world! 🌍",
    "Dream big, work hard, stay focused 🎯",
  ];

  const getDailyQuote = () => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    return motivationalQuotes[dayOfYear % motivationalQuotes.length];
  };

  // Get current month's activity periods (1-10, 11-20, 21-end)
  const getActivityPeriods = () => {
    const now = new Date();
    const currentDay = now.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[now.getMonth()];

    return [
      { label: `1-10 ${month}`, period: 1, isActive: currentDay >= 1 && currentDay <= 10 },
      { label: `11-20 ${month}`, period: 2, isActive: currentDay >= 11 && currentDay <= 20 },
      { label: `21-30 ${month}`, period: 3, isActive: currentDay >= 21 },
    ];
  };

  useEffect(() => {
    fetchNotifications();
    fetchPendingTests();
    fetchStreakData();
    fetchProgressData();
    fetchAvailableSubjects();
    logUserActivity();
  }, [user.id]);

  // Fetch progress data from backend
  const fetchProgressData = async () => {
    try {
      setLoadingProgress(true);
      const response = await fetch(`${API_BASE}/api/user/dashboard/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setProgressPercentage(data.progress?.overall_progress || 0);

        // Calculate activity data from streak data
        if (data.streak?.weekly_activity) {
          const periods = getActivityPeriods();
          // Map weekly activity to period bars
          const totalHours = data.streak.weekly_activity.reduce((sum, d) => sum + (d.hours || 0), 0);
          setActivityData(periods.map((p, i) => ({
            ...p,
            value: Math.min(60, 20 + (totalHours * 10 * (p.isActive ? 1.5 : 0.5))) // Scale to bar height
          })));
        } else {
          setActivityData(getActivityPeriods().map(p => ({ ...p, value: p.isActive ? 50 : 30 })));
        }
      }
    } catch (err) {
      console.error("Failed to fetch progress:", err);
      setActivityData(getActivityPeriods().map(p => ({ ...p, value: p.isActive ? 50 : 30 })));
    } finally {
      setLoadingProgress(false);
    }
  };

  // Fetch available subjects for this student's class
  const fetchAvailableSubjects = async () => {
    try {
      console.log(`📚 Fetching subjects for class ${user.classLevel || 10}`);
      const response = await fetch(`${API_BASE}/api/books/student/subjects?class_level=${user.classLevel || 10}&student_id=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        console.log("📚 Subjects API response:", data);

        // API returns {subjects: [...], class_level}
        const subjectList = data.subjects || [];

        if (subjectList.length === 0) {
          console.log("📚 No subjects found for this class level");
          return;
        }

        // Map subjects to course cards with icons
        const iconMap = {
          'Physics': BookOpen,
          'Chemistry': BarChart3,
          'Mathematics': BarChart3,
          'Hindi': Target,
          'English': FileText,
          'Social Science': Users,
          'Biology': Heart,
          'Science': BookOpen,
          'Maths': BarChart3
        };
        const colorMap = {
          'Physics': 'bg-blue-100 text-blue-700',
          'Chemistry': 'bg-blue-200 text-blue-800',
          'Mathematics': 'bg-blue-100 text-blue-600',
          'Hindi': 'bg-blue-50 text-blue-500',
          'English': 'bg-indigo-100 text-indigo-700',
          'Social Science': 'bg-blue-300 text-blue-900',
          'Biology': 'bg-blue-100 text-blue-600',
          'Science': 'bg-blue-200 text-blue-700',
          'Maths': 'bg-blue-100 text-blue-600'
        };

        const mappedCourses = subjectList.map((s, i) => ({
          id: i + 1,
          title: s.name || s.subject || s.namespace,
          watched: s.chapters_completed || 0,  // Default to 0 for new students
          total: s.total_chapters || 1,  // Use dynamic from API
          icon: iconMap[s.name] || BookOpen,
          color: colorMap[s.name] || 'bg-gray-100 text-gray-600'
        }));

        console.log("📚 Mapped courses:", mappedCourses);
        setDynamicCourses(mappedCourses);
      } else {
        console.error("📚 Failed to fetch subjects:", response.status);
      }
    } catch (err) {
      console.error("📚 Failed to fetch subjects:", err);
    }
  };

  // Fetch streak data from backend
  const fetchStreakData = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/user/streak/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setStreakDays(data.current_streak || 0);
      }
    } catch (err) {
      console.error("Failed to fetch streak:", err);
    }
  };

  // Log user activity for streak tracking
  const logUserActivity = async () => {
    try {
      await fetch(`${API_BASE}/api/user/activity/log?student_id=${user.id}&hours=0.5`, {
        method: 'POST'
      });
    } catch (err) {
      console.error("Failed to log activity:", err);
    }
  };

  const fetchPendingTests = async () => {
    try {
      setLoadingTests(true);
      const response = await fetch(`${API_BASE}/api/tests/student/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        // Filter for pending tests (not submitted)
        const pending = (data.tests || []).filter(test => test.status !== 'submitted');
        setPendingTests(pending.slice(0, 3)); // Show max 3
      }
    } catch (err) {
      console.error("Failed to fetch tests:", err);
    } finally {
      setLoadingTests(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/support-tickets/notifications/user/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  const markNotificationRead = async (notificationId) => {
    try {
      await fetch(`${API_BASE}/api/support-tickets/notifications/${notificationId}/mark-read`, {
        method: "POST"
      });
      fetchNotifications();
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const deleteNotification = async (notificationId, e) => {
    e.stopPropagation();
    try {
      await fetch(`${API_BASE}/api/support-tickets/notifications/${notificationId}`, {
        method: "DELETE"
      });
      fetchNotifications();
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  const deleteAllNotifications = async () => {
    try {
      await fetch(`${API_BASE}/api/support-tickets/notifications/all?user_id=${user.id}`, {
        method: "DELETE"
      });
      fetchNotifications();
    } catch (err) {
      console.error("Failed to delete all notifications:", err);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Top Bar */}
    

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">

            {/* Hero Banner */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-3xl p-8 text-white relative overflow-hidden">
              <div className="absolute right-0 top-0 w-64 h-64 opacity-20">
                <div className="w-full h-full bg-white/20 rounded-full blur-3xl"></div>
              </div>
              <span className="text-xs uppercase tracking-wider opacity-80">Free tier</span>
              <h2 className="text-3xl font-bold mt-2 max-w-md">
                {getDailyQuote()}
              </h2>


              {/* Course Pills - Only show if books exist in Pinecone */}
              {dynamicCourses.length > 0 && (
                <div className="flex gap-4 mt-8">
                  {dynamicCourses.slice(0, 3).map(course => (
                    <div key={course.id} className="flex items-center gap-3 bg-white/20 backdrop-blur rounded-2xl px-4 py-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${course.color}`}>
                        <course.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs opacity-80">{course.watched}/{course.total} watched</p>
                        <p className="font-medium text-sm">{course.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Quick Actions</h3>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {quickActions.map(item => (
                  <div
                    key={item.id}
                    onClick={() => navigate(item.route)}
                    className="bg-white rounded-2xl p-6 border border-gray-100 cursor-pointer hover:shadow-lg hover:border-gray-200 group"
                  >
                    <div className={`w-14 h-14 ${item.bgColor} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110`}>
                      <item.icon className={`w-7 h-7 ${item.textColor}`} />
                    </div>
                    <h4 className="font-semibold text-gray-800 text-lg mb-2">{item.title}</h4>
                    <p className="text-sm text-gray-500 mb-4">{item.description}</p>
                    <div className={`inline-flex items-center gap-2 px-4 py-2 ${item.color} text-white rounded-full text-sm font-medium`}>
                      Go to {item.title} <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Your Tests */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Your Pending Tests</h3>
                <button onClick={() => navigate('/test')} className="text-sm text-blue-600 hover:underline">See all</button>
              </div>

              {loadingTests ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : pendingTests.length === 0 ? (
                <div className="text-center py-8">
                  <Award className="w-12 h-12 mx-auto text-green-500 mb-3" />
                  <h4 className="font-semibold text-gray-800 mb-1">All Caught Up!</h4>
                  <p className="text-sm text-gray-500">You have no pending tests. Great job!</p>
                </div>
              ) : (
                <>
                  {/* Table Header */}
                  <div className="grid grid-cols-4 gap-4 text-xs text-gray-500 uppercase tracking-wider pb-3 border-b border-gray-100">
                    <span>Test Name</span>
                    <span>Subject</span>
                    <span>Due Date</span>
                    <span>Action</span>
                  </div>

                  {/* Table Rows */}
                  {pendingTests.map(test => (
                    <div key={test.id} className="grid grid-cols-4 gap-4 items-center py-4 border-b border-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <p className="font-medium text-sm text-gray-800 line-clamp-1">{test.title}</p>
                      </div>
                      <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full inline-block w-fit">
                        <BookOpen className="w-3 h-3 inline mr-1" />
                        {test.subject || 'General'}
                      </span>
                      <span className="text-sm text-gray-600">
                        {test.deadline ? new Date(test.deadline).toLocaleDateString() : 'No deadline'}
                      </span>
                      <button
                        onClick={() => navigate('/test')}
                        className="p-2 bg-blue-500 text-white rounded-full w-fit hover:bg-blue-600"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">

            {/* Statistics Card - Simplified */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-800">Your Progress</h3>
                <BarChart3 className="w-5 h-5 text-gray-400" />
              </div>

              {/* Profile Progress Ring */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 -rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="#e5e7eb" strokeWidth="8" fill="none" />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="#3b82f6"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 40 * progressPercentage / 100} ${2 * Math.PI * 40}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name || 'User'}`}
                      alt="Profile"
                      className="w-16 h-16 rounded-full"
                    />
                  </div>
                  <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                    {progressPercentage}%
                  </div>
                </div>
              </div>

              {/* Greeting */}
              <div className="text-center mb-6">
                <h4 className="font-semibold text-gray-800 flex items-center justify-center gap-1">
                  {getGreeting()} {user.name || 'Student'} <Flame className="w-4 h-4 text-orange-500" />
                </h4>
                <p className="text-sm text-gray-500">Continue your learning to achieve your target!</p>
              </div>

              {/* Bar Chart - Dynamic activity data */}
              <div className="flex items-end justify-between h-24 px-4">
                {(activityData.length > 0 ? activityData : statsData).map((stat, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div
                      className={`w-12 rounded-t-lg ${stat.isActive ? 'bg-blue-500' : 'bg-blue-200'}`}
                      style={{ height: `${stat.value}px` }}
                    />
                    <span className="text-xs text-gray-500">{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sticky Notes - Funky colorful component */}
            <StickyNotesCard />

            {/* Streak Card - Blue Theme */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Flame className="w-5 h-5" />
                    <h3 className="font-semibold">{streakDays} Day Streak</h3>
                  </div>
                  <p className="text-sm opacity-80">Keep learning daily!</p>
                </div>
                <div className="text-4xl font-bold">{streakDays}</div>
              </div>
            </div>



            {/* Message Staff - Blue Theme */}
            <div
              onClick={() => navigate("/support-tickets")}
              className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 cursor-pointer hover:shadow-lg"
            >
              <div className="flex items-center justify-between text-white">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <MessageCircle className="w-5 h-5" />
                    <h3 className="font-semibold">Message Staff</h3>
                  </div>
                  <p className="text-sm opacity-80">Get help from our team</p>
                </div>
                <ArrowRight className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
