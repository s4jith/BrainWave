'use client';

import { useEffect, useState } from 'react';
import { HelpCircle, Plus, Send } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { TabStrip } from '@/components/ui/TabStrip';
import { useAsync } from '@/hooks/useAsync';
import { useAuthStore } from '@/stores/authStore';
import { queriesService } from '@/services/queries.service';
import { studentService } from '@/services/student.service';
import { formatDate } from '@/utils/formatters';
import type { Query } from '@/types';

const STATUS_TABS = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'answered', label: 'Answered' },
];

const STATUS_COLOR: Record<string, 'warning' | 'success' | 'secondary'> = {
    pending: 'warning',
    answered: 'success',
    closed: 'secondary',
};

// ── Student Queries – submit a question to a teacher and track the reply ─────
export default function StudentQueriesPage() {
    const user = useAuthStore((s) => s.user);
    const [tab, setTab] = useState('all');
    const [showNew, setShowNew] = useState(false);

    // New query form state
    const [groupId, setGroupId] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Load student groups for the group selector
    const { data: groups } = useAsync(async () => {
        const res = await studentService.getGroups();
        return res.groups ?? [];
    });
    useEffect(() => {
        if (groups && groups.length > 0) {
            setGroupId((groups[0] as unknown as { id: string }).id ?? '');
            setSubject((groups[0] as unknown as { subject?: string }).subject ?? '');
        }
    }, [groups]);

    const { data, loading, error, run } = useAsync(async (): Promise<Query[]> => {
        const res = await queriesService.getStudentQueries();
        console.log('[queries] Loaded', res.length, 'student queries');
        return res;
    });
    useEffect(() => { run(); }, [run]);

    const queries = (data ?? []).filter((q) => tab === 'all' || q.status === tab);

    const handleNewQuery = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !groupId) return;
        setSubmitting(true);
        try {
            await queriesService.createQuery({ group_id: groupId, subject, message });
            console.log('[queries] Query submitted to group:', groupId);
            setShowNew(false); setMessage('');
            run();
        } catch { /* inner error handled */ }
        setSubmitting(false);
    };

    if (loading && !data) return <DashboardLayout><PageLoader text="Loading queries…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <PageHeader title="My Queries" description="Ask questions and track responses from your teachers." />

            <div className="mb-5 flex items-center justify-between gap-4">
                <TabStrip tabs={STATUS_TABS} active={tab} onChange={setTab} />
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowNew(true)}>Ask Question</Button>
            </div>

            {error && <AlertBanner variant="warning" message="Could not load queries." className="mb-4" />}

            {queries.length === 0 ? (
                <EmptyState icon={<HelpCircle className="h-7 w-7" />} title="No queries yet" description={tab === 'all' ? 'Ask your teacher a question to get started.' : `No ${tab} queries.`} />
            ) : (
                <div className="space-y-3">
                    {queries.map((q) => (
                        <div key={q.id} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                {q.subject && <Badge variant="info">{q.subject}</Badge>}
                                <Badge variant={STATUS_COLOR[q.status] ?? 'secondary'}>{q.status}</Badge>
                                <span className="ml-auto text-xs text-gray-400">{formatDate(q.created_at)}</span>
                            </div>
                            <p className="text-sm text-gray-800 dark:text-gray-200">{q.message}</p>
                            {q.reply && (
                                <div className="mt-3 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-900/20">
                                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-1">
                                        Teacher Reply
                                        {q.replied_at && <span className="ml-2 text-gray-400 font-normal">{formatDate(q.replied_at)}</span>}
                                    </p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{q.reply}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* New query modal */}
            <Modal open={showNew} onClose={() => setShowNew(false)} title="Ask a Question">
                <form onSubmit={handleNewQuery} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Group</label>
                        <select value={groupId} onChange={(e) => setGroupId(e.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                            {(groups ?? []).map((g: unknown) => {
                                const group = g as { id: string; name: string };
                                return <option key={group.id} value={group.id}>{group.name}</option>;
                            })}
                        </select>
                    </div>
                    <input placeholder="Subject (optional)" value={subject} onChange={(e) => setSubject(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                    <textarea required placeholder="Your question *" value={message} onChange={(e) => setMessage(e.target.value)} rows={5}
                        className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
                        <Button type="submit" leftIcon={<Send className="h-4 w-4" />} loading={submitting}>Submit</Button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
