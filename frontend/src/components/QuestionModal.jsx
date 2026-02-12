import React, { useState, useEffect } from "react";
import { X, Sparkles, Loader2, Plus, Trash } from "lucide-react";
import useUserStore from "../stores/userStore";

/**
 * QuestionModal Component
 * Handles creating and editing questions (manual and AI).
 * 
 * Props:
 * - question: Question object to edit (null for create)
 * - onClose: Function to close modal (arg: refresh boolean)
 * - isTeacher: Boolean, if current user is teacher
 * - userSubjects: Array of subjects assigned to teacher
 * - availableSubjects: Array of all available subjects (for dynamic dropdowns)
 */
const QuestionModal = ({ question, onClose, isTeacher, userSubjects, availableSubjects = [] }) => {
    const [activeTab, setActiveTab] = useState(question ? "manual" : "manual");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Determine subject list based on role
    const subjectList = isTeacher ? userSubjects : (availableSubjects.length > 0 ? availableSubjects : ["Mathematics", "Science", "English", "Hindi", "Social Science"]);

    // Load saved form defaults from localStorage
    const savedDefaults = (() => {
        try {
            const saved = localStorage.getItem("questionFormDefaults");
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    })();

    // Manual Form State
    const [formData, setFormData] = useState({
        text: "",
        subject: savedDefaults.subject && subjectList.includes(savedDefaults.subject) ? savedDefaults.subject : (subjectList[0] || ""),
        class_level: savedDefaults.class_level || 10,
        chapter: savedDefaults.chapter || 1,
        topic: "",
        type: savedDefaults.type || "mcq",
        difficulty: savedDefaults.difficulty || "medium",
        marks: 1,
        options: ["", "", "", ""],
        correct_answer: "",
        status: "approved"
    });

    // AI Gen State
    const [aiConfig, setAiConfig] = useState({
        subject: savedDefaults.subject && subjectList.includes(savedDefaults.subject) ? savedDefaults.subject : (subjectList[0] || ""),
        class_level: savedDefaults.class_level || 10,
        chapter: savedDefaults.chapter || 1,
        difficulty_dist: {
            easy: { mcq: 2, fillup: 0, short_answer: 0, long_answer: 0 },
            medium: { mcq: 0, fillup: 0, short_answer: 0, long_answer: 0 },
            hard: { mcq: 0, fillup: 0, short_answer: 0, long_answer: 0 },
            advanced: { mcq: 0, fillup: 0, short_answer: 0, long_answer: 0 }
        }
    });

    useEffect(() => {
        if (question) {
            setFormData({
                ...question,
                options: question.options || ["", "", "", ""]
            });
        }
    }, [question]);

    const handleManualSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const url = question
                ? `${apiUrl}/api/question-bank/questions/${question.id}`
                : `${apiUrl}/api/question-bank/questions`;

            const method = question ? "PUT" : "POST";

            // Validation for MCQ
            if (formData.type === 'mcq') {
                if (formData.options.some(o => !o.trim())) throw new Error("All options are required for MCQ");
                if (!formData.options.includes(formData.correct_answer)) throw new Error("Correct answer must be one of the options");
            }

            // If creating new manual question, status is 'approved' (or 'pending' if desired policy)
            // If editing, status might be preserved or reset. For now, let's keep it as is or default 'approved'
            // The user wanted approval workflow for AI questions primarily. Manual additions by admins/teachers often trusted?
            // Let's force 'approved' for manual to avoid them getting lost if not intended.
            // UNLESS user is teacher and config requires approval? For now, manual = approved.
            const payload = { ...formData, status: formData.status || 'approved' };

            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${useUserStore.getState().accessToken}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Failed to save question");
            }

            onClose(true); // refresh

            // Save form defaults for next time
            try {
                localStorage.setItem("questionFormDefaults", JSON.stringify({
                    subject: formData.subject,
                    class_level: formData.class_level,
                    chapter: formData.chapter,
                    type: formData.type,
                    difficulty: formData.difficulty
                }));
            } catch { }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAiGenerate = async () => {
        setLoading(true);
        setError("");
        try {
            // Flatten config for API
            const payload = {
                class_level: parseInt(aiConfig.class_level),
                subject: aiConfig.subject,
                chapter: parseInt(aiConfig.chapter),
                config: aiConfig.difficulty_dist
            };

            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/api/question-bank/generate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${useUserStore.getState().accessToken}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Generation failed");
            }

            const result = await response.json();
            if (!result.success) throw new Error(result.error || "Generation failed");

            alert(result.message); // Likely messages "Questions generated and sent for approval"
            onClose(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const updateAiDist = (diff, type, val) => {
        setAiConfig(prev => ({
            ...prev,
            difficulty_dist: {
                ...prev.difficulty_dist,
                [diff]: {
                    ...prev.difficulty_dist[diff],
                    [type]: parseInt(val) || 0
                }
            }
        }));
    };

    const getTotalAiQuestions = () => {
        let total = 0;
        Object.values(aiConfig.difficulty_dist).forEach(types => {
            Object.values(types).forEach(count => total += count);
        });
        return total;
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-700 shadow-2xl">
                <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center z-10">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        {question ? "Edit Question" : "Add Question"}
                        {question && question.status === 'pending' && <span className="text-sm bg-yellow-900 text-yellow-300 px-2 py-0.5 rounded ml-2">Pending Approval</span>}
                    </h2>
                    <button onClick={() => onClose(false)} className="text-gray-400 hover:text-white"><X /></button>
                </div>

                <div className="p-6">
                    {!question && (
                        <div className="flex gap-4 mb-6 border-b border-gray-700 pb-2">
                            <button
                                className={`pb-2 px-4 ${activeTab === 'manual' ? 'text-blue-400 border-b-2 border-blue-400 font-medium' : 'text-gray-400'}`}
                                onClick={() => setActiveTab('manual')}
                            >
                                Manual Entry
                            </button>
                            <button
                                className={`pb-2 px-4 flex items-center gap-2 ${activeTab === 'ai' ? 'text-purple-400 border-b-2 border-purple-400 font-medium' : 'text-gray-400'}`}
                                onClick={() => setActiveTab('ai')}
                            >
                                <Sparkles size={16} /> AI Generate
                            </button>
                        </div>
                    )}

                    {error && <div className="bg-red-900/50 text-red-200 p-3 rounded-lg mb-4 text-sm">{error}</div>}

                    {activeTab === 'manual' ? (
                        <form onSubmit={handleManualSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Subject</label>
                                    <select
                                        className="w-full bg-gray-900 border border-gray-700 rounded p-2"
                                        value={formData.subject}
                                        onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                        disabled={isTeacher} // Teacher locked to assigned? Maybe let them pick from assigned.
                                    >
                                        {subjectList.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Class</label>
                                    <select
                                        className="w-full bg-gray-900 border border-gray-700 rounded p-2"
                                        value={formData.class_level}
                                        onChange={e => setFormData({ ...formData, class_level: parseInt(e.target.value) })}
                                    >
                                        {[6, 7, 8, 9, 10, 11, 12].map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Chapter</label>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-900 border border-gray-700 rounded p-2"
                                        value={formData.chapter}
                                        onChange={e => setFormData({ ...formData, chapter: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Topic (Optional)</label>
                                    <input
                                        type="text"
                                        className="w-full bg-gray-900 border border-gray-700 rounded p-2"
                                        value={formData.topic}
                                        onChange={e => setFormData({ ...formData, topic: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Type</label>
                                    <select
                                        className="w-full bg-gray-900 border border-gray-700 rounded p-2"
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    >
                                        <option value="mcq">MCQ</option>
                                        <option value="fillup">Fill-in-the-blanks</option>
                                        <option value="short_answer">Short Answer</option>
                                        <option value="long_answer">Long Answer</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Difficulty</label>
                                    <select
                                        className="w-full bg-gray-900 border border-gray-700 rounded p-2"
                                        value={formData.difficulty}
                                        onChange={e => setFormData({ ...formData, difficulty: e.target.value })}
                                    >
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                        <option value="advanced">Advanced</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Marks</label>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-900 border border-gray-700 rounded p-2"
                                        value={formData.marks}
                                        onChange={e => setFormData({ ...formData, marks: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Question Text</label>
                                <textarea
                                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 h-24"
                                    value={formData.text}
                                    onChange={e => setFormData({ ...formData, text: e.target.value })}
                                    required
                                />
                            </div>

                            {formData.type === 'mcq' && (
                                <div className="space-y-2">
                                    <label className="block text-sm text-gray-400">Options</label>
                                    {formData.options.map((opt, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <span className="w-6 text-center text-gray-500">{String.fromCharCode(65 + idx)}</span>
                                            <input
                                                type="text"
                                                className="flex-1 bg-gray-900 border border-gray-700 rounded p-2"
                                                value={opt}
                                                onChange={e => {
                                                    const newOpts = [...formData.options];
                                                    newOpts[idx] = e.target.value;
                                                    setFormData({ ...formData, options: newOpts });
                                                }}
                                                placeholder={`Option ${idx + 1}`}
                                                required
                                            />
                                            <input
                                                type="radio"
                                                name="correct_option"
                                                checked={formData.correct_answer === opt && opt !== ""}
                                                onChange={() => setFormData({ ...formData, correct_answer: opt })}
                                                className="w-4 h-4"
                                            />
                                        </div>
                                    ))}
                                    <p className="text-xs text-gray-500">Select the radio button for the correct answer.</p>
                                </div>
                            )}

                            {formData.type !== 'mcq' && (
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Correct Answer / Key Points</label>
                                    <textarea
                                        className="w-full bg-gray-900 border border-gray-700 rounded p-2"
                                        value={formData.correct_answer}
                                        onChange={e => setFormData({ ...formData, correct_answer: e.target.value })}
                                        required
                                    />
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                                <button type="button" onClick={() => onClose(false)} className="px-4 py-2 hover:bg-gray-700 rounded text-gray-300">Cancel</button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded flex items-center gap-2"
                                >
                                    {loading && <Loader2 className="animate-spin" size={16} />}
                                    {question ? "Update Question" : "Create Question"}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Subject</label>
                                    <select
                                        className="w-full bg-gray-900 border border-gray-700 rounded p-2"
                                        value={aiConfig.subject}
                                        onChange={e => setAiConfig({ ...aiConfig, subject: e.target.value })}
                                    >
                                        {subjectList.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Class</label>
                                    <select
                                        className="w-full bg-gray-900 border border-gray-700 rounded p-2"
                                        value={aiConfig.class_level}
                                        onChange={e => setAiConfig({ ...aiConfig, class_level: parseInt(e.target.value) })}
                                    >
                                        {[6, 7, 8, 9, 10, 11, 12].map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Chapter Number</label>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-900 border border-gray-700 rounded p-2"
                                        value={aiConfig.chapter}
                                        onChange={e => setAiConfig({ ...aiConfig, chapter: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                                <h3 className="font-medium text-gray-300 mb-4 flex justify-between">
                                    <span>Question Distribution</span>
                                    <span className="text-blue-400 text-sm">Total: {getTotalAiQuestions()}</span>
                                </h3>

                                <div className="space-y-6">
                                    {['easy', 'medium', 'hard', 'advanced'].map(diff => (
                                        <div key={diff} className="space-y-2">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`w-2 h-2 rounded-full ${diff === 'easy' ? 'bg-green-500' :
                                                    diff === 'medium' ? 'bg-yellow-500' :
                                                        diff === 'hard' ? 'bg-orange-500' : 'bg-red-500'
                                                    }`}></span>
                                                <span className="capitalize font-medium text-gray-300">{diff}</span>
                                            </div>
                                            <div className="grid grid-cols-4 gap-4">
                                                {['mcq', 'fillup', 'short_answer', 'long_answer'].map(type => (
                                                    <div key={type}>
                                                        <label className="text-xs text-gray-500 block mb-1 capitalize">{type.replace('_', ' ')}</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="20"
                                                            className="w-full bg-gray-800 border border-gray-700 rounded p-1 text-center"
                                                            value={aiConfig.difficulty_dist[diff][type]}
                                                            onChange={e => updateAiDist(diff, type, e.target.value)}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                                <button onClick={() => onClose(false)} className="px-4 py-2 hover:bg-gray-700 rounded text-gray-300">Cancel</button>
                                <button
                                    onClick={handleAiGenerate}
                                    disabled={loading || getTotalAiQuestions() === 0}
                                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                                    Generate Questions
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuestionModal;
