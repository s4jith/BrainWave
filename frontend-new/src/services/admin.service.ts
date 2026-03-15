import apiClient from '../lib/axios';
import type { AdminAnalyticsData } from '../types';

export const adminService = {
    async getAnalytics(): Promise<AdminAnalyticsData> {
        const { data } = await apiClient.get<AdminAnalyticsData>('/api/admin/analytics');
        return data;
    },

    // Also migrate recent users fetch if still needed by the admin dashboard overview
    async getRecentUsers(): Promise<{ users: any[] }> {
        const { data } = await apiClient.get<{ users: any[] }>('/api/admin/users/recent');
        return data;
    }
};
