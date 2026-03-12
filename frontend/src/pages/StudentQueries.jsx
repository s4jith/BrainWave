import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import useUserStore from "../stores/userStore";
import {
  MessageSquare, Send, CheckCircle, Clock, Loader2,
  GraduationCap, BookOpen, ChevronDown, ChevronUp, Users, Plus, X
} from "lucide-react";
import authFetch from "../utils/authFetch";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function StudentQueries() {
  const { getAuthHeader } = useUserStore();
  const location = useLocation();

  const [groups, setGroups] = useState([]);
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({ group_id: "", subject: "", message: "" });

  // Pre-select group when navigating from StudentGroups "Contact Teacher"
  useEffect(() => {
    const state = location.state;
    if (state?.group_id) {
      setForm(prev => ({ ...prev, group_id: state.group_id, subject: state.subject || "" }));
      setShowForm(true);
    }
  }, [location.state]);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchGroups(), fetchQueries()]);
    setLoading(false);
  };

  const fetchGroups = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/student/groups`, { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
      }
    } catch {}
  };

  const fetchQueries = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/queries/student`, { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        setQueries(data.queries || []);
      }
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.group_id || !form.subject.trim() || !form.message.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await authFetch(`${API_URL}/api/queries`, {
        method: "POST",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Query sent to your teacher!");
        setForm({ group_id: "", subject: "", message: "" });
        setShowForm(false);
        await fetchQueries();
        setTimeout(() => setSuccess(""), 4000);
      } else {
        setError(data.detail || "Failed to send query.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedGroup = groups.find(g => g.id === form.group_id);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          <span className="ml-3 text-gray-500">Loading...</span>
        </div>
      </DashboardLayout>
    );
  }

  const pendingCount = queries.filter(q => q.status === "open").length;
  const answeredCount = queries.filter(q => q.status === "answered").length;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Queries</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Ask questions directly to your teacher</p>
          </div>
          <button
            onClick={() => { setShowForm(v => !v); setError(""); }}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? "Cancel" : "New Query"}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Total", value: queries.length, color: "blue" },
            { label: "Pending", value: pendingCount, color: "orange" },
            { label: "Answered", value: answeredCount, color: "emerald" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 text-center">
              <p className={`text-2xl font-bold text-${color}-600`}>{value}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
            </div>
          ))}
        </div>

        {success && (
          <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-3 text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {success}
          </div>
        )}

        {/* New Query Form */}
        {showForm && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 mb-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-orange-500" />
              Send a Query to Your Teacher
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Select Group</label>
                <select
                  value={form.group_id}
                  onChange={(e) => {
                    const g = groups.find(grp => grp.id === e.target.value);
                    setForm(prev => ({ ...prev, group_id: e.target.value, subject: g?.subject || "" }));
                  }}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-300"
                >
                  <option value="">-- Choose a group --</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({g.subject}, Class {g.class_level})</option>
                  ))}
                </select>
                {selectedGroup?.teacher && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                    <GraduationCap className="w-3 h-3" />
                    Teacher: {selectedGroup.teacher.name}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Subject / Topic</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="e.g. Chapter 3 – Algebra"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Your Question</label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm(prev => ({ ...prev, message: e.target.value }))}
                  rows={4}
                  placeholder="Describe your doubt or question here..."
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-60"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submitting ? "Sending..." : "Send Query"}
              </button>
            </form>
          </div>
        )}

        {/* Query List */}
        <div className="space-y-3">
          {queries.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-gray-300 dark:text-gray-500" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">No queries yet</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Click "New Query" to ask your teacher a question.</p>
            </div>
          ) : (
            queries.map(q => (
              <div key={q.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <button
                  onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${q.status === "answered" ? "bg-emerald-500" : "bg-orange-400"}`} />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{q.subject}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{q.group_name} · {new Date(q.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      q.status === "answered"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                        : "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400"
                    }`}>
                      {q.status === "answered" ? "Answered" : "Pending"}
                    </span>
                    {expandedId === q.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {expandedId === q.id && (
                  <div className="px-5 pb-5 border-t border-gray-50 dark:border-gray-700 space-y-4 pt-4">
                    {/* Student message */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Your question</p>
                      <p className="text-sm text-gray-900 dark:text-white">{q.message}</p>
                    </div>

                    {/* Teacher reply */}
                    {q.reply ? (
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-lg p-4">
                        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1">
                          <GraduationCap className="w-3.5 h-3.5" />
                          Teacher's reply · {new Date(q.reply_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                        <p className="text-sm text-gray-900 dark:text-white">{q.reply}</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
                        <Clock className="w-4 h-4" />
                        Awaiting teacher's reply...
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
