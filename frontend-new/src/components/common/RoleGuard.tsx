// @ts-nocheck
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../stores/authStore';
import { useStore } from 'zustand';
import type { UserRole } from '../../types';
import { PageLoader } from '../ui/Spinner';

interface RoleGuardProps {
    allowedRoles: UserRole[];
    children: ReactNode;
    redirectTo?: string;
}

export function RoleGuard({ allowedRoles, children, redirectTo = '/login' }: RoleGuardProps) {
    const { isAuthenticated, role } = useAuthStore();
    const router = useRouter();
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        // Ensure Zustand persist has finished rehydrating local storage
        setHydrated(useAuthStore.persist.hasHydrated());
        const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
        return unsub;
    }, []);

    useEffect(() => {
        if (!hydrated) return;

        if (!isAuthenticated) {
            router.replace('/login');
            return;
        }
        if (role && !allowedRoles.includes(role)) {
            router.replace(redirectTo);
        }
    }, [isAuthenticated, role, allowedRoles, router, redirectTo, hydrated]);

    if (!hydrated || !isAuthenticated || !role || !allowedRoles.includes(role)) {
        return <PageLoader text="Checking permissions…" />;
    }

    return <>{children}</>;
}
