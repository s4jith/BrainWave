// Subjects that support RAG (AI chatbot) in the book-to-bot feature
export const SUBJECTS_WITH_RAG: string[] = [
    'Mathematics',
    'Maths',
    'Science',
    'Social Science',
    'History',
    'Geography',
    'Civics',
    'Economics',
    'English',
    'Hindi',
];

// Default lesson structure for fallback rendering
export const DEFAULT_LESSON = {
    id: 'default',
    title: 'Introduction',
    description: 'Getting started',
    pdfUrl: '',
    has_ai_support: false,
};
