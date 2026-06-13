import { BaseRepository } from "./BaseRepository";

export interface TeacherDashboardData {
  total_students?: number;
  total_groups?: number;
  active_tests?: number;
  recent_submissions?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface TeacherGroup {
  id: string;
  name: string;
  description?: string;
  student_count?: number;
  subject?: string;
}

export interface TeacherQuery {
  id: string;
  student_id?: string;
  student_name?: string;
  question: string;
  status?: string;
  created_at?: string;
}

class TeacherRepositoryImpl extends BaseRepository {
  constructor() {
    super();
  }

  getDashboard(): Promise<TeacherDashboardData> {
    return this.get(`/api/teacher/dashboard`);
  }

  getGroups(): Promise<TeacherGroup[]> {
    return this.get(`/api/teacher/groups`);
  }

  getQueries(): Promise<TeacherQuery[]> {
    return this.get(`/api/queries/teacher`);
  }

  getReports(): Promise<Record<string, unknown>> {
    return this.get(`/api/teacher/reports`);
  }
}

export const TeacherRepository = new TeacherRepositoryImpl();
