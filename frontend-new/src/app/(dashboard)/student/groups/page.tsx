'use client';

import { useEffect, useState } from 'react';
import { Users, BookOpen } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader, TableLoader } from '@/components/ui/Spinner';
import { TabStrip } from '@/components/ui/TabStrip';
import { useAsync } from '@/hooks/useAsync';
import { studentService } from '@/services/student.service';
import { StudentGroupCard } from '@/components/features/student/StudentGroupCard';
import { StudentSubjectCard } from '@/components/features/student/StudentSubjectCard';
import type { StudentGroup, StudentSubject } from '@/types';

async function loadStudentData() {
    const [groupsRes, subjectsRes] = await Promise.allSettled([
        studentService.getGroups(),
        studentService.getSubjects(),
    ]);

    return {
        groups: (groupsRes.status === 'fulfilled' ? groupsRes.value.groups : []) as StudentGroup[],
        subjects: (subjectsRes.status === 'fulfilled' && subjectsRes.value ? subjectsRes.value.subjects : []) as StudentSubject[],
        hasError: groupsRes.status === 'rejected' || subjectsRes.status === 'rejected',
    };
}

export default function StudentGroupsPage() {
    const [activeTab, setActiveTab] = useState('groups');
    const { data, loading, error, run } = useAsync(loadStudentData);

    useEffect(() => { run(); }, [run]);

    if (loading && !data) return <DashboardLayout><PageLoader text="Loading your groups…" /></DashboardLayout>;

    const groups = data?.groups ?? [];
    const subjects = data?.subjects ?? [];
    const hasDataError = error || data?.hasError;

    // Derived unique subjects from groups if needed, but we have actual subjects from API.
    const uniqueSubjectsCount = new Set(groups.map(g => g.subject).filter(Boolean)).size;

    const STATUS_TABS = [
        { key: 'groups', label: 'My Groups', count: groups.length },
        { key: 'subjects', label: 'Subjects', count: subjects.length },
    ];

    return (
        <DashboardLayout>
            <PageHeader title="My Groups" description="View your assigned groups, subjects, and upcoming tests" />

            {/* Quick Summary Cards */}
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/30">
                        <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{groups.length}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Groups Joined</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
                        <BookOpen className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{Math.max(subjects.length, uniqueSubjectsCount)}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">My Subjects</p>
                        {groups.length > 0 && (
                            <p className="mt-0.5 truncate text-xs text-gray-400">
                                {[...new Set(groups.map(g => g.subject).filter(Boolean))].join(', ')}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {hasDataError && <AlertBanner variant="warning" message="Some data could not be loaded." className="mb-5" />}

            <TabStrip tabs={STATUS_TABS} active={activeTab} onChange={setActiveTab} className="mb-6" />

            {loading ? <TableLoader rows={5} /> : (
                <div className="space-y-4">
                    {activeTab === 'groups' && (
                        groups.length === 0 ? (
                            <EmptyState
                                icon={<Users className="h-7 w-7" />}
                                title="No Groups Assigned"
                                description="You haven't been assigned to any groups yet. Your teacher or admin will add you to a group."
                            />
                        ) : (
                            groups.map((group) => (
                                <StudentGroupCard key={group.id} group={group} />
                            ))
                        )
                    )}

                    {activeTab === 'subjects' && (
                        subjects.length === 0 ? (
                            <EmptyState
                                icon={<BookOpen className="h-7 w-7" />}
                                title="No Subjects Yet"
                                description="Subjects will appear here based on your group assignments."
                            />
                        ) : (
                            subjects.map((subject) => (
                                <StudentSubjectCard key={subject.id} subject={subject} />
                            ))
                        )
                    )}
                </div>
            )}
        </DashboardLayout>
    );
}
