import apiClient from '../lib/axios';
import type { NotificationsResponse } from '../types/api.types';

export const notificationsService = {
    async getNotifications(limit = 20): Promise<NotificationsResponse> {
        const { data } = await apiClient.get<NotificationsResponse>('/api/notifications', {
            params: { limit },
        });
        return data;
    },

    async markRead(notificationId: string): Promise<void> {
        await apiClient.post(`/api/notifications/${notificationId}/read`);
    },

    async markAllRead(): Promise<{ success: boolean; modified_count: number }> {
        const { data } = await apiClient.post('/api/notifications/read-all');
        return data;
    },

    async saveNotification(notificationId: string): Promise<void> {
        await apiClient.post(`/api/notifications/${notificationId}/save`);
    },

    async unsaveNotification(notificationId: string): Promise<void> {
        await apiClient.post(`/api/notifications/${notificationId}/unsave`);
    },

    async deleteNotification(notificationId: string): Promise<void> {
        await apiClient.delete(`/api/notifications/${notificationId}`);
    },
};
