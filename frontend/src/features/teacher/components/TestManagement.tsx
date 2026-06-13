"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardSubtitle, CardTitle } from "@components/ui/Card";
import { Button } from "@components/ui/Button";
import { LoadingSpinner } from "@components/feedback/LoadingSpinner";
import { ErrorState } from "@components/feedback/ErrorState";
import { TestService } from "@services/TestService";
import { queryKeys } from "@constants/queryKeys";
import { useRouter } from "next/navigation";

export function TestManagement() {
  const router = useRouter();
  const q = useQuery({
    queryKey: queryKeys.test.staffTests(),
    queryFn: () => TestService.getStaffTests(),
  });

  if (q.isLoading) return <LoadingSpinner />;
  if (q.isError) return <ErrorState message={q.error?.message} />;

  const items = q.data?.assessments ?? [];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Tests</h1>
          <p className="text-sm text-slate-500">Manage tests you've created.</p>
        </div>
        <Button onClick={() => router.push("/create-test")}>+ New Test</Button>
      </header>
      {items.length === 0 ? (
        <Card>
          <CardSubtitle>No tests yet. Create your first one.</CardSubtitle>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((test, i) => {
            const t = test as {
              id?: string;
              title?: string;
              subject?: string;
              question_count?: number;
              status?: string;
            };
            return (
              <Card key={t.id ?? i}>
                <CardTitle>{t.title ?? "Untitled"}</CardTitle>
                <CardSubtitle>
                  {t.subject ?? "—"} · {t.question_count ?? 0} questions · {t.status ?? "draft"}
                </CardSubtitle>
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/test/edit/${t.id}`)}
                  >
                    Edit
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
