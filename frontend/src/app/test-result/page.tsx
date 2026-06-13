"use client";

import { Suspense } from "react";
import { ProtectedRoute } from "@features/auth/components/RouteGuards";
import { DashboardLayout } from "@layouts/DashboardLayout";
import { TestResultView } from "@features/test/components/TestResult";
import { LoadingSpinner } from "@components/feedback/LoadingSpinner";

export default function TestResultPage() {
  return (
    <ProtectedRoute allowedRoles={["student"]}>
      <DashboardLayout>
        <Suspense fallback={<LoadingSpinner />}>
          <TestResultView />
        </Suspense>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
