"use client";

import { ProtectedRoute } from "@features/auth/components/RouteGuards";
import { DashboardLayout } from "@layouts/DashboardLayout";
import { UserManagementTable } from "@features/admin/components/UserManagementTable";

export default function TeacherManagementPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <DashboardLayout>
        <UserManagementTable role="teacher" title="Teacher Management" />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
