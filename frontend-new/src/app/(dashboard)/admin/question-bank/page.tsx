'use client';

import { useEffect, useState, useCallback } from 'react';
import { HelpCircle, Plus, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader, TableLoader } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { DifficultyBadge, QuestionTypeBadge } from '@/components/ui/StatusBadges';
import { Button } from '@/components/ui/Button';
import { SearchBar } from '@/components/ui/SearchBar';
import { TabStrip } from '@/components/ui/TabStrip';
import { Pagination } from '@/components/ui/Pagination';
import { useAsync } from '@/hooks/useAsync';
import { usePagination } from '@/hooks/usePagination';
import { useSearch } from '@/hooks/useSearch';
import { questionBankService } from '@/services/questionBank.service';
import { formatDate } from '@/utils/formatters';

const SUBJECT_TABS = [
    { key: 'all', label: 'All Subjects' },
    { key: 'Maths', label: 'Maths' },
    { key: 'Science', label: 'Science' },
    { key: 'Social Science', label: 'Social' },
];

interface Question { id: string; text: string; type: string; difficulty: string; subject?: string; class_level?: number; marks: number; is_ai_generated?: boolean; created_at: string }

// ── Admin Question Bank – view and manage all platform questions ───────────────
export default function AdminQuestionBankPage() {
    const [subject, setSubject] = useState('all');
    const pagination = usePagination(25);
    const { query, debouncedQuery, setQuery } = useSearch();

    const load = useCallback(async (): Promise<Question[]> => {
        const res = await questionBankService.getQuestions({
            subject: subject === 'all' ? undefined : subject,
            search: debouncedQuery || undefined,
            limit: pagination.pageSize, offset: pagination.offset,
        });
        pagination.setTotal(res.total ?? 0);
        console.log('[admin-qbank] Loaded', (res.questions as unknown[])?.length ?? 0, 'questions');
        return (res.questions ?? []) as Question[];
    }, [subject, debouncedQuery, pagination.page]);

    const { data, loading, error, run } = useAsync(load);
    useEffect(() => { run(); }, [run]);
    useEffect(() => { pagination.reset(); }, [subject, debouncedQuery]);

    const questions = data ?? [];

    const handleDelete = async (qId: string) => {
        if (!confirm('Delete this question?')) return;
        await questionBankService.deleteQuestion(qId);
        run();
    };

    if (loading && !data && pagination.page === 1) return <DashboardLayout><PageLoader text="Loading question bank…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <PageHeader title="Question Bank" description={`${pagination.total} questions in the bank.`} />

            {error && <AlertBanner variant="warning" message="Could not load questions." className="mb-5" />}

            <div className="mb-5 flex items-center justify-between gap-4">
                <TabStrip tabs={SUBJECT_TABS} active={subject} onChange={setSubject} />
                <SearchBar value={query} onValueChange={setQuery} placeholder="Search questions…" className="w-60" />
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                {loading ? <div className="p-5"><TableLoader rows={8} /></div>
                    : questions.length === 0 ? <EmptyState icon={<HelpCircle className="h-7 w-7" />} title="No questions found" description="Adjust your filters or search term." />
                        : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                {questions.map((q) => (
                                    <div key={q.id} className="flex items-start justify-between gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/20">
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-1.5 flex flex-wrap gap-1.5">
                                                <DifficultyBadge difficulty={q.difficulty} />
                                                <QuestionTypeBadge type={q.type} />
                                                {q.subject && <Badge variant="info">{q.subject} · Cl. {q.class_level}</Badge>}
                                                <Badge variant="purple">{q.marks}M</Badge>
                                                {q.is_ai_generated && <Badge variant="secondary">AI</Badge>}
                                            </div>
                                            <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{q.text}</p>
                                            <p className="mt-0.5 text-xs text-gray-400">{formatDate(q.created_at)}</p>
                                        </div>
                                        <button onClick={() => handleDelete(q.id)} className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.pageSize} onPageChange={pagination.setPage} />
            </div>
        </DashboardLayout>
    );
}
