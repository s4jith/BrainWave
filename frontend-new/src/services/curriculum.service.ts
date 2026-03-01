import apiClient from '../lib/axios';
import type {
    SubjectSummary,
    ChapterSummaryItem,
    TopicSummary,
    PendingCurriculumItem,
} from '../types';

export const curriculumService = {
    async getSubjects(classLevel?: number, isActive?: boolean): Promise<SubjectSummary[]> {
        const { data } = await apiClient.get<SubjectSummary[]>('/api/curriculum/subjects', {
            params: { class_level: classLevel, is_active: isActive },
        });
        return data;
    },

    async getSubjectDetails(subjectId: string): Promise<SubjectSummary> {
        const { data } = await apiClient.get<SubjectSummary>(`/api/curriculum/subjects/${subjectId}`);
        return data;
    },

    async createSubject(payload: { name: string; class_level: number; board?: string; icon?: string; color?: string }): Promise<SubjectSummary> {
        const { data } = await apiClient.post<SubjectSummary>('/api/curriculum/subjects', payload);
        return data;
    },

    async updateSubject(subjectId: string, payload: Partial<SubjectSummary>): Promise<SubjectSummary> {
        const { data } = await apiClient.put<SubjectSummary>(`/api/curriculum/subjects/${subjectId}`, payload);
        return data;
    },

    async deleteSubject(subjectId: string): Promise<{ success: boolean; message: string }> {
        const { data } = await apiClient.delete(`/api/curriculum/subjects/${subjectId}`);
        return data;
    },

    async getChapters(subjectId: string): Promise<ChapterSummaryItem[]> {
        const { data } = await apiClient.get<ChapterSummaryItem[]>(`/api/curriculum/subjects/${subjectId}/chapters`);
        return data;
    },

    async createChapter(subjectId: string, payload: { chapter_number: number; title: string; description?: string }): Promise<ChapterSummaryItem> {
        const { data } = await apiClient.post<ChapterSummaryItem>(`/api/curriculum/subjects/${subjectId}/chapters`, payload);
        return data;
    },

    async getChapterSummary(subjectId: string, chapterId: string): Promise<{ chapter_id: string; chapter_name: string; summary: string; has_summary: boolean }> {
        const { data } = await apiClient.get(`/api/curriculum/subjects/${subjectId}/chapters/${chapterId}/summary`);
        return data;
    },

    async getTopics(subjectId: string, chapterId: string): Promise<TopicSummary[]> {
        const { data } = await apiClient.get<TopicSummary[]>(`/api/curriculum/subjects/${subjectId}/chapters/${chapterId}/topics`);
        return data;
    },

    async getAvailableBooks(): Promise<{ subjects: string[]; classes: number[]; subject_class_map: Record<string, number[]> }> {
        const { data } = await apiClient.get('/api/curriculum/available-books');
        return data;
    },

    async getPendingItems(status?: string): Promise<PendingCurriculumItem[]> {
        const { data } = await apiClient.get<PendingCurriculumItem[]>('/api/curriculum/pending', {
            params: { status },
        });
        return data;
    },

    async approvePendingItem(pendingId: string, formData: FormData): Promise<PendingCurriculumItem> {
        const { data } = await apiClient.post<PendingCurriculumItem>(`/api/curriculum/pending/${pendingId}/approve`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data;
    },
};
