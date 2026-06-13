"use client";

import { PublicRoute } from "@features/auth/components/RouteGuards";
import { LoginForm } from "@features/auth/components/LoginForm";

export default function LoginPage() {
  return (
    <PublicRoute>
      <div className="flex min-h-screen w-full bg-white">
        <div className="hidden flex-col items-center justify-center bg-slate-50 p-12 lg:flex lg:w-1/2">
          <h1 className="text-3xl font-bold tracking-wide text-red-500">THE BRAINWAVE</h1>
          <p className="mt-4 max-w-xs text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
            Synchronizing minds with smarter learning. Built for focus, clarity, and growth.
          </p>
        </div>
        <div className="flex w-full items-center justify-center px-8 lg:w-1/2">
          <LoginForm />
        </div>
      </div>
    </PublicRoute>
  );
}
