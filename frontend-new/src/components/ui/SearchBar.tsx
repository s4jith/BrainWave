import { forwardRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SearchBarProps extends React.InputHTMLAttributes<HTMLInputElement> {
    value: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
    ({ value, onValueChange, placeholder = 'Search…', className, ...props }, ref) => (
        <div className={cn('relative flex-1 min-w-48', className)}>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
                ref={ref}
                type="text"
                value={value}
                onChange={(e) => onValueChange(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-9 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 dark:focus:ring-gray-400"
                {...props}
            />
            {value && (
                <button
                    onClick={() => onValueChange('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    aria-label="Clear search"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    )
);
SearchBar.displayName = 'SearchBar';
