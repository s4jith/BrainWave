import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
    {
        variants: {
            variant: {
                default: 'bg-gray-900 text-white shadow hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100',
                destructive: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
                outline: 'border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-transparent dark:text-white dark:hover:bg-gray-800',
                secondary: 'bg-gray-100 text-gray-900 shadow-sm hover:bg-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700',
                ghost: 'hover:bg-gray-100 text-gray-700 dark:hover:bg-gray-800 dark:text-gray-300',
                link: 'text-blue-600 underline-offset-4 hover:underline dark:text-blue-400',
                success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700',
                warning: 'bg-yellow-500 text-white shadow-sm hover:bg-yellow-600',
                purple: 'bg-purple-600 text-white shadow-sm hover:bg-purple-700',
            },
            size: {
                default: 'h-9 px-4 py-2',
                sm: 'h-8 rounded-md px-3 text-xs',
                lg: 'h-11 rounded-md px-8 text-base',
                icon: 'h-9 w-9',
                'icon-sm': 'h-7 w-7',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    loading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, loading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
        return (
            <button
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                disabled={disabled || loading}
                {...props}
            >
                {loading ? (
                    <svg
                        className="h-4 w-4 animate-spin"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                ) : leftIcon}
                {children}
                {!loading && rightIcon}
            </button>
        );
    }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
