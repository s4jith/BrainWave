'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useAuthStore } from '../stores/authStore';
import { JWT_STORAGE_KEY, USER_STORAGE_KEY } from '../constants';
import type { User } from '../types';

interface Props { children: ReactNode }

/**
 * AuthProvider – hydrates auth state from localStorage on mount and
 * silently refreshes the session when the tab comes back into focus.
 */
export function AuthProvider({ children }: Props) {
    const { setAuth, clearAuth, isAuthenticated } = useAuthStore();
    const hydrated = useRef(false);

    // Hydrate auth from localStorage on first render (handles hard refresh)
    useEffect(() => {
        if (hydrated.current) return;
        hydrated.current = true;

        const token = localStorage.getItem(JWT_STORAGE_KEY);
        const rawUser = localStorage.getItem(USER_STORAGE_KEY);
        if (token && rawUser) {
            try {
                const user: User = JSON.parse(rawUser);
                console.log('[auth] Hydrated session from localStorage for:', user.email);
                setAuth(user, token);
            } catch {
                console.warn('[auth] Corrupted stored user data – clearing session.');
                localStorage.removeItem(JWT_STORAGE_KEY);
                localStorage.removeItem(USER_STORAGE_KEY);
            }
        }
    }, [setAuth]);

    return <>{children}</>;
}
