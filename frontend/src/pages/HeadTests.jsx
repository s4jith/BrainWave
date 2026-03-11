import { useState, useEffect, useCallback } from "react";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  ClipboardList, Search, FileText, Calendar, Users,
  ChevronDown, Eye, Clock, CheckCircle, AlertCircle, BookOpen
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function HeadTests() {
  const { getAuthHeader } = useUserStore();

  // Assignment info from /api/head/my-assignment
  const [assignment, setAssignment] = useState(null);
  const [loadingAssignment, setLoadingAssignment] = useState(true);

  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Only one dropdown shown at a time depending on assignment_type:
  // class-assigned → Subject dropdown   (filter within their fixed classes)
  // subject-assigned → Class dropdown   (filter within their fixed subjects)
  const [filterSubject, setFilterSubject] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [availableSubjects, setAvailableSubjects] = useState([]); // populated for class-assigned heads
  const [availableClasses, setAvailableClasses] = useState([]);   // populated for subject-assigned heads

  const [selectedTest, setSelectedTest] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Fetch assignment info on mount
  useEffect(() => {
    const fetchAssignment = async () => {
      try {
        setLoadingAssignment(true);
        const res = await fetch(`${API_URL}/api/head/my-assignment`, {
          headers: getAuthHeader()
        });
        if (res.ok) {
          const data = await res.json();
          setAssignment(data);
        }
      } catch (err) {
        console.error("Error fetching head assignment:", err);
      } finally {
        setLoadingAssignment(false);
      }
    };
    fetchAssignment();
  }, []);

  // Fetch tests whenever assignment is ready or a filter changes
  useEffect(() => {
    if (!assignment) return;
    fetchTests();
  }, [assignment, filterSubject, filterClass, filterStatus]);

  const fetchTests = useCallback(async () => {
    if (!assignment) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);

      if (assignment.assignment_type === "class") {
        // Class-assigned HEAD: may narrow further by subject
        if (filterSubject) params.set("subject", filterSubject);
      } else {
        // Subject-assigned HEAD: may narrow further by class
        if (filterClass) params.set("class_level", filterClass);
      }

      const res = await fetch(`${API_URL}/api/assessments`, {
        headers: getAuthHeader()
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to fetch tests");
      }

      const data = await res.json();
      let testsArr = Array.isArray(data.assessments) ? data.assessments : [];

      // Client-side filtering by the selected dropdowns
      if (filterStatus) testsArr = testsArr.filter(t => getTestStatus(t) === filterStatus);
      if (assignment.assignment_type === "class" && filterSubject)
        testsArr = testsArr.filter(t => t.subject && t.subject.toLowerCase() === filterSubject.toLowerCase());
      if (assignment.assignment_type === "subject" && filterClass)
        testsArr = testsArr.filter(t => String(t.class_level) === String(filterClass));
      setTests(testsArr);

      // Derive dropdown options from the returned tests
      if (assignment.assignment_type === "class") {
        const subjects = [...new Set(testsArr.map(t => t.subject).filter(Boolean))].sort();
        setAvailableSubjects(subjects);
      } else {
        const classes = [...new Set(testsArr.map(t => t.class_level).filter(Boolean))].sort((a, b) => a - b);
        setAvailableClasses(classes);
      }
    } catch (err) {
      console.error("Error fetching tests:", err);
      setTests([]);
    } finally {
      setLoading(false);
    }
  }, [assignment, filterSubject, filterClass, filterStatus, getAuthHeader]);

  const fetchSubmissions = async (testId) => {
    try {
      setLoadingSubmissions(true);
      const res = await fetch(`${API_URL}/api/tests/submissions/${testId}`, {
        headers: getAuthHeader()
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setSubmissions(Array.isArray(data) ? data : []);
    } catch {
      setSubmissions([]);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleTestClick = (test) => {
    if (selectedTest?.id === test.id) {
      setSelectedTest(null);
      setSubmissions([]);
    } else {
      setSelectedTest(test);
      fetchSubmissions(test.id);
    }
  };

  const getTestStatus = (test) => {
    const now = new Date();
    if (test.start_datetime) {
      const start = new Date(test.start_datetime.replace(' ', 'T'));
      if (!isNaN(start.valueOf()) && now < start) return 'upcoming';
    }
    if (test.end_datetime) {
      const end = new Date(test.end_datetime.replace(' ', 'T'));
      if (!isNaN(end.valueOf()) && now > end) return 'completed';
    }
    if (!test.start_datetime && !test.end_datetime) {
      return test.status === 'published' ? 'active' : (test.status || 'draft');
    }
    return 'active';
  };

  const getStatusBadge = (status) => {
    const map = {
      active:    { cls: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",  icon: <CheckCircle className="w-3.5 h-3.5" /> },
      upcoming:  { cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",  icon: <Clock       className="w-3.5 h-3.5" /> },
      closed:    { cls: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300",          icon: <AlertCircle className="w-3.5 h-3.5" /> },
      completed: { cls: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300",          icon: <AlertCircle className="w-3.5 h-3.5" /> },
      draft:     { cls: "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400",          icon: <AlertCircle className="w-3.5 h-3.5" /> },
    };
    const style = map[status] || map.closed;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.cls}`}>
        {style.icon}{status}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      });
    } catch { return dateStr; }
  };

  // Client-side text search on top of server-filtered results
  const filtered = tests.filter(t => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      t.title?.toLowerCase().includes(q) ||
      t.subject?.toLowerCase().includes(q) ||
      String(t.class_level).includes(q)
    );
  });

  const totalActive      = tests.filter(t => getTestStatus(t) === "active").length;
  const totalUpcoming    = tests.filter(t => getTestStatus(t) === "upcoming").length;
  const totalSubmissions = tests.reduce((sum, t) => sum + (t.submission_count || 0), 0);

  const assignmentType = assignment?.assignment_type ?? "class";
  const scopeChips = assignmentType === "class"
    ? (assignment?.assigned_classes || []).map(c => `Class ${c}`)
    : (assignment?.assigned_subjects || []);

  if (loadingAssignment) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <ClipboardList className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tests</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {assignmentType === "class"
                ? "All subjects · filter by subject below"
                : "All classes · filter by class below"}
            </p>
          </div>
        </div>

        {/* Assignment scope chips */}
        {scopeChips.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <BookOpen className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Assigned scope:</span>
            {scopeChips.map(chip => (
              <span key={chip} className="px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium">
                {chip}
              </span>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <ClipboardList className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Tests</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{tests.length}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4">
            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Active / Upcoming</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalActive + totalUpcoming}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Submissions</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalSubmissions}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by title or subject..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Subject dropdown — only for class-assigned heads */}
            {assignmentType === "class" && (
              <div className="relative">
                <select
                  value={filterSubject}
                  onChange={e => { setFilterSubject(e.target.value); }}
                  className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Subjects</option>
                  {availableSubjects.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            )}

            {/* Class dropdown — only for subject-assigned heads */}
            {assignmentType === "subject" && (
              <div className="relative">
                <select
                  value={filterClass}
                  onChange={e => { setFilterClass(e.target.value); }}
                  className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Classes</option>
                  {availableClasses.map(c => (
                    <option key={c} value={c}>Class {c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            )}

            {/* Status filter */}
            <div className="relative">
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="upcoming">Upcoming</option>
                <option value="closed">Closed</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Test List */}
        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <ClipboardList className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">No tests found</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Tests created by admin for {scopeChips.join(", ")} will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(test => (
              <div key={test.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">

                {/* Test row */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  onClick={() => handleTestClick(test)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">{test.title}</h3>
                      {getStatusBadge(getTestStatus(test))}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        Class {test.class_level} · {test.subject}
                      </span>
                      {test.is_timed && test.start_datetime && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(test.start_datetime)}
                          {test.end_datetime && <> → {formatDate(test.end_datetime)}</>}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {test.submission_count || 0} submissions
                      </span>
                    </div>
                    {test.description && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">{test.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`${API_URL}${test.pdf_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View PDF
                    </a>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${selectedTest?.id === test.id ? "rotate-180" : ""}`} />
                  </div>
                </div>

                {/* Expanded submissions panel */}
                {selectedTest?.id === test.id && (
                  <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Student Submissions ({submissions.length})
                    </h4>
                    {loadingSubmissions ? (
                      <div className="flex justify-center py-4"><LoadingSpinner /></div>
                    ) : submissions.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No submissions yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                              <th className="pb-2 pr-4">Student</th>
                              <th className="pb-2 pr-4">Submitted At</th>
                              <th className="pb-2 pr-4">Feedback</th>
                              <th className="pb-2">PDF</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {submissions.map(sub => (
                              <tr key={sub.id} className="text-gray-700 dark:text-gray-300">
                                <td className="py-2 pr-4 font-medium">{sub.student_name || sub.student_id}</td>
                                <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">{formatDate(sub.submitted_at)}</td>
                                <td className="py-2 pr-4">
                                  {sub.is_reviewed
                                    ? <span className="text-xs text-green-600 dark:text-green-400 font-medium">Reviewed</span>
                                    : <span className="text-xs text-amber-500">Pending</span>}
                                </td>
                                <td className="py-2">
                                  <a
                                    href={`${API_URL}${sub.pdf_url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline text-xs"
                                  >
                                    <Eye className="w-3 h-3" /> View
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

