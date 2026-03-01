'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Clock, BookOpen, Play, Award } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { TabStrip } from '@/components/ui/TabStrip';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader, TableLoader } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Button } from '@/components/ui/Button';
import { useAsync } from '@/hooks/useAsync';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { formatDate } from '@/utils/formatters';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Test {
    id: string;
    title: string;
    subject?: string;
    class_level?: number;
    duration_minutes?: number;
    start_time?: string;
    end_time?: string;
    status: 'upcoming' | 'active' | 'completed';
    score?: number;
    max_marks?: number;
    assessment_type?: 'ai' | 'staff' | 'test_center';
}

// ── Single batched fetch for both tabs in one call ────────────────────────────
async function fetchTestData() {
    const [staffRes, aiRes] = await Promise.allSettled([
        apiClient.get<{ tests: Test[] }>('/api/student/tests'),
        apiClient.get<{ tests: Test[] }>('/api/student/ai-tests'),
    ]);
    return {
        staff: (staffRes.status === 'fulfilled' ? staffRes.value.data.tests : []) ?? [],
        ai: (aiRes.status === 'fulfilled' ? aiRes.value.data.tests : []) ?? [],
    };
}

const TABS = [
    { key: 'staff', label: 'Staff Tests', icon: <BookOpen className="h-4 w-4" /> },
    { key: 'ai', label: 'AI Tests', icon: <Play className="h-4 w-4" /> },
];

export default function StudentTestsPage() {
    const router = useRouter();
    const [tab, setTab] = useState('staff');
    const { data, loading, error, run } = useAsync(fetchTestData);

    useEffect(() => { run(); }, [run]);

    const tests = tab === 'staff' ? data?.staff ?? [] : data?.ai ?? [];

    if (loading && !data) return <DashboardLayout><PageLoader text="Loading tests…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Test Center</h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">View and take your scheduled tests.</p>
            </div>

            {error && <AlertBanner variant="warning" message="Some tests could not be loaded." className="mb-4" />}

            <TabStrip tabs={TABS} active={tab} onChange={setTab} className="mb-6" />

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                {loading ? (
                    <div className="p-5"><TableLoader rows={6} /></div>
                ) : tests.length === 0 ? (
                    <EmptyState icon={<BookOpen className="h-7 w-7" />} title="No tests available" description={`No ${tab} tests have been assigned to you yet.`} />
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {tests.map((test) => (
                            <TestRow key={test.id} test={test} onStart={() => router.push(`/student/tests/${test.id}`)} router={router} />
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

function TestRow({ test, onStart, router }: { test: Test; onStart: () => void; router: ReturnType<typeof useRouter> }) {
    const statusVariantMap: Record<string, 'warning' | 'success' | 'secondary'> = {
        upcoming: 'warning', active: 'success', completed: 'secondary',
    };
    const scorePercent = test.score != null && test.max_marks ? Math.round((test.score / test.max_marks) * 100) : null;

    return (
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant={statusVariantMap[test.status] ?? 'secondary'}>{test.status}</Badge>
                    {test.subject && <Badge variant="info">{test.subject}</Badge>}
                    {test.class_level && <Badge variant="secondary">Class {test.class_level}</Badge>}
                </div>
                <p className="font-semibold text-gray-900 dark:text-white">{test.title}</p>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                    {test.duration_minutes && (
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{test.duration_minutes} min</span>
                    )}
                    {test.start_time && <span>Starts: {formatDate(test.start_time)}</span>}
                    {test.end_time && <span>Ends: {formatDate(test.end_time)}</span>}
                </div>
                {scorePercent !== null && (
                    <div className="mt-2 max-w-xs">
                        <div className="mb-1 flex justify-between text-xs">
                            <span className="text-gray-500">Score</span>
                            <span className="font-medium text-gray-700 dark:text-gray-300">{test.score}/{test.max_marks}</span>
                        </div>
                        <ProgressBar value={scorePercent} size="sm" />
                    </div>
                )}
            </div>
            <div className="flex-shrink-0">
                {test.status === 'completed' ? (
                    <Button variant="outline" size="sm" onClick={() => router.push('/student/grades')}>View Grades</Button>
                ) : test.status === 'active' ? (
                    <Button size="sm" onClick={onStart}>Take Test</Button>
                ) : (
                    <Button variant="ghost" size="sm" disabled>Upcoming</Button>
                )}
            </div>
        </div>
    );
}
