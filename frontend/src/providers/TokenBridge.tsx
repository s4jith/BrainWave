"use client";

import { ReactNode, useEffect } from "react";
import { tokenStorage } from "@core/auth/tokenStorage";
import { useUserStore } from "@stores/userStore";

/**
 * Bridges the Zustand userStore into the framework-agnostic tokenStorage
 * used by the HTTP client. Runs once on mount; safe to render multiple
 * times because handlers are last-write-wins.
 */
export function TokenBridge({ children }: { children: ReactNode }) {
  useEffect(() => {
    tokenStorage.registerGetter(() => useUserStore.getState().accessToken);

    tokenStorage.registerUnauthorizedHandler(() => {
      useUserStore.getState().logout();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    });
  }, []);

  return <>{children}</>;
}
