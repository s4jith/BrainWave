/**
 * TanStack Query keys are namespaced per feature so cache invalidation
 * stays predictable. Use the factory pattern: each export returns a
 * stable array so referential equality works inside Query options.
 */
export const queryKeys = {
  auth: {
    me: () => ["auth", "me"] as const,
    maintenance: () => ["auth", "maintenance"] as const,
  },
  student: {
    dashboard: (studentId: string, subject?: string) =>
      ["student", "dashboard", studentId, subject ?? null] as const,
    streak: (studentId: string) => ["student", "streak", studentId] as const,
    progress: (studentId: string, subject?: string) =>
      ["student", "progress", studentId, subject ?? null] as const,
    features: () => ["student", "features"] as const,
  },
  test: {
    qbSubjects: (classLevel: number) =>
      ["test", "qb-subjects", classLevel] as const,
    qbChapters: (classLevel: number, subject: string) =>
      ["test", "qb-chapters", classLevel, subject] as const,
    subjects: (classLevel: number) => ["test", "subjects", classLevel] as const,
    chapters: (classLevel: number, subject: string, studentId?: string) =>
      ["test", "chapters", classLevel, subject, studentId ?? null] as const,
    topics: (
      classLevel: number,
      subject: string,
      chapter: number,
      studentId?: string,
    ) =>
      ["test", "topics", classLevel, subject, chapter, studentId ?? null] as const,
    history: (studentId: string, limit?: number) =>
      ["test", "history", studentId, limit ?? null] as const,
    result: (sessionId: string) => ["test", "result", sessionId] as const,
    analytics: (studentId: string, classLevel: number, subject?: string) =>
      ["test", "analytics", studentId, classLevel, subject ?? null] as const,
    staffTests: () => ["test", "staff-tests"] as const,
  },
  notes: {
    list: (studentId: string, filters?: Record<string, unknown>) =>
      ["notes", "list", studentId, filters ?? null] as const,
  },
  teacher: {
    dashboard: () => ["teacher", "dashboard"] as const,
    groups: () => ["teacher", "groups"] as const,
    queries: () => ["teacher", "queries"] as const,
    assessments: () => ["teacher", "assessments"] as const,
  },
  admin: {
    dashboard: () => ["admin", "dashboard"] as const,
    users: (role?: string) => ["admin", "users", role ?? null] as const,
    suggestions: () => ["admin", "suggestions"] as const,
    reports: () => ["admin", "reports"] as const,
  },
  head: {
    dashboard: () => ["head", "dashboard"] as const,
    groups: () => ["head", "groups"] as const,
    reports: () => ["head", "reports"] as const,
    tests: () => ["head", "tests"] as const,
  },
} as const;
