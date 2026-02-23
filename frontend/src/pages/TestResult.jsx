import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import {
  Trophy,
  Target,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  BookOpen,
  TrendingUp,
  AlertTriangle,
  Home,
  RotateCcw,
  Award,
  Loader2,
  Star,
  ThumbsUp,
  Lightbulb,
  BarChart3,
  Hash,
  Percent,
  Eye,
  EyeOff,
  CircleCheck,
  CircleX,
  Sparkles,
  Brain,
  FileText
} from "lucide-react";
import { Button } from "../components/ui/button";
import { testService } from "../services/api";

/* ─── HELPERS ──────────────────────────────────────────── */

const pct = (n) => Math.round(n);

const grade = (score) => {
  if (score >= 90) return { letter: "A+", label: "Outstanding", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20", ring: "stroke-emerald-500" };
  if (score >= 80) return { letter: "A", label: "Excellent", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20", ring: "stroke-blue-500" };
  if (score >= 70) return { letter: "B+", label: "Very Good", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20", ring: "stroke-blue-400" };
  if (score >= 60) return { letter: "B", label: "Good", color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-900/20", ring: "stroke-yellow-500" };
  if (score >= 50) return { letter: "C", label: "Average", color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20", ring: "stroke-orange-500" };
  if (score >= 35) return { letter: "D", label: "Below Average", color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/20", ring: "stroke-red-400" };
  return { letter: "F", label: "Needs Work", color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20", ring: "stroke-red-500" };
};

const typeLabel = (t) => {
  const map = { mcq: "MCQ", fillup: "Fill-up", fill_up: "Fill-up", true_false: "True/False", short_answer: "Short Answer", long_answer: "Long Answer" };
  return map[t?.toLowerCase()] || t || "—";
};

const typeBadgeColor = (t) => {
  const map = {
    mcq: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    fillup: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    fill_up: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    true_false: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
    short_answer: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    long_answer: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  };
  return map[t?.toLowerCase()] || "bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-gray-300";
};

/* ─── CIRCULAR GAUGE ──────────────────────────────────── */

function ScoreGauge({ score, size = 140 }) {
  const g = grade(score);
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-gray-200 dark:text-zinc-700" strokeWidth={10} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className={g.ring} strokeWidth={10} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 1s ease-out" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${g.color}`}>{pct(score)}%</span>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{g.letter}</span>
      </div>
    </div>
  );
}

/* ─── PROGRESS BAR ────────────────────────────────────── */

function ProgressBar({ value, max = 100, height = "h-2.5" }) {
  const p = max > 0 ? (value / max) * 100 : 0;
  const color =
    p >= 70 ? "bg-emerald-500" :
    p >= 50 ? "bg-yellow-500" :
    p >= 30 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className={`w-full bg-gray-200 dark:bg-zinc-700 rounded-full ${height} overflow-hidden`}>
      <div className={`${color} ${height} rounded-full transition-all duration-700`} style={{ width: `${Math.min(p, 100)}%` }} />
    </div>
  );
}

/* ─── STAT CARD ───────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, color, subtext }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-100 dark:border-zinc-800 flex flex-col gap-1">
      <div className={`flex items-center gap-2 ${color} mb-1`}>
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {subtext && <p className="text-xs text-gray-500 dark:text-gray-400">{subtext}</p>}
    </div>
  );
}

/* ─── MAIN COMPONENT ──────────────────────────────────── */

export default function TestResult() {
  const navigate = useNavigate();
  const location = useLocation();
  const { result: passedResult, topicConfig, fromHistory } = location.state || {};

  const [expandedQuestions, setExpandedQuestions] = useState({});
  const [showAllQuestions, setShowAllQuestions] = useState(false);
  const [result, setResult] = useState(passedResult);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHistoricalResult = async () => {
      if (fromHistory && passedResult?.session_id && !passedResult.evaluations) {
        setLoading(true);
        try {
          const data = await testService.getTestResult(passedResult.session_id);
          setResult(data);
        } catch (err) {
          console.error("Failed to fetch test result:", err);
          setError("Failed to load test result");
        } finally {
          setLoading(false);
        }
      }
    };
    fetchHistoricalResult();
  }, [fromHistory, passedResult]);

  /* ─── derived data ─── */
  const analytics = useMemo(() => {
    if (!result) return null;
    const evals = result.evaluations || [];
    const correct = evals.filter(e => e.is_correct);
    const incorrect = evals.filter(e => !e.is_correct);
    const totalMarks = evals.reduce((s, e) => s + (e.max_score || 0), 0);
    const obtainedMarks = evals.reduce((s, e) => s + (e.score || 0), 0);
    const accuracy = evals.length > 0 ? (correct.length / evals.length) * 100 : 0;

    // group by question type
    const byType = {};
    evals.forEach(e => {
      const t = e.question_type || "other";
      if (!byType[t]) byType[t] = { total: 0, correct: 0, label: typeLabel(t) };
      byType[t].total++;
      if (e.is_correct) byType[t].correct++;
    });

    return { evals, correct, incorrect, totalMarks, obtainedMarks, accuracy, byType };
  }, [result]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
          <span className="text-gray-500 dark:text-gray-400">Loading test result...</span>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !result) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <AlertTriangle className="w-12 h-12 text-amber-500" />
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">{error || "No Results Found"}</h2>
          <p className="text-gray-500 dark:text-gray-400">Please complete a test first.</p>
          <Button onClick={() => navigate("/test-center")} className="gap-2">
            <Home className="w-4 h-4" />
            Go to Test Center
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const g = grade(result.score);
  const toggleQuestion = (id) => setExpandedQuestions(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleAll = () => {
    if (showAllQuestions) {
      setExpandedQuestions({});
    } else {
      const all = {};
      (result.evaluations || []).forEach((e, i) => { all[e.question_id || i] = true; });
      setExpandedQuestions(all);
    }
    setShowAllQuestions(!showAllQuestions);
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-10">

        {/* ════════ 1. HERO SCORE CARD ════════ */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
          <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
            {/* Gauge */}
            <ScoreGauge score={result.score} />

            {/* Info */}
            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <Trophy className="w-6 h-6 text-amber-500" />
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Test Complete!</h1>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {topicConfig?.topic_name || result.topic_name || "Topic Test"}
                {result.subject && <span> &middot; {result.subject}</span>}
                {result.chapter_number ? <span> &middot; Chapter {result.chapter_number}</span> : null}
              </p>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${g.bg} ${g.color}`}>
                <Star className="w-4 h-4" />
                {g.label}
              </div>

              {/* Overall feedback summary */}
              {result.feedback && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed max-w-xl">
                  {result.feedback}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ════════ 2. STATS GRID ════════ */}
        {analytics && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon={CheckCircle} label="Correct" value={analytics.correct.length} color="text-emerald-600" subtext={`of ${analytics.evals.length}`} />
            <StatCard icon={XCircle} label="Wrong" value={analytics.incorrect.length} color="text-red-500" subtext={`of ${analytics.evals.length}`} />
            <StatCard icon={Hash} label="Questions" value={result.total_questions || analytics.evals.length} color="text-blue-600" />
            <StatCard icon={Target} label="Marks" value={`${analytics.obtainedMarks}/${analytics.totalMarks}`} color="text-orange-600" subtext="obtained / total" />
            <StatCard icon={Percent} label="Score" value={`${pct(result.score)}%`} color={g.color} subtext={g.letter} />
            <StatCard icon={BarChart3} label="Accuracy" value={`${pct(analytics.accuracy)}%`} color="text-indigo-600" subtext={`${analytics.correct.length}/${analytics.evals.length} right`} />
          </div>
        )}

        {/* ════════ 3. PERFORMANCE BY QUESTION TYPE ════════ */}
        {analytics && Object.keys(analytics.byType).length > 1 && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-gray-800 dark:text-white">Performance by Question Type</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(analytics.byType).map(([type, data]) => {
                const p = data.total > 0 ? (data.correct / data.total) * 100 : 0;
                return (
                  <div key={type} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-xl">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${typeBadgeColor(type)}`}>{data.label}</span>
                    <div className="flex-1">
                      <ProgressBar value={p} height="h-2" />
                    </div>
                    <span className={`text-sm font-bold whitespace-nowrap ${p >= 60 ? "text-emerald-600" : p >= 40 ? "text-yellow-600" : "text-red-500"}`}>
                      {data.correct}/{data.total}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════════ 4. TOPIC ANALYTICS ════════ */}
        {result.topic_analytics && result.topic_analytics.topics?.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-6">
            <div className="flex items-center gap-2 mb-5">
              <Brain className="w-5 h-5 text-orange-600" />
              <h3 className="font-semibold text-gray-800 dark:text-white">Performance by Topic</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                ({result.topic_analytics.total_topics_covered} topic{result.topic_analytics.total_topics_covered !== 1 ? "s" : ""})
              </span>
            </div>

            {/* Strong & Weak summary pills */}
            {(result.topic_analytics.strong_topics?.length > 0 || result.topic_analytics.weak_topics?.length > 0) && (
              <div className="flex flex-wrap gap-2 mb-5">
                {result.topic_analytics.strong_topics?.map((t, i) => (
                  <span key={`s-${i}`} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <TrendingUp className="w-3 h-3" /> {t.name} — {pct(t.score)}%
                  </span>
                ))}
                {result.topic_analytics.weak_topics?.map((t, i) => (
                  <span key={`w-${i}`} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border border-red-200 dark:border-red-800">
                    <AlertTriangle className="w-3 h-3" /> {t.name} — {pct(t.score)}%
                  </span>
                ))}
              </div>
            )}

            {/* Detailed topic bars */}
            <div className="space-y-3">
              {result.topic_analytics.topics.map((topic, idx) => (
                <div key={idx} className="p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${topic.score_percentage >= 70 ? "bg-emerald-500" : topic.score_percentage >= 50 ? "bg-yellow-500" : "bg-red-500"}`} />
                      <span className="font-medium text-sm text-gray-800 dark:text-white">{topic.topic_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {topic.correct_answers}/{topic.total_questions} correct
                      </span>
                      <span className={`text-sm font-bold ${topic.score_percentage >= 70 ? "text-emerald-600" : topic.score_percentage >= 50 ? "text-yellow-600" : "text-red-500"}`}>
                        {pct(topic.score_percentage)}%
                      </span>
                    </div>
                  </div>
                  <ProgressBar value={topic.score_percentage} />

                  {/* Per-question dots */}
                  {topic.questions_detail && topic.questions_detail.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 mr-1">Questions:</span>
                      {topic.questions_detail.map((qd, qi) => (
                        <div
                          key={qi}
                          title={`Q${qd.question_number}: ${qd.is_correct ? "Correct" : "Wrong"} (${qd.score} marks)`}
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${qd.is_correct
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            }`}
                        >
                          {qd.question_number}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════ 5. STRENGTHS & AREAS TO IMPROVE ════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Strengths */}
          {result.strengths?.length > 0 && (
            <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold text-emerald-800 dark:text-emerald-300">
                  Strengths
                  <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400 ml-1">({result.strengths.length})</span>
                </h3>
              </div>
              <ul className="space-y-2">
                {result.strengths.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CircleCheck className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-emerald-800 dark:text-emerald-200 leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Areas to Improve */}
          {result.improvements?.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200 dark:border-amber-800 p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-amber-800 dark:text-amber-300">
                  Areas to Improve
                  <span className="text-xs font-normal text-amber-600 dark:text-amber-400 ml-1">({result.improvements.length})</span>
                </h3>
              </div>
              <ul className="space-y-2">
                {result.improvements.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Target className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* ════════ 6. TOPICS TO REVIEW ════════ */}
        {result.topics_to_review?.length > 0 && (
          <div className="bg-orange-50 dark:bg-orange-900/10 rounded-2xl border border-orange-200 dark:border-orange-800 p-5">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-5 h-5 text-orange-600" />
              <h3 className="font-semibold text-orange-800 dark:text-orange-300">
                Recommended Topics to Review
              </h3>
            </div>
            <div className="space-y-2">
              {result.topics_to_review.map((topic, index) => (
                <div key={index} className="flex items-center gap-3 p-2.5 bg-white/60 dark:bg-zinc-800/40 rounded-lg">
                  <span className="w-6 h-6 rounded-full bg-orange-200 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-sm text-orange-800 dark:text-orange-200">{topic}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════ 7. ANSWER MAP (visual overview) ════════ */}
        {analytics && analytics.evals.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Answer Map</p>
            <div className="flex flex-wrap gap-2">
              {analytics.evals.map((e, i) => (
                <div
                  key={i}
                  title={`Q${e.question_number || i + 1}: ${e.is_correct ? "Correct" : "Wrong"} (${e.score}/${e.max_score})`}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold cursor-default transition-transform hover:scale-110 ${e.is_correct
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800"
                    }`}
                >
                  {e.question_number || i + 1}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800" />
                Correct
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800" />
                Wrong
              </span>
            </div>
          </div>
        )}

        {/* ════════ 8. QUESTION-BY-QUESTION REVIEW ════════ */}
        {analytics && analytics.evals.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <h3 className="font-semibold text-gray-800 dark:text-white">Question-by-Question Review</h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({analytics.correct.length} correct, {analytics.incorrect.length} wrong)
                </span>
              </div>
              <button
                onClick={toggleAll}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
              >
                {showAllQuestions ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showAllQuestions ? "Collapse All" : "Expand All"}
              </button>
            </div>

            {/* Questions list */}
            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
              {analytics.evals.map((evaluation, index) => {
                const qKey = evaluation.question_id || index;
                const isExpanded = expandedQuestions[qKey];
                const qType = evaluation.question_type;
                const scoreRatio = evaluation.max_score > 0 ? (evaluation.score / evaluation.max_score) * 100 : 0;

                return (
                  <div key={qKey} className={`transition-colors ${!evaluation.is_correct ? "bg-red-50/30 dark:bg-red-900/5" : ""}`}>
                    {/* Question header row */}
                    <button
                      onClick={() => toggleQuestion(qKey)}
                      className="w-full p-4 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      {/* Status icon */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${evaluation.is_correct
                          ? "bg-emerald-100 dark:bg-emerald-900/30"
                          : "bg-red-100 dark:bg-red-900/30"
                        }`}>
                        {evaluation.is_correct
                          ? <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          : <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                        }
                      </div>

                      {/* Question info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-gray-800 dark:text-white">
                            Question {evaluation.question_number || index + 1}
                          </span>
                          {qType && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeBadgeColor(qType)}`}>
                              {typeLabel(qType)}
                            </span>
                          )}
                          <span className={`text-xs font-medium ${evaluation.is_correct ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                            {evaluation.score}/{evaluation.max_score} marks
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-lg">
                          {evaluation.question_text}
                        </p>
                      </div>

                      {/* Score pill on right */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreRatio >= 60 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : scoreRatio > 0 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"}`}>
                          {pct(scoreRatio)}%
                        </span>
                        {isExpanded
                          ? <ChevronUp className="w-4 h-4 text-gray-400" />
                          : <ChevronDown className="w-4 h-4 text-gray-400" />
                        }
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-4 pb-5 pt-1 ml-11 space-y-3">
                        {/* Question text */}
                        <div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Question</p>
                          <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed bg-gray-50 dark:bg-zinc-800 p-3 rounded-lg border border-gray-100 dark:border-zinc-700">
                            {evaluation.question_text}
                          </p>
                        </div>

                        {/* Answer comparison side by side */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Your answer */}
                          <div className={`rounded-lg p-3 border ${evaluation.is_correct
                              ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800"
                              : "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
                            }`}>
                            <p className={`text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1 ${evaluation.is_correct ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                              {evaluation.is_correct ? <CircleCheck className="w-3 h-3" /> : <CircleX className="w-3 h-3" />}
                              Your Answer
                            </p>
                            <p className={`text-sm leading-relaxed max-h-32 overflow-y-auto ${evaluation.is_correct ? "text-emerald-800 dark:text-emerald-200" : "text-red-800 dark:text-red-200"}`}>
                              {evaluation.student_answer || <span className="italic text-gray-400">No answer provided</span>}
                            </p>
                          </div>

                          {/* Correct answer */}
                          <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
                            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Correct Answer
                            </p>
                            <p className="text-sm text-emerald-800 dark:text-emerald-200 leading-relaxed max-h-32 overflow-y-auto">
                              {evaluation.correct_answer || "—"}
                            </p>
                          </div>
                        </div>

                        {/* Feedback */}
                        {evaluation.feedback && (
                          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                              <ThumbsUp className="w-3 h-3" />
                              Feedback
                            </p>
                            <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed max-h-32 overflow-y-auto">
                              {evaluation.feedback}
                            </p>
                          </div>
                        )}

                        {/* Explanation */}
                        {evaluation.explanation && (
                          <div className="bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800 rounded-lg p-3">
                            <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                              <Lightbulb className="w-3 h-3" />
                              Explanation
                            </p>
                            <p className="text-sm text-violet-800 dark:text-violet-200 leading-relaxed max-h-40 overflow-y-auto">
                              {evaluation.explanation}
                            </p>
                          </div>
                        )}

                        {/* Topic tag */}
                        {evaluation.topic && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <BookOpen className="w-3 h-3" />
                            Topic: <span className="font-medium text-gray-700 dark:text-gray-300">{evaluation.topic}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════════ 9. ACTIONS ════════ */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <Button
            variant="outline"
            onClick={() => navigate("/test-center")}
            className="gap-2 w-full sm:w-auto"
          >
            <Home className="w-4 h-4" />
            Back to Test Center
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => navigate("/report-card")}
              className="gap-2 flex-1 sm:flex-auto"
            >
              <Award className="w-4 h-4" />
              All Reports
            </Button>
            <Button
              onClick={() => navigate("/test-center")}
              className="bg-orange-600 hover:bg-orange-700 text-white gap-2 flex-1 sm:flex-auto"
            >
              <RotateCcw className="w-4 h-4" />
              Take Another Test
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
