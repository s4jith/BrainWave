'use client';

import { useEffect, useState, useCallback } from 'react';
import { FileText } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { ApproveRejectButtons } from '@/components/ui/ApproveRejectButtons';
import { Pagination } from '@/components/ui/Pagination';
import { useAsync } from '@/hooks/useAsync';
import { usePagination } from '@/hooks/usePagination';
import { headService } from '@/services/head.service';
import { formatDate } from '@/utils/formatters';
import type { QuestionPaper } from '@/types/api.types';

// ── Head Pending Papers – approve or reject teacher question papers ────────────
export default function HeadPendingPapersPage() {
    const pagination = usePagination(15);
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const loadPapers = useCallback(async (): Promise<QuestionPaper[]> => {
        const res = await headService.getPendingPapers({ limit: pagination.pageSize, offset: pagination.offset });
        console.log('[head] Pending papers loaded:', res.papers?.length ?? 0);
        return res.papers ?? [];
    }, [pagination.page]);

    const { data, loading, error, run } = useAsync<QuestionPaper[]>(loadPapers);
    useEffect(() => { run(); }, [run]);

    const papers = data ?? [];

    const handle = (id: string, action: 'approve' | 'reject') => async () => {
        setLoadingId(id);
        try {
            if (action === 'approve') await headService.approvePaper(id);
            else await headService.rejectPaper(id);
            console.log('[head] Paper', action + 'd:', id);
            run();
        } finally { setLoadingId(null); }
    };

    if (loading && !data) return <DashboardLayout><PageLoader text="Loading pending papers…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <PageHeader title="Pending Papers" description="Review and approve question papers submitted by teachers." />

            {error && <AlertBanner variant="warning" message="Could not load pending papers." className="mb-5" />}

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                {papers.length === 0 ? (
                    <EmptyState icon={<FileText className="h-7 w-7" />} title="No pending papers" description="All question papers have been reviewed." />
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {papers.map((p) => (
                            <div key={p.id} className="flex items-start justify-between gap-4 p-5 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                                <div className="min-w-0 flex-1">
                                    <h3 className="mb-1.5 font-medium text-gray-900 dark:text-white">{p.title}</h3>
                                    <div className="mb-1 flex flex-wrap gap-1.5">
                                        {p.subject && <Badge variant="info">{p.subject}</Badge>}
                                        {p.class_level && <Badge variant="secondary">Class {p.class_level}</Badge>}
                                        {p.question_count != null && <Badge variant="secondary">{p.question_count} questions</Badge>}
                                        {p.total_marks != null && <Badge variant="purple">{p.total_marks} marks</Badge>}
                                    </div>
                                    <p className="text-xs text-gray-400">By {p.created_by} · {formatDate(p.created_at)}</p>
                                </div>
                                <ApproveRejectButtons
                                    variant="text"
                                    onApprove={handle(p.id, 'approve')}
                                    onReject={handle(p.id, 'reject')}
                                    loadingAction={loadingId === p.id ? 'approve' : null}
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
