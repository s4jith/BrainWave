
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import {
    LayoutDashboard, Plus, FileText, ClipboardList,
    CheckCircle, Clock, Users, HelpCircle, ChevronRight
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function TeacherDashboard() {
    const navigate = useNavigate();
    const { user, getAuthHeader } = useUserStore();

    const [stats, setStats] = useState({
        myQuestions: 0,
        myTests: 0,
        evaluated: 0,
        pending: 0
    });

    const [loading, setLoading] = useState(true);

    const [groups, setGroups] = useState([]);

    useEffect(() => {
        fetchDashboardStats();
        fetchGroups();
    }, []);

    useEffect(() => {
        const handleFocus = () => {
            fetchDashboardStats();
            fetchGroups();
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, []);

    const fetchGroups = async () => {
        try {
            const response = await fetch(`${API_URL}/api/teacher/groups`, {
                headers: getAuthHeader()
            });
            if (response.ok) {
                const data = await response.json();
                setGroups(data.groups || []);
            }
        } catch (err) {
            console.error("Failed to fetch teacher groups:", err);
        }
    };

    const fetchDashboardStats = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/api/teacher/stats`, {
                headers: getAuthHeader()
            });

            if (response.ok) {
                const data = await response.json();
                setStats({
                    myQuestions: data.my_questions || 0,
                    myTests: data.my_tests || 0,
                    evaluated: data.evaluated || 0,
                    pending: data.pending || 0
                });
            } else {
                
                console.warn("Using mock stats data");
                setStats({
                    myQuestions: 0,
                    myTests: 0,
                    evaluated: 0,
                    pending: 0
                });
            }
        } catch (err) {
            console.error("Failed to fetch teacher stats:", err);
            
            setStats({
                myQuestions: 0,
                myTests: 0,
                evaluated: 0,
                pending: 0
            });
        } finally {
            setLoading(false);
        }
    };

    const quickActions = [
        {
            title: "Question Bank",
            description: "Manage questions",
            icon: HelpCircle,
            onClick: () => navigate("/question-bank")
        },
        {
            title: "Create Test",
            description: "Build a new assessment",
            icon: ClipboardList,
            onClick: () => navigate("/teacher-tests")
        }
    ];

    return (
        <AdminLayout title="Teacher Dashboard" icon={LayoutDashboard}>

            {}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                    label="My Questions"
                    value={stats.myQuestions}
                    icon={HelpCircle}
                    helpText="Total questions created"
                />
                <StatCard
                    label="My Tests"
                    value={stats.myTests}
                    icon={ClipboardList}
                    helpText="Active assessments"
                />
                <StatCard
                    label="Evaluated"
                    value={stats.evaluated}
                    icon={CheckCircle}
                    color="text-green-500"
                    statusIcon={CheckCircle}
                />
                <StatCard
                    label="Pending"
                    value={stats.pending}
                    icon={Clock}
                    color="text-orange-500"
                    statusIcon={Clock}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Quick Actions */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Common tasks for teachers.</p>

                    <div className="space-y-4">
                        {quickActions.map((action, idx) => (
                            <button
                                key={idx}
                                onClick={action.onClick}
                                className="w-full flex items-center justify-between p-4 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center group-hover:bg-white dark:group-hover:bg-gray-600 transition-colors">
                                        <action.icon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="font-medium text-gray-900 dark:text-white">{action.title}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{action.description}</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                            </button>
                        ))}
                    </div>
                </div>

                {/* My Groups */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center justify-center text-center">
                    <div className="w-full text-left mb-auto">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">My Groups</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Student groups you manage.</p>
                    </div>

                    {groups.length > 0 ? (
                        <div className="w-full space-y-3 mb-6">
                            {groups.slice(0, 3).map(group => (
                                <div key={group.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-700">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-white dark:bg-gray-600 rounded-lg flex items-center justify-center border border-gray-200 dark:border-gray-500">
                                            <Users className="w-4 h-4 text-gray-500 dark:text-gray-300" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium text-sm text-gray-900 dark:text-white">{group.name}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{group.student_count || 0} students</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {groups.length > 3 && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">+{groups.length - 3} more groups</p>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center my-8">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                                <Users className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">No groups assigned yet</p>
                        </div>
                    )}

                    <button
                        onClick={() => navigate("/teacher-groups")}
                        className="text-sm font-medium text-gray-900 dark:text-white hover:underline mt-auto"
                    >
                        View All Groups
                    </button>
                </div>
            </div>
        </AdminLayout>
    );
}

function StatCard({ label, value, icon: Icon, color = "text-gray-900 dark:text-white", statusIcon: StatusIcon, helpText }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col justify-between min-h-[140px]">
            <div className="flex justify-between items-start">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
                {StatusIcon && <StatusIcon className={`w-4 h-4 ${color}`} />}
                {!StatusIcon && helpText && <HelpCircle className="w-4 h-4 text-gray-300" />}
            </div>

            <div className="mt-4">
                <h3 className={`text-3xl font-bold ${color}`}>{value}</h3>
            </div>
        </div>
    );
}
