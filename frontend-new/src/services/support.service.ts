import apiClient from '../lib/axios';
import type { FAQ, FeedbackSubmission } from '../types';

export const supportService = {
    async getFaqs(category?: string, search?: string, isActive = true): Promise<FAQ[]> {
        const { data } = await apiClient.get<FAQ[]>('/api/support/faqs', {
            params: { category, search, is_active: isActive },
        });
        return data;
    },

    async createFaq(payload: Omit<FAQ, 'id' | 'helpful_count' | 'view_count'>): Promise<FAQ> {
        const { data } = await apiClient.post<FAQ>('/api/support/faqs', payload);
        return data;
    },

    async updateFaq(faqId: string, payload: Partial<FAQ>): Promise<FAQ> {
        const { data } = await apiClient.put<FAQ>(`/api/support/faqs/${faqId}`, payload);
        return data;
    },

    async deleteFaq(faqId: string): Promise<void> {
        await apiClient.delete(`/api/support/faqs/${faqId}`);
    },

    async markFaqHelpful(faqId: string): Promise<void> {
        await apiClient.post(`/api/support/faqs/${faqId}/helpful`);
    },

    async submitContactMessage(payload: { name: string; email: string; subject: string; message: string }): Promise<void> {
        await apiClient.post('/api/support/contact', payload);
    },

    async getContactMessages(status?: string, limit = 20): Promise<unknown[]> {
        const { data } = await apiClient.get('/api/support/contact/messages', {
            params: { status, limit },
        });
        return data;
    },

    async submitFeedback(payload: FeedbackSubmission, userId?: string): Promise<void> {
        await apiClient.post('/api/support/feedback', payload, {
            params: { user_id: userId },
        });
    },

    async getFeedbackStats(): Promise<Record<string, unknown>> {
        const { data } = await apiClient.get('/api/support/feedback/stats');
        return data;
    },

    async getSystemStatus(): Promise<Record<string, unknown>> {
        const { data } = await apiClient.get('/api/support/status');
        return data;
    },
};
