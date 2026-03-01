import * as React from 'react';
import { cn } from '../../lib/utils';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                'rounded-xl border border-gray-200 bg-white text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white',
                className
            )}
            {...props}
        />
    )
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
    )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ className, ...props }, ref) => (
        <h3 ref={ref} className={cn('text-base font-semibold leading-none tracking-tight', className)} {...props} />
    )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => (
        <p ref={ref} className={cn('text-sm text-gray-500 dark:text-gray-400', className)} {...props} />
    )
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
    )
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('flex items-center justify-between p-6 pt-0', className)} {...props} />
    )
);
CardFooter.displayName = 'CardFooter';

interface StatCardProps {
    title?: string;
    label?: string;
    value: string | number;
    description?: string;
    icon?: React.ElementType;
    trend?: { value: number; label: string };
    className?: string;
}

function StatCard({ title, label, value, description, icon: Icon, trend, className }: StatCardProps) {
    return (
        <Card className={cn('p-5', className)}>
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label ?? title}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                    {description && <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>}
                    {trend && (
                        <p className={cn('text-xs font-medium', trend.value >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                            {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
                        </p>
                    )}
                </div>
                {Icon && (
                    <div className="rounded-lg bg-gray-100 p-2 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        <Icon className="h-5 w-5" />
                    </div>
                )}
            </div>
        </Card>
    );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, StatCard };
