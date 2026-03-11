import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  BookOpen,
  MessageSquare,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Sparkles,
  Bell,
  HelpCircle,
  LayoutGrid,
  GraduationCap,
  StickyNote,
  Calendar,
  Award,
  ClipboardCheck,
  Users,
  MessageCircle,
  Home,
  Sun,
  Moon,
  Monitor,
  Lock,
  Compass
} from "lucide-react";
import useUserStore from "../../stores/userStore";
import useThemeStore from "../../stores/themeStore";
import ChatbotPanel from "./ChatbotPanel";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Map nav item IDs to their required feature flag
const featureGatedItems = {
  "ai-chat": "ai_chatbot",
  "test-center": "test_center",
  "grades": "my_grades",
  "book-to-bot": "book_to_bot"
};

const navItems = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: Home,
    path: "/dashboard"
  },
  {
    id: "ai-chat",
    label: "AI Chat Helper",
    icon: MessageSquare,
    path: "/ai-chat",
    isChat: true
  },
  {
    id: "groups",
    label: "My Groups",
    icon: Users,
    path: "/my-groups"
  },
  {
    id: "grades",
    label: "My Grades",
    icon: Award,
    path: "/my-grades"
  },
  {
    id: "test-center",
    label: "Test Center",
    icon: ClipboardCheck,
    path: "/test"
  },
  {
    id: "book-to-bot",
    label: "Book to Bot",
    icon: BookOpen,
    path: "/book-to-bot"
  },
  {
    id: "notes",
    label: "Your Notes",
    icon: StickyNote,
    path: "/notes"
  },
  {
    id: "suggestions",
    label: "Suggestions",
    icon: MessageCircle,
    path: "/suggestions"
  },
  {
    id: "career-test",
    label: "Career Analysis",
    icon: Compass,
    path: "/career-test"
  },
  {
    id: "about-you",
    label: "Settings",
    icon: Settings,
    path: "/about-you"
  }
];

