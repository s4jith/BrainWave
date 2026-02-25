import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import useUserStore from "./stores/userStore";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import TeacherPlaceholder from "./pages/TeacherPlaceholder";

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
import StudentQueries from "./pages/StudentQueries";
import TeacherQueries from "./pages/TeacherQueries";
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
import QuestionPapers from "./pages/QuestionPapers";
import TeacherTests from "./pages/TeacherTests";
import TeacherReports from "./pages/TeacherReports";
import TeacherSettings from "./pages/TeacherSettings";
import MaintenancePage from "./pages/MaintenancePage";
import CurriculumManagement from "./pages/CurriculumManagement";
import ForgotPassword from "./pages/ForgotPassword";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import "./App.css";

function useMaintenanceMode() {
  const [maintenance, setMaintenance] = useState(false);
  const [checked, setChecked] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API_URL}/api/admin/public/maintenance`);
        if (res.ok) {
          const data = await res.json();
          setMaintenance(data.maintenance_mode === true);
        }
      } catch {}
      setChecked(true);
    };
    check();
    // Re-check every 60 seconds
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, []);

  return { maintenance, checked };
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, user } = useUserStore();
  const { maintenance, checked } = useMaintenanceMode();

  console.log("ProtectedRoute - isAuth:", isAuthenticated, "user:", user);

  if (!isAuthenticated) {
    console.log("Not authenticated, redirecting to /");
    return <Navigate to="/" replace />;
  }

  // Block non-admins when maintenance mode is on
  if (checked && maintenance && user.role !== "admin") {
    return <MaintenancePage />;
  }

  if (user.role === "admin") {
    const path = window.location.pathname;
    const adminRoutes = ["/admin-dashboard", "/student-management", "/support-tickets", "/staff-tests", "/create-test", "/test-management", "/book-management", "/subjects-management", "/teacher-management", "/group-management", "/admin-settings", "/admin-reports", "/admin-suggestions", "/curriculum-management", "/question-papers", "/teacher-queries"];
    const isAdminRoute = adminRoutes.some(route => path.startsWith(route));
    if (!isAdminRoute) {
      console.log("Admin trying to access non-admin route, redirecting to /admin-dashboard");
      return <Navigate to="/admin-dashboard" replace />;
    }
  }

  if (user.role === "teacher") {
    const path = window.location.pathname;
    const teacherRoutes = [
      "/staff-tests", "/teacher-dashboard", "/teacher-tests", "/course-builder",
      "/courses/", "/create-test",
      "/assessment-builder", "/assessments/", "/question-bank", "/teacher-groups",
      "/teacher-reports", "/teacher-settings", "/question-papers"
    ];
    const isTeacherRoute = teacherRoutes.some(route => path.startsWith(route));
    if (!isTeacherRoute) {
      console.log("Teacher trying to access non-teacher route, redirecting to /teacher-dashboard");
      return <Navigate to="/teacher-dashboard" replace />;
    }
  }

  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated, user } = useUserStore();

  console.log("PublicRoute - isAuth:", isAuthenticated, "user:", user);

  if (isAuthenticated) {
    
    if (user.role === "admin") {
      console.log("Admin logged in, redirecting to /admin-dashboard");
      return <Navigate to="/admin-dashboard" replace />;
    }

    if (user.role === "teacher") {
      console.log("Teacher logged in, redirecting to /teacher-dashboard");
      return <Navigate to="/teacher-dashboard" replace />;
    }

    console.log("Student logged in, redirecting to /dashboard");
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function StaffRoute({ children }) {
  const { isAuthenticated, user } = useUserStore();
  const { maintenance, checked } = useMaintenanceMode();

  console.log("StaffRoute - isAuth:", isAuthenticated, "user:", user);

  if (!isAuthenticated) {
    console.log("Not authenticated, redirecting to /");
    return <Navigate to="/" replace />;
  }

  if (user.role !== "admin" && user.role !== "teacher") {
    console.log("Not admin/teacher, redirecting to /dashboard");
    return <Navigate to="/dashboard" replace />;
  }

  // Block non-admins (teachers) when maintenance mode is on
  if (checked && maintenance && user.role !== "admin") {
    return <MaintenancePage />;
  }

  return children;
}

function FeatureGatedRoute({ featureKey, children }) {
  const { user, getAuthHeader } = useUserStore();
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(null);
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  useEffect(() => {
    if (user?.role !== "student") {
      setAllowed(true);
      return;
    }
    const checkFeature = async () => {
      try {
        const res = await fetch(`${API_URL}/api/student/my-features`, {
          headers: getAuthHeader()
        });
        if (res.ok) {
          const data = await res.json();
          const featureVal = (data.features || {})[featureKey];
          // For features that are not present in response, use safe default:
          // book_to_bot defaults true, others default false
          const defaultVal = featureKey === "book_to_bot" ? true : false;
          setAllowed(featureVal !== undefined ? featureVal : defaultVal);
        } else {
          setAllowed(false);
        }
      } catch {
        setAllowed(false);
      }
    };
    checkFeature();
  }, [user?.id, featureKey]);

  if (allowed === null) return null; // loading

  if (!allowed) {
    return (
      <div className="relative h-full w-full" style={{ minHeight: '100vh' }}>
        {/* Blurred preview of the actual feature for marketing effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" style={{ filter: 'blur(6px)', transform: 'scale(1.02)' }}>
          {children}
        </div>
        {/* Dark gradient overlay */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.55) 100%)' }} />
        {/* Lock card */}
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl mx-4 border border-gray-200 dark:border-gray-700">
            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Feature Locked</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-2 text-sm">This feature hasn't been unlocked for your account yet.</p>
            <p className="text-gray-400 dark:text-gray-500 mb-6 text-sm">Please contact your teacher or admin to get access.</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {}
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

        {}
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

        {}
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
        <Route
          path="/my-queries"
          element={
            <ProtectedRoute>
              <StudentQueries />
            </ProtectedRoute>
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

        {}
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

        {}
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

        {}
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

        {}
        <Route
          path="/my-tests"
          element={
            <ProtectedRoute>
              <FeatureGatedRoute featureKey="test_center">
                <StudentTests />
              </FeatureGatedRoute>
            </ProtectedRoute>
          }
        />

        {}
        <Route
          path="/my-groups"
          element={
            <ProtectedRoute>
              <StudentGroups />
            </ProtectedRoute>
          }
        />

        {}
        <Route
          path="/student-dashboard"
          element={
            <ProtectedRoute>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        {}
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

        {}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes >
    </BrowserRouter >
  );
}

export default App;
