import { CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Spinner } from './Spinner';

interface ApproveRejectProps {
    onApprove: () => void;
    onReject: () => void;
    loading?: boolean;
    /** If set, only that action button shows a spinner */
    loadingAction?: 'approve' | 'reject' | null;
    approveLabel?: string;
    rejectLabel?: string;
    /** 'icon' = circular icon buttons (compact), 'text' = text buttons */
    variant?: 'icon' | 'text';
    className?: string;
    disabled?: boolean;
}

export function ApproveRejectButtons({
    onApprove,
    onReject,
    loading,
    loadingAction,
    approveLabel = 'Approve',
    rejectLabel = 'Reject',
    variant = 'icon',
    className,
    disabled,
}: ApproveRejectProps) {
    const isApproving = loading || loadingAction === 'approve';
    const isRejecting = loading || loadingAction === 'reject';

    if (variant === 'text') {
        return (
            <div className={cn('flex items-center gap-2', className)}>
                <button
                    onClick={onApprove}
                    disabled={disabled || isApproving}
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40"
                >
                    {isApproving ? <Spinner size="sm" color="emerald" /> : <CheckCircle className="h-3.5 w-3.5" />}
                    {approveLabel}
                </button>
                <button
                    onClick={onReject}
                    disabled={disabled || isRejecting}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
                >
                    {isRejecting ? <Spinner size="sm" color="orange" /> : <XCircle className="h-3.5 w-3.5" />}
                    {rejectLabel}
                </button>
            </div>
        );
    }

    // icon variant
    return (
        <div className={cn('flex items-center gap-1.5', className)}>
            <button
                onClick={onApprove}
                disabled={disabled || isApproving}
                title={approveLabel}
                className="rounded-lg bg-emerald-50 p-2 text-emerald-600 transition hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40"
            >
                {isApproving ? <Spinner size="sm" color="emerald" /> : <CheckCircle className="h-5 w-5" />}
            </button>
            <button
                onClick={onReject}
                disabled={disabled || isRejecting}
                title={rejectLabel}
                className="rounded-lg bg-red-50 p-2 text-red-600 transition hover:bg-red-100 disabled:opacity-50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
            >
                {isRejecting ? <Spinner size="sm" color="orange" /> : <XCircle className="h-5 w-5" />}
            </button>
        </div>
    );
}
