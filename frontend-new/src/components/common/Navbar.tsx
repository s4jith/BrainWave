// @ts-nocheck
'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Bell, Sun, Moon, Monitor, Bookmark, Trash2, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores/uiStore';
import { notificationsService } from '../../services/notifications.service';
import type { Notification } from '../../types';
import { formatRelativeTime } from '../../utils/formatters';

interface NavbarProps {
    title: string;
    icon?: ReactNode;
}

export function Navbar({ title, icon }: NavbarProps) {
    const { theme, setTheme } = useUIStore();
    const [showTheme, setShowTheme] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const themeRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (themeRef.current && !themeRef.current.contains(e.target as Node)) setShowTheme(false);
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        notificationsService.getNotifications(20).then((res) => {
            setNotifications(res.notifications ?? []);
            setUnreadCount(res.unread_count ?? 0);
        }).catch(() => null);
    }, []);

    const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

    const handleMarkRead = async (id: string) => {
        await notificationsService.markRead(id);
        setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount((c) => Math.max(0, c - 1));
    };

    const handleSave = async (id: string, saved: boolean) => {
        if (saved) {
            await notificationsService.unsaveNotification(id);
        } else {
            await notificationsService.saveNotification(id);
        }
        setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_saved: !saved } : n));
    };

    const handleDelete = async (id: string) => {
        await notificationsService.deleteNotification(id);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    };

    const handleMarkAllRead = async () => {
        await notificationsService.markAllRead();
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
    };

    return (
        <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-2">
                {icon && <span className="text-gray-400 dark:text-gray-500">{icon}</span>}
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h1>
            </div>

            <div className="flex items-center gap-2">
                {/* Theme switcher */}
                <div className="relative" ref={themeRef}>
                    <button
                        onClick={() => setShowTheme((v) => !v)}
                        className="rounded-lg p-2.5 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                        title="Toggle theme"
                    >
                        <ThemeIcon className="h-5 w-5" />
                    </button>
                    {showTheme && (
                        <div className="absolute right-0 top-full z-50 mt-2 w-36 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                            {(['light', 'dark', 'system'] as const).map((t) => {
                                const Icon = t === 'dark' ? Moon : t === 'light' ? Sun : Monitor;
                                return (
                                    <button
                                        key={t}
                                        onClick={() => { setTheme(t); setShowTheme(false); }}
                                        className={cn(
                                            'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors capitalize',
                                            theme === t
                                                ? 'bg-gray-100 font-medium text-gray-900 dark:bg-gray-700 dark:text-white'
                                                : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/50'
                                        )}
                                    >
                                        <Icon className="h-4 w-4" /> {t}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Notifications */}
                <div className="relative" ref={notifRef}>
                    <button
                        onClick={() => setShowNotifications((v) => !v)}
                        className="relative rounded-lg p-2.5 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                    >
                        <Bell className="h-5 w-5" />
                        {unreadCount > 0 && (
                            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {showNotifications && (
                        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
                            <div className="flex items-center justify-between border-b border-gray-100 p-3 dark:border-gray-700">
                                <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={handleMarkAllRead}
                                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                                    >
                                        Mark all read
                                    </button>
                                )}
                            </div>
                            <div className="max-h-72 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">No notifications</p>
                                ) : (
                                    notifications.slice(0, 10).map((n) => (
                                        <div
                                            key={n.id}
                                            className={cn(
                                                'border-b border-gray-100 p-3 last:border-0 dark:border-gray-700',
                                                !n.is_read && 'bg-blue-50 dark:bg-blue-900/20'
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <p className={cn('truncate text-sm font-medium', !n.is_read ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300')}>
                                                            {n.title}
                                                        </p>
                                                        {n.is_saved && <Bookmark className="h-3 w-3 flex-shrink-0 fill-yellow-500 text-yellow-500" />}
                                                    </div>
                                                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{n.message}</p>
                                                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{formatRelativeTime(n.created_at)}</p>
                                                </div>
                                                <div className="flex flex-shrink-0 items-center gap-0.5">
                                                    {!n.is_read && (
                                                        <button onClick={() => handleMarkRead(n.id)} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700" title="Mark read">
                                                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleSave(n.id, !!n.is_saved)}
                                                        className={cn('rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700', n.is_saved ? 'text-yellow-500' : 'text-gray-400')}
                                                    >
                                                        <Bookmark className={cn('h-3.5 w-3.5', n.is_saved && 'fill-yellow-500')} />
                                                    </button>
                                                    <button onClick={() => handleDelete(n.id)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-700">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
