"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AuthService, type NormalizedLoginResult } from "@services/AuthService";
import { useUserStore } from "@stores/userStore";
import type { LoginFormValues } from "../schemas/auth.schemas";

export function useLogin() {
  const router = useRouter();
  const login = useUserStore((s) => s.login);

  return useMutation<NormalizedLoginResult, Error, LoginFormValues>({
    mutationFn: async (values) =>
      AuthService.login({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      }),
    onSuccess: (result) => {
      if (!result.success || !result.token || !result.user) return;
      login(result.user, result.token);
      router.replace(AuthService.defaultRouteForRole(result.user.role));
    },
  });
}
