'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Users, TrendingUp, Award, HelpCircle, Clock, FileText } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { StatCard } from '@/components/ui/Card';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader, TableLoader } from '@/components/ui/Spinner';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TestStatusBadge } from '@/components/ui/StatusBadges';
import { useAsync } from '@/hooks/useAsync';
import { useAuthStore } from '@/stores/authStore';
import { teacherService } from '@/services/teacher.service';
import { formatDate } from '@/utils/formatters';
import type { TeacherStats } from '@/types/api.types';

interface TestReport { name: string; taken_by: number; avg_score?: number; status: string; date?: string }
interface ReportsShape { avg_score?: number; pass_rate?: number; total_students?: number; total_assessments?: number; test_reports?: TestReport[] }

async function loadDashboard() {
    const [statsRes, reportsRes] = await Promise.allSettled([
        teacherService.getStats(),
        teacherService.getReports(),
    ]);
    return {
        stats: (statsRes.status === 'fulfilled' ? statsRes.value : null) as TeacherStats | null,
        reports: (reportsRes.status === 'fulfilled' ? reportsRes.value : null) as unknown as ReportsShape | null,
    };
}

export default function TeacherDashboardPage() {
    const router = useRouter();
    const user = useAuthStore((s: { user: { name?: string } | null }) => s.user);
    const { data, loading, error, run } = useAsync(loadDashboard);

    useEffect(() => { run(); }, [run]);
    useEffect(() => {
        const onFocus = () => run();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [run]);

    if (loading && !data) return <DashboardLayout><PageLoader text="Loading dashboard…" /></DashboardLayout>;

    const stats = data?.stats ?? null;
    const reports = data?.reports ?? null;

    const avgScore = reports?.avg_score ?? 0;
    const passRate = reports?.pass_rate ?? 0;
    const totalStudents = reports?.total_students ?? 0;
    const totalTests = reports?.total_assessments ?? (stats?.my_tests ?? 0);
    const myQuestions = stats?.my_questions ?? 0;
    const pending = stats?.pending ?? 0;
    const testReports = reports?.test_reports ?? [];

    return (
        <DashboardLayout>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Teacher Dashboard</h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Welcome back, {user?.name?.split(' ')[0] ?? 'Teacher'} 👋</p>
            </div>

            {error && <AlertBanner variant="warning" message="Some dashboard data failed to load." className="mb-6" />}

            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard icon={ClipboardList} label="Total Tests" value={totalTests} description="Created by you" />
                <StatCard icon={Users} label="Total Students" value={totalStudents} description="Across all groups" />
                <StatCard icon={TrendingUp} label="Average Score" value={`${avgScore}%`} description="Across all tests" />
                <StatCard icon={Award} label="Pass Rate" value={`${passRate}%`} description="Students passing" />
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4">
                {[
                    { icon: HelpCircle, color: 'bg-violet-100 dark:bg-violet-900/30', iconColor: 'text-violet-600 dark:text-violet-400', value: myQuestions, label: 'Questions Created' },
                    { icon: Clock, color: 'bg-orange-100 dark:bg-orange-900/30', iconColor: 'text-orange-500', value: pending, label: 'Pending Evaluations' },
                ].map(({ icon: Icon, color, iconColor, value, label }) => (
                    <div key={label} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                        <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${color}`}>
                            <Icon className={`h-5 w-5 ${iconColor}`} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Recent Tests</h3>
                    <button onClick={() => router.push('/teacher/tests')} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">View all →</button>
                </div>
                {loading ? <div className="p-5"><TableLoader rows={5} /></div>
                    : testReports.length === 0 ? <EmptyState icon={<FileText className="h-7 w-7" />} title="No tests yet" description="Create your first test to see results here." />
                        : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                                        <tr>
                                            {['Test Name', 'Students', 'Avg Score', 'Status', 'Date'].map((h) => (
                                                <th key={h} className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {testReports.slice(0, 6).map((t: TestReport, i: number) => (
                                            <tr key={i} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{t.name}</td>
                                                <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{t.taken_by}</td>
                                                <td className="px-5 py-3"><div className="w-28"><ProgressBar value={t.avg_score ?? 0} size="sm" showLabel /></div></td>
                                                <td className="px-5 py-3"><TestStatusBadge status={(t.status as 'draft' | 'active' | 'completed' | 'cancelled')} /></td>
                                                <td className="px-5 py-3 text-xs text-gray-500">{t.date ? formatDate(t.date) : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
            </div>
        </DashboardLayout>
    );
}
