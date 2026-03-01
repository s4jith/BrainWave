'use client';

import { useEffect, useState } from 'react';
import { Headphones, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAsync } from '@/hooks/useAsync';
import { useAuthStore } from '@/stores/authStore';
import { supportTicketsService } from '@/services/supportTickets.service';
import { formatDate } from '@/utils/formatters';
import type { SupportTicket } from '@/types';

const CATEGORIES = ['General', 'Technical', 'Academic', 'Account', 'Other'];
const PRIORITIES = ['low', 'medium', 'high'];

const PRI_COLOR: Record<string, 'secondary' | 'warning' | 'destructive'> = {
    low: 'secondary', medium: 'warning', high: 'destructive',
};
const STATUS_COLOR: Record<string, 'warning' | 'secondary' | 'success' | 'destructive'> = {
    open: 'warning', in_progress: 'secondary', resolved: 'success', closed: 'destructive',
};

// ── Support Tickets page – create tickets and track their status ─────────────
export default function StudentSupportPage() {
    const user = useAuthStore((s) => s.user);
    const [showNew, setShowNew] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('General');
    const [priority, setPriority] = useState('medium');
    const [creating, setCreating] = useState(false);

    const { data, loading, error, run } = useAsync(async (): Promise<SupportTicket[]> => {
        if (!user?.id) return [];
        const res = await supportTicketsService.getTickets({ user_id: user.id });
        console.log('[support] Loaded', res.length, 'tickets');
        return res;
    });
    useEffect(() => { run(); }, [run, user?.id]);

    const tickets = data ?? [];

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !description) return;
        setCreating(true);
        try {
            await supportTicketsService.createTicket({ title, description, category, priority }, user!.id, user!.name);
            console.log('[support] Created ticket:', title);
            setShowNew(false); setTitle(''); setDescription(''); setCategory('General'); setPriority('medium');
            run();
        } catch { /* no-op – error handled by re-render */ }
        setCreating(false);
    };

    if (loading && !data) return <DashboardLayout><PageLoader text="Loading tickets…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <PageHeader title="Support" description="Get help from our support team." />

            <div className="mb-6 flex justify-end">
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowNew(true)}>New Ticket</Button>
            </div>

            {error && <AlertBanner variant="warning" message="Could not load support tickets." className="mb-5" />}

            {tickets.length === 0 ? (
                <EmptyState icon={<Headphones className="h-7 w-7" />} title="No tickets yet" description="Create a support ticket and our team will get back to you." />
            ) : (
                <div className="space-y-3">
                    {tickets.map((t) => (
                        <div key={t.id} className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                            <button
                                onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                                className="flex w-full items-center justify-between p-5 text-left"
                            >
                                <div className="flex flex-wrap items-center gap-2 min-w-0">
                                    <span className="font-medium text-gray-900 dark:text-white truncate">{t.title}</span>
                                    <Badge variant={STATUS_COLOR[t.status] ?? 'secondary'}>{t.status.replace('_', ' ')}</Badge>
                                    <Badge variant={PRI_COLOR[t.priority] ?? 'secondary'}>{t.priority}</Badge>
                                </div>
                                <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                                    <span className="hidden text-xs text-gray-400 sm:block">{formatDate(t.created_at)}</span>
                                    {expandedId === t.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                                </div>
                            </button>

                            {expandedId === t.id && (
                                <div className="border-t border-gray-100 px-5 pb-5 dark:border-gray-700">
                                    <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">{t.description}</p>
                                    {t.replies && t.replies.length > 0 && (
                                        <div className="mt-4 space-y-3">
                                            {t.replies.map((r, i) => (
                                                <div key={i} className="rounded-lg bg-indigo-50 p-3 dark:bg-indigo-900/20">
                                                    <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">Support Team</p>
                                                    <p className="text-sm text-gray-700 dark:text-gray-300">{r.message}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Create ticket modal */}
            <Modal open={showNew} onClose={() => setShowNew(false)} title="New Support Ticket">
                <form onSubmit={handleCreate} className="space-y-4">
                    <input required placeholder="Title *" value={title} onChange={(e) => setTitle(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                            <select value={category} onChange={(e) => setCategory(e.target.value)}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                            <select value={priority} onChange={(e) => setPriority(e.target.value)}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    </div>
                    <textarea required placeholder="Describe your issue *" value={description} onChange={(e) => setDescription(e.target.value)} rows={5}
                        className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
                        <Button type="submit" loading={creating}>Create Ticket</Button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
