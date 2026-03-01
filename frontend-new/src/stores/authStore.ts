import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserRole } from '../types';
import { JWT_STORAGE_KEY, USER_STORAGE_KEY } from '../constants';

interface AuthState {
    user: User | null;
    token: string | null;
    role: UserRole | null;
    isAuthenticated: boolean;
    setAuth: (user: User, token: string) => void;
    clearAuth: () => void;
    updateUser: (partial: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            role: null,
            isAuthenticated: false,

            setAuth: (user, token) => {
                if (typeof window !== 'undefined') {
                    localStorage.setItem(JWT_STORAGE_KEY, token);
                    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
                    // Write cookie for Next.js middleware so it can route to dashboards
                    document.cookie = `auth-storage=${encodeURIComponent(JSON.stringify({ state: { role: user.role } }))}; path=/; max-age=604800`; // 7 days
                }
                set({ user, token, role: user.role, isAuthenticated: true });
            },

            clearAuth: () => {
                if (typeof window !== 'undefined') {
                    localStorage.removeItem(JWT_STORAGE_KEY);
                    localStorage.removeItem(USER_STORAGE_KEY);
                    // Clear cookie
                    document.cookie = `auth-storage=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
                }
                set({ user: null, token: null, role: null, isAuthenticated: false });
            },

            updateUser: (partial) =>
                set((state) => ({
                    user: state.user ? { ...state.user, ...partial } : null,
                })),
        }),
        {
            name: 'ncert-auth',
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                role: state.role,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);
