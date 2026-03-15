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

    async getStudentSuggestions(studentId: string): Promise<{ suggestions: Suggestion[]; total: number }> {
        const { data } = await apiClient.get<{ suggestions: Suggestion[]; total: number }>(`/api/suggestions/student/${studentId}`);
        return data;
    },

    async getAllSuggestions(status?: string, category?: string, limit = 20): Promise<{ suggestions: Suggestion[]; total: number; pending_count: number }> {
        const { data } = await apiClient.get<{ suggestions: Suggestion[]; total: number; pending_count: number }>('/api/suggestions/all', {
            params: { status, category, limit },
        });
        return data;
    },

    async respondToSuggestion(suggestionId: string, response: string, status: string): Promise<Suggestion> {
        // Match the FastAPI backend signature: /api/suggestions/{id}/respond?response=Text&status=reviewed
        const { data } = await apiClient.put<Suggestion>(
            `/api/suggestions/${suggestionId}/respond?response=${encodeURIComponent(response)}&status=${status}`
        );
        return data;
    },

    async deleteSuggestion(suggestionId: string): Promise<void> {
        await apiClient.delete(`/api/suggestions/${suggestionId}`);
    },
};
