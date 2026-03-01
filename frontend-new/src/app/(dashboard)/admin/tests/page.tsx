'use client';

import { useEffect, useCallback, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader, TableLoader } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { SearchBar } from '@/components/ui/SearchBar';
import { TabStrip } from '@/components/ui/TabStrip';
import { Pagination } from '@/components/ui/Pagination';
import { TestStatusBadge } from '@/components/ui/StatusBadges';
import { useAsync } from '@/hooks/useAsync';
import { usePagination } from '@/hooks/usePagination';
import { useSearch } from '@/hooks/useSearch';
import { testManagementService } from '@/services/testManagement.service';
import { formatDate } from '@/utils/formatters';
import type { TestManagementItem } from '@/types/api.types';

const STATUS_TABS = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Draft' },
    { key: 'active', label: 'Active' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'closed', label: 'Closed/Completed' },
];

export default function AdminTestsPage() {
    const [tab, setTab] = useState('all');
    const pagination = usePagination(20);
    const { query, debouncedQuery, setQuery } = useSearch();

    const load = useCallback(async (): Promise<TestManagementItem[]> => {
        const tests = await testManagementService.getAdminTests({
            status: tab === 'all' ? undefined : tab,
            limit: pagination.pageSize,
            skip: pagination.offset,
        });
        pagination.setTotal(tests.length);
        console.log('[admin-tests] Loaded', tests.length, 'tests');
        return tests;
    }, [tab, debouncedQuery, pagination.page]);

    const { data, loading, error, run } = useAsync(load);
    useEffect(() => { run(); }, [run]);
    useEffect(() => { pagination.reset(); }, [tab, debouncedQuery]);

    const tests = data ?? [];

    if (loading && !data && pagination.page === 1) return <DashboardLayout><PageLoader text="Loading tests…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <PageHeader title="Tests" description="All tests across the platform." />

            {error && <AlertBanner variant="warning" message="Could not load tests." className="mb-5" />}

            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <TabStrip tabs={STATUS_TABS} active={tab} onChange={setTab} />
                <SearchBar value={query} onValueChange={setQuery} placeholder="Search tests…" className="w-52" />
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                {loading ? <div className="p-5"><TableLoader rows={8} /></div>
                    : tests.length === 0 ? <EmptyState icon={<ClipboardList className="h-7 w-7" />} title="No tests found" description="No tests match your filters." />
                        : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                                        <tr>
                                            {['Title', 'Subject/Class', 'Status', 'Submissions', 'Created By', 'Date'].map((h) => (
                                                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {tests.map((t) => (
                                            <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{t.title}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {t.subject && <Badge variant="info">{t.subject}</Badge>}
                                                        {t.class_level && <Badge variant="secondary">Cl. {t.class_level}</Badge>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3"><TestStatusBadge status={t.status} /></td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{t.submission_count ?? 0}</td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{t.created_by ?? '—'}</td>
                                                <td className="px-4 py-3 text-xs text-gray-500">{t.created_at ? formatDate(t.created_at) : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.pageSize} onPageChange={pagination.setPage} />
            </div>
        </DashboardLayout>
    );
}
