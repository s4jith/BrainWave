// @ts-nocheck
'use client';

import type { ReactNode } from 'react';
import { Edit, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';
import { DifficultyBadge, QuestionTypeBadge, QuestionStatusBadge, AIGeneratedBadge } from '../ui/StatusBadges';
import { Badge } from '../ui/Badge';
import { formatDate } from '../../utils/formatters';
import type { QuestionBankItem } from '../../types';

interface QuestionCardProps {
    question: QuestionBankItem & {
        chapter?: string;
        topic?: string;
        is_ai_generated?: boolean;
        created_by?: string;
        triggered_by?: string;
        expires_at?: string;
        created_at: string;
    };
    actions?: ReactNode;
    /** show full options/answer or just meta */
    showDetails?: boolean;
    className?: string;
}

export function QuestionCard({ question: q, actions, showDetails = true, className }: QuestionCardProps) {
    const [expanded, setExpanded] = useState(false);

    const daysLeft = q.expires_at
        ? Math.ceil((new Date(q.expires_at).getTime() - Date.now()) / 86_400_000)
        : null;

    return (
        <div className={cn('p-5 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors', className)}>
            <div className="flex items-start justify-between gap-4">
                {/* Question body */}
                <div className="min-w-0 flex-1">
                    {/* Meta badges */}
                    <div className="mb-3 flex flex-wrap gap-2">
                        <DifficultyBadge difficulty={q.difficulty} />
                        <QuestionTypeBadge type={q.type} />
                        <Badge variant="info">
                            {q.subject} · Class {q.class_level}
                        </Badge>
                        <Badge variant="purple">{q.marks} Mark{q.marks > 1 ? 's' : ''}</Badge>
                        {q.status && <QuestionStatusBadge status={q.status} />}
                        {q.is_ai_generated && <AIGeneratedBadge />}
                    </div>

                    {/* Question text */}
                    <p className="mb-3 text-sm font-medium leading-relaxed text-gray-900 dark:text-white">
                        {q.text}
                    </p>

                    {/* MCQ options */}
                    {q.type === 'mcq' && q.options && (
                        <div className="mb-3 grid grid-cols-2 gap-2">
                            {q.options.map((opt, idx) => (
                                <div
                                    key={idx}
                                    className={cn(
                                        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                                        opt === q.correct_answer
                                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200'
                                            : 'bg-gray-50 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300'
                                    )}
                                >
                                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-xs font-semibold dark:border-gray-500 dark:bg-gray-600">
                                        {String.fromCharCode(65 + idx)}
                                    </span>
                                    {opt}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* True/False */}
                    {q.type === 'true_false' && (
                        <div className="mb-3 flex gap-2">
                            {['True', 'False'].map((val) => (
                                <span
                                    key={val}
                                    className={cn(
                                        'rounded-lg px-4 py-2 text-sm font-medium',
                                        q.correct_answer === val
                                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200'
                                            : 'bg-gray-50 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300'
                                    )}
                                >
                                    {val}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Short/Long answer */}
                    {q.type !== 'mcq' && q.type !== 'true_false' && q.correct_answer && (
                        <p className="mb-3 text-sm">
                            <span className="font-semibold text-gray-700 dark:text-gray-300">Answer: </span>
                            <span className="text-gray-600 dark:text-gray-400">{q.correct_answer}</span>
                        </p>
                    )}

                    {/* Footer meta */}
                    <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-gray-400 dark:text-gray-500">
                        {q.chapter && <span>Ch {q.chapter}</span>}
                        {q.chapter && <span>·</span>}
                        <span>
                            {q.is_ai_generated
                                ? `Triggered by ${q.triggered_by ?? q.created_by}`
                                : `By ${q.created_by}`}
                        </span>
                        <span>·</span>
                        <span>{formatDate(q.created_at)}</span>
                        {daysLeft !== null && (
                            <>
                                <span>·</span>
                                <span className={daysLeft <= 2 ? 'text-red-500' : 'text-amber-500'}>
                                    ⏱ {daysLeft > 0 ? `Auto-deletes in ${daysLeft}d` : 'Expired'}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-shrink-0 items-center gap-1">{actions}</div>
            </div>
        </div>
    );
}

/** Compact expandable variant used in HeadDashboard approval flow */
interface ExpandableQuestionCardProps {
    question: QuestionCardProps['question'];
    selected?: boolean;
    onSelect?: (checked: boolean) => void;
    actions?: ReactNode;
}

export function ExpandableQuestionCard({ question: q, selected, onSelect, actions }: ExpandableQuestionCardProps) {
    const [open, setOpen] = useState(false);
    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-start gap-3 p-4">
                {onSelect && (
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => onSelect(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-gray-600"
                    />
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                            <p className="line-clamp-2 text-sm font-medium text-gray-900 dark:text-white">{q.text}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Badge variant="info">{q.subject} · Class {q.class_level}</Badge>
                                <DifficultyBadge difficulty={q.difficulty} />
                                <QuestionTypeBadge type={q.type} />
                                <span className="text-xs text-gray-400">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
                                {q.is_ai_generated && <AIGeneratedBadge />}
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            {actions}
                            <button
                                onClick={() => setOpen((v) => !v)}
                                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                            >
                                {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {open && (
                <div className="ml-7 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
                    {q.options && q.options.length > 0 && (
                        <div className="mb-2">
                            <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">Options:</p>
                            <ul className="space-y-1">
                                {q.options.map((opt, i) => (
                                    <li
                                        key={i}
                                        className={cn(
                                            'rounded px-2 py-1 text-sm',
                                            opt === q.correct_answer
                                                ? 'bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                                                : 'text-gray-600 dark:text-gray-400'
                                        )}
                                    >
                                        {String.fromCharCode(65 + i)}. {opt}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium text-gray-500">Answer:</span> {q.correct_answer}
                    </p>
                    {q.chapter && (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Chapter: {q.chapter}{q.topic ? ` — ${q.topic}` : ''}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
