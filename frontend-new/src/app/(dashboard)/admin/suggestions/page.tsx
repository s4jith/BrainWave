'use client';

import { useEffect, useState, useCallback } from 'react';
import { MessageCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TabStrip } from '@/components/ui/TabStrip';
import { useAsync } from '@/hooks/useAsync';
import { suggestionsService } from '@/services/suggestions.service';
import { formatDate } from '@/utils/formatters';
import type { Suggestion } from '@/types';

const STATUS_TABS = [
    { key: 'pending', label: 'Pending' },
    { key: 'reviewed', label: 'Reviewed' },
    { key: 'implemented', label: 'Implemented' },
    { key: 'all', label: 'All' },
];

const STATUS_COLOR: Record<string, 'secondary' | 'warning' | 'success' | 'destructive'> = {
    pending: 'warning', reviewed: 'secondary', implemented: 'success', rejected: 'destructive',
};

// ── Admin Suggestions – view and respond to all student/teacher feedback ───────
export default function AdminSuggestionsPage() {
    const [tab, setTab] = useState('pending');
    const [replyMap, setReplyMap] = useState<Record<string, string>>({});
    const [processingId, setProcessingId] = useState<string | null>(null);

    const { data, loading, error, run } = useAsync(async (): Promise<Suggestion[]> => {
        const res = await suggestionsService.getAllSuggestions(tab === 'all' ? undefined : tab);
        console.log('[admin-suggestions] Loaded', res.length, 'suggestions for status:', tab);
        return res;
    });
    useEffect(() => { run(); }, [run, tab]);

    const suggestions = data ?? [];

    const handleRespond = async (suggestionId: string, status: string) => {
        const reply = replyMap[suggestionId]?.trim();
        if (!reply) return;
        setProcessingId(suggestionId);
        try {
            await suggestionsService.respondToSuggestion(suggestionId, reply, status);
            console.log('[admin-suggestions] Responded to suggestion:', suggestionId);
            setReplyMap((prev) => ({ ...prev, [suggestionId]: '' }));
            run();
        } finally { setProcessingId(null); }
    };

    if (loading && !data) return <DashboardLayout><PageLoader text="Loading suggestions…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <PageHeader title="Suggestions" description="Review and respond to feedback from students and teachers." />

            {error && <AlertBanner variant="warning" message="Could not load suggestions." className="mb-5" />}

            <TabStrip tabs={STATUS_TABS} active={tab} onChange={setTab} className="mb-5" />

            {suggestions.length === 0 ? (
                <EmptyState icon={<MessageCircle className="h-7 w-7" />} title="No suggestions" description={`No ${tab === 'all' ? '' : tab} suggestions.`} />
            ) : (
                <div className="space-y-4">
                    {suggestions.map((s) => (
                        <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{s.student_name}</span>
                                <Badge variant="info">{s.category}</Badge>
                                {s.subject && <Badge variant="secondary">{s.subject}</Badge>}
                                <Badge variant={STATUS_COLOR[s.status] ?? 'secondary'}>{s.status}</Badge>
                                <span className="ml-auto text-xs text-gray-400">{formatDate(s.created_at)}</span>
                            </div>
                            <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">{s.content}</p>

                            {/* Existing response */}
                            {s.response && (
                                <div className="mb-3 rounded-lg bg-indigo-50 p-3 dark:bg-indigo-900/20">
                                    <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">Your response:</p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{s.response}</p>
                                </div>
                            )}

                            {/* Reply input for pending */}
                            {s.status === 'pending' && (
                                <div className="flex gap-2">
                                    <input
                                        value={replyMap[s.id] ?? ''}
                                        onChange={(e) => setReplyMap((prev) => ({ ...prev, [s.id]: e.target.value }))}
                                        placeholder="Type a response…"
                                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white"
                                    />
                                    <Button size="sm" variant="outline" loading={processingId === s.id} onClick={() => handleRespond(s.id, 'reviewed')} disabled={!replyMap[s.id]?.trim()}>Review</Button>
                                    <Button size="sm" loading={processingId === s.id} onClick={() => handleRespond(s.id, 'implemented')} disabled={!replyMap[s.id]?.trim()}>Implement</Button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </DashboardLayout>
    );
}
