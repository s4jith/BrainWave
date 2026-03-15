import apiClient from '../lib/axios';

export interface MCQ {
    question: string;
    options: [string, string, string, string];
    correct_index: number;
    explanation: string;
}

export interface MCQGenerationRequest {
    class_level: number;
    subject: string;
    chapter: number;
    num_questions?: number;
    page_range?: [number, number] | null;
}

export interface MCQGenerationResponse {
    mcqs: MCQ[];
    metadata: {
        class_level: number;
        subject: string;
        chapter: number;
        num_questions: number;
    };
}

export interface EvaluationRequest {
    student_id?: string;
    class_level: number;
    subject: string;
    chapter: number;
    mcqs: MCQ[];
    answers: { question_index: number; selected_index: number }[];
}

export interface EvaluationResponse {
    result: {
        total_questions: number;
        correct_answers: number;
        percentage: number;
        feedback: string;
        question_results: any[];
    };
    saved_to_db: boolean;
    evaluation_id?: string;
}

export const mcqService = {
    async generateMCQs(payload: MCQGenerationRequest): Promise<MCQGenerationResponse> {
        const { data } = await apiClient.post<MCQGenerationResponse>('/api/mcq/generate', payload);
        return data;
    },

    async evaluateAnswers(payload: EvaluationRequest): Promise<EvaluationResponse> {
        const { data } = await apiClient.post<EvaluationResponse>('/api/evaluate/', payload);
        return data;
    },
};
