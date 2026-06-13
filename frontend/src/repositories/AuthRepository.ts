import { BaseRepository } from "./BaseRepository";
import type { LoginResponse } from "@/types/user";

export interface LoginPayload {
  email: string;
  password: string;
  role?: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  email: string;
  otp: string;
  new_password: string;
}

export interface VerifyOtpPayload {
  email: string;
  otp: string;
}

class AuthRepositoryImpl extends BaseRepository {
  constructor() {
    super();
  }

  login(payload: LoginPayload): Promise<LoginResponse> {
    return this.post<LoginResponse>("/api/auth/login", payload);
  }

  me(): Promise<unknown> {
    return this.get<unknown>("/api/auth/me");
  }

  forgotPassword(payload: ForgotPasswordPayload): Promise<{ success: boolean; error?: string }> {
    return this.post("/api/auth/forgot-password", payload);
  }

  verifyOtp(payload: VerifyOtpPayload): Promise<{ success: boolean; error?: string }> {
    return this.post("/api/auth/verify-otp", payload);
  }

  resetPassword(payload: ResetPasswordPayload): Promise<{ success: boolean; error?: string }> {
    return this.post("/api/auth/reset-password", payload);
  }

  maintenanceStatus(): Promise<{ maintenance_mode?: boolean }> {
    return this.get("/api/admin/public/maintenance");
  }
}

export const AuthRepository = new AuthRepositoryImpl();
