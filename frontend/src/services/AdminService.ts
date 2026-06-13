import { AdminRepository } from "@repositories/AdminRepository";

export const AdminService = {
  getDashboard: AdminRepository.getDashboard.bind(AdminRepository),
  listUsers: AdminRepository.listUsers.bind(AdminRepository),
  toggleUserActive: AdminRepository.toggleUserActive.bind(AdminRepository),
  createTeacher: AdminRepository.createTeacher.bind(AdminRepository),
  getSuggestions: AdminRepository.getSuggestions.bind(AdminRepository),
  getReports: AdminRepository.getReports.bind(AdminRepository),
};
