"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardSubtitle, CardTitle } from "@components/ui/Card";
import { LoadingSpinner } from "@components/feedback/LoadingSpinner";
import { ErrorState } from "@components/feedback/ErrorState";
import { ProtectedRoute } from "@features/auth/components/RouteGuards";
import { DashboardLayout } from "@layouts/DashboardLayout";
import { HeadService } from "@services/HeadService";
import { queryKeys } from "@constants/queryKeys";

export default function HeadReportsPage() {
  const q = useQuery({
    queryKey: queryKeys.head.reports(),
    queryFn: () => HeadService.getReports(),
  });
  return (
    <ProtectedRoute allowedRoles={["head"]}>
      <DashboardLayout>
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Department Reports</h1>
          <p className="text-sm text-slate-500">Performance analytics across your department.</p>
        </header>
        {q.isLoading ? (
          <LoadingSpinner />
        ) : q.isError ? (
          <ErrorState message={q.error?.message} />
        ) : (
          <Card>
            <CardTitle>Summary</CardTitle>
            <CardSubtitle>Latest aggregated reports.</CardSubtitle>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
              {JSON.stringify(q.data ?? {}, null, 2)}
            </pre>
          </Card>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
