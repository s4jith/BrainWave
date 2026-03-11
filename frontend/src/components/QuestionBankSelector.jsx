import { useState, useEffect } from "react";
import { Search, Plus, Check } from "lucide-react";
import useUserStore from "../stores/userStore";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const QuestionBankSelector = ({ onSelect, onClose, preSelectedIds = [], defaultClass = "", defaultSubject = "" }) => {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState(preSelectedIds);

    const [curriculumSubjects, setCurriculumSubjects] = useState([]);
    const [loadingCurriculum, setLoadingCurriculum] = useState(true);

    const [filters, setFilters] = useState({
        subject: defaultSubject || "",
        class_level: defaultClass ? String(defaultClass) : "",
        type: "",
        difficulty: "",
        search: ""
    });

    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        pages: 1
    });

    useEffect(() => {
        const fetchCurriculum = async () => {
            setLoadingCurriculum(true);
            try {
                const response = await fetch(`${API_URL}/api/curriculum/subjects?is_active=true`);
                if (response.ok) {
                    const data = await response.json();
                    setCurriculumSubjects(Array.isArray(data) ? data : []);
                }
            } catch (err) {
            } finally {
                setLoadingCurriculum(false);
            }
        };
        fetchCurriculum();
    }, []);

    const subjectNames = [...new Set(curriculumSubjects.map(s => s.subject_name))].sort();
    const classLevels = [...new Set(curriculumSubjects.map(s => s.class_level))].sort((a, b) => a - b);

    const fetchQuestions = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                limit: pagination.limit,
                offset: (pagination.page - 1) * pagination.limit,
                ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))
            });

            const response = await fetch(`${API_URL}/api/question-bank/questions?${queryParams}`, {
                headers: {
                    "Authorization": `Bearer ${useUserStore.getState().accessToken}`
                }
            });

            if (!response.ok) throw new Error("Failed to fetch questions");

            const data = await response.json();
            setQuestions(data.questions);
            setPagination(prev => ({ ...prev, total: data.total, pages: data.pages }));
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuestions();
    }, [pagination.page, filters]);

    const handleToggle = (question) => {
        setSelectedIds(prev =>
            prev.includes(question.id)
                ? prev.filter(id => id !== question.id)
                : [...prev, question.id]
        );
    };

    const handleAddSelected = () => {
        
        const selectedObjects = questions.filter(q => selectedIds.includes(q.id));
        onSelect(selectedObjects);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-xl w-full max-w-4xl h-[80vh] flex flex-col border border-gray-700 shadow-2xl">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Select Questions from Bank</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">Close</button>
                </div>

                <div className="p-4 bg-gray-900 border-b border-gray-700 grid grid-cols-4 gap-2">
                    <div className="relative col-span-4 md:col-span-1">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search..."
                            className="w-full bg-gray-800 border border-gray-700 rounded pl-9 pr-2 py-2 text-sm focus:outline-none focus:border-blue-500 text-white"
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                        />
                    </div>
                    {defaultSubject ? (
                        <div className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white flex items-center gap-1">
                            <span className="text-gray-400 text-xs">Subject:</span>
                            <span className="font-medium">{defaultSubject}</span>
                        </div>
                    ) : (
                        <select
                            className="bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm text-gray-300"
                            value={filters.subject}
                            onChange={(e) => setFilters({ ...filters, subject: e.target.value })}
                        >
                            <option value="">Subject</option>
                            {loadingCurriculum ? (
                                <option disabled>Loading...</option>
                            ) : (
                                subjectNames.map(s => <option key={s} value={s}>{s}</option>)
                            )}
                        </select>
                    )}
                    {defaultClass ? (
                        <div className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white flex items-center gap-1">
                            <span className="text-gray-400 text-xs">Class:</span>
                            <span className="font-medium">{defaultClass}</span>
                        </div>
                    ) : (
                        <select
                            className="bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm text-gray-300"
                            value={filters.class_level}
                            onChange={(e) => setFilters({ ...filters, class_level: e.target.value })}
                        >
                            <option value="">Class</option>
                            {classLevels.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    )}
                    <select
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm text-gray-300"
                        value={filters.type}
                        onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                    >
                        <option value="">Type</option>
                        <option value="mcq">MCQ</option>
                        <option value="fillup">Fill-up</option>
                        <option value="short_answer">Short</option>
                        <option value="long_answer">Long</option>
                    </select>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="text-center text-gray-400 mt-10">Loading...</div>
                    ) : (
                        <div className="space-y-2">
                            {questions.map(q => {
                                const isSelected = selectedIds.includes(q.id);
                                return (
                                    <div
                                        key={q.id}
                                        className={`p-3 rounded border cursor-pointer hover:bg-gray-700/50 transition-colors flex gap-3 ${isSelected ? 'bg-blue-900/20 border-blue-500' : 'bg-gray-800 border-gray-700'}`}
                                        onClick={() => handleToggle(q)}
                                    >
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center mt-1 flex-shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-500'}`}>
                                            {isSelected && <Check size={12} className="text-white" />}
                                        </div>
                                        <div>
                                            <div className="flex gap-2 mb-1">
                                                <span className="text-xs bg-gray-700 text-gray-300 px-1.5 rounded">{q.type}</span>
                                                <span className="text-xs bg-gray-700 text-gray-300 px-1.5 rounded">{q.difficulty}</span>
                                                <span className="text-xs bg-gray-700 text-gray-300 px-1.5 rounded">{q.marks}m</span>
                                            </div>
                                            <p className="text-sm text-gray-200">{q.text}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-700 flex justify-between items-center bg-gray-800">
                    <div className="text-sm text-gray-400">
                        {selectedIds.length} questions selected
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                            disabled={pagination.page === 1}
                            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 text-sm text-white"
                        >
                            Prev
                        </button>
                        <span className="text-gray-300 self-center text-sm">{pagination.page} / {pagination.pages}</span>
                        <button
                            onClick={() => setPagination(p => ({ ...p, page: Math.min(pagination.pages, p.page + 1) }))}
                            disabled={pagination.page === pagination.pages}
                            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 text-sm text-white"
                        >
                            Next
                        </button>
                        <div className="w-4"></div>
                        <button
                            onClick={handleAddSelected}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium flex items-center gap-2"
                        >
                            <Plus size={16} /> Add Selected
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuestionBankSelector;
