import { AssessmentRepository } from "@repositories/AssessmentRepository";

export const AssessmentService = {
  list: AssessmentRepository.list.bind(AssessmentRepository),
  detail: AssessmentRepository.detail.bind(AssessmentRepository),
  create: AssessmentRepository.create.bind(AssessmentRepository),
  update: AssessmentRepository.update.bind(AssessmentRepository),
  publish: AssessmentRepository.publish.bind(AssessmentRepository),
  getEnhancedQuestions: AssessmentRepository.getEnhancedQuestions.bind(AssessmentRepository),
  evaluate: AssessmentRepository.evaluate.bind(AssessmentRepository),
};
