import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import useUserStore from "../stores/userStore";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Send,
  Mic,
  MicOff,
  CheckCircle,
  AlertCircle,
  Loader2,
  BookOpen,
  Target,
  AlertTriangle,
  Shield
} from "lucide-react";
import { Button } from "../components/ui/button";
import { testService } from "../services/api";

/**
 * TestSession Page
 * 
 * Handles the actual test-taking experience:
 * - Display questions one at a time
 * - Voice/text input for answers
 * - Submit answers
 * - Complete test and get evaluation
 */

export default function TestSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUserStore();

  // Get session data from navigation state
  const { session: initialSession, testConfig } = location.state || {};

  const [session, setSession] = useState(initialSession);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialSession);
  const [error, setError] = useState(null);
  const [testCompleted, setTestCompleted] = useState(false); // Track if test is completed
  const [showExitWarning, setShowExitWarning] = useState(false); // Show modal when trying to navigate

  // Voice recognition
  const [recognition, setRecognition] = useState(null);

  // Anti-cheating tracking
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [typingWarnings, setTypingWarnings] = useState([]);
  const [showCheatingWarning, setShowCheatingWarning] = useState(false);
  const [testBlocked, setTestBlocked] = useState(false); // Block test on cheating

  useEffect(() => {
    const initSession = async () => {
      if (session) return;

      if (!testConfig) {
        navigate("/test-center");
        return;
      }

      try {
        setIsLoading(true);

        let newSession;

        // Check if using new fixed-format chapter test
        if (testConfig.use_chapter_test) {
          newSession = await testService.startChapterTest({
            studentId: user?.id || user?.sub || "guest",
            classLevel: testConfig.class_level || user?.classLevel || 11,
            subject: testConfig.subject,
            chapterNumber: testConfig.chapter_number
          });
        } else {
          // Legacy test start
          newSession = await testService.startTestV2({
            ...testConfig,
            studentId: user?.id || user?.sub || "guest",
            auto_generate: true
          });
        }

        setSession(newSession);
        // Set timer from response (40 min for chapter test = 2400 seconds)
        setTimeRemaining(newSession.time_limit_minutes * 60);
      } catch (err) {
        console.error("Failed to start test:", err);
        setError("Failed to start test session. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, [initialSession, testConfig, navigate]);

  useEffect(() => {
    if (!session) return;

    // Set initial time if not set
    if (timeRemaining === 0 && session.time_limit_minutes) {
      setTimeRemaining(session.time_limit_minutes * 60);
    }

    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-IN';

      rec.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setCurrentAnswer(prev => prev + ' ' + transcript);
      };

      rec.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      setRecognition(rec);
    }
  }, [session]);

  // Timer
  useEffect(() => {
    if (timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Auto-submit when time runs out
          handleCompleteTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  // Block navigation during test
  useEffect(() => {
    if (testCompleted || !session) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'You have an ongoing test. Are you sure you want to leave? Your progress will be lost.';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [testCompleted, session]);

  // Intercept DashboardLayout navigation clicks
  useEffect(() => {
    if (testCompleted || !session) return;

    const handleClick = (e) => {
      // Check if clicking on navigation elements
      const target = e.target.closest('a, button[class*="nav"], button[class*="sidebar"]');
      if (target && !target.closest('.test-session-content')) {
        const href = target.getAttribute('href');
        const isNavigation = href || target.getAttribute('onClick') || target.textContent.includes('Dashboard') || target.textContent.includes('Book') || target.textContent.includes('Test');

        if (isNavigation) {
          e.preventDefault();
          e.stopPropagation();
          setShowExitWarning(true);
        }
      }
    };

    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [testCompleted, session]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQuestion = session?.questions?.[currentQuestionIndex];

  const toggleRecording = () => {
    if (!recognition) return;

    if (isRecording) {
      recognition.stop();
    } else {
      recognition.start();
      setIsRecording(true);
    }
  };

  const handleSaveAnswer = async () => {
    if (!currentAnswer.trim() || !currentQuestion) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await testService.submitAnswer(
        session.session_id,
        currentQuestion.question_id,
        currentQuestion.question_number,
        currentAnswer.trim()
      );

      // Save locally
      setAnswers(prev => ({
        ...prev,
        [currentQuestion.question_id]: currentAnswer.trim()
      }));

      // Move to next question if not last
      if (currentQuestionIndex < session.questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setCurrentAnswer(answers[session.questions[currentQuestionIndex + 1]?.question_id] || "");
      }
    } catch (err) {
      console.error("Failed to save answer:", err);
      setError("Failed to save answer. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNavigate = (direction) => {
    // Save current answer before navigating
    if (currentAnswer.trim() && currentQuestion) {
      setAnswers(prev => ({
        ...prev,
        [currentQuestion.question_id]: currentAnswer.trim()
      }));
    }

    const newIndex = direction === 'next'
      ? Math.min(currentQuestionIndex + 1, session.questions.length - 1)
      : Math.max(currentQuestionIndex - 1, 0);

    setCurrentQuestionIndex(newIndex);
    setCurrentAnswer(answers[session.questions[newIndex]?.question_id] || "");
    // Reset timer for new question
    setQuestionStartTime(Date.now());
  };

  const handleCompleteTest = async () => {
    if (testBlocked) {
      alert("Test blocked due to suspected cheating. Please contact your teacher.");
      return;
    }
    // Save current answer first
    if (currentAnswer.trim() && currentQuestion) {
      try {
        await testService.submitAnswer(
          session.session_id,
          currentQuestion.question_id,
          currentQuestion.question_number,
          currentAnswer.trim()
        );
      } catch (err) {
        console.error("Failed to save final answer:", err);
      }
    }

    setIsCompleting(true);
    setError(null);

    try {
      // Include suspicious activity flag if cheating was detected
      const completionData = {
        student_id: user.id,
        suspicious_activity: typingWarnings.length > 0,
        cheating_incidents: typingWarnings.length,
        warnings: typingWarnings
      };

      const result = await testService.completeTest(session.session_id, user.id, completionData);

      // Mark test as completed to allow navigation
      setTestCompleted(true);

      // Navigate to results page
      navigate("/test-result", {
        state: {
          result: {
            ...result,
            suspicious_activity: typingWarnings.length > 0,
            cheating_report: typingWarnings.length > 0 ? {
              total_warnings: typingWarnings.length,
              incidents: typingWarnings
            } : null
          },
          topicConfig: testConfig
        }
      });
    } catch (err) {
      console.error("Failed to complete test:", err);
      setError("Failed to complete test. Please try again.");
      setIsCompleting(false);
    }
  };

  const answeredCount = Object.keys(answers).length + (currentAnswer.trim() ? 1 : 0);

  if (!session) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Target className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-800">{session.topic_name}</h2>
                <p className="text-sm text-gray-500">
                  {testConfig?.subject} • Chapter {testConfig?.chapter_number}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Timer */}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${timeRemaining < 60 ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-700"
                }`}>
                <Clock className="w-4 h-4" />
                <span className="font-mono font-semibold">{formatTime(timeRemaining)}</span>
              </div>

              {/* Progress */}
              <div className="text-sm text-gray-500">
                <span className="font-semibold text-gray-800">{answeredCount}</span>
                /{session.questions.length} answered
              </div>
            </div>
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Question Header */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-orange-600">
                Question {currentQuestionIndex + 1} of {session.questions.length}
              </span>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${currentQuestion?.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                  currentQuestion?.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                  {currentQuestion?.difficulty}
                </span>
                <span className="text-sm text-gray-500">
                  {currentQuestion?.marks} marks
                </span>
              </div>
            </div>
          </div>

          {/* Question Text */}
          <div className="p-6">
            <p className="text-lg text-gray-800 leading-relaxed">
              {currentQuestion?.question_text}
            </p>
          </div>

          {/* Answer Input */}
          <div className="p-6 pt-0">
            <div className="space-y-4">
              <label className="text-sm font-medium text-gray-700">Your Answer:</label>
              <div className="relative">
                <textarea
                  value={currentAnswer}
                  onChange={(e) => {
                    // Allow voice input without restrictions
                    if (isRecording) {
                      setCurrentAnswer(e.target.value);
                      return;
                    }

                    const newValue = e.target.value;
                    const oldLength = currentAnswer.length;
                    const newLength = newValue.length;
                    const lengthDiff = newLength - oldLength;

                    // Detect suspiciously fast typing
                    if (lengthDiff > 0) {
                      const timeSinceStart = (Date.now() - questionStartTime) / 1000; // seconds
                      const typingSpeed = newLength / timeSinceStart; // characters per second

                      // Flag if typing more than 10 chars/sec sustained (20+ lines in 10 sec = ~200 chars)
                      // Or sudden burst of 50+ characters
                      if ((typingSpeed > 10 && newLength > 100) || lengthDiff > 50) {
                        const warning = {
                          questionNumber: currentQuestionIndex + 1,
                          timestamp: new Date().toISOString(),
                          reason: lengthDiff > 50
                            ? `Sudden paste detected: ${lengthDiff} characters added instantly`
                            : `Suspiciously fast typing: ${Math.round(typingSpeed)} chars/sec`,
                          student: user?.name || user?.sub || 'Unknown',
                          testId: session.session_id
                        };

                        setTypingWarnings(prev => [...prev, warning]);
                        setShowCheatingWarning(true);
                        setTestBlocked(true); // Block further test progress

                        // Log to console for staff monitoring
                        console.warn('⚠️ POTENTIAL CHEATING DETECTED:', warning);
                        console.warn('🚫 TEST BLOCKED - Student cannot continue');

                        // TODO: Send to backend API to notify staff
                        // await staffNotificationService.reportSuspiciousActivity(warning);
                      }
                    }

                    setCurrentAnswer(newValue);
                  }}
                  onPaste={(e) => {
                    // Block paste unless using voice input
                    if (!isRecording) {
                      e.preventDefault();

                      const warning = {
                        questionNumber: currentQuestionIndex + 1,
                        timestamp: new Date().toISOString(),
                        reason: 'Attempted to paste content',
                        student: user?.name || user?.sub || 'Unknown',
                        testId: session.session_id
                      };

                      setTypingWarnings(prev => [...prev, warning]);
                      setShowCheatingWarning(true);
                      setTestBlocked(true); // Block test immediately

                      console.warn('🚫 PASTE BLOCKED:', warning);
                      console.warn('🚫 TEST BLOCKED - Student cannot continue');

                      // TODO: Send to backend
                      // await staffNotificationService.reportSuspiciousActivity(warning);
                    }
                  }}
                  onCopy={(e) => {
                    // Block copy
                    e.preventDefault();
                  }}
                  onCut={(e) => {
                    // Block cut
                    e.preventDefault();
                  }}
                  disabled={testBlocked} // Disable input if test is blocked
                  placeholder={testBlocked ? "Test blocked due to suspicious activity" : "Type your answer here or use voice input..."}
                  className={`w-full h-40 p-4 border rounded-xl resize-none focus:outline-none focus:ring-2 ${testBlocked ? 'bg-red-50 border-red-300 cursor-not-allowed' : 'border-gray-200 focus:ring-blue-500 focus:border-transparent'}`}
                />

                {/* Voice Input Button */}
                {recognition && (
                  <button
                    onClick={toggleRecording}
                    className={`absolute bottom-4 right-4 p-3 rounded-full transition-all ${isRecording
                      ? "bg-red-500 text-white animate-pulse"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    title={isRecording ? "Stop recording" : "Start voice input"}
                  >
                    {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                )}
              </div>

              {isRecording && (
                <p className="text-sm text-red-600 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  Recording... Speak now
                </p>
              )}
            </div>
          </div>

          {/* Cheating Warning - Red Card */}
          {showCheatingWarning && (
            <div className="px-6 pb-4">
              <div className="bg-red-50 border-2 border-red-500 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-500 rounded-lg">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      <h4 className="font-bold text-red-900">🚨 Suspicious Activity Detected</h4>
                    </div>
                    <p className="text-sm text-red-800 mb-2">
                      Our system has detected unusual typing patterns. <strong>Your test has been blocked.</strong> You cannot continue.
                    </p>
                    <div className="bg-red-100 rounded px-3 py-2 text-xs text-red-700 mb-2">
                      <strong>Last Warning:</strong> {typingWarnings[typingWarnings.length - 1]?.reason}
                    </div>
                    <p className="text-xs text-red-600 mt-2">
                      Total warnings: {typingWarnings.length}
                    </p>
                    <p className="text-xs text-red-900 font-semibold mt-2 bg-red-200 p-2 rounded">
                      ⚠️ This incident will be reported to staff. You can only submit the test as-is.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCheatingWarning(false)}
                    className="text-red-400 hover:text-red-600"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="px-6 pb-4">
              <div className="flex items-center gap-2text-red-600 bg-red-50 px-4 py-2 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => handleNavigate('prev')}
              disabled={currentQuestionIndex === 0}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleSaveAnswer}
                disabled={!currentAnswer.trim() || isSubmitting || testBlocked}
                className="bg-orange-600 hover:bg-orange-700 text-white gap-2 disabled:opacity-50"
                title={testBlocked ? "Test blocked due to cheating" : ""}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Save Answer
              </Button>

              {currentQuestionIndex === session.questions.length - 1 ? (
                <Button
                  onClick={handleCompleteTest}
                  disabled={isCompleting}
                  className="bg-green-600 hover:bg-green-700 text-white gap-2"
                >
                  {isCompleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Complete Test
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => handleNavigate('next')}
                  disabled={testBlocked}
                  className="gap-2"
                  title={testBlocked ? "Test blocked due to cheating" : ""}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Question Navigator */}
        <div className="mt-6 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Questions Overview</h4>
          <div className="flex flex-wrap gap-2">
            {session.questions.map((q, index) => {
              const isAnswered = !!answers[q.question_id] || (index === currentQuestionIndex && currentAnswer.trim());
              const isCurrent = index === currentQuestionIndex;

              return (
                <button
                  key={q.question_id}
                  onClick={() => {
                    if (currentAnswer.trim() && currentQuestion) {
                      setAnswers(prev => ({
                        ...prev,
                        [currentQuestion.question_id]: currentAnswer.trim()
                      }));
                    }
                    setCurrentQuestionIndex(index);
                    setCurrentAnswer(answers[q.question_id] || "");
                  }}
                  className={`w-10 h-10 rounded-lg font-medium transition-all ${isCurrent
                    ? "bg-orange-600 text-white"
                    : isAnswered
                      ? "bg-green-100 text-green-700 border border-green-200"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Exit Warning Modal */}
      {showExitWarning && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Leave Test?</h3>
              <p className="text-gray-600">
                You have an ongoing test. If you leave now, <strong>all your progress will be lost</strong> and you won't be able to resume.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowExitWarning(false);
                }}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition"
              >
                Stay in Test
              </button>
              <button
                onClick={() => {
                  setTestCompleted(true);
                  setShowExitWarning(false);
                  navigate('/test-center');
                }}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition"
              >
                Leave Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
