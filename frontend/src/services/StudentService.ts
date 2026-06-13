import { StudentRepository } from "@repositories/StudentRepository";

export const StudentService = {
  getDashboard: StudentRepository.getDashboard.bind(StudentRepository),
  getStreak: StudentRepository.getStreak.bind(StudentRepository),
  getProgress: StudentRepository.getProgress.bind(StudentRepository),
  logActivity: StudentRepository.logActivity.bind(StudentRepository),
  getFeatures: StudentRepository.getFeatures.bind(StudentRepository),
};
