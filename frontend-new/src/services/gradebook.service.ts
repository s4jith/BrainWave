import apiClient from '../lib/axios';
import type { GradeEntry, CourseAnalytics, StudentGradesResponse, StudentDashboardStats, TeacherStats } from '../types/api.types';

export const gradebookService = {
    async getMyGrades(courseId?: string): Promise<StudentGradesResponse> {
        const { data } = await apiClient.get<StudentGradesResponse>('/api/gradebook/my-grades', {
            params: { course_id: courseId },
        });
        return data;
    },

    async getStudentGrades(studentId: string, courseId?: string): Promise<StudentGradesResponse> {
        const { data } = await apiClient.get<StudentGradesResponse>(`/api/gradebook/student/${studentId}`, {
            params: { course_id: courseId },
        });
        return data;
    },

    async getCourseAnalytics(courseId: string): Promise<CourseAnalytics> {
        const { data } = await apiClient.get<CourseAnalytics>(`/api/gradebook/course/${courseId}/analytics`);
        return data;
    },

    async getAssessmentAnalytics(assessmentId: string): Promise<Record<string, unknown>> {
        const { data } = await apiClient.get(`/api/gradebook/assessment/${assessmentId}/analytics`);
        return data;
    },

    async getClassGradebook(courseId: string): Promise<Record<string, unknown>> {
        const { data } = await apiClient.get(`/api/gradebook/course/${courseId}`);
        return data;
    },

    async exportGrades(courseId: string): Promise<Blob> {
        const { data } = await apiClient.get(`/api/gradebook/course/${courseId}/export`, {
            responseType: 'blob',
        });
        return data;
    },

    async getTeacherStats(): Promise<TeacherStats> {
        const { data } = await apiClient.get<TeacherStats>('/api/gradebook/stats/teacher');
        return data;
    },

    async getStudentStats(): Promise<StudentDashboardStats> {
        const { data } = await apiClient.get<StudentDashboardStats>('/api/gradebook/stats/student');
        return data;
    },
};
