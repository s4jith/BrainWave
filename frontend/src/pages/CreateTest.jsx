
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import { ClipboardList, Calendar, Clock, CheckCircle, Plus, ChevronRight, FileText, AlertCircle, X, Trash2, Edit2, Search } from "lucide-react";
import QuestionBankSelector from "../components/QuestionBankSelector";
import QuestionPaperSelector from "../components/QuestionPaperSelector";
import { parseCombinedValue, parseGroupName } from "../constants/academicConstants";
import authFetch from "../utils/authFetch";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function CreateTest() {
  const navigate = useNavigate();
  const { testId } = useParams();
  const isEditMode = !!testId;

  const { user, getAuthHeader } = useUserStore();
  const isAdmin = user?.role === "admin";
  const [activeTab, setActiveTab] = useState("details");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    class_level: 10,  
    subject: "",
    startDate: "",
    endDate: "",
    startTime: "09:00",
    endTime: "12:00",
    duration_minutes: 60,
    num_attempts: 1,
    show_results: false,
    description: "",
    evaluation_type: "manual" 
  });

  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groupSearch, setGroupSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [mainFormCurriculumSubjects, setMainFormCurriculumSubjects] = useState([]); 
  const [loadingMainFormCurriculum, setLoadingMainFormCurriculum] = useState(true);

  const combinedOptions = React.useMemo(() => {
    if (groups && groups.length > 0) {
      return groups.map(group => ({
        value: group.name,  
        label: group.name,  
        class: group.class_level,
        subject: group.subject
      })).sort((a, b) => {
        if (a.class !== b.class) return a.class - b.class;
        return a.subject.localeCompare(b.subject);
      });
    }
    
    // Teachers without groups should see an empty dropdown, not all curriculum subjects
    if (!isAdmin) return [];

    return mainFormCurriculumSubjects.map(subj => ({
      value: `${subj.class_level}-${subj.subject_name}`,
      label: `Class ${subj.class_level} - ${subj.subject_name}`,
      class: subj.class_level,
      subject: subj.subject_name
    })).sort((a, b) => {
      if (a.class !== b.class) return a.class - b.class;
      return a.subject.localeCompare(b.subject);
    });
  }, [groups, mainFormCurriculumSubjects, isAdmin]);

  const getGroupNameValue = React.useCallback((classLevel, subject) => {
    if (!classLevel || !subject) return '';
    const matchingOption = combinedOptions.find(opt => opt.class === classLevel && opt.subject === subject);
    return matchingOption ? matchingOption.value : '';
  }, [combinedOptions]);

  const filteredGroups = React.useMemo(() => {
    if (!formData.class_level) return groups;
    
    return groups.filter(g => {
      const matchesClass = g.class_level === formData.class_level;
      const matchesSubject = !formData.subject || g.subject === formData.subject;
      return matchesClass && matchesSubject;
    });
  }, [groups, formData.class_level, formData.subject]);

  const groupStudents = React.useMemo(() => {
    const studentMap = new Map();
    filteredGroups.forEach(group => {
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

  const displayedStudents = React.useMemo(() => {
    const studentMap = new Map();
    
    groupStudents.forEach(s => studentMap.set(s.id, s));
    
    students.forEach(s => studentMap.set(s.id, s));
    
    return Array.from(studentMap.values());
  }, [groupStudents, students]);

  const ungroupedStudents = React.useMemo(() => {
    const groupedIds = new Set(groupStudents.map(s => s.id));
    return students.filter(s => !groupedIds.has(s.id));
  }, [groupStudents, students]);

  const searchFilteredGroups = React.useMemo(() => {
    if (!groupSearch.trim()) return filteredGroups;
    const q = groupSearch.toLowerCase();
    return filteredGroups.filter(g =>
      g.name?.toLowerCase().includes(q) ||
      g.subject?.toLowerCase().includes(q) ||
      g.teacher_name?.toLowerCase().includes(q)
    );
  }, [filteredGroups, groupSearch]);

  const searchFilteredGroupStudents = React.useMemo(() => {
    if (!studentSearch.trim()) return groupStudents;
    const q = studentSearch.toLowerCase();
    return groupStudents.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.user_id?.toLowerCase().includes(q)
    );
  }, [groupStudents, studentSearch]);

  const searchFilteredUngroupedStudents = React.useMemo(() => {
    if (!studentSearch.trim()) return ungroupedStudents;
    const q = studentSearch.toLowerCase();
    return ungroupedStudents.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.user_id?.toLowerCase().includes(q)
    );
  }, [ungroupedStudents, studentSearch]);

  const [questions, setQuestions] = useState([]);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showBankSelector, setShowBankSelector] = useState(false);
  const [showPaperSelector, setShowPaperSelector] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [questionForm, setQuestionForm] = useState({
    class_level: 10,
    subject: "",
    marks: 1,
    type: "mcq", 
    text: "",
    options: ["", "", "", ""],
    correct_answer: 0,       
    correct_answers: [],     
    fillup_answers: "",      
    answer_text: ""          
  });
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [testSubjects, setTestSubjects] = useState([]);

  const [curriculumSubjects, setCurriculumSubjects] = useState([]);
  const [questionCurrSubject, setQuestionCurrSubject] = useState(null); 
  const [loadingCurriculum, setLoadingCurriculum] = useState(true);
  const [loadingCurrDetail, setLoadingCurrDetail] = useState(false);

  useEffect(() => {
    fetchGroupsAndStudents();
    fetchCurriculumSubjects();
    fetchMainFormCurriculumSubjects();
    if (isEditMode) {
      fetchTestDetails();
    } else {
      
      fetchTestSubjectsForClass(formData.class_level, false);
    }
  }, [testId]);

  const fetchCurriculumSubjects = async () => {
    setLoadingCurriculum(true);
    try {
      const response = await authFetch(`${API_URL}/api/curriculum/subjects?is_active=true`);
      if (response.ok) {
        const data = await response.json();
        setCurriculumSubjects(Array.isArray(data) ? data : []);
      }
    } catch (err) {
    } finally {
      setLoadingCurriculum(false);
    }
  };

  const fetchMainFormCurriculumSubjects = async () => {
    setLoadingMainFormCurriculum(true);
    try {
      const response = await authFetch(`${API_URL}/api/curriculum/subjects?is_active=true`, {
        headers: getAuthHeader()
      });
      if (response.ok) {
        const data = await response.json();
        setMainFormCurriculumSubjects(Array.isArray(data) ? data : []);
      }
    } catch (error) {
    } finally {
      setLoadingMainFormCurriculum(false);
    }
  };

  useEffect(() => {
    if (!showQuestionModal || !questionForm.subject || !questionForm.class_level) {
      setQuestionCurrSubject(null);
      return;
    }
    
    const subjectId = `${questionForm.subject.toLowerCase().replace(/\s+/g, '_')}_${questionForm.class_level}`;
    const fetchDetail = async () => {
      setLoadingCurrDetail(true);
      try {
        const response = await authFetch(`${API_URL}/api/curriculum/subjects/${subjectId}`);
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

  const questionChapters = questionCurrSubject?.chapters?.filter(ch => ch.is_active !== false) || [];
  const questionSelectedChapter = questionChapters.find(ch => ch.chapter_number === questionForm.chapter);
  const questionTopics = questionSelectedChapter?.topics?.filter(t => t.is_active !== false) || [];

  const currSubjectNames = [...new Set(curriculumSubjects.map(s => s.subject_name))].sort();

  const fetchTestDetails = async () => {
    setLoading(true);
    try {
      const response = await authFetch(`${API_URL}/api/assessments/${testId}`, {
        headers: getAuthHeader()
      });
      if (!response.ok) throw new Error("Failed to load test details");

      const data = await response.json();

      let startDate = "", startTime = "09:00", endDate = "", endTime = "12:00";

      const toLocalDateStr = (dt) => {
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };

      if (data.start_datetime) {
        const start = new Date(data.start_datetime);
        startDate = toLocalDateStr(start);
        startTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
      }
      if (data.end_datetime) {
        const end = new Date(data.end_datetime);
        endDate = toLocalDateStr(end);
        endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
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

      const formattedQuestions = (data.questions || []).map(q => {
        const optionsText = Array.isArray(q.options)
          ? q.options.map(opt => (typeof opt === 'object' ? (opt.text || "") : opt))
          : [];

        let correctIndex = 0;
        let correctIndices = [];
        if (Array.isArray(q.options) && q.options.length > 0 && typeof q.options[0] === 'object') {
          const foundIndex = q.options.findIndex(opt => opt.is_correct);
          if (foundIndex !== -1) correctIndex = foundIndex;
          
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
      setSelectedGroups(data.group_ids || []);

      fetchTestSubjectsForClass(data.class_level || 10, false);

      fetchStudentsForClass(data.class_level || 10, false);

    } catch (err) {
      setError("Failed to load test details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showQuestionModal && questionForm.class_level) {
      fetchSubjectsForClass(questionForm.class_level);
    }
  }, [showQuestionModal, questionForm.class_level]);

  const fetchSubjectsForClass = async (classLevel) => {
    setLoadingSubjects(true);
    try {
      const response = await authFetch(`${API_URL}/api/test/subjects/${classLevel}`);
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
      setAvailableSubjects(currSubjectNames);
    } finally {
      setLoadingSubjects(false);
    }
  };

  const fetchTestSubjectsForClass = async (classLevel, resetSubject = true) => {
    try {
      const response = await authFetch(`${API_URL}/api/test/subjects/${classLevel}`);
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
      setTestSubjects([]);
    }
  };

  const fetchGroupsAndStudents = async () => {
    setLoadingGroups(true);
    try {
      // Teachers only see their own assigned groups
      const endpoint = isAdmin
        ? `${API_URL}/api/admin/groups`
        : `${API_URL}/api/teacher/groups`;
      const groupsRes = await authFetch(endpoint, { headers: getAuthHeader() });
      if (groupsRes.ok) {
        const data = await groupsRes.json();
        const fetchedGroups = data.groups || [];
        setGroups(fetchedGroups);
        // Pass fetched groups directly to avoid React state timing issues
        if (!isEditMode) {
          await fetchStudentsForClass(formData.class_level, true, fetchedGroups);
        }
      }
    } catch (err) {
    } finally {
      setLoadingGroups(false);
    }
  };

  const fetchStudentsForClass = async (classLevel, clearSelection = true, groupsOverride = null) => {
    if (!classLevel) return;
    // For teachers, extract students from their assigned groups instead of calling admin API
    if (!isAdmin) {
      const groupsToUse = groupsOverride !== null ? groupsOverride : groups;
      const seen = new Set();
      const filtered = [];
      groupsToUse
        .filter(g => g.class_level == classLevel)
        .forEach(g => {
          (g.students || []).forEach(s => {
            if (!seen.has(s.id)) {
              seen.add(s.id);
              filtered.push(s);
            }
          });
        });
      setStudents(filtered);
      if (clearSelection) setSelectedStudents([]);
      return;
    }
    // Admin path: fetch all students for the class via admin API
    try {
      const studentsRes = await authFetch(`${API_URL}/api/admin/students?limit=200&class_level=${classLevel}`);
      if (studentsRes.ok) {
        const data = await studentsRes.json();
        setStudents(data || []);
        if (clearSelection) {
          setSelectedStudents([]);
        }
      }
    } catch (err) {
    }
  };

  const handleGroupToggle = (groupId) => {
    const group = groups.find(g => g.id === groupId);
    
    if (selectedGroups.includes(groupId)) {
      setSelectedGroups(prev => prev.filter(id => id !== groupId));
      
      const studentIdsToRemove = group?.student_ids || group?.students?.map(s => s.id) || [];
      if (studentIdsToRemove.length > 0) {
        setSelectedStudents(prev => prev.filter(id => !studentIdsToRemove.includes(id)));
      }
    } else {
      setSelectedGroups(prev => [...prev, groupId]);
      
      const studentIdsToAdd = group?.student_ids || group?.students?.map(s => s.id) || [];
      if (studentIdsToAdd.length > 0) {
        setSelectedStudents(prev => {
          const newSelected = [...new Set([...prev, ...studentIdsToAdd])];
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
    if (!formData.title.trim()) {
      setError("Please enter a test title before saving as draft");
      return;
    }
    setSaving(true);
    setError(null);
    try {
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
        group_ids: selectedGroups,
        questions: questions,
        created_by: user?.user_id || "admin",
        evaluation_type: formData.evaluation_type,
        status: "draft"
      };

      const url = isEditMode
        ? `${API_URL}/api/assessments/${testId}`
        : `${API_URL}/api/assessments`;
      const method = isEditMode ? "PUT" : "POST";

      const response = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const err = await response.json();
        const detail = err.detail;
        const msg = typeof detail === "string" ? detail
          : Array.isArray(detail) ? detail.map(e => e.msg || JSON.stringify(e)).join(", ")
            : "Failed to save draft";
        throw new Error(msg);
      }

      setSuccess("Draft saved! You can find and publish it from Test Management.");
      setTimeout(() => navigate("/test-management"), 2000);
    } catch (err) {
      setError(err.message);
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
        group_ids: selectedGroups,
        questions: questions,
        created_by: user?.user_id || "admin",
        evaluation_type: formData.evaluation_type,
        status: "published"
      };

      const url = isEditMode
        ? `${API_URL}/api/assessments/${testId}`
        : `${API_URL}/api/assessments`;

      const method = isEditMode ? "PUT" : "POST";

      const response = await authFetch(url, {
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

  const openAddQuestion = () => {
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

  const isTestDetailsComplete = formData.title?.trim() && formData.subject && formData.class_level && formData.startDate;

  const _now = new Date();
  const todayStr = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;
  const currentTimeStr = `${String(_now.getHours()).padStart(2,'0')}:${String(_now.getMinutes()).padStart(2,'0')}`;

  const minStartTime = formData.startDate === todayStr ? currentTimeStr : undefined;

  const minEndDate = formData.startDate || todayStr;

  const minEndTime = (formData.startDate && formData.endDate && formData.startDate === formData.endDate)
    ? formData.startTime
    : undefined;

  const pushOneHour = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(2000, 0, 1, h + 1, m);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const handleStartDateChange = (val) => {
    const updates = { startDate: val };

    let effectiveStartTime = formData.startTime;
    if (val === todayStr && formData.startTime < currentTimeStr) {
      updates.startTime = currentTimeStr;
      effectiveStartTime = currentTimeStr;
    }

    if (formData.endDate && val > formData.endDate) {
      updates.endDate = val;
    }

    const effectiveEndDate = updates.endDate || formData.endDate;
    if (effectiveEndDate === val && formData.endTime <= effectiveStartTime) {
      updates.endTime = pushOneHour(effectiveStartTime);
    }

    setFormData({ ...formData, ...updates });
  };

  const handleEndDateChange = (val) => {
    const updates = { endDate: val };
    if (val === formData.startDate && formData.endTime <= formData.startTime) {
      updates.endTime = pushOneHour(formData.startTime);
    }
    setFormData({ ...formData, ...updates });
  };

  const handleStartTimeChange = (val) => {
    const updates = { startTime: val };
    if (formData.startDate && formData.endDate && formData.startDate === formData.endDate && val >= formData.endTime) {
      updates.endTime = pushOneHour(val);
    }
    setFormData({ ...formData, ...updates });
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
    
    // Compulsory answer validation for ALL question types (both manual and AI evaluation)
    if (questionForm.type === "mcq" && (!questionForm.correct_answers || questionForm.correct_answers.length === 0)) {
      const hasLegacyCorrect = questionForm.correct_answer !== undefined && questionForm.correct_answer !== null && questionForm.correct_answer !== "";
      if (!hasLegacyCorrect) {
        setError("Please select at least one correct answer for MCQ");
        return;
      }
    }
    if (questionForm.type === "fillup" && !questionForm.fillup_answers?.trim()) {
      setError("Please enter the correct answer(s) for fill in the blank");
      return;
    }
    if (questionForm.type === "true_false" && questionForm.correct_answer === undefined && questionForm.correct_answer === null) {
      setError("Please select the correct answer (True or False)");
      return;
    }
    if (questionForm.type === "subjective" && !questionForm.answer_text?.trim()) {
      setError("Please enter the model answer for subjective question");
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

      {activeTab === "details" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-6">Basic Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    
                    const matchedOption = combinedOptions.find(opt => opt.value === value);
                    
                    if (matchedOption) {
                      
                      setFormData({ ...formData, class_level: matchedOption.class, subject: matchedOption.subject });
                      fetchTestSubjectsForClass(matchedOption.class, false); 
                      fetchStudentsForClass(matchedOption.class, true);
                    } else {
                      
                      let parsed = parseGroupName(value);
                      if (!parsed.class) {
                        parsed = parseCombinedValue(value);
                      }
                      if (parsed.class && parsed.subject) {
                        setFormData({ ...formData, class_level: parsed.class, subject: parsed.subject });
                        fetchTestSubjectsForClass(parsed.class, false); 
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
                      min={todayStr}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 focus:outline-none"
                    />
                  </div>
                  <span className="text-gray-400 dark:text-gray-500">to</span>
                  <input
                    type="date"
                    value={formData.endDate}
                    min={minEndDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 focus:outline-none"
                  />
                </div>
              </div>

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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-amber-600 dark:text-amber-400 mb-1.5">Start Time</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <input
                      type="time"
                      value={formData.startTime}
                      min={minStartTime}
                      onChange={(e) => handleStartTimeChange(e.target.value)}
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
                        min={minEndTime}
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

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Student Assignment</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Select groups on the left to automatically select all students from those groups. You can also manually adjust individual student selections on the right.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">Groups</h3>
                  <div className="flex gap-2">
                    <button onClick={selectAllGroups} className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Select All</button>
                    <button onClick={clearAllGroups} className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Clear All</button>
                  </div>
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search groups..."
                    value={groupSearch}
                    onChange={e => setGroupSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                  />
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                  {loadingGroups ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">Loading groups...</div>
                  ) : searchFilteredGroups.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">{groupSearch ? 'No groups match your search' : `No groups found for Class ${formData.class_level}${formData.subject ? ` - ${formData.subject}` : ''}`}</div>
                  ) : (
                    searchFilteredGroups.map(group => (
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

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Students
                  </h3>
                  <div className="flex gap-2">
                    <button onClick={selectAllStudents} className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Select All</button>
                    <button onClick={clearAllStudents} className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Clear All</button>
                  </div>
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                  />
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-64 overflow-y-auto">
                  {searchFilteredGroupStudents.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 sticky top-0">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">From Groups</span>
                      </div>
                      {searchFilteredGroupStudents.map(student => (
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
                      ))}
                    </>
                  )}
                  {searchFilteredUngroupedStudents.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 border-b border-gray-100 dark:border-gray-700 sticky top-0">
                        <span className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wide">Not in any group</span>
                      </div>
                      {searchFilteredUngroupedStudents.map(student => (
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
                          <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">No group</span>
                        </label>
                      ))}
                    </>
                  )}
                  {searchFilteredGroupStudents.length === 0 && searchFilteredUngroupedStudents.length === 0 && (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      {studentSearch ? 'No students match your search' : 'No students found'}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{selectedStudents.length} students selected</p>
              </div>
            </div>
          </div>

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
                onClick={() => setShowPaperSelector(true)}
                className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition font-medium flex items-center gap-2"
              >
                <FileText className="w-4 h-4" /> Select from Papers
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

      {showQuestionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingIndex !== null ? 'Edit Question' : 'Add New Question'}
              </h3>
              <button onClick={() => setShowQuestionModal(false)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
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

              {questionForm.type === 'fillup' && (
                <div>
                  {formData.evaluation_type === "ai" && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-3">
                      <p className="text-sm text-blue-700 dark:text-blue-400">
                        <strong>Fill in the Blank:</strong> Use ___ in your question to indicate where the blank is.
                      </p>
                    </div>
                  )}
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
                </div>
              )}

              {questionForm.type === 'subjective' && (
                <div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3">
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      <strong>Subjective Question ({questionForm.marks} Marks):</strong> {formData.evaluation_type === "ai" ? "AI will evaluate based on the model answer below." : "Provide a model answer for reference during manual evaluation."}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Model Answer <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={questionForm.answer_text || ""}
                      onChange={(e) => setQuestionForm(prev => ({ ...prev, answer_text: e.target.value }))}
                      placeholder="Enter the expected/model answer..."
                      rows={4}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formData.evaluation_type === "ai" 
                        ? "This answer will be used by AI to evaluate student responses" 
                        : "This answer will be shown to the evaluator as a reference"}
                    </p>
                  </div>
                </div>
              )}
            </div>

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
      {showBankSelector && (
        <QuestionBankSelector
          onSelect={handleAddFromBank}
          onClose={() => setShowBankSelector(false)}
          preSelectedIds={questions.filter(q => q.is_bank_question).map(q => q.id)}
          defaultClass={formData.class_level}
          defaultSubject={formData.subject}
        />
      )}
      {showPaperSelector && (
        <QuestionPaperSelector
          onSelect={handleAddFromBank}
          onClose={() => setShowPaperSelector(false)}
          preSelectedIds={questions.filter(q => q.from_paper).map(q => q.id)}
          defaultClass={formData.class_level}
          defaultSubject={formData.subject}
        />
      )}
    </AdminLayout>
  );
}
