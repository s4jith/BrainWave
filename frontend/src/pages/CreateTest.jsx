/**
 * CreateTest - Page to create new tests/assessments
 * Uses AdminLayout with light/dark theme support
 * Matches reference design with tabs, date range, and student assignment
 */

import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import { ClipboardList, Calendar, Clock, Users, CheckCircle, XCircle, Plus, ChevronRight, FileText, AlertCircle, X, Trash2, Edit2, Search } from "lucide-react";
import QuestionBankSelector from "../components/QuestionBankSelector";
import { parseCombinedValue, parseGroupName } from "../constants/academicConstants";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function CreateTest() {
  const navigate = useNavigate();
  const { testId } = useParams();
  const isEditMode = !!testId;

  console.log("CreateTest Debug:", { testId, isEditMode });

  const { user, getAuthHeader } = useUserStore();
  const [activeTab, setActiveTab] = useState("details");
  const [loading, setLoading] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    title: "",
    class_level: 10,  // Default class
    subject: "",
    startDate: "",
    endDate: "",
    startTime: "09:00",
    endTime: "12:00",
    duration_minutes: 60,
    num_attempts: 1,
    show_results: false,
    description: "",
    evaluation_type: "manual" // "ai" or "manual"
  });

  // Groups and Students
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [mainFormCurriculumSubjects, setMainFormCurriculumSubjects] = useState([]); // Curriculum subjects for main form
  const [loadingMainFormCurriculum, setLoadingMainFormCurriculum] = useState(true);

  // Generate combined options from user's groups or curriculum subjects
  const combinedOptions = React.useMemo(() => {
    // If groups exist (teacher with assigned groups), use them
    if (groups && groups.length > 0) {
      return groups.map(group => ({
        value: group.name,  // Use group name as value
        label: group.name,  // Display group name
        class: group.class_level,
        subject: group.subject
      })).sort((a, b) => {
        if (a.class !== b.class) return a.class - b.class;
        return a.subject.localeCompare(b.subject);
      });
    }
    
    // Otherwise use curriculum subjects from database
    return mainFormCurriculumSubjects.map(subj => ({
      value: `${subj.class_level}-${subj.subject_name}`,
      label: `Class ${subj.class_level} - ${subj.subject_name}`,
      class: subj.class_level,
      subject: subj.subject_name
    })).sort((a, b) => {
      if (a.class !== b.class) return a.class - b.class;
      return a.subject.localeCompare(b.subject);
    });
  }, [groups, mainFormCurriculumSubjects]);

  // Helper to find group name from class and subject
  const getGroupNameValue = React.useCallback((classLevel, subject) => {
    if (!classLevel || !subject) return '';
    const matchingOption = combinedOptions.find(opt => opt.class === classLevel && opt.subject === subject);
    return matchingOption ? matchingOption.value : '';
  }, [combinedOptions]);

  // Filter groups by class and subject
  const filteredGroups = React.useMemo(() => {
    if (!formData.class_level) return groups;
    
    return groups.filter(g => {
      const matchesClass = g.class_level === formData.class_level;
      const matchesSubject = !formData.subject || g.subject === formData.subject;
      return matchesClass && matchesSubject;
    });
  }, [groups, formData.class_level, formData.subject]);

  // Get unique students from filtered groups
  const groupStudents = React.useMemo(() => {
    const studentMap = new Map();
    filteredGroups.forEach(group => {
      // Add students from the students array if available
      if (group.students && Array.isArray(group.students)) {
        group.students.forEach(student => {
          if (student.id && !studentMap.has(student.id)) {
            studentMap.set(student.id, student);
          }
        });
      }
    });
    return Array.from(studentMap.values());
  }, [filteredGroups]);

  // Combine group students with individually fetched students
  const displayedStudents = React.useMemo(() => {
    const studentMap = new Map();
    
    // Add group students first
    groupStudents.forEach(s => studentMap.set(s.id, s));
    
    // Add fetched students (they might overlap, which is fine)
    students.forEach(s => studentMap.set(s.id, s));
    
    return Array.from(studentMap.values());
  }, [groupStudents, students]);

  // Questions (for tab 2)
  const [questions, setQuestions] = useState([]);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showBankSelector, setShowBankSelector] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [questionForm, setQuestionForm] = useState({
    class_level: 10,
    subject: "",
    marks: 1,
    type: "mcq", // mcq, mcq_multi, fillup, subjective
    text: "",
    options: ["", "", "", ""],
    correct_answer: 0,       // single MCQ: index of correct option
    correct_answers: [],     // multi-select MCQ: array of correct option indices
    fillup_answers: "",      // fill-up: comma-separated accepted answers
    answer_text: ""          // subjective (2/5 mark): model answer text
  });
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [testSubjects, setTestSubjects] = useState([]);  // For Test Details tab

  // Curriculum data for question modal
  const [curriculumSubjects, setCurriculumSubjects] = useState([]);
  const [questionCurrSubject, setQuestionCurrSubject] = useState(null); // full subject detail
  const [loadingCurriculum, setLoadingCurriculum] = useState(true);
  const [loadingCurrDetail, setLoadingCurrDetail] = useState(false);

  useEffect(() => {
    fetchGroupsAndStudents();
    fetchCurriculumSubjects();
    fetchMainFormCurriculumSubjects();
    if (isEditMode) {
      fetchTestDetails();
    } else {
      // In create mode, fetch subjects for the default class
      fetchTestSubjectsForClass(formData.class_level, false);
    }
  }, [testId]);

  const fetchCurriculumSubjects = async () => {
    setLoadingCurriculum(true);
    try {
      const response = await fetch(`${API_URL}/api/curriculum/subjects?is_active=true`);
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

  const fetchMainFormCurriculumSubjects = async () => {
    setLoadingMainFormCurriculum(true);
    try {
      const response = await fetch(`${API_URL}/api/curriculum/subjects?is_active=true`, {
        headers: getAuthHeader()
      });
      if (response.ok) {
        const data = await response.json();
        setMainFormCurriculumSubjects(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching curriculum subjects for main form:", error);
    } finally {
      setLoadingMainFormCurriculum(false);
    }
  };

  // Fetch curriculum subject details when question modal subject/class changes
  useEffect(() => {
    if (!showQuestionModal || !questionForm.subject || !questionForm.class_level) {
      setQuestionCurrSubject(null);
      return;
    }
    
    const subjectId = `${questionForm.subject.toLowerCase().replace(/\s+/g, '_')}_${questionForm.class_level}`;
    const fetchDetail = async () => {
      setLoadingCurrDetail(true);
      try {
        const response = await fetch(`${API_URL}/api/curriculum/subjects/${subjectId}`);
        if (response.ok) {
          const data = await response.json();
          setQuestionCurrSubject(data);
        } else {
          setQuestionCurrSubject(null);
        }
      } catch (err) {
        setQuestionCurrSubject(null);
      } finally {
        setLoadingCurrDetail(false);
      }
    };
    fetchDetail();
  }, [showQuestionModal, questionForm.subject, questionForm.class_level]);

  // Derived: chapters and topics for question modal
  const questionChapters = questionCurrSubject?.chapters?.filter(ch => ch.is_active !== false) || [];
  const questionSelectedChapter = questionChapters.find(ch => ch.chapter_number === questionForm.chapter);
  const questionTopics = questionSelectedChapter?.topics?.filter(t => t.is_active !== false) || [];

  // Unique curriculum subject names and class levels
  const currSubjectNames = [...new Set(curriculumSubjects.map(s => s.subject_name))].sort();
  const currClassLevels = [...new Set(
    curriculumSubjects
      .filter(s => s.subject_name === questionForm.subject)
      .map(s => s.class_level)
  )].sort((a, b) => a - b);
  // All available class levels from curriculum (not subject-specific)
  const allAvailableClassLevels = [...new Set(curriculumSubjects.map(s => s.class_level))].sort((a, b) => a - b);

  const fetchTestDetails = async () => {
    console.log("Fetching details for:", testId);
    setFetchingDetails(true);
    try {
      const response = await fetch(`${API_URL}/api/assessments/${testId}`, {
        headers: getAuthHeader()
      });
      if (!response.ok) throw new Error("Failed to load test details");

      const data = await response.json();

      // Parse dates
      let startDate = "", startTime = "09:00", endDate = "", endTime = "12:00";
      if (data.start_datetime) {
        const start = new Date(data.start_datetime);
        startDate = start.toISOString().split('T')[0];
        startTime = start.toTimeString().slice(0, 5);
      }
      if (data.end_datetime) {
        const end = new Date(data.end_datetime);
        endDate = end.toISOString().split('T')[0];
        endTime = end.toTimeString().slice(0, 5);
      }

      setFormData({
        title: data.title,
        class_level: data.class_level || 10,
        subject: data.subject,
        startDate,
        endDate,
        startTime,
        endTime,
        duration_minutes: data.duration_minutes || 60,
        num_attempts: data.num_attempts || 1,
        show_results: data.show_results_immediately || false,
        description: data.description || "",
        evaluation_type: data.evaluation_type || "manual"
      });

      // Transform backend questions to frontend format (options as strings, correct_answer as index)
      const formattedQuestions = (data.questions || []).map(q => {
        // Handle options: extract text from objects
        const optionsText = Array.isArray(q.options)
          ? q.options.map(opt => (typeof opt === 'object' ? (opt.text || "") : opt))
          : [];

        // Handle correct answer: find index of correct option
        let correctIndex = 0;
        let correctIndices = [];
        if (Array.isArray(q.options) && q.options.length > 0 && typeof q.options[0] === 'object') {
          const foundIndex = q.options.findIndex(opt => opt.is_correct);
          if (foundIndex !== -1) correctIndex = foundIndex;
          // Multi-select: find all correct indices
          correctIndices = q.options.map((opt, idx) => opt.is_correct ? idx : -1).filter(i => i >= 0);
        } else if (q.correct_answer !== undefined) {
          correctIndex = parseInt(q.correct_answer) || 0;
        }

        return {
          ...q,
          text: q.question_text || q.text || "",
          options: optionsText,
          correct_answer: correctIndex,
          correct_answers: correctIndices.length > 1 ? correctIndices : (q.correct_answers || []),
          fillup_answers: q.fillup_answers || "",
          answer_text: q.answer_text || "",
          marks: q.points || q.marks || 1
        };
      });

      setQuestions(formattedQuestions);
      setSelectedStudents(data.student_ids || []);
      setSelectedGroups(data.group_ids || []); // Restore selected groups

      // Fetch subjects for this class to ensure subject dropdown is populated correctly
      fetchTestSubjectsForClass(data.class_level || 10, false);

      // Always fetch students for this class in edit mode
      fetchStudentsForClass(data.class_level || 10, false);

    } catch (err) {
      console.error(err);
      setError("Failed to load test details");
    } finally {
      setFetchingDetails(false);
    }
  };

  // Removed useEffect for formData.class_level to avoid race condition with fetchTestDetails

  // Fetch subjects when class changes in question modal
  useEffect(() => {
    if (showQuestionModal && questionForm.class_level) {
      fetchSubjectsForClass(questionForm.class_level);
    }
  }, [showQuestionModal, questionForm.class_level]);

  const fetchSubjectsForClass = async (classLevel) => {
    setLoadingSubjects(true);
    try {
      const response = await fetch(`${API_URL}/api/test/subjects/${classLevel}`);
      if (response.ok) {
        const data = await response.json();
        const subjects = data.map(s => typeof s === 'string' ? s : (s.subject || s.name || s.value));
        setAvailableSubjects(subjects);
        if (!questionForm.subject || !subjects.includes(questionForm.subject)) {
          setQuestionForm(prev => ({ ...prev, subject: subjects[0] || "" }));
        }
      } else {
        setAvailableSubjects(currSubjectNames);
      }
    } catch (err) {
      console.error("Failed to fetch subjects:", err);
      setAvailableSubjects(currSubjectNames);
    } finally {
      setLoadingSubjects(false);
    }
  };

  // Fetch subjects for Test Details tab based on class
  const fetchTestSubjectsForClass = async (classLevel, resetSubject = true) => {
    try {
      const response = await fetch(`${API_URL}/api/test/subjects/${classLevel}`);
      if (response.ok) {
        const data = await response.json();
        const subjects = data.map(s => typeof s === 'string' ? s : (s.subject || s.name || s.value));
        setTestSubjects(subjects);
        if (resetSubject) {
          if (subjects.length === 1) {
            setFormData(prev => ({ ...prev, subject: subjects[0] }));
          } else {
            setFormData(prev => {
              if (!subjects.includes(prev.subject)) {
                return { ...prev, subject: "" };
              }
              return prev;
            });
          }
        }
      } else {
        setTestSubjects([]);
      }
    } catch (err) {
      console.error("Failed to fetch test subjects:", err);
      setTestSubjects([]);
    }
  };

  const fetchGroupsAndStudents = async () => {
    setLoadingGroups(true);
    try {
      const groupsRes = await fetch(`${API_URL}/api/admin/groups`, { headers: getAuthHeader() });
      if (groupsRes.ok) {
        const data = await groupsRes.json();
        setGroups(data.groups || []);
      }

      // Fetch students for default class (10) only if not edit mode (edit mode fetches its own class)
      if (!isEditMode) {
        await fetchStudentsForClass(formData.class_level);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoadingGroups(false);
    }
  };

  // Fetch students filtered by class
  const fetchStudentsForClass = async (classLevel, clearSelection = true) => {
    if (!classLevel) return; // Prevent API call if class_level is undefined/null
    try {
      const studentsRes = await fetch(`${API_URL}/api/admin/students?limit=200&class_level=${classLevel}`);
      if (studentsRes.ok) {
        const data = await studentsRes.json();
        setStudents(data || []);
        if (clearSelection) {
          setSelectedStudents([]);
        }
      }
    } catch (err) {
      console.error("Error fetching students:", err);
    }
  };



  const handleGroupToggle = (groupId) => {
    const group = groups.find(g => g.id === groupId);
    console.log('Group toggled:', group);
    console.log('Group student_ids:', group?.student_ids);
    console.log('Group students:', group?.students);
    
    if (selectedGroups.includes(groupId)) {
      setSelectedGroups(prev => prev.filter(id => id !== groupId));
      // Remove students from this group - try both student_ids and students array
      const studentIdsToRemove = group?.student_ids || group?.students?.map(s => s.id) || [];
      if (studentIdsToRemove.length > 0) {
        setSelectedStudents(prev => prev.filter(id => !studentIdsToRemove.includes(id)));
      }
    } else {
      setSelectedGroups(prev => [...prev, groupId]);
      // Add students from this group - try both student_ids and students array
      const studentIdsToAdd = group?.student_ids || group?.students?.map(s => s.id) || [];
      console.log('Adding student IDs:', studentIdsToAdd);
      if (studentIdsToAdd.length > 0) {
        setSelectedStudents(prev => {
          const newSelected = [...new Set([...prev, ...studentIdsToAdd])];
          console.log('New selected students:', newSelected);
          return newSelected;
        });
      }
    }
  };

  const handleStudentToggle = (studentId) => {
    setSelectedStudents(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const selectAllGroups = () => {
    const allGroupIds = filteredGroups.map(g => g.id);
    setSelectedGroups(allGroupIds);
    // Add all students from all filtered groups
    const allStudentIds = filteredGroups.flatMap(g => g.student_ids || []);
    setSelectedStudents([...new Set(allStudentIds)]);
  };

  const clearAllGroups = () => {
    setSelectedGroups([]);
  };

  const selectAllStudents = () => {
    setSelectedStudents(displayedStudents.map(s => s.id));
  };

  const clearAllStudents = () => {
    setSelectedStudents([]);
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      // In production, this would save to backend
      await new Promise(r => setTimeout(r, 500));
      setSuccess("Draft saved successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError("Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!formData.title.trim()) {
      setError("Please enter a test title");
      return;
    }
    if (!formData.subject) {
      setError("Please select a subject");
      return;
    }
    if (selectedStudents.length === 0) {
      setError("Please select at least one student");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Combine date and time
      const startDateTime = formData.startDate && formData.startTime
        ? `${formData.startDate}T${formData.startTime}:00`
        : null;
      const endDateTime = formData.endDate && formData.endTime
        ? `${formData.endDate}T${formData.endTime}:00`
        : null;

      const payload = {
        title: formData.title,
        description: formData.description,
        subject: formData.subject,
        class_level: formData.class_level,
        duration_minutes: formData.duration_minutes,
        num_attempts: formData.num_attempts,
        show_results_immediately: formData.show_results,
        start_datetime: startDateTime,
        end_datetime: endDateTime,
        student_ids: selectedStudents,
        group_ids: selectedGroups, // Include selected group IDs
        questions: questions,
        created_by: user?.user_id || "admin",
        evaluation_type: formData.evaluation_type
      };

      const url = isEditMode
        ? `${API_URL}/api/assessments/${testId}`
        : `${API_URL}/api/assessments`;

      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const err = await response.json();
        const detail = err.detail;
        const msg = typeof detail === 'string' ? detail
          : Array.isArray(detail) ? detail.map(e => e.msg || JSON.stringify(e)).join(', ')
            : `Failed to ${isEditMode ? 'update' : 'create'} test`;
        throw new Error(msg);
      }

      setSuccess(`Test ${isEditMode ? 'updated' : 'created'} and published successfully!`);
      setTimeout(() => navigate("/test-management"), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Question Modal Functions
  const openAddQuestion = () => {
    // Auto-populate subject and class from test details
    setQuestionForm({
      class_level: formData.class_level || 10,
      subject: formData.subject || "",
      chapter: "",
      chapter_name: "",
      topic: "",
      marks: 1,
      type: "mcq",
      text: "",
      options: ["", "", "", ""],
      correct_answer: 0,
      correct_answers: [],
      fillup_answers: "",
      answer_text: ""
    });
    setEditingIndex(null);
    setShowQuestionModal(true);
  };

  // Check if test details are complete before allowing questions
  const isTestDetailsComplete = formData.title?.trim() && formData.subject && formData.class_level && formData.startDate;

  const handleSaveQuestion = () => {
    if (!questionForm.text.trim()) {
      setError("Please enter question text");
      return;
    }
    if (questionForm.type === "mcq" && questionForm.options.some(o => !o.trim())) {
      setError("Please fill all MCQ options");
      return;
    }
    // Validate answer fields when AI evaluation is enabled
    if (formData.evaluation_type === "ai") {
      if (questionForm.type === "mcq" && (!questionForm.correct_answers || questionForm.correct_answers.length === 0)) {
        setError("Please select at least one correct answer for MCQ");
        return;
      }
      if (questionForm.type === "fillup" && !questionForm.fillup_answers?.trim()) {
        setError("Please enter the correct answer(s) for fill in the blank");
        return;
      }
      if (questionForm.type === "subjective" && !questionForm.answer_text?.trim()) {
        setError("Please enter the model answer for subjective question");
        return;
      }
    }

    const newQuestion = {
      ...questionForm,
      id: editingIndex !== null ? questions[editingIndex].id : Date.now()
    };

    if (editingIndex !== null) {
      setQuestions(prev => prev.map((q, i) => i === editingIndex ? newQuestion : q));
    } else {
      setQuestions(prev => [...prev, newQuestion]);
    }

    setShowQuestionModal(false);
    setError(null);
  };

  const editQuestion = (index) => {
    setQuestionForm(questions[index]);
    setEditingIndex(index);
    setShowQuestionModal(true);
  };

  const deleteQuestion = (index) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const handleMarksChange = (marks) => {
    // For 1 mark: allow mcq or fillup
    // For 2+ marks: force subjective
    const type = marks === 1 ? (questionForm.type === 'fillup' ? 'fillup' : 'mcq') : 'subjective';
    setQuestionForm(prev => ({ ...prev, marks, type }));
  };

  const handleAddFromBank = (selectedQuestions) => {
    const newQuestions = selectedQuestions.map(q => ({
      ...q,
      id: q.id,
      is_bank_question: true
    }));

    const existingIds = questions.map(q => q.id);
    const uniqueNew = newQuestions.filter(q => !existingIds.includes(q.id));

    setQuestions(prev => [...prev, ...uniqueNew]);
  };

  return (
    <AdminLayout title={isEditMode ? "Update Test" : "Create Test"} icon={ClipboardList}>
      {/* Header Actions */}
      <div className="flex justify-end gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
        >
          Cancel
        </button>
        <button
          onClick={handleSaveDraft}
          disabled={saving}
          className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
        >
          {saving ? "Saving..." : "Save as Draft"}
        </button>
        <button
          onClick={handlePublish}
          disabled={loading}
          className="px-5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition font-medium disabled:opacity-50"
        >
          {loading ? "Processing..." : isEditMode ? "Update & Publish" : "Create & Publish"}
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          <p className="text-green-700 dark:text-green-300">{success}</p>
        </div>
      )}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab("details")}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition ${activeTab === "details"
              ? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
          >
            Test Details
          </button>
          <button
            onClick={() => setActiveTab("questions")}
            disabled={!isTestDetailsComplete}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition ${activeTab === "questions"
              ? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              } ${!isTestDetailsComplete ? "opacity-50 cursor-not-allowed" : ""}`}
            title={!isTestDetailsComplete ? "Please fill in test details (title, subject, class, start date) first" : ""}
          >
            Questions
          </button>
        </div>
      </div>

      {/* Test Details Tab */}
      {activeTab === "details" && (
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-6">Basic Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Test Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Test Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Midterm Exam - Mathematics"
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 focus:outline-none"
                />
              </div>

              {/* Class & Subject Combined */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Class & Subject <span className="text-red-500">*</span>
                </label>
                <select
                  value={getGroupNameValue(formData.class_level, formData.subject)}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (!value) {
                      setFormData({ ...formData, class_level: null, subject: '' });
                      return;
                    }
                    
                    // Find the matching option from combinedOptions
                    const matchedOption = combinedOptions.find(opt => opt.value === value);
                    
                    if (matchedOption) {
                      // Use the class and subject from the matched option directly
                      // This ensures consistency between the select value and formData
                      setFormData({ ...formData, class_level: matchedOption.class, subject: matchedOption.subject });
                      fetchTestSubjectsForClass(matchedOption.class, false); // Don't reset subject - we just set it above
                      fetchStudentsForClass(matchedOption.class, true);
                    } else {
                      // Fallback to parsing if no match found
                      let parsed = parseGroupName(value);
                      if (!parsed.class) {
                        parsed = parseCombinedValue(value);
                      }
                      if (parsed.class && parsed.subject) {
                        setFormData({ ...formData, class_level: parsed.class, subject: parsed.subject });
                        fetchTestSubjectsForClass(parsed.class, false); // Don't reset subject - we just set it above
                        fetchStudentsForClass(parsed.class, true);
                      }
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 focus:outline-none"
                >
                  <option value="">Select Class & Subject</option>
                  {(loadingGroups || loadingMainFormCurriculum) ? (
                    <option disabled>Loading...</option>
                  ) : combinedOptions.length === 0 ? (
                    <option disabled>No subjects available</option>
                  ) : (
                    combinedOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)
                  )}
                </select>
              </div>

              {/* Test Period */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Test Period <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 focus:outline-none"
                    />
                  </div>
                  <span className="text-gray-400 dark:text-gray-500">to</span>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Duration (minutes) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={10}
                  max={300}
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 60 })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 focus:outline-none"
                />
              </div>

              {/* Start/End Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-amber-600 dark:text-amber-400 mb-1.5">Start Time</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-amber-600 dark:text-amber-400 mb-1.5">End Time</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                    {formData.endDate ? (
                      <input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 focus:outline-none"
                      />
                    ) : (
                      <div className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-400 dark:text-gray-500 cursor-not-allowed">
                        Select end date first
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Number of Attempts */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Number of Attempts <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.num_attempts}
                  onChange={(e) => setFormData({ ...formData, num_attempts: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Show Results Checkbox */}
            <div className="mt-4 flex items-center gap-3">
              <input
                type="checkbox"
                id="show_results"
                checked={formData.show_results}
                onChange={(e) => setFormData({ ...formData, show_results: e.target.checked })}
                className="w-4 h-4 text-gray-900 dark:text-white rounded border-gray-300 dark:border-gray-600 focus:ring-gray-900 dark:focus:ring-gray-500"
              />
              <label htmlFor="show_results" className="text-sm text-gray-700 dark:text-gray-300">
                Show results immediately after submission
              </label>
            </div>

            {/* Description */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Enter test instructions or description..."
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 focus:outline-none resize-none"
              />
            </div>

            {/* Evaluation Type Toggle */}
            <div className="mt-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Evaluation Method</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, evaluation_type: "manual" })}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition text-left ${formData.evaluation_type === "manual" ? "border-gray-900 dark:border-white bg-white dark:bg-gray-800" : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 opacity-60"}`}
                >
                  <p className="font-medium text-gray-900 dark:text-white text-sm">Manual Evaluation</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Teachers will grade answers manually. No answer key required.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, evaluation_type: "ai" })}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition text-left ${formData.evaluation_type === "ai" ? "border-purple-600 dark:border-purple-400 bg-purple-50 dark:bg-purple-900/20" : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 opacity-60"}`}
                >
                  <p className="font-medium text-purple-700 dark:text-purple-300 text-sm">AI Evaluation</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Auto-graded by AI. You must provide answers for all questions.</p>
                </button>
              </div>
            </div>
          </div>

          {/* Student Assignment */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Student Assignment</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Select groups on the left to automatically select all students from those groups. You can also manually adjust individual student selections on the right.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Groups */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">Groups</h3>
                  <div className="flex gap-2">
                    <button onClick={selectAllGroups} className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Select All</button>
                    <button onClick={clearAllGroups} className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Clear All</button>
                  </div>
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                  {loadingGroups ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">Loading groups...</div>
                  ) : filteredGroups.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">No groups found for Class {formData.class_level}{formData.subject ? ` - ${formData.subject}` : ''}</div>
                  ) : (
                    filteredGroups.map(group => (
                      <label
                        key={group.id}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedGroups.includes(group.id)}
                          onChange={() => handleGroupToggle(group.id)}
                          className="w-4 h-4 text-gray-900 rounded border-gray-300 dark:border-gray-600"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">{group.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {group.student_count || 0} students
                            {group.teacher_name && group.teacher_name !== 'No Teacher' && (
                              <span> • Teacher: {group.teacher_name}</span>
                            )}
                          </p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{selectedGroups.length} groups selected</p>
              </div>

              {/* Students */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Students <span className="text-gray-400 dark:text-gray-500 font-normal">(from your groups)</span>
                  </h3>
                  <div className="flex gap-2">
                    <button onClick={selectAllStudents} className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Select All</button>
                    <button onClick={clearAllStudents} className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Clear All</button>
                  </div>
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                  {displayedStudents.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">No students found</div>
                  ) : (
                    displayedStudents.map(student => (
                      <label
                        key={student.id}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.id)}
                          onChange={() => handleStudentToggle(student.id)}
                          className="w-4 h-4 text-gray-900 rounded border-gray-300 dark:border-gray-600"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">{student.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{student.email}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{selectedStudents.length} students selected</p>
              </div>
            </div>
          </div>

          {/* Next Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setActiveTab("questions")}
              className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition font-medium flex items-center gap-2"
            >
              Next: Add Questions <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Questions Tab */}
      {activeTab === "questions" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Questions</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Add questions to your test ({questions.length} added)</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowBankSelector(true)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition font-medium flex items-center gap-2"
              >
                <Search className="w-4 h-4" /> Select from Bank
              </button>
              <button
                onClick={openAddQuestion}
                className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition font-medium flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add Question
              </button>
            </div>
          </div>

          {questions.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">No questions added yet</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm">Click "Add Question" to start building your test</p>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q, index) => (
                <div key={q.id || index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                          {q.marks} Mark{q.marks > 1 ? 's' : ''}
                        </span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                          {q.type === 'mcq' ? 'MCQ' : 
                           q.type === 'fillup' ? 'Fill-up' : 'Subjective'}
                        </span>
                        <span className="text-xs text-gray-400">Class {q.class_level} · {q.subject}</span>
                        {q.is_bank_question && <span className="text-xs text-purple-400 bg-purple-900/20 px-1 rounded">Bank</span>}
                      </div>
                      <p className="font-medium text-gray-900 dark:text-white">Q{index + 1}. {q.text}</p>
                      {q.type === 'mcq' && q.options && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {q.options.map((opt, i) => {
                            const isCorrect = (q.correct_answers || []).includes(i) || i === q.correct_answer;
                            return (
                              <div key={i} className={`text-sm px-3 py-1.5 rounded border ${
                                isCorrect 
                                  ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400' 
                                  : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                              }`}>
                                {String.fromCharCode(65 + i)}. {opt}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {q.type === 'fillup' && q.fillup_answers && (
                        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Answers:</span> {q.fillup_answers}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {!q.is_bank_question && (
                        <button onClick={() => editQuestion(index)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => deleteQuestion(index)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Question Modal */}
      {showQuestionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingIndex !== null ? 'Edit Question' : 'Add New Question'}
              </h3>
              <button onClick={() => setShowQuestionModal(false)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {/* Subject and Class - Display Only (from Test Details) */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Subject</label>
                  <p className="text-gray-900 dark:text-white font-medium">{formData.subject || 'Not selected'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Class</label>
                  <p className="text-gray-900 dark:text-white font-medium">Class {formData.class_level || 'Not selected'}</p>
                </div>
              </div>

              {/* Chapter and Topic */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chapter <span className="text-red-500">*</span></label>
                  {loadingCurrDetail ? (
                    <div className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-500 text-sm">Loading chapters...</div>
                  ) : (
                    <select
                      value={questionForm.chapter}
                      onChange={(e) => {
                        const chNum = parseInt(e.target.value);
                        const ch = questionChapters.find(c => c.chapter_number === chNum);
                        setQuestionForm(prev => ({
                          ...prev,
                          chapter: chNum || "",
                          chapter_name: ch?.chapter_name || "",
                          topic: ""
                        }));
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                    >
                      <option value="">Select Chapter</option>
                      {questionChapters.length > 0 ? (
                        questionChapters.map(ch => (
                          <option key={ch.chapter_number} value={ch.chapter_number}>
                            Ch {ch.chapter_number}: {ch.chapter_name}
                          </option>
                        ))
                      ) : (
                        <option disabled>{questionForm.subject && questionForm.class_level ? "No chapters – add in Subjects page" : "Select subject & class first"}</option>
                      )}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Topic <span className="text-red-500">*</span></label>
                  <select
                    value={questionForm.topic}
                    onChange={(e) => setQuestionForm(prev => ({ ...prev, topic: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  >
                    <option value="">Select Topic</option>
                    {questionTopics.length > 0 ? (
                      questionTopics.map(t => (
                        <option key={t.topic_id} value={t.topic_name}>
                          {t.topic_name}
                        </option>
                      ))
                    ) : (
                      <option disabled>{questionForm.chapter ? "No topics – add in Subjects page" : "Select chapter first"}</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Marks */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Question Marks</label>
                <div className="flex gap-2">
                  {[1, 2, 5].map(m => (
                    <button
                      key={m}
                      onClick={() => handleMarksChange(m)}
                      className={`px-4 py-2 rounded-lg font-medium transition ${questionForm.marks === m ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                    >
                      {m} Mark{m > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Type (only for 1 mark) */}
              {questionForm.marks === 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Question Type</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setQuestionForm(prev => ({ ...prev, type: 'mcq', correct_answers: [] }))}
                      className={`px-4 py-2 rounded-lg font-medium transition ${questionForm.type === 'mcq' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                    >
                      MCQ
                    </button>
                    <button
                      onClick={() => setQuestionForm(prev => ({ ...prev, type: 'fillup', fillup_answers: '' }))}
                      className={`px-4 py-2 rounded-lg font-medium transition ${questionForm.type === 'fillup' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                    >
                      Fill in the Blank
                    </button>
                  </div>
                </div>
              )}

              {/* Question Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Question Text</label>
                <textarea
                  value={questionForm.text}
                  onChange={(e) => setQuestionForm(prev => ({ ...prev, text: e.target.value }))}
                  placeholder={questionForm.type === 'fillup' ? 'Use ___ for blank spaces (e.g., "The capital of India is ___")' : 'Enter your question here...'}
                  rows={3}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>

              {/* MCQ Options */}
              {questionForm.type === 'mcq' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Options <span className="text-xs text-gray-500">(click to mark correct answers - one or more)</span>
                  </label>
                  <div className="space-y-2">
                    {questionForm.options.map((opt, i) => {
                      const isSelected = (questionForm.correct_answers || []).includes(i);
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setQuestionForm(prev => {
                                const current = prev.correct_answers || [];
                                const updated = isSelected 
                                  ? current.filter(x => x !== i) 
                                  : [...current, i];
                                return { ...prev, correct_answers: updated };
                              });
                            }}
                            className={`w-8 h-8 rounded flex items-center justify-center font-medium transition ${
                              isSelected 
                                ? 'bg-green-500 text-white' 
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                            title={isSelected ? 'Click to unmark' : 'Click to mark as correct'}
                          >
                            {isSelected ? '✓' : String.fromCharCode(65 + i)}
                          </button>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const newOpts = [...questionForm.options];
                              newOpts[i] = e.target.value;
                              setQuestionForm(prev => ({ ...prev, options: newOpts }));
                            }}
                            placeholder={`Option ${String.fromCharCode(65 + i)}`}
                            className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {(questionForm.correct_answers || []).length === 0 && 'Select at least one correct answer'}
                    {(questionForm.correct_answers || []).length === 1 && '1 correct answer selected'}
                    {(questionForm.correct_answers || []).length > 1 && `${questionForm.correct_answers.length} correct answers selected (multi-select)`}
                  </p>
                </div>
              )}

              {/* Fill-up answer field */}
              {questionForm.type === 'fillup' && (
                <div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-3">
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      <strong>Fill in the Blank:</strong> Use ___ in your question to indicate where the blank is.
                    </p>
                  </div>
                  {formData.evaluation_type === "ai" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Accepted Answer(s) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={questionForm.fillup_answers || ""}
                        onChange={(e) => setQuestionForm(prev => ({ ...prev, fillup_answers: e.target.value }))}
                        placeholder='Enter answers separated by commas (e.g., "photosynthesis, photo synthesis")'
                        className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Separate multiple accepted answers with commas</p>
                    </div>
                  )}
                </div>
              )}

              {/* Subjective answer field */}
              {questionForm.type === 'subjective' && formData.evaluation_type === "ai" && (
                <div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3">
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      <strong>Subjective Question ({questionForm.marks} Marks):</strong> AI will evaluate based on the model answer below.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Model Answer <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={questionForm.answer_text || ""}
                      onChange={(e) => setQuestionForm(prev => ({ ...prev, answer_text: e.target.value }))}
                      placeholder="Enter the expected/model answer for AI evaluation..."
                      rows={4}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">This answer will be used by AI to evaluate student responses</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowQuestionModal(false)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuestion}
                className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition font-medium"
              >
                {editingIndex !== null ? 'Update Question' : 'Add Question'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Bank Selector Modal */}
      {showBankSelector && (
        <QuestionBankSelector
          onSelect={handleAddFromBank}
          onClose={() => setShowBankSelector(false)}
          preSelectedIds={questions.filter(q => q.is_bank_question).map(q => q.id)}
        />
      )}
    </AdminLayout>
  );
}

