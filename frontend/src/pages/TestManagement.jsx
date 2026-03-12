
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import LoadingSpinner from "../components/LoadingSpinner";
import { ClipboardList, Plus, Trash2, Edit2, FileText, MessageSquare, ExternalLink } from "lucide-react";
import authFetch from "../utils/authFetch";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function TestManagement() {
  const navigate = useNavigate();
  const { getAuthHeader } = useUserStore();
  const [tests, setTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [stats, setStats] = useState(null);

  const [filterClass, setFilterClass] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [comment, setComment] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [submissionDetail, setSubmissionDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [questionGrades, setQuestionGrades] = useState({});
  const [gradingFeedback, setGradingFeedback] = useState("");
  const [savingGrades, setSavingGrades] = useState(false);

  // Topic quiz modal state
  const [showTopicQuiz, setShowTopicQuiz] = useState(false);
  const [topicQuizSubmissionId, setTopicQuizSubmissionId] = useState(null);
  const [topicQuizTopics, setTopicQuizTopics] = useState([]);  // [{name,subject}]
  const [topicAssessments, setTopicAssessments] = useState({});  // topic → "strong"|"moderate"|"weak"
  const [topicNotes, setTopicNotes] = useState("");
  const [savingTopicAnalytics, setSavingTopicAnalytics] = useState(false);

  const [teacherGroups, setTeacherGroups] = useState([]);
  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [teacherClassLevels, setTeacherClassLevels] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  const [curriculumSubjects, setCurriculumSubjects] = useState([]);
  const [loadingCurriculum, setLoadingCurriculum] = useState(true);

  useEffect(() => {
    fetchTeacherGroups();
    fetchCurriculumSubjects();
  }, []);

  useEffect(() => {
    fetchTests();
  }, [filterClass, filterSubject]);

  useEffect(() => {
    if (tests.length > 0 && teacherGroups.length > 0) {
      calculateStats(tests);
    }
  }, [teacherGroups]);

  useEffect(() => {
    const handleFocus = () => {
      fetchTests();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [filterClass, filterSubject]);

  const fetchTeacherGroups = async () => {
    try {
      setLoadingGroups(true);
      const response = await authFetch(`${API_URL}/api/teacher/groups`, {
        headers: getAuthHeader()
      });
      if (response.ok) {
        const data = await response.json();
        const groups = data.groups || [];
        setTeacherGroups(groups);
        
        const subjects = [...new Set(groups.map(g => g.subject).filter(Boolean))];
        setTeacherSubjects(subjects.sort());
        const classes = [...new Set(groups.map(g => g.class_level).filter(Boolean))];
        setTeacherClassLevels(classes.sort((a, b) => a - b));
      }
    } catch (err) {
    } finally {
      setLoadingGroups(false);
    }
  };

  const fetchCurriculumSubjects = async () => {
    setLoadingCurriculum(true);
    try {
      const response = await authFetch(`${API_URL}/api/curriculum/subjects?is_active=true`, {
        headers: getAuthHeader()
      });
      if (response.ok) {
        const data = await response.json();
        setCurriculumSubjects(Array.isArray(data) ? data : []);
      }
    } catch (err) {
    } finally {
      setLoadingCurriculum(false);
    }
  };

  const filterClassLevels = teacherClassLevels.length > 0 
    ? teacherClassLevels 
    : [...new Set(curriculumSubjects.map(s => s.class_level))].sort((a, b) => a - b);
  const filterSubjectNames = teacherSubjects.length > 0 
    ? teacherSubjects 
    : [...new Set(curriculumSubjects.map(s => s.subject_name))].sort();

  const fetchTests = async () => {
    try {
      setLoading(true);
      let url = `${API_URL}/api/assessments?`;
      if (filterClass) url += `class_level=${filterClass}&`;
      if (filterSubject) url += `subject=${filterSubject}&`;

      const response = await authFetch(url, {
        headers: getAuthHeader()
      });

      if (!response.ok) throw new Error("Failed to fetch tests");
      const data = await response.json();
      const testsData = data.assessments || [];
      setTests(testsData);
      calculateStats(testsData);
    } catch (err) {
      setTests([]);
      setStats({ total_tests: 0, active_tests: 0, total_submissions: 0, pending_review: 0 });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (testsData) => {
    if (!testsData || testsData.length === 0) {
      setStats({ total_tests: 0, active_tests: 0, total_submissions: 0, total_students: 0 });
      return;
    }

    let active_tests = 0;
    let total_submissions = 0;

    testsData.forEach(test => {
      const status = getTestStatus(test);
      if (status === 'active') active_tests++;
      total_submissions += test.submission_count || 0;
    });

    const totalStudents = teacherGroups.reduce((sum, group) => sum + (group.student_count || 0), 0);

    setStats({
      total_tests: testsData.length,
      active_tests,
      total_submissions,
      total_students: totalStudents
    });
  };

  const fetchSubmissions = async (testId) => {
    try {
      setLoadingSubmissions(true);
      
      const response = await authFetch(`${API_URL}/api/assessments/${testId}/submissions`, {
        headers: getAuthHeader()
      });
      if (!response.ok) throw new Error("Failed to fetch submissions");
      const data = await response.json();
      setSubmissions(data.submissions || []);
    } catch (err) {
      setSubmissions([]);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleTestClick = (test) => {
    setSelectedTest(test);
    fetchSubmissions(test.id);
  };

  const handleDeleteTest = async (testId) => {
    if (!confirm("Delete this test and all submissions?")) return;
    
    const deletedTest = tests.find(t => t.id === testId);
    const updatedTests = tests.filter(t => t.id !== testId);
    setTests(updatedTests);
    calculateStats(updatedTests);
    if (selectedTest?.id === testId) {
      setSelectedTest(null);
      setSubmissions([]);
    }
    
    try {
      const response = await authFetch(`${API_URL}/api/assessments/${testId}`, { 
        method: "DELETE",
        headers: getAuthHeader()
      });
      if (!response.ok) {
        
        throw new Error("Failed to delete test");
      }
    } catch (err) {
      
      alert("Error: " + err.message);
      const revertedTests = [...updatedTests, deletedTest].sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      setTests(revertedTests);
      calculateStats(revertedTests);
    }
  };

  const handleSaveComment = async () => {
    if (!comment.trim()) return alert("Please enter a comment");
    setSavingComment(true);
    try {
      const response = await authFetch(`${API_URL}/api/assessments/submissions/${selectedSubmission.id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ comment: comment.trim() })
      });
      if (!response.ok) throw new Error("Failed");
      setSubmissions(submissions.map(s => s.id === selectedSubmission.id ? { ...s, admin_comment: comment, is_reviewed: true } : s));
      setShowCommentModal(false); setSelectedSubmission(null); setComment("");
      alert("Comment saved and student notified!");
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSavingComment(false);
    }
  };

  const handleViewSubmission = async (sub) => {
    setLoadingDetail(true);
    setShowDetailModal(true);
    try {
      const response = await authFetch(`${API_URL}/api/assessments/submissions/${sub.id}/detail`, {
        headers: getAuthHeader()
      });
      if (!response.ok) throw new Error("Failed to load submission");
      const data = await response.json();
      setSubmissionDetail(data);
      // Initialize grading scores for 2+ mark questions that haven't been graded
      const grades = {};
      (data.questions || []).forEach(q => {
        if (q.points > 1) {
          const existingScore = data.answers?.[q.id]?.points_awarded;
          grades[q.id] = existingScore ?? 0;
        }
      });
      setQuestionGrades(grades);
      setGradingFeedback(data.admin_comment || "");
    } catch (err) {
      alert("Error loading submission details");
      setShowDetailModal(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSubmitGrades = async () => {
    if (!submissionDetail) return;
    setSavingGrades(true);
    try {
      const response = await authFetch(`${API_URL}/api/assessments/submissions/${submissionDetail.id}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          question_grades: questionGrades,
          overall_feedback: gradingFeedback || null
        })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to submit grades");
      }
      const updated = await response.json();
      setSubmissionDetail(prev => ({
        ...prev,
        total_score: updated.total_score,
        percentage: updated.percentage,
        passed: updated.passed,
        status: updated.status
      }));
      setSubmissions(prev => prev.map(s => s.id === submissionDetail.id
        ? { ...s, status: "graded", total_score: updated.total_score, percentage: updated.percentage }
        : s
      ));

      // Extract unique topics from questions for the topic quiz
      const topicSet = new Set();
      (submissionDetail.questions || []).forEach(q => {
        const t = q.topic || q.chapter_name || q.subject || "";
        if (t) topicSet.add(t);
      });
      // If no topics tagged, fall back to subject/class grouping
      if (topicSet.size === 0 && submissionDetail.questions?.length > 0) {
        topicSet.add(submissionDetail.assessment_title || "General");
      }
      if (topicSet.size > 0) {
        setTopicQuizSubmissionId(submissionDetail.id);
        setTopicQuizTopics(Array.from(topicSet));
        const initAssessments = {};
        Array.from(topicSet).forEach(t => { initAssessments[t] = "moderate"; });
        setTopicAssessments(initAssessments);
        setTopicNotes("");
        setShowTopicQuiz(true);
      } else {
        alert("Grades submitted successfully!");
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSavingGrades(false);
    }
  };

  const handleSaveTopicAnalytics = async () => {
    if (!topicQuizSubmissionId) return;
    setSavingTopicAnalytics(true);
    try {
      await authFetch(`${API_URL}/api/assessments/submissions/${topicQuizSubmissionId}/topic-analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ topic_assessments: topicAssessments, evaluator_notes: topicNotes })
      });
    } catch (_) { /* non-critical */ }
    setShowTopicQuiz(false);
    alert("Grades and topic insights saved!");
    setSavingTopicAnalytics(false);
  };

  const getTestStatus = (test) => {
    const now = new Date();

    // Check start_datetime first — if in the future, always upcoming
    if (test.start_datetime) {
      const start = new Date(test.start_datetime.replace(' ', 'T'));
      if (!isNaN(start.valueOf()) && now < start) return 'upcoming';
    }

    // Check end_datetime — if past, completed
    if (test.end_datetime) {
      const end = new Date(test.end_datetime.replace(' ', 'T'));
      if (!isNaN(end.valueOf()) && now > end) return 'completed';
    }

    // No datetime fields at all → fall back to stored status
    if (!test.start_datetime && !test.end_datetime) {
      return test.status === 'published' ? 'active' : (test.status || 'draft');
    }

    // Has datetime(s) and we're in the window → active
    return 'active';
  };

  const getStatusBadge = (testStatus) => {
    const styles = {
      active: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
      upcoming: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
      completed: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
      closed: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
      published: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
      draft: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[testStatus] || styles.closed}`}>{testStatus}</span>;
  };

  const handlePublishTest = async (testId) => {
    if (!confirm("Publish this draft test? Students will be able to see it.")) return;
    try {
      const response = await authFetch(`${API_URL}/api/assessments/${testId}/publish`, {
        method: "POST",
        headers: getAuthHeader()
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to publish");
      }
      setTests(prev => prev.map(t => t.id === testId ? { ...t, status: "published" } : t));
      if (selectedTest?.id === testId) setSelectedTest(prev => ({ ...prev, status: "published" }));
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const displayedTests = filterStatus
    ? tests.filter(t => {
        const s = getTestStatus(t);
        if (filterStatus === "active") return s === "active";
        if (filterStatus === "upcoming") return s === "upcoming";
        if (filterStatus === "closed") return s === "completed" || s === "closed";
        if (filterStatus === "draft") return t.status === "draft";
        return true;
      })
    : tests;

  return (
    <>
    <AdminLayout title="Test Management" icon={ClipboardList}>
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.total_tests}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Tests</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.active_tests}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Active Tests</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.total_submissions}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Submissions</p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-wrap gap-4 justify-between items-center">
          <div className="flex flex-wrap gap-3">
            <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white">
              <option value="">All Classes</option>
              {(loadingGroups && loadingCurriculum) ? (
                <option disabled>Loading...</option>
              ) : (
                filterClassLevels.map(c => <option key={c} value={c}>Class {c}</option>)
              )}
            </select>
            <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white">
              <option value="">All Subjects</option>
              {(loadingGroups && loadingCurriculum) ? (
                <option disabled>Loading...</option>
              ) : filterSubjectNames.length > 0 ? (
                filterSubjectNames.map(s => <option key={s} value={s}>{s}</option>)
              ) : (
                <option disabled>No subjects available</option>
              )}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="upcoming">Upcoming</option>
              <option value="closed">Completed</option>
              <option value="draft">Draft</option>
            </select>
          </div>
          <button onClick={() => navigate("/create-test")}
            className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 flex items-center gap-2 font-medium">
            <Plus className="w-4 h-4" /> Create Test
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Tests ({displayedTests.length}{filterStatus ? ` of ${tests.length}` : ""})</h2>
          {loading ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <LoadingSpinner text="Loading tests…" />
            </div>
          ) : tests.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <ClipboardList className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No tests found</p>
            </div>
          ) : displayedTests.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <ClipboardList className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No tests match the selected filters</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayedTests.map(test => (
                <div key={test.id} onClick={() => handleTestClick(test)}
                  className={`bg-white dark:bg-gray-800 p-4 rounded-xl border cursor-pointer transition hover:shadow-md
                    ${selectedTest?.id === test.id ? "border-gray-900 dark:border-white ring-1 ring-gray-900 dark:ring-white" : "border-gray-200 dark:border-gray-700"}`}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-gray-900 dark:text-white">{test.title}</h3>
                    {getStatusBadge(getTestStatus(test))}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                    <p>Class {test.class_level} • {test.subject}</p>
                    <p>{test.submission_count} submissions</p>
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <button onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/test/edit/${test.id}`);
                    }}
                      className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 flex items-center gap-1">
                      <Edit2 className="w-3 h-3" /> Edit
                    </button>
                    {test.status === "draft" && (
                      <button onClick={e => { e.stopPropagation(); handlePublishTest(test.id); }}
                        className="text-xs px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded hover:bg-green-100 dark:hover:bg-green-900/30 flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Publish
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); handleDeleteTest(test.id); }}
                      className="text-xs px-2 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {selectedTest ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedTest.title}</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Class {selectedTest.class_level} • {selectedTest.subject}</p>
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-4">Submissions ({submissions.length})</h3>
              {loadingSubmissions ? (
                <div className="py-8"><LoadingSpinner text="Loading submissions…" /></div>
              ) : submissions.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">No submissions yet</div>
              ) : (
                <div className="space-y-3">
                  {submissions.map(sub => (
                    <div key={sub.id} className="border border-gray-100 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 dark:text-white">{sub.student_name}</p>
                            {sub.status === "submitted" && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                                Needs Grading
                              </span>
                            )}
                            {sub.status === "graded" && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                Graded
                              </span>
                            )}
                            {sub.status === "in_progress" && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                In Progress
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Score: {sub.total_score}/{sub.max_score} ({sub.percentage}%)
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">Submitted: {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : "—"}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleViewSubmission(sub)}
                            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> View
                          </button>
                          <button onClick={() => { setSelectedSubmission(sub); setComment(sub.admin_comment || ""); setShowCommentModal(true); }}
                            className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 ${sub.is_reviewed
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"}`}>
                            <MessageSquare className="w-3 h-3" /> {sub.is_reviewed ? "Edit" : "Comment"}
                          </button>
                        </div>
                      </div>
                      {sub.admin_comment && (
                        <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <p className="text-sm text-green-800 dark:text-green-300"><strong>Comment:</strong> {sub.admin_comment}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
              <ClipboardList className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Select a test to view submissions</p>
            </div>
          )}
        </div>
      </div>

      {showCommentModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg mx-4 border dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Feedback for {selectedSubmission.student_name}</h2>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={6}
              className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white mb-4"
              placeholder="Enter feedback..." />
            <div className="flex gap-3">
              <button onClick={() => { setShowCommentModal(false); setSelectedSubmission(null); }}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300">Cancel</button>
              <button onClick={handleSaveComment} disabled={savingComment || !comment.trim()}
                className="flex-1 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg disabled:opacity-50 font-medium">
                {savingComment ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-3xl mx-auto border dark:border-gray-700 my-8">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {submissionDetail?.assessment_title || "Submission Detail"}
                </h2>
                {submissionDetail && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {submissionDetail.student_name} • Score: {submissionDetail.total_score}/{submissionDetail.max_score} ({submissionDetail.percentage}%)
                  </p>
                )}
              </div>
              <button onClick={() => { setShowDetailModal(false); setSubmissionDetail(null); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
            </div>
            
            {loadingDetail ? (
              <div className="p-12 text-center">
                <LoadingSpinner size="lg" text="Loading submission…" />
              </div>
            ) : submissionDetail ? (
              <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{submissionDetail.percentage}%</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Score</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {submissionDetail.passed ? "Passed" : "Failed"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Result</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {submissionDetail.time_spent_seconds ? Math.round(submissionDetail.time_spent_seconds / 60) + "m" : "N/A"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Time</p>
                  </div>
                </div>

                {submissionDetail.admin_comment && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-sm text-green-800 dark:text-green-300"><strong>Feedback:</strong> {submissionDetail.admin_comment}</p>
                  </div>
                )}

                {/* Pending grading notice */}
                {submissionDetail.status === "submitted" && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                      This submission has 2/5-mark questions pending manual evaluation. Score the questions below and submit grades.
                    </p>
                  </div>
                )}

                <h3 className="text-base font-semibold text-gray-900 dark:text-white mt-4">Questions & Answers</h3>
                {submissionDetail.questions.map((q, idx) => {
                  const answer = submissionDetail.answers[q.id] || {};
                  const evalDetail = (submissionDetail.evaluation_details || []).find(e => e.question_id === q.id);
                  const isCorrect = answer.is_correct;
                  const isHighMark = q.points > 1;
                  const needsGrading = isHighMark && submissionDetail.status === "submitted";
                  
                  return (
                    <div key={q.id || idx} className={`border rounded-lg p-4 ${
                      needsGrading ? "border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10" :
                      isCorrect === true ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10" :
                      isCorrect === false ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10" :
                      "border-gray-200 dark:border-gray-700"
                    }`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            Q{idx + 1}. {q.text || q.question_text}
                          </p>
                          {isHighMark && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                              {q.points} marks
                            </span>
                          )}
                          {!isHighMark && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                              1 mark (auto)
                            </span>
                          )}
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          isCorrect === true ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" :
                          isCorrect === false ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" :
                          "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                        }`}>
                          {answer.points_awarded ?? (isHighMark ? (questionGrades[q.id] || 0) : 0)}/{q.points} pts
                        </span>
                      </div>
                      
                      {q.type === "mcq" && q.options && (
                        <div className="space-y-1 mt-2">
                          {q.options.map((opt, oi) => {
                            const optText = typeof opt === 'object' ? opt.text : opt;
                            const optId = typeof opt === 'object' ? opt.id : oi;
                            const isSelected = answer.selected_option === oi || answer.selected_option === opt ||
                              (answer.selected_option_ids && answer.selected_option_ids.includes(optId));
                            const isCorrectOpt = typeof opt === 'object' ? opt.is_correct : (opt === q.correct_answer_text);
                            return (
                              <div key={oi} className={`text-xs px-2 py-1 rounded ${
                                isSelected && isCorrectOpt ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200" :
                                isSelected && !isCorrectOpt ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200" :
                                isCorrectOpt ? "bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400" :
                                "text-gray-600 dark:text-gray-400"
                              }`}>
                                {String.fromCharCode(65 + oi)}. {optText}
                                {isSelected && " (Selected)"}
                                {isCorrectOpt && " ✓"}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {(q.type === "short_answer" || q.type === "long_answer" || q.type === "essay" || q.type === "subjective" || q.type === "fill_blank" || q.type === "fillup") && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Student's Answer:</p>
                          {(answer.answer_text || answer.text_answer) ? (
                            <p className={`text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-700/50 p-2 rounded whitespace-pre-wrap ${
                              q.type === "long_answer" || q.type === "essay" ? "min-h-[60px]" : ""
                            }`}>
                              {answer.answer_text || answer.text_answer}
                            </p>
                          ) : (
                            <p className="text-sm italic text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50 p-2 rounded">No answer provided</p>
                          )}
                          {(q.correct_answer_text || q.answer_text) && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Expected Answer:</p>
                              <p className="text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 p-2 rounded">
                                {q.correct_answer_text || q.answer_text}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {q.type === "true_false" && (
                        <p className="text-sm mt-1 text-gray-700 dark:text-gray-300">
                          Answer: <strong>{answer.bool_answer !== undefined ? String(answer.bool_answer) : (answer.answer_bool !== undefined ? String(answer.answer_bool) : "N/A")}</strong>
                        </p>
                      )}
                      
                      {(evalDetail?.feedback || answer.feedback) && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                          {evalDetail?.feedback || answer.feedback}
                        </p>
                      )}
                      
                      {/* Manual grading input for 2/5-mark questions */}
                      {isHighMark && submissionDetail.status === "submitted" && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-3">
                            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              Award Score:
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={q.points}
                              value={questionGrades[q.id] ?? 0}
                              onChange={(e) => {
                                const val = Math.min(Math.max(0, parseInt(e.target.value) || 0), q.points);
                                setQuestionGrades(prev => ({ ...prev, [q.id]: val }));
                              }}
                              className="w-20 px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-center"
                            />
                            <span className="text-xs text-gray-500 dark:text-gray-400">/ {q.points}</span>
                            <div className="flex gap-1 ml-2">
                              <button
                                onClick={() => setQuestionGrades(prev => ({ ...prev, [q.id]: 0 }))}
                                className="px-2 py-0.5 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded hover:bg-red-100"
                              >0</button>
                              {q.points > 2 && (
                                <button
                                  onClick={() => setQuestionGrades(prev => ({ ...prev, [q.id]: Math.floor(q.points / 2) }))}
                                  className="px-2 py-0.5 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded hover:bg-amber-100"
                                >{Math.floor(q.points / 2)}</button>
                              )}
                              <button
                                onClick={() => setQuestionGrades(prev => ({ ...prev, [q.id]: q.points }))}
                                className="px-2 py-0.5 text-xs bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded hover:bg-green-100"
                              >{q.points}</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Grading submit section */}
                {submissionDetail.status === "submitted" && Object.keys(questionGrades).length > 0 && (
                  <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Manual Score: {Object.values(questionGrades).reduce((s, v) => s + v, 0)} / {submissionDetail.questions.filter(q => q.points > 1).reduce((s, q) => s + q.points, 0)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Auto-graded (1-mark): {submissionDetail.total_score || 0} pts
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Overall Feedback (optional)
                      </label>
                      <textarea
                        value={gradingFeedback}
                        onChange={(e) => setGradingFeedback(e.target.value)}
                        placeholder="Add overall feedback for the student..."
                        rows={2}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white"
                      />
                    </div>
                    <button
                      onClick={handleSubmitGrades}
                      disabled={savingGrades}
                      className="w-full px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 font-medium"
                    >
                      {savingGrades ? "Submitting Grades..." : "Submit Grades"}
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </AdminLayout>

      {/* Topic Analytics Quiz Modal */}
      {showTopicQuiz && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl border dark:border-gray-700 shadow-2xl">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Topic Performance Assessment</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Based on the student's answers, rate their understanding of each topic. This feeds their personal analytics.
              </p>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {topicQuizTopics.map((topic) => (
                <div key={topic} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white mb-3">{topic}</p>
                  <div className="flex gap-2">
                    {["strong", "moderate", "weak"].map((level) => {
                      const selected = topicAssessments[topic] === level;
                      const colors = {
                        strong: selected
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white dark:bg-gray-700 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20",
                        moderate: selected
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-white dark:bg-gray-700 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20",
                        weak: selected
                          ? "bg-red-600 text-white border-red-600"
                          : "bg-white dark:bg-gray-700 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20",
                      };
                      const labels = { strong: "✓ Strong", moderate: "~ Moderate", weak: "✗ Needs Work" };
                      return (
                        <button
                          key={level}
                          onClick={() => setTopicAssessments(prev => ({ ...prev, [topic]: level }))}
                          className={`flex-1 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${colors[level]}`}
                        >
                          {labels[level]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Additional Notes (optional)
                </label>
                <textarea
                  value={topicNotes}
                  onChange={(e) => setTopicNotes(e.target.value)}
                  rows={2}
                  placeholder="Any overall observations about the student's understanding..."
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => { setShowTopicQuiz(false); alert("Grades submitted successfully!"); }}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Skip
              </button>
              <button
                onClick={handleSaveTopicAnalytics}
                disabled={savingTopicAnalytics}
                className="flex-1 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50"
              >
                {savingTopicAnalytics ? "Saving..." : "Save Topic Analytics"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}