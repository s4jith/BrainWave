'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, Plus, Send } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAsync } from '@/hooks/useAsync';
import { useAuthStore } from '@/stores/authStore';
import { suggestionsService } from '@/services/suggestions.service';
import { formatDate } from '@/utils/formatters';
import type { Suggestion } from '@/types';

const CATEGORIES = ['General', 'Curriculum', 'Content', 'Technical', 'Other'];

const STATUS_COLORS: Record<string, 'secondary' | 'warning' | 'success' | 'destructive'> = {
    pending: 'warning',
    reviewed: 'secondary',
    implemented: 'success',
    rejected: 'destructive',
};

// ── Suggestions page – let students submit feedback to teachers/admins ────────
export default function StudentSuggestionsPage() {
    const user = useAuthStore((s) => s.user);
    const [showForm, setShowForm] = useState(false);
    const [category, setCategory] = useState('General');
    const [content, setContent] = useState('');
    const [subject, setSubject] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const { data, loading, error, run } = useAsync(async () => {
        if (!user?.id) return [] as Suggestion[];
        const res = await suggestionsService.getStudentSuggestions(user.id);
        console.log('[suggestions] Loaded', res.length, 'suggestions');
        return res;
    });
    useEffect(() => { run(); }, [run, user?.id]);

    const suggestions = data ?? [];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;
        setSubmitting(true);
        try {
            await suggestionsService.create({
                student_id: user!.id,
                student_name: user!.name,
                class_level: (user as unknown as { class_level?: number })?.class_level ?? 6,
                category, content, subject: subject || undefined,
                email: user?.email,
            });
            console.log('[suggestions] Submitted feedback in category:', category);
            setShowForm(false); setContent(''); setSubject('');
            run();
        } catch { /* shown via inline error */ }
        setSubmitting(false);
    };

    if (loading && !data) return <DashboardLayout><PageLoader text="Loading suggestions…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            {/* Header */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Feedback & Suggestions</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Share your thoughts and ideas with us.</p>
                </div>
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowForm(true)}>New Suggestion</Button>
            </div>

            {error && <AlertBanner variant="warning" message="Could not load your suggestions." className="mb-5" />}

            {suggestions.length === 0 ? (
                <EmptyState icon={<MessageCircle className="h-7 w-7" />} title="No suggestions yet" description="Share your first idea or feedback to help improve the platform." />
            ) : (
                <div className="space-y-4">
                    {suggestions.map((s) => (
                        <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                <Badge variant="info">{s.category}</Badge>
                                {s.subject && <Badge variant="secondary">{s.subject}</Badge>}
                                <Badge variant={STATUS_COLORS[s.status] ?? 'secondary'}>{s.status}</Badge>
                                <span className="ml-auto text-xs text-gray-400">{formatDate(s.created_at)}</span>
                            </div>
                            <p className="text-sm text-gray-800 dark:text-gray-200">{s.content}</p>
                            {s.response && (
                                <div className="mt-3 rounded-lg bg-indigo-50 p-3 dark:bg-indigo-900/20">
                                    <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">Admin Response:</p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{s.response}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Submit suggestion modal */}
            <Modal open={showForm} onClose={() => setShowForm(false)} title="Share Suggestion">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                        <select value={category} onChange={(e) => setCategory(e.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                        </select>
                    </div>
                    <input
                        placeholder="Subject (optional)"
                        value={subject} onChange={(e) => setSubject(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                    <textarea
                        placeholder="Your suggestion or feedback *"
                        value={content} onChange={(e) => setContent(e.target.value)} required rows={5}
                        className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                        <Button type="submit" leftIcon={<Send className="h-4 w-4" />} loading={submitting}>Submit</Button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
