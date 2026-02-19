
import React, { useState, useEffect } from "react";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import {
  LayoutDashboard, Users, FileText,
  ClipboardList, TrendingUp, CheckCircle, AlertCircle,
  GraduationCap, BarChart3, UserPlus, CalendarDays, Target, Activity
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function AdminDashboard() {
  const { user } = useUserStore();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_URL}/api/admin/dashboard-stats`);
        if (cancelled) return;
        if (!response.ok) throw new Error("Failed to fetch stats");
        setStats(await response.json());
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
        setStats({
          total_students: 0, total_teachers: 0, active_today: 0,
          active_this_week: 0, new_users_this_month: 0,
          total_tests_created: 0, total_tests_taken: 0,
          tests_this_week: 0, average_score: 0, pass_rate: 0
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchStats();
    return () => { cancelled = true; };
  }, []);

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

  const s = stats || {};

  return (
    <AdminLayout title="Admin Dashboard" icon={LayoutDashboard}>
      {error && (
        <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Connection Issue</p>
            <p className="text-sm text-amber-700 dark:text-amber-400">Could not fetch live data. Showing defaults.</p>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Welcome back, {user?.name || "Admin"}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Here's an overview of your platform</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <StatCard label="Total Students" value={s.total_students} icon={Users} color="blue" />
        <StatCard label="Total Teachers" value={s.total_teachers} icon={GraduationCap} color="purple" />
        <StatCard label="Active Today" value={s.active_today} icon={Activity} color="green" />
        <StatCard label="Active This Week" value={s.active_this_week} icon={TrendingUp} color="emerald" />
        <StatCard label="New This Month" value={s.new_users_this_month} icon={UserPlus} color="indigo" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard label="Tests Created" value={s.total_tests_created} icon={ClipboardList} color="orange" />
        <StatCard label="Tests Taken" value={s.total_tests_taken} icon={FileText} color="cyan" />
        <StatCard label="Tests This Week" value={s.tests_this_week} icon={CalendarDays} color="teal" />
        <StatCard label="Avg Score" value={`${s.average_score || 0}%`} icon={BarChart3} color="blue" />
        <StatCard label="Pass Rate" value={`${s.pass_rate || 0}%`} icon={Target} color="green" />
      </div>
    </AdminLayout>
  );
}

const colorMap = {
  blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
  purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
  green: "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400",
  emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
  indigo: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400",
  orange: "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400",
  cyan: "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400",
  teal: "bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400",
};

function StatCard({ label, value, icon: Icon, color = "blue" }) {
  const colorClasses = colorMap[color] || colorMap.blue;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorClasses}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
  );
}

