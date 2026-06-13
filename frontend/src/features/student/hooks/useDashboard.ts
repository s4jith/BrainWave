"use client";

import { useQuery } from "@tanstack/react-query";
import { StudentService } from "@services/StudentService";
import { queryKeys } from "@constants/queryKeys";

export function useStudentDashboard(studentId: string | null, subject?: string) {
  return useQuery({
    queryKey: queryKeys.student.dashboard(studentId ?? "", subject),
    queryFn: () => StudentService.getDashboard(studentId!, subject),
    enabled: Boolean(studentId),
  });
}

export function useStudentStreak(studentId: string | null) {
  return useQuery({
    queryKey: queryKeys.student.streak(studentId ?? ""),
    queryFn: () => StudentService.getStreak(studentId!),
    enabled: Boolean(studentId),
  });
}

export function useStudentProgress(studentId: string | null, subject?: string) {
  return useQuery({
    queryKey: queryKeys.student.progress(studentId ?? "", subject),
    queryFn: () => StudentService.getProgress(studentId!, subject),
    enabled: Boolean(studentId),
  });
}

export function useStudentFeatures() {
  return useQuery({
    queryKey: queryKeys.student.features(),
    queryFn: () => StudentService.getFeatures(),
  });
}
