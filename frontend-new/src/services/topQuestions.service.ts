import apiClient from '../lib/axios';
import type { TopQuestion, DoubtHistoryItem } from '../types';

export const topQuestionsService = {
    async getTopQuestions(payload: {
        subject: string;
        class_level: number;
        mode?: string;
        limit?: number;
    }): Promise<TopQuestion[]> {
        const { data } = await apiClient.post<TopQuestion[]>('/api/top-questions/top', payload);
        return data;
    },

    async getRecommendations(payload: {
        user_id: string;
        subject: string;
        class_level: number;
    }): Promise<TopQuestion[]> {
        const { data } = await apiClient.post<TopQuestion[]>('/api/top-questions/recommendations', payload);
        return data;
    },

    async trackQuestion(payload: { question_id: string; user_id: string; subject: string; class_level: number }): Promise<void> {
        await apiClient.post('/api/top-questions/track', payload);
    },

    async getTrending(payload: { subject: string; class_level: number; limit?: number }): Promise<TopQuestion[]> {
        const { data } = await apiClient.post<TopQuestion[]>('/api/top-questions/trending', payload);
        return data;
    },

    async getDoubtHistory(userId: string, params?: {
        subject?: string;
        limit?: number;
        offset?: number;
        search?: string;
    }): Promise<DoubtHistoryItem[]> {
        const { data } = await apiClient.get<DoubtHistoryItem[]>(`/api/top-questions/doubts/${userId}`, { params });
        return data;
    },
};
