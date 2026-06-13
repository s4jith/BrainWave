import React from "react";

/**
 * Modern loading spinner variants for admin, teacher, and student pages.
 *
 * Usage:
 *   <LoadingSpinner />                      — default centered spinner + text
 *   <LoadingSpinner size="sm" text="" />    — small inline, no text
 *   <LoadingSpinner size="lg" text="Fetching data..." />
 *   <PageLoader />                          — full-page centered loader
 *   <CardLoader />                          — card-height placeholder with shimmer
 *   <SkeletonRow />                         — single shimmer row (use in lists)
 */

// ── Animated gradient ring ────────────────────────────────────────────────────
export default function LoadingSpinner({ text = "Loading…", size = "md", className = "" }) {
  const config = {
    sm: { width: "w-40", rows: 2 },
    md: { width: "w-56", rows: 3 },
    lg: { width: "w-72", rows: 4 },
  }[size] ?? { width: "w-56", rows: 3 };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className={`${config.width} max-w-full space-y-2`}>
        {Array.from({ length: config.rows }).map((_, idx) => (
          <div
            key={idx}
            className="h-3 rounded bg-gray-200 dark:bg-gray-700 shimmer"
            style={{ width: `${96 - idx * 12}%` }}
          />
        ))}
        <div className="h-2.5 w-1/2 rounded bg-gray-100 dark:bg-gray-700 shimmer" />
      </div>
      {text ? (
        <div className="text-xs font-medium text-gray-400 dark:text-gray-500 tracking-wide">
          {text}
        </div>
      ) : null}
    </div>
  );
}

// ── Full-page centered loader ─────────────────────────────────────────────────
export function PageLoader({ text = "Loading…" }) {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}

// ── Card-sized shimmer placeholder ───────────────────────────────────────────
export function CardLoader({ rows = 4, className = "" }) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 ${className}`}
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="h-9 w-9 rounded-lg bg-gray-200 dark:bg-gray-700 shimmer" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-2/5 rounded bg-gray-200 dark:bg-gray-700 shimmer" />
          <div className="h-2.5 w-1/3 rounded bg-gray-100 dark:bg-gray-750 shimmer" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div
              className="h-3 rounded bg-gray-200 dark:bg-gray-700 shimmer"
              style={{ width: `${75 + (i % 3) * 8}%` }}
            />
            {i % 2 === 0 && (
              <div className="h-2.5 w-1/2 rounded bg-gray-100 dark:bg-gray-750 shimmer" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Single shimmer row (list item placeholder) ────────────────────────────────
export function SkeletonRow({ className = "" }) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 shimmer flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-3/5 rounded bg-gray-200 dark:bg-gray-700 shimmer" />
          <div className="h-2.5 w-2/5 rounded bg-gray-100 dark:bg-gray-750 shimmer" />
        </div>
        <div className="h-6 w-16 rounded-full bg-gray-100 dark:bg-gray-700 shimmer" />
      </div>
    </div>
  );
}

// ── Stats row skeleton ────────────────────────────────────────────────────────
export function StatsSkeleton({ count = 3 }) {
  return (
    <div className={`grid grid-cols-${count} gap-4 mb-6`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700"
        >
          <div className="h-6 w-1/3 rounded bg-gray-200 dark:bg-gray-700 shimmer mb-2" />
          <div className="h-3 w-2/3 rounded bg-gray-100 dark:bg-gray-750 shimmer" />
        </div>
      ))}
    </div>
  );
}

// ── Inline table / list loader ────────────────────────────────────────────────
export function TableLoader({ rows = 5 }) {
  return (
    <div className="space-y-2 py-2">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-20 rounded-2xl bg-gray-200 dark:bg-gray-700 shimmer" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 shimmer mb-3" />
            <div className="h-8 w-16 rounded bg-gray-200 dark:bg-gray-700 shimmer mb-2" />
            <div className="h-3 w-28 rounded bg-gray-100 dark:bg-gray-700 shimmer" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-72 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
          <div className="h-5 w-40 rounded bg-gray-200 dark:bg-gray-700 shimmer mb-4" />
          <div className="h-52 rounded-lg bg-gray-100 dark:bg-gray-700 shimmer" />
        </div>
        <div className="h-72 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
          <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-700 shimmer mb-4" />
          <div className="h-52 rounded-lg bg-gray-100 dark:bg-gray-700 shimmer" />
        </div>
      </div>
      <div className="h-72 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
        <div className="h-5 w-40 rounded bg-gray-200 dark:bg-gray-700 shimmer mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="h-10 rounded bg-gray-100 dark:bg-gray-700 shimmer" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ReportsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="h-28 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
            <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 shimmer mb-3" />
            <div className="h-8 w-14 rounded bg-gray-200 dark:bg-gray-700 shimmer" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 h-72 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
          <div className="h-5 w-44 rounded bg-gray-200 dark:bg-gray-700 shimmer mb-4" />
          <div className="h-52 rounded-lg bg-gray-100 dark:bg-gray-700 shimmer" />
        </div>
        <div className="lg:col-span-2 h-72 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
          <div className="h-5 w-36 rounded bg-gray-200 dark:bg-gray-700 shimmer mb-4" />
          <div className="h-52 rounded-lg bg-gray-100 dark:bg-gray-700 shimmer" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, idx) => (
          <div key={idx} className="h-72 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
            <div className="h-5 w-40 rounded bg-gray-200 dark:bg-gray-700 shimmer mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((__, rowIdx) => (
                <div key={rowIdx} className="h-10 rounded bg-gray-100 dark:bg-gray-700 shimmer" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-end">
        <div className="h-10 w-36 rounded-lg bg-gray-200 dark:bg-gray-700 shimmer" />
      </div>
      <div className="h-14 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700" />
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={idx}>
            <div className="h-4 w-36 rounded bg-gray-200 dark:bg-gray-700 shimmer mb-2" />
            <div className="h-11 rounded-lg bg-gray-100 dark:bg-gray-700 shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}
