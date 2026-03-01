'use client';

import { useEffect, useCallback } from 'react';
import { GraduationCap } from 'lucide-react';
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

interface Teacher {
    id: string; name: string; email: string;
    subjects?: string[]; is_active: boolean; created_at: string;
}

// ── Admin Teachers – view and manage all teacher accounts ─────────────────────
export default function AdminTeachersPage() {
    const pagination = usePagination(20);
    const { query, debouncedQuery, setQuery } = useSearch();

    const loadTeachers = useCallback(async (): Promise<Teacher[]> => {
        const { data } = await apiClient.get<{ teachers: Teacher[]; total: number }>('/api/admin/teachers', {
            params: { search: debouncedQuery || undefined, limit: pagination.pageSize, skip: pagination.offset },
        });
        pagination.setTotal(data.total ?? 0);
        console.log('[admin-teachers] Loaded', data.teachers?.length ?? 0, 'teachers');
        return data.teachers ?? [];
    }, [debouncedQuery, pagination.page]);

    const { data, loading, error, run } = useAsync(loadTeachers);
    useEffect(() => { run(); }, [run]);
    useEffect(() => { pagination.reset(); }, [debouncedQuery]);

    const teachers = data ?? [];

    if (loading && !data && pagination.page === 1) return <DashboardLayout><PageLoader text="Loading teachers…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <PageHeader title="Teachers" description={`${pagination.total} teachers registered.`} />

            {error && <AlertBanner variant="warning" message="Could not load teachers." className="mb-5" />}

            <div className="mb-5 flex items-center gap-3">
                <SearchBar value={query} onValueChange={setQuery} placeholder="Search by name or email…" className="w-72" />
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                {loading ? <div className="p-5"><TableLoader rows={8} /></div>
                    : teachers.length === 0 ? <EmptyState icon={<GraduationCap className="h-7 w-7" />} title="No teachers found" description={debouncedQuery ? 'Try a different search.' : 'No teachers registered yet.'} />
                        : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                                        <tr>
                                            {['Name', 'Email', 'Subjects', 'Status', 'Joined'].map((h) => (
                                                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {teachers.map((t) => (
                                            <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{t.name}</td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{t.email}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {(t.subjects ?? []).slice(0, 3).map((s) => <Badge key={s} variant="info">{s}</Badge>)}
                                                        {(t.subjects ?? []).length > 3 && <Badge variant="secondary">+{(t.subjects ?? []).length - 3}</Badge>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3"><Badge variant={t.is_active ? 'success' : 'destructive'}>{t.is_active ? 'Active' : 'Inactive'}</Badge></td>
                                                <td className="px-4 py-3 text-xs text-gray-500">{formatDate(t.created_at)}</td>
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
