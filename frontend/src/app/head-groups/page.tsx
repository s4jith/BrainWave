"use client";

import { Card, CardSubtitle, CardTitle } from "@components/ui/Card";
import { LoadingSpinner } from "@components/feedback/LoadingSpinner";
import { ErrorState } from "@components/feedback/ErrorState";
import { ProtectedRoute } from "@features/auth/components/RouteGuards";
import { DashboardLayout } from "@layouts/DashboardLayout";
import { useHeadGroups } from "@features/head/hooks/useHeadData";

export default function HeadGroupsPage() {
  const q = useHeadGroups();
  return (
    <ProtectedRoute allowedRoles={["head"]}>
      <DashboardLayout>
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Department Groups</h1>
          <p className="text-sm text-slate-500">Groups under your supervision.</p>
        </header>
        {q.isLoading ? (
          <LoadingSpinner />
        ) : q.isError ? (
          <ErrorState message={q.error?.message} />
        ) : (q.data ?? []).length === 0 ? (
          <Card>
            <CardSubtitle>No groups assigned yet.</CardSubtitle>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(q.data ?? []).map((g, i) => {
              const item = g as { id?: string; name?: string; subject?: string };
              return (
                <Card key={item.id ?? i}>
                  <CardTitle>{item.name ?? "—"}</CardTitle>
                  <CardSubtitle>{item.subject ?? "—"}</CardSubtitle>
                </Card>
              );
            })}
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
