import apiClient from '../lib/axios';
import type { QuestionBankItem, DeleteRequest } from '../types';

export const questionBankService = {
    async getSubjects(): Promise<string[]> {
        const { data } = await apiClient.get<string[]>('/api/question-bank/subjects');
        return data;
    },

    async getQuestions(params?: {
        class_level?: number;
        subject?: string;
        search?: string;
        type?: string;
        difficulty?: string;
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<{ questions: QuestionBankItem[]; total: number }> {
        const { data } = await apiClient.get<{ questions: QuestionBankItem[]; total: number }>('/api/question-bank/questions', { params });
        return data;
    },

    async createQuestion(payload: Omit<QuestionBankItem, 'id'>): Promise<QuestionBankItem> {
        const { data } = await apiClient.post<QuestionBankItem>('/api/question-bank/questions', payload);
        return data;
    },

    async updateQuestion(questionId: string, payload: Partial<QuestionBankItem>): Promise<QuestionBankItem> {
        const { data } = await apiClient.put<QuestionBankItem>(`/api/question-bank/questions/${questionId}`, payload);
        return data;
    },

    async approveQuestion(questionId: string): Promise<void> {
        await apiClient.put(`/api/question-bank/questions/${questionId}/approve`);
    },

    async rejectQuestion(questionId: string, reason?: string): Promise<void> {
        await apiClient.put(`/api/question-bank/questions/${questionId}/reject`, null, {
            params: { reason },
        });
    },

    async deleteQuestion(questionId: string): Promise<void> {
        await apiClient.delete(`/api/question-bank/questions/${questionId}`);
    },

    async requestDelete(questionId: string, reason?: string): Promise<void> {
        await apiClient.post(`/api/question-bank/questions/${questionId}/request-delete`, { reason });
    },

    async getDeleteRequests(status?: string): Promise<DeleteRequest[]> {
        const { data } = await apiClient.get<DeleteRequest[]>('/api/question-bank/delete-requests', {
            params: { status },
        });
        return data;
    },

    async approveDeleteRequest(requestId: string): Promise<void> {
        await apiClient.post(`/api/question-bank/delete-requests/${requestId}/approve`);
    },

    async generateQuestions(payload: { class_level: number; subject: string; chapter: string; config: Record<string, unknown> }): Promise<QuestionBankItem[]> {
        const { data } = await apiClient.post<QuestionBankItem[]>('/api/question-bank/generate', payload);
        return data;
    },
};
