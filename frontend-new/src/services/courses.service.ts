import apiClient from '../lib/axios';
import type { CourseResponse, CourseDetailResponse } from '../types';

export const coursesService = {
    async listCourses(params?: {
        page?: number;
        page_size?: number;
        category?: string;
        difficulty?: string;
        class_level?: number;
        instructor_id?: string;
        enrolled_only?: boolean;
    }): Promise<{ courses: CourseResponse[]; total: number }> {
        const { data } = await apiClient.get('/api/courses', { params });
        return data;
    },

    async getMyCourses(page = 1, pageSize = 20): Promise<{ courses: CourseResponse[]; total: number }> {
        const { data } = await apiClient.get('/api/courses/my-courses', {
            params: { page, page_size: pageSize },
        });
        return data;
    },

    async getCourse(courseId: string): Promise<CourseDetailResponse> {
        const { data } = await apiClient.get<CourseDetailResponse>(`/api/courses/${courseId}`);
        return data;
    },

    async createCourse(payload: {
        title: string;
        description: string;
        category: string;
        difficulty: string;
        class_level?: number;
        tags?: string[];
    }): Promise<CourseResponse> {
        const { data } = await apiClient.post<CourseResponse>('/api/courses', payload);
        return data;
    },

    async updateCourse(courseId: string, payload: Partial<CourseResponse>): Promise<CourseResponse> {
        const { data } = await apiClient.put<CourseResponse>(`/api/courses/${courseId}`, payload);
        return data;
    },

    async deleteCourse(courseId: string): Promise<void> {
        await apiClient.delete(`/api/courses/${courseId}`);
    },

    async publishCourse(courseId: string): Promise<void> {
        await apiClient.post(`/api/courses/${courseId}/publish`);
    },

    async enrollInCourse(courseId: string): Promise<void> {
        await apiClient.post(`/api/courses/${courseId}/enroll`);
    },

    async unenrollFromCourse(courseId: string): Promise<void> {
        await apiClient.delete(`/api/courses/${courseId}/enroll`);
    },

    async rateCourse(courseId: string, rating: number, review?: string): Promise<void> {
        await apiClient.post(`/api/courses/${courseId}/rate`, { rating, review });
    },

    async getCategories(): Promise<string[]> {
        const { data } = await apiClient.get<string[]>('/api/courses/categories/list');
        return data;
    },
};
