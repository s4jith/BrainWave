// ─── Generic API Shapes ────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
    data: T;
    message?: string;
    success: boolean;
    error?: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    page_size: number;
}

export interface ApiError {
    detail: string;
    status_code: number;
}

// ─── Auth (/api/auth) ──────────────────────────────────────────────────────────

export interface User {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'head' | 'teacher' | 'student';
    class_level?: number;
    subjects?: string[];
    is_active: boolean;
    permissions?: string[];
}

export interface LoginResponse {
    success: boolean;
    first_login: boolean;
    user_id: string;
    session_id: string;
    access_token: string;
    token_type: string;
    user: User;
    error?: string;
}

// ─── Book Management (/api/books) ──────────────────────────────────────────────

export interface BookResponse {
    id: string;
    title: string;
    subject: string;
    class_level: number;
    description?: string;
    filename?: string;        // original upload filename
    pdf_filename?: string;
    pdf_url?: string;
    has_embeddings: boolean;
    embedding_count: number;
    file_size?: number;       // bytes
    uploaded_at?: string;     // ISO string when uploaded by admin
    chapters: ChapterSummary[];
    created_at: string;
    updated_at: string;
}

export interface ChapterSummary {
    book_id: string;
    chapter_number: number;
    title: string;
    description?: string;
}

export interface Flashcard {
    question: string;
    answer: string;
    subject: string;
    class_level: number;
}

export interface SmartNote {
    id: string;
    user_id: string;
    subject: string;
    class_level: number;
    title: string;
    content: string;
    created_at: string;
}

// ─── Curriculum (/api/curriculum) ─────────────────────────────────────────────

export interface SubjectSummary {
    id: string;
    name: string;
    class_level: number;
    is_active: boolean;
    icon?: string;
    color?: string;
    board?: string;
    total_chapters?: number;   // populated by API when summarising curriculum
}

export interface ChapterSummaryItem {
    id: string;
    chapter_number: number;
    title: string;
    has_summary: boolean;
}

export interface TopicSummary {
    id: string;
    name: string;
    description?: string;
    page_range?: string;
    is_active: boolean;
}

export interface PendingCurriculumItem {
    id: string;
    subject_name: string;
    class_level: number;
    board: string;
    uploaded_by: string;
    status: 'pending' | 'approved' | 'rejected';
    extracted_chapters: ExtractedChapter[];
    created_at: string;
}

export interface ExtractedChapter {
    chapter_number: number;
    title: string;
    topics: string[];
}

// ─── User Stats (/api/user) ────────────────────────────────────────────────────

export interface DailyActivity {
    day: string;
    active: boolean;
    hours: number;
    date: string;
}

export interface StreakData {
    current_streak: number;
    longest_streak: number;
    weekly_activity: DailyActivity[];
    last_activity_date: string;
}

export interface ProgressData {
    overall_progress: number;
    total_tests: number;
    completed_tests: number;
    total_chapters: number;
    completed_chapters: number;
    average_score: number;
}

export interface NoteSummary {
    id: string;
    title: string;
    lesson: string;
    date: string;
    subject: string;
}

export interface DashboardData {
    streak: StreakData;
    progress: ProgressData;
    recent_notes: NoteSummary[];
    total_notes: number;
}

// ─── Student Dashboard Stats (/api/gradebook/stats/student) ────────────────────

export interface StudentDashboardStats {
    enrolled_courses: number;
    completed_assessments: number;
    average_score: number;
    upcoming_deadlines: number;
}

// ─── Student (/api/student, /api/v1/student) ───────────────────────────────────

export interface StudentGroup {
    id: string;
    name: string;
    subject: string;
    class_level: number;
    teacher_id: string;
    student_count?: number;
    teacher_name?: string;
}

export interface StudentLevelResponse {
    student_id: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    explanation_mode: string;
    updated_at: string;
}

// ─── Teacher (/api/teacher) ────────────────────────────────────────────────────

export interface TeacherQuestion {
    id: string;
    text: string;
    subject: string;
    class_level: number;
    chapter: string;
    type: QuestionType;
    difficulty: DifficultyLevel;
    marks: number;
    options?: string[];
    correct_answer: string;
}

