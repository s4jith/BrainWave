import { useState, useEffect } from "react";
import { Search, MessageSquare, CheckCircle, Clock, Reply, Trash2, RefreshCw } from "lucide-react";
import AdminLayout from "../components/AdminLayout";
import authFetch from "../utils/authFetch";

const API_BASE = import.meta.env.VITE_API_URL;

export default function AdminSuggestions() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [stats, setStats] = useState({ total: 0, pending: 0 });

  useEffect(() => {
    fetchSuggestions();
  }, [filterStatus, filterCategory]);

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.append("status", filterStatus);
      if (filterCategory !== "all") params.append("category", filterCategory);

      const response = await authFetch(`${API_BASE}/api/suggestions/all?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
        setStats({
          total: data.total || 0,
          pending: data.pending_count || 0
        });
      }
    } catch (err) {
      console.error("Failed to fetch suggestions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async (suggestionId) => {
    if (!replyText.trim()) return;

    try {
      const response = await authFetch(`${API_BASE}/api/suggestions/${suggestionId}/respond?response=${encodeURIComponent(replyText)}&status=reviewed`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" }
      });

      if (response.ok) {
        setReplyingTo(null);
        setReplyText("");
        fetchSuggestions();
      }
    } catch (err) {
      console.error("Failed to reply:", err);
    }
  };

  const handleDelete = async (suggestionId) => {
    if (!confirm("Are you sure you want to delete this suggestion?")) return;

    try {
      const response = await authFetch(`${API_BASE}/api/suggestions/${suggestionId}`, {
        method: "DELETE"
      });

      if (response.ok) {
        fetchSuggestions();
      }
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const filteredSuggestions = suggestions.filter(s =>
    s.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.subject || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout title="Suggestions" icon={MessageSquare}>
    <div className="max-w-7xl mx-auto space-y-6">
        {}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-gray-700 dark:text-gray-200" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Student Suggestions</h1>
                <p className="text-gray-500 dark:text-gray-400">Review and respond to student feedback</p>
              </div>
            </div>
            <button
              onClick={fetchSuggestions}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Suggestions</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4">
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-1">Pending Review</p>
              <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">{stats.pending}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
              <p className="text-sm text-green-700 dark:text-green-300 mb-1">Reviewed</p>
              <p className="text-2xl font-bold text-green-800 dark:text-green-200">{stats.total - stats.pending}</p>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-100 dark:border-zinc-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, subject, or content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-zinc-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-zinc-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </div>
        </div>

        {}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-12 text-center border border-gray-100 dark:border-zinc-800">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 dark:border-zinc-700 border-t-gray-900 dark:border-t-gray-200 mx-auto" />
              <p className="text-gray-500 dark:text-gray-400 mt-4">Loading suggestions...</p>
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-12 text-center border border-gray-100 dark:border-zinc-800">
              <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No suggestions found</p>
            </div>
          ) : (
            filteredSuggestions.map((suggestion) => (
              <div key={suggestion.id} className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-100 dark:border-zinc-800">
                {}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                      <span className="text-gray-700 dark:text-gray-200 font-medium">
                        {suggestion.student_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{suggestion.student_name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Class {suggestion.class_level}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {suggestion.subject && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
                        {suggestion.subject}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full border flex items-center gap-1 ${
                      suggestion.status === "reviewed"
                        ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
                        : "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800"
                    }`}>
                      {suggestion.status === "reviewed" ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      {suggestion.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(suggestion.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {}
                <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-4 mb-4">
                  <p className="text-gray-700 dark:text-gray-200 leading-relaxed">{suggestion.content}</p>
                </div>

                {}
                {suggestion.admin_response && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-4">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Your Response:</p>
                    <p className="text-green-700 dark:text-green-300">{suggestion.admin_response}</p>
                  </div>
                )}

                {/* Reply Form */}
                {replyingTo === suggestion.id && (
                  <div className="space-y-3 mb-4">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your response..."
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-zinc-500 resize-none bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReply(suggestion.id)}
                        className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                      >
                        Send Reply
                      </button>
                      <button
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyText("");
                        }}
                        className="px-4 py-2 bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-300 dark:hover:bg-zinc-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {}
                <div className="flex items-center gap-2">
                  {!suggestion.admin_response && (
                    <button
                      onClick={() => setReplyingTo(suggestion.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors text-sm"
                    >
                      <Reply className="w-4 h-4" />
                      Reply
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(suggestion.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
