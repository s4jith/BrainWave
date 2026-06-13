"use client";

import { Suspense } from "react";
import { ProtectedRoute } from "@features/auth/components/RouteGuards";
import { DashboardLayout } from "@layouts/DashboardLayout";
import { TestSessionView } from "@features/test/components/TestSession";
import { LoadingSpinner } from "@components/feedback/LoadingSpinner";

export default function TestSessionPage() {
  return (
    <ProtectedRoute allowedRoles={["student"]}>
      <DashboardLayout>
        <Suspense fallback={<LoadingSpinner />}>
          <TestSessionView />
        </Suspense>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
