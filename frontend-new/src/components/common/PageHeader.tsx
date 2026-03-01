// @ts-nocheck
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
    title: string;
    description?: string;
    icon?: ReactNode;
    actions?: ReactNode;
    className?: string;
}

export function PageHeader({ title, description, icon, actions, className }: PageHeaderProps) {
    return (
        <div className={cn('flex items-center justify-between', className)}>
            <div className="flex items-center gap-3">
                {icon && (
                    <div className="rounded-lg bg-gray-100 p-2 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {icon}
                    </div>
                )}
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
                    {description && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
                </div>
            </div>
            {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>
    );
}
