"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TestService } from "@services/TestService";
import { queryKeys } from "@constants/queryKeys";
import type { StartTestParams, TestSession } from "@repositories/TestRepository";

export function useSubjects(classLevel: number) {
  return useQuery({
    queryKey: queryKeys.test.subjects(classLevel),
    queryFn: () => TestService.getSubjects(classLevel),
  });
}

export function useChapters(
  classLevel: number,
  subject: string | null,
  studentId?: string,
) {
  return useQuery({
    queryKey: queryKeys.test.chapters(classLevel, subject ?? "", studentId),
    queryFn: () => TestService.getChapters(classLevel, subject!, studentId),
    enabled: Boolean(subject),
  });
}

export function useTopics(
  classLevel: number,
  subject: string | null,
  chapterNumber: number | null,
  studentId?: string,
) {
  return useQuery({
    queryKey: queryKeys.test.topics(
      classLevel,
      subject ?? "",
      chapterNumber ?? 0,
      studentId,
    ),
    queryFn: () =>
      TestService.getTopics(classLevel, subject!, chapterNumber!, studentId),
    enabled: Boolean(subject && chapterNumber),
  });
}

export function useTestHistory(studentId: string | null, limit = 20) {
  return useQuery({
    queryKey: queryKeys.test.history(studentId ?? "", limit),
    queryFn: () => TestService.getHistory(studentId!, limit),
    enabled: Boolean(studentId),
  });
}

export function useStartTopicTest() {
  return useMutation<TestSession, Error, StartTestParams>({
    mutationFn: (params) => TestService.startTopicTest(params),
  });
}

export function useStartChapterTest() {
  return useMutation<TestSession, Error, StartTestParams>({
    mutationFn: (params) => TestService.startChapterTest(params),
  });
}

export function useCompleteTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      sessionId: string;
      studentId: string;
      answers: Array<Record<string, unknown>>;
    }) => TestService.completeTest(input.sessionId, input.studentId, input.answers),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.test.history(variables.studentId) });
    },
  });
}
