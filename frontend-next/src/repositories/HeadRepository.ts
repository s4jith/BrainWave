import { BaseRepository } from "./BaseRepository";

export interface HeadDashboardData {
  total_students?: number;
  total_teachers?: number;
  pending_approvals?: number;
  [key: string]: unknown;
}

class HeadRepositoryImpl extends BaseRepository {
  constructor() {
    super();
  }

  getDashboard(): Promise<HeadDashboardData> {
    return this.get(`/api/head-approval/dashboard`);
  }

  getGroups(): Promise<Array<Record<string, unknown>>> {
    return this.get(`/api/head-approval/groups`);
  }

  getReports(): Promise<Record<string, unknown>> {
    return this.get(`/api/head-approval/reports`);
  }

  getTests(): Promise<Array<Record<string, unknown>>> {
    return this.get(`/api/head-approval/tests`);
  }
}

export const HeadRepository = new HeadRepositoryImpl();
