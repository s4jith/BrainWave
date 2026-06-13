import { TeacherRepository } from "@repositories/TeacherRepository";

export const TeacherService = {
  getDashboard: TeacherRepository.getDashboard.bind(TeacherRepository),
  getGroups: TeacherRepository.getGroups.bind(TeacherRepository),
  getQueries: TeacherRepository.getQueries.bind(TeacherRepository),
  getReports: TeacherRepository.getReports.bind(TeacherRepository),
};
