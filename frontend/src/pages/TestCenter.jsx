import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import useUserStore from "../stores/userStore";
import {
  FileText,
  Brain,
  Award,
  BookOpen,
  Target,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  Play,
  ClipboardList,
  Calendar,
  User
} from "lucide-react";
import TopicSelector from "../components/test/TopicSelector";
import { testService } from "../services/api";

/**
 * TestCenter Page
 * 
 * Minimal, clean design with white/light theme.
 * Two types of tests: AI Tests and Staff Tests
 */

export default function TestCenter() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [activeTab, setActiveTab] = useState("ai");
  const [staffTests, setStaffTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTopicSelector, setShowTopicSelector] = useState(false);

  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    fetchTests();
  }, [user.id, user.preferredSubject]);

  const fetchTests = async () => {
    setLoading(true);
    try {
      const [staffData, analyticsData] = await Promise.all([
        testService.getStaffTests(user.preferredSubject, null, user.id),
        // Use getTestAnalytics without subject filter to show ALL tests
        testService.getTestAnalytics(user.id, user.classLevel || 10, null)
      ]);
      setStaffTests(Array.isArray(staffData) ? staffData : []);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error("Failed to fetch tests:", error);
      setStaffTests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTopicSelected = async (config) => {
    setShowTopicSelector(false);
    navigate("/test-session", {
      state: {
        testConfig: {
          student_id: user.id,
          class_level: user.classLevel || 10,
          test_type: 'ai_with_analytics',  // NEW: Enable topic-level analytics
          ...config
        }
      }
    });
  };

  const tabs = [
    { id: "ai", label: "AI Tests", icon: Brain },
    { id: "staff", label: "Staff Tests", icon: FileText },
  ];

  // Quick stats
  const stats = [
    { label: "Tests Taken", value: analytics?.total_tests_taken || "0", icon: CheckCircle2 },
    { label: "Avg. Score", value: `${analytics?.overall_average || 0}%`, icon: TrendingUp },
    { label: "This Week", value: analytics?.tests_this_week || "0", icon: Clock },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Test Center</h1>
            <p className="text-gray-500 mt-1">
              Take tests and track your learning progress
            </p>
          </div>
          <button
            onClick={() => navigate("/report-card")}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium"
          >
            <Award className="w-4 h-4" />
            View Reports
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl p-5 border border-gray-100"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center">
                  <stat.icon className="w-6 h-6 text-gray-400" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all ${activeTab === tab.id
                ? "bg-orange-600 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-gray-800" />
          </div>
        ) : (
          <>
            {/* AI Tests Tab */}
            {activeTab === "ai" && (
              <div className="space-y-6">
                {/* Main CTA Card */}
                <div className="bg-white rounded-3xl p-8 border border-gray-100">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Brain className="w-10 h-10 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-gray-900 mb-2">
                        Take an AI-Powered Test
                      </h2>
                      <p className="text-gray-500 mb-4">
                        Select a topic from your syllabus. Get instant evaluation with detailed feedback.
                      </p>
                      <button
                        onClick={() => setShowTopicSelector(true)}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium"
                      >
                        <Play className="w-5 h-5" />
                        Start Test
                      </button>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white rounded-2xl p-6 border border-gray-100">
                    <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-4">
                      <Target className="w-6 h-6 text-gray-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-2">Topic-Focused</h4>
                    <p className="text-sm text-gray-500">
                      Pre-generated questions for every topic in your syllabus.
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl p-6 border border-gray-100">
                    <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-4">
                      <TrendingUp className="w-6 h-6 text-gray-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-2">Smart Recommendations</h4>
                    <p className="text-sm text-gray-500">
                      Get topic suggestions based on your weak areas.
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl p-6 border border-gray-100">
                    <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-4">
                      <Brain className="w-6 h-6 text-gray-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-2">AI Evaluation</h4>
                    <p className="text-sm text-gray-500">
                      RAG-based answer evaluation for accurate assessment.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Staff Tests Tab */}
            {activeTab === "staff" && (
              <div className="space-y-6">
                {/* Info Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center">
                      <ClipboardList className="w-7 h-7 text-gray-600 dark:text-gray-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Tests from Your Teachers</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Take tests assigned by your teachers and admin. Get instant results and feedback.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tests List */}
                {staffTests.length === 0 ? (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border border-gray-100 dark:border-gray-700">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-gray-300 dark:text-gray-500" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Tests Available</h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      No tests have been assigned to you yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {staffTests.map((test) => {
                      const now = new Date();
                      const startDate = test.start_date ? new Date(test.start_date) : null;
                      const dueDate = test.due_date ? new Date(test.due_date) : null;
                      const isBeforeStart = startDate && now < startDate;
                      const isAfterDue = dueDate && now > dueDate;
                      const isActive = !isBeforeStart && !isAfterDue;

                      return (
                        <div
                          key={test.id}
                          className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{test.title}</h3>
                                {test.has_attempted && (
                                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Attempted
                                  </span>
                                )}
                                {isBeforeStart && (
                                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
                                    Upcoming
                                  </span>
                                )}
                                {isAfterDue && (
                                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-medium">
                                    Closed
                                  </span>
                                )}
                              </div>
                              {test.description && (
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{test.description}</p>
                              )}
                              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                                {test.subject && (
                                  <span className="flex items-center gap-1">
                                    <BookOpen className="w-4 h-4" />
                                    {test.subject}
                                  </span>
                                )}
                                {test.questions_count > 0 && (
                                  <span className="flex items-center gap-1">
                                    <ClipboardList className="w-4 h-4" />
                                    {test.questions_count} questions
                                  </span>
                                )}
                                {test.duration_minutes > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    {test.duration_minutes} min
                                  </span>
                                )}
                                {test.total_points > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Award className="w-4 h-4" />
                                    {test.total_points} points
                                  </span>
                                )}
                                {startDate && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    {startDate.toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              {test.has_attempted && test.best_score != null && (
                                <div className="mt-3">
                                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                    Best Score: {test.best_score}%
                                  </span>
                                  {test.attempts_remaining != null && test.attempts_remaining > 0 && (
                                    <span className="text-xs text-gray-400 ml-3">
                                      {test.attempts_remaining} attempt{test.attempts_remaining !== 1 ? 's' : ''} remaining
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex-shrink-0 ml-4">
                              {isActive && (!test.has_attempted || (test.attempts_remaining && test.attempts_remaining > 0)) ? (
                                <button
                                  onClick={() => navigate(`/assessments/${test.id}`)}
                                  className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium transition-colors"
                                >
                                  <Play className="w-4 h-4" />
                                  {test.has_attempted ? "Retake" : "Take Test"}
                                </button>
                              ) : isBeforeStart ? (
                                <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                                  Starts {startDate.toLocaleDateString()}
                                </div>
                              ) : test.has_attempted ? (
                                <button
                                  onClick={() => navigate(`/assessments/${test.id}`)}
                                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-medium transition-colors"
                                >
                                  View Results
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Topic Selector Modal */}
      {showTopicSelector && (
        <TopicSelector
          studentId={user.id}
          classLevel={user.classLevel || 10}
          onSelectTopic={handleTopicSelected}
          onCancel={() => setShowTopicSelector(false)}
        />
      )}
    </DashboardLayout>
  );
}
