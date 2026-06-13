"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardSubtitle, CardTitle } from "@components/ui/Card";
import { ProtectedRoute } from "@features/auth/components/RouteGuards";
import { DashboardLayout } from "@layouts/DashboardLayout";
import { LoadingSpinner } from "@components/feedback/LoadingSpinner";
import { ErrorState } from "@components/feedback/ErrorState";
import { useUserStore } from "@stores/userStore";
import { TestService } from "@services/TestService";
import { queryKeys } from "@constants/queryKeys";

export default function ReportCardPage() {
  const userId = useUserStore((s) => s.user.user_id);
  const classLevel = useUserStore((s) => s.user.classLevel) ?? 10;

  const analytics = useQuery({
    queryKey: queryKeys.test.analytics(userId ?? "", classLevel),
    queryFn: () => TestService.getAnalytics(userId!, classLevel),
    enabled: Boolean(userId),
  });

  return (
    <ProtectedRoute allowedRoles={["student"]}>
      <DashboardLayout>
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Report Card</h1>
          <p className="text-sm text-slate-500">Your performance across subjects.</p>
        </header>
        {analytics.isLoading ? (
          <LoadingSpinner />
        ) : analytics.isError ? (
          <ErrorState message={analytics.error?.message} />
        ) : (
          <Card>
            <CardTitle>Summary</CardTitle>
            <CardSubtitle>Class {classLevel}</CardSubtitle>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
              {JSON.stringify(analytics.data ?? {}, null, 2)}
            </pre>
          </Card>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
