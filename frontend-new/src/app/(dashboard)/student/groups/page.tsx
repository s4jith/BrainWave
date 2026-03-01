'use client';

import { useEffect } from 'react';
import { Users, GraduationCap, BookOpen } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader, TableLoader } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { SearchBar } from '@/components/ui/SearchBar';
import { useAsync } from '@/hooks/useAsync';
import { useSearch } from '@/hooks/useSearch';
import { studentService } from '@/services/student.service';

interface Group { id: string; name: string; subject?: string; class_level?: number; description?: string; teacher?: { name: string }; student_count?: number }

async function loadGroups(): Promise<Group[]> {
    const res = await studentService.getGroups();
    return (res.groups ?? []) as Group[];
}

export default function StudentGroupsPage() {
    const { data, loading, error, run } = useAsync(loadGroups);
    const { query, debouncedQuery, setQuery } = useSearch();

    useEffect(() => { run(); }, [run]);

    const groups = data ?? [];
    const filtered = groups.filter((g) => !debouncedQuery || g.name.toLowerCase().includes(debouncedQuery.toLowerCase()));

    if (loading && !groups.length) return <DashboardLayout><PageLoader text="Loading groups…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Groups</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{groups.length} group{groups.length !== 1 ? 's' : ''} assigned to you.</p>
                </div>
                <SearchBar value={query} onValueChange={setQuery} placeholder="Search groups…" className="w-full sm:w-64" />
            </div>

            {error && <AlertBanner variant="warning" message="Some group data could not be loaded." className="mb-5" />}

            {loading ? <TableLoader rows={4} />
                : filtered.length === 0 ? (
                    <EmptyState icon={<Users className="h-7 w-7" />} title={debouncedQuery ? 'No matching groups' : 'No groups yet'} description={debouncedQuery ? 'Try a different search term.' : 'You haven\'t been assigned to any groups yet.'} />
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {filtered.map((g) => (
                            <div key={g.id} className="rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-indigo-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800">
                                <div className="mb-3 flex items-start justify-between">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
                                        <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    {g.teacher && (
                                        <span className="flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                            <GraduationCap className="h-3 w-3" />{g.teacher.name}
                                        </span>
                                    )}
                                </div>
                                <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">{g.name}</h3>
                                <div className="mb-2 flex flex-wrap gap-1.5">
                                    {g.subject && <Badge variant="success">{g.subject}</Badge>}
                                    {g.class_level && <Badge variant="info">Class {g.class_level}</Badge>}
                                    {g.student_count != null && <Badge variant="secondary">{g.student_count} students</Badge>}
                                </div>
                                {g.description && <p className="line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{g.description}</p>}
                            </div>
                        ))}
                    </div>
                )}
        </DashboardLayout>
    );
}
