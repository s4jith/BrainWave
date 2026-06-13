"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { UserProfile, UserRole } from "@/types/user";

interface UserState {
  user: UserProfile;
  accessToken: string | null;
  isAuthenticated: boolean;
}

interface UserActions {
  login: (user: UserProfile, token: string) => void;
  logout: () => void;
  setAccessToken: (token: string | null) => void;
  updateProfile: (partial: Partial<UserProfile>) => void;
  setClassLevel: (classLevel: number) => void;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  getAuthHeader: () => Record<string, string>;
  isRole: (role: UserRole) => boolean;
}

export type UserStore = UserState & UserActions;

const defaultUser: UserProfile = {
  id: null,
  user_id: null,
  name: "",
  email: "",
  role: null,
  classLevel: 10,
  subjects: [],
  avatarSeed: "",
  avatarStyle: "avataaars",
  isOnboarded: false,
  permissions: [],
};

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      user: defaultUser,
      accessToken: null,
      isAuthenticated: false,

      login: (user, token) =>
        set({
          user: { ...defaultUser, ...user },
          accessToken: token,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          user: defaultUser,
          accessToken: null,
          isAuthenticated: false,
        }),

      setAccessToken: (token) => set({ accessToken: token }),

      updateProfile: (partial) =>
        set((state) => ({ user: { ...state.user, ...partial } })),

      setClassLevel: (classLevel) =>
        set((state) => ({ user: { ...state.user, classLevel } })),

      hasPermission: (permission) =>
        get().user.permissions?.includes(permission) ?? false,

      hasAnyPermission: (permissions) => {
        const userPerms = get().user.permissions ?? [];
        return permissions.some((p) => userPerms.includes(p));
      },

      getAuthHeader: () => {
        const token = get().accessToken;
        const header: Record<string, string> = {};
        if (token) header.Authorization = `Bearer ${token}`;
        return header;
      },

      isRole: (role) => get().user.role === role,
    }),
    {
      name: "user-storage",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
        return window.localStorage;
      }),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
