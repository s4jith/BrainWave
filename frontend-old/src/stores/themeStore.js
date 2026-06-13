
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const getUserRole = () => {
    try {
        const userStore = localStorage.getItem('user-storage');
        if (userStore) {
            const parsed = JSON.parse(userStore);
            return parsed?.state?.user?.role || 'guest';
        }
    } catch (e) {
        console.error('Failed to get user role:', e);
    }
    return 'guest';
};

const useThemeStore = create(
    persist(
        (set, get) => ({
            
            theme: 'system',

            resolvedTheme: 'light',

            setTheme: (theme) => {
                set({ theme });
                get().applyTheme();
            },

            applyTheme: () => {
                const { theme } = get();
                let resolvedTheme = theme;

                if (theme === 'system') {
                    
                    resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
                        ? 'dark'
                        : 'light';
                }

                if (resolvedTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }

                set({ resolvedTheme });
            },

            initTheme: () => {
                get().applyTheme();

                const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                mediaQuery.addEventListener('change', () => {
                    if (get().theme === 'system') {
                        get().applyTheme();
                    }
                });
            }
        }),
        {
            name: () => `theme-storage-${getUserRole()}`, 
            partialize: (state) => ({ theme: state.theme }),
            onRehydrateStorage: () => (state) => {
                
                if (state) {
                    setTimeout(() => state.applyTheme(), 0);
                }
            }
        }
    )
);

export default useThemeStore;
