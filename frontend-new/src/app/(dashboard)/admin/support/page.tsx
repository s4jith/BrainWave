'use client';

import { useEffect, useState, useCallback } from 'react';
import { Headphones, ChevronDown, ChevronUp } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader, TableLoader } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TabStrip } from '@/components/ui/TabStrip';
import { Pagination } from '@/components/ui/Pagination';
import { useAsync } from '@/hooks/useAsync';
import { usePagination } from '@/hooks/usePagination';
import { supportTicketsService } from '@/services/supportTickets.service';
import { formatDate } from '@/utils/formatters';
import type { SupportTicket } from '@/types';

const STATUS_TABS = [
    { key: 'open', label: 'Open' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'all', label: 'All' },
];

const PRI_COLOR: Record<string, 'secondary' | 'warning' | 'destructive'> = { low: 'secondary', medium: 'warning', high: 'destructive' };
const STATUS_COLOR: Record<string, 'warning' | 'secondary' | 'success' | 'destructive'> = { open: 'warning', in_progress: 'secondary', resolved: 'success', closed: 'destructive' };

// ── Admin Support – view and manage all support tickets ───────────────────────
export default function AdminSupportPage() {
    const [tab, setTab] = useState('open');
    const pagination = usePagination(20);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const load = useCallback(async (): Promise<SupportTicket[]> => {
        const res = await supportTicketsService.getTickets({
            status: tab === 'all' ? undefined : tab,
            is_admin: true,
            limit: pagination.pageSize, skip: pagination.offset,
        });
        console.log('[admin-support] Loaded', res.length, 'tickets');
        return res;
    }, [tab, pagination.page]);

    const { data, loading, error, run } = useAsync(load);
    useEffect(() => { run(); }, [run]);
    useEffect(() => { pagination.reset(); }, [tab]);

    const tickets = data ?? [];

    const handleResolve = async (ticketId: string) => {
        await supportTicketsService.resolveTicket(ticketId);
        console.log('[admin-support] Ticket resolved:', ticketId);
        run();
    };

    if (loading && !data && pagination.page === 1) return <DashboardLayout><PageLoader text="Loading tickets…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <PageHeader title="Support Tickets" description="All support requests from students and teachers." />

            {error && <AlertBanner variant="warning" message="Could not load tickets." className="mb-5" />}

            <TabStrip tabs={STATUS_TABS} active={tab} onChange={setTab} className="mb-5" />

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                {loading ? <div className="p-5"><TableLoader rows={6} /></div>
                    : tickets.length === 0 ? <EmptyState icon={<Headphones className="h-7 w-7" />} title="No tickets" description={`No ${tab === 'all' ? '' : tab} tickets.`} />
                        : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                {tickets.map((t) => (
                                    <div key={t.id}>
                                        <button
                                            onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                                            className="flex w-full items-center justify-between p-5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/20"
                                        >
                                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                                                <span className="font-medium text-gray-900 dark:text-white truncate">{t.title}</span>
                                                <Badge variant={STATUS_COLOR[t.status] ?? 'secondary'}>{t.status.replace('_', ' ')}</Badge>
                                                <Badge variant={PRI_COLOR[t.priority] ?? 'secondary'}>{t.priority}</Badge>
                                                {t.user_name && <span className="text-xs text-gray-400">{t.user_name}</span>}
                                            </div>
                                            <div className="ml-2 flex items-center gap-2 flex-shrink-0">
                                                <span className="hidden text-xs text-gray-400 sm:block">{formatDate(t.created_at)}</span>
                                                {expandedId === t.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                                            </div>
                                        </button>
                                        {expandedId === t.id && (
                                            <div className="border-t border-gray-100 px-5 pb-5 dark:border-gray-700">
                                                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{t.description}</p>
                                                {t.status !== 'resolved' && t.status !== 'closed' && (
                                                    <Button size="sm" variant="outline" className="mt-3" onClick={() => handleResolve(t.id)}>Mark Resolved</Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.pageSize} onPageChange={pagination.setPage} />
            </div>
        </DashboardLayout>
    );
}
