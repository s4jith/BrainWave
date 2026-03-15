
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import useUserStore from "../stores/userStore";
import useThemeStore from "../stores/themeStore";
import {
    LayoutDashboard, Users, GraduationCap, FolderKanban, BookOpen,
    ClipboardList, BarChart3, Settings, Bell, LogOut, HelpCircle,
    FileText, Sun, Moon, Monitor, ChevronDown, Bookmark, Trash2, Check, X, Layers,
    MessageCircle, BookMarked, MessageSquare, Compass
} from "lucide-react";
import authFetch from "../utils/authFetch";

const API_URL = import.meta.env.VITE_API_URL;
const BRAND_LOGO_SRC = "/image.png";

export default function AdminLayout({ children, title, icon: Icon }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, getAuthHeader } = useUserStore();
    const { theme, setTheme, initTheme } = useThemeStore();

    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showThemeMenu, setShowThemeMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const themeMenuRef = useRef(null);
    const notificationRef = useRef(null);

    const currentPath = location.pathname;

    useEffect(() => {
        initTheme();
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (themeMenuRef.current && !themeMenuRef.current.contains(e.target)) {
                setShowThemeMenu(false);
            }
            if (notificationRef.current && !notificationRef.current.contains(e.target)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        const headers = getAuthHeader();
        if (!headers.Authorization) return;

        try {
            const response = await authFetch(`${API_URL}/api/notifications`, {
                headers
            });
            if (response.ok) {
                const data = await response.json();
                setNotifications(data.notifications || []);
                setUnreadCount(data.unread_count || 0);
            }
        } catch (err) {
            console.error("Fetch notifications error:", err);
        }
    };

    const markAsRead = async (notificationId) => {
        try {
            await authFetch(`${API_URL}/api/notifications/${notificationId}/read`, {
                method: 'POST',
                headers: getAuthHeader()
            });
            fetchNotifications();
        } catch (err) {
            console.error("Mark read error:", err);
        }
    };

    const saveNotification = async (notificationId) => {
        try {
            await authFetch(`${API_URL}/api/notifications/${notificationId}/save`, {
                method: 'POST',
                headers: getAuthHeader()
            });
            fetchNotifications();
        } catch (err) {
            console.error("Save notification error:", err);
        }
    };

    const deleteNotification = async (notificationId) => {
        try {
            await authFetch(`${API_URL}/api/notifications/${notificationId}`, {
                method: 'DELETE',
                headers: getAuthHeader()
            });
            fetchNotifications();
        } catch (err) {
            console.error("Delete notification error:", err);
        }
    };

    const markAllRead = async () => {
        try {
            await authFetch(`${API_URL}/api/notifications/read-all`, {
                method: 'POST',
                headers: getAuthHeader()
            });
            fetchNotifications();
        } catch (err) {
            console.error("Mark all read error:", err);
        }
    };

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    const adminNavGroups = [
        { type: 'item', path: "/admin-dashboard", label: "Dashboard", icon: LayoutDashboard },
        { type: 'item', path: "/subjects-management", label: "Subjects", icon: Layers },
        { type: 'item', path: "/book-management", label: "Books", icon: BookOpen },
        {
            type: 'group', id: "Users", label: "Users", icon: Users,
            children: [
                { path: "/student-management", label: "Students", icon: Users },
                { path: "/teacher-management", label: "Teachers", icon: GraduationCap },
                { path: "/group-management", label: "Student Groups", icon: FolderKanban },
            ]
        },
        {
            type: 'group', id: "Questions", label: "Questions", icon: HelpCircle,
            children: [
                { path: "/question-bank", label: "Question Bank", icon: HelpCircle },
                { path: "/question-papers", label: "Question Papers", icon: FileText },
            ]
        },
        { type: 'item', path: "/test-management", label: "Tests", icon: ClipboardList },
        { type: 'item', path: "/admin-reports", label: "Results", icon: BarChart3 },
        { type: 'item', path: "/career-questions", label: "Career Analysis", icon: Compass },
        { type: 'item', path: "/admin-suggestions", label: "Suggestions", icon: MessageCircle },
        { type: 'item', path: "/admin-settings", label: "Settings", icon: Settings },
    ];

    const teacherNavItems = [
        { path: "/teacher-dashboard", label: "Dashboard", icon: LayoutDashboard },
        { path: "/teacher-groups", label: "Student Groups", icon: Users },
        { path: "/question-bank", label: "Question Bank", icon: HelpCircle },
        { path: "/question-papers", label: "Question Papers", icon: FileText },
        { path: "/teacher-tests", label: "Tests", icon: ClipboardList },
        { path: "/teacher-queries", label: "Student Queries", icon: MessageSquare },
        { path: "/teacher-reports", label: "Reports", icon: BarChart3 },
    ];

    const headNavItems = [
        { path: "/head-dashboard", label: "Dashboard", icon: LayoutDashboard },
        { path: "/head-groups", label: "Groups", icon: FolderKanban },
        { path: "/question-bank", label: "Question Bank", icon: HelpCircle },
        { path: "/question-papers", label: "Question Papers", icon: FileText },
        { path: "/head-tests", label: "Tests", icon: ClipboardList },
        { path: "/head-reports", label: "Reports", icon: BarChart3 },
    ];

    const [expandedNavGroups, setExpandedNavGroups] = useState({ Users: true, Questions: true });
    const navItems = user?.role === "teacher"
        ? teacherNavItems
        : user?.role === "head"
            ? headNavItems
            : [];

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
    const roleLabel = user?.role ? String(user.role).charAt(0).toUpperCase() + String(user.role).slice(1) : "";

    return (
        <div className="h-screen bg-gray-50 dark:bg-black flex transition-colors duration-200 overflow-hidden">
            {}
            <aside className="w-64 h-screen bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 flex flex-col flex-shrink-0 transition-colors duration-200">
                {}
                <div className="h-16 flex items-center px-4 border-b border-gray-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <img
                            src={BRAND_LOGO_SRC}
                            alt="Brainwave logo"
                            className="w-9 h-9 object-contain"
                        />
                        <div>
                            <h1 className="font-semibold text-gray-900 dark:text-white text-sm">Brainwave</h1>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Learning Platform</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                    {user?.role === "admin" ? (
                        adminNavGroups.map((item) => {
                            if (item.type === 'group') {
                                const isExpanded = expandedNavGroups[item.id];
                                const GroupIcon = item.icon;
                                const isGroupActive = item.children.some(c => currentPath === c.path);
                                return (
                                    <div key={item.id}>
                                        <button
                                            onClick={() => setExpandedNavGroups(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                                                isGroupActive
                                                    ? 'text-gray-900 dark:text-white font-medium'
                                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                            }`}
                                        >
                                            <GroupIcon className="w-5 h-5" />
                                            <span className="flex-1 text-left">{item.label}</span>
                                            <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                        </button>
                                        {isExpanded && (
                                            <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-100 dark:border-gray-700 pl-3">
                                                {item.children.map(child => {
                                                    const ChildIcon = child.icon;
                                                    const isActive = currentPath === child.path;
                                                    return (
                                                        <button
                                                            key={child.path}
                                                            onClick={() => navigate(child.path)}
                                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                                                                isActive
                                                                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium'
                                                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                                            }`}
                                                        >
                                                            <ChildIcon className="w-4 h-4" />
                                                            <span>{child.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                            const ItemIcon = item.icon;
                            const isActive = currentPath === item.path ||
                                (item.path === "/test-management" && (currentPath === "/create-test" || currentPath.startsWith("/test/edit/")));
                            return (
                                <button
                                    key={item.path}
                                    onClick={() => navigate(item.path)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                                        isActive
                                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium'
                                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                    }`}
                                >
                                    <ItemIcon className="w-5 h-5" />
                                    <span>{item.label}</span>
                                </button>
                            );
                        })
                    ) : (
                        navItems.map((item) => {
                            const ItemIcon = item.icon;
                            const isActive = currentPath === item.path ||
                                (item.path === "/test-management" && (currentPath === "/create-test" || currentPath.startsWith("/test/edit/")));
                            return (
                                <button
                                    key={item.path}
                                    onClick={() => navigate(item.path)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                                        isActive
                                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium'
                                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                    }`}
                                >
                                    <ItemIcon className="w-5 h-5" />
                                    <span>{item.label}</span>
                                </button>
                            );
                        })
                    )}
                </nav>

                {/* Bottom Section */}

                {/* Teacher Settings Link */}
                {user?.role === "teacher" && (
                    <div className="px-3 pb-2">
                        <button
                            onClick={() => navigate("/teacher-settings")}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                                ${currentPath === "/teacher-settings"
                                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                        >
                            <Settings className="w-5 h-5" />
                            <span>Settings</span>
                        </button>
                    </div>
                )}

                {}
                <div className="p-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3 px-3 py-2">
                        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-200 text-sm font-medium">
                            {user?.name?.charAt(0)?.toUpperCase() || "A"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name || "Admin"}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Sign out"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </aside>

            {}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {}
                <header className="h-16 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between px-6 flex-shrink-0 transition-colors duration-200">
                    <div className="flex items-center gap-3">
                        {Icon && <Icon className="w-5 h-5 text-gray-400 dark:text-gray-500" />}
                        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h1>
                        {roleLabel && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700">
                                {roleLabel}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {}
                        <div className="relative" ref={themeMenuRef}>
                            <button
                                onClick={() => setShowThemeMenu(!showThemeMenu)}
                                className="p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                title="Toggle theme"
                            >
                                <ThemeIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                            </button>

                            {showThemeMenu && (
                                <div className="absolute right-0 top-full mt-2 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                                    {themeOptions.map((option) => {
                                        const OptionIcon = option.icon;
                                        return (
                                            <button
                                                key={option.value}
                                                onClick={() => {
                                                    setTheme(option.value);
                                                    setShowThemeMenu(false);
                                                }}
                                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors
                          ${theme === option.value
                                                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                                            >
                                                <OptionIcon className="w-4 h-4" />
                                                {option.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Notifications */}
                        <div className="relative" ref={notificationRef}>
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="relative p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>

                            {showNotifications && (
                                <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-hidden">
                                    <div className="p-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                        <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
                                        {unreadCount > 0 && (
                                            <button
                                                onClick={markAllRead}
                                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                            >
                                                Mark all read
                                            </button>
                                        )}
                                    </div>
                                    <div className="overflow-y-auto max-h-72">
                                        {notifications.length === 0 ? (
                                            <p className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">No notifications</p>
                                        ) : (
                                            notifications.slice(0, 10).map((n) => (
                                                <div
                                                    key={n.id}
                                                    className={`p-3 border-b border-gray-100 dark:border-gray-700 last:border-0 ${!n.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className={`text-sm font-medium ${!n.read ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                                                    {n.title}
                                                                </p>
                                                                {n.saved && (
                                                                    <Bookmark className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{n.message}</p>
                                                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                                {n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}
                                                                {n.expires_in_days && !n.saved && (
                                                                    <span className="ml-2 text-orange-500">Expires in {n.expires_in_days} days</span>
                                                                )}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            {!n.read && (
                                                                <button
                                                                    onClick={() => markAsRead(n.id)}
                                                                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                                                    title="Mark as read"
                                                                >
                                                                    <Check className="w-3.5 h-3.5 text-green-600" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => saveNotification(n.id)}
                                                                className={`p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded ${n.saved ? 'text-yellow-500' : 'text-gray-400'}`}
                                                                title={n.saved ? 'Saved' : 'Save permanently'}
                                                            >
                                                                <Bookmark className={`w-3.5 h-3.5 ${n.saved ? 'fill-yellow-500' : ''}`} />
                                                            </button>
                                                            <button
                                                                onClick={() => deleteNotification(n.id)}
                                                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-red-500"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-6 overflow-y-auto bg-gray-50 dark:bg-black transition-colors duration-200">
                    {children}
                </main>
            </div>
        </div>
    );
}
