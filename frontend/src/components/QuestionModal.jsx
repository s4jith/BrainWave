import React, { useState, useEffect } from "react";
import { X, Sparkles, Loader2, Plus, Trash } from "lucide-react";
import useUserStore from "../stores/userStore";
import QuestionImageUploadPanel from "./QuestionImageUploadPanel";
import authFetch from "../utils/authFetch";

const apiUrl = import.meta.env.VITE_API_URL;

const QuestionModal = ({ question, onClose, isTeacher, userSubjects, availableSubjects = [], groups = [] }) => {
    const [activeTab, setActiveTab] = useState(question ? "manual" : "manual");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Tracks which images have been attached to this question
    const [uploadedImages, setUploadedImages] = useState([]);

    const [curriculumSubjects, setCurriculumSubjects] = useState([]);
    const [selectedCurrSubject, setSelectedCurrSubject] = useState(null); 
    const [loadingCurriculum, setLoadingCurriculum] = useState(true);
    const [loadingSubjectDetail, setLoadingSubjectDetail] = useState(false);

    const subjectList = isTeacher ? userSubjects : (availableSubjects.length > 0 ? availableSubjects : []);

    const savedDefaults = (() => {
        try {
            const saved = localStorage.getItem("questionFormDefaults");
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    })();

    const [formData, setFormData] = useState({
        text: "",
        subject: savedDefaults.subject && subjectList.includes(savedDefaults.subject) ? savedDefaults.subject : (subjectList[0] || ""),
        class_level: savedDefaults.class_level || "",
        chapter: savedDefaults.chapter || "",
        chapter_name: "",
        topic: "",
        type: savedDefaults.type || "mcq",
        difficulty: savedDefaults.difficulty || "medium",
        bloom_level: savedDefaults.bloom_level || "remember",
        marks: 1,
        options: ["", "", "", ""],
        correct_answer: "",
        answer_image_ids: [],
        status: "approved"
    });

    const [aiConfig, setAiConfig] = useState({
        subject: savedDefaults.subject && subjectList.includes(savedDefaults.subject) ? savedDefaults.subject : (subjectList[0] || ""),
        class_level: savedDefaults.class_level || "",
        chapter: savedDefaults.chapter || "",
        difficulty_dist: {
            easy: { mcq: 2, fillup: 0, true_false: 0, short_answer: 0, long_answer: 0 },
            medium: { mcq: 0, fillup: 0, true_false: 0, short_answer: 0, long_answer: 0 },
            hard: { mcq: 0, fillup: 0, true_false: 0, short_answer: 0, long_answer: 0 }
        }
    });

    useEffect(() => {
        if (question) {
            setFormData({
                text: question.text || "",
                subject: question.subject || formData.subject,
                class_level: question.class_level || formData.class_level,
                chapter: question.chapter || formData.chapter,
                chapter_name: question.chapter_name || "",
                topic: question.topic || "",
                type: question.type || "mcq",
                difficulty: question.difficulty || "medium",
                bloom_level: question.bloom_level || "remember",
                marks: question.marks || 1,
                options: question.options || ["", "", "", ""],
                correct_answer: question.correct_answer || "",
                answer_image_ids: question.answer_image_ids || [],
                status: question.status || "approved"
            });
            if (question.image_ids && question.image_ids.length > 0) {
                setUploadedImages(question.image_ids.map(id => ({ image_id: id, filename: id })));
            }
        }
    }, [question]);

    useEffect(() => {
        const fetchCurriculum = async () => {
            setLoadingCurriculum(true);
            try {
                const response = await authFetch(`${apiUrl}/api/curriculum/subjects?is_active=true`);
                if (response.ok) {
                    const data = await response.json();
                    setCurriculumSubjects(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                console.error("Failed to fetch curriculum:", err);
            } finally {
                setLoadingCurriculum(false);
            }
        };
        fetchCurriculum();
    }, []);

    const activeSubject = activeTab === 'ai' ? aiConfig.subject : formData.subject;
    const activeClassLevel = activeTab === 'ai' ? aiConfig.class_level : formData.class_level;

    useEffect(() => {
        if (!activeSubject || !activeClassLevel) {
            setSelectedCurrSubject(null);
            return;
        }

        const subjectId = `${activeSubject.toLowerCase().replace(/\s+/g, '_')}_${activeClassLevel}`;
        const fetchSubjectDetail = async () => {
            setLoadingSubjectDetail(true);
            try {
                const response = await authFetch(`${apiUrl}/api/curriculum/subjects/${subjectId}`);
                if (response.ok) {
                    const data = await response.json();
                    setSelectedCurrSubject(data);
                } else {
                    setSelectedCurrSubject(null);
                }
            } catch (err) {
                setSelectedCurrSubject(null);
            } finally {
                setLoadingSubjectDetail(false);
            }
        };

        fetchSubjectDetail();
    }, [activeSubject, activeClassLevel]);

    const availableChapters = selectedCurrSubject?.chapters?.filter(ch => ch.is_active !== false) || [];

    const selectedChapterObj = availableChapters.find(ch => ch.chapter_number === formData.chapter);
    const availableTopics = selectedChapterObj?.topics?.filter(t => t.is_active !== false) || [];

    const curriculumSubjectNames = [...new Set(curriculumSubjects.map(s => s.subject_name))].sort();
    
    const curriculumClassLevels = [...new Set(
        curriculumSubjects
            .filter(s => s.subject_name === activeSubject)
            .map(s => s.class_level)
    )].sort((a, b) => a - b);
    
    const allAvailableClassLevels = [...new Set(curriculumSubjects.map(s => s.class_level))].sort((a, b) => a - b);

    // For teachers: derive subjects/classes from their assigned groups only
    const teacherGroupSubjects = React.useMemo(() =>
        isTeacher && groups.length > 0
            ? [...new Set(groups.map(g => g.subject).filter(Boolean))].sort()
            : null,
        [isTeacher, groups]
    );

    const getTeacherClassesForSubject = React.useCallback((subject) => {
        if (!isTeacher || groups.length === 0) return null;
        const filtered = subject
            ? groups.filter(g => g.subject?.toLowerCase() === subject.toLowerCase())
            : groups;
        return [...new Set(filtered.map(g => g.class_level).filter(Boolean))].sort((a, b) => a - b);
    }, [isTeacher, groups]);

    useEffect(() => {
        if (question) {
            setFormData({
                ...question,
                options: question.options || ["", "", "", ""]
            });
            // Pre-populate uploaded images from existing question text
            if (question.image_ids && question.image_ids.length > 0) {
                setUploadedImages(
                    question.image_ids.map(id => ({ image_id: id, filename: id }))
                );
            }
        }
    }, [question]);

    const handleImageIdsChange = (newIds) => {
        setUploadedImages(newIds.map(id => ({ image_id: id, filename: id })));
    };

    const handleManualSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const apiUrl = import.meta.env.VITE_API_URL;
            const url = question
                ? `${apiUrl}/api/question-bank/questions/${question.id}`
                : `${apiUrl}/api/question-bank/questions`;

            const method = question ? "PUT" : "POST";

            if (formData.type === 'mcq') {
                if (formData.options.some(o => !o.trim())) throw new Error("All options are required for MCQ");
                const correctAnswers = (formData.correct_answer || "").split("|").filter(Boolean);
                if (correctAnswers.length === 0) throw new Error("Select at least one correct answer for MCQ");
                const invalidAnswers = correctAnswers.filter(a => !formData.options.includes(a));
                if (invalidAnswers.length > 0) throw new Error("Correct answer(s) must match one of the options");
            }

            if (formData.type === 'fillup') {
                const answers = (formData.correct_answer || "").split("|").filter(Boolean);
                if (answers.length === 0) throw new Error("At least one correct answer is required for fill-in-the-blanks");
            }

            if (formData.type === 'true_false') {
                if (!formData.correct_answer || !['True', 'False'].includes(formData.correct_answer)) {
                    throw new Error("Select True or False as the correct answer");
                }
            }

            const payload = {
                ...formData,
                status: formData.status || 'approved',
                image_ids: uploadedImages.map(img => img.image_id)
            };

            const response = await authFetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${useUserStore.getState().accessToken}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const err = await response.json();
                if (Array.isArray(err.detail)) {
                    const msgs = err.detail.map(e => {
                        const field = e.loc ? e.loc[e.loc.length - 1] : "";
                        return field ? `${field}: ${e.msg}` : e.msg;
                    });
                    throw new Error(msgs.join("; "));
                }
                throw new Error(err.detail || "Failed to save question");
            }

            onClose(true); 

            try {
                localStorage.setItem("questionFormDefaults", JSON.stringify({
                    subject: formData.subject,
                    class_level: formData.class_level,
                    chapter: formData.chapter,
                    type: formData.type,
                    difficulty: formData.difficulty,
                    bloom_level: formData.bloom_level
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
            if (!aiConfig.subject) { setError("Please select a subject."); setLoading(false); return; }
            if (!aiConfig.class_level) { setError("Please select a class."); setLoading(false); return; }
            if (!aiConfig.chapter) { setError("Please select a chapter."); setLoading(false); return; }

            const payload = {
                class_level: parseInt(aiConfig.class_level),
                subject: aiConfig.subject,
                chapter: parseInt(aiConfig.chapter),
                config: aiConfig.difficulty_dist
            };

            const apiUrl = import.meta.env.VITE_API_URL;
            const response = await authFetch(`${apiUrl}/api/question-bank/generate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${useUserStore.getState().accessToken}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const err = await response.json();
                // FastAPI 422 returns detail as an array of validation error objects
                if (Array.isArray(err.detail)) {
                    const msgs = err.detail.map(e => {
                        const field = e.loc ? e.loc[e.loc.length - 1] : "";
                        return field ? `${field}: ${e.msg}` : e.msg;
                    });
                    throw new Error(msgs.join("; "));
                }
                throw new Error(err.detail || "Generation failed");
            }

            const result = await response.json();
            if (!result.success) throw new Error(result.error || "Generation failed");

            alert(result.message); 
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
            <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700 shadow-2xl">
                <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center z-10">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        {question ? "Edit Question" : "Add Question"}
                        {question && question.status === 'pending' && <span className="text-sm bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded ml-2">Pending Approval</span>}
                    </h2>
                    <button onClick={() => onClose(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"><X /></button>
                </div>

                <div className="p-6">
                    {!question && (
                        <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700 pb-2">
                            <button
                                className={`pb-2 px-4 ${activeTab === 'manual' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}
                                onClick={() => setActiveTab('manual')}
                            >
                                Manual Entry
                            </button>
                            <button
                                className={`pb-2 px-4 flex items-center gap-2 ${activeTab === 'ai' ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}
                                onClick={() => setActiveTab('ai')}
                            >
                                <Sparkles size={16} /> AI Generate
                            </button>
                        </div>
                    )}

                    {error && <div className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 p-3 rounded-lg mb-4 text-sm">{error}</div>}

                    {activeTab === 'manual' ? (
                        <form onSubmit={handleManualSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Subject <span className="text-red-500">*</span></label>
                                    {loadingCurriculum ? (
                                        <div className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 text-gray-500 flex items-center gap-2">
                                            <Loader2 size={14} className="animate-spin" /> Loading subjects...
                                        </div>
                                    ) : (
                                        <select
                                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white"
                                            value={formData.subject}
                                            onChange={e => {
                                                setFormData({ ...formData, subject: e.target.value, chapter: "", chapter_name: "", topic: "", class_level: "" });
                                                setSelectedCurrSubject(null);
                                            }}
                                            required
                                        >
                                            <option value="">Select Subject</option>
                                            {(teacherGroupSubjects ?? (curriculumSubjectNames.length > 0 ? curriculumSubjectNames : subjectList)).map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Class <span className="text-red-500">*</span></label>
                                    <select
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white"
                                        value={formData.class_level}
                                        onChange={e => {
                                            setFormData({ ...formData, class_level: parseInt(e.target.value), chapter: "", chapter_name: "", topic: "" });
                                            setSelectedCurrSubject(null);
                                        }}
                                        required
                                    >
                                        <option value="">Select Class</option>
                                        {(getTeacherClassesForSubject(formData.subject) ?? (curriculumClassLevels.length > 0 ? curriculumClassLevels : allAvailableClassLevels)).map(c => (
                                            <option key={c} value={c}>Class {c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Chapter <span className="text-red-500">*</span></label>
                                    {loadingSubjectDetail ? (
                                        <div className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 text-gray-500 flex items-center gap-2">
                                            <Loader2 size={14} className="animate-spin" /> Loading chapters...
                                        </div>
                                    ) : (
                                        <select
                                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white"
                                            value={formData.chapter}
                                            onChange={e => {
                                                const chNum = parseInt(e.target.value);
                                                const ch = availableChapters.find(c => c.chapter_number === chNum);
                                                setFormData({
                                                    ...formData,
                                                    chapter: chNum || "",
                                                    chapter_name: ch?.chapter_name || "",
                                                    topic: ""
                                                });
                                            }}
                                            required
                                        >
                                            <option value="">Select Chapter</option>
                                            {availableChapters.length > 0 ? (
                                                availableChapters.map(ch => (
                                                    <option key={ch.chapter_number} value={ch.chapter_number}>
                                                        Ch {ch.chapter_number}: {ch.chapter_name}
                                                    </option>
                                                ))
                                            ) : (
                                                <option disabled>{formData.subject && formData.class_level ? "No chapters found – add in Subjects page" : "Select subject & class first"}</option>
                                            )}
                                        </select>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Topic <span className="text-red-500">*</span></label>
                                    <select
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white"
                                        value={formData.topic}
                                        onChange={e => setFormData({ ...formData, topic: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Topic</option>
                                        {availableTopics.length > 0 ? (
                                            availableTopics.map(t => (
                                                <option key={t.topic_id} value={t.topic_name}>
                                                    {t.topic_name}
                                                </option>
                                            ))
                                        ) : (
                                            <option disabled>{formData.chapter ? "No topics found – add in Subjects page" : "Select chapter first"}</option>
                                        )}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Type</label>
                                    <select
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white"
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    >
                                        <option value="mcq">MCQ</option>
                                        <option value="fillup">Fill-in-the-blanks</option>
                                        <option value="true_false">True / False</option>
                                        <option value="short_answer">Short Answer</option>
                                        <option value="long_answer">Long Answer</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Cognitive Level</label>
                                    <select
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white"
                                        value={formData.bloom_level}
                                        onChange={e => setFormData({ ...formData, bloom_level: e.target.value })}
                                    >
                                        <option value="remember">Remember</option>
                                        <option value="understand">Understand</option>
                                        <option value="apply">Apply</option>
                                        <option value="analyze">Analyze</option>
                                        <option value="evaluate">Evaluate</option>
                                        <option value="create">Create</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Difficulty</label>
                                    <select
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white"
                                        value={formData.difficulty}
                                        onChange={e => setFormData({ ...formData, difficulty: e.target.value })}
                                    >
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Marks</label>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white"
                                        value={formData.marks}
                                        onChange={e => setFormData({ ...formData, marks: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Question Text</label>
                                <textarea
                                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 h-24 text-gray-900 dark:text-white font-mono text-sm"
                                    value={formData.text}
                                    onChange={e => setFormData({ ...formData, text: e.target.value })}
                                    required
                                    placeholder="Type your question here. Use the image panel below to embed images."
                                />
                            </div>

                            {/* ── Attachment Panels ─────────────────────────────────── */}
                            <div className={`grid gap-4 ${['mcq','fillup','true_false'].includes(formData.type) ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                                <QuestionImageUploadPanel
                                    title="Question Attachments"
                                    placeholder="Click to upload"
                                    text={formData.text}
                                    onTextChange={(newText) => setFormData(prev => ({ ...prev, text: newText }))}
                                    imageIds={uploadedImages.map(img => img.image_id)}
                                    onImageIdsChange={handleImageIdsChange}
                                />
                                {!['mcq','fillup','true_false'].includes(formData.type) && (
                                    <QuestionImageUploadPanel
                                        title="Answer Attachments"
                                        placeholder="Click to upload answer ref"
                                        imageIds={formData.answer_image_ids || []}
                                        onImageIdsChange={(ids) => setFormData(prev => ({ ...prev, answer_image_ids: ids }))}
                                    />
                                )}
                            </div>
                            {/* ── End Attachment Panels ──────────────────────────────── */}

                            {formData.type === 'mcq' && (
                                <div className="space-y-2">
                                    <label className="block text-sm text-gray-600 dark:text-gray-400">Options</label>
                                    {formData.options.map((opt, idx) => {
                                        const correctAnswers = (formData.correct_answer || "").split("|").filter(Boolean);
                                        const isChecked = opt !== "" && correctAnswers.includes(opt);
                                        return (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <span className="w-6 text-center text-gray-500">{String.fromCharCode(65 + idx)}</span>
                                                <input
                                                    type="text"
                                                    className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white"
                                                    value={opt}
                                                    onChange={e => {
                                                        const newOpts = [...formData.options];
                                                        const oldOpt = newOpts[idx];
                                                        newOpts[idx] = e.target.value;
                                                        let updatedCorrect = correctAnswers.filter(a => a !== oldOpt);
                                                        if (isChecked && e.target.value) updatedCorrect.push(e.target.value);
                                                        setFormData({ ...formData, options: newOpts, correct_answer: updatedCorrect.join("|") });
                                                    }}
                                                    placeholder={`Option ${idx + 1}`}
                                                    required
                                                />
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => {
                                                        let updated;
                                                        if (isChecked) {
                                                            updated = correctAnswers.filter(a => a !== opt);
                                                        } else {
                                                            updated = [...correctAnswers, opt];
                                                        }
                                                        setFormData({ ...formData, correct_answer: updated.join("|") });
                                                    }}
                                                    className="w-4 h-4 accent-blue-500"
                                                />
                                            </div>
                                        );
                                    })}
                                    <p className="text-xs text-gray-500">Select one or more checkboxes for correct answer(s).</p>
                                </div>
                            )}

                            {formData.type === 'fillup' && (
                                <div className="space-y-2">
                                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Acceptable Answers</label>
                                    <p className="text-xs text-gray-500 mb-2">Add all acceptable answers. Student's answer will be matched against any of these (case-insensitive).</p>
                                    {(formData.correct_answer || "").split("|").filter((a, i, arr) => i === 0 || a !== "").concat("").slice(0, Math.max((formData.correct_answer || "").split("|").length, 1) + 1 > 10 ? 10 : Math.max((formData.correct_answer || "").split("|").length, 1) + (formData.correct_answer && !formData.correct_answer.endsWith("|") ? 1 : 0)).map((ans, idx) => {
                                        const answers = (formData.correct_answer || "").split("|");
                                        return (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <span className="w-6 text-center text-gray-500 text-sm">{idx + 1}.</span>
                                                <input
                                                    type="text"
                                                    className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white"
                                                    value={answers[idx] || ""}
                                                    onChange={e => {
                                                        const newAnswers = [...answers];
                                                        while (newAnswers.length <= idx) newAnswers.push("");
                                                        newAnswers[idx] = e.target.value;
                                                        setFormData({ ...formData, correct_answer: newAnswers.filter(Boolean).join("|") });
                                                    }}
                                                    placeholder={idx === 0 ? "Primary answer (required)" : `Alternative answer ${idx + 1} (optional)`}
                                                    required={idx === 0}
                                                />
                                                {idx > 0 && answers[idx] && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newAnswers = answers.filter((_, i) => i !== idx);
                                                            setFormData({ ...formData, correct_answer: newAnswers.filter(Boolean).join("|") });
                                                        }}
                                                        className="p-1 text-red-400 hover:text-red-300"
                                                    >
                                                        <Trash size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const current = formData.correct_answer || "";
                                            setFormData({ ...formData, correct_answer: current + "|" });
                                        }}
                                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1"
                                    >
                                        <Plus size={12} /> Add another acceptable answer
                                    </button>
                                </div>
                            )}

                            {formData.type === 'true_false' && (
                                <div className="space-y-2">
                                    <label className="block text-sm text-gray-600 dark:text-gray-400">Correct Answer</label>
                                    <div className="flex gap-4">
                                        <label className={`flex-1 p-4 rounded-xl border-2 cursor-pointer text-center font-medium transition-all ${
                                            formData.correct_answer === 'True'
                                                ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-green-300'
                                        }`}>
                                            <input type="radio" name="tf_answer" value="True" checked={formData.correct_answer === 'True'}
                                                onChange={() => setFormData({ ...formData, correct_answer: 'True' })} className="sr-only" />
                                            True
                                        </label>
                                        <label className={`flex-1 p-4 rounded-xl border-2 cursor-pointer text-center font-medium transition-all ${
                                            formData.correct_answer === 'False'
                                                ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                                                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-red-300'
                                        }`}>
                                            <input type="radio" name="tf_answer" value="False" checked={formData.correct_answer === 'False'}
                                                onChange={() => setFormData({ ...formData, correct_answer: 'False' })} className="sr-only" />
                                            False
                                        </label>
                                    </div>
                                </div>
                            )}

                            {formData.type !== 'mcq' && formData.type !== 'fillup' && formData.type !== 'true_false' && (
                                <div>
                                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Correct Answer / Key Points</label>
                                    <textarea
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white"
                                        value={formData.correct_answer}
                                        onChange={e => setFormData({ ...formData, correct_answer: e.target.value })}
                                        required
                                    />
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <button type="button" onClick={() => onClose(false)} className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300">Cancel</button>
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
                                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Subject <span className="text-red-500">*</span></label>
                                    {loadingCurriculum ? (
                                        <div className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 text-gray-500 flex items-center gap-2">
                                            <Loader2 size={14} className="animate-spin" /> Loading...
                                        </div>
                                    ) : (
                                        <select
                                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white"
                                            value={aiConfig.subject}
                                            onChange={e => setAiConfig({ ...aiConfig, subject: e.target.value, chapter: "", class_level: "" })}
                                        >
                                            <option value="">Select Subject</option>
                                            {(teacherGroupSubjects ?? (curriculumSubjectNames.length > 0 ? curriculumSubjectNames : subjectList)).map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Class <span className="text-red-400">*</span></label>
                                    <select
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white"
                                        value={aiConfig.class_level}
                                        onChange={e => setAiConfig({ ...aiConfig, class_level: parseInt(e.target.value), chapter: "" })}
                                    >
                                        <option value="">Select Class</option>
                                        {(getTeacherClassesForSubject(aiConfig.subject) ?? (curriculumClassLevels.length > 0 ? curriculumClassLevels : allAvailableClassLevels)).map(c => <option key={c} value={c}>Class {c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Chapter <span className="text-red-500">*</span></label>
                                    <select
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white"
                                        value={aiConfig.chapter}
                                        onChange={e => setAiConfig({ ...aiConfig, chapter: parseInt(e.target.value) || "" })}
                                    >
                                        <option value="">Select Chapter</option>
                                        {availableChapters.length > 0 ? (
                                            availableChapters.map(ch => (
                                                <option key={ch.chapter_number} value={ch.chapter_number}>
                                                    Ch {ch.chapter_number}: {ch.chapter_name}
                                                </option>
                                            ))
                                        ) : (
                                            <option disabled>Select subject & class first</option>
                                        )}
                                    </select>
                                </div>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-4 flex justify-between">
                                    <span>Question Distribution</span>
                                    <span className="text-blue-600 dark:text-blue-400 text-sm">Total: {getTotalAiQuestions()}</span>
                                </h3>

                                <div className="space-y-6">
                                    {['easy', 'medium', 'hard'].map(diff => (
                                        <div key={diff} className="space-y-2">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`w-2 h-2 rounded-full ${diff === 'easy' ? 'bg-green-500' :
                                                    diff === 'medium' ? 'bg-yellow-500' : 'bg-orange-500'
                                                    }`}></span>
                                                <span className="capitalize font-medium text-gray-700 dark:text-gray-300">{diff}</span>
                                            </div>
                                            <div className="grid grid-cols-5 gap-4">
                                                {['mcq', 'fillup', 'true_false', 'short_answer', 'long_answer'].map(type => (
                                                    <div key={type}>
                                                        <label className="text-xs text-gray-500 block mb-1 capitalize">{type.replace('_', ' ')}</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="20"
                                                            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-1 text-center text-gray-900 dark:text-white"
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

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <button onClick={() => onClose(false)} className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300">Cancel</button>
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
