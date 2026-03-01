/**
 * themeStore – shim for ChatbotPanel which imports this from the old Vite code.
 * Maps to next-themes so we stay consistent with the rest of the Next.js app.
 */
'use client';

import { useTheme } from 'next-themes';

export interface ThemeStoreState {
    theme: string;
    setTheme: (theme: string) => void;
}

// Wraps next-themes in the same API the old Vite themeStore exposed
const useThemeStore = (): ThemeStoreState => {
    const { theme = 'system', setTheme } = useTheme();
    return { theme, setTheme };
};

export default useThemeStore;
