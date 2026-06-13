"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardSubtitle, CardTitle } from "@components/ui/Card";
import { Button } from "@components/ui/Button";
import { LoadingSpinner } from "@components/feedback/LoadingSpinner";
import { ErrorState } from "@components/feedback/ErrorState";
import { useUserStore } from "@stores/userStore";
import {
  useChapters,
  useStartChapterTest,
  useSubjects,
  useTestHistory,
} from "../hooks/useTestCatalog";

interface ChapterLike {
  chapter_number?: number;
  number?: number;
  name?: string;
  title?: string;
}

function chapterNumberOf(c: ChapterLike): number {
  return c.chapter_number ?? c.number ?? 0;
}

function chapterTitleOf(c: ChapterLike): string {
  return c.name ?? c.title ?? `Chapter ${chapterNumberOf(c)}`;
}

export function TestCenter() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const studentId = user.user_id ?? null;
  const classLevel = user.classLevel ?? 10;

  const [subject, setSubject] = useState<string | null>(null);

  const subjectsQ = useSubjects(classLevel);
  const chaptersQ = useChapters(classLevel, subject, studentId ?? undefined);
  const historyQ = useTestHistory(studentId);
  const startChapter = useStartChapterTest();

  function handleStart(chapterNumber: number) {
    if (!studentId || !subject) return;
    startChapter.mutate(
      {
        student_id: studentId,
        class_level: classLevel,
        subject,
        chapter_number: chapterNumber,
      },
      {
        onSuccess: (session) => {
          router.push(`/test-session?sessionId=${session.session_id}`);
        },
      },
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Test Center</h1>
        <p className="mt-1 text-slate-500">Pick a subject, then start a chapter test.</p>
      </header>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Subjects</h2>
        {subjectsQ.isLoading ? (
          <LoadingSpinner />
        ) : subjectsQ.isError ? (
          <ErrorState message={subjectsQ.error?.message} />
        ) : (
          <div className="flex flex-wrap gap-2">
            {(subjectsQ.data ?? []).map((s) => (
              <Button
                key={s}
                variant={s === subject ? "primary" : "outline"}
                size="sm"
                onClick={() => setSubject(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        )}
      </section>

      {subject ? (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Chapters</h2>
          {chaptersQ.isLoading ? (
            <LoadingSpinner />
          ) : chaptersQ.isError ? (
            <ErrorState message={chaptersQ.error?.message} />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {(chaptersQ.data ?? []).map((c, i) => {
                const chapter = c as ChapterLike;
                const num = chapterNumberOf(chapter);
                return (
                  <Card key={`${num}-${i}`}>
                    <CardTitle>{chapterTitleOf(chapter)}</CardTitle>
                    <CardSubtitle>Chapter {num}</CardSubtitle>
                    <Button
                      className="mt-4 w-full"
                      onClick={() => handleStart(num)}
                      loading={startChapter.isPending}
                    >
                      Start test
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Recent attempts</h2>
        {historyQ.isLoading ? (
          <LoadingSpinner />
        ) : (historyQ.data ?? []).length === 0 ? (
          <Card>
            <CardSubtitle>No tests taken yet. Start one above!</CardSubtitle>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {(historyQ.data ?? []).slice(0, 5).map((entry) => (
              <Card key={entry.session_id} className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">
                    {entry.subject} · Chapter {String(entry.chapter ?? "—")}
                  </p>
                  <p className="text-xs text-slate-500">{entry.completed_at ?? ""}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-900">
                    {entry.score ?? 0}/{entry.total_marks ?? 0}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/test-result?sessionId=${entry.session_id}`)}
                  >
                    View
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
