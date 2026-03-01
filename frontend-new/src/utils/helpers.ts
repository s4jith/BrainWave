import type { UserRole } from '../types';
import { ROUTES } from '../constants/routes';

export function getRoleRedirectPath(role: UserRole): string {
    const map: Record<UserRole, string> = {
        STUDENT: ROUTES.STUDENT.DASHBOARD,
        TEACHER: ROUTES.TEACHER.DASHBOARD,
        HEAD: ROUTES.HEAD.DASHBOARD,
        ADMIN: ROUTES.ADMIN.DASHBOARD,
    };
    return map[role];
}

export function buildQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
            search.set(key, String(value));
        }
    }
    const qs = search.toString();
    return qs ? `?${qs}` : '';
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
    return items.reduce<Record<string, T[]>>((acc, item) => {
        const groupKey = String(item[key]);
        (acc[groupKey] ??= []).push(item);
        return acc;
    }, {});
}

export function unique<T>(items: T[], key: keyof T): T[] {
    const seen = new Set<unknown>();
    return items.filter((item) => {
        const k = item[key];
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
}
