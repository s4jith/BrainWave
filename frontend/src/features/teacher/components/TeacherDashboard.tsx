"use client";

import { Card, CardSubtitle, CardTitle } from "@components/ui/Card";
import { LoadingSpinner } from "@components/feedback/LoadingSpinner";
import { ErrorState } from "@components/feedback/ErrorState";
import { useUserStore } from "@stores/userStore";
import { useTeacherDashboard } from "../hooks/useTeacherData";

export function TeacherDashboard() {
  const name = useUserStore((s) => s.user.name);
  const dashboard = useTeacherDashboard();

  if (dashboard.isLoading) return <LoadingSpinner />;
  if (dashboard.isError) {
    return (
      <ErrorState
        title="Couldn't load teacher dashboard"
        message={dashboard.error?.message}
      />
    );
  }

  const data = dashboard.data ?? {};

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">
          Welcome{name ? `, ${name}` : ""}
        </h1>
        <p className="mt-1 text-slate-500">Teacher control center.</p>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardTitle>{Number(data.total_students ?? 0)}</CardTitle>
          <CardSubtitle>Students under you</CardSubtitle>
        </Card>
        <Card>
          <CardTitle>{Number(data.total_groups ?? 0)}</CardTitle>
          <CardSubtitle>Groups</CardSubtitle>
        </Card>
        <Card>
          <CardTitle>{Number(data.active_tests ?? 0)}</CardTitle>
          <CardSubtitle>Active tests</CardSubtitle>
        </Card>
      </div>
    </div>
  );
}
