'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, StickyNote, Trash2, Search } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useAsync } from '@/hooks/useAsync';
import { useAuthStore } from '@/stores/authStore';
import apiClient from '@/lib/axios';
import { formatDate } from '@/utils/formatters';
import type { SmartNote } from '@/types';

// ── Notes page – create and view AI-powered smart notes ──────────────────────
export default function StudentNotesPage() {
    const user = useAuthStore((s) => s.user);
    const [showCreate, setShowCreate] = useState(false);
    const [subject, setSubject] = useState('');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [creating, setCreating] = useState(false);
    const [searchQ, setSearchQ] = useState('');

    const loadNotes = useCallback(async (): Promise<SmartNote[]> => {
        const { data } = await apiClient.get<SmartNote[]>('/api/notes/my-notes');
        console.log('[notes] Loaded', data.length, 'notes');
        return data;
    }, []);

    const { data, loading, error, run } = useAsync(loadNotes);
    useEffect(() => { run(); }, [run]);

    const notes = (data ?? []).filter((n) =>
        !searchQ || n.title.toLowerCase().includes(searchQ.toLowerCase()) || n.content.toLowerCase().includes(searchQ.toLowerCase())
    );

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !content) return;
        setCreating(true);
        try {
            await apiClient.post('/api/notes/create', {
                title, content, subject,
                class_level: (user as unknown as { class_level?: number })?.class_level ?? 6,
                user_id: user?.id,
            });
            console.log('[notes] Created note:', title);
            setShowCreate(false); setTitle(''); setContent(''); setSubject('');
            run();
        } catch { /* error shown via AlertBanner */ }
        setCreating(false);
    };

    const handleDelete = async (noteId: string) => {
        await apiClient.delete(`/api/notes/${noteId}`);
        console.log('[notes] Deleted note:', noteId);
        run();
    };

    if (loading && !data) return <DashboardLayout><PageLoader text="Loading notes…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            {/* Header */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Notes</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{notes.length} note{notes.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
                            placeholder="Search notes…"
                            className="h-10 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                    </div>
                    <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>New Note</Button>
                </div>
            </div>

            {error && <AlertBanner variant="warning" message="Could not load notes." className="mb-5" />}

            {/* Notes grid */}
            {notes.length === 0 ? (
                <EmptyState icon={<StickyNote className="h-7 w-7" />} title="No notes yet" description="Create your first note to get started." />
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {notes.map((note) => (
                        <div key={note.id} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                            <div className="mb-2 flex items-start justify-between gap-2">
                                <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1">{note.title}</h3>
                                <button onClick={() => handleDelete(note.id)} className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="mb-3 flex flex-wrap gap-1.5">
                                {note.subject && <Badge variant="info">{note.subject}</Badge>}
                                {note.class_level && <Badge variant="secondary">Class {note.class_level}</Badge>}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">{note.content}</p>
                            <p className="mt-3 text-xs text-gray-400">{formatDate(note.created_at)}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Create note modal */}
            <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Note">
                <form onSubmit={handleCreate} className="space-y-4">
                    <input
                        placeholder="Subject (optional)"
                        value={subject} onChange={(e) => setSubject(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                    <input
                        placeholder="Title *"
                        value={title} onChange={(e) => setTitle(e.target.value)} required
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                    <textarea
                        placeholder="Note content *"
                        value={content} onChange={(e) => setContent(e.target.value)} required rows={6}
                        className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                        <Button type="submit" loading={creating}>Save Note</Button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
