
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import {
    Settings, Users, Bell, Shield, Database, Globe,
    Save, Check, Lock, Eye, EyeOff, Loader2
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function AdminSettings() {
    const navigate = useNavigate();
    const { user, getAuthHeader } = useUserStore();
    const [activeSection, setActiveSection] = useState("general");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const [settings, setSettings] = useState({
        platformName: "NCERT Learning Platform",
        platformDescription: "Interactive learning platform for NCERT curriculum",
        maintenanceMode: false,
        allowRegistration: true,
        defaultStudentClass: 10,
        requireEmailVerification: false,
        autoApproveTeachers: false,
        emailNotifications: true,
        supportTicketAlerts: true,
        newUserAlerts: true,
        testCompletionAlerts: false,
        sessionTimeout: 60,
        maxLoginAttempts: 5,
        passwordMinLength: 6,
        requireStrongPassword: false,
        backupFrequency: "daily",
        retentionDays: 30
    });

    const [oldPwd, setOldPwd] = useState("");
    const [newPwd, setNewPwd] = useState("");
    const [confirmPwd, setConfirmPwd] = useState("");
    const [showOldPwd, setShowOldPwd] = useState(false);
    const [showNewPwd, setShowNewPwd] = useState(false);
    const [pwdLoading, setPwdLoading] = useState(false);
    const [pwdError, setPwdError] = useState("");
    const [pwdSuccess, setPwdSuccess] = useState("");

    const handleChangePassword = async () => {
        setPwdError(""); setPwdSuccess("");
        if (!oldPwd || !newPwd || !confirmPwd) { setPwdError("All fields are required."); return; }
        if (newPwd.length < 8) { setPwdError("Password must be at least 8 characters."); return; }
        if (newPwd !== confirmPwd) { setPwdError("Passwords do not match."); return; }
        setPwdLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/auth/change-password-secure`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...getAuthHeader() },
                body: JSON.stringify({ user_id: user.user_id, old_password: oldPwd, new_password: newPwd, confirm_password: confirmPwd })
            });
            const data = await res.json();
            if (data.success) {
                setPwdSuccess("Password changed successfully!");
                setOldPwd(""); setNewPwd(""); setConfirmPwd("");
            } else {
                setPwdError(data.error || "Failed to change password.");
            }
        } catch {
            setPwdError("Network error.");
        }
        setPwdLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            alert("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    const sections = [
        { id: "general", label: "General", icon: Globe },
        { id: "users", label: "User Management", icon: Users },
        { id: "notifications", label: "Notifications", icon: Bell },
        { id: "security", label: "Security", icon: Shield },
        { id: "database", label: "Database", icon: Database },
    ];

    return (
        <AdminLayout title="Settings" icon={Settings}>
            {}
            <div className="flex justify-end mb-6 gap-4">
                {saved && (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                        <Check className="w-4 h-4" />
                        <span>Settings saved</span>
                    </div>
                )}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 text-sm font-medium transition"
                >
                    <Save className="w-4 h-4" />
                    {saving ? "Saving..." : "Save Changes"}
                </button>
            </div>

            <div className="max-w-4xl">
                {}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6">
                    <div className="flex overflow-x-auto">
                        {sections.map((section) => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap
                                    ${activeSection === section.id
                                        ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                <section.icon className="w-4 h-4" />
                                {section.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* General Settings */}
                {activeSection === "general" && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">General Settings</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Configure basic platform settings</p>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Platform Name</label>
                                <input
                                    type="text"
                                    value={settings.platformName}
                                    onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Platform Description</label>
                                <textarea
                                    value={settings.platformDescription}
                                    onChange={(e) => setSettings({ ...settings, platformDescription: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500"
                                />
                            </div>
                            <ToggleRow
                                label="Maintenance Mode"
                                description="Temporarily disable access for non-admin users"
                                enabled={settings.maintenanceMode}
                                onChange={(v) => setSettings({ ...settings, maintenanceMode: v })}
                            />
                        </div>
                    </div>
                )}

                {}
                {activeSection === "users" && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">User Management</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Configure user registration and defaults</p>
                        <div className="space-y-4">
                            <ToggleRow label="Allow Self Registration" description="Let users create their own accounts"
                                enabled={settings.allowRegistration} onChange={(v) => setSettings({ ...settings, allowRegistration: v })} />
                            <ToggleRow label="Require Email Verification" description="Users must verify email before access"
                                enabled={settings.requireEmailVerification} onChange={(v) => setSettings({ ...settings, requireEmailVerification: v })} />
                            <ToggleRow label="Auto-Approve Teachers" description="Skip manual approval for teacher accounts"
                                enabled={settings.autoApproveTeachers} onChange={(v) => setSettings({ ...settings, autoApproveTeachers: v })} />
                            <div className="py-3">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Default Student Class</label>
                                <select
                                    value={settings.defaultStudentClass}
                                    onChange={(e) => setSettings({ ...settings, defaultStudentClass: parseInt(e.target.value) })}
                                    className="px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                >
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(c => <option key={c} value={c}>Class {c}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {}
                {activeSection === "notifications" && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Notifications</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Configure email and alert preferences</p>
                        <div className="space-y-4">
                            <ToggleRow label="Email Notifications" description="Receive important updates via email"
                                enabled={settings.emailNotifications} onChange={(v) => setSettings({ ...settings, emailNotifications: v })} />
                            <ToggleRow label="Support Ticket Alerts" description="Get notified on new support tickets"
                                enabled={settings.supportTicketAlerts} onChange={(v) => setSettings({ ...settings, supportTicketAlerts: v })} />
                            <ToggleRow label="New User Alerts" description="Notify when new users register"
                                enabled={settings.newUserAlerts} onChange={(v) => setSettings({ ...settings, newUserAlerts: v })} />
                            <ToggleRow label="Test Completion Alerts" description="Get notified when students complete tests" last
                                enabled={settings.testCompletionAlerts} onChange={(v) => setSettings({ ...settings, testCompletionAlerts: v })} />
                        </div>
                    </div>
                )}

                {}
                {activeSection === "security" && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Security</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Configure password and session policies</p>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Session Timeout (minutes)</label>
                                <input type="number" value={settings.sessionTimeout} min={5} max={480}
                                    onChange={(e) => setSettings({ ...settings, sessionTimeout: parseInt(e.target.value) })}
                                    className="w-32 px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Max Login Attempts</label>
                                <input type="number" value={settings.maxLoginAttempts} min={3} max={10}
                                    onChange={(e) => setSettings({ ...settings, maxLoginAttempts: parseInt(e.target.value) })}
                                    className="w-32 px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Minimum Password Length</label>
                                <input type="number" value={settings.passwordMinLength} min={4} max={20}
                                    onChange={(e) => setSettings({ ...settings, passwordMinLength: parseInt(e.target.value) })}
                                    className="w-32 px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white" />
                            </div>
                            <ToggleRow label="Require Strong Passwords" description="Must include uppercase, lowercase, and numbers"
                                enabled={settings.requireStrongPassword} onChange={(v) => setSettings({ ...settings, requireStrongPassword: v })} />
                        </div>

                        {/* Change Password Sub-section */}
                        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Change Your Password</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Update your admin account password</p>
                            <div className="space-y-4 max-w-md">
                                <div className="relative">
                                    <input
                                        type={showOldPwd ? "text" : "password"}
                                        value={oldPwd}
                                        onChange={(e) => setOldPwd(e.target.value)}
                                        placeholder="Current password"
                                        className="w-full px-4 py-2.5 pr-10 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                    />
                                    <button type="button" onClick={() => setShowOldPwd(!showOldPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                        {showOldPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <div className="relative">
                                    <input
                                        type={showNewPwd ? "text" : "password"}
                                        value={newPwd}
                                        onChange={(e) => setNewPwd(e.target.value)}
                                        placeholder="New password (min 8 characters)"
                                        className="w-full px-4 py-2.5 pr-10 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                    />
                                    <button type="button" onClick={() => setShowNewPwd(!showNewPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                        {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <input
                                    type="password"
                                    value={confirmPwd}
                                    onChange={(e) => setConfirmPwd(e.target.value)}
                                    placeholder="Confirm new password"
                                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                />
                                {pwdError && <p className="text-red-500 text-xs">{pwdError}</p>}
                                {pwdSuccess && <p className="text-green-600 text-xs">{pwdSuccess}</p>}
                                <button
                                    onClick={handleChangePassword}
                                    disabled={pwdLoading}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 text-sm font-medium transition"
                                >
                                    {pwdLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                                    {pwdLoading ? "Changing..." : "Change Password"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {}
                {activeSection === "database" && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Database</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Backup and data retention settings</p>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Backup Frequency</label>
                                <select value={settings.backupFrequency} onChange={(e) => setSettings({ ...settings, backupFrequency: e.target.value })}
                                    className="px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white">
                                    <option value="hourly">Hourly</option>
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Data Retention (days)</label>
                                <input type="number" value={settings.retentionDays} min={7} max={365}
                                    onChange={(e) => setSettings({ ...settings, retentionDays: parseInt(e.target.value) })}
                                    className="w-32 px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white" />
                            </div>
                            <div className="py-4 px-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <div className="flex items-start gap-3">
                                    <Database className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">MongoDB Atlas</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Connected to your cloud database</p>
                                        <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>Connected
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

function ToggleRow({ label, description, enabled, onChange, last = false }) {
    return (
        <div className={`flex items-center justify-between py-3 ${last ? "" : "border-b border-gray-100 dark:border-gray-700"}`}>
            <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
            </div>
            <button
                onClick={() => onChange(!enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200 dark:bg-gray-600'}`}
            >
                <span className={`inline-block h-4 w-4 transform rounded-full transition-transform ${enabled ? 'translate-x-6 bg-white dark:bg-gray-900' : 'translate-x-1 bg-white'}`} />
            </button>
        </div>
    );
}
