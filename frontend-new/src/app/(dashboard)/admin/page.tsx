'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, BookOpen, Shield, TrendingUp, ClipboardList, MessageCircle, Settings } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { StatCard } from '@/components/ui/Card';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { PageLoader } from '@/components/ui/Spinner';
import { useAsync } from '@/hooks/useAsync';
import { adminService } from '@/services/admin.service';
import { ActivityTrendChart } from '@/components/features/admin/ActivityTrendChart';
import { SubjectPerformanceCards } from '@/components/features/admin/SubjectPerformanceCards';
import { TopPerformersList } from '@/components/features/admin/TopPerformersList';
import type { AdminAnalyticsData } from '@/types';

// ── Single batched fetch ──────────────────────────────────────────────────────
async function loadAdminDashboard() {
    // Note: If getRecentUsers is needed separately, add it back to Promise.allSettled
    const statsRes = await adminService.getAnalytics().catch(() => null);
    
    // Provide an empty fallback so the page doesn't crash on network error
    const fallbackStats: AdminAnalyticsData = {
        user_stats: { total_users: 0, total_students: 0, total_teachers: 0, active_today: 0, active_this_week: 0, active_this_month: 0, inactive_users: 0, new_users_today: 0, new_users_this_week: 0, new_users_this_month: 0 },
        test_stats: { total_tests_created: 0, total_tests_taken: 0, tests_completed: 0, tests_in_progress: 0, average_score: 0, pass_rate: 0, tests_today: 0, tests_this_week: 0 },
        activity_trend: [],
        subject_stats: [],
        top_performers: [],
        weak_students: []
    };

    return {
        stats: statsRes ?? fallbackStats,
        hasError: !statsRes
    };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
    const router = useRouter();
    const { data, loading, error, run } = useAsync(loadAdminDashboard);

    useEffect(() => { run(); }, [run]);

    if (loading && !data) return <DashboardLayout><PageLoader text="Loading admin overview…" /></DashboardLayout>;

    const stats = data?.stats;
    const hasDataError = error || data?.hasError;

    const quickLinks = [
        { label: 'Students', icon: Users, path: '/admin/students', color: 'bg-indigo-500' },
        { label: 'Tests', icon: ClipboardList, path: '/admin/tests', color: 'bg-purple-500' },
        { label: 'Books', icon: BookOpen, path: '/admin/books', color: 'bg-emerald-500' },
        { label: 'Support', icon: MessageCircle, path: '/admin/support', color: 'bg-rose-500' },
        { label: 'Settings', icon: Settings, path: '/admin/settings', color: 'bg-gray-500' },
    ];

    return (
        <DashboardLayout>
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">NCERT Learning Platform - Live Data</p>
                </div>
                <button
                    onClick={() => run()}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                >
                    Refresh Data
                </button>
            </div>

            {hasDataError && <AlertBanner variant="warning" message="Could not connect to backend to fetch live analytics." className="mb-6" />}

            {/* Quick Stats Grid */}
            <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
                <StatCard icon={Users} label="Total Users" value={stats?.user_stats?.total_users ?? 0} />
                <StatCard icon={Users} label="Students" value={stats?.user_stats?.total_students ?? 0} />
                <StatCard icon={Users} label="Teachers" value={stats?.user_stats?.total_teachers ?? 0} />
                <StatCard icon={TrendingUp} label="Active Today" value={stats?.user_stats?.active_today ?? 0} />
                <StatCard icon={ClipboardList} label="Tests Today" value={stats?.test_stats?.tests_today ?? 0} />
                <StatCard icon={TrendingUp} label="Avg Score" value={`${stats?.test_stats?.average_score ?? 0}%`} />
            </div>

            <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Embedded Chart Component */}
                <ActivityTrendChart trend={stats?.activity_trend ?? []} />

                {/* Test Performance summary block (similar to old app) */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Test Performance</h2>
                    <div className="space-y-4">
                        <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-green-50 p-4 text-center dark:from-emerald-900/20 dark:to-green-900/20">
                            <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">{stats?.test_stats?.pass_rate ?? 0}%</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Pass Rate</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="rounded-lg bg-indigo-50 p-3 text-center dark:bg-indigo-900/20">
                                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats?.test_stats?.tests_completed ?? 0}</p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">Completed</p>
                            </div>
                            <div className="rounded-lg bg-amber-50 p-3 text-center dark:bg-amber-900/20">
                                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats?.test_stats?.tests_in_progress ?? 0}</p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">In Progress</p>
                            </div>
                        </div>
                        <div className="rounded-lg bg-purple-50 p-3 text-center dark:bg-purple-900/20">
                            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats?.test_stats?.total_tests_created ?? 0}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Total Tests Created</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Performance Modules */}
            <SubjectPerformanceCards stats={stats?.subject_stats ?? []} />
            <TopPerformersList topPerformers={stats?.top_performers ?? []} weakStudents={stats?.weak_students ?? []} />

            {/* Quick Actions / Management Links */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                    {quickLinks.map(({ label, icon: Icon, path, color }) => (
                        <button
                            key={label}
                            onClick={() => router.push(path)}
                            className="flex flex-col items-center gap-2 rounded-xl border border-gray-100 p-4 transition-all hover:border-indigo-300 hover:shadow-md dark:border-gray-700 dark:hover:border-indigo-700"
                        >
                            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
                                <Icon className="h-6 w-6 text-white" />
                            </div>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </DashboardLayout>
    );
}
