import type { UserRole } from '../types';
import { ROUTES } from '../constants/routes';
import { env } from './env';

export const siteConfig = {
    name: env.APP_NAME,
    description: 'AI-powered NCERT learning platform with tests, flashcards, and smart notes.',
    url: env.APP_URL,

    roleDefaultRoutes: {
        STUDENT: ROUTES.STUDENT.DASHBOARD,
        TEACHER: ROUTES.TEACHER.DASHBOARD,
        HEAD: ROUTES.HEAD.DASHBOARD,
        ADMIN: ROUTES.ADMIN.DASHBOARD,
    } satisfies Record<UserRole, string>,

    publicRoutes: [
        ROUTES.HOME,
        ROUTES.AUTH.LOGIN,
        ROUTES.AUTH.SIGNUP,
        ROUTES.AUTH.FORGOT_PASSWORD,
    ] as string[],

    navLinks: {
        STUDENT: [
            { label: 'Dashboard', href: ROUTES.STUDENT.DASHBOARD },
            { label: 'Subjects', href: ROUTES.STUDENT.SUBJECTS },
            { label: 'Tests', href: ROUTES.STUDENT.TESTS },
            { label: 'Notes', href: ROUTES.STUDENT.NOTES },
            { label: 'Groups', href: ROUTES.STUDENT.GROUPS },
        ],
        TEACHER: [
            { label: 'Dashboard', href: ROUTES.TEACHER.DASHBOARD },
            { label: 'Questions', href: ROUTES.TEACHER.QUESTIONS },
            { label: 'Tests', href: ROUTES.TEACHER.TESTS },
            { label: 'Gradebook', href: ROUTES.TEACHER.GRADEBOOK },
            { label: 'Reports', href: ROUTES.TEACHER.REPORTS },
        ],
        HEAD: [
            { label: 'Dashboard', href: ROUTES.HEAD.DASHBOARD },
            { label: 'Pending Questions', href: ROUTES.HEAD.PENDING_QUESTIONS },
            { label: 'Pending Papers', href: ROUTES.HEAD.PENDING_PAPERS },
            { label: 'Reports', href: ROUTES.HEAD.REPORTS },
        ],
        ADMIN: [
            { label: 'Dashboard', href: ROUTES.ADMIN.DASHBOARD },
            { label: 'Books', href: ROUTES.ADMIN.BOOKS },
            { label: 'Curriculum', href: ROUTES.ADMIN.CURRICULUM },
            { label: 'Students', href: ROUTES.ADMIN.STUDENTS },
            { label: 'Teachers', href: ROUTES.ADMIN.TEACHERS },
        ],
    } satisfies Record<UserRole, { label: string; href: string }[]>,
} as const;
