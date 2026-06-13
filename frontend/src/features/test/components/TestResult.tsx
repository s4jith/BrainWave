"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardTitle, CardSubtitle } from "@components/ui/Card";
import { Button } from "@components/ui/Button";
import { LoadingSpinner } from "@components/feedback/LoadingSpinner";
import { ErrorState } from "@components/feedback/ErrorState";
import { TestService } from "@services/TestService";
import { queryKeys } from "@constants/queryKeys";

export function TestResultView() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("sessionId") ?? "";

  const resultQ = useQuery({
    queryKey: queryKeys.test.result(sessionId),
    queryFn: () => TestService.getResult(sessionId),
    enabled: Boolean(sessionId),
  });

  if (!sessionId) {
    return <ErrorState title="Missing session id" />;
  }
  if (resultQ.isLoading) return <LoadingSpinner />;
  if (resultQ.isError) {
    return <ErrorState title="Couldn't load result" message={resultQ.error?.message} />;
  }

  const r = resultQ.data;
  const percent = r ? Math.round((r.score / Math.max(1, r.total_marks)) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardTitle>Result</CardTitle>
        <CardSubtitle>Session {sessionId}</CardSubtitle>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Stat label="Score" value={`${r?.score ?? 0}/${r?.total_marks ?? 0}`} />
          <Stat label="Correct" value={`${r?.correct_count ?? 0}/${r?.total_questions ?? 0}`} />
          <Stat label="Percentage" value={`${percent}%`} />
        </div>
      </Card>
      <div className="flex gap-3">
        <Button onClick={() => router.replace("/test")}>Back to Test Center</Button>
        <Button variant="outline" onClick={() => router.replace("/dashboard")}>
          Dashboard
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
