import * as React from 'react';
import { cn } from '../../lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    ({ className, type, ...props }, ref) => (
        <input
            type={type}
            className={cn(
                'flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 dark:focus-visible:ring-gray-300',
                className
            )}
            ref={ref}
            {...props}
        />
    )
);
Input.displayName = 'Input';

interface LabeledInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
    hint?: string;
}

const LabeledInput = React.forwardRef<HTMLInputElement, LabeledInputProps>(
    ({ label, error, hint, id, className, ...props }, ref) => {
        const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
        return (
            <div className="space-y-1">
                <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {label}
                    {props.required && <span className="ml-0.5 text-red-500">*</span>}
                </label>
                <Input id={inputId} ref={ref} className={cn(error && 'border-red-500 focus-visible:ring-red-500', className)} {...props} />
                {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
                {hint && !error && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
            </div>
        );
    }
);
LabeledInput.displayName = 'LabeledInput';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
    ({ className, ...props }, ref) => (
        <textarea
            className={cn(
                'flex min-h-[80px] w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 dark:focus-visible:ring-gray-300',
                className
            )}
            ref={ref}
            {...props}
        />
    )
);
Textarea.displayName = 'Textarea';

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
    ({ className, ...props }, ref) => (
        <select
            className={cn(
                'flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus-visible:ring-gray-300',
                className
            )}
            ref={ref}
            {...props}
        />
    )
);
Select.displayName = 'Select';

export { Input, LabeledInput, Textarea, Select };
