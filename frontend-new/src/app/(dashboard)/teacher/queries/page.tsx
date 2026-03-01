'use client';

import { useEffect, useState } from 'react';
import { HelpCircle, Send } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TabStrip } from '@/components/ui/TabStrip';
import { useAsync } from '@/hooks/useAsync';
import { queriesService } from '@/services/queries.service';
import { formatDate } from '@/utils/formatters';
import type { Query } from '@/types';

const STATUS_TABS = [
    { key: 'pending', label: 'Pending' },
    { key: 'answered', label: 'Answered' },
    { key: 'all', label: 'All' },
];

// ── Teacher Queries – view and reply to student questions ─────────────────────
export default function TeacherQueriesPage() {
    const [tab, setTab] = useState('pending');
    const [replyMap, setReplyMap] = useState<Record<string, string>>({});
    const [sendingId, setSendingId] = useState<string | null>(null);

    const { data, loading, error, run } = useAsync(async (): Promise<Query[]> => {
        const res = await queriesService.getTeacherQueries(tab === 'all' ? undefined : tab);
        console.log('[queries] Teacher loaded', res.length, 'queries for tab:', tab);
        return res;
    });
    useEffect(() => { run(); }, [run, tab]);

    const queries = data ?? [];

    const handleReply = async (queryId: string) => {
        const reply = replyMap[queryId]?.trim();
        if (!reply) return;
        setSendingId(queryId);
        try {
            await queriesService.replyToQuery(queryId, reply);
            console.log('[queries] Reply sent for query:', queryId);
            setReplyMap((prev) => ({ ...prev, [queryId]: '' }));
            run();
        } catch { /* no-op */ }
        setSendingId(null);
    };

    if (loading && !data) return <DashboardLayout><PageLoader text="Loading queries…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <PageHeader title="Student Queries" description="Answer questions from your students." />

            <TabStrip tabs={STATUS_TABS} active={tab} onChange={setTab} className="mb-5" />

            {error && <AlertBanner variant="warning" message="Could not load queries." className="mb-4" />}

            {queries.length === 0 ? (
                <EmptyState icon={<HelpCircle className="h-7 w-7" />} title="No queries" description={tab === 'pending' ? 'No pending questions from students.' : 'No queries found.'} />
            ) : (
                <div className="space-y-4">
                    {queries.map((q) => (
                        <div key={q.id} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="font-medium text-gray-900 dark:text-white text-sm">{q.student_name ?? 'Student'}</span>
                                {q.subject && <Badge variant="info">{q.subject}</Badge>}
                                <Badge variant={q.status === 'pending' ? 'warning' : 'success'}>{q.status}</Badge>
                                <span className="ml-auto text-xs text-gray-400">{formatDate(q.created_at)}</span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{q.message}</p>

                            {/* Existing reply */}
                            {q.reply && (
                                <div className="mb-3 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-900/20">
                                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-1">Your reply</p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{q.reply}</p>
                                </div>
                            )}

                            {/* Reply input (only for pending queries) */}
                            {q.status === 'pending' && (
                                <div className="flex gap-2">
                                    <input
                                        value={replyMap[q.id] ?? ''}
                                        onChange={(e) => setReplyMap((prev) => ({ ...prev, [q.id]: e.target.value }))}
                                        placeholder="Type your reply…"
                                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white"
                                    />
                                    <Button
                                        size="sm"
                                        leftIcon={<Send className="h-3.5 w-3.5" />}
                                        loading={sendingId === q.id}
                                        onClick={() => handleReply(q.id)}
                                        disabled={!replyMap[q.id]?.trim()}
                                    >
                                        Reply
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </DashboardLayout>
    );
}
