'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, FileText, BookOpen, Users, ClipboardList, TrendingUp, GraduationCap } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { StatCard } from '@/components/ui/Card';
import { TabStrip } from '@/components/ui/TabStrip';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader, TableLoader } from '@/components/ui/Spinner';
import { DifficultyBadge, QuestionTypeBadge, QuestionStatusBadge, AIGeneratedBadge } from '@/components/ui/StatusBadges';
import { Badge } from '@/components/ui/Badge';
import { ApproveRejectButtons } from '@/components/ui/ApproveRejectButtons';
import { useAsync } from '@/hooks/useAsync';
import apiClient from '@/lib/axios';
import { formatDate } from '@/utils/formatters';
import type { QuestionBankItem, HeadStats, QuestionPaper } from '@/types/api.types';

interface HeadAssignment {
    assignment_type: 'subject' | 'class';
    assigned_subjects?: string[];
    assigned_classes?: number[];
}

async function loadHeadDashboard() {
    const [statsRes, pendingQRes, pendingPapersRes, assignmentRes] = await Promise.allSettled([
        apiClient.get<{ stats: HeadStats }>('/api/head/dashboard-stats'),
        apiClient.get<{ questions: QuestionBankItem[] }>('/api/head/pending-questions'),
        apiClient.get<{ papers: QuestionPaper[] }>('/api/head/pending-papers'),
        apiClient.get<HeadAssignment>('/api/head/my-assignment').catch(() => null),
    ]);

    return {
        stats: statsRes.status === 'fulfilled' ? statsRes.value.data.stats : null,
        pendingQuestions: pendingQRes.status === 'fulfilled' ? pendingQRes.value.data.questions : [],
        pendingPapers: pendingPapersRes.status === 'fulfilled' ? pendingPapersRes.value.data.papers : [],
        assignment: assignmentRes.status === 'fulfilled' && assignmentRes.value ? assignmentRes.value.data : null,
    };
}

const TABS = [
    { key: 'questions', label: 'Pending Questions' },
    { key: 'papers', label: 'Pending Papers' },
];

