import { useState, useEffect } from "react";
import {
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Brain,
  Target,
  Lightbulb,
  CheckCircle,
  Loader2,
  Zap,
  Sparkles,
  Award,
  Flame,
  Clock,
  Plus,
  Minus
} from "lucide-react";
import { Button } from "../ui/button";
import { testService } from "../../services/api";

export default function TopicSelector({
  studentId,
  classLevel = 10,
  onSelectTopic,
  onCancel
}) {
  const [step, setStep] = useState(1); 
  const [loading, setLoading] = useState(false);

  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState(null);

  const [testConfig, setTestConfig] = useState({
    mcq: 5,
    fillup: 5,
    true_false: 0,
    short: 5,
    timer: false,
    timeLimit: 40
  });

  const totalQuestions = (testConfig.mcq || 0) + (testConfig.fillup || 0) + (testConfig.true_false || 0) + (testConfig.short || 0);
  const totalMarks = (testConfig.mcq || 0) * 1 + (testConfig.fillup || 0) * 1 + (testConfig.true_false || 0) * 1 + (testConfig.short || 0) * 2;

  useEffect(() => {
    fetchSubjects();
  }, [classLevel]);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const data = await testService.getQBSubjects(classLevel);

      if (Array.isArray(data) && data.length > 0) {
        setSubjects(data);
      } else {
        setSubjects([]);
      }
    } catch (error) {
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSubject = async (subject) => {
    setSelectedSubject(subject);
    setLoading(true);
    try {
      const chapterData = await testService.getQBChapters(classLevel, subject.subject);

      setChapters(Array.isArray(chapterData) ? chapterData : []);
      
      setRecommendations([]);
      setStep(2);
    } catch (error) {
      setChapters([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChapter = (chapter) => {
    setSelectedChapter(chapter);
    setStep(3);
  };

  const handleSelectDifficulty = (difficulty) => {
    setSelectedDifficulty(difficulty);

    if (selectedChapter) {
      const diffSuffix = difficulty ? `_${difficulty}` : '';
      const maxMcq = selectedChapter[`mcq${diffSuffix}`] || selectedChapter.mcq_count || 0;
      const maxFill = selectedChapter[`fillup${diffSuffix}`] || selectedChapter.fillup_count || 0;
      const maxTF = selectedChapter[`true_false${diffSuffix}`] || selectedChapter.true_false_count || 0;
      const maxShort = selectedChapter[`short_answer${diffSuffix}`] || selectedChapter.short_answer_count || 0;
      setTestConfig(prev => ({
        ...prev,
        mcq: Math.min(5, maxMcq),
        fillup: Math.min(5, maxFill),
        true_false: Math.min(5, maxTF),
        short: Math.min(5, maxShort)
      }));
    }

    setStep(4);
  };

  const handleStartTest = () => {
    if (!selectedDifficulty || totalQuestions === 0) return;

    onSelectTopic({
      subject: selectedSubject.subject,
      chapter_number: selectedChapter.chapter_number || selectedChapter.chapter,
      chapter_name: selectedChapter.chapter_name,
      difficulty: selectedDifficulty,

      mcq_count: testConfig.mcq,
      fillup_count: testConfig.fillup,
      true_false_count: testConfig.true_false,
      short_answer_count: testConfig.short,
      long_answer_count: 0,

      total_marks: totalMarks,
      time_limit_minutes: testConfig.timer ? testConfig.timeLimit : null,

      test_type: 'qb_test'
    });
  };

  const handleConfigChange = (type, value) => {
    
    let max = 0;
    if (selectedChapter) {
      const diffSuffix = selectedDifficulty ? `_${selectedDifficulty}` : '';
      if (type === 'mcq') max = selectedChapter[`mcq${diffSuffix}`] || selectedChapter.mcq_count || 0;
      if (type === 'fillup') max = selectedChapter[`fillup${diffSuffix}`] || selectedChapter.fillup_count || 0;
      if (type === 'true_false') max = selectedChapter[`true_false${diffSuffix}`] || selectedChapter.true_false_count || 0;
      if (type === 'short') max = selectedChapter[`short_answer${diffSuffix}`] || selectedChapter.short_answer_count || 0;
    }

    const newValue = Math.max(0, Math.min(value, max));

    setTestConfig(prev => ({
      ...prev,
      [type]: newValue
    }));
  };

  const handleRecommendationClick = (rec) => {
    
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
    } else if (step === 4) {
      setStep(3);
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

          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${s < step ? "bg-green-500 text-white" :
                  s === step ? "bg-orange-600 text-white" :
                    "bg-gray-200 text-gray-500"
                  }`}>
                  {s < step ? <CheckCircle className="w-4 h-4" /> : s}
                </div>
                {s < 4 && <div className={`w-12 h-1 rounded ${s < step ? "bg-green-500" : "bg-gray-200"}`} />}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
            </div>
          ) : (
            <>
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

              {step === 2 && (
                <div className="space-y-6">
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

                  <div className="space-y-2">
                    {chapters.map((chapter) => (
                      <button
                        key={chapter.chapter || chapter.chapter_number}
                        onClick={() => handleSelectChapter(chapter)}
                        className="w-full p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-all text-left group flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 font-semibold">
                            {chapter.chapter || chapter.chapter_number}
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

              {step === 3 && selectedChapter && (
                <div className="space-y-6">
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

                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-700 mb-4">Choose your difficulty level:</h4>

                    <button
                      onClick={() => handleSelectDifficulty("easy")}
                      className={`w-full p-5 rounded-xl border-2 transition-all text-left ${selectedDifficulty === "easy"
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 bg-white hover:border-green-300"
                        }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedDifficulty === "easy" ? "bg-green-500" : "bg-green-100"
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

                    <button
                      onClick={() => handleSelectDifficulty("medium")}
                      className={`w-full p-5 rounded-xl border-2 transition-all text-left ${selectedDifficulty === "medium"
                        ? "border-orange-500 bg-orange-50"
                        : "border-gray-200 bg-white hover:border-orange-300"
                        }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedDifficulty === "medium" ? "bg-orange-500" : "bg-orange-100"
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

                    <button
                      onClick={() => handleSelectDifficulty("hard")}
                      className={`w-full p-5 rounded-xl border-2 transition-all text-left ${selectedDifficulty === "hard"
                        ? "border-red-500 bg-red-50"
                        : "border-gray-200 bg-white hover:border-red-300"
                        }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedDifficulty === "hard" ? "bg-red-500" : "bg-red-100"
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

                  <div className="bg-blue-50/50 rounded-xl p-4 mt-6 border border-blue-100">
                    <p className="text-sm text-blue-800 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Select a difficulty to proceed to question configuration
                    </p>
                  </div>
                </div>
              )}

              {step === 4 && selectedChapter && (
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between border border-gray-100">
                    <div>
                      <h3 className="font-semibold text-gray-800">{selectedChapter.chapter_name}</h3>
                      <p className="text-sm text-gray-500">
                        {selectedSubject?.subject} • <span className="capitalize">{selectedDifficulty}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Available ({selectedDifficulty})</span>
                      <div className="flex gap-3 mt-1 text-sm font-medium text-gray-600">
                        <span>MCQ: {selectedChapter[`mcq_${selectedDifficulty}`] || 0}</span>
                        <span>Fill: {selectedChapter[`fillup_${selectedDifficulty}`] || 0}</span>
                        <span>T/F: {selectedChapter[`true_false_${selectedDifficulty}`] || 0}</span>
                        <span>Short: {selectedChapter[`short_answer_${selectedDifficulty}`] || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-white border border-gray-200 rounded-xl">
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-blue-500" />
                          <div>
                            <h4 className="font-medium text-gray-700">MCQ</h4>
                            <p className="text-xs text-gray-400">1 mark each</p>
                          </div>
                        </div>
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-500">
                          Max: {selectedChapter[`mcq_${selectedDifficulty}`] || 0}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Button
                          variant="outline" size="sm"
                          onClick={() => handleConfigChange('mcq', (testConfig.mcq || 0) - 1)}
                          disabled={(testConfig.mcq || 0) <= 0}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="text-xl font-bold w-12 text-center">{testConfig.mcq || 0}</span>
                        <Button
                          variant="outline" size="sm"
                          onClick={() => handleConfigChange('mcq', (testConfig.mcq || 0) + 1)}
                          disabled={(testConfig.mcq || 0) >= (selectedChapter[`mcq_${selectedDifficulty}`] || 0)}
                          title={(testConfig.mcq || 0) >= (selectedChapter[`mcq_${selectedDifficulty}`] || 0) ? "Max available questions reached" : ""}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 bg-white border border-gray-200 rounded-xl">
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          <Target className="w-5 h-5 text-purple-500" />
                          <div>
                            <h4 className="font-medium text-gray-700">Fill-ups</h4>
                            <p className="text-xs text-gray-400">1 mark each</p>
                          </div>
                        </div>
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-500">
                          Max: {selectedChapter[`fillup_${selectedDifficulty}`] || 0}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Button
                          variant="outline" size="sm"
                          onClick={() => handleConfigChange('fillup', (testConfig.fillup || 0) - 1)}
                          disabled={(testConfig.fillup || 0) <= 0}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="text-xl font-bold w-12 text-center">{testConfig.fillup || 0}</span>
                        <Button
                          variant="outline" size="sm"
                          onClick={() => handleConfigChange('fillup', (testConfig.fillup || 0) + 1)}
                          disabled={(testConfig.fillup || 0) >= (selectedChapter[`fillup_${selectedDifficulty}`] || 0)}
                          title={(testConfig.fillup || 0) >= (selectedChapter[`fillup_${selectedDifficulty}`] || 0) ? "Max available questions reached" : ""}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 bg-white border border-gray-200 rounded-xl">
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-teal-500" />
                          <div>
                            <h4 className="font-medium text-gray-700">True / False</h4>
                            <p className="text-xs text-gray-400">1 mark each</p>
                          </div>
                        </div>
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-500">
                          Max: {selectedChapter[`true_false_${selectedDifficulty}`] || 0}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Button
                          variant="outline" size="sm"
                          onClick={() => handleConfigChange('true_false', (testConfig.true_false || 0) - 1)}
                          disabled={(testConfig.true_false || 0) <= 0}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="text-xl font-bold w-12 text-center">{testConfig.true_false || 0}</span>
                        <Button
                          variant="outline" size="sm"
                          onClick={() => handleConfigChange('true_false', (testConfig.true_false || 0) + 1)}
                          disabled={(testConfig.true_false || 0) >= (selectedChapter[`true_false_${selectedDifficulty}`] || 0)}
                          title={(testConfig.true_false || 0) >= (selectedChapter[`true_false_${selectedDifficulty}`] || 0) ? "Max available questions reached" : ""}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 bg-white border border-gray-200 rounded-xl">
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          <Zap className="w-5 h-5 text-amber-500" />
                          <div>
                            <h4 className="font-medium text-gray-700">Short Answer</h4>
                            <p className="text-xs text-gray-400">2 marks each</p>
                          </div>
                        </div>
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-500">
                          Max: {selectedChapter[`short_answer_${selectedDifficulty}`] || 0}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Button
                          variant="outline" size="sm"
                          onClick={() => handleConfigChange('short', (testConfig.short || 0) - 1)}
                          disabled={(testConfig.short || 0) <= 0}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="text-xl font-bold w-12 text-center">{testConfig.short || 0}</span>
                        <Button
                          variant="outline" size="sm"
                          onClick={() => handleConfigChange('short', (testConfig.short || 0) + 1)}
                          disabled={(testConfig.short || 0) >= (selectedChapter[`short_answer_${selectedDifficulty}`] || 0)}
                          title={(testConfig.short || 0) >= (selectedChapter[`short_answer_${selectedDifficulty}`] || 0) ? "Max available questions reached" : ""}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-gray-600" />
                        <span className="font-medium text-gray-700">Test Timer</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={testConfig.timer}
                          onChange={(e) => setTestConfig(prev => ({ ...prev, timer: e.target.checked }))}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                      </label>
                    </div>

                    {testConfig.timer && (
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="5" max="180" step="5"
                          value={testConfig.timeLimit}
                          onChange={(e) => setTestConfig(prev => ({ ...prev, timeLimit: parseInt(e.target.value) }))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                        />
                        <span className="font-bold text-gray-700 w-24 text-right">{testConfig.timeLimit} mins</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-4 bg-orange-50 rounded-xl border border-orange-100">
                    <div className="text-center">
                      <span className="block text-2xl font-bold text-gray-800">{totalQuestions}</span>
                      <span className="text-xs text-gray-500 uppercase">Questions</span>
                    </div>
                    <div className="h-8 w-px bg-orange-200 mx-4"></div>
                    <div className="text-center">
                      <span className="block text-2xl font-bold text-gray-800">{totalMarks}</span>
                      <span className="text-xs text-gray-500 uppercase">Total Marks</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-between">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          {step === 4 && (
            <Button
              onClick={handleStartTest}
              className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
              disabled={totalQuestions === 0}
            >
              <Brain className="w-4 h-4" />
              Start Test
            </Button>
          )}
        </div>
      </div>
    </div >
  );
}
