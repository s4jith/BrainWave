"use client";

import { useQuery } from "@tanstack/react-query";
import { HeadService } from "@services/HeadService";
import { queryKeys } from "@constants/queryKeys";

export function useHeadDashboard() {
  return useQuery({
    queryKey: queryKeys.head.dashboard(),
    queryFn: () => HeadService.getDashboard(),
  });
}

export function useHeadGroups() {
  return useQuery({
    queryKey: queryKeys.head.groups(),
    queryFn: () => HeadService.getGroups(),
  });
}

export function useHeadTests() {
  return useQuery({
    queryKey: queryKeys.head.tests(),
    queryFn: () => HeadService.getTests(),
  });
}
