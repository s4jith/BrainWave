import apiClient from '../lib/axios';
import type { SupportTicket, TicketReply } from '../types';

export const supportTicketsService = {
    async getTickets(params?: {
        user_id?: string;
        status?: string;
        category?: string;
        priority?: string;
        limit?: number;
        skip?: number;
        is_admin?: boolean;
    }): Promise<SupportTicket[]> {
        const { data } = await apiClient.get<SupportTicket[]>('/api/support-tickets/', { params });
        return data;
    },

    async createTicket(
        payload: { title: string; description: string; category: string; priority: string },
        userId: string,
        userName: string
    ): Promise<SupportTicket> {
        const { data } = await apiClient.post<SupportTicket>('/api/support-tickets/', payload, {
            params: { user_id: userId, user_name: userName },
        });
        return data;
    },

    async getTicket(ticketId: string): Promise<SupportTicket> {
        const { data } = await apiClient.get<SupportTicket>(`/api/support-tickets/${ticketId}`);
        return data;
    },

    async updateTicket(ticketId: string, payload: Partial<SupportTicket>): Promise<SupportTicket> {
        const { data } = await apiClient.put<SupportTicket>(`/api/support-tickets/${ticketId}`, payload);
        return data;
    },

    async addReply(ticketId: string, reply: TicketReply): Promise<SupportTicket> {
        const { data } = await apiClient.post<SupportTicket>(`/api/support-tickets/${ticketId}/reply`, reply);
        return data;
    },

    async closeTicket(ticketId: string): Promise<void> {
        await apiClient.post(`/api/support-tickets/${ticketId}/close`);
    },

    async resolveTicket(ticketId: string): Promise<void> {
        await apiClient.post(`/api/support-tickets/${ticketId}/resolve`);
    },

    async getStats(): Promise<Record<string, unknown>> {
        const { data } = await apiClient.get('/api/support-tickets/stats/summary');
        return data;
    },
};
