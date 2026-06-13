"use client";

import { ProtectedRoute } from "@features/auth/components/RouteGuards";
import { DashboardLayout } from "@layouts/DashboardLayout";
import { TeacherDashboard } from "@features/teacher/components/TeacherDashboard";

export default function TeacherDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["teacher"]}>
      <DashboardLayout>
        <TeacherDashboard />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
