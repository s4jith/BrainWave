/**
 * AdminLayout - Reusable layout component for all admin pages
 * Provides consistent sidebar navigation, header, and light/dark/system theme switcher
 */

import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import useUserStore from "../stores/userStore";
import useThemeStore from "../stores/themeStore";
import {
    LayoutDashboard, Users, GraduationCap, FolderKanban, BookOpen,
    ClipboardList, BarChart3, Settings, Bell, LogOut, HelpCircle,
    FileText, Sun, Moon, Monitor, ChevronDown
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function AdminLayout({ children, title, icon: Icon }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, getAuthHeader } = useUserStore();
    const { theme, setTheme, initTheme } = useThemeStore();

    const [notifications, setNotifications] = useState([]);
    const [showThemeMenu, setShowThemeMenu] = useState(false);
    const themeMenuRef = useRef(null);

    const currentPath = location.pathname;

    // Initialize theme on mount
    useEffect(() => {
        initTheme();
    }, []);

    // Close theme menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (themeMenuRef.current && !themeMenuRef.current.contains(e.target)) {
                setShowThemeMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            const response = await fetch(`${API_URL}/api/notifications`, {
                headers: getAuthHeader()
            });
            if (response.ok) {
                const data = await response.json();
                setNotifications(data.slice(0, 5));
            }
        } catch (err) {
            console.error("Fetch notifications error:", err);
        }
    };

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    const navItems = [
        { path: "/admin-dashboard", label: "Dashboard", icon: LayoutDashboard },
        { path: "/student-management", label: "Students", icon: Users },
        { path: "/teacher-management", label: "Teachers", icon: GraduationCap },
        { path: "/group-management", label: "Student Groups", icon: FolderKanban },
        { path: "/book-management", label: "Books", icon: BookOpen },
        { path: "/test-management", label: "Tests", icon: ClipboardList },
        { path: "/admin-reports", label: "Reports", icon: BarChart3 },
        { path: "/admin-settings", label: "Settings", icon: Settings },
    ];

    const themeOptions = [
        { value: 'light', label: 'Light', icon: Sun },
        { value: 'dark', label: 'Dark', icon: Moon },
        { value: 'system', label: 'System', icon: Monitor },
    ];

    const getThemeIcon = () => {
        switch (theme) {
            case 'dark': return Moon;
            case 'light': return Sun;
            default: return Monitor;
        }
    };

    const ThemeIcon = getThemeIcon();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex transition-colors duration-200">
            {/* Left Sidebar */}
            <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0 transition-colors duration-200">
                {/* Logo */}
                <div className="h-16 flex items-center px-4 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gray-900 dark:bg-white rounded-xl flex items-center justify-center">
                            <span className="text-white dark:text-gray-900 font-bold text-lg">S</span>
                        </div>
                        <div>
                            <h1 className="font-semibold text-gray-900 dark:text-white text-sm">Smart Assessment</h1>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Platform</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                    {navItems.map((item) => {
                        const ItemIcon = item.icon;
                        const isActive = currentPath === item.path;
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                  ${isActive
                                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                            >
                                <ItemIcon className="w-5 h-5" />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>

                {/* Bottom Section */}
                <div className="p-3 border-t border-gray-100 dark:border-gray-700 space-y-1">
                    <a
                        href="https://docs.example.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                        <FileText className="w-5 h-5" />
                        <span>Documentation</span>
                    </a>
                    <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <HelpCircle className="w-5 h-5" />
                        <span>Help & Support</span>
                    </button>
                </div>

                {/* User Profile */}
                <div className="p-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3 px-3 py-2">
                        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-200 text-sm font-medium">
                            {user?.name?.charAt(0)?.toUpperCase() || "A"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name || "Admin"}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                        </div>
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
                {/* Top Header */}
                <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6 flex-shrink-0 transition-colors duration-200">
                    <div className="flex items-center gap-3">
                        {Icon && <Icon className="w-5 h-5 text-gray-400 dark:text-gray-500" />}
                        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h1>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Theme Switcher */}
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
                        <button className="relative p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                            <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                            {notifications.filter(n => !n.is_read).length > 0 && (
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
                            )}
                        </button>

                        {/* Logout */}
                        <button
                            onClick={handleLogout}
                            className="p-2.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
                    {children}
                </main>
            </div>
        </div>
    );
}
