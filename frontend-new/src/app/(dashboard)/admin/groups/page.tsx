'use client';

import { useEffect, useCallback } from 'react';
import { Users } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader, TableLoader } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { SearchBar } from '@/components/ui/SearchBar';
import { Pagination } from '@/components/ui/Pagination';
import { useAsync } from '@/hooks/useAsync';
import { usePagination } from '@/hooks/usePagination';
import { useSearch } from '@/hooks/useSearch';
import apiClient from '@/lib/axios';
import { formatDate } from '@/utils/formatters';

interface Group { id: string; name: string; subject?: string; class_level?: number; teacher_name?: string; student_count?: number; created_at: string }

// ── Admin Groups – view all groups across the platform ───────────────────────
export default function AdminGroupsPage() {
    const pagination = usePagination(20);
    const { query, debouncedQuery, setQuery } = useSearch();

    const load = useCallback(async (): Promise<Group[]> => {
        const { data } = await apiClient.get<{ groups: Group[]; total: number }>('/api/admin/groups', {
            params: { search: debouncedQuery || undefined, limit: pagination.pageSize, skip: pagination.offset },
        });
        pagination.setTotal(data.total ?? 0);
        console.log('[admin-groups] Loaded', data.groups?.length ?? 0, 'groups');
        return data.groups ?? [];
    }, [debouncedQuery, pagination.page]);

    const { data, loading, error, run } = useAsync(load);
    useEffect(() => { run(); }, [run]);
    useEffect(() => { pagination.reset(); }, [debouncedQuery]);

    const groups = data ?? [];

    if (loading && !data && pagination.page === 1) return <DashboardLayout><PageLoader text="Loading groups…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <PageHeader title="Groups" description="All student groups across the platform." />

            {error && <AlertBanner variant="warning" message="Could not load groups." className="mb-5" />}

            <div className="mb-5 flex items-center justify-end">
                <SearchBar value={query} onValueChange={setQuery} placeholder="Search groups…" className="w-52" />
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                {loading ? <div className="p-5"><TableLoader rows={8} /></div>
                    : groups.length === 0 ? <EmptyState icon={<Users className="h-7 w-7" />} title="No groups found" description={debouncedQuery ? 'Try a different search.' : 'No groups created yet.'} />
                        : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                                        <tr>
                                            {['Group', 'Subject', 'Class', 'Teacher', 'Students', 'Created'].map((h) => (
                                                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {groups.map((g) => (
                                            <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{g.name}</td>
                                                <td className="px-4 py-3">{g.subject ? <Badge variant="info">{g.subject}</Badge> : '—'}</td>
                                                <td className="px-4 py-3">{g.class_level ? <Badge variant="secondary">Cl. {g.class_level}</Badge> : '—'}</td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{g.teacher_name ?? '—'}</td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{g.student_count ?? 0}</td>
                                                <td className="px-4 py-3 text-xs text-gray-500">{formatDate(g.created_at)}</td>
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