export interface FAQ {
    id: string;
    question: string;
    answer: string;
    category: string;
    is_active: boolean;
    helpful_count: number;
    view_count: number;
}

export interface FeedbackSubmission {
    id?: string;
    type: string;
    content: string;
    user_id?: string;
    status?: string;
}

export interface Suggestion {
    id: string;
    title: string;
    description: string;
    category: string;
    upvotes: number;
}

export interface ManualQuestion {
    id: string;
    text: string;
    type: string;
    marks: number;
}

export interface DoubtHistoryItem {
    id: string;
    question: string;
    answer: string;
    timestamp: string;
}

export interface StaffTestItem {
    id: string;
    title: string;
    subject: string;
    status: string;
    created_at: string;
}

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export interface SupportTicket {
    id: string;
    subject: string;
    description: string;
    status: TicketStatus;
    priority: TicketPriority;
    created_at: string;
    updated_at: string;
}

export interface TicketReply {
    id: string;
    ticket_id: string;
    user_id: string;
    message: string;
    created_at: string;
}

export interface StreakData {
    current_streak: number;
    longest_streak: number;
    last_active: string;
}

export interface ProgressData {
    completed_topics: number;
    total_topics: number;
    average_score: number;
}

export interface DashboardData {
    recent_activity: any[];
    upcoming_tasks: any[];
}

export interface TestSubmission {
    id: string;
    test_id: string;
    student_id: string;
    score: number;
    submitted_at: string;
}



export interface StudentGroup {
    id: string;
    name: string;
    students: any[];
}

export interface CourseDetailResponse {
    id: string;
    title: string;
    description: string;
    instructor_id: string;
    modules: any[];
}

export interface Query {
    id: string;
    group_id?: string;
    subject: string;
    message: string;
    status: string;
    student_id?: string;
    student_name?: string;
    created_at: string;
    reply?: string;
    replied_at?: string;
}

export interface Assessment {
    id: string;
    title: string;
    type: string;
    class_level: number;
    subject: string;
    status: string;
    total_marks: number;
    created_at: string;
    questions?: any[];
}

export interface AssessmentSubmission {
    id: string;
    assessment_id: string;
    student_id?: string;
    answers: any[];
    score?: number;
    submitted_at: string;
}

export interface StudentLevelResponse {
    level: "beginner" | "intermediate" | "advanced";
    points: number;
}

export interface TeacherStats {
    my_questions: number;
    my_tests: number;
    evaluated: number;
    pending: number;
    total_courses?: number;
    total_students?: number;
    total_assessments?: number;
    pending_grading?: number;
    [key: string]: any;
}

// ─── AI Tests (/api/test) ──────────────────────────────────────────────────────

export interface StartTestResponse {
    session_id: string;
    topic_id: string;
    topic_name: string;
    questions: TestQuestionItem[];
    total_questions: number;
    time_limit_minutes: number;
    started_at: string;
}

export interface TestQuestionItem {
    question_number: number;
    question_id: string;
    question_text: string;
    difficulty: DifficultyLevel;
    question_type: QuestionType;
    marks: number;
    time_estimate: number;
    options?: string[];
    correct_option?: string;
}

export interface TestResult {
    session_id: string;
    student_id: string;
    score: number;
    total_marks: number;
    percentage: number;
    passed: boolean;
    answers: AnswerResult[];
    completed_at: string;
}

export interface AnswerResult {
    question_id: string;
    question_number: number;
    student_answer: string;
    correct_answer: string;
    is_correct: boolean;
    marks_awarded: number;
    feedback?: string;
}

export interface StudentAnalytics {
    total_tests_taken: number;
    tests_this_week: number;
    overall_average: number;
    best_score: number;
    topics_strong: string[];
    topics_moderate: string[];
    topics_weak: string[];
    performance_history: PerformancePoint[];
    topic_breakdown: TopicBreakdown[];
    recommendations: string[];
}

export interface PerformancePoint {
    date: string;
    score: number;
    subject: string;
}

