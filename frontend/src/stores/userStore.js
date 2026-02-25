
import { create } from "zustand";
import { persist } from "zustand/middleware";

const useUserStore = create(
  persist(
    (set, get) => ({
      
      user: {
        id: null,
        user_id: null, 
        name: "",
        email: "",
        classLevel: 10,
        preferredSubject: "Maths",
        role: null, 
        subjects: [], 
        isOnboarded: false,
        username: "",
        avatarSeed: "",
        avatarStyle: "avataaars",
        permissions: [], 
      },

      accessToken: null,

      academics: {
        subjects: [],
      },

      calendar: {
        exams: [],
      },

      privacySettings: {
        showProfileToOthers: true,
        allowNotifications: true,
        shareProgressWithTeacher: true,
        dataCollectionConsent: true,
      },

      isAuthenticated: false,

      setUser: (userData) => set({
        user: { ...get().user, ...userData },
        isAuthenticated: true
      }),

      setAccessToken: (token) => set({ accessToken: token }),

      login: (userData, token) => set({
        user: {
          ...get().user,
          ...userData,
          classLevel: userData.class_level || userData.classLevel || 10,
          permissions: userData.permissions || []
        },
        accessToken: token,
        isAuthenticated: true
      }),

      setClassLevel: (classLevel) =>
        set((state) => ({
          user: { ...state.user, classLevel },
        })),

      setPreferredSubject: (subject) =>
        set((state) => ({
          user: { ...state.user, preferredSubject: subject },
        })),

      setOnboarded: (isOnboarded) =>
        set((state) => ({
          user: { ...state.user, isOnboarded },
        })),

      updateProfile: (profileData) =>
        set((state) => ({
          user: { ...state.user, ...profileData },
        })),

      updateAcademics: (academicsData) =>
        set((state) => ({
          academics: { ...state.academics, ...academicsData },
        })),

      updateCalendar: (calendarData) =>
        set((state) => ({
          calendar: { ...state.calendar, ...calendarData },
        })),

      updatePrivacySettings: (settings) =>
        set((state) => ({
          privacySettings: { ...state.privacySettings, ...settings },
        })),

      logout: () =>
        set({
          user: {
            id: null,
            user_id: null,
            name: "",
            email: "",
            classLevel: 6,
            preferredSubject: "Maths",
            role: null,
            subjects: [],
            isOnboarded: false,
            username: "",
            avatarSeed: "",
            avatarStyle: "avataaars",
            permissions: [],
          },
          accessToken: null,
          academics: { subjects: [] },
          calendar: { exams: [] },
          privacySettings: {
            showProfileToOthers: true,
            allowNotifications: true,
            shareProgressWithTeacher: true,
            dataCollectionConsent: true,
          },
          isAuthenticated: false,
        }),

      getClassLevel: () => get().user.classLevel,

      getSubject: () => get().user.preferredSubject,

      isAdmin: () => get().user.role === "admin",
      isTeacher: () => get().user.role === "teacher",
      isStudent: () => get().user.role === "student",
      isHead: () => get().user.role === "head",

      hasPermission: (permission) => {
        const { permissions } = get().user;
        return permissions && permissions.includes(permission);
      },

      hasAnyPermission: (permissionList) => {
        const { permissions } = get().user;
        if (!permissions) return false;
        return permissionList.some(p => permissions.includes(p));
      },

      getAuthHeader: () => {
        const token = get().accessToken;
        if (!token) return {};
        return { Authorization: `Bearer ${token}` };
      },
    }),
    {
      name: "user-storage", 
      skipHydration: false,
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        academics: state.academics,
        calendar: state.calendar,
        privacySettings: state.privacySettings,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useUserStore;
