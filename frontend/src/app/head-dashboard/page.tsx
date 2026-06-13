"use client";

import { ProtectedRoute } from "@features/auth/components/RouteGuards";
import { DashboardLayout } from "@layouts/DashboardLayout";
import { HeadDashboard } from "@features/head/components/HeadDashboard";

export default function HeadDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["head"]}>
      <DashboardLayout>
        <HeadDashboard />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
