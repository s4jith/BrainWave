import { TestRepository } from "@repositories/TestRepository";

export const TestService = {
  getQBSubjects: TestRepository.getQBSubjects.bind(TestRepository),
  getQBChapters: TestRepository.getQBChapters.bind(TestRepository),
  startQBTest: TestRepository.startQBTest.bind(TestRepository),
  getSubjects: TestRepository.getSubjects.bind(TestRepository),
  getChapters: TestRepository.getChapters.bind(TestRepository),
  getTopics: TestRepository.getTopics.bind(TestRepository),
  startTopicTest: TestRepository.startTopicTest.bind(TestRepository),
  startChapterTest: TestRepository.startChapterTest.bind(TestRepository),
  startTestV3: TestRepository.startTestV3.bind(TestRepository),
  startAITest: TestRepository.startAITest.bind(TestRepository),
  submitAnswer: TestRepository.submitAnswer.bind(TestRepository),
  completeTest: TestRepository.completeTest.bind(TestRepository),
  getHistory: TestRepository.getHistory.bind(TestRepository),
  getResult: TestRepository.getResult.bind(TestRepository),
  deleteHistoryEntry: TestRepository.deleteHistoryEntry.bind(TestRepository),
  deleteAllHistory: TestRepository.deleteAllHistory.bind(TestRepository),
  getAnalytics: TestRepository.getAnalytics.bind(TestRepository),
  getStaffTests: TestRepository.getStaffTests.bind(TestRepository),
  checkQuestionsAvailable: TestRepository.checkQuestionsAvailable.bind(TestRepository),
  getQuestionBankStats: TestRepository.getQuestionBankStats.bind(TestRepository),
};
