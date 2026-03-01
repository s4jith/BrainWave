'use client';

import { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, Award, Target } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { PageLoader } from '@/components/ui/Spinner';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { useAsync } from '@/hooks/useAsync';
import { useAuthStore } from '@/stores/authStore';
import { gradebookService } from '@/services/gradebook.service';
import { userService } from '@/services/user.service';
import { formatDate, formatPercentage } from '@/utils/formatters';

interface GradeEntry {
    id: string;
    test_name: string;
    subject?: string;
    score: number;
    total_marks: number;
    percentage: number;
    passed: boolean;
    date: string;
}

interface SubjectStat {
    subject: string;
    average: number;
    count: number;
}

// ── Report Card – full academic performance with per-subject analytics ─────────
export default function StudentReportCardPage() {
    const user = useAuthStore((s) => s.user);

    const { data: grades, loading, error, run } = useAsync(async (): Promise<GradeEntry[]> => {
        if (!user?.id) return [];
        const res = await gradebookService.getStudentGrades(user.id);
        console.log('[report-card] Loaded', res.grades?.length ?? 0, 'grade entries');
        return (res.grades ?? []).map(g => ({
            id: g.id,
            test_name: g.title,
            subject: g.subject,
            score: g.score,
            total_marks: g.max_score,
            percentage: g.percentage,
            passed: g.passed,
            date: g.completed_at
        }));
    });
    useEffect(() => { run(); }, [run, user?.id]);

    const gradeList = grades ?? [];
    const avg = gradeList.length > 0 ? Math.round(gradeList.reduce((sum, g) => sum + g.percentage, 0) / gradeList.length) : 0;
    const passRate = gradeList.length > 0 ? Math.round((gradeList.filter((g) => g.passed).length / gradeList.length) * 100) : 0;
    const best = gradeList.reduce<GradeEntry | null>((max, g) => (max === null || g.percentage > max.percentage ? g : max), null);

    // Group by subject for per-subject averages
    const subjectMap = gradeList.reduce<Record<string, number[]>>((acc, g) => {
        const sub = g.subject ?? 'General';
        if (!acc[sub]) acc[sub] = [];
        acc[sub].push(g.percentage);
        return acc;
    }, {});
    const subjectStats: SubjectStat[] = Object.entries(subjectMap).map(([sub, vals]) => ({
        subject: sub,
        average: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
        count: vals.length,
    }));

    if (loading) return <DashboardLayout><PageLoader text="Loading report card…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <PageHeader title="Report Card" description="Your complete academic performance summary." />

            {error && <AlertBanner variant="warning" message="Could not load grade data." className="mb-5" />}

            {/* Summary stats */}
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                    { label: 'Average Score', value: formatPercentage(avg), icon: BarChart2, color: 'indigo' },
                    { label: 'Pass Rate', value: formatPercentage(passRate), icon: TrendingUp, color: 'green' },
                    { label: 'Tests Taken', value: gradeList.length.toString(), icon: Target, color: 'blue' },
                    { label: 'Best Score', value: best ? formatPercentage(best.percentage) : '—', icon: Award, color: 'amber' },
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

            {/* Subject breakdown */}
            {subjectStats.length > 0 && (
                <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                    <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">Performance by Subject</h2>
                    <div className="space-y-4">
                        {subjectStats.map((s) => (
                            <div key={s.subject}>
                                <div className="mb-1.5 flex items-center justify-between text-sm">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">{s.subject}</span>
                                    <span className="text-gray-500 dark:text-gray-400">{s.average}% · {s.count} test{s.count !== 1 ? 's' : ''}</span>
                                </div>
                                <ProgressBar value={s.average} size="sm" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* All grades table */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-700">
                    <h2 className="font-semibold text-gray-900 dark:text-white">Assessment History</h2>
                </div>
                {gradeList.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-gray-400">No assessments recorded yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                    {['Assessment', 'Subject', 'Score', 'Result', 'Date'].map((h) => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {gradeList.map((g) => (
                                    <tr key={g.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{g.test_name}</td>
                                        <td className="px-4 py-3">{g.subject ? <Badge variant="info">{g.subject}</Badge> : '—'}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold">{g.score}/{g.total_marks}</span>
                                                <span className="text-xs text-gray-400">({g.percentage}%)</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge variant={g.passed ? 'success' : 'destructive'}>{g.passed ? 'Pass' : 'Fail'}</Badge>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500">{formatDate(g.date)}</td>
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
