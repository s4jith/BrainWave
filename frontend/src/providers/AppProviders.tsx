"use client";

import { ReactNode } from "react";
import { QueryProvider } from "./QueryProvider";
import { TokenBridge } from "./TokenBridge";
import { ThemeProvider } from "./ThemeProvider";
import { ToastProvider } from "./ToastProvider";

/**
 * Composes every cross-cutting provider in one place.
 * Render this once at the root layout.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TokenBridge>
      <QueryProvider>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </QueryProvider>
    </TokenBridge>
  );
}
