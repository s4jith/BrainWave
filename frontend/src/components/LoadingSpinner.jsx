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
export default function LoadingSpinner({ text = "Loading…", size = "md", color = "indigo", className = "" }) {
  const ring = {
    sm: "h-6 w-6 border-2",
    md: "h-10 w-10 border-[3px]",
    lg: "h-14 w-14 border-4",
  }[size] ?? "h-10 w-10 border-[3px]";

  const arc = {
    indigo: "border-t-indigo-500 border-r-indigo-400",
    orange: "border-t-orange-500 border-r-orange-400",
    emerald: "border-t-emerald-500 border-r-emerald-400",
    gray:   "border-t-gray-500 border-r-gray-400",
  }[color] ?? "border-t-indigo-500 border-r-indigo-400";

  const dot = {
    indigo:  "bg-indigo-400",
    orange:  "bg-orange-400",
    emerald: "bg-emerald-400",
    gray:    "bg-gray-400",
  }[color] ?? "bg-indigo-400";

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className="relative">
        {/* Base track */}
        <div className={`${ring} rounded-full border-gray-200 dark:border-gray-700`} />
        {/* Spinning arc with gradient-like look */}
        <div
          className={`${ring} absolute inset-0 rounded-full border-transparent ${arc} animate-spin`}
          style={{ animationDuration: "0.75s" }}
        />
        {/* Inner glow dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`h-1.5 w-1.5 rounded-full ${dot} animate-pulse`} />
        </div>
      </div>
      {text && (
        <p className="text-sm font-medium text-gray-400 dark:text-gray-500 animate-pulse tracking-wide">
          {text}
        </p>
      )}
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
