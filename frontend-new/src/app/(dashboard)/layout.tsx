'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../stores/authStore';
import { siteConfig } from '../../config/site';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, role } = useAuthStore();
    const router = useRouter();

    useEffect(() => {
        if (!isAuthenticated) {
            router.replace('/login');
        }
    }, [isAuthenticated, router]);

    if (!isAuthenticated || !role) return null;

    return <>{children}</>;
}
