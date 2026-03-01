'use client';

import { useEffect, useState, useCallback } from 'react';
import { FileText } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader, TableLoader } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { SearchBar } from '@/components/ui/SearchBar';
import { TabStrip } from '@/components/ui/TabStrip';
import { Pagination } from '@/components/ui/Pagination';
import { ApproveRejectButtons } from '@/components/ui/ApproveRejectButtons';
import { useAsync } from '@/hooks/useAsync';
import { usePagination } from '@/hooks/usePagination';
import { useSearch } from '@/hooks/useSearch';
import { questionPapersService } from '@/services/questionPapers.service';
import { formatDate } from '@/utils/formatters';

const STATUS_TABS = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
];

interface Paper { id: string; title: string; subject?: string; class_level?: number; total_marks?: number; question_count?: number; status: string; created_by?: string; created_at: string }

// ── Admin Question Papers – review all teacher-submitted question papers ───────
export default function AdminQuestionPapersPage() {
    const [tab, setTab] = useState('all');
    const pagination = usePagination(20);
    const { query, debouncedQuery, setQuery } = useSearch();
    const [processingId, setProcessingId] = useState<string | null>(null);

    const load = useCallback(async (): Promise<Paper[]> => {
        const res = await questionPapersService.listPapers({
            status: tab === 'all' ? undefined : tab,
            limit: pagination.pageSize, offset: pagination.offset,
        });
        // listPapers returns array directly
        const papers = Array.isArray(res) ? res : [];
        pagination.setTotal(papers.length);
        console.log('[admin-papers] Loaded', papers.length, 'papers');
        return papers as Paper[];
    }, [tab, debouncedQuery, pagination.page]);

    const { data, loading, error, run } = useAsync(load);
    useEffect(() => { run(); }, [run]);
    useEffect(() => { pagination.reset(); }, [tab, debouncedQuery]);

    const papers = data ?? [];

    const handleAction = (id: string, action: 'approve' | 'reject') => async () => {
        setProcessingId(id);
        try {
            if (action === 'approve') await questionPapersService.approvePaper(id);
            else await questionPapersService.rejectPaper(id);
            console.log('[admin-papers] Paper', action + 'd:', id);
            run();
        } finally { setProcessingId(null); }
    };

    if (loading && !data && pagination.page === 1) return <DashboardLayout><PageLoader text="Loading question papers…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <PageHeader title="Question Papers" description="Review and approve all teacher-submitted papers." />

            {error && <AlertBanner variant="warning" message="Could not load papers." className="mb-5" />}

            <div className="mb-5 flex items-center justify-between gap-4">
                <TabStrip tabs={STATUS_TABS} active={tab} onChange={setTab} />
                <SearchBar value={query} onValueChange={setQuery} placeholder="Search papers…" className="w-52" />
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                {loading ? <div className="p-5"><TableLoader rows={6} /></div>
                    : papers.length === 0 ? <EmptyState icon={<FileText className="h-7 w-7" />} title="No papers found" description="No question papers match your filters." />
                        : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                {papers.map((p) => (
                                    <div key={p.id} className="flex items-start justify-between gap-4 p-5 hover:bg-gray-50 dark:hover:bg-gray-700/20">
                                        <div className="min-w-0 flex-1">
                                            <h3 className="mb-1.5 font-medium text-gray-900 dark:text-white">{p.title}</h3>
                                            <div className="mb-1 flex flex-wrap gap-1.5">
                                                {p.subject && <Badge variant="info">{p.subject}</Badge>}
                                                {p.class_level && <Badge variant="secondary">Class {p.class_level}</Badge>}
                                                {p.question_count != null && <Badge variant="secondary">{p.question_count} Qs</Badge>}
                                                {p.total_marks != null && <Badge variant="purple">{p.total_marks}M</Badge>}
                                                <Badge variant={p.status === 'approved' ? 'success' : p.status === 'pending' ? 'warning' : 'secondary'}>{p.status}</Badge>
                                            </div>
                                            <p className="text-xs text-gray-400">By {p.created_by ?? 'Teacher'} · {formatDate(p.created_at)}</p>
                                        </div>
                                        {p.status === 'pending' && (
                                            <ApproveRejectButtons
                                                variant="text"
                                                onApprove={handleAction(p.id, 'approve')}
                                                onReject={handleAction(p.id, 'reject')}
                                                loadingAction={processingId === p.id ? 'approve' : null}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.pageSize} onPageChange={pagination.setPage} />
            </div>
        </DashboardLayout>
    );
}
