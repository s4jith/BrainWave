import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * URL-Hiding Middleware
 * ─────────────────────────────────────────────────────────────────
 * Users always see /me/* in the browser address bar regardless of
 * their role. This middleware transparently rewrites the request to
 * the correct role-based route server-side.
 *
 * Mapping:
 *   /me/*  →  /student/* | /teacher/* | /head/* | /admin/*
 *
 * Role is read from the `role` field stored in the `auth-storage`
 * Zustand cookie (set by authStore's persist middleware).
 * ─────────────────────────────────────────────────────────────────
 */

// Roles recognised by the platform
const ROLE_PATH_MAP: Record<string, string> = {
    student: 'student',
    teacher: 'teacher',
    head: 'head',
    department_head: 'head',   // alias
    admin: 'admin',
    superadmin: 'admin',      // alias
};

function getRoleFromCookie(request: NextRequest): string | null {
    const raw = request.cookies.get('auth-storage')?.value;
    if (!raw) return null;
    try {
        const parsed = JSON.parse(decodeURIComponent(raw));
        // Zustand persist wraps state under `state`
        const role: string | undefined = parsed?.state?.role ?? parsed?.role;
        return role ?? null;
    } catch {
        return null;
    }
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // ── /me/* rewriting ────────────────────────────────────────────
    if (pathname.startsWith('/me')) {
        const role = getRoleFromCookie(request);
        const rolePath = ROLE_PATH_MAP[role ?? ''];

        if (!rolePath) {
            // Not logged in — send to login
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            return NextResponse.redirect(url);
        }

        // Strip /me prefix, prepend role path
        const rest = pathname.replace(/^\/me/, '') || '/';  // e.g. /tests
        const url = request.nextUrl.clone();
        url.pathname = `/${rolePath}${rest}`;
        return NextResponse.rewrite(url);
    }

    // ── Enrollment guard for /signup ───────────────────────────────
    if (pathname === '/signup') {
        const enrollmentEnabled = process.env.NEXT_PUBLIC_ENROLLMENT_ENABLED === 'true';
        if (!enrollmentEnabled) {
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            return NextResponse.redirect(url);
        }
    }

    return NextResponse.next();
}

export const config = {
    // Apply to /me/* and /signup — skip static files and API routes
    matcher: ['/me/:path*', '/signup'],
};
