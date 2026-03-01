import apiClient from '../lib/axios';
import type { TeacherQuestion, TeacherStats, StudentGroup } from '../types/api.types';

export const teacherService = {
    async getGroups(): Promise<{ groups: StudentGroup[] }> {
        const { data } = await apiClient.get<{ groups: StudentGroup[] }>('/api/teacher/groups');
        return data;
    },

    async getQuestions(subject?: string, classLevel?: number): Promise<{ questions: TeacherQuestion[] }> {
        const { data } = await apiClient.get<{ questions: TeacherQuestion[] }>('/api/teacher/questions', {
            params: { subject, class_level: classLevel },
        });
        return data;
    },

    async createQuestion(payload: Omit<TeacherQuestion, 'id'>): Promise<{ success: boolean; id: string; message: string }> {
        const { data } = await apiClient.post<{ success: boolean; id: string; message: string }>('/api/teacher/questions', payload);
        return data;
    },

    async updateQuestion(questionId: string, payload: Partial<TeacherQuestion>): Promise<TeacherQuestion> {
        const { data } = await apiClient.put<TeacherQuestion>(`/api/teacher/questions/${questionId}`, payload);
        return data;
    },

    async deleteQuestion(questionId: string): Promise<void> {
        await apiClient.delete(`/api/teacher/questions/${questionId}`);
    },

    async getStats(): Promise<TeacherStats> {
        const { data } = await apiClient.get<TeacherStats>('/api/teacher/stats');
        return data;
    },

    async getReports(): Promise<Record<string, any>> {
        const { data } = await apiClient.get<Record<string, any>>('/api/teacher/reports');
        return data;
    },
};
