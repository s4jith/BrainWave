"use client";

import { Card, CardSubtitle, CardTitle } from "@components/ui/Card";
import { LoadingSpinner } from "@components/feedback/LoadingSpinner";
import { ErrorState } from "@components/feedback/ErrorState";
import { ProtectedRoute } from "@features/auth/components/RouteGuards";
import { DashboardLayout } from "@layouts/DashboardLayout";
import { useHeadTests } from "@features/head/hooks/useHeadData";

export default function HeadTestsPage() {
  const q = useHeadTests();
  return (
    <ProtectedRoute allowedRoles={["head"]}>
      <DashboardLayout>
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Department Tests</h1>
          <p className="text-sm text-slate-500">Tests pending or recently approved.</p>
        </header>
        {q.isLoading ? (
          <LoadingSpinner />
        ) : q.isError ? (
          <ErrorState message={q.error?.message} />
        ) : (q.data ?? []).length === 0 ? (
          <Card>
            <CardSubtitle>No tests to review.</CardSubtitle>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(q.data ?? []).map((t, i) => {
              const item = t as { id?: string; title?: string; status?: string };
              return (
                <Card key={item.id ?? i}>
                  <CardTitle>{item.title ?? "Untitled"}</CardTitle>
                  <CardSubtitle>{item.status ?? "pending"}</CardSubtitle>
                </Card>
              );
            })}
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
