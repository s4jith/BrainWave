import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import useUserStore from "./stores/userStore";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import TeacherPlaceholder from "./pages/TeacherPlaceholder";
import OnboardingLayout from "./pages/onboarding/OnboardingLayout";
import Dashboard from "./pages/Dashboard";
import BookToBot from "./pages/BookToBot";
import Settings from "./pages/Settings";
import TestCenter from "./pages/TestCenter";
import TestSession from "./pages/TestSession";
import TestResult from "./pages/TestResult";
import ReportCard from "./pages/ReportCard";
import AdminDashboard from "./pages/AdminDashboard";
import StaffTests from "./pages/StaffTests";
import SupportTickets from "./pages/SupportTickets";
import StudentManagement from "./pages/StudentManagement";
import CreateTest from "./pages/CreateTest";
import TestManagement from "./pages/TestManagement";
import StudentTests from "./pages/StudentTests";
import Notes from "./pages/Notes";
import Suggestions from "./pages/Suggestions";
import BookManagement from "./pages/BookManagementHierarchical";
import SubjectsManagement from "./pages/SubjectsManagement";
import TeacherDashboard from "./pages/TeacherDashboard";
import CourseBuilder from "./pages/CourseBuilder";
import AssessmentBuilder from "./pages/AssessmentBuilder";
import AssessmentTaker from "./pages/AssessmentTaker";
import Gradebook from "./pages/Gradebook";
import StudentDashboard from "./pages/StudentDashboard";
import TeacherManagement from "./pages/TeacherManagement";
import GroupManagement from "./pages/GroupManagement";
import StudentGroups from "./pages/StudentGroups";
import AdminSettings from "./pages/AdminSettings";
import AdminReports from "./pages/AdminReports";
import AdminSuggestions from "./pages/AdminSuggestions";
import TeacherGroups from "./pages/TeacherGroups";
import QuestionBank from "./pages/QuestionBank";
import TeacherTests from "./pages/TeacherTests";
import TeacherReports from "./pages/TeacherReports";
import CurriculumManagement from "./pages/CurriculumManagement";
import ForgotPassword from "./pages/ForgotPassword";
import "./App.css";

// Protected Route wrapper - For authenticated users
function ProtectedRoute({ children }) {
  const { isAuthenticated, user } = useUserStore();

  console.log("ProtectedRoute - isAuth:", isAuthenticated, "user:", user);

  if (!isAuthenticated) {
    console.log("Not authenticated, redirecting to /");
    return <Navigate to="/" replace />;
  }

  // Admin should only access admin routes
  if (user.role === "admin") {
    const path = window.location.pathname;
    const adminRoutes = ["/admin-dashboard", "/student-management", "/support-tickets", "/staff-tests", "/create-test", "/test-management", "/book-management", "/subjects-management", "/teacher-management", "/group-management", "/admin-settings", "/admin-reports", "/admin-suggestions", "/curriculum-management"];
    const isAdminRoute = adminRoutes.some(route => path.startsWith(route));
    if (!isAdminRoute) {
      console.log("Admin trying to access non-admin route, redirecting to /admin-dashboard");
      return <Navigate to="/admin-dashboard" replace />;
    }
  }

  // Teacher should only access teacher routes
  if (user.role === "teacher") {
    const path = window.location.pathname;
    const teacherRoutes = [
      "/staff-tests", "/teacher-dashboard", "/teacher-tests", "/course-builder",
      "/courses/", "/create-test",
      "/assessment-builder", "/assessments/", "/question-bank", "/teacher-groups",
      "/teacher-reports"
    ];
    const isTeacherRoute = teacherRoutes.some(route => path.startsWith(route));
    if (!isTeacherRoute) {
      console.log("Teacher trying to access non-teacher route, redirecting to /teacher-dashboard");
      return <Navigate to="/teacher-dashboard" replace />;
    }
  }

  // Students need onboarding first
  if (user.role === "student" && !user.isOnboarded) {
    const path = window.location.pathname;
    if (path !== "/onboarding") {
      console.log("Student not onboarded, redirecting to /onboarding");
      return <Navigate to="/onboarding" replace />;
    }
  }

  return children;
}

