import apiClient from '../lib/axios';
import type { TestSubmission, Assessment, AssessmentSubmission } from '../types';

export const assessmentsService = {
    async listAssessments(courseId?: string, page = 1, pageSize = 20): Promise<{ assessments: Assessment[]; total: number }> {
        const { data } = await apiClient.get('/api/assessments', {
            params: { course_id: courseId, page, page_size: pageSize },
        });
        return data;
    },

    async getAssessment(assessmentId: string): Promise<Assessment> {
        const { data } = await apiClient.get<Assessment>(`/api/assessments/${assessmentId}`);
        return data;
    },

    async createAssessment(payload: Omit<Assessment, 'id' | 'is_published'>): Promise<Assessment> {
        const { data } = await apiClient.post<Assessment>('/api/assessments', payload);
        return data;
    },

    async updateAssessment(assessmentId: string, payload: Partial<Assessment>): Promise<Assessment> {
        const { data } = await apiClient.put<Assessment>(`/api/assessments/${assessmentId}`, payload);
        return data;
    },

    async publishAssessment(assessmentId: string): Promise<void> {
        await apiClient.post(`/api/assessments/${assessmentId}/publish`);
    },

    async deleteAssessment(assessmentId: string): Promise<void> {
        await apiClient.delete(`/api/assessments/${assessmentId}`);
    },

    async startAssessment(assessmentId: string): Promise<unknown> {
        const { data } = await apiClient.get(`/api/assessments/${assessmentId}/start`);
        return data;
    },

    async submitAssessment(assessmentId: string, answers: { question_id: string; answer: string }[]): Promise<AssessmentSubmission> {
        const { data } = await apiClient.post<AssessmentSubmission>(`/api/assessments/${assessmentId}/submit`, { answers });
        return data;
    },

    async getSubmissions(assessmentId: string): Promise<AssessmentSubmission[]> {
        const { data } = await apiClient.get<AssessmentSubmission[]>(`/api/assessments/${assessmentId}/submissions`);
        return data;
    },

    async getMySubmissions(): Promise<AssessmentSubmission[]> {
        const { data } = await apiClient.get<AssessmentSubmission[]>('/api/assessments/submissions/my');
        return data;
    },

    async gradeSubmission(submissionId: string, payload: {
        grades: { question_id: string; points_awarded: number }[];
        feedback?: string;
    }): Promise<void> {
        await apiClient.post(`/api/assessments/submissions/${submissionId}/grade`, payload);
    },
};
