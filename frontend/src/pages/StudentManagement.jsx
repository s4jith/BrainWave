
import React, { useState, useEffect } from "react";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import LoadingSpinner from "../components/LoadingSpinner";
import { Lightbulb, CheckCircle, Plus, Download, Edit, Key, Trash2, AlertTriangle, Clipboard, Users, Search, UserPlus, ChevronDown, ChevronUp, Shield } from "lucide-react";
import authFetch from "../utils/authFetch";

import { useToast } from "../contexts/ToastContext";
const API_URL = import.meta.env.VITE_API_URL;

export default function StudentManagement() {
  const { toast } = useToast();
  const { getAuthHeader } = useUserStore();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [newCredentials, setNewCredentials] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterActive, setFilterActive] = useState("all");
  const [filterClass, setFilterClass] = useState("all");
  const [saving, setSaving] = useState(false);
  const [expandedStudentGroups, setExpandedStudentGroups] = useState({});

  const [showFeaturesModal, setShowFeaturesModal] = useState(false);
  const [featuresStudent, setFeaturesStudent] = useState(null);
  const [studentFeatures, setStudentFeatures] = useState({});
  const [savingFeatures, setSavingFeatures] = useState(false);

  const featureLabels = {
    ai_chatbot: "AI Chatbot",
    test_center: "Test Center",
    my_grades: "My Grades",
    book_to_bot: "Book to Bot",
    book_to_bot_doubt: "Book to Bot Doubt Button"
  };

  const openFeaturesModal = (student) => {
    setFeaturesStudent(student);
    setStudentFeatures(student.feature_overrides || {});
    setShowFeaturesModal(true);
  };

  const handleToggleStudentFeature = async (key, value) => {
    setStudentFeatures(prev => ({ ...prev, [key]: value }));
    
    try {
      const response = await authFetch(`${API_URL}/api/admin/students/${featuresStudent.id}/features`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ [key]: value })
      });
      if (!response.ok) throw new Error("Failed to update feature");
      
      // Update local state
      setStudents(prev => prev.map(s => 
        s.id === featuresStudent.id 
          ? { ...s, feature_overrides: { ...s.feature_overrides, [key]: value } }
          : s
      ));
    } catch (err) {
      // Revert
      setStudentFeatures(prev => ({ ...prev, [key]: !value }));
      toast.error("Error: " + err.message)
    }
  };

  const [formData, setFormData] = useState({
    name: "",
    age: 14,
    email: "",
    mobile: "",
    class_level: 10
  });

  useEffect(() => {
    fetchStudents();
  }, [filterActive, filterClass]);

  useEffect(() => {
    const handleFocus = () => {
      fetchStudents();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [filterActive, filterClass]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      let url = `${API_URL}/api/admin/students?limit=100`;
      if (filterActive !== "all") url += `&is_active=${filterActive === "active"}`;
      if (filterClass !== "all") url += `&class_level=${filterClass}`;
      const response = await authFetch(url);
      if (!response.ok) throw new Error("Failed to fetch students");
      const data = await response.json();
      setStudents(data);
    } catch (err) {
      setError(err.message);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    
    const tempId = `temp_${Date.now()}`;
    const optimisticStudent = {
      id: tempId,
      ...formData,
      is_active: true,
      groups: [],
      group_names: [],
      created_at: new Date().toISOString()
    };
    
    setStudents([optimisticStudent, ...students]);
    setShowAddModal(false);
    
    try {
      setSaving(true);
      const response = await authFetch(`${API_URL}/api/admin/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to add student");
      }
      const newStudent = await response.json();
      
      setStudents(prev => prev.map(s => s.id === tempId ? newStudent : s));
      
      if (newStudent.generated_credentials) {
        setNewCredentials(newStudent.generated_credentials);
        setShowCredentialsModal(true);
      }
      resetForm();
    } catch (err) {
      
      setStudents(prev => prev.filter(s => s.id !== tempId));
      setShowAddModal(true);
      toast.error("Error: " + err.message)
    } finally {
      setSaving(false);
    }
  };

  const handleEditStudent = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const response = await authFetch(`${API_URL}/api/admin/students/${selectedStudent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (!response.ok) throw new Error("Failed to update student");
      const updated = await response.json();
      setStudents(students.map(s => s.id === selectedStudent.id ? updated : s));
      setShowEditModal(false);
      setSelectedStudent(null);
      resetForm();
    } catch (err) {
      toast.error("Error: " + err.message)
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStudent = async (studentId) => {
    if (!confirm("Are you sure you want to delete this student?")) return;
    
    const deletedStudent = students.find(s => s.id === studentId);
    const updatedStudents = students.filter(s => s.id !== studentId);
    setStudents(updatedStudents);
    
    try {
      const response = await authFetch(`${API_URL}/api/admin/students/${studentId}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        throw new Error("Failed to delete student");
      }
    } catch (err) {
      
      toast.error("Error: " + err.message)
      setStudents([...updatedStudents, deletedStudent]);
    }
  };

  const handleResetPassword = async (student) => {
    if (!confirm(`Reset password for ${student.name}?`)) return;
    try {
      const response = await authFetch(`${API_URL}/api/admin/students/${student.id}/reset-password`, {
        method: "POST"
      });
      if (!response.ok) throw new Error("Failed to reset password");
      const result = await response.json();
      setNewCredentials({
        user_id: student.user_id,
        password: result.new_password,
        note: "Password has been reset"
      });
      setShowCredentialsModal(true);
    } catch (err) {
      toast.error("Error: " + err.message)
    }
  };

  const resetForm = () => {
    setFormData({ name: "", age: 14, email: "", mobile: "", class_level: 10 });
  };

  const openEditModal = (student) => {
    setSelectedStudent(student);
    setFormData({
      name: student.name,
      age: student.age || 14,
      email: student.email,
      mobile: student.mobile || "",
      class_level: student.class_level
    });
    setShowEditModal(true);
  };

  const exportCSV = () => {
    const headers = ["Name", "User ID", "Email", "Class", "Mobile", "Status", "Last Login"];
    const rows = students.map(s => [
      s.name, s.user_id, s.email, s.class_level, s.mobile || "",
      s.is_active ? "Active" : "Inactive",
      s.last_login ? new Date(s.last_login).toLocaleDateString() : "Never"
    ]);
    const csvContent = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students.csv";
    a.click();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.info("Copied to clipboard!")
  };

  const filteredStudents = students.filter(s =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.user_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: students.length,
    assignedToGroups: students.filter(s => s.group_names && s.group_names.length > 0).length,
    notAssigned: students.filter(s => !s.group_names || s.group_names.length === 0).length,
    active: students.filter(s => s.is_active).length
  };

  return (
    <AdminLayout title="Student Management" icon={Users}>
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
        </div>
      )}

      {}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
        <div className="flex gap-3">
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
          >
            <option value="all">All Classes</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(c => (
              <option key={c} value={c}>Class {c}</option>
            ))}
          </select>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition flex items-center gap-2 font-medium"
          >
            <UserPlus className="w-4 h-4" /> Add New User
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Students</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">In Groups</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.assignedToGroups}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Not Assigned</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.notAssigned}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900/30 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.active}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <LoadingSpinner size="lg" text="Loading students…" />
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">No students found</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition font-medium"
            >
              Add Your First Student
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Role</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Assigned Groups</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Created</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900 dark:text-white">{student.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600 dark:text-gray-300">{student.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                        <Users className="w-3 h-3" /> Student
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {student.group_names && student.group_names.length > 0 ? (
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md font-medium">
                              {student.group_names[0]}
                            </span>
                            {student.group_names.length > 1 && (
                              <button
                                onClick={() => setExpandedStudentGroups(prev => ({ ...prev, [student.id]: !prev[student.id] }))}
                                className="text-xs px-1.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition flex items-center gap-0.5"
                              >
                                +{student.group_names.length - 1}
                                {expandedStudentGroups[student.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                          {expandedStudentGroups[student.id] && student.group_names.length > 1 && (
                            <div className="mt-1.5 flex flex-col gap-1">
                              {student.group_names.slice(1).map((gn, i) => (
                                <span key={i} className="text-sm px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md font-medium w-fit">
                                  {gn}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-gray-500 italic">No groups assigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {student.created_at ? new Date(student.created_at).toLocaleDateString() : "-"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(student)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                        >
                          <Edit className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => openFeaturesModal(student)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition"
                        >
                          <Shield className="w-3.5 h-3.5" /> Features
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(student.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg mx-4 border dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add New Student</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg flex items-start gap-2">
              <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
              <span>User ID and Password will be auto-generated based on name.</span>
            </p>
            <form onSubmit={handleAddStudent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                  placeholder="Student name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Age *</label>
                  <input
                    type="number"
                    required
                    min={5}
                    max={25}
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Class *</label>
                  <select
                    value={formData.class_level}
                    onChange={(e) => setFormData({ ...formData, class_level: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(c => (
                      <option key={c} value={c}>Class {c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Mobile</label>
                <input
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                  placeholder="1234567890"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 font-medium"
                >
                  {saving ? "Adding..." : "Add Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg mx-4 border dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-5">Edit Student</h2>
            <form onSubmit={handleEditStudent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Age</label>
                  <input
                    type="number"
                    min={5}
                    max={25}
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Class</label>
                  <select
                    value={formData.class_level}
                    onChange={(e) => setFormData({ ...formData, class_level: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(c => (
                      <option key={c} value={c}>Class {c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Mobile</label>
                <input
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setSelectedStudent(null); resetForm(); }}
                  className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 font-medium"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {showCredentialsModal && newCredentials && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md mx-4 border dark:border-gray-700">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Credentials Generated</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Share these with the student</p>
            </div>
            <div className="space-y-4 mb-6">
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">User ID</p>
                <div className="flex items-center justify-between">
                  <code className="font-mono text-lg font-semibold text-gray-900 dark:text-white">{newCredentials.user_id}</code>
                  <button onClick={() => copyToClipboard(newCredentials.user_id)} className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg">
                    <Clipboard className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Password</p>
                <div className="flex items-center justify-between">
                  <code className="font-mono text-lg font-semibold text-gray-900 dark:text-white">{newCredentials.password}</code>
                  <button onClick={() => copyToClipboard(newCredentials.password)} className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg">
                    <Clipboard className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-4">{newCredentials.note}</p>
            <button
              onClick={() => { setShowCredentialsModal(false); setNewCredentials(null); }}
              className="w-full px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 font-medium transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
      {/* Features Modal */}
      {showFeaturesModal && featuresStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md mx-4 border dark:border-gray-700">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Feature Access</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{featuresStudent.name}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
              Student-level overrides take priority over group settings. Toggle features on/off for this individual student.
            </p>
            <div className="space-y-3">
              {Object.entries(featureLabels).map(([key, label]) => {
                const value = studentFeatures[key];
                const isSet = value !== undefined && value !== null;
                const enabled = value === true;
                return (
                  <div key={key} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {!isSet ? "Using group default" : enabled ? "Enabled (override)" : "Locked (override)"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleStudentFeature(key, !enabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          enabled ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          enabled ? "translate-x-6" : "translate-x-1"
                        }`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 pt-5">
              <button
                onClick={() => { setShowFeaturesModal(false); setFeaturesStudent(null); }}
                className="flex-1 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 font-medium transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
