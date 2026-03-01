'use client';

import { useEffect } from 'react';
import { BarChart2, TrendingUp, Users, Target } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { PageLoader } from '@/components/ui/Spinner';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { useAsync } from '@/hooks/useAsync';
import { headService } from '@/services/head.service';
import { formatPercentage } from '@/utils/formatters';

interface HeadReport {
    total_teachers: number;
    total_students: number;
    total_tests: number;
    overall_avg_score: number;
    overall_pass_rate: number;
    by_subject?: Array<{ subject: string; avg_score: number; total_students: number }>;
    by_class?: Array<{ class_level: number; avg_score: number; pass_rate: number }>;
}

// ── Head Reports – department-level analytics and performance overview ─────────
export default function HeadReportsPage() {
    const { data, loading, error, run } = useAsync(async (): Promise<HeadReport> => {
        const res = await headService.getReports();
        console.log('[head-reports] Reports loaded');
        return (res as unknown) as HeadReport;
    });
    useEffect(() => { run(); }, [run]);

    if (loading) return <DashboardLayout><PageLoader text="Loading reports…" /></DashboardLayout>;

    const report = data;

    return (
        <DashboardLayout>
            <PageHeader title="Reports" description="Department-wide performance analytics." />

            {error && <AlertBanner variant="warning" message="Could not load reports." className="mb-5" />}

            {report && (
                <>
                    {/* Summary cards */}
                    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {[
                            { label: 'Teachers', value: report.total_teachers, icon: Users, color: 'indigo' },
                            { label: 'Students', value: report.total_students, icon: Users, color: 'blue' },
                            { label: 'Tests', value: report.total_tests, icon: Target, color: 'purple' },
                            { label: 'Pass Rate', value: formatPercentage(report.overall_pass_rate), icon: TrendingUp, color: 'green' },
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

                    {/* By subject */}
                    {report.by_subject && report.by_subject.length > 0 && (
                        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                            <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">Performance by Subject</h2>
                            <div className="space-y-4">
                                {report.by_subject.map((s) => (
                                    <div key={s.subject}>
                                        <div className="mb-1.5 flex items-center justify-between text-sm">
                                            <span className="font-medium text-gray-700 dark:text-gray-300">{s.subject}</span>
                                            <span className="text-gray-500 dark:text-gray-400">{s.avg_score}% · {s.total_students} students</span>
                                        </div>
                                        <ProgressBar value={s.avg_score} size="sm" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* By class */}
                    {report.by_class && report.by_class.length > 0 && (
                        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                            <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-700">
                                <h2 className="font-semibold text-gray-900 dark:text-white">Performance by Class</h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                                        <tr>
                                            {['Class', 'Avg Score', 'Pass Rate'].map((h) => (
                                                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {report.by_class.map((c) => (
                                            <tr key={c.class_level} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">Class {c.class_level}</td>
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
                </>
            )}
        </DashboardLayout>
    );
}
