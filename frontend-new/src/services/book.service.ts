import apiClient from '../lib/axios';
import type { BookResponse, Flashcard, SmartNote } from '../types';

export const bookService = {
    async listAllBooks(): Promise<{ books: BookResponse[]; total: number }> {
        const { data } = await apiClient.get('/api/books/admin/list');
        return data;
    },

    async getAvailableSubjects(classLevel: number, studentId?: string): Promise<{ subjects: string[] }> {
        const { data } = await apiClient.get('/api/books/student/subjects', {
            params: { class_level: classLevel, student_id: studentId },
        });
        return data;
    },

    async getBooksForStudent(classLevel: number, subject: string): Promise<BookResponse[]> {
        const { data } = await apiClient.get('/api/books/student/books', {
            params: { class_level: classLevel, subject },
        });
        return data;
    },

    async uploadBook(formData: FormData): Promise<BookResponse> {
        const { data } = await apiClient.post<BookResponse>('/api/books/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data;
    },

    async deleteBook(bookId: string, deleteEmbeddings = true): Promise<void> {
        await apiClient.delete(`/api/books/${bookId}`, {
            params: { delete_embeddings: deleteEmbeddings },
        });
    },

    async generateEmbeddings(bookId: string): Promise<void> {
        await apiClient.post(`/api/books/${bookId}/generate-embeddings`);
    },

    async getFlashcards(subject: string, classLevel: number, count = 10): Promise<Flashcard[]> {
        const { data } = await apiClient.get<Flashcard[]>('/api/books/flashcards', {
            params: { subject, class_level: classLevel, count },
        });
        return data;
    },

    async generateSmartNotes(subject: string, classLevel: number, chapter?: string): Promise<{ content: string }> {
        const { data } = await apiClient.get('/api/books/notes/generate', {
            params: { subject, class_level: classLevel, chapter },
        });
        return data;
    },

    async saveSmartNote(payload: {
        user_id: string;
        subject: string;
        class_level: number;
        title: string;
        content: string;
    }): Promise<SmartNote> {
        const { data } = await apiClient.post<SmartNote>('/api/books/notes/save', payload);
        return data;
    },

    async getUserNotes(userId: string, subject?: string, limit = 20): Promise<SmartNote[]> {
        const { data } = await apiClient.get<SmartNote[]>(`/api/books/notes/${userId}`, {
            params: { subject, limit },
        });
        return data;
    },

    async getPdfInfo(bookId: string): Promise<{ numPages: number; title: string; author: string }> {
        const { data } = await apiClient.get(`/api/books/render/${bookId}/info`);
        return data;
    },
};
