'use client';

import { useEffect } from 'react';
import { FileText, BarChart2, Users, TrendingUp } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader, TableLoader } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useAsync } from '@/hooks/useAsync';
import { teacherService } from '@/services/teacher.service';
import { formatDate, formatPercentage } from '@/utils/formatters';

interface TestReport {
    id: string;
    name: string;
    subject?: string;
    class_level?: number;
    total_students: number;
    avg_score: number;
    pass_rate: number;
    date?: string;
}

// ── Teacher Reports – per-test performance analytics ─────────────────────────
export default function TeacherReportsPage() {
    const { data, loading, error, run } = useAsync(async (): Promise<TestReport[]> => {
        const res = await teacherService.getReports();
        console.log('[reports] Loaded', (res.reports as unknown[])?.length ?? 0, 'test reports');
        return (res.reports ?? []) as TestReport[];
    });
    useEffect(() => { run(); }, [run]);

    const reports = data ?? [];
    const totalStudents = reports.reduce((sum, r) => sum + r.total_students, 0);
    const avgScore = reports.length > 0 ? Math.round(reports.reduce((sum, r) => sum + r.avg_score, 0) / reports.length) : 0;
    const avgPassRate = reports.length > 0 ? Math.round(reports.reduce((sum, r) => sum + r.pass_rate, 0) / reports.length) : 0;

    if (loading && !data) return <DashboardLayout><PageLoader text="Loading reports…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <PageHeader title="Reports" description="Performance analytics for all your tests." />

            {error && <AlertBanner variant="warning" message="Could not load reports." className="mb-5" />}

            {/* Summary cards */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                    { label: 'Tests Conducted', value: reports.length, icon: FileText, color: 'indigo' },
                    { label: 'Total Students Reached', value: totalStudents, icon: Users, color: 'blue' },
                    { label: 'Overall Pass Rate', value: formatPercentage(avgPassRate), icon: TrendingUp, color: 'green' },
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

            {/* Reports table */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                {loading ? <div className="p-5"><TableLoader rows={6} /></div>
                    : reports.length === 0 ? <EmptyState icon={<BarChart2 className="h-7 w-7" />} title="No reports yet" description="Reports appear once your tests have been taken." />
                        : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                                        <tr>
                                            {['Test', 'Subject/Class', 'Students', 'Avg Score', 'Pass Rate', 'Date'].map((h) => (
                                                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {reports.map((r) => (
                                            <tr key={r.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{r.name}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {r.subject && <Badge variant="info">{r.subject}</Badge>}
                                                        {r.class_level && <Badge variant="secondary">Cl. {r.class_level}</Badge>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.total_students}</td>
                                                <td className="px-4 py-3 w-32"><ProgressBar value={r.avg_score} size="sm" showLabel /></td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-xs font-medium ${r.pass_rate >= 60 ? 'text-green-600' : 'text-red-500'}`}>{formatPercentage(r.pass_rate)}</span>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-500">{r.date ? formatDate(r.date) : '—'}</td>
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
