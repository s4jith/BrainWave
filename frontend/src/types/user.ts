export type UserRole = "student" | "teacher" | "admin" | "head";

export interface UserProfile {
  id: string | null;
  user_id: string | null;
  name: string;
  email: string;
  role: UserRole | null;
  classLevel: number | null;
  subjects: string[];
  avatarSeed: string;
  avatarStyle: string;
  isOnboarded: boolean;
  permissions: string[];
}

/** Raw user shape returned by POST /api/auth/login. */
export interface LoginUserResponse {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: UserRole;
  class_level: number | null;
  subjects: string[];
  avatar_seed?: string;
  avatar_style?: string;
  is_onboarded?: boolean;
  permissions?: string[];
}

export interface LoginResponse {
  success: boolean;
  error?: string;
  first_login?: boolean;
  user_id?: string;
  session_id?: string;
  access_token?: string;
  token_type?: string;
  user?: LoginUserResponse;
}
