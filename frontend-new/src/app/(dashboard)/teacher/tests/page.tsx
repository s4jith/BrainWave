'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ClipboardList, Users } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { TabStrip } from '@/components/ui/TabStrip';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader, TableLoader } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TestStatusBadge } from '@/components/ui/StatusBadges';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SearchBar } from '@/components/ui/SearchBar';
import { useAsync } from '@/hooks/useAsync';
import { useSearch } from '@/hooks/useSearch';
import apiClient from '@/lib/axios';
import { formatDate } from '@/utils/formatters';

interface TeacherTest {
    id: string;
    name: string;
    subject?: string;
    class_level?: number;
    status: 'draft' | 'active' | 'completed' | 'cancelled';
    avg_score?: number;
    taken_by?: number;
    date?: string;
}

async function loadTests(): Promise<TeacherTest[]> {
    const { data } = await apiClient.get<{ tests: TeacherTest[] }>('/api/teacher/tests');
    return data.tests ?? [];
}

const STATUS_TABS = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'draft', label: 'Draft' },
    { key: 'completed', label: 'Completed' },
];

export default function TeacherTestsPage() {
    const router = useRouter();
    const [tab, setTab] = useState('all');
    const { data, loading, error, run } = useAsync(loadTests);
    const { query, debouncedQuery, setQuery } = useSearch();

    useEffect(() => { run(); }, [run]);

    const tests = data ?? [];
    const filtered = tests.filter((t) => (tab === 'all' || t.status === tab) && (!debouncedQuery || t.name.toLowerCase().includes(debouncedQuery.toLowerCase())));

    const counts = {
        active: tests.filter((t) => t.status === 'active').length,
        draft: tests.filter((t) => t.status === 'draft').length,
        completed: tests.filter((t) => t.status === 'completed').length,
    };

    if (loading && !tests.length) return <DashboardLayout><PageLoader text="Loading tests…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Tests</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{tests.length} test{tests.length !== 1 ? 's' : ''} total.</p>
                </div>
                <div className="flex gap-2">
                    <SearchBar value={query} onValueChange={setQuery} placeholder="Search tests…" className="w-52" />
                    <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => router.push('/teacher/tests/create')}>Create Test</Button>
                </div>
            </div>

            {error && <AlertBanner variant="warning" message="Some test data failed to load." className="mb-4" />}

            <div className="mb-5 flex flex-wrap gap-2">
                <span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">{counts.active} Active</span>
                <span className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">{counts.draft} Draft</span>
                <span className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 dark:bg-blue-900/20 dark:text-blue-300">{counts.completed} Completed</span>
            </div>

            <TabStrip
                tabs={STATUS_TABS.map((t) => ({ ...t, badge: t.key !== 'all' ? counts[t.key as keyof typeof counts] : undefined }))}
                active={tab}
                onChange={setTab}
                className="mb-6"
            />

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                {loading ? <div className="p-5"><TableLoader rows={6} /></div>
                    : filtered.length === 0 ? <EmptyState icon={<ClipboardList className="h-7 w-7" />} title="No tests found" description={debouncedQuery ? 'Try adjusting your search.' : `No ${tab === 'all' ? '' : tab} tests yet.`} />
                        : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                                        <tr>
                                            {['Test Name', 'Subject / Class', 'Students', 'Avg Score', 'Status', 'Date', ''].map((h, i) => (
                                                <th key={i} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {filtered.map((t) => (
                                            <tr key={t.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{t.name}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {t.subject && <Badge variant="info">{t.subject}</Badge>}
                                                        {t.class_level && <Badge variant="secondary">Cl. {t.class_level}</Badge>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{t.taken_by ?? 0}</span>
                                                </td>
                                                <td className="px-4 py-3"><div className="w-28"><ProgressBar value={t.avg_score ?? 0} size="sm" showLabel /></div></td>
                                                <td className="px-4 py-3"><TestStatusBadge status={t.status} /></td>
                                                <td className="px-4 py-3 text-xs text-gray-500">{t.date ? formatDate(t.date) : '—'}</td>
                                                <td className="px-4 py-3"><Button variant="ghost" size="sm" onClick={() => router.push(`/teacher/tests/${t.id}`)}>View</Button></td>
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
