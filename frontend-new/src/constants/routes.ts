export const ROUTES = {
    HOME: '/',

    AUTH: {
        LOGIN: '/login',
        SIGNUP: '/signup',
        FORGOT_PASSWORD: '/forgot-password',
    },

    STUDENT: {
        DASHBOARD: '/student',
        SUBJECTS: '/student/subjects',
        TESTS: '/student/tests',
        TEST_SESSION: '/student/tests/session',
        TEST_RESULT: '/student/tests/result',
        TEST_HISTORY: '/student/tests/history',
        NOTES: '/student/notes',
        FLASHCARDS: '/student/flashcards',
        GROUPS: '/student/groups',
        QUERIES: '/student/queries',
        SUGGESTIONS: '/student/suggestions',
        SUPPORT: '/student/support',
        SETTINGS: '/student/settings',
        REPORT_CARD: '/student/report-card',
    },

    TEACHER: {
        DASHBOARD: '/teacher',
        QUESTIONS: '/teacher/questions',
        TESTS: '/teacher/tests',
        QUESTION_BANK: '/teacher/question-bank',
        QUESTION_PAPERS: '/teacher/question-papers',
        GROUPS: '/teacher/groups',
        QUERIES: '/teacher/queries',
        REPORTS: '/teacher/reports',
        SETTINGS: '/teacher/settings',
        ASSESSMENTS: '/teacher/assessments',
        COURSES: '/teacher/courses',
        GRADEBOOK: '/teacher/gradebook',
    },

    HEAD: {
        DASHBOARD: '/head',
        PENDING_QUESTIONS: '/head/pending-questions',
        PENDING_PAPERS: '/head/pending-papers',
        GROUPS: '/head/groups',
        REPORTS: '/head/reports',
        TESTS: '/head/tests',
    },

    ADMIN: {
        DASHBOARD: '/admin',
        BOOKS: '/admin/books',
        CURRICULUM: '/admin/curriculum',
        STUDENTS: '/admin/students',
        TEACHERS: '/admin/teachers',
        GROUPS: '/admin/groups',
        TESTS: '/admin/tests',
        QUESTION_BANK: '/admin/question-bank',
        QUESTION_PAPERS: '/admin/question-papers',
        SUPPORT: '/admin/support',
        SUGGESTIONS: '/admin/suggestions',
        REPORTS: '/admin/reports',
        SETTINGS: '/admin/settings',
        NOTIFICATIONS: '/admin/notifications',
    },
} as const;

export type RouteKeys = typeof ROUTES;
