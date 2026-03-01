'use client';

import { cn } from '../../lib/utils';

interface PaginationProps {
    page: number;
    totalPages: number;
    total: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    className?: string;
    /** Show "Showing X-Y of Z items" label */
    showLabel?: boolean;
}

export function Pagination({
    page,
    totalPages,
    total,
    pageSize,
    onPageChange,
    className,
    showLabel = true,
}: PaginationProps) {
    const from = Math.min((page - 1) * pageSize + 1, total);
    const to = Math.min(page * pageSize, total);

    // Build page number list around current page
    const getPages = () => {
        const pages: (number | '...')[] = [];
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        pages.push(1);
        if (page > 3) pages.push('...');
        for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
            pages.push(i);
        }
        if (page < totalPages - 2) pages.push('...');
        pages.push(totalPages);
        return pages;
    };

    if (totalPages <= 1 && total === 0) return null;

    return (
        <div className={cn('flex items-center justify-between gap-4 border-t border-gray-100 px-6 py-4 dark:border-gray-800', className)}>
            {showLabel ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {total === 0 ? 'No items' : `Showing ${from}–${to} of ${total}`}
                </p>
            ) : <div />}

            <div className="flex items-center gap-1">
                <PageBtn disabled={page === 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
                    ‹
                </PageBtn>
                {getPages().map((p, i) =>
                    p === '...' ? (
                        <span key={`e${i}`} className="px-2 text-gray-400">…</span>
                    ) : (
                        <PageBtn
                            key={p}
                            active={p === page}
                            onClick={() => onPageChange(p as number)}
                            aria-label={`Page ${p}`}
                            aria-current={p === page ? 'page' : undefined}
                        >
                            {p}
                        </PageBtn>
                    )
                )}
                <PageBtn disabled={page === totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
                    ›
                </PageBtn>
            </div>
        </div>
    );
}

function PageBtn({
    children,
    active,
    disabled,
    onClick,
    ...rest
}: {
    children: React.ReactNode;
    active?: boolean;
    disabled?: boolean;
    onClick?: () => void;
    [key: string]: unknown;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            aria-disabled={disabled}
            className={cn(
                'inline-flex h-8 min-w-[2rem] items-center justify-center rounded-md px-2 text-sm transition-colors',
                active
                    ? 'bg-gray-900 font-semibold text-white dark:bg-white dark:text-gray-900'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
                disabled && 'cursor-not-allowed opacity-40'
            )}
            {...rest}
        >
            {children}
        </button>
    );
}
