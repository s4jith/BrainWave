import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { TableLoader } from './Spinner';

export interface Column<T> {
    key: keyof T | string;
    header: string;
    render?: (row: T) => ReactNode;
    className?: string;
    headerClassName?: string;
}

interface DataTableProps<T> {
    columns: Column<T>[];
    data: T[];
    keyField: keyof T;
    loading?: boolean;
    emptyMessage?: string;
    className?: string;
    rowClassName?: (row: T) => string;
    onRowClick?: (row: T) => void;
}

export function DataTable<T>({
    columns,
    data,
    keyField,
    loading,
    emptyMessage = 'No records found.',
    className,
    rowClassName,
    onRowClick,
}: DataTableProps<T>) {
    if (loading) return <TableLoader rows={5} />;

    return (
        <div className={cn('w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700', className)}>
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60">
                        {columns.map((col) => (
                            <th
                                key={String(col.key)}
                                className={cn(
                                    'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400',
                                    col.headerClassName
                                )}
                            >
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {data.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} className="py-10 text-center text-gray-400 dark:text-gray-500">
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        data.map((row) => (
                            <tr
                                key={String(row[keyField])}
                                onClick={onRowClick ? () => onRowClick(row) : undefined}
                                className={cn(
                                    'bg-white transition-colors dark:bg-gray-900',
                                    onRowClick && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800',
                                    rowClassName?.(row)
                                )}
                            >
                                {columns.map((col) => (
                                    <td key={String(col.key)} className={cn('px-4 py-3 text-gray-700 dark:text-gray-300', col.className)}>
                                        {col.render
                                            ? col.render(row)
                                            : String((row as Record<string, unknown>)[String(col.key)] ?? '')}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
