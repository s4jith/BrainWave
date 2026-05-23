import React, { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import useUserStore from "../stores/userStore";
import useMaintenanceMode from "../hooks/useMaintenanceMode";
import MaintenancePage from "../pages/MaintenancePage";
import authFetch from "../utils/authFetch";

/**
 * ProtectedRoute — requires authentication. Redirects role-based users
 * to their correct dashboard if they try to access routes outside their scope.
 */
export function ProtectedRoute({ children }) {
  const { isAuthenticated, user } = useUserStore();
  const { maintenance, checked } = useMaintenanceMode();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Block non-admins when maintenance mode is on
  if (checked && maintenance && user.role !== "admin") {
    return <MaintenancePage />;
  }

  if (user.role === "admin") {
    const path = window.location.pathname;
    const adminRoutes = ["/admin-dashboard", "/student-management", "/support-tickets", "/staff-tests", "/create-test", "/test-management", "/book-management", "/subjects-management", "/teacher-management", "/group-management", "/admin-settings", "/admin-reports", "/admin-suggestions", "/curriculum-management", "/question-papers", "/teacher-queries", "/career-questions"];
    const isAdminRoute = adminRoutes.some(route => path.startsWith(route));
    if (!isAdminRoute) {
      return <Navigate to="/admin-dashboard" replace />;
    }
  }

  if (user.role === "head") {
    const path = window.location.pathname;
    const headRoutes = ["/head-dashboard", "/question-bank", "/question-papers", "/head-groups", "/head-reports", "/head-tests"];
    const isHeadRoute = headRoutes.some(route => path.startsWith(route));
    if (!isHeadRoute) {
      return <Navigate to="/head-dashboard" replace />;
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
      return <Navigate to="/teacher-dashboard" replace />;
    }
  }

  return children;
}

/**
 * PublicRoute — redirects authenticated users to their role-appropriate dashboard.
 */
export function PublicRoute({ children }) {
  const { isAuthenticated, user } = useUserStore();

  if (isAuthenticated) {
    
    if (user.role === "admin") {
      return <Navigate to="/admin-dashboard" replace />;
    }

    if (user.role === "head") {
      return <Navigate to="/head-dashboard" replace />;
    }

    if (user.role === "teacher") {
      return <Navigate to="/teacher-dashboard" replace />;
    }

    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

/**
 * StaffRoute — requires authentication AND staff role (admin, teacher, or head).
 */
export function StaffRoute({ children }) {
  const { isAuthenticated, user } = useUserStore();
  const { maintenance, checked } = useMaintenanceMode();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "admin" && user.role !== "teacher" && user.role !== "head") {
    return <Navigate to="/dashboard" replace />;
  }

  // Block non-admins (teachers) when maintenance mode is on
  if (checked && maintenance && user.role !== "admin") {
    return <MaintenancePage />;
  }

  return children;
}

/**
 * FeatureGatedRoute — checks if a feature is enabled for the current student.
 * Non-students always pass. Renders a blurred lock screen if the feature is disabled.
 */
export function FeatureGatedRoute({ featureKey, children }) {
  const { user, getAuthHeader } = useUserStore();
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(null);
  const API_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (user?.role !== "student") {
      setAllowed(true);
      return;
    }
    const checkFeature = async () => {
      try {
        const res = await authFetch(`${API_URL}/api/student/my-features`, {
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
