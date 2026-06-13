import { BaseRepository } from "./BaseRepository";

export interface StartTestParams {
  student_id: string;
  class_level: number;
  subject: string;
  chapter?: number | string;
  chapter_number?: number;
  topic_id?: string;
  difficulty?: string;
  bloom_level?: string | null;
  num_questions?: number;
  mcq_count?: number;
  fillup_count?: number;
  true_false_count?: number;
  short_answer_count?: number;
  long_answer_count?: number;
  time_limit_minutes?: number | null;
  total_marks?: number;
  auto_generate?: boolean;
}

export interface TestSession {
  session_id: string;
  questions: TestQuestion[];
  time_limit_minutes?: number | null;
  total_marks?: number;
}

export interface TestQuestion {
  question_id?: string;
  question_number: number;
  question_text: string;
  question_type: string;
  options?: string[];
  marks?: number;
  difficulty?: string;
  topic?: string;
}

export interface TestHistoryEntry {
  session_id: string;
  subject: string;
  chapter?: string | number;
  score?: number;
  total_marks?: number;
  completed_at?: string;
  status?: string;
}

export interface TestResult {
  session_id: string;
  student_id: string;
  score: number;
  total_marks: number;
  correct_count: number;
  total_questions: number;
  answers: Array<Record<string, unknown>>;
  completed_at?: string;
}

export interface SubmitAnswerPayload {
  session_id: string;
  question_id?: string;
  question_number: number;
  answer: string | string[];
}

class TestRepositoryImpl extends BaseRepository {
  constructor() {
    super();
  }

  getQBSubjects(classLevel: number): Promise<string[]> {
    return this.get(`/api/test/qb-test/subjects/${classLevel}`);
  }

  getQBChapters(classLevel: number, subject: string): Promise<Array<Record<string, unknown>>> {
    return this.get(
      `/api/test/qb-test/chapters/${classLevel}/${encodeURIComponent(subject)}`,
    );
  }

  startQBTest(payload: StartTestParams): Promise<TestSession> {
    return this.post(`/api/test/qb-test/start`, payload);
  }

  getSubjects(classLevel: number): Promise<string[]> {
    return this.get(`/api/test/subjects/${classLevel}`);
  }

  getChapters(
    classLevel: number,
    subject: string,
    studentId?: string,
  ): Promise<Array<Record<string, unknown>>> {
    const q = studentId ? `?student_id=${studentId}` : "";
    return this.get(
      `/api/test/chapters/${classLevel}/${encodeURIComponent(subject)}${q}`,
    );
  }

  getTopics(
    classLevel: number,
    subject: string,
    chapterNumber: number,
    studentId?: string,
  ): Promise<Array<Record<string, unknown>>> {
    const q = studentId ? `?student_id=${studentId}` : "";
    return this.get(
      `/api/test/topics/${classLevel}/${encodeURIComponent(subject)}/${chapterNumber}${q}`,
    );
  }

  startTopicTest(payload: StartTestParams): Promise<TestSession> {
    return this.post(`/api/test/start`, payload);
  }

  startChapterTest(payload: StartTestParams): Promise<TestSession> {
    return this.post(`/api/test/start-chapter`, payload);
  }

  startTestV3(payload: StartTestParams): Promise<TestSession> {
    return this.post(`/api/test/start-v3`, payload);
  }

  startAITest(payload: StartTestParams): Promise<TestSession> {
    return this.post(`/api/test/ai-test/start`, payload);
  }

  submitAnswer(payload: SubmitAnswerPayload): Promise<unknown> {
    return this.post(`/api/test/answer`, payload);
  }

  completeTest(
    sessionId: string,
    studentId: string,
    answers: Array<Record<string, unknown>> = [],
    extra: Record<string, unknown> = {},
  ): Promise<TestResult> {
    return this.post(`/api/test/complete`, {
      session_id: sessionId,
      student_id: studentId,
      answers,
      ...extra,
    });
  }

  getHistory(studentId: string, limit = 20): Promise<TestHistoryEntry[]> {
    return this.get(`/api/test/history/${studentId}?limit=${limit}`);
  }

  getResult(sessionId: string): Promise<TestResult> {
    return this.get(`/api/test/result/${sessionId}`);
  }

  deleteHistoryEntry(sessionId: string): Promise<unknown> {
    return this.delete(`/api/test/history/${sessionId}`);
  }

  deleteAllHistory(studentId: string): Promise<unknown> {
    return this.delete(`/api/test/history/all/${studentId}`);
  }

  getAnalytics(
    studentId: string,
    classLevel = 10,
    subject?: string,
  ): Promise<Record<string, unknown> | null> {
    const params = new URLSearchParams();
    params.set("class_level", String(classLevel));
    if (subject) params.set("subject", subject);
    return this.get(`/api/test/analytics/${studentId}?${params.toString()}`);
  }

  getStaffTests(): Promise<{ assessments: Array<Record<string, unknown>> }> {
    return this.get(`/api/assessments`);
  }

  getQuestionBankStats(): Promise<Record<string, unknown>> {
    return this.get(`/api/test/question-bank/stats`);
  }

  checkQuestionsAvailable(
    classLevel: number,
    subject: string,
    chapterNumber: number,
  ): Promise<{ available: boolean; count: number }> {
    return this.get(
      `/api/test/check-questions/${classLevel}/${encodeURIComponent(subject)}/${chapterNumber}`,
    );
  }
}

export const TestRepository = new TestRepositoryImpl();
