'use client';

import { useEffect, useState, useRef } from 'react';
import { BookOpen, Plus, Trash2, Cpu } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader, TableLoader } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAsync } from '@/hooks/useAsync';
import { bookService } from '@/services/book.service';
import { formatDate, formatFileSize } from '@/utils/formatters';
import type { BookResponse } from '@/types';

// ── Admin Books – upload NCERT books (PDFs) and manage AI embeddings ──────────
export default function AdminBooksPage() {
    const [showUpload, setShowUpload] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);
    const [subject, setSubject] = useState('');
    const [classLevel, setClassLevel] = useState(6);
    const [generatingId, setGeneratingId] = useState<string | null>(null);

    const { data, loading, error, run } = useAsync(async () => {
        const res = await bookService.listAllBooks();
        console.log('[admin-books] Loaded', res.total, 'books');
        return res.books;
    });
    useEffect(() => { run(); }, [run]);

    const books = data ?? [];

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        const file = fileRef.current?.files?.[0];
        if (!file || !subject) { setUploadError('Please select a file and enter a subject.'); return; }
        setUploading(true); setUploadError('');
        const form = new FormData();
        form.append('file', file);
        form.append('subject', subject);
        form.append('class_level', String(classLevel));
        try {
            await bookService.uploadBook(form);
            console.log('[admin-books] Book uploaded:', file.name);
            setShowUpload(false); setSubject(''); setClassLevel(6);
            run();
        } catch { setUploadError('Upload failed. Check the file and try again.'); }
        setUploading(false);
    };

    const handleDelete = async (bookId: string) => {
        if (!confirm('Delete this book and its AI embeddings?')) return;
        await bookService.deleteBook(bookId);
        console.log('[admin-books] Book deleted:', bookId);
        run();
    };

    const handleGenerateEmbeddings = async (bookId: string) => {
        setGeneratingId(bookId);
        try {
            await bookService.generateEmbeddings(bookId);
            console.log('[admin-books] Embeddings generated for book:', bookId);
            run();
        } finally { setGeneratingId(null); }
    };

    if (loading && !data) return <DashboardLayout><PageLoader text="Loading books…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <PageHeader title="Books" description="Upload NCERT books and manage AI embeddings for ChatBot." />

            {error && <AlertBanner variant="warning" message="Could not load books." className="mb-5" />}

            <div className="mb-5 flex justify-end">
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowUpload(true)}>Upload Book</Button>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                {loading ? <div className="p-5"><TableLoader rows={5} /></div>
                    : books.length === 0 ? <EmptyState icon={<BookOpen className="h-7 w-7" />} title="No books uploaded" description="Upload NCERT textbooks to enable the AI chat feature." />
                        : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                                        <tr>
                                            {['Title', 'Subject', 'Class', 'Embeddings', 'Size', 'Uploaded', 'Actions'].map((h) => (
                                                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {books.map((b) => (
                                            <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-xs truncate">{b.title ?? b.filename}</td>
                                                <td className="px-4 py-3"><Badge variant="info">{b.subject}</Badge></td>
                                                <td className="px-4 py-3"><Badge variant="secondary">Class {b.class_level}</Badge></td>
                                                <td className="px-4 py-3">
                                                    <Badge variant={b.has_embeddings ? 'success' : 'warning'}>{b.has_embeddings ? 'Ready' : 'Missing'}</Badge>
                                                </td>
                                                <td className="px-4 py-3 text-gray-500 text-xs">{b.file_size ? formatFileSize(b.file_size) : '—'}</td>
                                                <td className="px-4 py-3 text-xs text-gray-500">{formatDate(b.uploaded_at ?? b.created_at)}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1.5">
                                                        {!b.has_embeddings && (
                                                            <Button size="sm" variant="ghost" loading={generatingId === b.id} leftIcon={<Cpu className="h-3.5 w-3.5" />} onClick={() => handleGenerateEmbeddings(b.id)}>AI</Button>
                                                        )}
                                                        <button onClick={() => handleDelete(b.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20">
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
            </div>

            {/* Upload modal */}
            <Modal open={showUpload} onClose={() => setShowUpload(false)} title="Upload Book">
                <form onSubmit={handleUpload} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">PDF File *</label>
                        <input type="file" accept=".pdf" ref={fileRef} required className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                    </div>
                    <input required placeholder="Subject (e.g. Mathematics) *" value={subject} onChange={(e) => setSubject(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Class Level *</label>
                        <input type="number" min={1} max={12} value={classLevel} onChange={(e) => setClassLevel(Number(e.target.value))}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                    </div>
                    {uploadError && <AlertBanner variant="error" message={uploadError} />}
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
                        <Button type="submit" loading={uploading}>Upload</Button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
