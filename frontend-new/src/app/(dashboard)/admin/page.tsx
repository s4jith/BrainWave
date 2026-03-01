'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, BookOpen, Shield, TrendingUp, ClipboardList, MessageCircle, Settings, Award } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { StatCard } from '@/components/ui/Card';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader, TableLoader } from '@/components/ui/Spinner';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { RoleBadge } from '@/components/ui/StatusBadges';
import { Badge } from '@/components/ui/Badge';
import { useAsync } from '@/hooks/useAsync';
import apiClient from '@/lib/axios';
import { formatRelativeTime } from '@/utils/formatters';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AdminStats {
    total_users: number;
    total_students: number;
    total_teachers: number;
    total_tests: number;
    avg_score: number;
    active_groups: number;
    open_tickets: number;
    pending_questions: number;
}

interface RecentUser {
    id: string;
    name: string;
    email: string;
    role: string;
    created_at: string;
}

interface SystemStat {
    label: string;
    value: number;
    max: number;
    color?: 'indigo' | 'emerald' | 'amber' | 'red';
}

// ── Single batched fetch ──────────────────────────────────────────────────────
async function loadAdminDashboard() {
    const [statsRes, usersRes] = await Promise.allSettled([
        apiClient.get<{ stats: AdminStats }>('/api/admin/stats'),
        apiClient.get<{ users: RecentUser[] }>('/api/admin/users/recent'),
    ]);
    return {
        stats: (statsRes.status === 'fulfilled' ? statsRes.value.data.stats : null) as AdminStats | null,
        recentUsers: (usersRes.status === 'fulfilled' ? usersRes.value.data.users : []) as RecentUser[],
    };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
    const router = useRouter();
    const { data, loading, error, run } = useAsync(loadAdminDashboard);

    useEffect(() => { run(); }, [run]);
    useEffect(() => {
        const onFocus = () => run();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [run]);

    if (loading && !data) return <DashboardLayout><PageLoader text="Loading admin dashboard…" /></DashboardLayout>;

    const stats = data?.stats ?? null;
    const recentUsers = data?.recentUsers ?? [];

    const systemStats: SystemStat[] = [
        { label: 'Students', value: stats?.total_students ?? 0, max: stats?.total_users ?? 1, color: 'indigo' },
        { label: 'Teachers', value: stats?.total_teachers ?? 0, max: stats?.total_users ?? 1, color: 'emerald' },
        { label: 'Avg Score', value: stats?.avg_score ?? 0, max: 100, color: 'amber' },
        { label: 'Open Tickets', value: stats?.open_tickets ?? 0, max: Math.max(stats?.open_tickets ?? 0, 10), color: 'red' },
    ];

    const quickLinks = [
        { label: 'Users', icon: Users, path: '/admin/users', color: 'bg-indigo-500' },
        { label: 'Curriculum', icon: BookOpen, path: '/admin/curriculum', color: 'bg-emerald-500' },
        { label: 'Tests', icon: ClipboardList, path: '/admin/tests', color: 'bg-purple-500' },
        { label: 'Support', icon: MessageCircle, path: '/admin/support', color: 'bg-rose-500' },
        { label: 'Settings', icon: Settings, path: '/admin/settings', color: 'bg-gray-500' },
    ];

    return (
        <DashboardLayout>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Platform overview and management.</p>
            </div>

            {error && <AlertBanner variant="warning" message="Some data failed to load." className="mb-6" />}

            {/* Primary stats */}
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard icon={Users} label="Total Users" value={stats?.total_users ?? 0} description="All roles" />
                <StatCard icon={ClipboardList} label="Total Tests" value={stats?.total_tests ?? 0} description="Created on platform" />
                <StatCard icon={TrendingUp} label="Avg Score" value={`${stats?.avg_score ?? 0}%`} description="Platform average" />
                <StatCard icon={MessageCircle} label="Open Tickets" value={stats?.open_tickets ?? 0} description="Support requests" />
            </div>

            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* System overview */}
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                    <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">System Overview</h3>
                    <div className="space-y-4">
                        {systemStats.map((s) => (
                            <div key={s.label}>
                                <div className="mb-1 flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">{s.label}</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">{s.value}</span>
                                </div>
                                <ProgressBar value={s.max > 0 ? (s.value / s.max) * 100 : 0} size="md" color={s.color ?? 'indigo'} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick links */}
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                    <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Management</h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {quickLinks.map(({ label, icon: Icon, path, color }) => (
                            <button
                                key={label}
                                onClick={() => router.push(path)}
                                className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 p-4 transition hover:border-indigo-300 hover:shadow-sm dark:border-gray-700 dark:hover:border-indigo-700"
                            >
                                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
                                    <Icon className="h-5 w-5 text-white" />
                                </div>
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Additional stats */}
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 dark:border-gray-700">
                        {[
                            { label: 'Active Groups', value: stats?.active_groups ?? 0, icon: Users },
                            { label: 'Pending', value: stats?.pending_questions ?? 0, icon: Shield },
                        ].map(({ label, value, icon: Icon }) => (
                            <div key={label} className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/40">
                                <Icon className="h-4 w-4 text-gray-500" />
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                                    <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent users */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Recent Users</h3>
                    <button onClick={() => router.push('/admin/users')} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">View all →</button>
                </div>
                {loading ? <div className="p-5"><TableLoader rows={5} /></div>
                    : recentUsers.length === 0 ? <EmptyState icon={<Users className="h-7 w-7" />} title="No users yet" description="No new users registered recently." />
                        : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                {recentUsers.slice(0, 8).map((u) => (
                                    <div key={u.id} className="flex items-center justify-between px-5 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-xs font-bold text-white">
                                                {u.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">{u.name}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <RoleBadge role={u.role} />
                                            <span className="text-xs text-gray-400">{formatRelativeTime(u.created_at)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
            </div>
        </DashboardLayout>
    );
}