export default function HeadDashboardPage() {
    const [tab, setTab] = useState('questions');
    const { data, loading, error, run } = useAsync(loadHeadDashboard);

    useEffect(() => { run(); }, [run]);

    if (loading && !data) return <DashboardLayout><PageLoader text="Loading dashboard…" /></DashboardLayout>;

    const stats = data?.stats ?? null;
    const pendingQuestions = data?.pendingQuestions ?? [];
    const pendingPapers = data?.pendingPapers ?? [];
    const assignment = data?.assignment ?? null;

    const handleApproveQuestion = async (id: string) => {
        await apiClient.post(`/api/head/approve-question/${id}`);
        run();
    };
    const handleRejectQuestion = async (id: string) => {
        await apiClient.post(`/api/head/reject-question/${id}`);
        run();
    };
    const handleApprovePaper = async (id: string) => {
        await apiClient.post(`/api/head/approve-paper/${id}`);
        run();
    };
    const handleRejectPaper = async (id: string) => {
        await apiClient.post(`/api/head/reject-paper/${id}`);
        run();
    };

    return (
        <DashboardLayout>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Head Dashboard</h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Review and approve questions and papers.</p>
            </div>

            {error && <AlertBanner variant="warning" message="Some data failed to load." className="mb-6" />}

            <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard icon={ClipboardList} label="Pending" value={stats?.pending_questions ?? pendingQuestions.length} description="Awaiting review" />
                <StatCard icon={CheckCircle} label="Approved" value={stats?.total_approved ?? 0} description="Questions approved" />
                <StatCard icon={XCircle} label="Rejected" value={stats?.total_rejected ?? 0} description="Questions rejected" />
                <StatCard icon={FileText} label="Papers" value={stats?.total_papers ?? 0} description="Question papers" />
            </div>

            {assignment && (
                <div className="mb-8 rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-wrap items-center gap-3 dark:border-gray-700 dark:bg-gray-800">
                    {assignment.assignment_type === "subject" ? (
                        <>
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-purple-100 px-3 py-1.5 text-sm font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                <BookOpen className="h-4 w-4" /> Assigned by Subject
                            </span>
                            {(assignment.assigned_subjects || []).map(s => (
                                <span key={s} className="rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-sm text-purple-600 dark:border-purple-800 dark:bg-purple-900/20 dark:text-purple-300">
                                    {s}
                                </span>
                            ))}
                            {(!assignment.assigned_subjects || assignment.assigned_subjects.length === 0) && (
                                <span className="text-sm text-gray-400">No subjects assigned yet</span>
                            )}
                        </>
                    ) : (
                        <>
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                <GraduationCap className="h-4 w-4" /> Assigned by Class
                            </span>
                            {(assignment.assigned_classes || []).map(c => (
                                <span key={c} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-sm text-blue-600 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                                    Class {c}
                                </span>
                            ))}
                            {(!assignment.assigned_classes || assignment.assigned_classes.length === 0) && (
                                <span className="text-sm text-gray-400">No classes assigned yet</span>
                            )}
                        </>
                    )}
                </div>
            )}

            <TabStrip
                tabs={[
                    { key: 'questions', label: 'Pending Questions', badge: pendingQuestions.length },
                    { key: 'papers', label: 'Pending Papers', badge: pendingPapers.length },
                ]}
                active={tab}
                onChange={setTab}
                className="mb-6"
            />

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                {loading ? <div className="p-5"><TableLoader rows={6} /></div>
                    : tab === 'questions' ? (
                        pendingQuestions.length === 0
                            ? <EmptyState icon={<BookOpen className="h-7 w-7" />} title="No pending questions" description="All questions have been reviewed." />
                            : (
                                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {pendingQuestions.map((q) => (
                                        <div key={q.id} className="flex items-start justify-between gap-4 p-5 hover:bg-gray-50 dark:hover:bg-gray-700/20">
                                            <div className="min-w-0 flex-1">
                                                <div className="mb-2 flex flex-wrap gap-2">
                                                    <DifficultyBadge difficulty={q.difficulty} />
                                                    <QuestionTypeBadge type={q.type} />
                                                    <Badge variant="info">{q.subject} · Class {q.class_level}</Badge>
                                                    <Badge variant="purple">{q.marks} Mark{q.marks > 1 ? 's' : ''}</Badge>
                                                    {q.is_ai_generated && <AIGeneratedBadge />}
                                                </div>
                                                <p className="mb-1 text-sm font-medium text-gray-900 dark:text-white">{q.text}</p>
                                                <p className="text-xs text-gray-400">By {q.created_by} · {formatDate(q.created_at)}</p>
                                            </div>
                                            <ApproveRejectButtons
                                                variant="text"
                                                onApprove={() => handleApproveQuestion(q.id)}
                                                onReject={() => handleRejectQuestion(q.id)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )
                    ) : (
                        pendingPapers.length === 0
                            ? <EmptyState icon={<FileText className="h-7 w-7" />} title="No pending papers" description="All question papers have been reviewed." />
                            : (
                                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {pendingPapers.map((p) => (
                                        <div key={p.id} className="flex items-start justify-between gap-4 p-5 hover:bg-gray-50 dark:hover:bg-gray-700/20">
                                            <div className="min-w-0 flex-1">
                                                <div className="mb-1 flex flex-wrap gap-2">
                                                    <Badge variant="info">{p.subject}</Badge>
                                                    <Badge variant="secondary">Class {p.class_level}</Badge>
                                                    <QuestionStatusBadge status={p.status as 'pending' | 'approved' | 'rejected' | 'archived'} />
                                                </div>
                                                <p className="font-medium text-gray-900 dark:text-white">{p.title}</p>
                                                <p className="text-xs text-gray-400">By {p.created_by} · {formatDate(p.created_at)}</p>
                                            </div>
                                            <ApproveRejectButtons
                                                variant="icon"
                                                onApprove={() => handleApprovePaper(p.id)}
                                                onReject={() => handleRejectPaper(p.id)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )
                    )}
            </div>
        </DashboardLayout>
    );
}
