import apiClient from '../lib/axios';
import type { QuestionPaper, ManualQuestion } from '../types';

export const questionPapersService = {
    async listPapers(params?: {
        class_level?: number;
        subject?: string;
        paper_type?: string;
        year?: number;
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<QuestionPaper[]> {
        const { data } = await apiClient.get<QuestionPaper[]>('/api/question-papers', { params });
        return data;
    },

    async getPaper(paperId: string): Promise<QuestionPaper> {
        const { data } = await apiClient.get<QuestionPaper>(`/api/question-papers/${paperId}`);
        return data;
    },

    async createPaperManual(payload: {
        title: string;
        paper_type: string;
        class_level: number;
        subject: string;
        year: number;
        questions: ManualQuestion[];
    }): Promise<QuestionPaper> {
        const { data } = await apiClient.post<QuestionPaper>('/api/question-papers', payload);
        return data;
    },

    async extractFromPdf(formData: FormData): Promise<QuestionPaper> {
        const { data } = await apiClient.post<QuestionPaper>('/api/question-papers/extract-pdf', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data;
    },

    async approvePaper(paperId: string): Promise<void> {
        await apiClient.post(`/api/question-papers/${paperId}/approve`);
    },

    async rejectPaper(paperId: string): Promise<void> {
        await apiClient.post(`/api/question-papers/${paperId}/reject`);
    },

    async updatePaper(paperId: string, payload: Partial<QuestionPaper>): Promise<QuestionPaper> {
        const { data } = await apiClient.put<QuestionPaper>(`/api/question-papers/${paperId}`, payload);
        return data;
    },

    async deletePaper(paperId: string): Promise<void> {
        await apiClient.delete(`/api/question-papers/${paperId}`);
    },

    async addToBank(paperId: string): Promise<void> {
        await apiClient.post(`/api/question-papers/${paperId}/add-to-bank`);
    },

    async getMetadata(): Promise<{ subjects: string[]; types: string[]; years: number[] }> {
        const { data } = await apiClient.get('/api/question-papers/metadata');
        return data;
    },
};
