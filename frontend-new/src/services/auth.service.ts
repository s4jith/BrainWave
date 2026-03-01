import apiClient from '../lib/axios';
import type { LoginRequest, SignupRequest, AuthResponse, ForgotPasswordRequest } from '../types';

// ── Auth service – all authentication endpoints ───────────────────────────────
export const authService = {
    /** Standard email+password login */
    async login(credentials: LoginRequest): Promise<AuthResponse> {
        const { data } = await apiClient.post<AuthResponse>('/api/auth/login', credentials);
        return data;
    },

    /** User-ID + password login (matches old frontend user_id flow) */
    async loginWithUserId(userId: string, password: string): Promise<AuthResponse> {
        const { data } = await apiClient.post<AuthResponse>('/api/auth/login', { user_id: userId, password });
        return data;
    },

    /** Create new account */
    async signup(payload: SignupRequest): Promise<AuthResponse> {
        const { data } = await apiClient.post<AuthResponse>('/api/auth/signup', payload);
        return data;
    },

    /** Step 1 – Forgot password: send OTP to email */
    async forgotPassword(payload: ForgotPasswordRequest): Promise<{ success: boolean; message: string }> {
        const { data } = await apiClient.post<{ success: boolean; message: string }>('/api/auth/forgot-password', payload);
        return data;
    },

    /** Step 2 – Forgot password: verify OTP and receive reset token */
    async verifyOtp(email: string, otp: string): Promise<{ success: boolean; reset_token: string }> {
        const { data } = await apiClient.post<{ success: boolean; reset_token: string }>('/api/auth/verify-otp', { email, otp });
        return data;
    },

    /** Step 3 – Forgot password: set new password using reset token */
    async resetPassword(email: string, resetToken: string, newPassword: string): Promise<{ success: boolean; message: string }> {
        const { data } = await apiClient.post<{ success: boolean; message: string }>('/api/auth/reset-password', {
            email,
            reset_token: resetToken,
            new_password: newPassword,
        });
        return data;
    },

    /** First-login mandatory password change */
    async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<{ success: boolean }> {
        const { data } = await apiClient.post<{ success: boolean }>('/api/auth/change-password', {
            user_id: userId,
            old_password: oldPassword,
            new_password: newPassword,
        });
        return data;
    },

    /** Refresh access token (uses httpOnly cookie) */
    async refreshToken(): Promise<{ access_token: string }> {
        const { data } = await apiClient.post<{ access_token: string }>('/api/auth/refresh');
        return data;
    },

    /** Invalidate session server-side */
    async logout(): Promise<void> {
        await apiClient.post('/api/auth/logout');
    },
};
