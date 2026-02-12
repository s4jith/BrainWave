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

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const SUBJECTS = ["Mathematics", "Science", "Social Science", "English", "Hindi", "Physics", "Chemistry", "Biology"];
const CLASSES = [5, 6, 7, 8, 9, 10, 11, 12];

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
    description: ""
  });

  // Groups and Students
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // Questions (for tab 2)
  const [questions, setQuestions] = useState([]);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showBankSelector, setShowBankSelector] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [questionForm, setQuestionForm] = useState({
    class_level: 10,
    subject: "",
    marks: 1,
    type: "mcq", // mcq, fillup, subjective
    text: "",
    options: ["", "", "", ""],
    correct_answer: 0
  });
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [testSubjects, setTestSubjects] = useState([]);  // For Test Details tab

  useEffect(() => {
    fetchGroupsAndStudents();
    if (isEditMode) {
      fetchTestDetails();
    }
  }, [testId]);

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
        description: data.description || ""
      });

      // Transform backend questions to frontend format (options as strings, correct_answer as index)
      const formattedQuestions = (data.questions || []).map(q => {
        // Handle options: extract text from objects
        const optionsText = Array.isArray(q.options)
          ? q.options.map(opt => (typeof opt === 'object' ? (opt.text || "") : opt))
          : [];

        // Handle correct answer: find index of correct option
        let correctIndex = 0;
        if (Array.isArray(q.options) && q.options.length > 0 && typeof q.options[0] === 'object') {
          const foundIndex = q.options.findIndex(opt => opt.is_correct);
          if (foundIndex !== -1) correctIndex = foundIndex;
        } else if (q.correct_answer !== undefined) {
          // Fallback for legacy format if any
          correctIndex = parseInt(q.correct_answer) || 0;
        }

        return {
          ...q,
          text: q.question_text || q.text || "", // Map question_text to text for frontend
          options: optionsText,
          correct_answer: correctIndex,
          marks: q.points || q.marks || 1
        };
      });

      setQuestions(formattedQuestions);
      setSelectedStudents(data.student_ids || []);

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
        setAvailableSubjects(SUBJECTS);
      }
    } catch (err) {
      console.error("Failed to fetch subjects:", err);
      setAvailableSubjects(SUBJECTS);
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
          } else if (!subjects.includes(formData.subject)) {
            setFormData(prev => ({ ...prev, subject: "" }));
          }
        }
      } else {
        setTestSubjects(SUBJECTS);
      }
    } catch (err) {
      console.error("Failed to fetch test subjects:", err);
      setTestSubjects(SUBJECTS);
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
    if (selectedGroups.includes(groupId)) {
      setSelectedGroups(prev => prev.filter(id => id !== groupId));
      // Remove students from this group
      if (group?.students) {
        const groupStudentIds = group.students.map(s => s.id);
        setSelectedStudents(prev => prev.filter(id => !groupStudentIds.includes(id)));
      }
    } else {
      setSelectedGroups(prev => [...prev, groupId]);
      // Add students from this group
      if (group?.students) {
        const groupStudentIds = group.students.map(s => s.id);
        setSelectedStudents(prev => [...new Set([...prev, ...groupStudentIds])]);
      }
    }
  };

  const handleStudentToggle = (studentId) => {
    setSelectedStudents(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const selectAllGroups = () => {
    const allGroupIds = groups.map(g => g.id);
    setSelectedGroups(allGroupIds);
    // Add all students from all groups
    const allStudentIds = groups.flatMap(g => g.students?.map(s => s.id) || []);
    setSelectedStudents([...new Set(allStudentIds)]);
  };

  const clearAllGroups = () => {
    setSelectedGroups([]);
  };

  const selectAllStudents = () => {
    setSelectedStudents(students.map(s => s.id));
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
        duration_minutes: formData.duration_minutes,
        num_attempts: formData.num_attempts,
        show_results_immediately: formData.show_results,
        start_datetime: startDateTime,
        end_datetime: endDateTime,
        student_ids: selectedStudents,
        questions: questions,
        created_by: user?.user_id || "admin"
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
    setQuestionForm({
      class_level: 10,
      subject: "",  // Will be set by useEffect when subjects are fetched
      marks: 1,
      type: "mcq",
      text: "",
      options: ["", "", "", ""],
      correct_answer: 0
    });
    setEditingIndex(null);
    setShowQuestionModal(true);
  };

  const handleSaveQuestion = () => {
    if (!questionForm.text.trim()) {
      setError("Please enter question text");
      return;
    }
    if (questionForm.type === "mcq" && questionForm.options.some(o => !o.trim())) {
      setError("Please fill all MCQ options");
      return;
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
    const type = marks === 1 ? "mcq" : "subjective";
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
            className={`px-6 py-3 text-sm font-medium border-b-2 transition ${activeTab === "questions"
              ? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
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

              {/* Class */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Class <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.class_level}
                  onChange={(e) => {
                    const newClass = parseInt(e.target.value);
                    setFormData({ ...formData, class_level: newClass, subject: "" });
                    fetchTestSubjectsForClass(newClass, true);
                    fetchStudentsForClass(newClass, true);
                  }}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 focus:outline-none"
                >
                  {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Subject <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 focus:outline-none"
                >
                  <option value="">Select a subject</option>
                  {testSubjects.map(s => <option key={s} value={s}>{s}</option>)}
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
                    <input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 focus:outline-none"
                    />
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
                  ) : groups.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">No groups found</div>
                  ) : (
                    groups.map(group => (
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
                          <p className="text-xs text-gray-500 dark:text-gray-400">{group.student_count || 0} students</p>
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
                  {students.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">No students found</div>
                  ) : (
                    students.slice(0, 20).map(student => (
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
                          {q.type === 'mcq' ? 'MCQ' : q.type === 'fillup' ? 'Fill in the Blank' : 'Subjective'}
                        </span>
                        <span className="text-xs text-gray-400">Class {q.class_level} · {q.subject}</span>
                        {q.is_bank_question && <span className="text-xs text-purple-400 bg-purple-900/20 px-1 rounded">Bank</span>}
                      </div>
                      <p className="font-medium text-gray-900 dark:text-white">Q{index + 1}. {q.text}</p>
                      {q.type === 'mcq' && q.options && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {q.options.map((opt, i) => (
                            <div key={i} className={`text-sm px-3 py-1.5 rounded border ${i === q.correct_answer ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400' : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'}`}>
                              {String.fromCharCode(65 + i)}. {opt}
                            </div>
                          ))}
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
              {/* Class and Subject */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Class</label>
                  <select
                    value={questionForm.class_level}
                    onChange={(e) => {
                      const cl = parseInt(e.target.value);
                      setQuestionForm(prev => ({ ...prev, class_level: cl, subject: "" }));
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  >
                    {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
                  <select
                    value={questionForm.subject}
                    onChange={(e) => setQuestionForm(prev => ({ ...prev, subject: e.target.value }))}
                    disabled={loadingSubjects}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white disabled:opacity-50"
                  >
                    {loadingSubjects ? (
                      <option>Loading...</option>
                    ) : (
                      availableSubjects.map(s => <option key={s} value={s}>{s}</option>)
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
                      onClick={() => setQuestionForm(prev => ({ ...prev, type: 'mcq' }))}
                      className={`px-4 py-2 rounded-lg font-medium transition ${questionForm.type === 'mcq' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                    >
                      MCQ (Multiple Choice)
                    </button>
                    <button
                      onClick={() => setQuestionForm(prev => ({ ...prev, type: 'fillup' }))}
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Options (select correct answer)</label>
                  <div className="space-y-2">
                    {questionForm.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <button
                          onClick={() => setQuestionForm(prev => ({ ...prev, correct_answer: i }))}
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-medium transition ${questionForm.correct_answer === i ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                        >
                          {String.fromCharCode(65 + i)}
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
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Click the letter to mark as correct answer</p>
                </div>
              )}

              {/* Info for Fill-ups and Subjective */}
              {questionForm.type === 'fillup' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    <strong>Fill in the Blank:</strong> Students will type their answer in a text box. Use ___ in your question to indicate where the blank is.
                  </p>
                </div>
              )}

              {questionForm.marks > 1 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    <strong>Subjective Question ({questionForm.marks} Marks):</strong> Students will write a detailed answer. Teachers will manually grade these responses.
                  </p>
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

