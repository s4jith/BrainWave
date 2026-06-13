"use client";

import { Card, CardSubtitle, CardTitle } from "@components/ui/Card";
import { LoadingSpinner } from "@components/feedback/LoadingSpinner";
import { ErrorState } from "@components/feedback/ErrorState";
import { ProtectedRoute } from "@features/auth/components/RouteGuards";
import { DashboardLayout } from "@layouts/DashboardLayout";
import { useTeacherGroups } from "@features/teacher/hooks/useTeacherData";

export default function TeacherGroupsPage() {
  const q = useTeacherGroups();
  return (
    <ProtectedRoute allowedRoles={["teacher"]}>
      <DashboardLayout>
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Groups</h1>
          <p className="text-sm text-slate-500">Class groups you manage.</p>
        </header>
        {q.isLoading ? (
          <LoadingSpinner />
        ) : q.isError ? (
          <ErrorState message={q.error?.message} />
        ) : (q.data ?? []).length === 0 ? (
          <Card>
            <CardSubtitle>No groups yet.</CardSubtitle>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(q.data ?? []).map((g) => (
              <Card key={g.id}>
                <CardTitle>{g.name}</CardTitle>
                <CardSubtitle>
                  {g.subject ?? "—"} · {g.student_count ?? 0} students
                </CardSubtitle>
              </Card>
            ))}
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
