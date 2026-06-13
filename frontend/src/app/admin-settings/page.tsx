"use client";

import { Card, CardSubtitle, CardTitle } from "@components/ui/Card";
import { ProtectedRoute } from "@features/auth/components/RouteGuards";
import { DashboardLayout } from "@layouts/DashboardLayout";

export default function AdminSettingsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <DashboardLayout>
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Admin Settings</h1>
          <p className="text-sm text-slate-500">Configure platform-wide options.</p>
        </header>
        <Card>
          <CardTitle>Coming soon</CardTitle>
          <CardSubtitle>Settings UI is being migrated.</CardSubtitle>
        </Card>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
