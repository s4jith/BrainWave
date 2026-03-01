'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Users, BarChart2 } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader, TableLoader } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SearchBar } from '@/components/ui/SearchBar';
import { useAsync } from '@/hooks/useAsync';
import { useSearch } from '@/hooks/useSearch';
import { teacherService } from '@/services/teacher.service';
import { gradebookService } from '@/services/gradebook.service';
import type { StudentGroup, TeacherStats } from '@/types/api.types';

interface GroupGrade {
    group_id: string;
    group_name: string;
    subject?: string;
    avg_score: number;
    pass_rate: number;
    student_count: number;
    class_level?: number;
}

// ── Teacher Gradebook – per-group student performance overview ────────────────
export default function TeacherGradebookPage() {
    const { data, loading, error, run } = useAsync(async (): Promise<GroupGrade[]> => {
        // Fetch groups then get teacher stats for aggregated grade data
        const [groupsRes, statsRes] = await Promise.allSettled([
            teacherService.getGroups(),
            gradebookService.getTeacherStats(),
        ]);

        const groups: StudentGroup[] = groupsRes.status === 'fulfilled' ? (groupsRes.value.groups ?? []) : [];
        const stats: Partial<TeacherStats> = statsRes.status === 'fulfilled' ? statsRes.value : {};

        console.log('[gradebook] Loaded', groups.length, 'groups');

        // Merge groups with any stats data keyed by group_id
        // Note: The backend get_teacher_dashboard_stats doesn't return per-group data yet,
        // but we keep the structure for future-proofing as per user request.
        const groupStatsMap = (stats.groups || {}) as Record<string, { avg_score?: number; pass_rate?: number }>;

        return groups.map((group) => {
            const groupStats = groupStatsMap[group.id];
            return {
                group_id: group.id,
                group_name: group.name,
                subject: group.subject,
                class_level: group.class_level,
                student_count: group.student_count ?? 0,
                avg_score: groupStats?.avg_score ?? 0,
                pass_rate: groupStats?.pass_rate ?? 0,
            };
        });
    });
    useEffect(() => { run(); }, [run]);

    const { query, debouncedQuery, setQuery } = useSearch();
    const groups = (data ?? []).filter((g) => !debouncedQuery || g.group_name.toLowerCase().includes(debouncedQuery.toLowerCase()));

    if (loading && !data) return <DashboardLayout><PageLoader text="Loading gradebook…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <PageHeader title="Gradebook" description="View performance across all your groups." />

            {error && <AlertBanner variant="warning" message="Some gradebook data failed to load." className="mb-5" />}

            <div className="mb-5 flex justify-end">
                <SearchBar value={query} onValueChange={setQuery} placeholder="Search groups…" className="w-52" />
            </div>

            {loading ? <TableLoader rows={5} />
                : groups.length === 0 ? <EmptyState icon={<BookOpen className="h-7 w-7" />} title="No groups found" description={debouncedQuery ? 'Try adjusting your search.' : 'No groups assigned to you yet.'} />
                    : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {groups.map((g) => (
                                <div key={g.group_id} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                                        <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">{g.group_name}</h3>
                                    <div className="mb-3 flex flex-wrap gap-1.5">
                                        {g.subject && <Badge variant="info">{g.subject}</Badge>}
                                        {g.class_level && <Badge variant="secondary">Class {g.class_level}</Badge>}
                                        <Badge variant="secondary"><Users className="mr-1 h-3 w-3 inline" />{g.student_count} students</Badge>
                                    </div>
                                    <div className="mb-2 space-y-2">
                                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                            <span>Avg Score</span>
                                            <span>{g.avg_score}%</span>
                                        </div>
                                        <ProgressBar value={g.avg_score} size="sm" />
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        <BarChart2 className="mr-1 h-3 w-3 inline" />
                                        Pass Rate: {g.pass_rate}%
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
        </DashboardLayout>
    );
}
