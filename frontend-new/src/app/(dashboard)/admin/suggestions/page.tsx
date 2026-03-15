'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, CheckCircle, Clock, Trash2, Reply, Search, RefreshCw } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SearchBar } from '@/components/ui/SearchBar';
import { useAsync } from '@/hooks/useAsync';
import { useSearch } from '@/hooks/useSearch';
import { suggestionsService } from '@/services/suggestions.service';
import { formatDate } from '@/utils/formatters';
import type { Suggestion } from '@/types';

const STATUS_COLOR: Record<string, 'secondary' | 'warning' | 'success' | 'destructive'> = {
    pending: 'warning', reviewed: 'secondary', implemented: 'success', rejected: 'destructive',
};

export default function AdminSuggestionsPage() {
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterCategory, setFilterCategory] = useState('all');
    const { query: searchTerm, debouncedQuery, setQuery: setSearchTerm } = useSearch();

    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [processingId, setProcessingId] = useState<string | null>(null);

    const { data: suggestions, loading, error, run: fetchSuggestions } = useAsync(async (): Promise<Suggestion[]> => {
        const res = await suggestionsService.getAllSuggestions(
            filterStatus !== 'all' ? filterStatus : undefined,
            filterCategory !== 'all' ? filterCategory : undefined
        );
        return res;
    });

    useEffect(() => {
        fetchSuggestions();
    }, [fetchSuggestions, filterStatus, filterCategory]);

    const handleReply = async (suggestionId: string, status: string = 'reviewed') => {
        if (!replyText.trim()) return;
        setProcessingId(suggestionId);
        try {
            await suggestionsService.respondToSuggestion(suggestionId, replyText, status);
            setReplyingTo(null);
            setReplyText('');
            fetchSuggestions();
        } finally {
            setProcessingId(null);
        }
    };

    const handleDelete = async (suggestionId: string) => {
        if (!window.confirm("Are you sure you want to delete this suggestion?")) return;
        setProcessingId(suggestionId);
        try {
            await suggestionsService.deleteSuggestion(suggestionId);
            fetchSuggestions();
        } finally {
            setProcessingId(null);
        }
    };

    const filteredSuggestions = (suggestions ?? []).filter(s =>
        s.content.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        s.student_name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        (s.subject ?? '').toLowerCase().includes(debouncedQuery.toLowerCase())
    );

    const pendingCount = (suggestions ?? []).filter(s => s.status === 'pending').length;
    const totalCount = (suggestions ?? []).length;
    const reviewedCount = totalCount - pendingCount;

    if (loading && !suggestions) return <DashboardLayout><PageLoader text="Loading suggestions…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <PageHeader title="Student Suggestions" description="Review and respond to feedback" />
                <Button onClick={() => fetchSuggestions()} variant="outline" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </Button>
            </div>

            {error && <AlertBanner variant="warning" message="Could not load suggestions." className="mb-5" />}

            {/* Stats Block */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                    <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">Total Suggestions</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalCount}</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-4 dark:bg-amber-900/20">
                    <p className="mb-1 text-sm text-amber-700 dark:text-amber-400">Pending Review</p>
                    <p className="text-2xl font-bold text-amber-800 dark:text-amber-500">{pendingCount}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-900/20">
                    <p className="mb-1 text-sm text-emerald-700 dark:text-emerald-400">Reviewed</p>
                    <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-500">{reviewedCount}</p>
                </div>
            </div>

            {/* Filters and Search */}
            <div className="mb-6 grid grid-cols-1 gap-4 rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 md:grid-cols-2">
                <SearchBar
                    value={searchTerm}
                    onValueChange={setSearchTerm}
                    placeholder="Search by name, subject, or content..."
                    className="w-full"
                />
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="reviewed">Reviewed</option>
                </select>
            </div>

            {/* List */}
            {filteredSuggestions.length === 0 ? (
                <EmptyState icon={<MessageCircle className="h-7 w-7" />} title="No suggestions found" description="Try a different search term or filter." />
            ) : (
                <div className="space-y-4">
                    {filteredSuggestions.map((s) => (
                        <div key={s.id} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                            {/* Header */}
                            <div className="mb-4 flex flex-wrap items-start justify-between gap-4 border-b border-gray-50 pb-4 dark:border-gray-700">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 font-medium text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                                        {s.student_name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 dark:text-white">{s.student_name}</h3>
                                        {s.class_level && <p className="text-sm text-gray-500 dark:text-gray-400">Class {s.class_level}</p>}
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {s.subject && (
                                        <Badge variant="info">{s.subject}</Badge>
                                    )}
                                    <Badge variant={STATUS_COLOR[s.status] ?? 'secondary'} className="gap-1">
                                        {s.status === 'reviewed' ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                        {s.status}
                                    </Badge>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(s.created_at)}</span>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="mb-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-700/50">
                                <p className="leading-relaxed text-gray-700 dark:text-gray-300">{s.content}</p>
                            </div>

                            {/* Response */}
                            {(s.response || s.admin_response) && (
                                <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/30 dark:bg-emerald-900/10">
                                    <p className="mb-2 text-sm font-medium text-emerald-800 dark:text-emerald-400">Your Response:</p>
                                    <p className="text-emerald-700 dark:text-emerald-300">{s.response ?? s.admin_response}</p>
                                </div>
                            )}

                            {/* Reply Input */}
                            {replyingTo === s.id && (
                                <div className="mb-4 space-y-3">
                                    <textarea
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        placeholder="Type your response..."
                                        rows={3}
                                        className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                    />
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={() => handleReply(s.id)}
                                            loading={processingId === s.id}
                                            disabled={!replyText.trim()}
                                            className="bg-indigo-600 text-white hover:bg-indigo-700"
                                        >
                                            Send Reply
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setReplyingTo(null);
                                                setReplyText('');
                                            }}
                                            disabled={processingId === s.id}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                                {!(s.response || s.admin_response) && replyingTo !== s.id && (
                                    <Button
                                        size="sm"
                                        onClick={() => setReplyingTo(s.id)}
                                        className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                                    >
                                        <Reply className="h-4 w-4" />
                                        Reply
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDelete(s.id)}
                                    loading={processingId === s.id}
                                    className="gap-2 border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-900/20"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </DashboardLayout>
    );
}
