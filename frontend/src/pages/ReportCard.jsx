import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import useUserStore from "../stores/userStore";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Award,
  BookOpen,
  Brain,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Calendar,
  Trophy,
  ChevronRight,
  Zap,
  Activity
} from "lucide-react";
import { Button } from "../components/ui/button";
import { testService } from "../services/api";

export default function ReportCard() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState("All Subjects");
  const [subjectData, setSubjectData] = useState({});

  useEffect(() => {
    fetchData();
  }, [user.id, user.classLevel]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [analyticsData, historyData] = await Promise.all([
        testService.getTestAnalytics(user.id, user.classLevel || 10, null).catch(() => null),
        testService.getTestHistory(user.id, 50).catch(() => ({ history: [], analytics: {} }))
      ]);

      // Group tests by subject
      const bySubject = {};
      historyData.history?.forEach(test => {
        const subject = test.subject || "General";
        if (!bySubject[subject]) {
          bySubject[subject] = { tests: [], totalScore: 0, count: 0 };
        }
        bySubject[subject].tests.push(test);
        bySubject[subject].totalScore += test.score || 0;
        bySubject[subject].count++;
      });

      // Calculate averages
      Object.keys(bySubject).forEach(subject => {
        bySubject[subject].average = bySubject[subject].totalScore / bySubject[subject].count;
        bySubject[subject].best = Math.max(...bySubject[subject].tests.map(t => t.score || 0));
      });

      setSubjectData(bySubject);
      setAnalytics({
        ...analyticsData,
        overall_average: analyticsData?.overall_average ?? historyData.analytics?.average_score ?? 0,
        total_tests_taken: analyticsData?.total_tests_taken ?? historyData.analytics?.total_tests ?? 0,
        best_score: analyticsData?.best_score ?? Math.max(...(historyData.history?.map(t => t.score) || [0]), 0),
        recent_tests: historyData.history || []
      });
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const subjects = ["All Subjects", ...Object.keys(subjectData)];

  const currentTests = selectedSubject === "All Subjects"
    ? analytics?.recent_tests || []
    : subjectData[selectedSubject]?.tests || [];

  const currentAverage = selectedSubject === "All Subjects"
    ? analytics?.overall_average || 0
    : subjectData[selectedSubject]?.average || 0;

  const currentBest = selectedSubject === "All Subjects"
    ? analytics?.best_score || 0
    : subjectData[selectedSubject]?.best || 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
            <p className="text-gray-500">Loading your performance data...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!analytics || analytics.total_tests_taken === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <BarChart3 className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">No Test Data Yet</h2>
            <p className="text-gray-500 max-w-md mx-auto">
              Complete some tests to see your performance analytics and insights.
            </p>
            <Button onClick={() => navigate("/test")} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 mt-4">
              <Brain className="w-4 h-4" />
              Take Your First Test
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex gap-6 h-full">
        {/* Left Sidebar - Subject Selection */}
        <div className="w-64 bg-white rounded-2xl p-4 border border-gray-100 h-fit sticky top-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">
            Subjects
          </h3>
          <div className="space-y-1">
            {subjects.map((subject) => (
              <button
                key={subject}
                onClick={() => setSelectedSubject(subject)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${selectedSubject === subject
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-gray-700 hover:bg-gray-50"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="w-4 h-4" />
                  <span className="font-medium text-sm">{subject}</span>
                </div>
                {subject !== "All Subjects" && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${selectedSubject === subject
                      ? "bg-white/20 text-white"
                      : "bg-gray-100 text-gray-600"
                    }`}>
                    {subjectData[subject]?.count || 0}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{selectedSubject}</h1>
              <p className="text-gray-500 mt-1">Performance Analytics - Class {user.classLevel}</p>
            </div>
            <Button onClick={() => navigate("/test")} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
              <Brain className="w-4 h-4" />
              New Test
            </Button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-100 text-sm">Average Score</span>
                <Trophy className="w-5 h-5 text-blue-200" />
              </div>
              <div className="text-4xl font-bold">{currentAverage.toFixed(1)}%</div>
              <p className="text-blue-100 text-sm mt-1">Overall performance</p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">Tests Taken</span>
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-4xl font-bold text-gray-900">{currentTests.length}</div>
              <p className="text-gray-500 text-sm mt-1">Total completed</p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm">Best Score</span>
                <Award className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-4xl font-bold text-amber-600">{currentBest.toFixed(0)}%</div>
              <p className="text-gray-500 text-sm mt-1">Personal best</p>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl p-6 border border-emerald-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-emerald-700 text-sm">Accuracy</span>
                <Target className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-4xl font-bold text-emerald-600">
                {currentAverage >= 80 ? "High" : currentAverage >= 60 ? "Good" : "Fair"}
              </div>
              <p className="text-emerald-700 text-sm mt-1">Performance level</p>
            </div>
          </div>

          {/* Improvement Areas */}
          {currentAverage < 80 && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-orange-100 rounded-xl">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Areas for Improvement</h3>
                  <p className="text-sm text-gray-600">Focus on these topics to boost your score</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {currentTests.slice(0, 3).filter(t => t.score < 70).map((test, idx) => (
                  <div key={idx} className="bg-white rounded-xl p-4 border border-orange-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{test.topic_name || `Chapter ${test.chapter_number}`}</span>
                      <span className="text-lg font-bold text-red-600">{test.score?.toFixed(0)}%</span>
                    </div>
                    <p className="text-xs text-gray-500">Needs practice</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Tests */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Recent Tests
            </h3>
            <div className="space-y-3">
              {currentTests.slice(0, 10).map((test, idx) => (
                <div
                  key={idx}
                  onClick={() => navigate(`/test-result`, {
                    state: { result: { session_id: test.session_id }, fromHistory: true }
                  })}
                  className="group flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-blue-50 cursor-pointer transition-all border border-gray-100 hover:border-blue-200"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${test.score >= 80 ? 'bg-green-100' : test.score >= 60 ? 'bg-yellow-100' : 'bg-red-100'
                      }`}>
                      <span className={`text-lg font-bold ${test.score >= 80 ? 'text-green-600' : test.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                        {test.score?.toFixed(0)}
                      </span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {test.subject} - Chapter {test.chapter_number}
                      </div>
                      <div className="text-sm text-gray-500">{test.topic_name || 'Topic Test'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                      {test.completed_at ? new Date(test.completed_at).toLocaleDateString() : 'Recent'}
                    </span>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
