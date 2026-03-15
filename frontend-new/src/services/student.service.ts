import apiClient from '../lib/axios';
import type { StudentGroup, StudentLevelResponse, StudentSubject } from '../types';

export const studentService = {
    async getGroups(): Promise<{ groups: StudentGroup[] }> {
        const { data } = await apiClient.get('/api/student/groups');
        return data;
    },

    async getUpcomingTests(): Promise<{ tests: unknown[]; total: number }> {
        const { data } = await apiClient.get('/api/student/upcoming-tests');
        return data;
    },

    async getFeatures(): Promise<{ features: Record<string, boolean> }> {
        const { data } = await apiClient.get('/api/student/my-features');
        return data;
    },

    async getSubjects(): Promise<{ subjects: StudentSubject[]; total: number }> {
        const { data } = await apiClient.get<{ subjects: StudentSubject[]; total: number }>('/api/student/my-subjects');
        return data;
    },

    async getLevel(studentId: string): Promise<StudentLevelResponse> {
        const { data } = await apiClient.get<StudentLevelResponse>(`/api/v1/student/level/${studentId}`);
        return data;
    },

    async updateLevel(studentId: string, level: 'beginner' | 'intermediate' | 'advanced'): Promise<StudentLevelResponse> {
        const { data } = await apiClient.put<StudentLevelResponse>(`/api/v1/student/level/${studentId}`, { level });
        return data;
    },

    async getModeMapping(): Promise<Record<string, string>> {
        const { data } = await apiClient.get('/api/v1/student/level/mode-mapping');
        return data;
    },
};
