/**
 * User Store - Manages user profile, authentication, and RBAC
 * Zustand store for user data including class level, subject preferences, role, permissions
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * User Store with RBAC Support
 * 
 * Features:
 * - JWT token storage
 * - Role-based permissions
 * - User profile management
 */

const useUserStore = create(
  persist(
    (set, get) => ({
      // User Profile
      user: {
        id: null,
        user_id: null, // Login ID (NCERT2025001, TCH2026001)
        name: "",
        email: "",
        classLevel: 10,
        preferredSubject: "Mathematics",
        role: null, // 'student' | 'teacher' | 'admin'
        subjects: [], // For teachers: subjects they teach
        isOnboarded: false,
        username: "",
        avatarSeed: "",
        avatarStyle: "avataaars",
        permissions: [], // Role-based permissions
      },

      // JWT Access Token
      accessToken: null,

      // Previous Year Academics
      academics: {
        subjects: [],
      },

      // Exam Calendar
      calendar: {
        exams: [],
      },

      // Privacy Settings
      privacySettings: {
        showProfileToOthers: true,
        allowNotifications: true,
        shareProgressWithTeacher: true,
        dataCollectionConsent: true,
      },

      // Authentication state
      isAuthenticated: false,

      // Actions
      setUser: (userData) => set({
        user: { ...get().user, ...userData },
        isAuthenticated: true
      }),

      // Set access token
      setAccessToken: (token) => set({ accessToken: token }),

      // Login action - sets user data and token together
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

      // Update profile info
      updateProfile: (profileData) =>
        set((state) => ({
          user: { ...state.user, ...profileData },
        })),

      // Update academics
      updateAcademics: (academicsData) =>
        set((state) => ({
          academics: { ...state.academics, ...academicsData },
        })),

      // Update calendar
      updateCalendar: (calendarData) =>
        set((state) => ({
          calendar: { ...state.calendar, ...calendarData },
        })),

      // Update privacy settings
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
            preferredSubject: "Mathematics",
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

      // Get current class level
      getClassLevel: () => get().user.classLevel,

      // Get current subject
      getSubject: () => get().user.preferredSubject,

      // Role-based helpers
      isAdmin: () => get().user.role === "admin",
      isTeacher: () => get().user.role === "teacher",
      isStudent: () => get().user.role === "student",

      // Check if user has specific permission
      hasPermission: (permission) => {
        const { permissions } = get().user;
        return permissions && permissions.includes(permission);
      },

      // Check if user has any of the specified permissions
      hasAnyPermission: (permissionList) => {
        const { permissions } = get().user;
        if (!permissions) return false;
        return permissionList.some(p => permissions.includes(p));
      },

      // Get authorization header for API calls
      getAuthHeader: () => {
        const token = get().accessToken;
        if (!token) return {};
        return { Authorization: `Bearer ${token}` };
      },
    }),
    {
      name: "user-storage", // LocalStorage key
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

