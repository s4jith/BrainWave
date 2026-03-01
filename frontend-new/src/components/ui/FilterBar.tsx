import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface FilterOption {
    value: string;
    label: string;
}

interface FilterSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: FilterOption[];
    placeholder?: string;
    className?: string;
}

export function FilterSelect({ value, onChange, options, placeholder = 'All', className }: FilterSelectProps) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
                'rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:ring-gray-400',
                className
            )}
        >
            <option value="">{placeholder}</option>
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    );
}

// ── Pre-built filter selects used across every list page ─────────────────────

const DIFFICULTY_OPTIONS: FilterOption[] = [
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' },
    { value: 'advanced', label: 'Advanced' },
];

const QUESTION_TYPE_OPTIONS: FilterOption[] = [
    { value: 'mcq', label: 'MCQ' },
    { value: 'fillup', label: 'Fill-ups' },
    { value: 'true_false', label: 'True / False' },
    { value: 'short_answer', label: 'Short Answer' },
    { value: 'long_answer', label: 'Long Answer' },
];

const CLASS_LEVEL_OPTIONS: FilterOption[] = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: `Class ${i + 1}`,
}));

export function DifficultyFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return <FilterSelect value={value} onChange={onChange} options={DIFFICULTY_OPTIONS} placeholder="All Difficulties" />;
}

export function QuestionTypeFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return <FilterSelect value={value} onChange={onChange} options={QUESTION_TYPE_OPTIONS} placeholder="All Types" />;
}

export function ClassLevelFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return <FilterSelect value={value} onChange={onChange} options={CLASS_LEVEL_OPTIONS} placeholder="All Classes" />;
}

/** Wrapper that lays out SearchBar + filter chips in one row */
interface FilterBarProps {
    children: ReactNode;
    className?: string;
}

export function FilterBar({ children, className }: FilterBarProps) {
    return (
        <div className={cn('flex flex-wrap items-center gap-3', className)}>
            {children}
        </div>
    );
}
