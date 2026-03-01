import apiClient from '../lib/axios';
import type { HeadDashboardStats, QuestionBankItem, QuestionPaper, StudentGroup } from '../types/api.types';

export const headService = {
    async getMyAssignment(): Promise<Record<string, any>> {
        const { data } = await apiClient.get<Record<string, any>>('/api/head/my-assignment');
        return data;
    },

    async getPendingQuestions(params?: {
        subject?: string;
        class_level?: number;
        teacher_id?: string;
        limit?: number;
        offset?: number;
    }): Promise<{ questions: QuestionBankItem[] }> {
        const { data } = await apiClient.get<{ questions: QuestionBankItem[] }>('/api/head/pending-questions', { params });
        return data;
    },

    async approveQuestion(questionId: string): Promise<void> {
        await apiClient.post(`/api/head/approve-question/${questionId}`);
    },

    async rejectQuestion(questionId: string, reason?: string): Promise<void> {
        await apiClient.post(`/api/head/reject-question/${questionId}`, null, {
            params: { reason },
        });
    },

    async bulkApproveQuestions(questionIds: string[]): Promise<void> {
        await apiClient.post('/api/head/bulk-approve-questions', { question_ids: questionIds });
    },

    async getPendingPapers(params?: {
        subject?: string;
        class_level?: number;
        teacher_id?: string;
        limit?: number;
        offset?: number;
    }): Promise<{ papers: QuestionPaper[] }> {
        const { data } = await apiClient.get<{ papers: QuestionPaper[] }>('/api/head/pending-papers', { params });
        return data;
    },

    async approvePaper(paperId: string): Promise<void> {
        await apiClient.post(`/api/head/approve-paper/${paperId}`);
    },

    async rejectPaper(paperId: string, reason?: string): Promise<void> {
        await apiClient.post(`/api/head/reject-paper/${paperId}`, null, {
            params: { reason },
        });
    },

    async getDashboardStats(): Promise<HeadDashboardStats> {
        const { data } = await apiClient.get<HeadDashboardStats>('/api/head/dashboard-stats');
        return data;
    },

    async getGroups(): Promise<{ groups: StudentGroup[] }> {
        const { data } = await apiClient.get<{ groups: StudentGroup[] }>('/api/head/groups');
        return data;
    },

    async getReports(): Promise<Record<string, any>> {
        const { data } = await apiClient.get<Record<string, any>>('/api/head/reports');
        return data;
    },
};
