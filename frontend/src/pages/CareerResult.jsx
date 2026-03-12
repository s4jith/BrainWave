import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Compass, ArrowLeft, RotateCcw, TrendingUp, Target, Brain,
  Shield, AlertCircle, Loader2, Star, Award, BarChart3, ChevronRight
} from "lucide-react";
import useUserStore from "../stores/userStore";
import authFetch from "../utils/authFetch";

const API_URL = import.meta.env.VITE_API_URL;

const DOMAIN_COLORS = {
  QA: { bg: "bg-blue-500", light: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400" },
  SCI: { bg: "bg-emerald-500", light: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400" },
  LOG: { bg: "bg-purple-500", light: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-400" },
  COMP: { bg: "bg-cyan-500", light: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-700 dark:text-cyan-400" },
  BIO: { bg: "bg-green-500", light: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400" },
  VERB: { bg: "bg-amber-500", light: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400" },
  CREA: { bg: "bg-pink-500", light: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-700 dark:text-pink-400" },
  SOC: { bg: "bg-indigo-500", light: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-400" },
};

export default function CareerResult() {
  const { resultId } = useParams();
  const navigate = useNavigate();
  const { accessToken } = useUserStore();
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(`${API_URL}/api/career/results/${resultId}`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to load result");
        setResult(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [resultId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400 font-medium">{error || "Result not found"}</p>
          <button
            onClick={() => navigate("/career-test")}
            className="mt-4 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium"
          >
            Back to Career Test
          </button>
        </div>
      </div>
    );
  }

  const { domain_scores, top_careers, all_career_matches, confidence, cognitive_profile, completed_at } = result;

  // Sort domains by score descending  
  const sortedDomains = [...(domain_scores || [])].sort((a, b) => b.normalized_score - a.normalized_score);
  const topDomains = sortedDomains.slice(0, 3);
  const weakDomains = sortedDomains.filter((d) => d.normalized_score < 30);

  const topThreeCareers = top_careers || [];
  const allCareers = all_career_matches || [];
  const conf = confidence || {};

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <button
            onClick={() => navigate("/career-test")}
            className="flex items-center gap-1.5 text-indigo-200 hover:text-white text-sm mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-3 mb-2">
            <Compass className="w-8 h-8" />
            <h1 className="text-2xl font-bold">Your Career Analysis</h1>
          </div>
          <p className="text-indigo-200 text-sm">
            Completed {completed_at ? new Date(completed_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—"}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 -mt-4">

        {/* ── Top 3 Career Recommendations ────────────────────────────── */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Top 3 Career Recommendations</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {topThreeCareers.map((c, i) => {
                const medals = ["🥇", "🥈", "🥉"];
                const borderColors = [
                  "border-yellow-400 dark:border-yellow-600",
                  "border-gray-300 dark:border-gray-500",
                  "border-amber-600 dark:border-amber-700",
                ];
                return (
                  <div
                    key={c.career}
                    className={`rounded-xl border-2 ${borderColors[i]} p-5 bg-gradient-to-br ${
                      i === 0
                        ? "from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10"
                        : "from-white to-gray-50 dark:from-gray-800 dark:to-gray-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">{medals[i]}</span>
                      <span className="text-xs font-semibold text-gray-400 uppercase">#{i + 1} Match</span>
                    </div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">{c.career}</h3>
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{c.match_percentage?.toFixed(1)}</span>
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                    {c.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{c.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Cognitive Profile (Domain Scores) ───────────────────────── */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Cognitive Profile</h2>
          </div>
          <div className="p-6">
            {/* Strength highlights */}
            <div className="flex flex-wrap gap-2 mb-6">
              {topDomains.map((d) => (
                <span
                  key={d.domain}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold ${DOMAIN_COLORS[d.domain]?.light || "bg-gray-100"} ${DOMAIN_COLORS[d.domain]?.text || ""}`}
                >
                  <Star className="w-3 h-3 inline mr-1" />
                  {d.label}: {d.normalized_score.toFixed(0)}%
                </span>
              ))}
            </div>

            {/* Bar chart */}
            <div className="space-y-4">
              {sortedDomains.map((d) => (
                <div key={d.domain} className="flex items-center gap-3">
                  <div className="w-24 text-right">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">{d.domain}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${DOMAIN_COLORS[d.domain]?.bg || "bg-gray-500"}`}
                          style={{ width: `${Math.max(2, d.normalized_score)}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-gray-900 dark:text-white w-12 text-right">
                        {d.normalized_score.toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{d.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {weakDomains.length > 0 && (
              <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Areas for Improvement</p>
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  {weakDomains.map((d) => d.label).join(", ")} scored below 30%. Practice in these areas can broaden your career options.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Confidence Metrics ──────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Confidence Metrics</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{conf.questions_attempted || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Attempted</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{conf.questions_correct || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Correct</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{conf.accuracy_pct?.toFixed(1) || 0}%</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Accuracy</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{(conf.domain_coverage * 100)?.toFixed(0) || 0}%</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Domain Coverage</p>
              </div>
            </div>
            <div className={`p-4 rounded-xl border flex items-center gap-3 ${
              conf.confidence_label === "High"
                ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800"
                : conf.confidence_label === "Moderate"
                ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
                : "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
            }`}>
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-black ${
                conf.confidence_label === "High"
                  ? "bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300"
                  : conf.confidence_label === "Moderate"
                  ? "bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300"
                  : "bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300"
              }`}>
                {conf.confidence_score?.toFixed(0) || 0}
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {conf.confidence_label} Confidence
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {conf.confidence_label === "High"
                    ? "Your results are highly reliable. You attempted most questions with good accuracy."
                    : conf.confidence_label === "Moderate"
                    ? "Your results are fairly reliable. Attempting more questions could increase confidence."
                    : "Low reliability. Consider retaking the test and attempting more questions."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── All Career Matches ──────────────────────────────────────── */}
        {allCareers.length > 3 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">All Career Matches</h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {allCareers.map((c, i) => (
                <div key={c.career} className="flex items-center gap-4 px-6 py-4">
                  <span className="text-sm font-semibold text-gray-400 w-6 text-right">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.career}</p>
                    {c.description && (
                      <p className="text-xs text-gray-400 truncate">{c.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-24 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${c.match_percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white w-14 text-right">
                      {c.match_percentage?.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate("/career-test")}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Take Test Again
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="flex-1 py-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center gap-2 transition-colors"
          >
            Back to Dashboard <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
