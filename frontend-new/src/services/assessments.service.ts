import apiClient from '../lib/axios';

/** Assessment Question structure */
export interface AssessmentQuestion {
    question: string;
    type?: 'direct' | 'concept';
    difficulty?: string;
    expected_keywords?: string[];
    page_range?: string;
}

/** Voice Assessment Response from backend */
export interface AssessmentResponse {
    questions: string[] | AssessmentQuestion[];
    chapter: number;
    subject: string;
    total?: number;
    page_range?: string;
    cached?: boolean;
}

export interface VoiceAnswer {
    question: string;
    answer: string;
    timestamp?: string;
}

export interface AssessmentEvaluationResponse {
    score: number;
    feedback: string;
    strengths: string[];
    improvements: string[];
    question_scores: {
        question_num: number;
        score: number;
        hint: string;
    }[];
    topics_to_study: string[];
}

export const assessmentsService = {
    /** Generate simple assessment questions (1-5 questions) */
    async generateQuestions(classLevel: number, subject: string, chapter: number, numQuestions = 3): Promise<AssessmentResponse> {
        const { data } = await apiClient.post<AssessmentResponse>('/api/assessment/questions', {
            class_level: classLevel,
            subject,
            chapter,
            num_questions: numQuestions
        });
        return data;
    },

    /** Generate enhanced assessment questions (15 questions for 10-page interval) */
    async generateEnhancedQuestions(payload: {
        class_level: number;
        subject: string;
        chapter: number;
        lesson_name: string;
        page_range: string;
        student_id: string;
        force_regenerate?: boolean;
    }): Promise<any> {
        const { data } = await apiClient.post('/api/assessment/questions/enhanced', payload);
        return data;
    },

    /** Evaluate voice assessment answers */
    async evaluateAnswers(payload: {
        class_level: number;
        subject: string;
        chapter: number;
        answers: VoiceAnswer[];
    }): Promise<AssessmentEvaluationResponse> {
        const { data } = await apiClient.post<AssessmentEvaluationResponse>('/api/assessment/evaluate', payload);
        return data;
    },
};
