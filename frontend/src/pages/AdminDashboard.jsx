/**
 * AdminDashboard - Main admin dashboard with analytics
 * Uses AdminLayout with light/dark theme support
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import {
  LayoutDashboard, Users, BookOpen, FolderKanban, FileText,
  ClipboardList, TrendingUp, CheckCircle, AlertCircle, ArrowRight,
  GraduationCap, BarChart3
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  // Auto-refresh on window focus
  useEffect(() => {
    const handleFocus = () => {
      fetchAnalytics();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/admin/analytics`);
      if (!response.ok) throw new Error("Failed to fetch analytics");
      setAnalytics(await response.json());
    } catch (err) {
      setError(err.message);
      setAnalytics({
        user_stats: { total_users: 0, total_students: 0, total_teachers: 0, active_today: 0, active_this_week: 0, active_this_month: 0, new_users_this_month: 0 },
        test_stats: { total_tests_created: 0, total_tests_taken: 0, tests_completed: 0, average_score: 0, pass_rate: 0, tests_this_week: 0 }
      });
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: "Manage Users", description: "Add or edit users", icon: Users, path: "/student-management" },
    { label: "Manage Teachers", description: "Configure teachers", icon: GraduationCap, path: "/teacher-management" },
    { label: "Create Test", description: "Build new assessments", icon: ClipboardList, path: "/create-test" },
    { label: "Manage Groups", description: "Organize student groups", icon: FolderKanban, path: "/group-management" },
  ];

  if (loading) {
    return (
      <AdminLayout title="Admin Dashboard" icon={LayoutDashboard}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const stats = analytics?.user_stats || {};
  const testStats = analytics?.test_stats || {};

  return (
    <AdminLayout title="Admin Dashboard" icon={LayoutDashboard}>
      {error && (
        <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Connection Issue</p>
            <p className="text-sm text-amber-700 dark:text-amber-400">Could not fetch live data. Showing cached data.</p>
          </div>
        </div>
      )}

      {/* Stats Grid - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Students" value={stats.total_students || 0} icon={Users} />
        <StatCard label="Total Teachers" value={stats.total_teachers || 0} icon={GraduationCap} />
        <StatCard label="Total Tests" value={testStats.total_tests_created || 0} icon={ClipboardList} />
        <StatCard label="Tests Taken" value={testStats.total_tests_taken || 0} icon={FileText} />
      </div>

      {/* Stats Grid - Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Active Today" value={stats.active_today || 0} icon={TrendingUp} iconColor="text-green-500 dark:text-green-400" />
        <StatCard label="Completed Tests" value={testStats.tests_completed || 0} icon={CheckCircle} iconColor="text-green-500 dark:text-green-400" />
        <StatCard label="Avg Score" value={`${testStats.average_score?.toFixed(1) || 0}%`} icon={BarChart3} iconColor="text-blue-500 dark:text-blue-400" />
      </div>

      {/* Quick Actions & Platform Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Quick Actions</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Common administrative tasks</p>

          <div className="space-y-2">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => navigate(action.path)}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition group"
              >
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition">
                  <action.icon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{action.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{action.description}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition" />
              </button>
            ))}
          </div>
        </div>

        {/* Platform Insights */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Platform Insights</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Real-time metrics from database</p>

          <div className="space-y-4">
            <InsightRow label="Total Users" value={stats.total_users || 0} />
            <InsightRow label="Active This Week" value={stats.active_this_week || 0} />
            <InsightRow label="Tests This Week" value={testStats.tests_this_week || 0} />
            <InsightRow label="Pass Rate" value={`${testStats.pass_rate?.toFixed(1) || 0}%`} />
            <InsightRow label="New Users This Month" value={stats.new_users_this_month || 0} last />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

// Stat Card Component
function StatCard({ label, value, icon: Icon, iconColor = "text-gray-400 dark:text-gray-500" }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
        </div>
        <div className={`p-2 ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

// Insight Row Component
function InsightRow({ label, value, last = false }) {
  return (
    <div className={`flex items-center justify-between py-3 ${last ? "" : "border-b border-gray-100 dark:border-gray-700"}`}>
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}
