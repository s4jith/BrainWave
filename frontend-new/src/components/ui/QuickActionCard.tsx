'use client';

import type { ReactNode, ElementType } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface QuickActionCardProps {
    title: string;
    description: string;
    icon: ElementType;
    iconColor?: string;      // e.g. 'bg-indigo-500'
    onClick?: () => void;
    locked?: boolean;
    lockedLabel?: string;
    className?: string;
    disabled?: boolean;
    badge?: ReactNode;
}

export function QuickActionCard({
    title,
    description,
    icon: Icon,
    iconColor = 'bg-gray-700',
    onClick,
    locked,
    lockedLabel = 'Locked by admin',
    className,
    disabled,
    badge,
}: QuickActionCardProps) {
    return (
        <button
            onClick={onClick}
            disabled={locked || disabled}
            className={cn(
                'relative flex w-full flex-col items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition-all dark:border-gray-700 dark:bg-gray-800',
                locked || disabled
                    ? 'cursor-not-allowed opacity-75'
                    : 'hover:border-indigo-300 hover:shadow-sm dark:hover:border-indigo-700',
                className
            )}
        >
            {/* Lock overlay indicator */}
            {locked && (
                <div className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-300 dark:bg-gray-600">
                    <Lock className="h-2.5 w-2.5 text-white" />
                </div>
            )}

            {/* Badge overlay (e.g. "New", count) */}
            {badge && !locked && (
                <div className="absolute right-2.5 top-2.5">{badge}</div>
            )}

            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', iconColor)}>
                <Icon className="h-5 w-5 text-white" />
            </div>

            <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {locked ? lockedLabel : description}
                </p>
            </div>
        </button>
    );
}
