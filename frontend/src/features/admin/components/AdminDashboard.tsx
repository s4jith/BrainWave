"use client";

import { Card, CardSubtitle, CardTitle } from "@components/ui/Card";
import { LoadingSpinner } from "@components/feedback/LoadingSpinner";
import { ErrorState } from "@components/feedback/ErrorState";
import { useAdminDashboard } from "../hooks/useAdminData";

export function AdminDashboard() {
  const q = useAdminDashboard();
  if (q.isLoading) return <LoadingSpinner />;
  if (q.isError) return <ErrorState message={q.error?.message} />;
  const data = q.data ?? {};

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Admin Control Center</h1>
        <p className="mt-1 text-slate-500">Platform-wide overview.</p>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardTitle>{Number(data.total_students ?? 0)}</CardTitle>
          <CardSubtitle>Students</CardSubtitle>
        </Card>
        <Card>
          <CardTitle>{Number(data.total_teachers ?? 0)}</CardTitle>
          <CardSubtitle>Teachers</CardSubtitle>
        </Card>
        <Card>
          <CardTitle>{Number(data.total_tests ?? 0)}</CardTitle>
          <CardSubtitle>Total tests</CardSubtitle>
        </Card>
        <Card>
          <CardTitle>{Number(data.active_users ?? 0)}</CardTitle>
          <CardSubtitle>Active users</CardSubtitle>
        </Card>
      </div>
    </div>
  );
}
