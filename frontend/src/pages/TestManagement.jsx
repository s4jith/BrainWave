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

  useEffect(() => {
    fetchTests();
    fetchStats();
  }, [filterClass, filterSubject, filterStatus]);

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
      setTests(data.assessments || []); // Handle { assessments: [], total: 0 } structure
    } catch (err) {
      console.error(err);
      setTests([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    // Stats endpoint might also need updating or removal if not available in assessments
    // For now keeping catch block to avoid crash
    try {
      const response = await fetch(`${API_URL}/api/tests/stats/overview`, {
        headers: getAuthHeader()
      });
      if (response.ok) setStats(await response.json());
    } catch (err) {
      console.error(err);
    }
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
    try {
      const response = await fetch(`${API_URL}/api/tests/${testId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed");
      setTests(tests.filter(t => t.id !== testId));
      if (selectedTest?.id === testId) { setSelectedTest(null); setSubmissions([]); }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleSaveComment = async () => {
    if (!comment.trim()) return alert("Please enter a comment");
    setSavingComment(true);
    try {
      const response = await fetch(`${API_URL}/api/tests/submissions/${selectedSubmission.id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: comment.trim() })
      });
      if (!response.ok) throw new Error("Failed");
      setSubmissions(submissions.map(s => s.id === selectedSubmission.id ? { ...s, admin_comment: comment, is_reviewed: true } : s));
      setShowCommentModal(false); setSelectedSubmission(null); setComment("");
      alert("Comment saved!");
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSavingComment(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
      upcoming: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
      closed: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.closed}`}>{status}</span>;
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
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.pending_review}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Pending Review</p>
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
              {[5, 6, 7, 8, 9, 10, 11, 12].map(c => <option key={c} value={c}>Class {c}</option>)}
            </select>
            <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white">
              <option value="">All Subjects</option>
              {["Mathematics", "Science", "English", "Hindi", "Physics", "Chemistry", "Biology"].map(s => <option key={s} value={s}>{s}</option>)}
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
                    {getStatusBadge(test.status)}
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
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedTest.title}</h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Class {selectedTest.class_level} • {selectedTest.subject}</p>
                </div>
                <a href={`${API_URL}${selectedTest.pdf_url}`} target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2 text-sm font-medium">
                  <FileText className="w-4 h-4" /> View PDF
                </a>
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
                          <a href={`${API_URL}${sub.pdf_url}`} target="_blank" rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> View
                          </a>
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
    </AdminLayout>
  );
}
