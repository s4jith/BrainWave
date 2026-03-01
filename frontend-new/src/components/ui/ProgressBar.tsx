import { cn } from '../../lib/utils';

interface ProgressBarProps {
    value: number;       // 0–100
    max?: number;        // defaults to 100
    size?: 'sm' | 'md' | 'lg';
    /** Color automatically based on value, or override */
    color?: 'auto' | 'indigo' | 'emerald' | 'amber' | 'red';
    showLabel?: boolean;
    className?: string;
}

const heights = { sm: 'h-1', md: 'h-1.5', lg: 'h-2.5' };

const colorClass = (color: ProgressBarProps['color'], pct: number) => {
    if (color && color !== 'auto') {
        return {
            indigo: 'bg-indigo-500',
            emerald: 'bg-emerald-500',
            amber: 'bg-amber-500',
            red: 'bg-red-500',
        }[color];
    }
    if (pct >= 70) return 'bg-emerald-500';
    if (pct >= 40) return 'bg-amber-500';
    return 'bg-red-500';
};

export function ProgressBar({ value, max = 100, size = 'md', color = 'auto', showLabel, className }: ProgressBarProps) {
    const pct = Math.min(100, Math.max(0, (value / max) * 100));
    const fill = colorClass(color, pct);
    return (
        <div className={cn('flex items-center gap-2', className)}>
            <div className={cn('flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700', heights[size])}>
                <div
                    className={cn('h-full rounded-full transition-all duration-500', fill)}
                    style={{ width: `${pct}%` }}
                    role="progressbar"
                    aria-valuenow={value}
                    aria-valuemax={max}
                />
            </div>
            {showLabel && (
                <span className="w-8 flex-shrink-0 text-right text-xs font-medium text-gray-600 dark:text-gray-400">
                    {Math.round(pct)}%
                </span>
            )}
        </div>
    );
}
