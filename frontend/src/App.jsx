import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute, PublicRoute, StaffRoute, FeatureGatedRoute } from "./components/RouteGuards";
import TokenValidator from "./components/TokenValidator";
import PageLoadingFallback from "./components/PageLoadingFallback";
import { ToastProvider } from "./contexts/ToastContext";
import "./App.css";

// ── Eagerly loaded pages (always needed) ────────────────────────────────────────
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";

// ── Lazy-loaded pages (code-split per route) ────────────────────────────────────
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const BookToBot = React.lazy(() => import("./pages/BookToBot"));
const Settings = React.lazy(() => import("./pages/Settings"));
const TestCenter = React.lazy(() => import("./pages/TestCenter"));
const TestSession = React.lazy(() => import("./pages/TestSession"));
const TestResult = React.lazy(() => import("./pages/TestResult"));
const ReportCard = React.lazy(() => import("./pages/ReportCard"));
const Notes = React.lazy(() => import("./pages/Notes"));
const ForgotPassword = React.lazy(() => import("./pages/ForgotPassword"));
const TeacherPlaceholder = React.lazy(() => import("./pages/TeacherPlaceholder"));
const MaintenancePage = React.lazy(() => import("./pages/MaintenancePage"));
const StudentDashboard = React.lazy(() => import("./pages/StudentDashboard"));
const StudentGroups = React.lazy(() => import("./pages/StudentGroups"));
const Suggestions = React.lazy(() => import("./pages/Suggestions"));

// Admin pages
const AdminDashboard = React.lazy(() => import("./pages/AdminDashboard"));
const AdminSettings = React.lazy(() => import("./pages/AdminSettings"));
const AdminReports = React.lazy(() => import("./pages/AdminReports"));
const AdminSuggestions = React.lazy(() => import("./pages/AdminSuggestions"));
const StudentManagement = React.lazy(() => import("./pages/StudentManagement"));
const TeacherManagement = React.lazy(() => import("./pages/TeacherManagement"));
const GroupManagement = React.lazy(() => import("./pages/GroupManagement"));
const SubjectsManagement = React.lazy(() => import("./pages/SubjectsManagement"));
const BookManagement = React.lazy(() => import("./pages/BookManagementHierarchical"));
const CurriculumManagement = React.lazy(() => import("./pages/CurriculumManagement"));
const SupportTickets = React.lazy(() => import("./pages/SupportTickets"));

// Teacher pages
const TeacherDashboard = React.lazy(() => import("./pages/TeacherDashboard"));
const TeacherGroups = React.lazy(() => import("./pages/TeacherGroups"));
const TeacherReports = React.lazy(() => import("./pages/TeacherReports"));
const TeacherSettings = React.lazy(() => import("./pages/TeacherSettings"));
const TeacherTests = React.lazy(() => import("./pages/TeacherTests"));
const TeacherQueries = React.lazy(() => import("./pages/TeacherQueries"));
const CourseBuilder = React.lazy(() => import("./pages/CourseBuilder"));

// Test/Assessment pages
const StaffTests = React.lazy(() => import("./pages/StaffTests"));
const CreateTest = React.lazy(() => import("./pages/CreateTest"));
const TestManagement = React.lazy(() => import("./pages/TestManagement"));
const AssessmentBuilder = React.lazy(() => import("./pages/AssessmentBuilder"));
const AssessmentTaker = React.lazy(() => import("./pages/AssessmentTaker"));
const Gradebook = React.lazy(() => import("./pages/Gradebook"));
const QuestionBank = React.lazy(() => import("./pages/QuestionBank"));
const QuestionPapers = React.lazy(() => import("./pages/QuestionPapers"));

// Head pages
const HeadDashboard = React.lazy(() => import("./pages/HeadDashboard"));
const HeadGroups = React.lazy(() => import("./pages/HeadGroups"));
const HeadReports = React.lazy(() => import("./pages/HeadReports"));
const HeadTests = React.lazy(() => import("./pages/HeadTests"));

