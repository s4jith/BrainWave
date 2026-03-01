import apiClient from '../lib/axios';
import type { StartTestResponse, TestResult, StudentAnalytics, StaffTestItem } from '../types';

export const testService = {
    async getSubjects(classLevel: number): Promise<unknown[]> {
        const { data } = await apiClient.get(`/api/test/subjects/${classLevel}`);
        return data;
    },

    async getChapters(classLevel: number, subject: string, studentId?: string): Promise<unknown[]> {
        const { data } = await apiClient.get(`/api/test/chapters/${classLevel}/${subject}`, {
            params: { student_id: studentId },
        });
        return data;
    },

    async getTopics(classLevel: number, subject: string, chapter: number, studentId?: string): Promise<unknown[]> {
        const { data } = await apiClient.get(`/api/test/topics/${classLevel}/${subject}/${chapter}`, {
            params: { student_id: studentId },
        });
        return data;
    },

    async startTest(payload: {
        student_id: string;
        class_level: number;
        subject: string;
        chapter_number: number;
        topic_id: string;
        num_questions: number;
        difficulty: string;
    }): Promise<StartTestResponse> {
        const { data } = await apiClient.post<StartTestResponse>('/api/test/start', payload);
        return data;
    },

    async startAiTest(payload: {
        student_id: string;
        class_level: number;
        subject: string;
        chapter_number: number;
        topic_ids: string[];
        difficulty?: string;
        num_questions?: number;
    }): Promise<StartTestResponse> {
        const { data } = await apiClient.post<StartTestResponse>('/api/test/ai-test/start', payload);
        return data;
    },

    async submitAnswer(payload: {
        session_id: string;
        question_id: string;
        question_number: number;
        answer: string;
    }): Promise<unknown> {
        const { data } = await apiClient.post('/api/test/answer', payload);
        return data;
    },

    async completeTest(payload: {
        session_id: string;
        student_id: string;
        answers: { question_id: string; question_number: number; answer: string }[];
    }): Promise<TestResult> {
        const { data } = await apiClient.post<TestResult>('/api/test/complete', payload);
        return data;
    },

    async getResult(sessionId: string): Promise<TestResult> {
        const { data } = await apiClient.get<TestResult>(`/api/test/result/${sessionId}`);
        return data;
    },

    async getHistory(studentId: string, limit = 20, offset = 0): Promise<unknown> {
        const { data } = await apiClient.get(`/api/test/history/${studentId}`, {
            params: { limit, offset },
        });
        return data;
    },

    async deleteHistory(sessionId: string): Promise<void> {
        await apiClient.delete(`/api/test/history/${sessionId}`);
    },

    async getAnalytics(studentId: string, classLevel: number, subject?: string): Promise<StudentAnalytics> {
        const { data } = await apiClient.get<StudentAnalytics>(`/api/test/analytics/${studentId}`, {
            params: { class_level: classLevel, subject },
        });
        return data;
    },

    async getStaffTests(subject?: string, chapter?: string, studentId?: string): Promise<StaffTestItem[]> {
        const { data } = await apiClient.get<StaffTestItem[]>('/api/test/staff-tests', {
            params: { subject, chapter, student_id: studentId },
        });
        return data;
    },

    async submitAnswerSheet(testId: string, formData: FormData): Promise<unknown> {
        const { data } = await apiClient.post(`/api/test/staff-tests/${testId}/submit`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data;
    },
};
