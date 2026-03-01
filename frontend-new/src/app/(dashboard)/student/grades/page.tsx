'use client';

import { useEffect } from 'react';
import { Award, TrendingUp, CheckCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { StatCard } from '@/components/ui/Card';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader, TableLoader } from '@/components/ui/Spinner';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { useAsync } from '@/hooks/useAsync';
import { gradebookService } from '@/services/gradebook.service';
import { formatDate } from '@/utils/formatters';

interface Grade {
    submission_id: string;
    assessment_title: string;
    assessment_type: string;
    percentage: number;
    passed: boolean;
    submitted_at?: string;
    score?: number;
    max_marks?: number;
    subject?: string;
}

interface Stats {
    completed_assessments: number;
    average_score: number;
    upcoming_deadlines: number;
}

async function loadGrades() {
    const [gradesRes, statsRes] = await Promise.allSettled([
        gradebookService.getMyGrades(),
        gradebookService.getStudentStats(),
    ]);
    return {
        grades: (gradesRes.status === 'fulfilled'
            ? ((gradesRes.value as unknown as { grades?: Grade[] }).grades ?? (gradesRes.value as unknown as Grade[]))
            : []) as Grade[],
        stats: (statsRes.status === 'fulfilled' ? statsRes.value : null) as unknown as Stats | null,
    };
}

export default function StudentGradesPage() {
    const { data, loading, error, run } = useAsync(loadGrades);
    useEffect(() => { run(); }, [run]);

    if (loading && !data) return <DashboardLayout><PageLoader text="Loading grades…" /></DashboardLayout>;

    const grades = data?.grades ?? [];
    const stats = data?.stats ?? null;
    const passedCount = grades.filter((g) => g.passed).length;
    const failedCount = grades.length - passedCount;

    return (
        <DashboardLayout>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Grades</h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Your complete assessment history.</p>
            </div>

            {error && <AlertBanner variant="warning" message="Could not load all grade data." className="mb-5" />}

            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard icon={CheckCircle} label="Completed" value={stats?.completed_assessments ?? grades.length} description="Total assessments" />
                <StatCard icon={TrendingUp} label="Average Score" value={`${stats?.average_score ?? 0}%`} description="Across all tests" />
                <StatCard icon={Award} label="Pass Rate" value={grades.length ? `${Math.round((passedCount / grades.length) * 100)}%` : '—'} description={`${passedCount} passed · ${failedCount} failed`} />
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-700">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">All Grades ({grades.length})</h2>
                </div>
                {loading ? <div className="p-5"><TableLoader rows={8} /></div>
                    : grades.length === 0 ? <EmptyState icon={<Award className="h-7 w-7" />} title="No grades yet" description="Complete an assessment to see grades here." />
                        : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                {grades.map((g) => (
                                    <div key={g.submission_id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-6">
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-1 flex flex-wrap gap-2">
                                                <Badge variant={g.passed ? 'success' : 'destructive'}>{g.passed ? 'Passed' : 'Failed'}</Badge>
                                                <Badge variant="secondary" className="capitalize">{g.assessment_type}</Badge>
                                                {g.subject && <Badge variant="info">{g.subject}</Badge>}
                                            </div>
                                            <p className="font-medium text-gray-900 dark:text-white">{g.assessment_title}</p>
                                            {g.submitted_at && <p className="mt-0.5 text-xs text-gray-400">{formatDate(g.submitted_at)}</p>}
                                            <div className="mt-2 max-w-xs"><ProgressBar value={g.percentage} size="sm" color="auto" showLabel /></div>
                                        </div>
                                        <div className="flex flex-shrink-0 items-center gap-1.5 text-right">
                                            {g.score != null && g.max_marks != null && (
                                                <span className="text-sm text-gray-500 dark:text-gray-400">{g.score}/{g.max_marks}</span>
                                            )}
                                            <span className={`text-2xl font-bold ${g.passed ? 'text-emerald-500' : 'text-red-500'}`}>{g.percentage}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
            </div>
        </DashboardLayout>
    );
}
