import { useState, useEffect } from "react";
import {
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Brain,
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Star,
  Lightbulb,
  CheckCircle,
  Loader2,
  Zap,
  Award,
  Flame
} from "lucide-react";
import { Button } from "../ui/button";
import { testService } from "../../services/api";

/**
 * TopicSelector Component
 * 
 * Implements topic-based test selection:
 * Subject → Chapter → Difficulty → Start Test
 */
export default function TopicSelector({
  studentId,
  classLevel = 10,
  onSelectTopic,
  onCancel
}) {
  const [step, setStep] = useState(1); // 1=Subject, 2=Chapter, 3=Difficulty
  const [loading, setLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Selection state
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState(null);

  // Fixed test format - no user config needed
  // 15 questions (5 MCQ + 5 Fill-up + 5 Two-mark) = 20 marks, 40 minutes

  // Load subjects on mount
  useEffect(() => {
    fetchSubjects();
  }, [classLevel]);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      console.log("Fetching subjects for class:", classLevel);
      const data = await testService.getAvailableSubjects(classLevel);
      console.log("Subjects API response:", data);

      if (Array.isArray(data) && data.length > 0) {
        setSubjects(data);
      } else {
        // No subjects available - show empty state (no fallback)
        console.log("No subjects found for class", classLevel);
        setSubjects([]);
      }
    } catch (error) {
      console.error("Failed to fetch subjects:", error);
      // On error, show empty - no fallback
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSubject = async (subject) => {
    setSelectedSubject(subject);
    setLoading(true);
    try {
      console.log("Fetching chapters for:", { classLevel, subject: subject.subject });
      const [chapterData, recsData] = await Promise.all([
        testService.getChaptersForSubject(classLevel, subject.subject, studentId),
        testService.getRecommendations(classLevel, subject.subject, studentId)
      ]);

      console.log("Chapters received:", chapterData);
      console.log("Recommendations received:", recsData);

      setChapters(Array.isArray(chapterData) ? chapterData : []);
      setRecommendations(Array.isArray(recsData) ? recsData : []);
      setStep(2);
    } catch (error) {
      console.error("Failed to fetch chapters:", error);
      setChapters([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChapter = (chapter) => {
    setSelectedChapter(chapter);
    // Go to difficulty selection step
    setStep(3);
  };

  const handleSelectDifficulty = (difficulty) => {
    setSelectedDifficulty(difficulty);
  };

  const handleStartTest = () => {
    if (!selectedDifficulty) return;
    
    // Fixed format: 15Q (5 MCQ + 5 Fill-up + 5 Two-mark) = 20 marks, 40 min
    onSelectTopic({
      subject: selectedSubject.subject,
      chapter_number: selectedChapter.chapter_number,
      chapter_name: selectedChapter.chapter_name,
      difficulty: selectedDifficulty,
      num_questions: 15,
      total_marks: 20,
      time_limit_minutes: 40,
      test_type: 'ai_with_analytics'  // Use AI test endpoint with difficulty support
    });
  };

  const handleRecommendationClick = (rec) => {
    // For recommendations, also use fixed format
    setSelectedSubject({ subject: rec.subject || selectedSubject?.subject });
    setSelectedChapter({
      chapter_number: rec.chapter,
      chapter_name: rec.chapter_name
    });
    setStep(3);
  };

  const goBack = () => {
    if (step === 3) {
      setStep(2);
      setSelectedDifficulty(null);
    } else if (step === 2) {
      setStep(1);
      setSelectedChapter(null);
      setChapters([]);
    }
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case "improving": return <TrendingUp className="w-4 h-4 text-green-500" />;
      case "declining": return <TrendingDown className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  const getScoreColor = (score) => {
    if (score === null || score === undefined) return "text-gray-400";
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {step > 1 && (
                <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-lg">
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <h2 className="text-xl font-bold text-gray-800">
                {step === 1 && "Select Subject"}
                {step === 2 && "Select Chapter"}
                {step === 3 && "Select Difficulty"}
              </h2>
            </div>
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>

          {/* Progress Steps - 3 steps */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${s < step ? "bg-green-500 text-white" :
                  s === step ? "bg-orange-600 text-white" :
                    "bg-gray-200 text-gray-500"
                  }`}>
                  {s < step ? <CheckCircle className="w-4 h-4" /> : s}
                </div>
                {s < 3 && <div className={`w-12 h-1 rounded ${s < step ? "bg-green-500" : "bg-gray-200"}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
            </div>
          ) : (
            <>
              {/* Step 1: Subject Selection */}
              {step === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {subjects.length === 0 ? (
                    <div className="col-span-2 text-center py-12">
                      <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-600 mb-2">No Subjects Available</h3>
                      <p className="text-sm text-gray-400">
                        No content has been added for Class {classLevel} yet.
                        <br />Please check back later or contact your teacher.
                      </p>
                    </div>
                  ) : (
                    subjects.map((subject) => (
                      <button
                        key={subject.subject}
                        onClick={() => handleSelectSubject(subject)}
                        className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-100 hover:border-blue-300 transition-all text-left group"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <BookOpen className="w-8 h-8 text-orange-600 mb-3" />
                            <h3 className="font-semibold text-gray-800 text-lg">{subject.subject}</h3>
                            <p className="text-sm text-gray-500 mt-1">
                              {subject.total_chapters} Chapters • {subject.total_questions} Questions
                            </p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-orange-600" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Step 2: Chapter Selection */}
              {step === 2 && (
                <div className="space-y-6">
                  {/* Recommendations */}
                  {recommendations.length > 0 && (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
                      <div className="flex items-center gap-2 mb-3">
                        <Lightbulb className="w-5 h-5 text-amber-600" />
                        <h4 className="font-semibold text-gray-800">Recommended for You</h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {recommendations.slice(0, 3).map((rec) => (
                          <button
                            key={rec.topic_id}
                            onClick={() => handleRecommendationClick(rec)}
                            className="px-3 py-2 bg-white rounded-lg border border-amber-200 text-sm hover:bg-amber-50 transition-colors"
                          >
                            <span className="font-medium">{rec.topic_name}</span>
                            {rec.score !== null && (
                              <span className={`ml-2 ${getScoreColor(rec.score)}`}>
                                ({rec.score}%)
                              </span>
                            )}
                            {rec.is_new && (
                              <span className="ml-2 text-green-600 text-xs">NEW</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Chapter List */}
                  <div className="space-y-2">
                    {chapters.map((chapter) => (
                      <button
                        key={chapter.chapter_number}
                        onClick={() => handleSelectChapter(chapter)}
                        className="w-full p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-all text-left group flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 font-semibold">
                            {chapter.chapter_number}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-800">{chapter.chapter_name}</h4>
                            {chapter.average_score && (
                              <p className="text-sm text-green-600 font-medium">
                                Avg Score: {chapter.average_score}%
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-orange-600" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Difficulty Selection */}
              {step === 3 && selectedChapter && (
                <div className="space-y-6">
                  {/* Chapter Info */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 font-bold text-lg">
                        {selectedChapter.chapter_number}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">{selectedChapter.chapter_name}</h4>
                        <p className="text-sm text-gray-500">{selectedSubject?.subject}</p>
                      </div>
                    </div>
                  </div>

                  {/* Difficulty Options */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-700 mb-4">Choose your difficulty level:</h4>
                    
                    {/* Easy */}
                    <button
                      onClick={() => handleSelectDifficulty("easy")}
                      className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                        selectedDifficulty === "easy"
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200 bg-white hover:border-green-300"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          selectedDifficulty === "easy" ? "bg-green-500" : "bg-green-100"
                        }`}>
                          <Zap className={`w-6 h-6 ${selectedDifficulty === "easy" ? "text-white" : "text-green-600"}`} />
                        </div>
                        <div className="flex-1">
                          <h5 className="font-semibold text-gray-800 text-lg">Easy</h5>
                          <p className="text-sm text-gray-500">Basic concepts, definitions & simple recall questions</p>
                        </div>
                        {selectedDifficulty === "easy" && (
                          <CheckCircle className="w-6 h-6 text-green-500" />
                        )}
                      </div>
                    </button>

                    {/* Medium */}
                    <button
                      onClick={() => handleSelectDifficulty("medium")}
                      className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                        selectedDifficulty === "medium"
                          ? "border-orange-500 bg-orange-50"
                          : "border-gray-200 bg-white hover:border-orange-300"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          selectedDifficulty === "medium" ? "bg-orange-500" : "bg-orange-100"
                        }`}>
                          <Award className={`w-6 h-6 ${selectedDifficulty === "medium" ? "text-white" : "text-orange-600"}`} />
                        </div>
                        <div className="flex-1">
                          <h5 className="font-semibold text-gray-800 text-lg">Medium</h5>
                          <p className="text-sm text-gray-500">Application-based questions requiring understanding</p>
                        </div>
                        {selectedDifficulty === "medium" && (
                          <CheckCircle className="w-6 h-6 text-orange-500" />
                        )}
                      </div>
                    </button>

                    {/* Hard */}
                    <button
                      onClick={() => handleSelectDifficulty("hard")}
                      className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                        selectedDifficulty === "hard"
                          ? "border-red-500 bg-red-50"
                          : "border-gray-200 bg-white hover:border-red-300"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          selectedDifficulty === "hard" ? "bg-red-500" : "bg-red-100"
                        }`}>
                          <Flame className={`w-6 h-6 ${selectedDifficulty === "hard" ? "text-white" : "text-red-600"}`} />
                        </div>
                        <div className="flex-1">
                          <h5 className="font-semibold text-gray-800 text-lg">Hard</h5>
                          <p className="text-sm text-gray-500">Advanced analysis & higher-order thinking questions</p>
                        </div>
                        {selectedDifficulty === "hard" && (
                          <CheckCircle className="w-6 h-6 text-red-500" />
                        )}
                      </div>
                    </button>
                  </div>

                  {/* Test Info */}
                  <div className="bg-gray-50 rounded-xl p-4 mt-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-orange-600">15</p>
                        <p className="text-xs text-gray-500">Questions</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-orange-600">20</p>
                        <p className="text-xs text-gray-500">Marks</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-orange-600">40</p>
                        <p className="text-xs text-gray-500">Minutes</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-sm text-gray-600 text-center">
                        <span className="font-medium">5 MCQ</span> + <span className="font-medium">5 Fill-ups</span> + <span className="font-medium">5 Short Answer</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex justify-between">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          {step === 3 && selectedDifficulty && (
            <Button
              onClick={handleStartTest}
              className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
            >
              <Brain className="w-4 h-4" />
              Start Test
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
