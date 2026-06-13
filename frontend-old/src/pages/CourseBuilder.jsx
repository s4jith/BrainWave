
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft,
    Plus,
    Trash2,
    GripVertical,
    Save,
    Eye,
    Video,
    FileText,
    BookOpen,
    HelpCircle,
    ChevronDown,
    ChevronUp,
    Send
} from "lucide-react";
import useUserStore from "../stores/userStore";
import useCourseStore from "../stores/courseStore";

const DIFFICULTY_OPTIONS = [
    { value: "beginner", label: "Beginner" },
    { value: "intermediate", label: "Intermediate" },
    { value: "advanced", label: "Advanced" }
];

const CLASS_OPTIONS = Array.from({ length: 8 }, (_, i) => ({
    value: i + 5,
    label: `Class ${i + 5}`
}));

const CONTENT_TYPES = [
    { value: "video", label: "Video", icon: Video },
    { value: "pdf", label: "PDF/Document", icon: FileText },
    { value: "text", label: "Text Content", icon: BookOpen },
    { value: "quiz", label: "Quiz", icon: HelpCircle }
];

export default function CourseBuilder() {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const { user } = useUserStore();
    const {
        currentCourse,
        categories,
        fetchCourseDetails,
        createCourse,
        updateCourse,
        publishCourse,
        addModule,
        addContent,
        fetchCategories,
        clearCurrentCourse,
        loading
    } = useCourseStore();

    const isEditing = Boolean(courseId);

    const [step, setStep] = useState(1);
    const [courseData, setCourseData] = useState({
        title: "",
        description: "",
        category: "Maths",
        difficulty: "beginner",
        class_level: 10,
        thumbnail_url: ""
    });

    const [modules, setModules] = useState([]);
    const [expandedModules, setExpandedModules] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchCategories();

        if (isEditing) {
            fetchCourseDetails(courseId);
        }

        return () => clearCurrentCourse();
    }, [courseId]);

    useEffect(() => {
        if (isEditing && currentCourse) {
            setCourseData({
                title: currentCourse.title,
                description: currentCourse.description,
                category: currentCourse.category,
                difficulty: currentCourse.difficulty,
                class_level: currentCourse.class_level,
                thumbnail_url: currentCourse.thumbnail_url || ""
            });
            setModules(currentCourse.modules || []);
        }
    }, [currentCourse, isEditing]);

    const handleCourseChange = (field, value) => {
        setCourseData(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveCourse = async () => {
        setSaving(true);
        setError(null);

        try {
            let course;

            if (isEditing) {
                course = await updateCourse(courseId, courseData);
            } else {
                course = await createCourse(courseData);
                if (course) {
                    navigate(`/course-builder/${course.id}`, { replace: true });
                }
            }

            if (course) {
                setStep(2);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleAddModule = async () => {
        const newModule = {
            title: `Module ${modules.length + 1}`,
            description: "",
            content_items: []
        };

        if (isEditing) {
            const module = await addModule(courseId, newModule);
            if (module) {
                setModules(prev => [...prev, module]);
                setExpandedModules(prev => ({ ...prev, [module.id]: true }));
            }
        } else {
            const tempId = `temp-${Date.now()}`;
            setModules(prev => [...prev, { ...newModule, id: tempId }]);
            setExpandedModules(prev => ({ ...prev, [tempId]: true }));
        }
    };

    const handleModuleChange = (moduleId, field, value) => {
        setModules(prev => prev.map(m =>
            m.id === moduleId ? { ...m, [field]: value } : m
        ));
    };

    const handleAddContent = async (moduleId) => {
        const newContent = {
            type: "text",
            title: "New Content",
            description: "",
            content: "",
            url: "",
            duration_minutes: 0
        };

        if (isEditing) {
            const content = await addContent(courseId, moduleId, newContent);
            if (content) {
                setModules(prev => prev.map(m =>
                    m.id === moduleId
                        ? { ...m, content_items: [...(m.content_items || []), content] }
                        : m
                ));
            }
        } else {
            const tempId = `temp-content-${Date.now()}`;
            setModules(prev => prev.map(m =>
                m.id === moduleId
                    ? { ...m, content_items: [...(m.content_items || []), { ...newContent, id: tempId }] }
                    : m
            ));
        }
    };

    const handleContentChange = (moduleId, contentId, field, value) => {
        setModules(prev => prev.map(m =>
            m.id === moduleId
                ? {
                    ...m,
                    content_items: (m.content_items || []).map(c =>
                        c.id === contentId ? { ...c, [field]: value } : c
                    )
                }
                : m
        ));
    };

    const handlePublish = async () => {
        if (!isEditing) return;

        setSaving(true);
        try {
            await publishCourse(courseId);
            navigate("/teacher-dashboard");
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleModule = (moduleId) => {
        setExpandedModules(prev => ({
            ...prev,
            [moduleId]: !prev[moduleId]
        }));
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {}
            <header className="bg-gray-800/50 border-b border-gray-700 px-6 py-4 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="text-xl font-bold">
                            {isEditing ? "Edit Course" : "Create New Course"}
                        </h1>
                    </div>

                    <div className="flex gap-2">
                        {isEditing && currentCourse?.status === "draft" && (
                            <button
                                onClick={handlePublish}
                                disabled={saving}
                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <Send size={16} />
                                Publish
                            </button>
                        )}
                        <button
                            onClick={() => navigate(`/courses/${courseId}`)}
                            disabled={!isEditing}
                            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <Eye size={16} />
                            Preview
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-8">
                {/* Step Indicator */}
                <div className="flex items-center gap-4 mb-8">
                    <StepIndicator number={1} active={step === 1} completed={step > 1} label="Course Details" />
                    <div className="flex-1 h-px bg-gray-700" />
                    <StepIndicator number={2} active={step === 2} completed={step > 2} label="Modules & Content" />
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 text-red-400">
                        {error}
                    </div>
                )}

                {/* Step 1: Course Details */}
                {step === 1 && (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium mb-2">Course Title *</label>
                            <input
                                type="text"
                                value={courseData.title}
                                onChange={(e) => handleCourseChange("title", e.target.value)}
                                placeholder="e.g., Introduction to Algebra"
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Description *</label>
                            <textarea
                                value={courseData.description}
                                onChange={(e) => handleCourseChange("description", e.target.value)}
                                placeholder="Describe what students will learn..."
                                rows={4}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none resize-none"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Category</label>
                                <select
                                    value={courseData.category}
                                    onChange={(e) => handleCourseChange("category", e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none"
                                >
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Class Level</label>
                                <select
                                    value={courseData.class_level}
                                    onChange={(e) => handleCourseChange("class_level", parseInt(e.target.value))}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none"
                                >
                                    {CLASS_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Difficulty</label>
                                <select
                                    value={courseData.difficulty}
                                    onChange={(e) => handleCourseChange("difficulty", e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none"
                                >
                                    {DIFFICULTY_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Thumbnail URL (optional)</label>
                            <input
                                type="url"
                                value={courseData.thumbnail_url}
                                onChange={(e) => handleCourseChange("thumbnail_url", e.target.value)}
                                placeholder="https://..."
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <button
                                onClick={() => navigate(-1)}
                                className="px-6 py-3 rounded-lg border border-gray-600 hover:bg-gray-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveCourse}
                                disabled={!courseData.title || !courseData.description || saving}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? "Saving..." : (
                                    <>
                                        <Save size={18} />
                                        {isEditing ? "Save & Continue" : "Create Course"}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: Modules & Content */}
                {step === 2 && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">Course Modules</h2>
                                <p className="text-sm text-gray-400">Add modules and content to your course</p>
                            </div>
                            <button
                                onClick={handleAddModule}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
                            >
                                <Plus size={18} />
                                Add Module
                            </button>
                        </div>

                        {modules.length === 0 ? (
                            <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center">
                                <BookOpen size={48} className="mx-auto text-gray-600 mb-4" />
                                <h3 className="text-lg font-medium mb-2">No modules yet</h3>
                                <p className="text-gray-400 mb-4">Add your first module to start building your course</p>
                                <button
                                    onClick={handleAddModule}
                                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
                                >
                                    Add Module
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {modules.map((module, idx) => (
                                    <ModuleCard
                                        key={module.id}
                                        module={module}
                                        index={idx}
                                        expanded={expandedModules[module.id]}
                                        onToggle={() => toggleModule(module.id)}
                                        onChange={(field, value) => handleModuleChange(module.id, field, value)}
                                        onAddContent={() => handleAddContent(module.id)}
                                        onContentChange={(contentId, field, value) =>
                                            handleContentChange(module.id, contentId, field, value)
                                        }
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

function ModuleCard({ module, index, expanded, onToggle, onChange, onAddContent, onContentChange }) {
    return (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            {/* Module Header */}
            <div
                className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-gray-700/50"
                onClick={onToggle}
            >
                <GripVertical size={18} className="text-gray-500" />
                <div className="flex-1">
                    <input
                        type="text"
                        value={module.title}
                        onChange={(e) => {
                            e.stopPropagation();
                            onChange("title", e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-transparent font-medium w-full focus:outline-none"
                        placeholder="Module title"
                    />
                </div>
                <span className="text-sm text-gray-400">
                    {(module.content_items || []).length} items
                </span>
                {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>

            {/* Module Content */}
            {expanded && (
                <div className="border-t border-gray-700 p-4">
                    <div className="mb-4">
                        <textarea
                            value={module.description || ""}
                            onChange={(e) => onChange("description", e.target.value)}
                            placeholder="Module description (optional)"
                            rows={2}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                        />
                    </div>

                    {/* Content Items */}
                    <div className="space-y-3">
                        {(module.content_items || []).map((content, idx) => (
                            <ContentItemEditor
                                key={content.id}
                                content={content}
                                onChange={(field, value) => onContentChange(content.id, field, value)}
                            />
                        ))}
                    </div>

                    <button
                        onClick={onAddContent}
                        className="mt-4 flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
                    >
                        <Plus size={16} />
                        Add Content
                    </button>
                </div>
            )}
        </div>
    );
}

function ContentItemEditor({ content, onChange }) {
    const ContentIcon = CONTENT_TYPES.find(t => t.value === content.type)?.icon || FileText;

    return (
        <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-3">
            <div className="flex items-center gap-3 mb-2">
                <ContentIcon size={16} className="text-gray-400" />
                <select
                    value={content.type}
                    onChange={(e) => onChange("type", e.target.value)}
                    className="bg-gray-600 border-none rounded px-2 py-1 text-sm focus:outline-none"
                >
                    {CONTENT_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                </select>
                <input
                    type="text"
                    value={content.title}
                    onChange={(e) => onChange("title", e.target.value)}
                    placeholder="Content title"
                    className="flex-1 bg-transparent text-sm focus:outline-none"
                />
            </div>

            {content.type === "text" && (
                <textarea
                    value={content.content || ""}
                    onChange={(e) => onChange("content", e.target.value)}
                    placeholder="Enter content text..."
                    rows={3}
                    className="w-full bg-gray-600 border-none rounded px-3 py-2 text-sm focus:outline-none resize-none"
                />
            )}

            {(content.type === "video" || content.type === "pdf") && (
                <input
                    type="url"
                    value={content.url || ""}
                    onChange={(e) => onChange("url", e.target.value)}
                    placeholder="Enter URL..."
                    className="w-full bg-gray-600 border-none rounded px-3 py-2 text-sm focus:outline-none"
                />
            )}
        </div>
    );
}
