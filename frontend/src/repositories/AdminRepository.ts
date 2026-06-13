import { BaseRepository } from "./BaseRepository";

export interface AdminDashboardData {
  total_students?: number;
  total_teachers?: number;
  total_tests?: number;
  active_users?: number;
  [key: string]: unknown;
}

export interface AdminUser {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  class_level?: number | null;
  is_active?: boolean;
  created_at?: string;
}

export interface CreateTeacherPayload {
  name: string;
  email: string;
  subjects?: string[];
}

class AdminRepositoryImpl extends BaseRepository {
  constructor() {
    super();
  }

  getDashboard(): Promise<AdminDashboardData> {
    return this.get(`/api/admin/dashboard`);
  }

  listUsers(role?: string): Promise<{ users: AdminUser[] }> {
    const q = role ? `?role=${role}` : "";
    return this.get(`/api/auth/admin/users${q}`);
  }

  toggleUserActive(userId: string): Promise<{ success: boolean }> {
    return this.patch(`/api/auth/admin/users/${userId}/toggle-active`);
  }

  createTeacher(payload: CreateTeacherPayload): Promise<{ success: boolean; user?: AdminUser }> {
    return this.post(`/api/auth/admin/create-teacher`, payload);
  }

  getSuggestions(): Promise<Array<Record<string, unknown>>> {
    return this.get(`/api/admin/suggestions`);
  }

  getReports(): Promise<Record<string, unknown>> {
    return this.get(`/api/admin/reports`);
  }
}

export const AdminRepository = new AdminRepositoryImpl();
