import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Compass, Clock, ChevronRight, CheckCircle, AlertCircle,
  Loader2, Brain, ArrowRight, RotateCcw, Lock
} from "lucide-react";
import useUserStore from "../stores/userStore";
import authFetch from "../utils/authFetch";

const API_URL = import.meta.env.VITE_API_URL;

export default function CareerTest() {
  const navigate = useNavigate();
  const { accessToken, user } = useUserStore();
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };

  // ── State ──────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState("intro"); // intro | loading | test | submitting | done
  const [testId, setTestId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // qId→selectedOption
  const [timeLeft, setTimeLeft] = useState(45 * 60); // 45 min in seconds
  const [error, setError] = useState("");
  const [resultId, setResultId] = useState(null);
  const [pastResults, setPastResults] = useState([]);
  const [loadingPast, setLoadingPast] = useState(true);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [loadingAssignment, setLoadingAssignment] = useState(true);

  const timerRef = useRef(null);

  // ── Fetch active assignment & past results on mount ────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [assignRes, resultsRes] = await Promise.all([
          fetch(`${API_URL}/api/career/assignment/active`, { headers }),
          fetch(`${API_URL}/api/career/results/me`, { headers }),
        ]);
        const assignData = await assignRes.json();
        const resultsData = await resultsRes.json();
        if (assignRes.ok) setActiveAssignment(assignData.active ? assignData.assignment : null);
        if (resultsRes.ok) setPastResults(resultsData.results || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingAssignment(false);
        setLoadingPast(false);
      }
    })();
  }, []);

  // ── Timer ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "test") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  // ── Start test ─────────────────────────────────────────────────────────
  const handleStart = async () => {
    setPhase("loading");
    setError("");
    try {
      const res = await authFetch(`${API_URL}/api/career/test/start`, {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to start test");

      setTestId(data.test_id);
      setQuestions(data.questions || []);
      setTimeLeft((data.time_limit_minutes || 45) * 60);
      setCurrentIdx(0);
      setAnswers({});
      setPhase("test");
    } catch (e) {
      setError(e.message);
      setPhase("intro");
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    clearInterval(timerRef.current);
    setPhase("submitting");
    setError("");
    try {
      const answerList = Object.entries(answers).map(([qid, opt]) => ({
        question_id: qid,
        selected_option: opt,
      }));

      const res = await authFetch(`${API_URL}/api/career/test/submit`, {
        method: "POST",
        headers,
        body: JSON.stringify({ test_id: testId, answers: answerList }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Submit failed");

      setResultId(data.result_id);
      setPhase("done");
    } catch (e) {
      setError(e.message);
      setPhase("test"); // go back to test if submit failed
    }
  };

  const handleSelect = (qId, optIdx) => {
    setAnswers((prev) => ({ ...prev, [qId]: optIdx }));
  };

  const answered = Object.keys(answers).length;
  const totalQ = questions.length;
  const current = questions[currentIdx];

  // ═══════════════════════════════════════════════════════════════════════
  //  INTRO
  // ═══════════════════════════════════════════════════════════════════════
  if (phase === "intro") {
    // Show spinner while checking assignment status
    if (loadingAssignment) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      );
    }

    // No active assignment — admin has not opened the test yet
    if (!activeAssignment) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg overflow-hidden">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 text-center text-white">
                <div className="w-16 h-16 mx-auto mb-4 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Compass className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold">Career Analysis Test</h1>
                <p className="mt-2 text-indigo-100 text-sm">
                  Discover your cognitive strengths and ideal career paths.
                </p>
              </div>
              <div className="p-8 flex flex-col items-center text-center gap-4">
                <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                  <Lock className="w-7 h-7 text-amber-600 dark:text-amber-400" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Test Not Available Yet</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                  The career analysis test has not been assigned by your admin yet.
                  Please check back later or contact your administrator.
                </p>
              </div>
              {!loadingPast && pastResults.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-800 p-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Your Past Results</h3>
                  <div className="space-y-2">
                    {pastResults.slice(0, 5).map((r) => (
                      <button
                        key={r.result_id}
                        onClick={() => navigate(`/career-result/${r.result_id}`)}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {r.top_careers?.[0]?.career || "Career Test"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {r.completed_at ? new Date(r.completed_at).toLocaleDateString() : "—"}
                            {r.confidence?.confidence_label && ` · ${r.confidence.confidence_label} confidence`}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg overflow-hidden">
            {/* Hero */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 text-center text-white">
              <div className="w-16 h-16 mx-auto mb-4 bg-white/20 rounded-2xl flex items-center justify-center">
                <Compass className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold">Career Analysis Test</h1>
              <p className="mt-2 text-indigo-100 text-sm">
                Discover your cognitive strengths and ideal career paths through a 30-question assessment.
              </p>
            </div>

            <div className="p-8 space-y-6">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">30</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Questions</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">45</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Minutes</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">8</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Domains</p>
                </div>
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 text-sm text-indigo-800 dark:text-indigo-300">
                <p className="font-semibold mb-1">How it works</p>
                <ul className="space-y-1 text-xs">
                  <li>• Answer 30 MCQs across multiple subjects</li>
                  <li>• Each question tests one or more cognitive domains</li>
                  <li>• Your answers build a cognitive profile vector</li>
                  <li>• We match your profile against career archetypes</li>
                  <li>• Get your top 3 career recommendations with match %</li>
                </ul>
              </div>

              <button
                onClick={handleStart}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Brain className="w-5 h-5" /> Start Test
              </button>
            </div>

            {/* Past Results */}
            {!loadingPast && pastResults.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Your Past Results</h3>
                <div className="space-y-2">
                  {pastResults.slice(0, 5).map((r) => (
                    <button
                      key={r.result_id}
                      onClick={() => navigate(`/career-result/${r.result_id}`)}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {r.top_careers?.[0]?.career || "Career Test"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {r.completed_at ? new Date(r.completed_at).toLocaleDateString() : "—"}
                          {r.confidence?.confidence_label && ` · ${r.confidence.confidence_label} confidence`}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  LOADING
  // ═══════════════════════════════════════════════════════════════════════
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">Preparing your test...</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  SUBMITTING
  // ═══════════════════════════════════════════════════════════════════════
  if (phase === "submitting") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">Analyzing your cognitive profile...</p>
          <p className="text-sm text-gray-400 mt-1">Computing domain scores & career matches</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  DONE
  // ═══════════════════════════════════════════════════════════════════════
  if (phase === "done") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Test Completed!</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            You answered {answered} out of {totalQ} questions. Your career analysis is ready.
          </p>
          <button
            onClick={() => navigate(`/career-result/${resultId}`)}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            View Your Results <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate("/career-test")}
            className="w-full mt-3 py-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center gap-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Take Again
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  TEST (main question view)
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Compass className="w-5 h-5 text-indigo-600" />
            <span className="font-semibold text-gray-900 dark:text-white text-sm">
              Career Test
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {answered}/{totalQ} answered
            </span>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-mono font-semibold ${
              timeLeft < 300
                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
            }`}>
              <Clock className="w-3.5 h-3.5" />
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-gray-200 dark:bg-gray-800">
        <div
          className="h-1 bg-indigo-600 transition-all duration-300"
          style={{ width: `${((currentIdx + 1) / totalQ) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {current && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-full text-xs font-medium">
                {current.subject}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                current.difficulty === 1
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : current.difficulty === 2
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}>
                {({ 1: "Easy", 2: "Medium", 3: "Hard" })[current.difficulty]}
              </span>
              <span className="ml-auto text-sm text-gray-400">
                {currentIdx + 1} / {totalQ}
              </span>
            </div>

            <h2 className="text-lg font-semibold text-gray-900 dark:text-white leading-relaxed mb-6">
              {current.question_text}
            </h2>

            <div className="space-y-3">
              {current.options.map((opt, oi) => {
                const isSelected = answers[current.id] === oi;
                return (
                  <button
                    key={oi}
                    onClick={() => handleSelect(current.id, oi)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-600"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                        isSelected
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                      }`}>
                        {String.fromCharCode(65 + oi)}
                      </span>
                      <span className={`text-sm ${
                        isSelected
                          ? "text-indigo-900 dark:text-indigo-200 font-medium"
                          : "text-gray-700 dark:text-gray-300"
                      }`}>
                        {opt}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
            className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            Previous
          </button>

          {currentIdx < totalQ - 1 ? (
            <button
              onClick={() => setCurrentIdx((i) => Math.min(totalQ - 1, i + 1))}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium flex items-center gap-2 transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold flex items-center gap-2 transition-colors"
            >
              <CheckCircle className="w-4 h-4" /> Submit Test
            </button>
          )}
        </div>

        {/* Question Navigator */}
        <div className="mt-8 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
            Question Navigator
          </p>
          <div className="flex flex-wrap gap-2">
            {questions.map((q, qi) => {
              const isAnswered = q.id in answers;
              const isCurrent = qi === currentIdx;
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIdx(qi)}
                  className={`w-9 h-9 rounded-lg text-xs font-semibold transition-all ${
                    isCurrent
                      ? "bg-indigo-600 text-white ring-2 ring-indigo-300 dark:ring-indigo-800"
                      : isAnswered
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {qi + 1}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
