"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@stores/userStore";
import { AuthRepository } from "@repositories/AuthRepository";
import { getJwtExpiryMs } from "@utils/jwt";
import { ApiError } from "@core/errors/ApiError";

/**
 * useAuthSession — validates the current JWT on mount.
 * Mirrors the existing TokenValidator behavior:
 * - if `exp` already passed, force logout
 * - schedule a logout when the token actually expires
 * - verify against /api/auth/me once; 401/403 -> logout
 */
export function useAuthSession() {
  const router = useRouter();
  const { isAuthenticated, accessToken, logout } = useUserStore();
  const [validated, setValidated] = useState(false);

  useEffect(() => {
    setValidated(false);

    if (!isAuthenticated || !accessToken) {
      setValidated(true);
      return;
    }

    const expiryMs = getJwtExpiryMs(accessToken);
    if (expiryMs && Date.now() >= expiryMs) {
      logout();
      router.replace("/login");
      setValidated(true);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    if (expiryMs && expiryMs > Date.now()) {
      timer = setTimeout(() => {
        logout();
        router.replace("/login");
      }, expiryMs - Date.now());
    }

    AuthRepository.me()
      .catch((err) => {
        if (ApiError.isApiError(err) && (err.status === 401 || err.status === 403)) {
          logout();
          router.replace("/login");
        }
      })
      .finally(() => setValidated(true));

    return () => {
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, accessToken]);

  return { validated, isAuthenticated };
}
