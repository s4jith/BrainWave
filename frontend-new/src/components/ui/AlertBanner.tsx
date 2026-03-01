'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

type AlertVariant = 'success' | 'error' | 'warning' | 'info';

const styles: Record<AlertVariant, string> = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-300',
    error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-300',
    info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300',
};

const icons: Record<AlertVariant, React.FC<{ className?: string }>> = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
};

interface AlertBannerProps {
    variant: AlertVariant;
    message: string | null | undefined;
    onClose?: () => void;
    /** Auto-dismiss after N ms. 0 = never */
    autoDismiss?: number;
    className?: string;
}

export function AlertBanner({ variant, message, onClose, autoDismiss = 0, className }: AlertBannerProps) {
    useEffect(() => {
        if (!message || !autoDismiss) return;
        const t = setTimeout(() => onClose?.(), autoDismiss);
        return () => clearTimeout(t);
    }, [message, autoDismiss, onClose]);

    if (!message) return null;

    const Icon = icons[variant];
    return (
        <div
            role="alert"
            className={cn(
                'flex items-center gap-3 rounded-xl border px-4 py-3',
                styles[variant],
                className
            )}
        >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <p className="flex-1 text-sm font-medium">{message}</p>
            {onClose && (
                <button
                    onClick={onClose}
                    className="ml-auto flex-shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
                    aria-label="Dismiss"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}

/** Stack multiple banners. Pass an array of [variant, message] tuples. */
interface AlertStackProps {
    alerts: { variant: AlertVariant; message: string; id: string }[];
    onDismiss: (id: string) => void;
}

export function AlertStack({ alerts, onDismiss }: AlertStackProps) {
    if (alerts.length === 0) return null;
    return (
        <div className="space-y-2">
            {alerts.map((a) => (
                <AlertBanner key={a.id} variant={a.variant} message={a.message} onClose={() => onDismiss(a.id)} />
            ))}
        </div>
    );
}
