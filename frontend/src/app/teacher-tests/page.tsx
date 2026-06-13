"use client";

import { ProtectedRoute } from "@features/auth/components/RouteGuards";
import { DashboardLayout } from "@layouts/DashboardLayout";
import { TestManagement } from "@features/teacher/components/TestManagement";

export default function TeacherTestsPage() {
  return (
    <ProtectedRoute allowedRoles={["teacher", "admin", "head"]}>
      <DashboardLayout>
        <TestManagement />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