// Onboarding Route wrapper
function OnboardingRoute({ children }) {
  const { isAuthenticated, user } = useUserStore();

  console.log("OnboardingRoute - isAuth:", isAuthenticated, "user:", user);

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Admin/Teacher should not be in onboarding
  if (user.role === "admin") {
    console.log("Admin in onboarding, redirecting to /admin-dashboard");
    return <Navigate to="/admin-dashboard" replace />;
  }

  if (user.role === "teacher") {
    console.log("Teacher in onboarding, redirecting to /teacher-dashboard");
    return <Navigate to="/teacher-dashboard" replace />;
  }

  if (user.isOnboarded) {
    console.log("Student already onboarded, redirecting to /dashboard");
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// Public Route wrapper
function PublicRoute({ children }) {
  const { isAuthenticated, user } = useUserStore();

  console.log("PublicRoute - isAuth:", isAuthenticated, "user:", user);

  if (isAuthenticated) {
    // Route based on role
    if (user.role === "admin") {
      console.log("Admin logged in, redirecting to /admin-dashboard");
      return <Navigate to="/admin-dashboard" replace />;
    }

    if (user.role === "teacher") {
      console.log("Teacher logged in, redirecting to /teacher-dashboard");
      return <Navigate to="/teacher-dashboard" replace />;
    }

    // Students
    if (user.isOnboarded) {
      console.log("Student onboarded, redirecting to /dashboard");
      return <Navigate to="/dashboard" replace />;
    } else {
      console.log("Student not onboarded, redirecting to /onboarding");
      return <Navigate to="/onboarding" replace />;
    }
  }

  return children;
}

// Admin/Staff Route wrapper
function StaffRoute({ children }) {
  const { isAuthenticated, user } = useUserStore();

  console.log("StaffRoute - isAuth:", isAuthenticated, "user:", user);

  if (!isAuthenticated) {
    console.log("Not authenticated, redirecting to /");
    return <Navigate to="/" replace />;
  }

  if (user.role !== "admin" && user.role !== "teacher") {
    console.log("Not admin/teacher, redirecting to /dashboard");
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page - Always accessible */}
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <Signup />
            </PublicRoute>
          }
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/teacher" element={<TeacherPlaceholder />} />

        {/* Onboarding Route */}
        <Route
          path="/onboarding"
          element={
            <OnboardingRoute>
              <OnboardingLayout />
            </OnboardingRoute>
          }
        />

        {/* Student Protected Routes */}
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
              <BookToBot />
            </ProtectedRoute>
          }
        />
        <Route
          path="/test"
          element={
            <ProtectedRoute>
              <TestCenter />
            </ProtectedRoute>
          }
        />
        <Route
          path="/test-session"
          element={
            <ProtectedRoute>
              <TestSession />
            </ProtectedRoute>
          }
        />
        <Route
          path="/test-result"
          element={
            <ProtectedRoute>
              <TestResult />
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
              <Settings />
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
              <Suggestions />
            </ProtectedRoute>
          }
        />

        {/* Admin/Staff Routes */}
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
          path="/support-tickets"
          element={
            <ProtectedRoute>
              <SupportTickets />
            </ProtectedRoute>
          }
        />

        {/* Admin Test Management Routes */}
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

        {/* Teacher LMS Routes */}
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
          path="/teacher-tests"
          element={
            <StaffRoute>
              <TeacherTests />
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

        {/* Assessment LMS Routes */}
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

        {/* Student Test Routes */}
        <Route
          path="/my-tests"
          element={
            <ProtectedRoute>
              <StudentTests />
            </ProtectedRoute>
          }
        />

        {/* Student Groups */}
        <Route
          path="/my-groups"
          element={
            <ProtectedRoute>
              <StudentGroups />
            </ProtectedRoute>
          }
        />

        {/* Student Dashboard */}
        <Route
          path="/student-dashboard"
          element={
            <ProtectedRoute>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        {/* Gradebook & Analytics Routes */}
        <Route
          path="/gradebook/:courseId"
          element={
            <ProtectedRoute>
              <Gradebook />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-grades"
          element={
            <ProtectedRoute>
              <Gradebook />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes >
    </BrowserRouter >
  );
}

export default App;
