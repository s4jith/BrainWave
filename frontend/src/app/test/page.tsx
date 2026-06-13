"use client";

import { ProtectedRoute } from "@features/auth/components/RouteGuards";
import { DashboardLayout } from "@layouts/DashboardLayout";
import { TestCenter } from "@features/test/components/TestCenter";

export default function TestCenterPage() {
  return (
    <ProtectedRoute allowedRoles={["student"]}>
      <DashboardLayout>
        <TestCenter />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
