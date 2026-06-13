/**
 * Centralized route paths. Use these instead of string literals so
 * renames stay safe and the route surface is discoverable in one place.
 */
export const ROUTES = {
  root: "/",
  login: "/login",
  forgotPassword: "/forgot-password",

  // Student
  studentDashboard: "/dashboard",
  testCenter: "/test",
  testSession: "/test-session",
  testResult: "/test-result",
  notes: "/notes",
  reportCard: "/report-card",
  myGroups: "/my-groups",
  myQueries: "/my-queries",

  // Teacher
  teacherDashboard: "/teacher-dashboard",
  teacherTests: "/teacher-tests",
  teacherGroups: "/teacher-groups",
  teacherReports: "/teacher-reports",
  teacherQueries: "/teacher-queries",
  createTest: "/create-test",
  testManagement: "/test-management",
  gradebook: "/gradebook",
  questionBank: "/question-bank",
  questionPapers: "/question-papers",

  // Admin
  adminDashboard: "/admin-dashboard",
  studentManagement: "/student-management",
  teacherManagement: "/teacher-management",
  groupManagement: "/group-management",
  bookManagement: "/book-management",
  subjectsManagement: "/subjects-management",
  curriculumManagement: "/curriculum-management",
  adminReports: "/admin-reports",
  adminSettings: "/admin-settings",

  // Head
  headDashboard: "/head-dashboard",
  headGroups: "/head-groups",
  headReports: "/head-reports",
  headTests: "/head-tests",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
