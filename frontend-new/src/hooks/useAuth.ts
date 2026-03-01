'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../stores/authStore';
import { authService } from '../services/auth.service';
import type { LoginRequest, SignupRequest } from '../types';
import { siteConfig } from '../config/site';

export function useAuth() {
    const router = useRouter();
    const { user, token, role, isAuthenticated, setAuth, clearAuth } = useAuthStore();

    const login = useCallback(
        async (credentials: LoginRequest) => {
            const response = await authService.login(credentials);
            setAuth(response.user, response.access_token);
            const redirect = siteConfig.roleDefaultRoutes[response.user.role];
            router.push(redirect);
            return response;
        },
        [setAuth, router]
    );

    const signup = useCallback(
        async (data: SignupRequest) => {
            const response = await authService.signup(data);
            setAuth(response.user, response.access_token);
            const redirect = siteConfig.roleDefaultRoutes[response.user.role];
            router.push(redirect);
            return response;
        },
        [setAuth, router]
    );

    const logout = useCallback(() => {
        clearAuth();
        router.push('/login');
    }, [clearAuth, router]);

    return { user, token, role, isAuthenticated, login, signup, logout };
}
