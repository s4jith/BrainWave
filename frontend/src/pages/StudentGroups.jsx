
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import useUserStore from "../stores/userStore";
import {
  Users,
  BookOpen,
  GraduationCap,
  FileText,
  Clock,
  ChevronDown,
  ChevronUp,
  Calendar,
  Award,
  Target,
  Loader2,
  AlertCircle,
  CheckCircle,
  Play,
  BarChart3
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function StudentGroups() {
  const navigate = useNavigate();
  const { user, getAuthHeader } = useUserStore();

  const [groups, setGroups] = useState([]);
  const [upcomingTests, setUpcomingTests] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [expandedSubject, setExpandedSubject] = useState(null);
  const [activeTab, setActiveTab] = useState("groups"); 

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchGroups(),
      fetchUpcomingTests(),
      fetchSubjects()
    ]);
    setLoading(false);
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch(`${API_URL}/api/student/groups`, {
        headers: getAuthHeader()
      });
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
      }
    } catch (err) {
    }
  };

  const fetchUpcomingTests = async () => {
    try {
      const res = await fetch(`${API_URL}/api/student/upcoming-tests`, {
        headers: getAuthHeader()
      });
      if (res.ok) {
        const data = await res.json();
        setUpcomingTests(data.tests || []);
      }
    } catch (err) {
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await fetch(`${API_URL}/api/student/my-subjects`, {
        headers: getAuthHeader()
      });
      if (res.ok) {
        const data = await res.json();
        setSubjects(data.subjects || []);
      }
    } catch (err) {
    }
  };

  const tabs = [
    { id: "groups", label: "My Groups", icon: Users, count: groups.length },
    { id: "tests", label: "Upcoming Tests", icon: FileText, count: upcomingTests.filter(t => t.status === "pending").length },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          <span className="ml-3 text-gray-500">Loading your data...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Groups</h1>
          <p className="text-gray-500 text-sm mt-1">
            View your assigned groups, subjects, and upcoming tests
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{groups.length}</p>
              <p className="text-sm text-gray-500">Groups Joined</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{subjects.length}</p>
              <p className="text-sm text-gray-500">Active Subjects</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
              <FileText className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {upcomingTests.filter(t => t.status === "pending").length}
              </p>
              <p className="text-sm text-gray-500">Pending Tests</p>
            </div>
          </div>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? "bg-orange-100 text-orange-600" : "bg-gray-200 text-gray-600"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "groups" && (
          <div className="space-y-4">
            {groups.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No Groups Assigned"
                description="You haven't been assigned to any groups yet. Your teacher or admin will add you to a group."
              />
            ) : (
              groups.map(group => (
                <div
                  key={group.id}
                  className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <button
                    onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
                        {(group.subject || group.name || "G")[0].toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{group.name}</h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                          {group.subject && (
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-3.5 h-3.5" />
                              {group.subject}
                            </span>
                          )}
                          {group.class_level && (
                            <span className="flex items-center gap-1">
                              <GraduationCap className="w-3.5 h-3.5" />
                              Class {group.class_level}
                            </span>
                          )}
                          {group.student_count > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              {group.student_count} students
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {group.test_count > 0 && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-600">
                          {group.test_count} test{group.test_count > 1 ? "s" : ""}
                        </span>
                      )}
                      {expandedGroup === group.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {expandedGroup === group.id && (
                    <div className="px-6 pb-4 pt-2 border-t border-gray-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Teacher</h4>
                          {group.teacher ? (
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <GraduationCap className="w-5 h-5 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{group.teacher.name}</p>
                                <p className="text-sm text-gray-500">{group.teacher.email}</p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400">No teacher assigned</p>
                          )}
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Details</h4>
                          <div className="space-y-2 text-sm">
                            {group.description && (
                              <p className="text-gray-600">{group.description}</p>
                            )}
                            {group.batch_year && (
                              <p className="text-gray-500">
                                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                                Batch {group.batch_year}
                              </p>
                            )}
                            <p className="text-gray-500">
                              <Clock className="w-3.5 h-3.5 inline mr-1" />
                              Joined {group.created_at ? new Date(group.created_at).toLocaleDateString() : "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3 mt-4">
                        <button
                          onClick={() => navigate("/my-tests")}
                          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          View Tests
                        </button>
                        <button
                          onClick={() => navigate("/support-tickets")}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                        >
                          <AlertCircle className="w-4 h-4" />
                          Contact Teacher
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "subjects" && (
          <div className="space-y-4">
            {subjects.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No Subjects Yet"
                description="Subjects will appear here based on your group assignments. Ask your teacher to add you to a group."
              />
            ) : (
              subjects.map(subject => (
                <div
                  key={subject.id}
                  className="bg-white rounded-xl border border-gray-100 overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedSubject(expandedSubject === subject.id ? null : subject.id)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold text-lg">
                        {(subject.subject_name || "S")[0].toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{subject.subject_name}</h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <GraduationCap className="w-3.5 h-3.5" />
                            Class {subject.class_level}
                          </span>
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5" />
                            {subject.total_chapters} chapter{subject.total_chapters !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                    {expandedSubject === subject.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {expandedSubject === subject.id && (
                    <div className="px-6 pb-4 pt-2 border-t border-gray-50">
                      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Chapters & Topics</h4>
                      <div className="space-y-3">
                        {subject.chapters.map((ch, idx) => (
                          <div key={idx} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-sm font-bold text-emerald-600">{ch.chapter_number}</span>
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-gray-900 text-sm">{ch.title}</p>
                                {ch.topics && ch.topics.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {ch.topics.map((topic, tIdx) => (
                                      <span
                                        key={tIdx}
                                        className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-600"
                                      >
                                        {topic}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "tests" && (
          <div className="space-y-4">
            {upcomingTests.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No Tests"
                description="You have no tests assigned yet. Tests will appear here when your teacher creates them for your group."
              />
            ) : (
              <>
                {upcomingTests.filter(t => t.status === "pending").length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-orange-500" />
                      Pending Tests
                    </h3>
                    <div className="space-y-3">
                      {upcomingTests.filter(t => t.status === "pending").map(test => (
                        <div
                          key={test.id}
                          className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                              <FileText className="w-5 h-5 text-orange-600" />
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{test.title}</h4>
                              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                {test.subject && (
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-xs font-medium">
                                    {test.subject}
                                  </span>
                                )}
                                {test.duration_minutes && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {test.duration_minutes} min
                                  </span>
                                )}
                                {test.total_marks > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Target className="w-3 h-3" />
                                    {test.total_marks} marks
                                  </span>
                                )}
                                {test.deadline && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Due {new Date(test.deadline).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => navigate("/my-tests")}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
                          >
                            <Play className="w-4 h-4" />
                            Take Test
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {upcomingTests.filter(t => t.status === "submitted").length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      Submitted Tests
                    </h3>
                    <div className="space-y-3">
                      {upcomingTests.filter(t => t.status === "submitted").map(test => (
                        <div
                          key={test.id}
                          className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                              <CheckCircle className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{test.title}</h4>
                              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                {test.subject && (
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-xs font-medium">
                                    {test.subject}
                                  </span>
                                )}
                                {test.score !== null && test.score !== undefined && (
                                  <span className="flex items-center gap-1 font-medium text-gray-700">
                                    <Award className="w-3 h-3" />
                                    Score: {test.score}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => navigate("/my-tests")}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                          >
                            <BarChart3 className="w-4 h-4" />
                            View Result
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
        <Icon className="w-8 h-8 text-gray-300" />
      </div>
      <h3 className="font-semibold text-gray-900 text-lg mb-2">{title}</h3>
      <p className="text-gray-500 text-sm max-w-md mx-auto">{description}</p>
    </div>
  );
}
