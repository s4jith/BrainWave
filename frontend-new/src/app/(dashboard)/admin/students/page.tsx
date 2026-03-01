'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users, UserPlus } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader, TableLoader } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SearchBar } from '@/components/ui/SearchBar';
import { Pagination } from '@/components/ui/Pagination';
import { useAsync } from '@/hooks/useAsync';
import { usePagination } from '@/hooks/usePagination';
import { useSearch } from '@/hooks/useSearch';
import apiClient from '@/lib/axios';
import { formatDate } from '@/utils/formatters';

interface Student {
    id: string; name: string; email: string;
    class_level?: number; is_onboarded: boolean; created_at: string;
}

// ── Admin Students – view, search, and manage all student accounts ─────────────
export default function AdminStudentsPage() {
    const pagination = usePagination(20);
    const { query, debouncedQuery, setQuery } = useSearch();

    const loadStudents = useCallback(async (): Promise<Student[]> => {
        const { data } = await apiClient.get<{ students: Student[]; total: number }>('/api/admin/students', {
            params: { search: debouncedQuery || undefined, limit: pagination.pageSize, skip: pagination.offset },
        });
        pagination.setTotal(data.total ?? 0);
        console.log('[admin-students] Loaded', data.students?.length ?? 0, 'students');
        return data.students ?? [];
    }, [debouncedQuery, pagination.page]);

    const { data, loading, error, run } = useAsync(loadStudents);
    useEffect(() => { run(); }, [run]);
    useEffect(() => { pagination.reset(); }, [debouncedQuery]);

    const students = data ?? [];

    if (loading && !data && pagination.page === 1) return <DashboardLayout><PageLoader text="Loading students…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <PageHeader title="Students" description={`${pagination.total} students registered.`} />

            {error && <AlertBanner variant="warning" message="Could not load students." className="mb-5" />}

            <div className="mb-5 flex items-center justify-between gap-3">
                <SearchBar value={query} onValueChange={setQuery} placeholder="Search by name or email…" className="w-72" />
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                {loading ? <div className="p-5"><TableLoader rows={8} /></div>
                    : students.length === 0 ? <EmptyState icon={<Users className="h-7 w-7" />} title="No students found" description={debouncedQuery ? 'Try a different search.' : 'No students registered yet.'} />
                        : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                                        <tr>
                                            {['Name', 'Email', 'Class', 'Onboarded', 'Joined'].map((h) => (
                                                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {students.map((s) => (
                                            <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{s.name}</td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.email}</td>
                                                <td className="px-4 py-3">{s.class_level ? <Badge variant="secondary">Class {s.class_level}</Badge> : '—'}</td>
                                                <td className="px-4 py-3"><Badge variant={s.is_onboarded ? 'success' : 'warning'}>{s.is_onboarded ? 'Yes' : 'No'}</Badge></td>
                                                <td className="px-4 py-3 text-xs text-gray-500">{formatDate(s.created_at)}</td>
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
