"use client";

import { ProtectedRoute } from "@features/auth/components/RouteGuards";
import { DashboardLayout } from "@layouts/DashboardLayout";
import { AdminDashboard } from "@features/admin/components/AdminDashboard";

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <DashboardLayout>
        <AdminDashboard />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
