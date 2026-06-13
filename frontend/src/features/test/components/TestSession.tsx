"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardTitle } from "@components/ui/Card";
import { Button } from "@components/ui/Button";
import { LoadingSpinner } from "@components/feedback/LoadingSpinner";
import { ErrorState } from "@components/feedback/ErrorState";
import { useUserStore } from "@stores/userStore";
import { TestService } from "@services/TestService";
import { useCompleteTest } from "../hooks/useTestCatalog";

/**
 * Loads a test session by sessionId. Backend doesn't expose a "get-session"
 * endpoint directly, but `getResult` works once started, and the questions
 * are returned by the start endpoint. We rely on session state in URL +
 * progressively-stored answers in component state.
 */
export function TestSessionView() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("sessionId") ?? "";
  const studentId = useUserStore((s) => s.user.user_id);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const sessionQ = useQuery({
    queryKey: ["test", "session", sessionId],
    queryFn: () => TestService.getResult(sessionId),
    enabled: Boolean(sessionId),
    retry: false,
  });

  const completeTest = useCompleteTest();

  const questions = useMemo(() => {
    const data = sessionQ.data;
    const raw = (data as unknown as { questions?: unknown[] } | null)?.questions ?? [];
    return raw as Array<Record<string, unknown>>;
  }, [sessionQ.data]);

  useEffect(() => {
    if (!sessionId) router.replace("/test");
  }, [sessionId, router]);

  if (sessionQ.isLoading) return <LoadingSpinner />;
  if (sessionQ.isError) {
    return <ErrorState title="Couldn't load this test" message={sessionQ.error?.message} />;
  }
  if (questions.length === 0) {
    return <ErrorState title="No questions found" message="This session has no questions yet." />;
  }

  const q = questions[current] as {
    question_text?: string;
    options?: string[];
    question_number?: number;
  };

  function setAnswer(value: string) {
    setAnswers((prev) => ({ ...prev, [current]: value }));
  }

  async function submit() {
    if (!studentId) return;
    const payload = Object.entries(answers).map(([idx, ans]) => ({
      question_number: Number(idx) + 1,
      answer: ans,
    }));
    completeTest.mutate(
      { sessionId, studentId, answers: payload },
      {
        onSuccess: () => router.replace(`/test-result?sessionId=${sessionId}`),
      },
    );
  }

  const isLast = current === questions.length - 1;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Question {current + 1} of {questions.length}
        </p>
        <p className="text-sm text-slate-500">{Object.keys(answers).length} answered</p>
      </div>
      <Card>
        <CardTitle>{q?.question_text ?? "—"}</CardTitle>
        {Array.isArray(q?.options) && q.options.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {q.options.map((opt, i) => {
              const checked = answers[current] === opt;
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setAnswer(opt)}
                    className={
                      "w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors " +
                      (checked
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
                    }
                  >
                    {opt}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <textarea
            className="mt-4 h-32 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="Type your answer..."
            value={answers[current] ?? ""}
            onChange={(e) => setAnswer(e.target.value)}
          />
        )}
      </Card>
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
        >
          Previous
        </Button>
        {isLast ? (
          <Button onClick={submit} loading={completeTest.isPending}>
            Submit test
          </Button>
        ) : (
          <Button onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
