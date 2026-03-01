'use client';

import { useEffect, type ReactNode } from 'react';
import { useUIStore } from '../stores/uiStore';

interface ThemeProviderProps {
    children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    const { theme } = useUIStore();

    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('light', 'dark');

        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.classList.add(prefersDark ? 'dark' : 'light');
        } else {
            root.classList.add(theme);
        }
    }, [theme]);

    return <>{children}</>;
}
