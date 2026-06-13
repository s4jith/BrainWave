"use client";

import { useUserStore } from "@stores/userStore";
import { LoadingSpinner } from "@components/feedback/LoadingSpinner";
import { ErrorState } from "@components/feedback/ErrorState";
import { StickyNotesCard } from "@components/dashboard/StickyNotesCard";
import { StatCard } from "./StatCard";
import { useStudentDashboard, useStudentStreak } from "../hooks/useDashboard";

export function StudentDashboard() {
  const userId = useUserStore((s) => s.user.user_id);
  const name = useUserStore((s) => s.user.name);
  const dashboard = useStudentDashboard(userId);
  const streak = useStudentStreak(userId);

  if (dashboard.isLoading) return <LoadingSpinner />;
  if (dashboard.isError) {
    return <ErrorState title="Couldn't load your dashboard" message={dashboard.error?.message} />;
  }

  const data = dashboard.data ?? {};

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">
          Welcome back{name ? `, ${name}` : ""}
        </h1>
        <p className="mt-1 text-slate-500">Here's your learning snapshot.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Current streak"
          value={streak.data?.current_streak ?? 0}
          hint="days in a row"
        />
        <StatCard label="Total tests" value={Number(data.total_tests ?? 0)} />
        <StatCard
          label="Average score"
          value={`${Math.round(Number(data.average_score ?? 0))}%`}
        />
        <StatCard label="Class" value={data.class_level ?? "—"} />
      </div>

      <StickyNotesCard />
    </div>
  );
}
