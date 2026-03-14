import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  ArrowRight,
  Flame,
  BookOpen,
  BarChart3,
  Users,
  Heart,
  Award,
  Target,
  MessageCircle
} from "lucide-react";
import useUserStore from "../stores/userStore";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import LoadingSpinner from "../components/LoadingSpinner";
import quotesData from "../data/quotes.json";
import authFetch from "../utils/authFetch";
import { testService } from "../services/api";

const API_BASE = import.meta.env.VITE_API_URL;

const quickActions = [
  {
    id: 1,
    title: "My Tests",
    description: "View and submit your assigned tests, track your progress",
    icon: FileText,
    color: "bg-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-900/25",
    textColor: "text-orange-600 dark:text-orange-300",
    route: "/test",
    featureKey: "test_center"
  },
  {
    id: 2,
    title: "Book to Bot",
    description: "Chat with AI to understand concepts",
    icon: BookOpen,
    color: "bg-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-900/25",
    textColor: "text-orange-600 dark:text-orange-300",
    route: "/book-to-bot",
    featureKey: "book_to_bot"
  },
  {
    id: 3,
    title: "My Groups",
    description: "View your assigned groups, teachers and upcoming tests",
    icon: Users,
    color: "bg-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-900/25",
    textColor: "text-orange-600 dark:text-orange-300",
    route: "/my-groups"
  },
  {
    id: 4,
    title: "AI Helper",
    description: "Get instant answers and explanations from our AI assistant",
    icon: MessageCircle,
    color: "bg-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-900/25",
    textColor: "text-orange-600 dark:text-orange-300",
    route: "/book-to-bot",
    featureKey: "book_to_bot"
  },
];

