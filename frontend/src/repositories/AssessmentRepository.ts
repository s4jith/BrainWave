import { BaseRepository } from "./BaseRepository";

export interface Assessment {
  id: string;
  title: string;
  description?: string;
  subject?: string;
  class_level?: number;
  type?: string;
  status?: string;
  start_datetime?: string;
  end_datetime?: string;
  duration_minutes?: number;
  total_points?: number;
  question_count?: number;
  created_at?: string;
  instructor_id?: string;
  [key: string]: unknown;
}

class AssessmentRepositoryImpl extends BaseRepository {
  constructor() {
    super();
  }

  list(): Promise<{ assessments: Assessment[] }> {
    return this.get(`/api/assessments`);
  }

  detail(id: string): Promise<Assessment> {
    return this.get(`/api/assessments/${id}`);
  }

  create(payload: Partial<Assessment>): Promise<Assessment> {
    return this.post(`/api/assessments`, payload);
  }

  update(id: string, payload: Partial<Assessment>): Promise<Assessment> {
    return this.put(`/api/assessments/${id}`, payload);
  }

  publish(id: string): Promise<Assessment> {
    return this.post(`/api/assessments/${id}/publish`);
  }

  getEnhancedQuestions(payload: {
    class_level: number;
    subject: string;
    chapter: string | number;
    lesson_name?: string;
    page_range?: string;
    student_id?: string;
  }): Promise<unknown> {
    return this.post(`/api/assessment/questions/enhanced`, {
      ...payload,
      force_regenerate: false,
    });
  }

  evaluate(payload: {
    class_level: number;
    subject: string;
    chapter: string | number;
    answers: unknown[];
  }): Promise<unknown> {
    return this.post(`/api/assessment/evaluate`, payload);
  }
}

export const AssessmentRepository = new AssessmentRepositoryImpl();
