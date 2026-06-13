"use client";

import { Card, CardSubtitle, CardTitle } from "@components/ui/Card";
import { ProtectedRoute } from "@features/auth/components/RouteGuards";
import { DashboardLayout } from "@layouts/DashboardLayout";

export default function NotesPage() {
  return (
    <ProtectedRoute allowedRoles={["student"]}>
      <DashboardLayout>
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">My Notes</h1>
          <p className="text-sm text-slate-500">Notes you've saved across chapters.</p>
        </header>
        <Card>
          <CardTitle>Coming soon</CardTitle>
          <CardSubtitle>Notes management is wired into the Notes API but the UI is still being migrated.</CardSubtitle>
        </Card>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
