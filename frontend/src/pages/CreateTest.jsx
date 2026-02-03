/**
 * CreateTest - Page to create new tests/assessments
 * Uses AdminLayout with light/dark theme support
 * Matches reference design with tabs, date range, and student assignment
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import { ClipboardList, Calendar, Clock, Users, CheckCircle, XCircle, Plus, ChevronRight, FileText, AlertCircle } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const SUBJECTS = ["Mathematics", "Science", "Social Science", "English", "Hindi", "Physics", "Chemistry", "Biology"];

export default function CreateTest() {
  const navigate = useNavigate();
  const { user, getAuthHeader } = useUserStore();
  const [activeTab, setActiveTab] = useState("details");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    title: "",
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

  useEffect(() => {
    fetchGroupsAndStudents();
  }, []);

  const fetchGroupsAndStudents = async () => {
    setLoadingGroups(true);
    try {
      // Fetch groups
      const groupsRes = await fetch(`${API_URL}/api/admin/groups`, { headers: getAuthHeader() });
      if (groupsRes.ok) {
        const data = await groupsRes.json();
        setGroups(data.groups || []);
      }

      // Fetch students
      const studentsRes = await fetch(`${API_URL}/api/admin/students?limit=200`);
      if (studentsRes.ok) {
        const data = await studentsRes.json();
        setStudents(data || []);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoadingGroups(false);
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

      const response = await fetch(`${API_URL}/api/assessments/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to create test");
      }

      setSuccess("Test created and published successfully!");
      setTimeout(() => navigate("/test-management"), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout title="Create Test" icon={ClipboardList}>
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
          {loading ? "Publishing..." : "Create & Publish"}
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
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
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
              <p className="text-sm text-gray-500 dark:text-gray-400">Add questions to your test</p>
            </div>
            <button className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition font-medium flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Question
            </button>
          </div>

          {questions.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">No questions added yet</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm">Click "Add Question" to start building your test</p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <p className="font-medium text-gray-900 dark:text-white">Q{index + 1}. {q.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
