'use client';

import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader, TableLoader } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { TestStatusBadge } from '@/components/ui/StatusBadges';
import { TabStrip } from '@/components/ui/TabStrip';
import { SearchBar } from '@/components/ui/SearchBar';
import { useAsync } from '@/hooks/useAsync';
import { useSearch } from '@/hooks/useSearch';
import { testManagementService } from '@/services/testManagement.service';
import { formatDate } from '@/utils/formatters';

const STATUS_TABS = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' },
];

interface Test { id: string; name: string; subject?: string; class_level?: number; status: string; date?: string }

// ── Head Tests – read-only view of all tests across the department ─────────────
export default function HeadTestsPage() {
    const [tab, setTab] = useState('all');
    const { query, debouncedQuery, setQuery } = useSearch();

    const { data, loading, error, run } = useAsync(async (): Promise<Test[]> => {
        const res = await testManagementService.getAdminTests({ status: tab === 'all' ? undefined : tab });
        console.log('[head-tests] Loaded', res?.length ?? 0, 'tests');
        return (res ?? []) as unknown as Test[];
    });
    useEffect(() => { run(); }, [run, tab]);

    const tests = (data ?? []).filter((t) => !debouncedQuery || t.name.toLowerCase().includes(debouncedQuery.toLowerCase()));

    if (loading && !data) return <DashboardLayout><PageLoader text="Loading tests…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <PageHeader title="Tests" description="View all tests across your department." />

            {error && <AlertBanner variant="warning" message="Could not load tests." className="mb-5" />}

            <div className="mb-5 flex items-center justify-between gap-4">
                <TabStrip tabs={STATUS_TABS} active={tab} onChange={setTab} />
                <SearchBar value={query} onValueChange={setQuery} placeholder="Search tests…" className="w-52" />
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                {loading ? <div className="p-5"><TableLoader rows={6} /></div>
                    : tests.length === 0 ? <EmptyState icon={<ClipboardList className="h-7 w-7" />} title="No tests found" description={debouncedQuery ? 'Try adjusting your search.' : `No ${tab === 'all' ? '' : tab} tests.`} />
                        : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                                        <tr>
                                            {['Name', 'Subject/Class', 'Status', 'Date'].map((h) => (
                                                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {tests.map((t) => (
                                            <tr key={t.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{t.name}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {t.subject && <Badge variant="info">{t.subject}</Badge>}
                                                        {t.class_level && <Badge variant="secondary">Cl. {t.class_level}</Badge>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3"><TestStatusBadge status={t.status as 'draft' | 'active' | 'completed' | 'cancelled'} /></td>
                                                <td className="px-4 py-3 text-xs text-gray-500">{t.date ? formatDate(t.date) : '—'}</td>
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
