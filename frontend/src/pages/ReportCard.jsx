import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import useUserStore from "../stores/userStore";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Award,
  BookOpen,
  Brain,
  AlertTriangle,
  CheckCircle,
  Zap,
  BarChart3,
  Home,
  Calendar,
  Trophy,
  Flame,
  Trash2,
  X
} from "lucide-react";
import { Button } from "../components/ui/button";
import { testService } from "../services/api";

export default function ReportCard() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, type: null, sessionId: null });

  useEffect(() => {
    fetchData();
  }, [user.id, user.classLevel, user.preferredSubject]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch both analytics and test history in parallel
      const [analyticsData, historyData] = await Promise.all([
        testService.getTestAnalytics(
          user.id,
          user.classLevel || 10,
          null // Don't filter by subject - show all tests
        ).catch(() => null),
        testService.getTestHistory(user.id, 10).catch(() => ({ history: [], analytics: {} }))
      ]);

      // Merge analytics with history data
      if (analyticsData || historyData.history?.length > 0) {
        setAnalytics({
          ...analyticsData,
          // Use history analytics if main analytics is empty
          overall_average: analyticsData?.overall_average ?? historyData.analytics?.average_score ?? 0,
          total_tests_taken: analyticsData?.total_tests_taken ?? historyData.analytics?.total_tests ?? 0,
          best_score: analyticsData?.best_score ?? Math.max(...(historyData.history?.map(t => t.score) || [0]), 0),
          topics_strong: analyticsData?.topics_strong ?? 0,
          topics_moderate: analyticsData?.topics_moderate ?? 0,
          topics_weak: analyticsData?.topics_weak ?? 0,
          recent_tests: historyData.history || []
        });
      } else {
        setError("No test data available");
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setError("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOne = (sessionId, e) => {
    e.stopPropagation(); // Prevent navigation when clicking delete
    setDeleteConfirm({ show: true, type: 'one', sessionId });
  };

  const handleDeleteAll = () => {
    setDeleteConfirm({ show: true, type: 'all', sessionId: null });
  };

  const confirmDelete = async () => {
    try {
      if (deleteConfirm.type === 'one') {
        await testService.deleteTestHistory(deleteConfirm.sessionId);
      } else {
        await testService.deleteAllTestHistory(user.id);
      }
      // Refresh data
      fetchData();
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setDeleteConfirm({ show: false, type: null, sessionId: null });
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBg = (score) => {
    if (score >= 80) return "bg-green-50 border-green-200";
    if (score >= 60) return "bg-yellow-50 border-yellow-200";
    return "bg-red-50 border-red-200";
  };

  const getTrendIcon = (trend) => {
    if (trend === "improving") return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === "declining") return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getPerformanceLevel = (score) => {
    if (score >= 80) return { label: "Excellent", color: "green", icon: Trophy };
    if (score >= 60) return { label: "Good", color: "yellow", icon: Target };
    return { label: "Needs Practice", color: "red", icon: AlertTriangle };
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto" />
            <p className="text-gray-500">Loading your performance data...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !analytics) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto" />
            <h2 className="text-2xl font-bold text-gray-800">No Test Data Yet</h2>
            <p className="text-gray-500 max-w-md mx-auto">
              Complete some tests to see your performance analytics.
            </p>
            <div className="flex gap-3 justify-center mt-6">
              <Button onClick={() => navigate("/test")} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
                <Brain className="w-4 h-4" />
                Take Your First Test
              </Button>
              <Button variant="outline" onClick={() => navigate("/dashboard")} className="gap-2">
                <Home className="w-4 h-4" />
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const perfLevel = getPerformanceLevel(analytics.overall_average);
  const PerfIcon = perfLevel.icon;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <BarChart3 className="w-7 h-7 text-purple-600" />
              Performance Report
            </h1>
            <p className="text-gray-500 mt-1">
              {user.preferredSubject || "Mathematics"} - Class {user.classLevel || 10}
            </p>
          </div>
          <Button
            onClick={() => navigate("/test")}
            className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
          >
            <Brain className="w-4 h-4" />
            Take Test
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`rounded-2xl p-6 border-2 ${getScoreBg(analytics.overall_average)}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Overall Average</span>
              <PerfIcon className="w-5 h-5" />
            </div>
            <div className={`text-4xl font-bold ${getScoreColor(analytics.overall_average)}`}>
              {analytics.overall_average.toFixed(1)}%
            </div>
            <p className="text-sm font-medium mt-1">
              {perfLevel.label}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Tests Taken</span>
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-4xl font-bold text-gray-800">
              {analytics.total_tests_taken}
            </div>
            <p className="text-sm text-gray-500 mt-1">This month</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Best Score</span>
              <Award className="w-5 h-5 text-amber-600" />
            </div>
            <div className="text-4xl font-bold text-amber-600">
              {analytics.best_score.toFixed(0)}%
            </div>
            <p className="text-sm text-gray-500 mt-1">Personal best</p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-6 border border-orange-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Study Streak</span>
              <Flame className="w-5 h-5 text-orange-600" />
            </div>
            <div className="text-4xl font-bold text-orange-600">
              {Math.min(analytics.total_tests_taken, 7)}
            </div>
            <p className="text-sm text-gray-500 mt-1">days</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-2xl p-6 border border-green-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-xl">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600">{analytics.topics_strong}</div>
                <p className="text-sm text-gray-600">Strong Topics</p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 rounded-2xl p-6 border border-yellow-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-100 rounded-xl">
                <Target className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <div className="text-3xl font-bold text-yellow-600">{analytics.topics_moderate}</div>
                <p className="text-sm text-gray-600">Moderate Topics</p>
              </div>
            </div>
          </div>

          <div className="bg-red-50 rounded-2xl p-6 border border-red-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <div className="text-3xl font-bold text-red-600">{analytics.topics_weak}</div>
                <p className="text-sm text-gray-600">Needs Practice</p>
              </div>
            </div>
          </div>
        </div>

        {/* Test History Section - Always show */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              Recent Test History
            </h3>
            {analytics.recent_tests && analytics.recent_tests.length > 0 && (
              <button
                onClick={handleDeleteAll}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </button>
            )}
          </div>
          {analytics.recent_tests && analytics.recent_tests.length > 0 ? (
            <div className="space-y-3">
              {analytics.recent_tests.map((test, idx) => (
                <div
                  key={idx}
                  onClick={() => navigate(`/test-result`, {
                    state: {
                      result: { session_id: test.session_id },
                      fromHistory: true
                    }
                  })}
                  className="group flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-purple-50 cursor-pointer transition-colors border border-gray-100 hover:border-purple-200"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${test.score >= 80 ? 'bg-green-100' :
                      test.score >= 60 ? 'bg-yellow-100' : 'bg-red-100'
                      }`}>
                      <BookOpen className={`w-5 h-5 ${test.score >= 80 ? 'text-green-600' :
                        test.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`} />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">
                        {test.subject} - Ch.{test.chapter_number}
                      </div>
                      <div className="text-sm text-gray-500">
                        {test.topic_name || 'Topic Test'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className={`text-lg font-bold ${getScoreColor(test.score)}`}>
                        {test.score?.toFixed(0) || 0}%
                      </div>
                      <div className="text-xs text-gray-400">
                        {test.completed_at ? new Date(test.completed_at).toLocaleDateString() : 'Recent'}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteOne(test.session_id, e)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete this test"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="text-gray-400">→</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>No test history yet</p>
              <p className="text-sm">Complete some tests to see your history here</p>
            </div>
          )}
        </div>

        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold mb-2">Ready to Improve?</h3>
              <p className="text-purple-100">
                Take more tests to improve your scores and master new topics
              </p>
            </div>
            <Button
              onClick={() => navigate("/test")}
              className="bg-white text-purple-600 hover:bg-gray-100 gap-2"
            >
              <Brain className="w-5 h-5" />
              Start Test
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">Confirm Delete</h3>
              <button
                onClick={() => setDeleteConfirm({ show: false, type: null, sessionId: null })}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-gray-600 mb-6">
              {deleteConfirm.type === 'all'
                ? "Are you sure you want to delete ALL your test history? This cannot be undone."
                : "Are you sure you want to delete this test from your history? This cannot be undone."
              }
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm({ show: false, type: null, sessionId: null })}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