const statsData = [
  { label: "1-10 Jan", value: 45 },
  { label: "11-20 Jan", value: 50 },
  { label: "21-30 Jan", value: 35 },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, getAuthHeader } = useUserStore();
  const [streakDays, setStreakDays] = useState(0);
  const [pendingTests, setPendingTests] = useState([]);
  const [loadingTests, setLoadingTests] = useState(true);

  const [progressPercentage, setProgressPercentage] = useState(0);
  const [activityData, setActivityData] = useState([]);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [features, setFeatures] = useState({ ai_chatbot: false, test_center: false, my_grades: false, book_to_bot: true });
  const [recentNotes, setRecentNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(true);

  const getDailyQuote = () => {
    
    const day = new Date().getDate();
    
    const quoteIndex = (day - 1) % quotesData.quotes.length;
    return quotesData.quotes[quoteIndex];
  };

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
    if (!user?.id) return;
    fetchPendingTests();
    fetchStreakData();
    fetchProgressData();
    logUserActivity();
    fetchFeatures();
    fetchRecentNotes();
  }, [user?.id]);

  const fetchFeatures = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/student/my-features`, {
        headers: getAuthHeader()
      });
      if (res.ok) {
        const data = await res.json();
        setFeatures(data.features || { ai_chatbot: false, test_center: false, my_grades: false, book_to_bot: true });
      }
    } catch (err) {
    }
  };

  const fetchProgressData = async () => {
    try {
      setLoadingProgress(true);
      const response = await authFetch(`${API_BASE}/api/user/dashboard/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setProgressPercentage(data.progress?.overall_progress || 0);

        if (data.streak?.weekly_activity) {
          const periods = getActivityPeriods();
          
          const totalHours = data.streak.weekly_activity.reduce((sum, d) => sum + (d.hours || 0), 0);
          setActivityData(periods.map((p, i) => ({
            ...p,
            value: Math.min(60, 20 + (totalHours * 10 * (p.isActive ? 1.5 : 0.5))) 
          })));
        } else {
          setActivityData(getActivityPeriods().map(p => ({ ...p, value: p.isActive ? 50 : 30 })));
        }
      }
    } catch (err) {
      setActivityData(getActivityPeriods().map(p => ({ ...p, value: p.isActive ? 50 : 30 })));
    } finally {
      setLoadingProgress(false);
    }
  };

  const fetchStreakData = async () => {
    try {
      const response = await authFetch(`${API_BASE}/api/user/streak/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setStreakDays(data.current_streak || 0);
      }
    } catch (err) {
    }
  };

  const logUserActivity = async () => {
    try {
      await authFetch(`${API_BASE}/api/user/activity/log?student_id=${user.id}&hours=0.5`, {
        method: 'POST'
      });
    } catch (err) {
    }
  };

  const fetchPendingTests = async () => {
    if (!user?.id) {
      setPendingTests([]);
      setLoadingTests(false);
      return;
    }
    try {
      setLoadingTests(true);
      const staffTests = await testService.getStaffTests(user.preferredSubject, null, user.id);
      const now = new Date();
      const parseDate = (s) => {
        if (!s) return null;
        const d = new Date(String(s).replace(" ", "T"));
        return Number.isNaN(d.valueOf()) ? null : d;
      };

      const pending = (Array.isArray(staffTests) ? staffTests : []).filter((test) => {
        const start = parseDate(test.start_date);
        const due = parseDate(test.due_date);
        const isActive = (!start || now >= start) && (!due || now <= due);
        return isActive && !test.has_attempted;
      });

      setPendingTests(pending.slice(0, 3));
    } catch (err) {
      setPendingTests([]);
    } finally {
      setLoadingTests(false);
    }
  };

  const fetchRecentNotes = async () => {
    try {
      setLoadingNotes(true);
      const res = await authFetch(`${API_BASE}/api/notes/${user.id}`);
      if (!res.ok) {
        setRecentNotes([]);
        return;
      }
      const data = await res.json();
      const notes = Array.isArray(data?.notes) ? data.notes : [];
      setRecentNotes(notes.slice(0, 3));
    } catch {
      setRecentNotes([]);
    } finally {
      setLoadingNotes(false);
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

            <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-3xl p-8 text-white relative overflow-hidden">
              <div className="absolute right-0 top-0 w-64 h-64 opacity-20">
                <div className="w-full h-full bg-white/20 rounded-full blur-3xl"></div>
              </div>
              <h2 className="text-3xl font-semibold max-w-md leading-tight">
                "{getDailyQuote().text}"
              </h2>
              <p className="text-sm mt-2 opacity-90 font-medium">— {getDailyQuote().author}</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Quick Actions</h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {quickActions.map(item => {
                  const isLocked = item.featureKey && !features[item.featureKey];
                  return (
                  <div
                    key={item.id}
                    onClick={() => navigate(item.route)}
                    className={`relative bg-white dark:bg-zinc-900 rounded-2xl p-6 border cursor-pointer hover:shadow-lg group transition-all ${isLocked ? 'border-gray-100 dark:border-zinc-800 opacity-80' : 'border-gray-100 dark:border-zinc-800 hover:border-gray-200 dark:hover:border-zinc-700'}`}
                  >
                    {isLocked && (
                      <div className="absolute top-3 right-3 w-6 h-6 bg-gray-800/80 rounded-full flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      </div>
                    )}
                    <div className={`w-14 h-14 ${item.bgColor} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110`}>
                      <item.icon className={`w-7 h-7 ${item.textColor}`} />
                    </div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-100 text-lg mb-2">{item.title}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{item.description}</p>
                    {isLocked ? (
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 rounded-full text-sm font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        Locked by Admin
                      </div>
                    ) : (
                      <div className={`inline-flex items-center gap-2 px-4 py-2 ${item.color} text-white rounded-full text-sm font-medium`}>
                        Go to {item.title} <ArrowRight className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
                })}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-100 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Your Pending Tests</h3>
                <button onClick={() => navigate('/test')} className="text-sm text-orange-600 dark:text-orange-300 hover:underline">See all</button>
              </div>

              {loadingTests ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="sm" color="orange" text="" />
                </div>
              ) : pendingTests.length === 0 ? (
                <div className="text-center py-8">
                  <Award className="w-12 h-12 mx-auto text-green-500 mb-3" />
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">All Caught Up!</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">You have no pending tests. Great job!</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-4 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider pb-3 border-b border-gray-100 dark:border-zinc-800">
                    <span>Test Name</span>
                    <span>Subject</span>
                    <span>Due Date</span>
                    <span>Action</span>
                  </div>

                  {pendingTests.map(test => (
                    <div key={test.id} className="grid grid-cols-4 gap-4 items-center py-4 border-b border-gray-50 dark:border-zinc-800">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-50 dark:bg-orange-900/25 rounded-full flex items-center justify-center">
                          <FileText className="w-5 h-5 text-orange-600 dark:text-orange-300" />
                        </div>
                        <p className="font-medium text-sm text-gray-800 dark:text-gray-100 line-clamp-1">{test.title}</p>
                      </div>
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full inline-block w-fit">
                        <BookOpen className="w-3 h-3 inline mr-1" />
                        {test.subject || 'General'}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {test.due_date ? new Date(test.due_date).toLocaleDateString() : 'No deadline'}
                      </span>
                      <button
                        onClick={() => navigate('/test')}
                        className="p-2 bg-orange-500 text-white rounded-full w-fit hover:bg-orange-600"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="space-y-6">

            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-100 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Your Progress</h3>
                <BarChart3 className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </div>

              <div className="flex flex-col items-center mb-6">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 -rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="#e5e7eb" strokeWidth="8" fill="none" className="dark:stroke-zinc-700" />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="#f97316"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 40 * progressPercentage / 100} ${2 * Math.PI * 40}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img
                      src={`https://api.dicebear.com/7.x/${user.avatarStyle || 'avataaars'}/svg?seed=${user.avatarSeed || user.name || 'User'}`}
                      alt="Profile"
                      className="w-16 h-16 rounded-full"
                    />
                  </div>
                  <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                    {progressPercentage}%
                  </div>
                </div>
              </div>

              <div className="text-center mb-6">
                <h4 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center justify-center gap-1">
                  {getGreeting()} {user.name || 'Student'} <Flame className="w-4 h-4 text-orange-500" />
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Continue your learning to achieve your target!</p>
              </div>

              <div className="flex items-end justify-between h-24 px-4">
                {(activityData.length > 0 ? activityData : statsData).map((stat, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div
                      className={`w-12 rounded-t-lg ${stat.isActive ? 'bg-orange-500' : 'bg-orange-200 dark:bg-orange-900/40'}`}
                      style={{ height: `${stat.value}px` }}
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-100 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Recent Notes</h3>
                <button
                  onClick={() => navigate('/notes')}
                  className="text-sm text-orange-600 dark:text-orange-300 hover:underline"
                >
                  Open Notes
                </button>
              </div>

              {loadingNotes ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 py-3">Loading notes...</div>
              ) : recentNotes.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 py-3">
                  No notes yet. Start taking notes in Book to Bot.
                </div>
              ) : (
                <div className="space-y-2">
                  {recentNotes.map((note) => (
                    <button
                      key={note.id}
                      onClick={() => navigate('/notes')}
                      className="w-full text-left px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-gray-800 dark:text-gray-100 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                      title={note.heading || note.note_content || "Untitled Note"}
                    >
                      <span className="text-sm font-medium line-clamp-1">
                        {note.heading || "Untitled Note"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white">
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

            <div
              onClick={() => navigate("/about-you?tab=suggestions")}
              className="bg-gradient-to-r from-orange-600 to-orange-700 rounded-2xl p-6 cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between text-white">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <MessageCircle className="w-5 h-5" />
                    <h3 className="font-semibold">Suggestions</h3>
                  </div>
                  <p className="text-sm opacity-80">Share your feedback with admin</p>
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
