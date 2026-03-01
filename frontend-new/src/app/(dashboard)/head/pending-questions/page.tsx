'use client';

import { useEffect, useState, useCallback } from 'react';
import { BookOpen } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { DifficultyBadge, QuestionTypeBadge } from '@/components/ui/StatusBadges';
import { ApproveRejectButtons } from '@/components/ui/ApproveRejectButtons';
import { SearchBar } from '@/components/ui/SearchBar';
import { Pagination } from '@/components/ui/Pagination';
import { useAsync } from '@/hooks/useAsync';
import { usePagination } from '@/hooks/usePagination';
import { useSearch } from '@/hooks/useSearch';
import { headService } from '@/services/head.service';
import { formatDate } from '@/utils/formatters';
import type { QuestionBankItem } from '@/types/api.types';

// ── Head Pending Questions – full-page approve/reject queue ───────────────────
export default function HeadPendingQuestionsPage() {
    const pagination = usePagination(15);
    const { query, debouncedQuery, setQuery } = useSearch();
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const loadQuestions = useCallback(async (): Promise<QuestionBankItem[]> => {
        const res = await headService.getPendingQuestions({ limit: pagination.pageSize, offset: pagination.offset });
        console.log('[head] Pending questions loaded:', res.questions?.length ?? 0);
        return res.questions ?? [];
    }, [pagination.page]);

    const { data, loading, error, run } = useAsync<QuestionBankItem[]>(loadQuestions);
    useEffect(() => { run(); }, [run]);

    const questions = (data ?? []).filter((q) =>
        !debouncedQuery || q.text.toLowerCase().includes(debouncedQuery.toLowerCase())
    );

    const handle = (id: string, action: 'approve' | 'reject') => async () => {
        setLoadingId(id);
        try {
            if (action === 'approve') await headService.approveQuestion(id);
            else await headService.rejectQuestion(id);
            console.log('[head] Question', action + 'd:', id);
            run();
        } finally { setLoadingId(null); }
    };

    if (loading && !data) return <DashboardLayout><PageLoader text="Loading pending questions…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <PageHeader title="Pending Questions" description="Review and approve questions submitted by teachers." />

            {error && <AlertBanner variant="warning" message="Could not load pending questions." className="mb-5" />}

            <div className="mb-5 flex justify-end">
                <SearchBar value={query} onValueChange={setQuery} placeholder="Search questions…" className="w-60" />
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                {questions.length === 0 ? (
                    <EmptyState icon={<BookOpen className="h-7 w-7" />} title="No pending questions" description="All questions are reviewed." />
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {questions.map((q) => (
                            <div key={q.id} className="flex items-start justify-between gap-4 p-5 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                                <div className="min-w-0 flex-1">
                                    <div className="mb-2 flex flex-wrap gap-2">
                                        <DifficultyBadge difficulty={q.difficulty} />
                                        <QuestionTypeBadge type={q.type} />
                                        {q.subject && <Badge variant="info">{q.subject} · Class {q.class_level}</Badge>}
                                        <Badge variant="purple">{q.marks} Mark{q.marks > 1 ? 's' : ''}</Badge>
                                    </div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{q.text}</p>
                                    <p className="mt-1 text-xs text-gray-400">By {q.created_by} · {formatDate(q.created_at)}</p>
                                </div>
                                <ApproveRejectButtons
                                    variant="text"
                                    onApprove={handle(q.id, 'approve')}
                                    onReject={handle(q.id, 'reject')}
                                    loadingAction={loadingId === q.id ? 'approve' : null}
                                />
                            </div>
                        ))}
                    </div>
                )}
                <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.pageSize} onPageChange={pagination.setPage} />
            </div>
        </DashboardLayout>
    );
}
