import apiClient from '../lib/axios';
import type { Query } from '../types';

export const queriesService = {
    async createQuery(payload: { group_id: string; subject: string; message: string }): Promise<Query> {
        const { data } = await apiClient.post<Query>('/api/queries', payload);
        return data;
    },

    async getStudentQueries(): Promise<Query[]> {
        const { data } = await apiClient.get<Query[]>('/api/queries/student');
        return data;
    },

    async getTeacherQueries(status?: string): Promise<Query[]> {
        const { data } = await apiClient.get<Query[]>('/api/queries/teacher', {
            params: { status },
        });
        return data;
    },

    async replyToQuery(queryId: string, reply: string): Promise<Query> {
        const { data } = await apiClient.post<Query>(`/api/queries/${queryId}/reply`, { reply });
        return data;
    },
};
