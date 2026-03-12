import { useState, useEffect } from "react";
import AdminLayout from "../components/AdminLayout";
import useUserStore from "../stores/userStore";
import {
  MessageSquare, Send, CheckCircle, Clock, Loader2,
  GraduationCap, Users, Filter, RefreshCw, ChevronDown, ChevronUp
} from "lucide-react";
import authFetch from "../utils/authFetch";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function TeacherQueries() {
  const { getAuthHeader } = useUserStore();

  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [replyMap, setReplyMap] = useState({}); // { [queryId]: string }
  const [submittingId, setSubmittingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchQueries();
  }, [statusFilter]);

  const fetchQueries = async () => {
    setLoading(true);
    try {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await authFetch(`${API_URL}/api/queries/teacher${params}`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        setQueries(data.queries || []);
      }
    } catch {}
    setLoading(false);
  };

  const handleReply = async (queryId) => {
    const reply = (replyMap[queryId] || "").trim();
    if (!reply) return;
    setSubmittingId(queryId);
    setError("");
    try {
      const res = await authFetch(`${API_URL}/api/queries/${queryId}/reply`, {
        method: "POST",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ reply }),
      });
      if (res.ok) {
        setReplyMap(prev => ({ ...prev, [queryId]: "" }));
        await fetchQueries();
        setExpandedId(null);
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to send reply.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setSubmittingId(null);
    }
  };

  const openCount = queries.filter(q => q.status === "open").length;
  const answeredCount = queries.filter(q => q.status === "answered").length;

  const filterTabs = [
    { id: "all", label: "All", count: queries.length },
    { id: "open", label: "Pending", count: openCount },
    { id: "answered", label: "Answered", count: answeredCount },
  ];

  return (
    <AdminLayout icon={MessageSquare} title="Student Queries">
      <div className="p-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Student Queries</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {openCount > 0 ? `${openCount} pending ${openCount === 1 ? "query" : "queries"} awaiting reply` : "All queries answered"}
            </p>
          </div>
          <button
            onClick={fetchQueries}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {filterTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                statusFilter === tab.id
                  ? "bg-orange-500 text-white"
                  : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-orange-300"
              }`}
            >
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                statusFilter === tab.id ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Query List */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-7 h-7 animate-spin text-orange-500" />
          </div>
        ) : queries.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-gray-300 dark:text-gray-500" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">No queries</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {statusFilter === "open" ? "No pending queries from students." : "No queries found."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {queries.map(q => (
              <div key={q.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                {/* Query Header */}
                <button
                  onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${q.status === "answered" ? "bg-emerald-500" : "bg-orange-400"}`} />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{q.subject}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
                        <Users className="w-3 h-3" />
                        {q.student_name} · {q.group_name} · {new Date(q.created_at).toLocaleDateString()}
                      </p>
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

                {/* Expanded Content */}
                {expandedId === q.id && (
                  <div className="px-5 pb-5 border-t border-gray-50 dark:border-gray-700 space-y-4 pt-4">
                    {/* Student message */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5" />
                        {q.student_name}'s question
                      </p>
                      <p className="text-sm text-gray-900 dark:text-white">{q.message}</p>
                    </div>

                    {/* Existing reply */}
                    {q.reply && (
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-lg p-4">
                        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                          Your reply · {new Date(q.reply_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                        <p className="text-sm text-gray-900 dark:text-white">{q.reply}</p>
                      </div>
                    )}

                    {/* Reply form — always visible so teacher can update */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {q.reply ? "Update reply" : "Write a reply"}
                      </label>
                      <textarea
                        rows={3}
                        value={replyMap[q.id] || ""}
                        onChange={(e) => setReplyMap(prev => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Type your reply..."
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                      />
                      <button
                        onClick={() => handleReply(q.id)}
                        disabled={submittingId === q.id || !(replyMap[q.id] || "").trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-60"
                      >
                        {submittingId === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {submittingId === q.id ? "Sending..." : "Send Reply"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
