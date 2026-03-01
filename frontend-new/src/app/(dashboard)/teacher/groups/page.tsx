'use client';

import { useEffect } from 'react';
import { Users, GraduationCap } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader, TableLoader } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { SearchBar } from '@/components/ui/SearchBar';
import { useAsync } from '@/hooks/useAsync';
import { useSearch } from '@/hooks/useSearch';
import { teacherService } from '@/services/teacher.service';

interface TeacherGroup { id: string; name: string; subject?: string; class_level?: number; description?: string; student_count?: number }

async function loadGroups(): Promise<TeacherGroup[]> {
    const res = await teacherService.getGroups();
    return (res.groups ?? []) as TeacherGroup[];
}

export default function TeacherGroupsPage() {
    const { data, loading, error, run } = useAsync(loadGroups);
    const { query, debouncedQuery, setQuery } = useSearch();
    useEffect(() => { run(); }, [run]);

    const groups = data ?? [];
    const filtered = groups.filter((g) => !debouncedQuery || g.name.toLowerCase().includes(debouncedQuery.toLowerCase()));

    if (loading && !groups.length) return <DashboardLayout><PageLoader text="Loading groups…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Groups</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{groups.length} group{groups.length !== 1 ? 's' : ''} assigned to you.</p>
                </div>
                <SearchBar value={query} onValueChange={setQuery} placeholder="Search groups…" className="w-full sm:w-60" />
            </div>

            {error && <AlertBanner variant="warning" message="Some group data failed to load." className="mb-5" />}

            {loading ? <TableLoader rows={4} />
                : filtered.length === 0 ? (
                    <EmptyState icon={<Users className="h-7 w-7" />} title={debouncedQuery ? 'No matching groups' : 'No groups assigned'} description={debouncedQuery ? 'Adjust your search.' : 'You haven\'t been assigned to any groups yet.'} />
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {filtered.map((g) => (
                            <div key={g.id} className="rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-indigo-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800">
                                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                                    <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">{g.name}</h3>
                                <div className="mb-2 flex flex-wrap gap-1.5">
                                    {g.subject && <Badge variant="info">{g.subject}</Badge>}
                                    {g.class_level && <Badge variant="secondary">Class {g.class_level}</Badge>}
                                    {g.student_count != null && <Badge variant="success">{g.student_count} students</Badge>}
                                </div>
                                {g.description && <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{g.description}</p>}
                            </div>
                        ))}
                    </div>
                )}
        </DashboardLayout>
    );
}
