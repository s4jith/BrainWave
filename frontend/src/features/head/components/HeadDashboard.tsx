"use client";

import { Card, CardSubtitle, CardTitle } from "@components/ui/Card";
import { LoadingSpinner } from "@components/feedback/LoadingSpinner";
import { ErrorState } from "@components/feedback/ErrorState";
import { useHeadDashboard } from "../hooks/useHeadData";

export function HeadDashboard() {
  const q = useHeadDashboard();
  if (q.isLoading) return <LoadingSpinner />;
  if (q.isError) return <ErrorState message={q.error?.message} />;
  const data = q.data ?? {};

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Department Head</h1>
        <p className="mt-1 text-slate-500">Approvals and oversight at a glance.</p>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardTitle>{Number(data.total_students ?? 0)}</CardTitle>
          <CardSubtitle>Students</CardSubtitle>
        </Card>
        <Card>
          <CardTitle>{Number(data.total_teachers ?? 0)}</CardTitle>
          <CardSubtitle>Teachers</CardSubtitle>
        </Card>
        <Card>
          <CardTitle>{Number(data.pending_approvals ?? 0)}</CardTitle>
          <CardSubtitle>Pending approvals</CardSubtitle>
        </Card>
      </div>
    </div>
  );
}
