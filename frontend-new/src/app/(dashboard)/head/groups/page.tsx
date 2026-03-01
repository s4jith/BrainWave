'use client';

import { useEffect } from 'react';
import { Users } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader, TableLoader } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { SearchBar } from '@/components/ui/SearchBar';
import { useAsync } from '@/hooks/useAsync';
import { useSearch } from '@/hooks/useSearch';
import { headService } from '@/services/head.service';
import type { StudentGroup } from '@/types/api.types';

// ── Head Groups – view all groups under this head's department ────────────────
export default function HeadGroupsPage() {
    const { data, loading, error, run } = useAsync<StudentGroup[]>(async () => {
        const res = await headService.getGroups();
        console.log('[head-groups] Loaded', res.groups?.length ?? 0, 'groups');
        return res.groups ?? [];
    });
    useEffect(() => { run(); }, [run]);

    const { query, debouncedQuery, setQuery } = useSearch();
    const groups = (data ?? []).filter((g) => !debouncedQuery || g.name.toLowerCase().includes(debouncedQuery.toLowerCase()));

    if (loading && !data) return <DashboardLayout><PageLoader text="Loading groups…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <PageHeader title="Groups" description="All groups under your department." />

            {error && <AlertBanner variant="warning" message="Could not load groups." className="mb-5" />}

            <div className="mb-5 flex justify-end">
                <SearchBar value={query} onValueChange={setQuery} placeholder="Search groups…" className="w-52" />
            </div>

            {loading ? <TableLoader rows={5} />
                : groups.length === 0 ? <EmptyState icon={<Users className="h-7 w-7" />} title="No groups" description={debouncedQuery ? 'No groups match your search.' : 'No groups assigned to your department.'} />
                    : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {groups.map((g) => (
                                <div key={g.id} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                                        <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">{g.name}</h3>
                                    <div className="mb-2 flex flex-wrap gap-1.5">
                                        {g.subject && <Badge variant="info">{g.subject}</Badge>}
                                        {g.class_level && <Badge variant="secondary">Class {g.class_level}</Badge>}
                                        {g.student_count != null && <Badge variant="success">{g.student_count} students</Badge>}
                                    </div>
                                    {g.teacher_name && <p className="text-xs text-gray-400">Teacher: {g.teacher_name}</p>}
                                </div>
                            ))}
                        </div>
                    )}
        </DashboardLayout>
    );
}
