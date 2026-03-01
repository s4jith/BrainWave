import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
    return (
        <div className={cn('flex flex-col items-center justify-center py-14 text-center', className)}>
            {icon && (
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600">
                    {icon}
                </div>
            )}
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</p>
            {description && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{description}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
