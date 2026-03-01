import { cn } from '../../lib/utils';

type SpinnerSize = 'sm' | 'md' | 'lg';
type SpinnerColor = 'default' | 'indigo' | 'emerald' | 'orange' | 'white';

interface SpinnerProps {
    size?: SpinnerSize;
    color?: SpinnerColor;
    text?: string;
    className?: string;
}

const ringSize: Record<SpinnerSize, string> = {
    sm: 'h-5 w-5 border-2',
    md: 'h-9 w-9 border-[3px]',
    lg: 'h-14 w-14 border-4',
};

const arcColor: Record<SpinnerColor, string> = {
    default: 'border-t-gray-900 border-r-gray-700 dark:border-t-white dark:border-r-gray-300',
    indigo: 'border-t-indigo-500 border-r-indigo-400',
    emerald: 'border-t-emerald-500 border-r-emerald-400',
    orange: 'border-t-orange-500 border-r-orange-400',
    white: 'border-t-white border-r-gray-300',
};

export function Spinner({ size = 'md', color = 'default', text, className }: SpinnerProps) {
    return (
        <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
            <div className="relative">
                <div className={cn(ringSize[size], 'rounded-full border-gray-200 dark:border-gray-700')} />
                <div
                    className={cn(ringSize[size], 'absolute inset-0 rounded-full border-transparent animate-spin', arcColor[color])}
                    style={{ animationDuration: '0.75s' }}
                />
            </div>
            {text && (
                <p className="animate-pulse text-sm font-medium tracking-wide text-gray-400 dark:text-gray-500">
                    {text}
                </p>
            )}
        </div>
    );
}

export function PageLoader({ text = 'Loading…' }: { text?: string }) {
    return (
        <div className="flex min-h-[300px] items-center justify-center">
            <Spinner size="lg" text={text} />
        </div>
    );
}

export function CardLoader({ rows = 4, className }: { rows?: number; className?: string }) {
    return (
        <div className={cn('rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800', className)}>
            <div className="mb-5 flex items-center gap-3">
                <div className="h-9 w-9 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/5 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-2.5 w-1/3 animate-pulse rounded bg-gray-100 dark:bg-gray-600" />
                </div>
            </div>
            <div className="space-y-3">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="space-y-2">
                        <div className="h-3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" style={{ width: `${75 + (i % 3) * 8}%` }} />
                        {i % 2 === 0 && <div className="h-2.5 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-gray-600" />}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function SkeletonRow({ className }: { className?: string }) {
    return (
        <div className={cn('rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800', className)}>
            <div className="flex items-center gap-3">
                <div className="h-8 w-8 flex-shrink-0 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/5 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-2.5 w-2/5 animate-pulse rounded bg-gray-100 dark:bg-gray-600" />
                </div>
                <div className="h-6 w-16 animate-pulse rounded-full bg-gray-100 dark:bg-gray-700" />
            </div>
        </div>
    );
}

export function TableLoader({ rows = 5 }: { rows?: number }) {
    return (
        <div className="space-y-2 py-2">
            {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
    );
}

export function StatsSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className={`grid grid-cols-${count} gap-4 mb-6`}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                    <div className="mb-2 h-6 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-gray-600" />
                </div>
            ))}
        </div>
    );
}
