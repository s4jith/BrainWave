
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
  Loader2,
  MessageSquare
} from "lucide-react";
import authFetch from "../utils/authFetch";

const API_URL = import.meta.env.VITE_API_URL;

export default function StudentGroups() {
  const navigate = useNavigate();
  const { getAuthHeader } = useUserStore();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [activeTab, setActiveTab] = useState("groups");

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await fetchGroups();
    setLoading(false);
  };

  const fetchGroups = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/student/groups`, {
        headers: getAuthHeader()
      });
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
      }
    } catch (err) {
    }
  };

  const tabs = [
    { id: "groups", label: "My Groups", icon: Users, count: groups.length },
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
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold mb-2">
            Groups Overview
          </div>
          <h1 className="text-3xl font-bold text-gray-900">My Groups</h1>
          <p className="text-gray-500 text-sm mt-1">
            View your assigned groups, subjects, and upcoming tests
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Groups Joined */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{groups.length}</p>
              <p className="text-sm text-gray-500">Groups Joined</p>
            </div>
          </div>

          {/* Unique Subjects derived from groups */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {[...new Set(groups.map(g => g.subject).filter(Boolean))].length}
              </p>
              <p className="text-sm text-gray-500">My Subjects</p>
              {groups.length > 0 && (
                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">
                  {[...new Set(groups.map(g => g.subject).filter(Boolean))].join(", ")}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 border border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? "bg-orange-100 text-orange-700" : "bg-gray-200 text-gray-600"
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
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <button
                    onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white font-bold text-lg">
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
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
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
                    <div className="px-6 pb-4 pt-2 border-t border-gray-100 bg-gray-50/50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-xl p-4 border border-gray-200">
                          <h4 className="text-xs font-medium text-orange-600 uppercase tracking-wider mb-2">Teacher</h4>
                          {group.teacher ? (
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                                <GraduationCap className="w-5 h-5 text-orange-600" />
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

                        <div className="bg-white rounded-xl p-4 border border-gray-200">
                          <h4 className="text-xs font-medium text-orange-600 uppercase tracking-wider mb-2">Details</h4>
                          <div className="space-y-2 text-sm">
                            {group.description && (
                              <p className="text-gray-700">{group.description}</p>
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
                          onClick={() => navigate("/test")}
                          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          View Tests
                        </button>
                        <button
                          onClick={() => navigate("/my-queries", { state: { group_id: group.id, group_name: group.name, subject: group.subject } })}
                          className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors"
                        >
                          <MessageSquare className="w-4 h-4" />
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

      </div>
    </DashboardLayout>
  );
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
        <Icon className="w-8 h-8 text-orange-400" />
      </div>
      <h3 className="font-semibold text-gray-900 text-lg mb-2">{title}</h3>
      <p className="text-gray-500 text-sm max-w-md mx-auto">{description}</p>
    </div>
  );
}
