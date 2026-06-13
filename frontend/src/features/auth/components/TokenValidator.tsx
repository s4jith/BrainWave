"use client";

import { ReactNode } from "react";
import { useAuthSession } from "../hooks/useAuthSession";

/**
 * Wraps protected sections of the app. Renders nothing until the
 * stored token has been validated against /api/auth/me.
 */
export function TokenValidator({ children }: { children: ReactNode }) {
  const { validated } = useAuthSession();
  if (!validated) return null;
  return <>{children}</>;
}
