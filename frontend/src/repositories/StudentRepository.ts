import { BaseRepository } from "./BaseRepository";

export interface DashboardData {
  user_id?: string;
  name?: string;
  class_level?: number;
  streak?: number;
  total_tests?: number;
  average_score?: number;
  recent_activity?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface StreakData {
  current_streak: number;
  longest_streak: number;
  last_active?: string;
}

export interface FeaturesResponse {
  features: Record<string, boolean>;
}

class StudentRepositoryImpl extends BaseRepository {
  constructor() {
    super();
  }

  getDashboard(studentId: string, subject?: string): Promise<DashboardData> {
    const query = subject ? `?subject=${encodeURIComponent(subject)}` : "";
    return this.get<DashboardData>(`/api/user/dashboard/${studentId}${query}`);
  }

  getStreak(studentId: string): Promise<StreakData> {
    return this.get<StreakData>(`/api/user/streak/${studentId}`);
  }

  getProgress(studentId: string, subject?: string): Promise<Record<string, unknown>> {
    const query = subject ? `?subject=${encodeURIComponent(subject)}` : "";
    return this.get(`/api/user/progress/${studentId}${query}`);
  }

  logActivity(studentId: string, hours = 0.5): Promise<unknown> {
    return this.post(`/api/user/activity/log?student_id=${studentId}&hours=${hours}`);
  }

  getFeatures(): Promise<FeaturesResponse> {
    return this.get<FeaturesResponse>(`/api/student/my-features`);
  }
}

export const StudentRepository = new StudentRepositoryImpl();