export interface TopicBreakdown {
    topic_id: string;
    topic_name: string;
    average_score: number;
    tests_taken: number;
}

// ─── Test Management (/api/tests) ─────────────────────────────────────────────

export interface TestManagementItem {
    id: string;
    title: string;
    description: string;
    class_level: number;
    subject: string;
    pdf_filename: string;
    pdf_url: string;
    is_timed: boolean;
    start_datetime: string | null;
    end_datetime: string | null;
    duration_minutes: number | null;
    is_active: boolean;
    created_by: string;
    created_at: string;
    submission_count: number;
    status: 'active' | 'upcoming' | 'closed';
    has_submitted?: boolean;
    submission_id?: string | null;
    submission_date?: string | null;
    has_feedback?: boolean;
}

export interface HeadTestsResponse {
    tests: TestManagementItem[];
    assignment_type: 'class' | 'subject';
    assigned_classes: string[];
    assigned_subjects: string[];
}

export interface AdminDashboardStats {
    total_tests: number;
    active_tests: number;
    total_submissions: number;
    pending_review: number;
    reviewed_submissions: number;
    tests_by_class: { class_level: number; count: number }[];
    tests_by_subject: { subject: string; count: number }[];
    [key: string]: any;
}

export interface TestSubmission {
    id: string;
    test_id: string;
    test_title: string;
    student_id: string;
    student_name: string;
    student_user_id: string;
    pdf_filename: string;
    pdf_url: string;
    submitted_at: string;
    admin_comment: string;
    comment_at: string | null;
    is_reviewed: boolean;
}

// ─── Support Tickets (/api/support-tickets) ───────────────────────────────────

export interface SupportTicket {
    id: string;
    title: string;
    description: string;
    category: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: TicketStatus;
    user_id: string;
    user_name: string;
    replies: TicketReply[];
    created_at: string;
    updated_at: string;
}

export interface TicketReply {
    message: string;
    is_admin: boolean;
    author_name: string;
    created_at: string;
}

// ─── Suggestions (/api/suggestions) ──────────────────────────────────────────

export interface Suggestion {
    id: string;
    student_id: string;
    student_name: string;
    class_level: number;
    category: string;
    subject?: string;
    content: string;
    email?: string;
    status: 'pending' | 'reviewed' | 'implemented' | 'rejected';
    response?: string;
    created_at: string;
}

// ─── Notifications (/api/notifications) ───────────────────────────────────────

export interface Notification {
    id: string;
    title: string;
    message: string;
    type: string;
    is_read: boolean;
    is_saved?: boolean;
    created_at: string;
    test_id?: string;
    submission_id?: string;
}

export interface NotificationsResponse {
    notifications: Notification[];
    total: number;
    unread_count: number;
}

// ─── Question Bank (/api/question-bank) ───────────────────────────────────────

export interface QuestionBankItem {
    id: string;
    text: string;
    subject: string;
    class_level: number;
    chapter: number;
    topic?: string;
    type: QuestionType;
    difficulty: DifficultyLevel;
    marks: number;
    options: string[];
    correct_answer: string;
    status: QuestionStatus;
    teacher_id?: string;
    created_by?: string;
    is_ai_generated?: boolean;
    created_at: string;
}

export interface QuestionBankResponse {
    questions: QuestionBankItem[];
    total: number;
    page: number;
    pages: number;
}

export interface DeleteRequest {
    id: string;
    question_id: string;
    question_text: string;
    question_subject: string;
    question_class_level: number;
    teacher_id: string;
    teacher_name: string;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    resolved_at?: string;
}

// ─── Head Dashboard (/api/head) ───────────────────────────────────────────────

export interface HeadDashboardStats {
    total_students: number;
    total_teachers: number;
    total_classes: number;
    total_subjects: number;
    recent_activity: any[];
}

export interface HeadStats {
    pending_questions: number;
    total_approved: number;
    total_rejected: number;
    total_papers: number;
}

export interface QuestionPaper {
    id: string;
    title: string;
    subject: string;
    class_level: number;
    status: string;
    created_by: string;
    created_at: string;
    question_count?: number;
    total_marks?: number;
}

