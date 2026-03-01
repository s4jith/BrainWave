import type { UserRole, QuestionType, DifficultyLevel, TestStatus, QuestionStatus, TicketStatus } from '../types';

export const USER_ROLES: Record<UserRole, UserRole> = {
    STUDENT: 'STUDENT',
    TEACHER: 'TEACHER',
    HEAD: 'HEAD',
    ADMIN: 'ADMIN',
};

export const QUESTION_TYPES: Record<QuestionType, string> = {
    fillup: 'Fill in the Blank',
    fill_blank: 'Fill in the Blank',
    mcq: 'Multiple Choice',
    mcq_multi: 'Multiple Choice (Multi)',
    true_false: 'True / False',
    short_answer: 'Short Answer',
    long_answer: 'Long Answer',
    essay: 'Essay',
    matching: 'Matching',
    file_upload: 'File Upload',
};

export const DIFFICULTY_LEVELS: Record<DifficultyLevel, string> = {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
    advanced: 'Advanced'
};

export const TEST_STATUSES: Record<TestStatus, string> = {
    draft: 'Draft',
    active: 'Active',
    published: 'Published',
    closed: 'Closed',
    upcoming: 'Upcoming'
};

export const QUESTION_STATUSES: Record<QuestionStatus, string> = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    archived: 'Archived',
};

export const TICKET_STATUSES: Record<TicketStatus, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    closed: 'Closed',
};

export const CLASS_LEVELS = [6, 7, 8, 9, 10, 11, 12] as const;
export type ClassLevel = (typeof CLASS_LEVELS)[number];

export const STUDENT_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export const FEEDBACK_TYPES = ['bug', 'feature', 'content', 'ux', 'other'] as const;
export const SUGGESTION_CATEGORIES = ['curriculum', 'platform', 'content', 'other'] as const;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_FILE_SIZE_MB = 10;
export const DEBOUNCE_MS = 300;
export const JWT_STORAGE_KEY = 'ncert_auth_token';
export const USER_STORAGE_KEY = 'ncert_auth_user';
