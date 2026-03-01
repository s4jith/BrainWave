// Bridge shim – maps old Vite userStore API onto the Next.js authStore
// Used by legacy components (book-to-bot, ChatbotPanel, UserSettingsPanel)
'use client';
import { useAuthStore } from './authStore';

export interface UserStoreState {
    user: {
        id: string;
        name: string;
        email: string;
        role: string;
        classLevel: number;
        preferredSubject: string;
        avatarSeed?: string;
        avatarStyle?: string;
    };
    setPreferredSubject: (subject: string) => void;
    getAuthHeader: () => Record<string, string>;
}

// Adapts useAuthStore to the shape expected by legacy components
const useUserStore = (): UserStoreState => {
    const authUser = useAuthStore((s) => s.user);
    const token = useAuthStore((s) => s.token);
    const updateUser = useAuthStore((s) => s.updateUser);

    // Cast authStore user to the legacy shape
    const user = {
        id: authUser?.id ?? '',
        name: authUser?.name ?? '',
        email: authUser?.email ?? '',
        role: authUser?.role ?? 'student',
        classLevel: (authUser as unknown as { class_level?: number })?.class_level ?? 6,
        preferredSubject: (authUser as unknown as { preferred_subject?: string })?.preferred_subject ?? '',
        avatarSeed: (authUser as unknown as { avatar_seed?: string })?.avatar_seed,
        avatarStyle: (authUser as unknown as { avatar_style?: string })?.avatar_style,
    };

    const setPreferredSubject = (subject: string) => {
        if (authUser) {
            updateUser({ preferred_subject: subject } as unknown as Partial<NonNullable<typeof authUser>>);
        }
        console.log('[userStore] setPreferredSubject:', subject);
    };

    const getAuthHeader = () => ({
        Authorization: token ? `Bearer ${token}` : '',
    });

    return { user, setPreferredSubject, getAuthHeader };
};

export default useUserStore;
