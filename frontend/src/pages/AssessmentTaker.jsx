
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft,
    ArrowRight,
    Clock,
    AlertCircle,
    CheckCircle,
    Send,
    Flag
} from "lucide-react";
import useAssessmentStore from "../stores/assessmentStore";

export default function AssessmentTaker() {
    const { assessmentId } = useParams();
    const navigate = useNavigate();
    const {
        currentAssessment,
        startAssessment,
        submitAnswers,
        timeRemaining,
        timerActive,
        tickTimer,
        loading,
        error
    } = useAssessmentStore();

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [flagged, setFlagged] = useState({});
    const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        startAssessment(assessmentId);
    }, [assessmentId]);

    useEffect(() => {
        if (!timerActive) return;

        const interval = setInterval(() => {
            tickTimer();
        }, 1000);

        return () => clearInterval(interval);
    }, [timerActive, tickTimer]);

    useEffect(() => {
        if (timerActive && timeRemaining === 0) {
            handleSubmit();
        }
    }, [timeRemaining, timerActive]);

    const questions = currentAssessment?.questions || [];
    const currentQuestion = questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    const answeredCount = Object.keys(answers).length;

    const formatTime = (seconds) => {
        if (seconds === null) return "--:--";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleAnswer = (questionId, answer) => {
        setAnswers(prev => ({ ...prev, [questionId]: answer }));
    };

    const handleFlagToggle = (questionId) => {
        setFlagged(prev => ({ ...prev, [questionId]: !prev[questionId] }));
    };

    const goToQuestion = (index) => {
        setCurrentQuestionIndex(index);
    };

    const handleNext = () => {
        if (!isLastQuestion) {
            setCurrentQuestionIndex(prev => prev + 1);
        }
    };

    const handlePrevious = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
        }
    };

    const handleSubmit = useCallback(async () => {
        setSubmitting(true);

        const formattedAnswers = Object.entries(answers).map(([questionId, answer]) => {
            const question = questions.find(q => q.id === questionId);

            if (question?.type === "mcq") {
                return {
                    question_id: questionId,
                    selected_option_ids: [answer]
                };
            } else if (question?.type === "mcq_multi") {
                return {
                    question_id: questionId,
                    selected_option_ids: answer
                };
            } else if (question?.type === "true_false") {
                return {
                    question_id: questionId,
                    answer_bool: answer
                };
            } else if (question?.type === "matching") {
                return {
                    question_id: questionId,
                    matching_answers: answer
                };
            } else {
                return {
                    question_id: questionId,
                    answer_text: answer
                };
            }
        });

        const result = await submitAnswers(assessmentId, formattedAnswers);
        setResult(result);
        setSubmitting(false);
        setShowConfirmSubmit(false);
    }, [answers, questions, assessmentId, submitAnswers]);

    if (result) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 text-center">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${result.passed ? "bg-emerald-500/20" : "bg-red-500/20"
                        }`}>
                        {result.passed ? (
                            <CheckCircle size={40} className="text-emerald-400" />
                        ) : (
                            <AlertCircle size={40} className="text-red-400" />
                        )}
                    </div>

                    <h1 className="text-2xl font-bold mb-2">
                        {result.passed ? "Congratulations!" : "Assessment Complete"}
                    </h1>
                    <p className="text-gray-400 mb-6">
                        {result.passed ? "You passed the assessment!" : "Keep practicing to improve."}
                    </p>

                    <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
                        <div className="text-4xl font-bold mb-1">
                            {result.percentage.toFixed(1)}%
                        </div>
                        <p className="text-sm text-gray-400">
                            {result.total_score} / {result.max_score} points
                        </p>
                    </div>

                    <button
                        onClick={() => navigate(-1)}
                        className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg"
                    >
                        Continue
                    </button>
                </div>
            </div>
        );
    }

    if (loading && !currentAssessment) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
                    <p>Loading assessment...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="text-center max-w-md">
                    <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
                    <h2 className="text-xl font-bold mb-2">Cannot Start Assessment</h2>
                    <p className="text-gray-400 mb-6">{error}</p>
                    <button
                        onClick={() => navigate(-1)}
                        className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col">
            {/* Header */}
            <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <h1 className="text-lg font-bold truncate">{currentAssessment?.title}</h1>

                    <div className="flex items-center gap-4">
                        {/* Timer */}
                        {timeRemaining !== null && (
                            <div className={`flex items-center gap-2 px-3 py-1 rounded-lg ${timeRemaining < 60 ? "bg-red-500/20 text-red-400" :
                                    timeRemaining < 300 ? "bg-yellow-500/20 text-yellow-400" :
                                        "bg-gray-700"
                                }`}>
                                <Clock size={18} />
                                <span className="font-mono font-bold">{formatTime(timeRemaining)}</span>
                            </div>
                        )}

                        {/* Progress */}
                        <div className="text-sm text-gray-400">
                            {answeredCount}/{questions.length} answered
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex">
                {/* Question Navigation Sidebar */}
                <aside className="w-20 bg-gray-800 border-r border-gray-700 p-2 hidden md:block">
                    <div className="grid grid-cols-3 gap-1">
                        {questions.map((q, idx) => (
                            <button
                                key={q.id}
                                onClick={() => goToQuestion(idx)}
                                className={`
                  aspect-square rounded flex items-center justify-center text-sm font-medium relative
                  ${currentQuestionIndex === idx ? "ring-2 ring-blue-500" : ""}
                  ${answers[q.id] ? "bg-emerald-600" : "bg-gray-700"}
                  ${flagged[q.id] ? "ring-2 ring-yellow-400" : ""}
                `}
                            >
                                {idx + 1}
                            </button>
                        ))}
                    </div>
                </aside>

                {/* Main Question Area */}
                <main className="flex-1 p-6">
                    <div className="max-w-2xl mx-auto">
                        {currentQuestion && (
                            <div className="bg-gray-800 rounded-xl p-6">
                                {/* Question Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-sm text-gray-400">
                                        Question {currentQuestionIndex + 1} of {questions.length}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-400">{currentQuestion.points} pts</span>
                                        <button
                                            onClick={() => handleFlagToggle(currentQuestion.id)}
                                            className={`p-1 rounded ${flagged[currentQuestion.id] ? "text-yellow-400" : "text-gray-500"
                                                }`}
                                        >
                                            <Flag size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Question Text */}
                                <p className="text-lg mb-6">{currentQuestion.question_text}</p>

                                {/* Answer Input */}
                                <QuestionInput
                                    question={currentQuestion}
                                    answer={answers[currentQuestion.id]}
                                    onAnswer={(answer) => handleAnswer(currentQuestion.id, answer)}
                                />
                            </div>
                        )}

                        {/* Navigation */}
                        <div className="flex justify-between mt-6">
                            <button
                                onClick={handlePrevious}
                                disabled={currentQuestionIndex === 0}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ArrowLeft size={18} />
                                Previous
                            </button>

                            {isLastQuestion ? (
                                <button
                                    onClick={() => setShowConfirmSubmit(true)}
                                    className="flex items-center gap-2 px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700"
                                >
                                    <Send size={18} />
                                    Submit
                                </button>
                            ) : (
                                <button
                                    onClick={handleNext}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700"
                                >
                                    Next
                                    <ArrowRight size={18} />
                                </button>
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {/* Submit Confirmation Modal */}
            {showConfirmSubmit && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">Submit Assessment?</h2>
                        <p className="text-gray-400 mb-4">
                            You have answered {answeredCount} of {questions.length} questions.
                            {answeredCount < questions.length && (
                                <span className="text-yellow-400 block mt-2">
                                    Warning: {questions.length - answeredCount} questions are unanswered.
                                </span>
                            )}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirmSubmit(false)}
                                className="flex-1 px-4 py-3 rounded-lg bg-gray-700 hover:bg-gray-600"
                            >
                                Review Answers
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="flex-1 px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {submitting ? "Submitting..." : "Submit"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function QuestionInput({ question, answer, onAnswer }) {
    if (question.type === "mcq") {
        return (
            <div className="space-y-3">
                {question.options?.map((opt) => (
                    <button
                        key={opt.id}
                        onClick={() => onAnswer(opt.id)}
                        className={`
              w-full text-left px-4 py-3 rounded-lg border transition-colors
              ${answer === opt.id
                                ? "bg-blue-600/20 border-blue-500"
                                : "bg-gray-700/50 border-gray-600 hover:border-gray-500"
                            }
            `}
                    >
                        {opt.text}
                    </button>
                ))}
            </div>
        );
    }

    if (question.type === "true_false") {
        return (
            <div className="flex gap-4">
                <button
                    onClick={() => onAnswer(true)}
                    className={`
            flex-1 px-6 py-4 rounded-lg border text-center font-medium
            ${answer === true
                            ? "bg-blue-600/20 border-blue-500"
                            : "bg-gray-700/50 border-gray-600 hover:border-gray-500"
                        }
          `}
                >
                    True
                </button>
                <button
                    onClick={() => onAnswer(false)}
                    className={`
            flex-1 px-6 py-4 rounded-lg border text-center font-medium
            ${answer === false
                            ? "bg-blue-600/20 border-blue-500"
                            : "bg-gray-700/50 border-gray-600 hover:border-gray-500"
                        }
          `}
                >
                    False
                </button>
            </div>
        );
    }

    if (question.type === "short_answer") {
        return (
            <input
                type="text"
                value={answer || ""}
                onChange={(e) => onAnswer(e.target.value)}
                placeholder="Enter your answer..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none"
            />
        );
    }

    if (question.type === "fillup" || question.type === "fill_up" || question.type === "fill_in_the_blank") {
        return (
            <input
                type="text"
                value={answer || ""}
                onChange={(e) => onAnswer(e.target.value)}
                placeholder="Fill in the blank..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none"
            />
        );
    }

    if (question.type === "long_answer" || question.type === "essay" || question.type === "file_upload") {
        return (
            <textarea
                value={answer || ""}
                onChange={(e) => onAnswer(e.target.value)}
                placeholder={question.type === "long_answer" ? "Write a detailed answer..." : "Enter your response..."}
                rows={question.type === "long_answer" ? 8 : 6}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none resize-none"
            />
        );
    }

    return <p className="text-gray-400">Unsupported question type</p>;
}
