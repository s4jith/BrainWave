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
  Loader2
} from "lucide-react";
import { Button } from "../ui/button";
import { testService } from "../../services/api";

/**
 * TopicSelector Component
 * 
 * Implements topic-based test selection:
 * Subject → Chapter → Topic (with recommendations)
 */
export default function TopicSelector({ 
  studentId, 
  classLevel = 10,
  onSelectTopic,
  onCancel 
}) {
  const [step, setStep] = useState(1); // 1=Subject, 2=Chapter, 3=Topic
  const [loading, setLoading] = useState(false);
  
  // Selection state
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [topics, setTopics] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  
  // Test config
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState("mixed");

  // Load subjects on mount
  useEffect(() => {
    fetchSubjects();
  }, [classLevel]);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const data = await testService.getAvailableSubjects(classLevel);
      if (Array.isArray(data) && data.length > 0) {
        setSubjects(data);
      } else {
        // Fallback subjects
        setSubjects([
          { subject: "Mathematics", total_chapters: 16, total_questions: 240 },
        ]);
      }
    } catch (error) {
      console.error("Failed to fetch subjects:", error);
      setSubjects([
        { subject: "Mathematics", total_chapters: 16, total_questions: 240 },
      ]);
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
        testService.getChaptersForSubject(classLevel, subject.subject),
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

  const handleSelectChapter = async (chapter) => {
    setSelectedChapter(chapter);
    setLoading(true);
    try {
      const topicData = await testService.getTopicsForChapter(
        classLevel, 
        selectedSubject.subject, 
        chapter.chapter_number,
        studentId
      );
      setTopics(Array.isArray(topicData) ? topicData : []);
      setStep(3);
    } catch (error) {
      console.error("Failed to fetch topics:", error);
      setTopics([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTopic = (topic) => {
    setSelectedTopic(topic);
  };

  const handleStartTest = () => {
    if (!selectedTopic) return;
    
    onSelectTopic({
      subject: selectedSubject.subject,
      chapter_number: selectedChapter.chapter_number,
      chapter_name: selectedChapter.chapter_name,
      topic_id: selectedTopic.topic_id,
      topic_name: selectedTopic.topic_name,
      num_questions: numQuestions,
      difficulty: difficulty
    });
  };

  const handleRecommendationClick = async (rec) => {
    // Find the chapter and topic
    setLoading(true);
    try {
      // Fetch topics for the recommended chapter
      const topicData = await testService.getTopicsForChapter(
        classLevel,
        selectedSubject?.subject || rec.subject || "Mathematics",
        rec.chapter,
        studentId
      );
      
      // Find the matching topic
      const topic = topicData.find(t => t.topic_id === rec.topic_id);
      if (topic) {
        setSelectedChapter({ chapter_number: rec.chapter, chapter_name: rec.chapter_name });
        setSelectedTopic(topic);
        setTopics(topicData);
        setStep(3);
      }
    } catch (error) {
      console.error("Failed to load recommendation:", error);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (step === 3) {
      setStep(2);
      setSelectedTopic(null);
    } else if (step === 2) {
      setStep(1);
      setSelectedChapter(null);
      setChapters([]);
    }
  };

  const getTrendIcon = (trend) => {
    switch(trend) {
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
                {step === 3 && "Select Topic"}
              </h2>
            </div>
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          
          {/* Progress Steps */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  s < step ? "bg-green-500 text-white" :
                  s === step ? "bg-purple-600 text-white" :
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
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : (
            <>
              {/* Step 1: Subject Selection */}
              {step === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {subjects.map((subject) => (
                    <button
                      key={subject.subject}
                      onClick={() => handleSelectSubject(subject)}
                      className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100 hover:border-purple-300 transition-all text-left group"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <BookOpen className="w-8 h-8 text-purple-600 mb-3" />
                          <h3 className="font-semibold text-gray-800 text-lg">{subject.subject}</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {subject.total_chapters} Chapters • {subject.total_questions} Questions
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600" />
                      </div>
                    </button>
                  ))}
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
                        className="w-full p-4 bg-white rounded-xl border border-gray-200 hover:border-purple-300 transition-all text-left group flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 font-semibold">
                            {chapter.chapter_number}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-800">{chapter.chapter_name}</h4>
                            <p className="text-sm text-gray-500">
                              {chapter.total_topics} Topics • {chapter.total_questions} Questions
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Topic Selection */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    {topics.map((topic) => (
                      <button
                        key={topic.topic_id}
                        onClick={() => handleSelectTopic(topic)}
                        className={`p-4 rounded-xl border transition-all text-left ${
                          selectedTopic?.topic_id === topic.topic_id
                            ? "border-purple-500 bg-purple-50"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Target className={`w-4 h-4 ${topic.is_recommended ? "text-amber-500" : "text-gray-400"}`} />
                              <h4 className="font-medium text-gray-800">{topic.topic_name}</h4>
                              {topic.is_recommended && (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                                  Recommended
                                </span>
                              )}
                              {topic.is_weak && (
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Needs Practice
                                </span>
                              )}
                            </div>
                            {topic.topic_description && (
                              <p className="text-sm text-gray-500">{topic.topic_description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                              <span>{topic.total_questions} Questions</span>
                              {topic.student_score !== null && (
                                <span className={`flex items-center gap-1 ${getScoreColor(topic.student_score)}`}>
                                  <Star className="w-4 h-4" />
                                  {topic.student_score}%
                                  {getTrendIcon(topic.trend)}
                                </span>
                              )}
                              {topic.tests_taken > 0 && (
                                <span>{topic.tests_taken} test(s) taken</span>
                              )}
                            </div>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            selectedTopic?.topic_id === topic.topic_id
                              ? "border-purple-500 bg-purple-500"
                              : "border-gray-300"
                          }`}>
                            {selectedTopic?.topic_id === topic.topic_id && (
                              <CheckCircle className="w-4 h-4 text-white" />
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Test Configuration */}
                  {selectedTopic && (
                    <div className="bg-gray-50 rounded-xl p-4 mt-4 space-y-4">
                      <h4 className="font-medium text-gray-800">Test Configuration</h4>
                      
                      <div className="flex items-center gap-4">
                        <label className="text-sm text-gray-600">Questions:</label>
                        <div className="flex gap-2">
                          {[3, 5, 10].map((n) => (
                            <button
                              key={n}
                              onClick={() => setNumQuestions(n)}
                              className={`px-3 py-1 rounded-lg text-sm ${
                                numQuestions === n
                                  ? "bg-purple-600 text-white"
                                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <label className="text-sm text-gray-600">Difficulty:</label>
                        <div className="flex gap-2">
                          {["easy", "medium", "hard", "mixed"].map((d) => (
                            <button
                              key={d}
                              onClick={() => setDifficulty(d)}
                              className={`px-3 py-1 rounded-lg text-sm capitalize ${
                                difficulty === d
                                  ? "bg-purple-600 text-white"
                                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
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
          {step === 3 && selectedTopic && (
            <Button 
              onClick={handleStartTest}
              className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
            >
              <Brain className="w-4 h-4" />
              Start Test ({numQuestions} questions)
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
