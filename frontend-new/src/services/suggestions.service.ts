import apiClient from '../lib/axios';
import type { Suggestion } from '../types';

export const suggestionsService = {
    async create(payload: {
        student_id: string;
        student_name: string;
        class_level: number;
        category: string;
        subject?: string;
        content: string;
        email?: string;
    }): Promise<Suggestion> {
        const { data } = await apiClient.post<Suggestion>('/api/suggestions', payload);
        return data;
    },

    async getStudentSuggestions(studentId: string): Promise<Suggestion[]> {
        const { data } = await apiClient.get<Suggestion[]>(`/api/suggestions/student/${studentId}`);
        return data;
    },

    async getAllSuggestions(status?: string, category?: string, limit = 20): Promise<Suggestion[]> {
        const { data } = await apiClient.get<Suggestion[]>('/api/suggestions/all', {
            params: { status, category, limit },
        });
        return data;
    },

    async respondToSuggestion(suggestionId: string, response: string, status: string): Promise<Suggestion> {
        const { data } = await apiClient.put<Suggestion>(`/api/suggestions/${suggestionId}/respond`, null, {
            params: { response, status },
        });
        return data;
    },

    async deleteSuggestion(suggestionId: string): Promise<void> {
        await apiClient.delete(`/api/suggestions/${suggestionId}`);
    },
};
