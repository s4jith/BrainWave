import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface UIState {
    theme: Theme;
    sidebarOpen: boolean;
    pageLoading: boolean;
    setTheme: (theme: Theme) => void;
    toggleSidebar: () => void;
    setSidebarOpen: (open: boolean) => void;
    setPageLoading: (loading: boolean) => void;
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            theme: 'system',
            sidebarOpen: true,
            pageLoading: false,

            setTheme: (theme) => set({ theme }),
            toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
            setSidebarOpen: (open) => set({ sidebarOpen: open }),
            setPageLoading: (loading) => set({ pageLoading: loading }),
        }),
        {
            name: 'ncert-ui',
            partialize: (state) => ({ theme: state.theme, sidebarOpen: state.sidebarOpen }),
        }
    )
);