// ─── Chat / AI Bot ─────────────────────────────────────────────────────────────

export interface ChatMessage {
    id?: number | string;
    role: 'user' | 'assistant' | 'system';
    content: string | import('react').ReactNode;
    timestamp: Date | string;
    mode?: string;
    isStreaming?: boolean;
    isError?: boolean;
    imagePreview?: string | null;
    imageAnalysis?: string;
}

export interface ChatResponse {
    success: boolean;
    answer: string;
    imageAnalysis?: string;
}

// ─── Top Questions (/api/top-questions) ───────────────────────────────────────

export interface TopQuestion {
    id: string;
    question: string;
    answer: string;
    subject: string;
    topic: string;
    chapter: string;
    class_level: number;
    frequency: number;
}

// ─── Courses (/api/courses) ────────────────────────────────────────────────────

export interface CourseResponse {
    id: string;
    title: string;
    description: string;
    category: string;
    difficulty: DifficultyLevel;
    class_level?: number;
    tags?: string[];
    is_published: boolean;
    total_modules: number;
    total_enrolled: number;
    average_rating: number;
    instructor_id: string;
    created_at: string;
}

// ─── Assessments (/api/assessments) ───────────────────────────────────────────

export interface Assessment {
    id: string;
    course_id: string;
    title: string;
    description?: string;
    assessment_type: 'quiz' | 'assignment' | 'exam';
    time_limit_minutes?: number;
    max_attempts?: number;
    passing_score?: number;
    is_published: boolean;
}

// ─── Gradebook (/api/gradebook) ───────────────────────────────────────────────

export interface GradeEntry {
    id: string;
    source: 'staff_test' | 'ai_test';
    assessment_id?: string;
    title: string;
    type: string;
    subject: string;
    chapter_name?: string;
    topic_name?: string;
    score: number;
    max_score: number;
    percentage: number;
    passed: boolean;
    completed_at: string;
    evaluation_type: 'ai' | 'manual';
    evaluations: any[];
    feedback: string;
    strengths: string[];
    improvements: string[];
    total_questions?: number;
    correct_count?: number;
    topics_to_review?: string[];
    topic_analytics?: Record<string, any>;
}

export interface TopicAnalysis {
    topic: string;
    total_questions: number;
    correct: number;
    accuracy: number;
    avg_score: number;
    status: 'strong' | 'moderate' | 'weak';
}

export interface StudentGradesResponse {
    student_id: string;
    course_id?: string;
    grades: GradeEntry[];
    total_score: number;
    total_max_score: number;
    overall_percentage: number;
    grade_count: number;
    topic_analysis: TopicAnalysis[];
    strong_topics: string[];
    weak_topics: string[];
}

export interface CourseAnalytics {
    course_id: string;
    course_title: string;
    total_students: number;
    total_assessments: number;
    total_submissions: number;
    average_score: number;
    pass_rate: number;
    score_distribution: Record<string, number>;
    assessment_stats: AssessmentBreakdown[];
}

export interface AssessmentBreakdown {
    assessment_id: string;
    title: string;
    type: string;
    submission_count: number;
    average_score: number;
    highest_score: number;
    lowest_score: number;
}

// ─── Shared Literals ──────────────────────────────────────────────────────────

export type QuestionType = 'mcq' | 'fillup' | 'true_false' | 'short_answer' | 'long_answer' | 'mcq_multi' | 'essay' | 'fill_blank' | 'matching' | 'file_upload';
export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'advanced';
export type TestStatus = 'draft' | 'published' | 'closed' | 'active' | 'upcoming';
export type QuestionStatus = 'pending' | 'approved' | 'rejected' | 'archived';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

// ─── Lesson Management (/api/books/student) ──────────────────────────────────
export interface Subject {
    name: string;
    has_ai_support?: boolean;
    [key: string]: any;
}

export interface Lesson {
    id: string;
    title: string;
    description?: string;
    chapter_number?: number;
    subject?: string;
    class_level?: number;
    pdfUrl: string;
    has_ai_support?: boolean;
    [key: string]: any;
}
