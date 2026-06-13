"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminService } from "@services/AdminService";
import { queryKeys } from "@constants/queryKeys";
import type { AdminUser } from "@repositories/AdminRepository";

export function useAdminDashboard() {
  return useQuery({
    queryKey: queryKeys.admin.dashboard(),
    queryFn: () => AdminService.getDashboard(),
  });
}

export function useAdminUsers(role?: string) {
  return useQuery({
    queryKey: queryKeys.admin.users(role),
    queryFn: () => AdminService.listUsers(role),
  });
}

export function useToggleUserActive(role?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => AdminService.toggleUserActive(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.users(role) });
    },
  });
}

export function useAdminUserById(users: AdminUser[] | undefined, id: string) {
  return users?.find((u) => u.id === id || u.user_id === id);
}
