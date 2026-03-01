import apiClient from '../lib/axios';
import type { TestManagementItem, TestSubmission, AdminDashboardStats } from '../types/api.types';

export const testManagementService = {
    async createTest(formData: FormData): Promise<TestManagementItem> {
        const { data } = await apiClient.post<TestManagementItem>('/api/tests/create', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data;
    },

    async getAdminTests(params?: { class_level?: number; subject?: string; status?: string; skip?: number; limit?: number }): Promise<TestManagementItem[]> {
        const { data } = await apiClient.get<TestManagementItem[]>('/api/tests/admin', { params });
        return data;
    },

    async getStudentTests(studentId: string, status?: string): Promise<TestManagementItem[]> {
        const { data } = await apiClient.get<TestManagementItem[]>(`/api/tests/student/${studentId}`, {
            params: { status },
        });
        return data;
    },

    async getTeacherTests(): Promise<TestManagementItem[]> {
        const { data } = await apiClient.get<TestManagementItem[]>('/api/tests/teacher');
        return data;
    },

    async getTest(testId: string): Promise<TestManagementItem> {
        const { data } = await apiClient.get<TestManagementItem>(`/api/tests/${testId}`);
        return data;
    },

    async updateTest(testId: string, payload: Partial<TestManagementItem>): Promise<TestManagementItem> {
        const { data } = await apiClient.put<TestManagementItem>(`/api/tests/${testId}`, payload);
        return data;
    },

    async deleteTest(testId: string): Promise<void> {
        await apiClient.delete(`/api/tests/${testId}`);
    },

    async submitTest(formData: FormData): Promise<TestSubmission> {
        const { data } = await apiClient.post<TestSubmission>('/api/tests/submit', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data;
    },

    async getSubmissions(testId: string): Promise<TestSubmission[]> {
        const { data } = await apiClient.get<TestSubmission[]>(`/api/tests/submissions/${testId}`);
        return data;
    },

    async getMySubmissions(studentId: string): Promise<TestSubmission[]> {
        const { data } = await apiClient.get<TestSubmission[]>(`/api/tests/my-submissions/${studentId}`);
        return data;
    },

    async getStats(): Promise<AdminDashboardStats> {
        const { data } = await apiClient.get<AdminDashboardStats>('/api/tests/stats/overview');
        return data;
    },
};
