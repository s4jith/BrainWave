"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUserStore } from "@stores/userStore";
import { useMaintenanceMode } from "../hooks/useMaintenanceMode";
import { AuthService } from "@services/AuthService";
import type { UserRole } from "@/types/user";

interface GuardProps {
  children: ReactNode;
}

/**
 * ProtectedRoute — requires authentication. Optionally restricts to a role set.
 * Non-matching roles are bounced to their default dashboard rather than /login,
 * matching the existing app's UX.
 */
export function ProtectedRoute({
  children,
  allowedRoles,
}: GuardProps & { allowedRoles?: UserRole[] }) {
  const { isAuthenticated, user } = useUserStore();
  const { maintenance, checked } = useMaintenanceMode();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (allowedRoles && user.role && !allowedRoles.includes(user.role)) {
      router.replace(AuthService.defaultRouteForRole(user.role));
    }
  }, [isAuthenticated, allowedRoles, user.role, router]);

  if (!isAuthenticated) return null;
  if (allowedRoles && user.role && !allowedRoles.includes(user.role)) return null;
  if (checked && maintenance && user.role !== "admin") {
    return <MaintenanceBlock />;
  }
  return <>{children}</>;
}

/**
 * PublicRoute — bounces authenticated users to their role's dashboard.
 */
export function PublicRoute({ children }: GuardProps) {
  const { isAuthenticated, user } = useUserStore();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(AuthService.defaultRouteForRole(user.role));
    }
  }, [isAuthenticated, user.role, router]);

  if (isAuthenticated) return null;
  return <>{children}</>;
}

/** StaffRoute — admin, teacher, or head. */
export function StaffRoute({ children }: GuardProps) {
  return (
    <ProtectedRoute allowedRoles={["admin", "teacher", "head"]}>
      {children}
    </ProtectedRoute>
  );
}

function MaintenanceBlock() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8 text-center">
      <h1 className="mb-2 text-3xl font-bold text-slate-900">Under Maintenance</h1>
      <p className="max-w-md text-slate-600">
        We're making some improvements. Please check back shortly.
      </p>
    </div>
  );
}

/** Convenience: re-export usePathname for guards that want to gate per-path. */
export { usePathname };
