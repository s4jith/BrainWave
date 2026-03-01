'use client';

import { useEffect } from 'react';
import { BarChart2, Users, FileText, TrendingUp, Target } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { PageLoader } from '@/components/ui/Spinner';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useAsync } from '@/hooks/useAsync';
import apiClient from '@/lib/axios';
import { formatPercentage } from '@/utils/formatters';

interface AdminStats {
    total_users: number; total_students: number; total_teachers: number;
    total_tests: number; total_questions: number;
    avg_score: number; overall_pass_rate: number;
    by_class?: Array<{ class_level: number; avg_score: number; pass_rate: number; student_count: number }>;
    by_subject?: Array<{ subject: string; avg_score: number; student_count: number }>;
}

// ── Admin Reports – platform-wide analytics overview ──────────────────────────
export default function AdminReportsPage() {
    const { data, loading, error, run } = useAsync(async (): Promise<AdminStats> => {
        const { data } = await apiClient.get<AdminStats>('/api/admin/stats');
        console.log('[admin-reports] Platform stats loaded');
        return data;
    });
    useEffect(() => { run(); }, [run]);

    if (loading) return <DashboardLayout><PageLoader text="Loading reports…" /></DashboardLayout>;

    const stats = data;

    return (
        <DashboardLayout>
            <PageHeader title="Platform Analytics" description="System-wide performance and usage statistics." />

            {error && <AlertBanner variant="warning" message="Could not load analytics." className="mb-5" />}

            {stats && (
                <>
                    {/* Top stats */}
                    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                        {[
                            { label: 'Total Users', value: stats.total_users, icon: Users, color: 'indigo' },
                            { label: 'Students', value: stats.total_students, icon: Users, color: 'blue' },
                            { label: 'Teachers', value: stats.total_teachers, icon: Users, color: 'purple' },
                            { label: 'Tests', value: stats.total_tests, icon: FileText, color: 'amber' },
                            { label: 'Questions', value: stats.total_questions, icon: Target, color: 'green' },
                        ].map(({ label, value, icon: Icon, color }) => (
                            <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                                <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-${color}-100 dark:bg-${color}-900/30`}>
                                    <Icon className={`h-4 w-4 text-${color}-600 dark:text-${color}-400`} />
                                </div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                            </div>
                        ))}
                    </div>

                    {/* By class */}
                    {stats.by_class && stats.by_class.length > 0 && (
                        <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                            <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-700">
                                <h2 className="font-semibold text-gray-900 dark:text-white">Performance by Class</h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                                        <tr>
                                            {['Class', 'Students', 'Avg Score', 'Pass Rate'].map((h) => (
                                                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {stats.by_class.map((c) => (
                                            <tr key={c.class_level} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">Class {c.class_level}</td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{c.student_count}</td>
                                                <td className="px-4 py-3 w-36"><ProgressBar value={c.avg_score} size="sm" showLabel /></td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-xs font-medium ${c.pass_rate >= 60 ? 'text-green-600' : 'text-red-500'}`}>{formatPercentage(c.pass_rate)}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* By subject */}
                    {stats.by_subject && stats.by_subject.length > 0 && (
                        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                            <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">Performance by Subject</h2>
                            <div className="space-y-4">
                                {stats.by_subject.map((s) => (
                                    <div key={s.subject}>
                                        <div className="mb-1.5 flex items-center justify-between text-sm">
                                            <span className="font-medium text-gray-700 dark:text-gray-300">{s.subject}</span>
                                            <span className="text-gray-500 dark:text-gray-400">{s.avg_score}% · {s.student_count} students</span>
                                        </div>
                                        <ProgressBar value={s.avg_score} size="sm" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </DashboardLayout>
    );
}
