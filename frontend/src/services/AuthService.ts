import { AuthRepository, type LoginPayload } from "@repositories/AuthRepository";
import type { LoginResponse, UserProfile, UserRole } from "@/types/user";

/**
 * AuthService — feature-facing orchestration.
 * Components call this; it talks to repositories and shapes domain types.
 */

export interface NormalizedLoginResult {
  success: boolean;
  error?: string;
  token?: string;
  user?: UserProfile;
  firstLogin?: boolean;
}

function normalizeUser(raw: LoginResponse["user"]): UserProfile | undefined {
  if (!raw) return undefined;
  return {
    id: raw.id ?? null,
    user_id: raw.user_id ?? null,
    name: raw.name ?? "",
    email: raw.email ?? "",
    role: raw.role ?? null,
    classLevel: raw.class_level ?? null,
    subjects: raw.subjects ?? [],
    avatarSeed: raw.avatar_seed ?? "",
    avatarStyle: raw.avatar_style ?? "avataaars",
    isOnboarded: raw.is_onboarded !== false,
    permissions: raw.permissions ?? [],
  };
}

export const AuthService = {
  async login(payload: LoginPayload): Promise<NormalizedLoginResult> {
    const data = await AuthRepository.login(payload);
    if (!data.success) {
      return { success: false, error: data.error ?? "Invalid credentials" };
    }
    return {
      success: true,
      token: data.access_token,
      user: normalizeUser(data.user),
      firstLogin: data.first_login,
    };
  },

  async forgotPassword(email: string): Promise<{ success: boolean; error?: string }> {
    return AuthRepository.forgotPassword({ email });
  },

  async verifyOtp(email: string, otp: string): Promise<{ success: boolean; error?: string }> {
    return AuthRepository.verifyOtp({ email, otp });
  },

  async resetPassword(
    email: string,
    otp: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> {
    return AuthRepository.resetPassword({ email, otp, new_password: newPassword });
  },

  async fetchMaintenance(): Promise<boolean> {
    try {
      const data = await AuthRepository.maintenanceStatus();
      return data.maintenance_mode === true;
    } catch {
      return false;
    }
  },

  defaultRouteForRole(role: UserRole | null | undefined): string {
    switch (role) {
      case "admin":
        return "/admin-dashboard";
      case "teacher":
        return "/teacher-dashboard";
      case "head":
        return "/head-dashboard";
      case "student":
      default:
        return "/dashboard";
    }
  },
};
