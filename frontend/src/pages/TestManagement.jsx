/**
 * TestManagement - Admin page to manage tests and submissions
 * Uses AdminLayout with light/dark theme support
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import { ClipboardList, Plus, Trash2, Edit2, FileText, MessageSquare, Search, ExternalLink } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function TestManagement() {
  const navigate = useNavigate();
  const { user, getAuthHeader } = useUserStore();
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

  // Submission detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [submissionDetail, setSubmissionDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Teacher's groups and subjects
  const [teacherGroups, setTeacherGroups] = useState([]);
  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [teacherClassLevels, setTeacherClassLevels] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // Curriculum data (for admin fallback)
  const [curriculumSubjects, setCurriculumSubjects] = useState([]);
  const [loadingCurriculum, setLoadingCurriculum] = useState(true);

  useEffect(() => {
    fetchTeacherGroups();
    fetchCurriculumSubjects();
  }, []);

  useEffect(() => {
    fetchTests();
  }, [filterClass, filterSubject, filterStatus]);

  // Recalculate stats when teacher groups change
  useEffect(() => {
    if (tests.length > 0 && teacherGroups.length > 0) {
      calculateStats(tests);
    }
  }, [teacherGroups]);

  // Auto-refresh on window focus
  useEffect(() => {
    const handleFocus = () => {
      fetchTests();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [filterClass, filterSubject, filterStatus]);

  const fetchTeacherGroups = async () => {
    try {
      setLoadingGroups(true);
      const response = await fetch(`${API_URL}/api/teacher/groups`, {
        headers: getAuthHeader()
      });
      if (response.ok) {
        const data = await response.json();
        const groups = data.groups || [];
        setTeacherGroups(groups);
        
        // Extract unique subjects and class levels from groups
        const subjects = [...new Set(groups.map(g => g.subject).filter(Boolean))];
        setTeacherSubjects(subjects.sort());
        const classes = [...new Set(groups.map(g => g.class_level).filter(Boolean))];
        setTeacherClassLevels(classes.sort((a, b) => a - b));
      }
    } catch (err) {
      console.error("Failed to fetch teacher groups:", err);
    } finally {
      setLoadingGroups(false);
    }
  };

  const fetchCurriculumSubjects = async () => {
    setLoadingCurriculum(true);
    try {
      const response = await fetch(`${API_URL}/api/curriculum/subjects?is_active=true`, {
        headers: getAuthHeader()
      });
      if (response.ok) {
        const data = await response.json();
        setCurriculumSubjects(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch curriculum subjects:", err);
    } finally {
      setLoadingCurriculum(false);
    }
  };

  // Derive dynamic filter options: use teacher groups if available, otherwise curriculum
  const filterClassLevels = teacherClassLevels.length > 0 
    ? teacherClassLevels 
    : [...new Set(curriculumSubjects.map(s => s.class_level))].sort((a, b) => a - b);
  const filterSubjectNames = teacherSubjects.length > 0 
    ? teacherSubjects 
    : [...new Set(curriculumSubjects.map(s => s.subject_name))].sort();

  const fetchTests = async () => {
    try {
      setLoading(true);
      let url = `${API_URL}/api/assessments?`; // Changed from /api/tests/admin
      if (filterClass) url += `class_level=${filterClass}&`;
      if (filterSubject) url += `subject=${filterSubject}&`;
      if (filterStatus) url += `status=${filterStatus}&`;

      const response = await fetch(url, {
        headers: getAuthHeader()
      });

      if (!response.ok) throw new Error("Failed to fetch tests");
      const data = await response.json();
      const testsData = data.assessments || [];
      setTests(testsData);
      calculateStats(testsData);
    } catch (err) {
      console.error(err);
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

    const now = new Date();
    let active_tests = 0;
    let total_submissions = 0;

    testsData.forEach(test => {
      const status = getTestStatus(test);
      if (status === 'active') active_tests++;
      total_submissions += test.submission_count || 0;
    });

    // Count total students from teacher's groups
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
      // Using new assessment submissions endpoint
      const response = await fetch(`${API_URL}/api/assessments/${testId}/submissions`, {
        headers: getAuthHeader()
      });
      if (!response.ok) throw new Error("Failed to fetch submissions");
      const data = await response.json();
      setSubmissions(data.submissions || []);
    } catch (err) {
      console.error(err);
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
    
    // Optimistic update: Remove immediately from UI
    const deletedTest = tests.find(t => t.id === testId);
    const updatedTests = tests.filter(t => t.id !== testId);
    setTests(updatedTests);
    calculateStats(updatedTests);
    if (selectedTest?.id === testId) {
      setSelectedTest(null);
      setSubmissions([]);
    }
    
    try {
      const response = await fetch(`${API_URL}/api/assessments/${testId}`, { 
        method: "DELETE",
        headers: getAuthHeader()
      });
      if (!response.ok) {
        // Revert on failure
        throw new Error("Failed to delete test");
      }
    } catch (err) {
      // Revert optimistic update
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
      const response = await fetch(`${API_URL}/api/assessments/submissions/${selectedSubmission.id}/comment`, {
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
      const response = await fetch(`${API_URL}/api/assessments/submissions/${sub.id}/detail`, {
        headers: getAuthHeader()
      });
      if (!response.ok) throw new Error("Failed to load submission");
      const data = await response.json();
      setSubmissionDetail(data);
    } catch (err) {
      console.error(err);
      alert("Error loading submission details");
      setShowDetailModal(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const getTestStatus = (test) => {
    if (!test.start_datetime || !test.end_datetime) {
      return test.status === 'published' ? 'active' : test.status;
    }
    
    const now = new Date();
    const start = new Date(test.start_datetime);
    const end = new Date(test.end_datetime);
    
    if (now < start) return 'upcoming';
    if (now > end) return 'completed';
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

  return (
    <AdminLayout title="Test Management" icon={ClipboardList}>
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.total_students}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Students</p>
          </div>
        </div>
      )}

      {/* Filters */}
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
              <option value="closed">Closed</option>
            </select>
          </div>
          <button onClick={() => navigate("/create-test")}
            className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 flex items-center gap-2 font-medium">
            <Plus className="w-4 h-4" /> Create Test
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Test List */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Tests ({tests.length})</h2>
          {loading ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gray-900 dark:border-white mx-auto"></div>
            </div>
          ) : tests.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <ClipboardList className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No tests found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tests.map(test => (
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
                  <div className="flex gap-2 mt-3">
                    <button onClick={(e) => {
                      e.stopPropagation();
                      console.log("Edit clicked:", test.id);
                      navigate(`/test/edit/${test.id}`);
                    }}
                      className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 flex items-center gap-1">
                      <Edit2 className="w-3 h-3" /> Edit
                    </button>
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

        {/* Submissions Panel */}
        <div className="lg:col-span-2">
          {selectedTest ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedTest.title}</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Class {selectedTest.class_level} • {selectedTest.subject}</p>
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-4">Submissions ({submissions.length})</h3>
              {loadingSubmissions ? (
                <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gray-900 dark:border-white mx-auto"></div></div>
              ) : submissions.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">No submissions yet</div>
              ) : (
                <div className="space-y-3">
                  {submissions.map(sub => (
                    <div key={sub.id} className="border border-gray-100 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{sub.student_name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{sub.student_user_id}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">Submitted: {new Date(sub.submitted_at).toLocaleString()}</p>
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

      {/* Comment Modal */}
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

      {/* Submission Detail Modal */}
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
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gray-900 dark:border-white mx-auto"></div>
              </div>
            ) : submissionDetail ? (
              <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
                {/* Summary */}
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

                {/* Admin comment */}
                {submissionDetail.admin_comment && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-sm text-green-800 dark:text-green-300"><strong>Feedback:</strong> {submissionDetail.admin_comment}</p>
                  </div>
                )}

                {/* Questions & Answers */}
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mt-4">Questions & Answers</h3>
                {submissionDetail.questions.map((q, idx) => {
                  const answer = submissionDetail.answers[q.id] || {};
                  const evalDetail = (submissionDetail.evaluation_details || []).find(e => e.question_id === q.id);
                  const isCorrect = answer.is_correct;
                  
                  return (
                    <div key={q.id || idx} className={`border rounded-lg p-4 ${
                      isCorrect === true ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10" :
                      isCorrect === false ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10" :
                      "border-gray-200 dark:border-gray-700"
                    }`}>
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Q{idx + 1}. {q.text}
                        </p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          isCorrect === true ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" :
                          isCorrect === false ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" :
                          "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                        }`}>
                          {answer.points_awarded ?? 0}/{q.points} pts
                        </span>
                      </div>
                      
                      {/* MCQ options */}
                      {q.type === "mcq" && q.options && (
                        <div className="space-y-1 mt-2">
                          {q.options.map((opt, oi) => {
                            const isSelected = answer.selected_option === oi || answer.selected_option === opt;
                            const isCorrectOpt = opt === q.correct_answer_text || oi === q.correct_answer_text;
                            return (
                              <div key={oi} className={`text-xs px-2 py-1 rounded ${
                                isSelected && isCorrect ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200" :
                                isSelected && !isCorrect ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200" :
                                "text-gray-600 dark:text-gray-400"
                              }`}>
                                {String.fromCharCode(65 + oi)}. {typeof opt === 'object' ? opt.text : opt}
                                {isSelected && " (Selected)"}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* Text answers */}
                      {(q.type === "short_answer" || q.type === "essay") && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Student's Answer:</p>
                          <p className="text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                            {answer.text_answer || answer.answer_text || "No answer provided"}
                          </p>
                        </div>
                      )}
                      
                      {/* True/False */}
                      {q.type === "true_false" && (
                        <p className="text-sm mt-1 text-gray-700 dark:text-gray-300">
                          Answer: <strong>{answer.bool_answer !== undefined ? String(answer.bool_answer) : "N/A"}</strong>
                        </p>
                      )}
                      
                      {/* Evaluation feedback */}
                      {(evalDetail?.feedback || answer.feedback) && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                          {evalDetail?.feedback || answer.feedback}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