export default function DashboardLayout({ children, noPadding = false, noHeader = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, calendar, logout, getAuthHeader } = useUserStore();
  const { theme, setTheme, initTheme } = useThemeStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const themeMenuRef = useRef(null);
  const [features, setFeatures] = useState({ ai_chatbot: false, test_center: false, my_grades: false, book_to_bot: true });
  const [featuresLoaded, setFeaturesLoaded] = useState(false);

  useEffect(() => {
    initTheme();
    fetchFeatures();
  }, []);

  const fetchFeatures = async () => {
    try {
      const res = await fetch(`${API_URL}/api/student/my-features`, {
        headers: getAuthHeader()
      });
      if (res.ok) {
        const data = await res.json();
        setFeatures(data.features || { ai_chatbot: false, test_center: false, my_grades: false, book_to_bot: true });
      }
    } catch (err) {
      console.error("Failed to fetch features:", err);
    } finally {
      setFeaturesLoaded(true);
    }
  };

  // Mark nav items as locked based on feature flags (show all, don't filter)
  const displayNavItems = navItems.map(item => ({
    ...item,
    isLocked: featureGatedItems[item.id] ? !features[featureGatedItems[item.id]] : false
  }));

  useEffect(() => {
    const handleClick = (e) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target)) {
        setShowThemeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleNavClick = (item) => {
    if (item.isLocked) {
      // Navigate to the item's page so the FeatureGatedRoute shows the lock overlay
      if (item.path) navigate(item.path);
      return;
    }
    if (item.isChat) {
      setChatbotOpen(true);
    } else if (item.path) {
      navigate(item.path);
    }
  };

  const isActive = (path) => location.pathname === path;

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  const getThemeIcon = () => {
    switch (theme) {
      case 'dark': return Moon;
      case 'light': return Sun;
      default: return Sun;
    }
  };

  const ThemeIcon = getThemeIcon();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      {}
      <aside
        className={`flex-shrink-0 transition-all duration-300 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col ${sidebarOpen ? "w-64" : "w-20"
          }`}
      >
        {}
        <div className="p-5 flex items-center justify-between">
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-gray-900 dark:text-white text-lg">The brainwave</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Collapse sidebar"
              >
                <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mx-auto"
              title="Expand sidebar"
            >
              <Sparkles className="w-5 h-5 text-white" />
            </button>
          )}
        </div>

        {}
        <nav className="flex-1 px-3 py-2 space-y-1">
          {displayNavItems.map((item) => {
            const Icon = item.icon;
            const active = item.path && isActive(item.path);
            const isChatActive = item.isChat && chatbotOpen;

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
                  isChatActive || active
                    ? "bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                    : item.isLocked
                    ? "text-gray-400 dark:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isChatActive || active ? 'text-gray-900 dark:text-white' : item.isLocked ? 'text-gray-300 dark:text-gray-600' : 'text-gray-400 dark:text-gray-500'}`} />
                  {sidebarOpen && (
                    <span className="font-medium text-sm">{item.label}</span>
                  )}
                </div>
                {sidebarOpen && (
                  <div className="flex items-center gap-1">
                    {item.isLocked && (
                      <Lock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-600" />
                    )}
                    {!item.isLocked && item.badge && (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Moved Reminders to Dashboard page - This space is now for navigation only */}
        {sidebarOpen && false && (
          <div className="px-3 pb-3">
            <div
              className="rounded-2xl p-5 relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #ea580c 0%, #f97316 50%, #fb923c 100%)'
              }}
            >
              {}
              <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-white/30" />
              <div className="absolute top-8 right-6 w-3 h-3 rounded-full bg-white/20" />
              <div className="absolute bottom-12 right-4 w-16 h-16 rounded-full bg-white/10 blur-sm" />

              <div className="relative z-10">
                <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center mb-3">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-white font-bold text-lg mb-1">Reminders</h3>

                {}
                {!calendar.exams || calendar.exams.length === 0 ? (
                  <p className="text-white/90 text-sm">
                    No upcoming exams. Have a great day! 📚
                  </p>
                ) : (() => {
                  const today = new Date();
                  const upcomingExams = calendar.exams
                    .map(exam => ({
                      ...exam,
                      dateObj: new Date(exam.date)
                    }))
                    .filter(exam => exam.dateObj >= today)
                    .sort((a, b) => a.dateObj - b.dateObj);

                  if (upcomingExams.length === 0) {
                    return (
                      <p className="text-white/90 text-sm">
                        All caught up! No upcoming exams.
                      </p>
                    );
                  }

                  const nextExam = upcomingExams[0];
                  const daysUntil = Math.ceil((nextExam.dateObj - today) / (1000 * 60 * 60 * 24));
                  const dateStr = nextExam.dateObj.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  });

                  return (
                    <div className="space-y-2">
                      <p className="text-white/90 text-sm font-medium">
                        {daysUntil === 0 ? '🔥 Today!' :
                          daysUntil === 1 ? '⚡ Tomorrow' :
                            `📅 In ${daysUntil} days`}
                      </p>
                      <p className="text-white font-semibold text-base">
                        {nextExam.subject}
                      </p>
                      <p className="text-white/70 text-xs">
                        {dateStr}
                      </p>
                      {upcomingExams.length > 1 && (
                        <p className="text-white/60 text-xs mt-2">
                          +{upcomingExams.length - 1} more exam{upcomingExams.length > 2 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )
        }

        {/* Logout */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-5 h-5" />
              {sidebarOpen && <span className="font-medium text-sm">Log out</span>}
            </div>
          </button>
        </div>
      </aside >

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header with Theme Toggle */}
        {!noHeader && (
        <header className="flex-shrink-0 h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 flex items-center justify-between transition-colors">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {user?.name || 'Student Dashboard'}
            </h2>
          </div>
          
          {/* Theme Switcher in Header */}
          <div className="relative" ref={themeMenuRef}>
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors border border-gray-200 dark:border-gray-700"
              title="Change theme"
            >
              <ThemeIcon className="w-5 h-5" />
              <span className="text-sm font-medium hidden sm:inline">Theme</span>
            </button>
            {showThemeMenu && (
              <div className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                {themeOptions.map((option) => {
                  const OptionIcon = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() => { setTheme(option.value); setShowThemeMenu(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                        theme === option.value
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <OptionIcon className="w-4 h-4" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </header>
        )}

        {/* Page Content */}
        <div className={noPadding ? "flex-1 overflow-hidden" : "flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-950 transition-colors duration-200"}>
          {children}
        </div>
      </main>

      {/* Mobile Menu Toggle */}
      < button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed bottom-4 left-4 z-40 lg:hidden p-3 rounded-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-lg border border-gray-200 dark:border-gray-700"
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button >

      {/* Chatbot Panel */}
      < ChatbotPanel isOpen={chatbotOpen} onClose={() => setChatbotOpen(false)} />
    </div >
  );
}
