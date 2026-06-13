"use client";

import { useQuery } from "@tanstack/react-query";
import { TeacherService } from "@services/TeacherService";
import { queryKeys } from "@constants/queryKeys";

export function useTeacherDashboard() {
  return useQuery({
    queryKey: queryKeys.teacher.dashboard(),
    queryFn: () => TeacherService.getDashboard(),
  });
}

export function useTeacherGroups() {
  return useQuery({
    queryKey: queryKeys.teacher.groups(),
    queryFn: () => TeacherService.getGroups(),
  });
}

export function useTeacherQueries() {
  return useQuery({
    queryKey: queryKeys.teacher.queries(),
    queryFn: () => TeacherService.getQueries(),
  });
}
