import { cn } from '../../lib/utils';
import { Badge } from './Badge';
import type { DifficultyLevel, QuestionType, QuestionStatus, TestStatus, TicketStatus } from '../../types';

// ── Difficulty Badge ──────────────────────────────────────────────────────────
const difficultyVariant = {
    easy: 'success',
    medium: 'warning',
    hard: 'destructive',
    advanced: 'purple',
} as const;

export function DifficultyBadge({ difficulty }: { difficulty: DifficultyLevel | string }) {
    const variant = difficultyVariant[difficulty as DifficultyLevel] ?? 'secondary';
    return (
        <Badge variant={variant as never}>
            {difficulty.toUpperCase()}
        </Badge>
    );
}

// ── Question Type Badge ───────────────────────────────────────────────────────
const typeLabel: Record<string, string> = {
    mcq: 'MCQ',
    fillup: 'Fill-up',
    fill_blank: 'Fill-up',
    true_false: 'True/False',
    short_answer: 'Short Answer',
    long_answer: 'Long Answer',
};

export function QuestionTypeBadge({ type }: { type: QuestionType | string }) {
    return (
        <Badge variant="secondary">{typeLabel[type] ?? type.replace(/_/g, ' ').toUpperCase()}</Badge>
    );
}

// ── Question Status Badge ─────────────────────────────────────────────────────
const questionStatusVariant: Record<QuestionStatus, 'pending' | 'approved' | 'rejected' | 'secondary'> = {
    pending: 'pending',
    approved: 'approved',
    rejected: 'rejected',
    archived: 'secondary',
};

export function QuestionStatusBadge({ status }: { status: QuestionStatus }) {
    return <Badge variant={questionStatusVariant[status]}>{status}</Badge>;
}

// ── Test Status Badge ─────────────────────────────────────────────────────────
const testStatusVariant: Record<TestStatus, 'info' | 'success' | 'secondary' | 'destructive' | 'warning'> = {
    draft: 'secondary',
    published: 'info',
    active: 'success',
    upcoming: 'warning',
    closed: 'secondary',
};

export function TestStatusBadge({ status }: { status: TestStatus | string }) {
    const variant = testStatusVariant[status as TestStatus] ?? 'secondary';
    return <Badge variant={variant}>{status.replace('_', ' ')}</Badge>;
}

// ── Ticket Status Badge ───────────────────────────────────────────────────────
const ticketStatusVariant: Record<TicketStatus, 'warning' | 'info' | 'success' | 'secondary'> = {
    open: 'warning',
    in_progress: 'info',
    resolved: 'success',
    closed: 'secondary',
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
    return <Badge variant={ticketStatusVariant[status]}>{status.replace('_', ' ')}</Badge>;
}

// ── Role Badge ────────────────────────────────────────────────────────────────
const roleVariant: Record<string, 'default' | 'info' | 'purple' | 'warning'> = {
    admin: 'default',
    teacher: 'info',
    head: 'purple',
    student: 'warning',
};

export function RoleBadge({ role }: { role: string }) {
    return (
        <Badge variant={roleVariant[role.toLowerCase()] ?? 'secondary'} className="capitalize">
            {role}
        </Badge>
    );
}

// ── AI badge ──────────────────────────────────────────────────────────────────
export function AIGeneratedBadge() {
    return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-500 dark:text-indigo-400">
            ✨ AI
        </span>
    );
}
