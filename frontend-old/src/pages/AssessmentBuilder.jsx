
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft,
    Plus,
    Trash2,
    Save,
    Send,
    ChevronDown,
    ChevronUp,
    ListChecks,
    Type,
    ToggleLeft,
    Upload,
    Link2,
    Settings
} from "lucide-react";
import useAssessmentStore from "../stores/assessmentStore";

const QUESTION_TYPES = [
    { value: "mcq", label: "Multiple Choice", icon: ListChecks },
    { value: "true_false", label: "True/False", icon: ToggleLeft },
    { value: "short_answer", label: "Short Answer", icon: Type },
    { value: "essay", label: "Essay", icon: Type },
    { value: "matching", label: "Matching", icon: Link2 },
    { value: "file_upload", label: "File Upload", icon: Upload }
];

const ASSESSMENT_TYPES = [
    { value: "quiz", label: "Quiz" },
    { value: "exam", label: "Exam" },
    { value: "assignment", label: "Assignment" },
    { value: "practice", label: "Practice" }
];

export default function AssessmentBuilder() {
    const { assessmentId } = useParams();
    const navigate = useNavigate();
    const {
        currentAssessment,
        fetchAssessmentDetails,
        createAssessment,
        updateAssessment,
        publishAssessment,
        addQuestion,
        deleteQuestion,
        clearCurrentAssessment,
        loading
    } = useAssessmentStore();

    const isEditing = Boolean(assessmentId);

    const [step, setStep] = useState(1);
    const [assessmentData, setAssessmentData] = useState({
        course_id: "",
        title: "",
        description: "",
        type: "quiz",
        settings: {
            time_limit_minutes: null,
            attempt_limit: 1,
            shuffle_questions: false,
            shuffle_options: false,
            show_correct_answers: true,
            passing_score_percent: 60
        }
    });

    const [questions, setQuestions] = useState([]);
    const [expandedQuestion, setExpandedQuestion] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isEditing) {
            fetchAssessmentDetails(assessmentId);
        }
        return () => clearCurrentAssessment();
    }, [assessmentId]);

    useEffect(() => {
        if (isEditing && currentAssessment) {
            setAssessmentData({
                course_id: currentAssessment.course_id,
                title: currentAssessment.title,
                description: currentAssessment.description || "",
                type: currentAssessment.type,
                settings: currentAssessment.settings
            });
            setQuestions(currentAssessment.questions || []);
        }
    }, [currentAssessment, isEditing]);

    const handleChange = (field, value) => {
        setAssessmentData(prev => ({ ...prev, [field]: value }));
    };

    const handleSettingsChange = (field, value) => {
        setAssessmentData(prev => ({
            ...prev,
            settings: { ...prev.settings, [field]: value }
        }));
    };

    const handleSaveAssessment = async () => {
        setSaving(true);
        setError(null);

        try {
            let assessment;
            if (isEditing) {
                assessment = await updateAssessment(assessmentId, assessmentData);
            } else {
                assessment = await createAssessment(assessmentData);
                if (assessment) {
                    navigate(`/assessment-builder/${assessment.id}`, { replace: true });
                }
            }

            if (assessment) {
                setStep(2);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleAddQuestion = () => {
        const newQuestion = {
            id: `temp-${Date.now()}`,
            type: "mcq",
            question_text: "",
            points: 1,
            options: [
                { id: "opt-1", text: "", is_correct: false },
                { id: "opt-2", text: "", is_correct: false }
            ],
            correct_answer_bool: null,
            correct_answer_text: "",
            tags: [],
            difficulty: "medium"
        };
        setQuestions(prev => [...prev, newQuestion]);
        setExpandedQuestion(newQuestion.id);
    };

    const handleQuestionChange = (questionId, field, value) => {
        setQuestions(prev => prev.map(q =>
            q.id === questionId ? { ...q, [field]: value } : q
        ));
    };

    const handleSaveQuestion = async (question) => {
        if (!isEditing) return;

        const questionData = {
            type: question.type,
            question_text: question.question_text,
            points: question.points,
            options: question.options,
            correct_answer_bool: question.correct_answer_bool,
            correct_answer_text: question.correct_answer_text,
            matching_pairs: question.matching_pairs,
            tags: question.tags,
            difficulty: question.difficulty
        };

        if (question.id.startsWith("temp-")) {
            await addQuestion(assessmentId, questionData);
        }
        
    };

    const handleDeleteQuestion = async (questionId) => {
        if (isEditing && !questionId.startsWith("temp-")) {
            await deleteQuestion(assessmentId, questionId);
        } else {
            setQuestions(prev => prev.filter(q => q.id !== questionId));
        }
    };

    const handlePublish = async () => {
        if (!isEditing) return;
        setSaving(true);
        try {
            await publishAssessment(assessmentId);
            navigate("/teacher-dashboard");
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {}
            <header className="bg-gray-800/50 border-b border-gray-700 px-6 py-4 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-gray-700 rounded-lg"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="text-xl font-bold">
                            {isEditing ? "Edit Assessment" : "Create Assessment"}
                        </h1>
                    </div>

                    <div className="flex gap-2">
                        {isEditing && currentAssessment?.status === "draft" && (
                            <button
                                onClick={handlePublish}
                                disabled={saving || questions.length === 0}
                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg disabled:opacity-50"
                            >
                                <Send size={16} />
                                Publish
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-8">
                {}
                <div className="flex items-center gap-4 mb-8">
                    <StepIndicator number={1} active={step === 1} completed={step > 1} label="Details" />
                    <div className="flex-1 h-px bg-gray-700" />
                    <StepIndicator number={2} active={step === 2} completed={step > 2} label="Questions" />
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 text-red-400">
                        {error}
                    </div>
                )}

                {/* Step 1: Assessment Details */}
                {step === 1 && (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium mb-2">Title *</label>
                            <input
                                type="text"
                                value={assessmentData.title}
                                onChange={(e) => handleChange("title", e.target.value)}
                                placeholder="e.g., Chapter 5 Quiz"
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Description</label>
                            <textarea
                                value={assessmentData.description}
                                onChange={(e) => handleChange("description", e.target.value)}
                                placeholder="Instructions for students..."
                                rows={3}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none resize-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Type</label>
                                <select
                                    value={assessmentData.type}
                                    onChange={(e) => handleChange("type", e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none"
                                >
                                    {ASSESSMENT_TYPES.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Course ID</label>
                                <input
                                    type="text"
                                    value={assessmentData.course_id}
                                    onChange={(e) => handleChange("course_id", e.target.value)}
                                    placeholder="Course ID"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Settings Toggle */}
                        <div className="border border-gray-700 rounded-lg">
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50"
                            >
                                <div className="flex items-center gap-2">
                                    <Settings size={18} />
                                    <span className="font-medium">Assessment Settings</span>
                                </div>
                                {showSettings ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>

                            {showSettings && (
                                <div className="p-4 border-t border-gray-700 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm mb-2">Time Limit (minutes)</label>
                                            <input
                                                type="number"
                                                value={assessmentData.settings.time_limit_minutes || ""}
                                                onChange={(e) => handleSettingsChange("time_limit_minutes", e.target.value ? parseInt(e.target.value) : null)}
                                                placeholder="No limit"
                                                className="w-full bg-gray-700 border-none rounded px-3 py-2"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm mb-2">Attempt Limit</label>
                                            <input
                                                type="number"
                                                value={assessmentData.settings.attempt_limit}
                                                onChange={(e) => handleSettingsChange("attempt_limit", parseInt(e.target.value) || 1)}
                                                min={1}
                                                className="w-full bg-gray-700 border-none rounded px-3 py-2"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm mb-2">Passing Score (%)</label>
                                            <input
                                                type="number"
                                                value={assessmentData.settings.passing_score_percent}
                                                onChange={(e) => handleSettingsChange("passing_score_percent", parseInt(e.target.value) || 0)}
                                                min={0}
                                                max={100}
                                                className="w-full bg-gray-700 border-none rounded px-3 py-2"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={assessmentData.settings.shuffle_questions}
                                                onChange={(e) => handleSettingsChange("shuffle_questions", e.target.checked)}
                                                className="rounded"
                                            />
                                            <span className="text-sm">Shuffle Questions</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={assessmentData.settings.show_correct_answers}
                                                onChange={(e) => handleSettingsChange("show_correct_answers", e.target.checked)}
                                                className="rounded"
                                            />
                                            <span className="text-sm">Show Correct Answers After</span>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <button
                                onClick={() => navigate(-1)}
                                className="px-6 py-3 rounded-lg border border-gray-600 hover:bg-gray-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveAssessment}
                                disabled={!assessmentData.title || saving}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg disabled:opacity-50"
                            >
                                {saving ? "Saving..." : (
                                    <>
                                        <Save size={18} />
                                        {isEditing ? "Save & Continue" : "Create Assessment"}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: Questions */}
                {step === 2 && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">Questions</h2>
                                <p className="text-sm text-gray-400">
                                    {questions.length} questions, {totalPoints} total points
                                </p>
                            </div>
                            <button
                                onClick={handleAddQuestion}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
                            >
                                <Plus size={18} />
                                Add Question
                            </button>
                        </div>

                        {questions.length === 0 ? (
                            <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center">
                                <ListChecks size={48} className="mx-auto text-gray-600 mb-4" />
                                <h3 className="text-lg font-medium mb-2">No questions yet</h3>
                                <p className="text-gray-400 mb-4">Add your first question</p>
                                <button
                                    onClick={handleAddQuestion}
                                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
                                >
                                    Add Question
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {questions.map((question, idx) => (
                                    <QuestionEditor
                                        key={question.id}
                                        question={question}
                                        index={idx}
                                        expanded={expandedQuestion === question.id}
                                        onToggle={() => setExpandedQuestion(
                                            expandedQuestion === question.id ? null : question.id
                                        )}
                                        onChange={(field, value) => handleQuestionChange(question.id, field, value)}
                                        onSave={() => handleSaveQuestion(question)}
                                        onDelete={() => handleDeleteQuestion(question.id)}
                                    />
                                ))}
                            </div>
                        )}

                        <div className="flex justify-between pt-4 border-t border-gray-700">
                            <button
                                onClick={() => setStep(1)}
                                className="px-6 py-3 rounded-lg border border-gray-600 hover:bg-gray-800"
                            >
                                Back to Details
                            </button>
                            <button
                                onClick={() => navigate("/teacher-dashboard")}
                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 px-6 py-3 rounded-lg"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

function StepIndicator({ number, active, completed, label }) {
    return (
        <div className="flex items-center gap-2">
            <div className={`
        w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
        ${completed ? "bg-emerald-500 text-white" : active ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400"}
      `}>
                {completed ? "✓" : number}
            </div>
            <span className={active || completed ? "text-white" : "text-gray-400"}>
                {label}
            </span>
        </div>
    );
}

function QuestionEditor({ question, index, expanded, onToggle, onChange, onSave, onDelete }) {
    const QuestionIcon = QUESTION_TYPES.find(t => t.value === question.type)?.icon || ListChecks;

    const handleOptionChange = (optionId, field, value) => {
        const newOptions = question.options.map(opt =>
            opt.id === optionId ? { ...opt, [field]: value } : opt
        );
        onChange("options", newOptions);
    };

    const handleCorrectOptionChange = (optionId) => {
        const newOptions = question.options.map(opt => ({
            ...opt,
            is_correct: opt.id === optionId
        }));
        onChange("options", newOptions);
    };

    const addOption = () => {
        const newOption = { id: `opt-${Date.now()}`, text: "", is_correct: false };
        onChange("options", [...question.options, newOption]);
    };

    const removeOption = (optionId) => {
        onChange("options", question.options.filter(o => o.id !== optionId));
    };

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            {/* Question Header */}
            <div
                className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-gray-700/50"
                onClick={onToggle}
            >
                <span className="text-gray-400 font-medium">Q{index + 1}</span>
                <QuestionIcon size={18} className="text-gray-400" />
                <div className="flex-1 truncate">
                    {question.question_text || "New question"}
                </div>
                <span className="text-sm text-gray-400">{question.points} pts</span>
                {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>

            {/* Question Editor */}
            {expanded && (
                <div className="border-t border-gray-700 p-4 space-y-4">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm mb-2">Question Type</label>
                            <select
                                value={question.type}
                                onChange={(e) => onChange("type", e.target.value)}
                                className="w-full bg-gray-700 border-none rounded px-3 py-2"
                            >
                                {QUESTION_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-24">
                            <label className="block text-sm mb-2">Points</label>
                            <input
                                type="number"
                                value={question.points}
                                onChange={(e) => onChange("points", parseInt(e.target.value) || 0)}
                                min={0}
                                className="w-full bg-gray-700 border-none rounded px-3 py-2"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm mb-2">Question Text</label>
                        <textarea
                            value={question.question_text}
                            onChange={(e) => onChange("question_text", e.target.value)}
                            placeholder="Enter your question..."
                            rows={2}
                            className="w-full bg-gray-700 border-none rounded px-3 py-2 resize-none"
                        />
                    </div>

                    {/* MCQ Options */}
                    {question.type === "mcq" && (
                        <div className="space-y-2">
                            <label className="block text-sm">Options (select correct answer)</label>
                            {question.options.map((opt, idx) => (
                                <div key={opt.id} className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        name={`correct-${question.id}`}
                                        checked={opt.is_correct}
                                        onChange={() => handleCorrectOptionChange(opt.id)}
                                        className="text-emerald-500"
                                    />
                                    <input
                                        type="text"
                                        value={opt.text}
                                        onChange={(e) => handleOptionChange(opt.id, "text", e.target.value)}
                                        placeholder={`Option ${idx + 1}`}
                                        className="flex-1 bg-gray-600 border-none rounded px-3 py-2 text-sm"
                                    />
                                    {question.options.length > 2 && (
                                        <button
                                            onClick={() => removeOption(opt.id)}
                                            className="p-1 text-red-400 hover:text-red-300"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                onClick={addOption}
                                className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                            >
                                <Plus size={14} /> Add Option
                            </button>
                        </div>
                    )}

                    {/* True/False */}
                    {question.type === "true_false" && (
                        <div>
                            <label className="block text-sm mb-2">Correct Answer</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name={`tf-${question.id}`}
                                        checked={question.correct_answer_bool === true}
                                        onChange={() => onChange("correct_answer_bool", true)}
                                    />
                                    <span>True</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name={`tf-${question.id}`}
                                        checked={question.correct_answer_bool === false}
                                        onChange={() => onChange("correct_answer_bool", false)}
                                    />
                                    <span>False</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Short Answer */}
                    {question.type === "short_answer" && (
                        <div>
                            <label className="block text-sm mb-2">Correct Answer</label>
                            <input
                                type="text"
                                value={question.correct_answer_text || ""}
                                onChange={(e) => onChange("correct_answer_text", e.target.value)}
                                placeholder="Expected answer"
                                className="w-full bg-gray-700 border-none rounded px-3 py-2"
                            />
                        </div>
                    )}

                    <div className="flex justify-between pt-4 border-t border-gray-600">
                        <button
                            onClick={onDelete}
                            className="text-red-400 hover:text-red-300 flex items-center gap-1"
                        >
                            <Trash2 size={16} /> Delete
                        </button>
                        <button
                            onClick={onSave}
                            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm"
                        >
                            Save Question
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
