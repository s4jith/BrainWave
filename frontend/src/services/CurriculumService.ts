import { CurriculumRepository } from "@repositories/CurriculumRepository";

export const CurriculumService = {
  listSubjects: CurriculumRepository.listSubjects.bind(CurriculumRepository),
  getSubject: CurriculumRepository.getSubject.bind(CurriculumRepository),
};
