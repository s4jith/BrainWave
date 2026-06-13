"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@constants/queryKeys";
import { AuthService } from "@services/AuthService";

export function useMaintenanceMode() {
  const { data, isSuccess } = useQuery({
    queryKey: queryKeys.auth.maintenance(),
    queryFn: () => AuthService.fetchMaintenance(),
    staleTime: 60_000,
  });

  return {
    maintenance: data ?? false,
    checked: isSuccess,
  };
}
