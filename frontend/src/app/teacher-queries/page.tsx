"use client";

import { Card, CardSubtitle, CardTitle } from "@components/ui/Card";
import { LoadingSpinner } from "@components/feedback/LoadingSpinner";
import { ErrorState } from "@components/feedback/ErrorState";
import { ProtectedRoute } from "@features/auth/components/RouteGuards";
import { DashboardLayout } from "@layouts/DashboardLayout";
import { useTeacherQueries } from "@features/teacher/hooks/useTeacherData";

export default function TeacherQueriesPage() {
  const q = useTeacherQueries();
  return (
    <ProtectedRoute allowedRoles={["teacher", "admin"]}>
      <DashboardLayout>
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Student Queries</h1>
          <p className="text-sm text-slate-500">Questions from your students.</p>
        </header>
        {q.isLoading ? (
          <LoadingSpinner />
        ) : q.isError ? (
          <ErrorState message={q.error?.message} />
        ) : (q.data ?? []).length === 0 ? (
          <Card>
            <CardSubtitle>No open queries.</CardSubtitle>
          </Card>
        ) : (
          <div className="space-y-3">
            {(q.data ?? []).map((item) => (
              <Card key={item.id}>
                <CardTitle>{item.student_name ?? "Anonymous student"}</CardTitle>
                <CardSubtitle>{item.question}</CardSubtitle>
                <p className="mt-2 text-xs text-slate-400">{item.created_at ?? ""}</p>
              </Card>
            ))}
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
