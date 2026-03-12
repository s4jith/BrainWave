import { useState, useEffect, useCallback } from "react";
import {
  Search, Check, X, ChevronLeft, FileText, GraduationCap,
  BookOpen, Calendar, Loader2, Edit2, ChevronDown, ChevronUp, Plus
} from "lucide-react";
import useUserStore from "../stores/userStore";
import authFetch from "../utils/authFetch";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const TYPE_COLORS = {
  mcq: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  fillup: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  true_false: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  short_answer: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  long_answer: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

const QUESTION_TYPES = {
  mcq: "MCQ",
  fillup: "Fill-in",
  true_false: "True/False",
  short_answer: "Short",
  long_answer: "Long",
};

const PAPER_TYPE_LABELS = {
  quarterly: "Quarterly",
  half_yearly: "Half Yearly",
  annual: "Annual",
  unit_test: "Unit Test",
  pre_board: "Pre Board",
};

/**
 * QuestionPaperSelector
 * Allows selecting questions from existing Question Papers for use in test creation.
 * Props:
 *   onSelect(questions[]) - called with array of selected question objects
 *   onClose() - close the modal
 *   preSelectedIds[] - IDs already in the test
 *   defaultClass - pre-filter class
 *   defaultSubject - pre-filter subject
 */
const QuestionPaperSelector = ({
  onSelect,
  onClose,
  preSelectedIds = [],
  defaultClass = "",
  defaultSubject = "",
}) => {
  const { getAuthHeader } = useUserStore();

  // View: "papers" = list of papers, "questions" = questions of a selected paper
  const [view, setView] = useState("papers");
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [paperQuestions, setPaperQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Paper list state
  const [papers, setPapers] = useState([]);
  const [papersTotal, setPapersTotal] = useState(0);
  const [loadingPapers, setLoadingPapers] = useState(true);
  const [filters, setFilters] = useState({
    class_level: defaultClass ? String(defaultClass) : "",
    subject: defaultSubject || "",
    paper_type: "",
    year: "",
    search: "",
  });

  // Selected question IDs across all papers
  const [selectedIds, setSelectedIds] = useState([...preSelectedIds]);
  // Map of id -> question object for already-selected questions
  const [selectedQuestionsMap, setSelectedQuestionsMap] = useState({});

  // Editing paper inline
  const [editingPaper, setEditingPaper] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editTitle, setEditTitle] = useState("");

  const fetchPapers = useCallback(async () => {
    setLoadingPapers(true);
    try {
      const params = new URLSearchParams({ status: "approved" });
      if (filters.class_level) params.append("class_level", filters.class_level);
      if (filters.subject) params.append("subject", filters.subject);
      if (filters.paper_type) params.append("paper_type", filters.paper_type);
      if (filters.year) params.append("year", filters.year);

      const res = await authFetch(`${API_URL}/api/question-papers?${params}`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        let list = data.papers || [];
        // client-side search filter
        if (filters.search.trim()) {
          const q = filters.search.toLowerCase();
          list = list.filter(
            (p) =>
              p.title?.toLowerCase().includes(q) ||
              p.subject?.toLowerCase().includes(q)
          );
        }
        setPapers(list);
        setPapersTotal(data.total || list.length);
      }
    } catch (_) {}
    setLoadingPapers(false);
  }, [filters, getAuthHeader]);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  const openPaper = async (paper) => {
    setSelectedPaper(paper);
    setLoadingQuestions(true);
    setView("questions");
    try {
      const res = await authFetch(`${API_URL}/api/question-papers/${paper.id}`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        setPaperQuestions(data.questions || []);
      }
    } catch (_) {}
    setLoadingQuestions(false);
  };

  const toggleQuestion = (q) => {
    // Give the question a stable composite id based on its text + type (paper questions may lack IDs)
    const qId = q.id || q._id || `${selectedPaper?.id}_${q.text?.slice(0, 30)}`;
    const enriched = { ...q, id: qId };

    if (selectedIds.includes(qId)) {
      setSelectedIds((prev) => prev.filter((id) => id !== qId));
      setSelectedQuestionsMap((prev) => {
        const next = { ...prev };
        delete next[qId];
        return next;
      });
    } else {
      setSelectedIds((prev) => [...prev, qId]);
      setSelectedQuestionsMap((prev) => ({ ...prev, [qId]: enriched }));
    }
  };

  const toggleAllInPaper = () => {
    const allIds = paperQuestions.map(
      (q) => q.id || q._id || `${selectedPaper?.id}_${q.text?.slice(0, 30)}`
    );
    const allSelected = allIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allIds.includes(id)));
      setSelectedQuestionsMap((prev) => {
        const next = { ...prev };
        allIds.forEach((id) => delete next[id]);
        return next;
      });
    } else {
      const newMap = {};
      paperQuestions.forEach((q) => {
        const qId = q.id || q._id || `${selectedPaper?.id}_${q.text?.slice(0, 30)}`;
        newMap[qId] = { ...q, id: qId };
      });
      setSelectedIds((prev) => [...new Set([...prev, ...allIds])]);
      setSelectedQuestionsMap((prev) => ({ ...prev, ...newMap }));
    }
  };

  const handleConfirm = () => {
    const questionsToAdd = Object.values(selectedQuestionsMap).map((q) => ({
      text: q.text || "",
      type: normalizeType(q.type),
      marks: q.marks || 1,
      options: q.options || [],
      correct_answer: q.correct_answer ?? "",
      section: q.section || "",
      is_bank_question: false,
      from_paper: true,
    }));
    onSelect(questionsToAdd);
    onClose();
  };

  const normalizeType = (t) => {
    if (!t) return "short_answer";
    const map = {
      mcq: "mcq",
      fillup: "fillup",
      fill_in_blank: "fillup",
      "fill-up": "fillup",
      true_false: "true_false",
      short_answer: "short_answer",
      long_answer: "long_answer",
      subjective: "long_answer",
    };
    return map[t.toLowerCase()] || "short_answer";
  };

  const handleEditTitle = async (paperId) => {
    if (!editTitle.trim()) return;
    setEditLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/question-papers/${paperId}`, {
        method: "PUT",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim() }),
      });
      if (res.ok) {
        setPapers((prev) =>
          prev.map((p) =>
            p.id === paperId ? { ...p, title: editTitle.trim() } : p
          )
        );
        if (selectedPaper?.id === paperId) {
          setSelectedPaper((prev) => ({ ...prev, title: editTitle.trim() }));
        }
        setEditingPaper(null);
      }
    } catch (_) {}
    setEditLoading(false);
  };

  const paperIdsInView = paperQuestions.map(
    (q) => q.id || q._id || `${selectedPaper?.id}_${q.text?.slice(0, 30)}`
  );
  const allPaperSelected =
    paperIdsInView.length > 0 &&
    paperIdsInView.every((id) => selectedIds.includes(id));
  const somePaperSelected = paperIdsInView.some((id) => selectedIds.includes(id));

  const currentYearOptions = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col border border-gray-200 dark:border-zinc-700">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            {view === "questions" && (
              <button
                onClick={() => { setView("papers"); setSelectedPaper(null); setPaperQuestions([]); }}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {view === "papers" ? "Select from Question Papers" : selectedPaper?.title}
              </h2>
              {view === "questions" && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Class {selectedPaper?.class_level} · {selectedPaper?.subject} · {selectedPaper?.year}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PAPERS VIEW */}
        {view === "papers" && (
          <>
            {/* Filters */}
            <div className="px-6 py-3 border-b border-gray-100 dark:border-zinc-800 flex flex-wrap gap-2 flex-shrink-0">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
                <input
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                  placeholder="Search papers..."
                  className="w-full pl-8 pr-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                />
              </div>
              {defaultClass ? (
                <div className="px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-zinc-800">
                  Class {defaultClass}
                </div>
              ) : (
                <select
                  value={filters.class_level}
                  onChange={(e) => setFilters((f) => ({ ...f, class_level: e.target.value }))}
                  className="px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                >
                  <option value="">All Classes</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((c) => (
                    <option key={c} value={c}>Class {c}</option>
                  ))}
                </select>
              )}
              {defaultSubject ? (
                <div className="px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-zinc-800">
                  {defaultSubject}
                </div>
              ) : (
                <input
                  value={filters.subject}
                  onChange={(e) => setFilters((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="Subject..."
                  className="px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white w-32"
                />
              )}
              <select
                value={filters.paper_type}
                onChange={(e) => setFilters((f) => ({ ...f, paper_type: e.target.value }))}
                className="px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
              >
                <option value="">All Types</option>
                {Object.entries(PAPER_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <select
                value={filters.year}
                onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}
                className="px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
              >
                <option value="">All Years</option>
                {currentYearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Paper List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loadingPapers ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : papers.length === 0 ? (
                <div className="text-center py-16">
                  <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No approved question papers found</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try adjusting filters or add papers from the Question Papers page</p>
                </div>
              ) : (
                papers.map((paper) => {
                  const paperQCount = paperIdsInView.length;
                  const selectedFromThis = selectedIds.filter((id) =>
                    id.startsWith(`${paper.id}_`) || (selectedQuestionsMap[id]?.paper_id === paper.id)
                  ).length;

                  return (
                    <div
                      key={paper.id}
                      className="border border-gray-200 dark:border-zinc-700 rounded-xl hover:border-gray-300 dark:hover:border-zinc-600 transition-colors"
                    >
                      {editingPaper === paper.id ? (
                        <div className="p-4 flex items-center gap-3">
                          <input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleEditTitle(paper.id);
                              if (e.key === "Escape") setEditingPaper(null);
                            }}
                          />
                          <button
                            onClick={() => handleEditTitle(paper.id)}
                            disabled={editLoading}
                            className="px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium"
                          >
                            {editLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                          </button>
                          <button
                            onClick={() => setEditingPaper(null)}
                            className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="p-4 flex items-center gap-4">
                          <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{paper.title}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <GraduationCap className="w-3 h-3" /> Class {paper.class_level}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <BookOpen className="w-3 h-3" /> {paper.subject}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> {paper.year}
                              </span>
                              <span className="text-xs text-gray-400">{paper.question_count} questions</span>
                              {selectedFromThis > 0 && (
                                <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                  {selectedFromThis} selected
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400">
                              {PAPER_TYPE_LABELS[paper.paper_type] || paper.paper_type}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingPaper(paper.id); setEditTitle(paper.title); }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                              title="Rename paper"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openPaper(paper)}
                              className="px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-xs font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                            >
                              View & Select
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* QUESTIONS VIEW */}
        {view === "questions" && (
          <>
            <div className="px-6 py-3 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={toggleAllInPaper}
                    className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                      allPaperSelected
                        ? "bg-blue-600 border-blue-600"
                        : somePaperSelected
                        ? "bg-blue-300 border-blue-400"
                        : "border-gray-400 dark:border-zinc-500"
                    }`}
                  >
                    {(allPaperSelected || somePaperSelected) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {allPaperSelected ? "Deselect all" : "Select all"} ({paperQuestions.length} questions)
                  </span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingPaper(selectedPaper.id);
                    setEditTitle(selectedPaper.title);
                    setView("papers");
                  }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  title="Edit paper title"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loadingQuestions ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : paperQuestions.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No questions in this paper</p>
                </div>
              ) : (
                paperQuestions.map((q, idx) => {
                  const qId = q.id || q._id || `${selectedPaper?.id}_${q.text?.slice(0, 30)}`;
                  const isSelected = selectedIds.includes(qId);
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleQuestion(q)}
                      className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
                          : "bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/50"
                      }`}
                    >
                      <div className="flex gap-3">
                        <div
                          className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                            isSelected ? "bg-blue-600 border-blue-600" : "border-gray-400 dark:border-zinc-500"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-xs font-mono text-gray-400">Q{q.order || idx + 1}</span>
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${TYPE_COLORS[q.type] || "bg-gray-100 text-gray-600"}`}>
                              {QUESTION_TYPES[q.type] || q.type}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 font-medium">
                              {q.marks}M
                            </span>
                            {q.section && (
                              <span className="text-xs text-gray-400">{q.section}</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-800 dark:text-gray-200">{q.text}</p>
                          {q.type === "mcq" && q.options?.length > 0 && (
                            <div className="mt-2 grid grid-cols-2 gap-1">
                              {q.options.map((opt, oi) => (
                                <span
                                  key={oi}
                                  className={`text-xs px-2 py-1 rounded ${
                                    q.correct_answer === opt
                                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 font-medium"
                                      : "bg-gray-50 dark:bg-zinc-700 text-gray-600 dark:text-gray-300"
                                  }`}
                                >
                                  {String.fromCharCode(65 + oi)}. {opt}
                                </span>
                              ))}
                            </div>
                          )}
                          {q.type === "true_false" && q.correct_answer && (
                            <p className="text-xs mt-1 text-gray-500">
                              Answer:{" "}
                              <span className={q.correct_answer?.toLowerCase() === "true" ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                                {q.correct_answer}
                              </span>
                            </p>
                          )}
                          {q.type !== "mcq" && q.type !== "true_false" && q.correct_answer && (
                            <p className="text-xs mt-1 text-gray-500">Answer: {q.correct_answer}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between flex-shrink-0 bg-white dark:bg-zinc-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <span className="font-medium text-gray-900 dark:text-white">{selectedIds.length}</span> question{selectedIds.length !== 1 ? "s" : ""} selected
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedIds.length === 0}
              className="flex items-center gap-2 px-5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add {selectedIds.length > 0 ? `${selectedIds.length} ` : ""}Questions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionPaperSelector;
