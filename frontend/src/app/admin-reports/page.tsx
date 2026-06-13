"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardSubtitle, CardTitle } from "@components/ui/Card";
import { LoadingSpinner } from "@components/feedback/LoadingSpinner";
import { ErrorState } from "@components/feedback/ErrorState";
import { ProtectedRoute } from "@features/auth/components/RouteGuards";
import { DashboardLayout } from "@layouts/DashboardLayout";
import { AdminService } from "@services/AdminService";
import { queryKeys } from "@constants/queryKeys";

export default function AdminReportsPage() {
  const q = useQuery({
    queryKey: queryKeys.admin.reports(),
    queryFn: () => AdminService.getReports(),
  });
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <DashboardLayout>
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Admin Reports</h1>
          <p className="text-sm text-slate-500">Platform-wide analytics.</p>
        </header>
        {q.isLoading ? (
          <LoadingSpinner />
        ) : q.isError ? (
          <ErrorState message={q.error?.message} />
        ) : (
          <Card>
            <CardTitle>Summary</CardTitle>
            <CardSubtitle>Latest aggregated data.</CardSubtitle>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
              {JSON.stringify(q.data ?? {}, null, 2)}
            </pre>
          </Card>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
