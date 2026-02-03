/**
 * Theme Store - Manages light/dark/system theme preferences
 * Uses Zustand for state management with localStorage persistence
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useThemeStore = create(
    persist(
        (set, get) => ({
            // Theme: 'light' | 'dark' | 'system'
            theme: 'system',

            // Resolved theme (what's actually applied)
            resolvedTheme: 'light',

            setTheme: (theme) => {
                set({ theme });
                get().applyTheme();
            },

            applyTheme: () => {
                const { theme } = get();
                let resolvedTheme = theme;

                if (theme === 'system') {
                    // Check system preference
                    resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
                        ? 'dark'
                        : 'light';
                }

                // Apply to document
                if (resolvedTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }

                set({ resolvedTheme });
            },

            // Initialize theme on app load
            initTheme: () => {
                get().applyTheme();

                // Listen for system theme changes
                const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                mediaQuery.addEventListener('change', () => {
                    if (get().theme === 'system') {
                        get().applyTheme();
                    }
                });
            }
        }),
        {
            name: 'theme-storage',
            partialize: (state) => ({ theme: state.theme }),
            onRehydrateStorage: () => (state) => {
                // Apply theme after rehydration
                if (state) {
                    setTimeout(() => state.applyTheme(), 0);
                }
            }
        }
    )
);

export default useThemeStore;
