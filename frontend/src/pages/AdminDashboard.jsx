
import React, { useState, useEffect } from "react";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import {
  LayoutDashboard, Users, FileText, ClipboardList, Activity,
  GraduationCap, AlertCircle, TrendingUp
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell
} from "recharts";
import authFetch from "../utils/authFetch";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const EMPTY_TREND = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (6 - i));
  return {
    date: d.toLocaleDateString("en-US", { weekday: "short" }),
    full_date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    active_users: 0, tests_taken: 0, new_signups: 0
  };
});

const CLASS_COLORS = [
  ["#6366f1", "#4f46e5"],
  ["#06b6d4", "#0891b2"],
  ["#10b981", "#059669"],
  ["#f59e0b", "#d97706"],
  ["#ec4899", "#db2777"],
  ["#8b5cf6", "#7c3aed"],
  ["#f97316", "#ea580c"],
  ["#14b8a6", "#0d9488"],
  ["#84cc16", "#65a30d"],
  ["#e879f9", "#d946ef"],
  ["#38bdf8", "#0ea5e9"],
  ["#fb923c", "#f97316"],
];

export default function AdminDashboard() {
  const { user, getAuthHeader } = useUserStore();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`${API_URL}/api/admin/dashboard-stats`, {
          headers: getAuthHeader()
        });
        if (cancelled) return;
        if (!res.ok) throw new Error("Failed to fetch stats");
        setStats(await res.json());
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
        setStats({ total_students: 0, total_teachers: 0, active_today: 0, total_tests_created: 0, total_tests_taken: 0, daily_trend: EMPTY_TREND, class_distribution: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const s = stats || {};
  const trend = s.daily_trend?.length ? s.daily_trend : EMPTY_TREND;
  const classDist = s.class_distribution || [];

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <AdminLayout title="Admin Dashboard" icon={LayoutDashboard}>
      {error && (
        <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">Could not fetch live data — showing defaults.</p>
        </div>
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Good {getGreeting()}, {user?.name?.split(" ")[0] || "Admin"} 👋
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{today}</p>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <div className="w-3 h-3 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
            Loading…
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total Students" value={s.total_students ?? "—"} icon={Users} color="blue" loading={loading} />
        <StatCard label="Total Teachers" value={s.total_teachers ?? "—"} icon={GraduationCap} color="violet" loading={loading} />
        <StatCard label="Active Today" value={s.active_today ?? "—"} icon={Activity} color="green" loading={loading} />
        <StatCard label="Tests Created" value={s.total_tests_created ?? "—"} icon={ClipboardList} color="orange" loading={loading} />
        <StatCard label="Tests Taken" value={s.total_tests_taken ?? "—"} icon={FileText} color="cyan" loading={loading} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="xl:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">User Activity — Last 7 Days</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Daily active users and tests completed</p>
            </div>
            <TrendingUp className="w-4 h-4 text-gray-300 dark:text-gray-600" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trend} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorTests" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:[&>line]:stroke-gray-700" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} className="text-gray-400" />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.full_date || ""}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="active_users" name="Active Users" stroke="#6366f1" strokeWidth={2} fill="url(#colorUsers)" dot={false} activeDot={{ r: 4 }} />
              <Area type="monotone" dataKey="tests_taken" name="Tests Taken" stroke="#06b6d4" strokeWidth={2} fill="url(#colorTests)" dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">New Signups — Last 7 Days</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Daily new user registrations</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trend} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barCategoryGap="35%">
              <defs>
                <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:[&>line]:stroke-gray-700" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.full_date || ""}
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
              />
              <Bar dataKey="new_signups" name="New Signups" fill="url(#signupGrad)" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {classDist.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Students by Class</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Distribution of enrolled students across class levels</p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={classDist} margin={{ top: 4, right: 16, left: -28, bottom: 0 }} barCategoryGap="30%">
              <defs>
                {CLASS_COLORS.map((c, i) => (
                  <linearGradient key={i} id={`classGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c[0]} stopOpacity={1} />
                    <stop offset="100%" stopColor={c[1]} stopOpacity={0.85} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:[&>line]:stroke-gray-700" vertical={false} />
              <XAxis dataKey="class" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                formatter={(val) => [val, "Students"]}
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
              />
              <Bar dataKey="students" name="Students" radius={[6, 6, 0, 0]} maxBarSize={52}>
                {classDist.map((_, idx) => (
                  <Cell key={idx} fill={`url(#classGrad${idx % CLASS_COLORS.length})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </AdminLayout>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

const colorMap = {
  blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
  violet: "bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400",
  green: "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400",
  orange: "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400",
  cyan: "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400",
};

function StatCard({ label, value, icon: Icon, color = "blue", loading }) {
  const cls = colorMap[color] || colorMap.blue;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${cls}`}>
        <Icon className="w-4 h-4" />
      </div>
      {loading ? (
        <div className="h-7 w-12 bg-gray-100 dark:bg-gray-700 rounded animate-pulse mb-1" />
      ) : (
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
  );
}


