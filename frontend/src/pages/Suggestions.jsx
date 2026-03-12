import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import {
  Send,
  Lightbulb,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar
} from "lucide-react";
import useUserStore from "../stores/userStore";
import authFetch from "../utils/authFetch";

const API_BASE = import.meta.env.VITE_API_URL;

export default function Suggestions() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [subject, setSubject] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [mySuggestions, setMySuggestions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    fetchMySuggestions();
  }, []);

  const fetchMySuggestions = async () => {
    try {
      setLoadingHistory(true);
      const response = await authFetch(`${API_BASE}/api/suggestions/student/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setMySuggestions(data.suggestions || []);
      }
    } catch (err) {
      console.error("Failed to fetch suggestions:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!suggestion.trim()) return;

    try {
      setLoading(true);
      const response = await authFetch(`${API_BASE}/api/suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: user.id,
          student_name: user.name || "Anonymous",
          class_level: user.classLevel || 10,
          category: "general",
          subject: subject,
          content: suggestion,
          email: user.email || ""
        })
      });

      if (response.ok) {
        setSubject("");
        setSuggestion("");
        fetchMySuggestions();
        alert("Suggestion submitted successfully!");
      } else {
        alert(" Failed to submit suggestion. Please try again.");
      }
    } catch (err) {
      console.error("Error submitting suggestion:", err);
      alert(" Failed to submit suggestion. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "reviewed":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "reviewed":
        return "bg-green-50 text-green-700 border-green-200";
      case "pending":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {}
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <Lightbulb className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Suggestions</h1>
              <p className="text-gray-500">Share your ideas and feedback with the admin</p>
            </div>
          </div>
        </div>

        {}
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-orange-600" />
            Submit a Suggestion
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief subject of your suggestion..."
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                placeholder="Describe your suggestion in detail..."
                rows={6}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                required
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !suggestion.trim() || !subject.trim()}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Submit Suggestion
                </>
              )}
            </button>
          </form>
        </div>

        {}
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-orange-600" />
            My Suggestions
          </h2>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-orange-600" />
            </div>
          ) : mySuggestions.length === 0 ? (
            <div className="text-center py-12">
              <Lightbulb className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No suggestions yet</p>
              <p className="text-sm text-gray-400 mt-1">Submit your first suggestion above!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {mySuggestions.map((item) => (
                <div
                  key={item.id}
                  className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.subject || item.category || "General"}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full border flex items-center gap-1 ${getStatusColor(item.status)}`}>
                        {getStatusIcon(item.status)}
                        {item.status}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed">{item.content}</p>
                  {item.admin_response && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-100 rounded-lg">
                      <p className="text-xs font-medium text-green-800 mb-1">Admin Response:</p>
                      <p className="text-sm text-green-700">{item.admin_response}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
