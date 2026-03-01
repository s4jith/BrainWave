'use client';

import { useEffect, useCallback, useState } from 'react';
import { Plus, BookOpen, Edit, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { TabStrip } from '@/components/ui/TabStrip';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader, TableLoader } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { DifficultyBadge, QuestionTypeBadge, AIGeneratedBadge } from '@/components/ui/StatusBadges';
import { Badge } from '@/components/ui/Badge';
import { SearchBar } from '@/components/ui/SearchBar';
import { DifficultyFilter, QuestionTypeFilter, FilterBar } from '@/components/ui/FilterBar';
import { Pagination } from '@/components/ui/Pagination';
import { ApproveRejectButtons } from '@/components/ui/ApproveRejectButtons';
import { useAsync } from '@/hooks/useAsync';
import { usePagination } from '@/hooks/usePagination';
import { useSearch } from '@/hooks/useSearch';
import { questionBankService } from '@/services/questionBank.service';
import { formatDate } from '@/utils/formatters';
import type { QuestionBankItem } from '@/types';

const TABS = [
    { key: 'approved', label: 'Question Bank' },
    { key: 'pending', label: 'Pending Approval' },
];

export default function TeacherQuestionBankPage() {
    const [tab, setTab] = useState('approved');
    const [difficulty, setDifficulty] = useState('');
    const [type, setType] = useState('');
    const pagination = usePagination(10);
    const { query, debouncedQuery, setQuery } = useSearch();

    useEffect(() => { pagination.reset(); }, [debouncedQuery, difficulty, type, tab]);

    const loadQuestions = useCallback(async () => {
        const res = await questionBankService.getQuestions({
            status: tab,
            difficulty: difficulty || undefined,
            type: type || undefined,
            search: debouncedQuery || undefined,
            limit: pagination.pageSize,
            offset: pagination.offset,
        });
        pagination.setTotal(res.total);
        return res.questions;
    }, [tab, difficulty, type, debouncedQuery, pagination.page]);

    const { data, loading, error, run } = useAsync(loadQuestions);
    useEffect(() => { run(); }, [run]);

    const questions = data ?? [];

    if (loading && !questions.length && pagination.page === 1) {
        return <DashboardLayout><PageLoader text="Loading questions…" /></DashboardLayout>;
    }

    return (
        <DashboardLayout>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Question Bank</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage and organise all test questions.</p>
                </div>
                <Button leftIcon={<Plus className="h-4 w-4" />}>Add Question</Button>
            </div>

            {error && <AlertBanner variant="warning" message="Some questions could not be loaded." className="mb-4" />}

            <TabStrip tabs={TABS} active={tab} onChange={setTab} className="mb-5" />

            <FilterBar className="mb-5">
                <SearchBar value={query} onValueChange={setQuery} placeholder="Search questions…" />
                <DifficultyFilter value={difficulty} onChange={setDifficulty} />
                <QuestionTypeFilter value={type} onChange={setType} />
            </FilterBar>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                {loading ? <div className="p-5"><TableLoader rows={8} /></div>
                    : questions.length === 0 ? <EmptyState icon={<BookOpen className="h-7 w-7" />} title="No questions found" description="Try adjusting filters or add a new question." />
                        : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                {questions.map((q) => (
                                    <QuestionRow key={q.id} question={q} showApproval={tab === 'pending'} onRefresh={run} />
                                ))}
                            </div>
                        )}

                <Pagination
                    page={pagination.page}
                    totalPages={pagination.totalPages}
                    total={pagination.total}
                    pageSize={pagination.pageSize}
                    onPageChange={pagination.setPage}
                />
            </div>
        </DashboardLayout>
    );
}

function QuestionRow({ question: q, showApproval, onRefresh }: { question: QuestionBankItem; showApproval: boolean; onRefresh: () => void }) {
    const [loadingAction, setLoadingAction] = useState<'approve' | 'reject' | null>(null);

    const handle = (action: 'approve' | 'reject') => async () => {
        setLoadingAction(action);
        try {
            if (action === 'approve') await questionBankService.approveQuestion(q.id);
            else await questionBankService.rejectQuestion(q.id);
            onRefresh();
        } finally { setLoadingAction(null); }
    };

    return (
        <div className="flex items-start justify-between gap-4 p-5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/20">
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
            <div className="flex flex-shrink-0 items-center gap-1.5">
                {showApproval && (
                    <ApproveRejectButtons variant="text" onApprove={handle('approve')} onReject={handle('reject')} loadingAction={loadingAction} />
                )}
                <button className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-white"><Edit className="h-4 w-4" /></button>
                <button className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
            </div>
        </div>
    );
}
