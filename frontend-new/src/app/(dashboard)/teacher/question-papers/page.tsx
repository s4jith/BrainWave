'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, FileText, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader, TableLoader } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SearchBar } from '@/components/ui/SearchBar';
import { TabStrip } from '@/components/ui/TabStrip';
import { Pagination } from '@/components/ui/Pagination';
import { ApproveRejectButtons } from '@/components/ui/ApproveRejectButtons';
import { useAsync } from '@/hooks/useAsync';
import { usePagination } from '@/hooks/usePagination';
import { useSearch } from '@/hooks/useSearch';
import { questionPapersService } from '@/services/questionPapers.service';
import { formatDate } from '@/utils/formatters';

const TABS = [
    { key: 'all', label: 'All Papers' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
];

interface QuestionPaper {
    id: string;
    title: string;
    subject?: string;
    class_level?: number;
    total_marks?: number;
    question_count?: number;
    status: string;
    created_at: string;
}

// ── Question Papers page – view, create, and manage question papers ───────────
export default function TeacherQuestionPapersPage() {
    const router = useRouter();
    const [tab, setTab] = useState('all');
    const { query, debouncedQuery, setQuery } = useSearch();
    const pagination = usePagination(10);

    const loadPapers = useCallback(async (): Promise<QuestionPaper[]> => {
        const res = await questionPapersService.listPapers({
            status: tab === 'all' ? undefined : tab,
            limit: pagination.pageSize,
            offset: pagination.offset,
        });
        pagination.setTotal(res.length ?? 0);
        console.log('[question-papers] Loaded', res.length, 'papers');
        return res;
    }, [tab, pagination.pageSize, pagination.offset]);

    const { data, loading, error, run } = useAsync(loadPapers);
    useEffect(() => { run(); }, [run]);
    useEffect(() => { pagination.reset(); }, [debouncedQuery, tab]);

    const papers = data ?? [];

    if (loading && !papers.length && pagination.page === 1)
        return <DashboardLayout><PageLoader text="Loading papers…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <PageHeader title="Question Papers" description="Create and manage your question papers." />

            {error && <AlertBanner variant="warning" message="Could not load question papers." className="mb-4" />}

            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <TabStrip tabs={TABS} active={tab} onChange={setTab} />
                <div className="flex gap-2">
                    <SearchBar value={query} onValueChange={setQuery} placeholder="Search papers…" className="w-52" />
                    <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => router.push('/teacher/question-papers/create')}>Create Paper</Button>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                {loading ? <div className="p-5"><TableLoader rows={6} /></div>
                    : papers.length === 0 ? <EmptyState icon={<FileText className="h-7 w-7" />} title="No papers found" description="Create a question paper to get started." />
                        : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                                        <tr>
                                            {['Title', 'Subject/Class', 'Questions', 'Marks', 'Status', 'Created', ''].map((h) => (
                                                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {papers.map((p) => (
                                            <tr key={p.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{p.title}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {p.subject && <Badge variant="info">{p.subject}</Badge>}
                                                        {p.class_level && <Badge variant="secondary">Cl. {p.class_level}</Badge>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.question_count ?? '—'}</td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.total_marks ?? '—'}</td>
                                                <td className="px-4 py-3"><Badge variant={p.status === 'approved' ? 'success' : p.status === 'pending' ? 'warning' : 'secondary'}>{p.status}</Badge></td>
                                                <td className="px-4 py-3 text-xs text-gray-500">{formatDate(p.created_at)}</td>
                                                <td className="px-4 py-3">
                                                    <Button variant="ghost" size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => router.push(`/teacher/question-papers/${p.id}`)}>View</Button>
                                                </td>
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
