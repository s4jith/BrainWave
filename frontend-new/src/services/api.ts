/**
 * services/api – barrel shim for legacy Vite components (ChatbotPanel, AIPanel)
 * Re-exports services under the names those components expect.
 */
import apiClient from '../lib/axios';

// Re-export chatExport utility so legacy components can import it from here
export { exportChatAsDoc } from '../utils/chatExport';

// ── chatService ───────────────────────────────────────────────────────────────
export const chatService = {
    /** Stream a student question to the AI; calls onChunk per token, onDone when finished */
    studentChatStream(
        message: string,
        classLevel: number,
        subject: string,
        page: number,
        mode: string,
        onChunk: (text: string) => void,
        onDone: (data: unknown) => void,
        onError: (err: unknown) => void
    ): () => void {
        let cancelled = false;
        const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

        (async () => {
            try {
                const res = await fetch(`${API_URL}/api/student/chat/stream`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${localStorage.getItem('auth_token') ?? ''}`,
                    },
                    body: JSON.stringify({ message, class_level: classLevel, subject, page, mode }),
                });

                if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

                const reader = res.body.getReader();
                const decoder = new TextDecoder();

                while (!cancelled) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const text = decoder.decode(value, { stream: true });
                    // Parse SSE data lines
                    text.split('\n').forEach((line) => {
                        const trimmed = line.replace(/^data:\s*/, '');
                        if (trimmed && trimmed !== '[DONE]') {
                            try { onChunk(JSON.parse(trimmed)?.text ?? trimmed); } catch { onChunk(trimmed); }
                        }
                    });
                }

                if (!cancelled) onDone({});
            } catch (err) {
                if (!cancelled) onError(err);
            }
        })();

        return () => { cancelled = true; }; // abort fn
    },

    /** Single-turn image + text analysis */
    async imageChat(
        image: File,
        classLevel: number,
        subject: string,
        page: number,
        mode: string,
        question: string
    ): Promise<{ answer: string; imageAnalysis?: string }> {
        const form = new FormData();
        form.append('file', image);
        form.append('message', question);
        form.append('class_level', String(classLevel));
        form.append('subject', subject);
        form.append('page', String(page));
        form.append('mode', mode);
        const { data } = await apiClient.post<{ answer: string; imageAnalysis?: string }>('/api/student/chat/image', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data;
    },

    /** Annotation action (define / elaborate / stick_flow) */
    async processAnnotation(
        text: string,
        action: string,
        classLevel: number,
        subject: string,
        chapter: number,
        imageData?: string,
        pageNumber?: number
    ): Promise<{ answer: string }> {
        const { data } = await apiClient.post<{ answer: string }>('/api/annotation', {
            text: text,
            action,
            selected_text: text, // ensure request matches backend AnnotationRequest exactly
            class_level: classLevel,
            subject,
            chapter,
            image_data: imageData,
            page_number: pageNumber,
        });
        return data;
    },
};

// ── userStatsService ──────────────────────────────────────────────────────────
export const userStatsService = {
    async logActivity(userId: string, minutes: number): Promise<void> {
        try {
            await apiClient.post('/api/user/activity', { user_id: userId, minutes });
        } catch { /* activity logging is non-critical */ }
    },
};

// ── topQuestionsService ───────────────────────────────────────────────────────
export const topQuestionsService = {
    async getAvailableSubjects(classLevel: number): Promise<{ success: boolean; subjects: Array<{ value: string; name: string }> }> {
        const { data } = await apiClient.get('/api/books/student/subjects', { params: { class_level: classLevel } });
        // Normalise into the shape ChatbotPanel expects
        const subjects: Array<{ value: string; name: string }> = (data?.subjects ?? []).map(
            (s: string | { value: string; name: string }) =>
                typeof s === 'string' ? { value: s, name: s } : s
        );
        return { success: true, subjects };
    },

    async getTopQuestions(
        subject: string,
        classLevel: number,
        mode: string,
        limit: number
    ): Promise<{ success: boolean; questions: Array<{ question: string; ask_count?: number; subject?: string; chapter?: string }> }> {
        try {
            const { data } = await apiClient.post('/api/top-questions/top', { subject, class_level: classLevel, mode, limit });
            return { success: true, questions: Array.isArray(data) ? data : data?.questions ?? [] };
        } catch { return { success: false, questions: [] }; }
    },

    async trackQuestion(payload: {
        question: string; answer: string; subject: string;
        class_level: number; mode: string; user_id: string; session_id: string;
    }): Promise<void> {
        try {
            await apiClient.post('/api/top-questions/track', payload);
        } catch { /* tracking is non-critical */ }
    },
};
