'use client';

import { cn } from '../../lib/utils';

interface Tab {
    key: string;
    label: string;
    icon?: React.ReactNode;
    badge?: number | string;
}

interface TabStripProps {
    tabs: Tab[];
    active: string;
    onChange: (key: string) => void;
    /** 'underline' = border-bottom style (default), 'pill' = filled rounded button */
    variant?: 'underline' | 'pill';
    className?: string;
}

export function TabStrip({ tabs, active, onChange, variant = 'underline', className }: TabStripProps) {
    if (variant === 'pill') {
        return (
            <div className={cn('flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white p-1.5 dark:border-gray-700 dark:bg-gray-800', className)}>
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => onChange(tab.key)}
                        className={cn(
                            'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                            active === tab.key
                                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        )}
                    >
                        {tab.icon}
                        {tab.label}
                        {tab.badge !== undefined && (
                            <span className={cn(
                                'rounded-full px-1.5 py-0.5 text-xs font-semibold',
                                active === tab.key ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'
                            )}>
                                {tab.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>
        );
    }

    // underline variant
    return (
        <div className={cn('flex gap-1 border-b border-gray-200 dark:border-gray-700', className)}>
            {tabs.map((tab) => (
                <button
                    key={tab.key}
                    onClick={() => onChange(tab.key)}
                    className={cn(
                        'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px',
                        active === tab.key
                            ? 'border-gray-900 text-gray-900 dark:border-white dark:text-white'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    )}
                >
                    {tab.icon}
                    {tab.label}
                    {tab.badge !== undefined && (
                        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            {tab.badge}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
}
