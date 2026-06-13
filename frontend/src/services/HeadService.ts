import { HeadRepository } from "@repositories/HeadRepository";

export const HeadService = {
  getDashboard: HeadRepository.getDashboard.bind(HeadRepository),
  getGroups: HeadRepository.getGroups.bind(HeadRepository),
  getReports: HeadRepository.getReports.bind(HeadRepository),
  getTests: HeadRepository.getTests.bind(HeadRepository),
};
