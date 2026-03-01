import apiClient from '../lib/axios';
import type { StreakData, ProgressData, DashboardData } from '../types';

export const userService = {
    async getStreak(studentId: string): Promise<StreakData> {
        const { data } = await apiClient.get<StreakData>(`/api/user/streak/${studentId}`);
        return data;
    },

    async getProgress(studentId: string, subject?: string): Promise<ProgressData> {
        const { data } = await apiClient.get<ProgressData>(`/api/user/progress/${studentId}`, {
            params: { subject },
        });
        return data;
    },

    async getDashboard(studentId: string, subject?: string): Promise<DashboardData> {
        const { data } = await apiClient.get<DashboardData>(`/api/user/dashboard/${studentId}`, {
            params: { subject },
        });
        return data;
    },

    async logActivity(studentId: string, hours = 0.5): Promise<{ message: string; date: string; hours_added: number }> {
        const { data } = await apiClient.post('/api/user/activity/log', null, {
            params: { student_id: studentId, hours },
        });
        return data;
    },

    async getAnalytics(studentId: string, period = 'week'): Promise<Record<string, unknown>> {
        const { data } = await apiClient.get(`/api/user/analytics/${studentId}`, {
            params: { period },
        });
        return data;
    },
};
