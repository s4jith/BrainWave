// @ts-nocheck
'use client';

import { useRef, useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard, Users, GraduationCap, FolderKanban, BookOpen,
    ClipboardList, BarChart3, Settings, LogOut, HelpCircle,
    FileText, Layers, MessageCircle, MessageSquare, BookMarked,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';
import { siteConfig } from '../../config/site';
import type { UserRole } from '../../types';

interface NavItem {
    path: string;
    label: string;
    icon: React.FC<{ className?: string }>;
}

const navByRole: Record<UserRole, NavItem[]> = {
    ADMIN: [
        { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/admin/students', label: 'Students', icon: Users },
        { path: '/admin/teachers', label: 'Teachers', icon: GraduationCap },
        { path: '/admin/heads', label: 'Heads', icon: BookMarked },
        { path: '/admin/groups', label: 'Student Groups', icon: FolderKanban },
        { path: '/admin/subjects', label: 'Subjects', icon: Layers },
        { path: '/admin/books', label: 'Books', icon: BookOpen },
        { path: '/admin/question-bank', label: 'Question Bank', icon: HelpCircle },
        { path: '/admin/question-papers', label: 'Question Papers', icon: FileText },
        { path: '/admin/tests', label: 'Tests', icon: ClipboardList },
        { path: '/admin/reports', label: 'Reports', icon: BarChart3 },
        { path: '/admin/suggestions', label: 'Suggestions', icon: MessageCircle },
        { path: '/admin/settings', label: 'Settings', icon: Settings },
    ],
    TEACHER: [
        { path: '/teacher', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/teacher/groups', label: 'Student Groups', icon: Users },
        { path: '/teacher/question-bank', label: 'Question Bank', icon: HelpCircle },
        { path: '/teacher/question-papers', label: 'Question Papers', icon: FileText },
        { path: '/teacher/tests', label: 'Tests', icon: ClipboardList },
        { path: '/teacher/queries', label: 'Student Queries', icon: MessageSquare },
        { path: '/teacher/reports', label: 'Reports', icon: BarChart3 },
        { path: '/teacher/settings', label: 'Settings', icon: Settings },
    ],
    HEAD: [
        { path: '/head', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/head/groups', label: 'Groups', icon: FolderKanban },
        { path: '/head/question-bank', label: 'Question Bank', icon: HelpCircle },
        { path: '/head/question-papers', label: 'Question Papers', icon: FileText },
        { path: '/head/tests', label: 'Tests', icon: ClipboardList },
        { path: '/head/reports', label: 'Reports', icon: BarChart3 },
    ],
    STUDENT: [
        { path: '/student', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/student/book-to-bot', label: 'Book to Bot', icon: BookOpen },
        { path: '/student/tests', label: 'Tests', icon: ClipboardList },
        { path: '/student/grades', label: 'Grades', icon: BarChart3 },
        { path: '/student/report-card', label: 'Report Card', icon: FileText },
        { path: '/student/notes', label: 'My Notes', icon: BookMarked },
        { path: '/student/queries', label: 'Student Queries', icon: MessageSquare },
        { path: '/student/ai-chat', label: 'AI Chat', icon: MessageCircle },
        { path: '/student/suggestions', label: 'Suggestions', icon: Layers },
        { path: '/student/support', label: 'Support', icon: HelpCircle },
        { path: '/student/settings', label: 'Settings', icon: Settings },
    ],
};

interface SidebarProps {
    className?: string;
}

export function Sidebar({ className }: SidebarProps) {
    const { user, role, clearAuth } = useAuthStore();
    const pathname = usePathname();
    const router = useRouter();

    const navItems: NavItem[] = role ? (navByRole[role.toUpperCase() as UserRole] ?? []) : [];

    const handleLogout = () => {
        clearAuth();
        router.replace('/login');
    };

    return (
        <aside className={cn('flex h-screen w-64 flex-shrink-0 flex-col border-r border-gray-200 bg-white transition-colors dark:border-gray-800 dark:bg-gray-900', className)}>
            {/* Brand */}
            <div className="flex h-16 items-center gap-3 border-b border-gray-100 px-4 dark:border-gray-800">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-900 dark:bg-white">
                    <span className="text-lg font-bold text-white dark:text-gray-900">{siteConfig.name.charAt(0)}</span>
                </div>
                <div>
                    <h1 className="text-sm font-semibold text-gray-900 dark:text-white">{siteConfig.name}</h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{role?.toLowerCase() ?? 'Platform'}</p>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-3 py-4">
                <div className="space-y-0.5">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.path || (item.path !== '/admin' && item.path !== '/teacher' && item.path !== '/student' && item.path !== '/head' && pathname.startsWith(item.path));
                        return (
                            <button
                                key={item.path}
                                onClick={() => router.push(item.path)}
                                className={cn(
                                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                                    isActive
                                        ? 'bg-gray-100 font-medium text-gray-900 dark:bg-gray-800 dark:text-white'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                                )}
                            >
                                <Icon className="h-5 w-5" />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>

            {/* User + Logout */}
            <div className="border-t border-gray-100 p-3 dark:border-gray-800">
                <div className="flex items-center gap-3 rounded-lg px-3 py-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                        {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{user?.name ?? 'User'}</p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        title="Sign out"
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </aside>
    );
}