// Student pages
const StudentQueries = React.lazy(() => import("./pages/StudentQueries"));
const CareerQuestions = React.lazy(() => import("./pages/CareerQuestions"));
const CareerTest = React.lazy(() => import("./pages/CareerTest"));
const CareerResult = React.lazy(() => import("./pages/CareerResult"));

// Layouts
const DashboardLayout = React.lazy(() => import("./components/dashboard/DashboardLayout"));

function App() {
  return (
    <ToastProvider>
    <BrowserRouter>
      <TokenValidator>
      <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/teacher" element={<TeacherPlaceholder />} />

        {/* Student Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/book-to-bot"
          element={
            <ProtectedRoute>
              <DashboardLayout noPadding noHeader>
                <FeatureGatedRoute featureKey="book_to_bot">
                  <BookToBot />
                </FeatureGatedRoute>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-chat"
          element={
            <ProtectedRoute>
              <DashboardLayout noPadding noHeader>
                <FeatureGatedRoute featureKey="ai_chatbot">
                  <BookToBot />
                </FeatureGatedRoute>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/test"
          element={
            <ProtectedRoute>
              <FeatureGatedRoute featureKey="test_center">
                <TestCenter />
              </FeatureGatedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/test-session"
          element={
            <ProtectedRoute>
              <FeatureGatedRoute featureKey="test_center">
                <TestSession />
              </FeatureGatedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/test-result"
          element={
            <ProtectedRoute>
              <FeatureGatedRoute featureKey="test_center">
                <TestResult />
              </FeatureGatedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/report-card"
          element={
            <ProtectedRoute>
              <ReportCard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/about-you"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Settings />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/notes"
          element={
            <ProtectedRoute>
              <Notes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suggestions"
          element={
            <ProtectedRoute>
              <Navigate to="/about-you?tab=suggestions" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student-dashboard"
          element={
            <ProtectedRoute>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-groups"
          element={
            <ProtectedRoute>
              <StudentGroups />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-queries"
          element={
            <ProtectedRoute>
              <StudentQueries />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gradebook/:courseId"
          element={
            <ProtectedRoute>
              <FeatureGatedRoute featureKey="my_grades">
                <Gradebook />
              </FeatureGatedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-grades"
          element={
            <ProtectedRoute>
              <FeatureGatedRoute featureKey="my_grades">
                <Gradebook />
              </FeatureGatedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/support-tickets"
          element={
            <ProtectedRoute>
              <SupportTickets />
            </ProtectedRoute>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin-dashboard"
          element={
            <StaffRoute>
              <AdminDashboard />
            </StaffRoute>
          }
        />
        <Route
          path="/student-management"
          element={
            <StaffRoute>
              <StudentManagement />
            </StaffRoute>
          }
        />
        <Route
          path="/staff-tests"
          element={
            <StaffRoute>
              <StaffTests />
            </StaffRoute>
          }
        />
        <Route
          path="/teacher-queries"
          element={
            <StaffRoute>
              <TeacherQueries />
            </StaffRoute>
          }
        />
        <Route
          path="/create-test"
          element={
            <StaffRoute>
              <CreateTest />
            </StaffRoute>
          }
        />
        <Route
          path="/create-test/:testId"
          element={
            <StaffRoute>
              <CreateTest />
            </StaffRoute>
          }
        />
        <Route
          path="/test/edit/:testId"
          element={
            <StaffRoute>
              <CreateTest />
            </StaffRoute>
          }
        />
        <Route
          path="/test-management"
          element={
            <StaffRoute>
              <TestManagement />
            </StaffRoute>
          }
        />
        <Route
          path="/book-management"
          element={
            <StaffRoute>
              <BookManagement />
            </StaffRoute>
          }
        />
        <Route
          path="/subjects-management"
          element={
            <StaffRoute>
              <SubjectsManagement />
            </StaffRoute>
          }
        />
        <Route
          path="/teacher-management"
          element={
            <StaffRoute>
              <TeacherManagement />
            </StaffRoute>
          }
        />
        <Route
          path="/group-management"
          element={
            <StaffRoute>
              <GroupManagement />
            </StaffRoute>
          }
        />
        <Route
          path="/admin-settings"
          element={
            <StaffRoute>
              <AdminSettings />
            </StaffRoute>
          }
        />
        <Route
          path="/admin-reports"
          element={
            <StaffRoute>
              <AdminReports />
            </StaffRoute>
          }
        />
        <Route
          path="/admin-suggestions"
          element={
            <StaffRoute>
              <AdminSuggestions />
            </StaffRoute>
          }
        />
        <Route
          path="/curriculum-management"
          element={
            <StaffRoute>
              <CurriculumManagement />
            </StaffRoute>
          }
        />

        {/* Teacher Routes */}
        <Route
          path="/teacher-dashboard"
          element={
            <StaffRoute>
              <TeacherDashboard />
            </StaffRoute>
          }
        />
        <Route
          path="/teacher-groups"
          element={
            <StaffRoute>
              <TeacherGroups />
            </StaffRoute>
          }
        />
        <Route
          path="/question-bank"
          element={
            <StaffRoute>
              <QuestionBank />
            </StaffRoute>
          }
        />
        <Route
          path="/question-papers"
          element={
            <StaffRoute>
              <QuestionPapers />
            </StaffRoute>
          }
        />
        <Route
          path="/teacher-tests"
          element={
            <StaffRoute>
              <TestManagement />
            </StaffRoute>
          }
        />
        <Route
          path="/teacher-reports"
          element={
            <StaffRoute>
              <TeacherReports />
            </StaffRoute>
          }
        />
        <Route
          path="/teacher-settings"
          element={
            <StaffRoute>
              <TeacherSettings />
            </StaffRoute>
          }
        />
        <Route
          path="/course-builder"
          element={
            <StaffRoute>
              <CourseBuilder />
            </StaffRoute>
          }
        />
        <Route
          path="/course-builder/:courseId"
          element={
            <StaffRoute>
              <CourseBuilder />
            </StaffRoute>
          }
        />

        {/* Assessment Routes */}
        <Route
          path="/assessment-builder"
          element={
            <StaffRoute>
              <AssessmentBuilder />
            </StaffRoute>
          }
        />
        <Route
          path="/assessment-builder/:assessmentId"
          element={
            <StaffRoute>
              <AssessmentBuilder />
            </StaffRoute>
          }
        />
        <Route
          path="/assessments/:assessmentId"
          element={
            <ProtectedRoute>
              <AssessmentTaker />
            </ProtectedRoute>
          }
        />

        {/* Head Routes */}
        <Route
          path="/head-dashboard"
          element={
            <StaffRoute>
              <HeadDashboard />
            </StaffRoute>
          }
        />
        <Route
          path="/head-groups"
          element={
            <StaffRoute>
              <HeadGroups />
            </StaffRoute>
          }
        />
        <Route
          path="/head-reports"
          element={
            <StaffRoute>
              <HeadReports />
            </StaffRoute>
          }
        />
        <Route
          path="/head-tests"
          element={
            <StaffRoute>
              <HeadTests />
            </StaffRoute>
          }
        />

        {/* Career Analysis */}
        <Route
          path="/career-questions"
          element={
            <StaffRoute>
              <CareerQuestions />
            </StaffRoute>
          }
        />
        <Route
          path="/career-test"
          element={
            <ProtectedRoute>
              <CareerTest />
            </ProtectedRoute>
          }
        />
        <Route
          path="/career-result/:resultId"
          element={
            <ProtectedRoute>
              <CareerResult />
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      </TokenValidator>
    </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
