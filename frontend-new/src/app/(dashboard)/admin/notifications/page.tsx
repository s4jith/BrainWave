'use client';

import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Trash2, BookmarkPlus, Bookmark } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { useAsync } from '@/hooks/useAsync';
import { notificationsService } from '@/services/notifications.service';
import { formatDate } from '@/utils/formatters';
import type { Notification, NotificationsResponse } from '@/types/api.types';

// ── Admin Notifications – view, mark read, save, and delete notifications ─────
export default function AdminNotificationsPage() {
    const [markingAll, setMarkingAll] = useState(false);

    const { data, loading, error, run } = useAsync<Notification[]>(async () => {
        const res = await notificationsService.getNotifications(50);
        console.log('[notifications] Loaded', res.notifications?.length ?? 0, 'notifications');
        return res.notifications ?? [];
    });
    useEffect(() => { run(); }, [run]);

    const notifications = data ?? [];
    const unreadCount = notifications.filter((n) => !n.is_read).length;

    const handleMarkAll = async () => {
        setMarkingAll(true);
        await notificationsService.markAllRead();
        console.log('[notifications] Marked all as read');
        run();
        setMarkingAll(false);
    };

    const handleMarkRead = async (id: string) => {
        await notificationsService.markRead(id);
        run();
    };

    const handleDelete = async (id: string) => {
        await notificationsService.deleteNotification(id);
        run();
    };

    const handleSaveToggle = async (n: Notification) => {
        if (n.is_saved) await notificationsService.unsaveNotification(n.id);
        else await notificationsService.saveNotification(n.id);
        run();
    };

    if (loading && !data) return <DashboardLayout><PageLoader text="Loading notifications…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <PageHeader title="Notifications" description={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}.`} />

            {error && <AlertBanner variant="warning" message="Could not load notifications." className="mb-5" />}

            <div className="mb-5 flex justify-end">
                {unreadCount > 0 && (
                    <Button variant="outline" size="sm" leftIcon={<CheckCheck className="h-4 w-4" />} loading={markingAll} onClick={handleMarkAll}>
                        Mark All Read
                    </Button>
                )}
            </div>

            {notifications.length === 0 ? (
                <EmptyState icon={<Bell className="h-7 w-7" />} title="No notifications" description="You're all caught up!" />
            ) : (
                <div className="space-y-2">
                    {notifications.map((n) => (
                        <div key={n.id} className={`flex items-start gap-4 rounded-xl border p-4 transition-colors ${n.is_read ? 'border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800' : 'border-indigo-100 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-900/10'}`}>
                            <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${n.is_read ? 'bg-gray-100 dark:bg-gray-700' : 'bg-indigo-100 dark:bg-indigo-900/40'}`}>
                                <Bell className={`h-4 w-4 ${n.is_read ? 'text-gray-400' : 'text-indigo-600 dark:text-indigo-400'}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className={`text-sm font-medium ${n.is_read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>{n.message ?? n.title}</p>
                                <p className="mt-0.5 text-xs text-gray-400">{formatDate(n.created_at)}</p>
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-1">
                                <button onClick={() => handleSaveToggle(n)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-indigo-500 dark:hover:bg-gray-700" title="Save">
                                    {n.is_saved ? <Bookmark className="h-4 w-4 fill-current text-indigo-500" /> : <BookmarkPlus className="h-4 w-4" />}
                                </button>
                                {!n.is_read && (
                                    <button onClick={() => handleMarkRead(n.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-green-500 dark:hover:bg-gray-700" title="Mark read">
                                        <CheckCheck className="h-4 w-4" />
                                    </button>
                                )}
                                <button onClick={() => handleDelete(n.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20" title="Delete">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </DashboardLayout>
    );
}
