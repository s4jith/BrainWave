import React, { useState, useEffect } from "react";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import { Settings, User, Mail, Phone, Key, IdCard, Save, Eye, EyeOff } from "lucide-react";
import authFetch from "../utils/authFetch";
import { useToast } from "../contexts/ToastContext";

const API_URL = import.meta.env.VITE_API_URL;

function Section({ title, icon: Icon, children }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                    <Icon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                </div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
            </div>
            <div className="p-6">{children}</div>
        </div>
    );
}

function InputField({ label, id, type = "text", value, onChange, placeholder, hint, rightElement }) {
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
            <div className="relative">
                <input
                    id={id}
                    type={type}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:ring-offset-0 text-sm pr-10"
                />
                {rightElement && <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>}
            </div>
            {hint && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
        </div>
    );
}

export default function TeacherSettings() {
    const { user, getAuthHeader, setUser } = useUserStore();
    const { toast } = useToast();

    // Profile state
    const [profile, setProfile] = useState({ name: "", email: "", phone: "", user_id: "" });
    const [profileLoading, setProfileLoading] = useState(false);

    // Password state
    const [passwords, setPasswords] = useState({ current: "", new_password: "", confirm: "" });
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);

    useEffect(() => {
        if (user) {
            setProfile({
                name: user.name || "",
                email: user.email || "",
                phone: user.phone || user.mobile || "",
                user_id: user.user_id || user.userId || "",
            });
        }
    }, [user]);

    // ── Profile Update ─────────────────────────────────────────────────────────
    const handleProfileSave = async () => {
        if (!profile.name.trim()) return toast.error("Name cannot be empty.");
        if (!profile.email.trim()) return toast.error("Email cannot be empty.");

        setProfileLoading(true);
        try {
            const res = await authFetch(`${API_URL}/api/auth/profile`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...getAuthHeader() },
                body: JSON.stringify({
                    name: profile.name.trim(),
                    email: profile.email.trim(),
                    phone: profile.phone.trim(),
                }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Profile updated successfully.");
                // Update local user store
                if (setUser) {
                    setUser({ ...user, name: profile.name.trim(), email: profile.email.trim(), phone: profile.phone.trim() });
                }
            } else {
                toast.error(data.error || "Failed to update profile.");
            }
        } catch (err) {
            toast.error("Network error. Please try again.");
        } finally {
            setProfileLoading(false);
        }
    };

    // ── Password Change ────────────────────────────────────────────────────────
    const handlePasswordChange = async () => {
        if (!passwords.current) return toast.error("Enter your current password.");
        if (passwords.new_password.length < 8) return toast.error("New password must be at least 8 characters.");
        if (passwords.new_password !== passwords.confirm) return toast.error("New passwords do not match.");
        if (passwords.current === passwords.new_password) return toast.error("New password must differ from current password.");

        setPasswordLoading(true);
        try {
            const res = await authFetch(`${API_URL}/api/auth/change-password-secure`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...getAuthHeader() },
                body: JSON.stringify({
                    user_id: user.user_id || user.userId,
                    old_password: passwords.current,
                    new_password: passwords.new_password,
                    confirm_password: passwords.confirm,
                }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Password changed successfully.");
                setPasswords({ current: "", new_password: "", confirm: "" });
            } else {
                toast.error(data.error || "Failed to change password.");
            }
        } catch (err) {
            toast.error("Network error. Please try again.");
        } finally {
            setPasswordLoading(false);
        }
    };

    const pwStrength = (pw) => {
        if (!pw) return null;
        let score = 0;
        if (pw.length >= 8) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;
        if (score <= 1) return { label: "Weak", color: "bg-red-500", width: "w-1/4" };
        if (score === 2) return { label: "Fair", color: "bg-amber-500", width: "w-2/4" };
        if (score === 3) return { label: "Good", color: "bg-blue-500", width: "w-3/4" };
        return { label: "Strong", color: "bg-green-500", width: "w-full" };
    };
    const strength = pwStrength(passwords.new_password);

    return (
        <AdminLayout title="Settings" icon={Settings}>
            <div className="max-w-2xl space-y-6">

                {/* ── Profile Info ── */}
                <Section title="Profile Information" icon={User}>
                    <div className="space-y-4">
                        <InputField
                            label="Full Name"
                            id="name"
                            value={profile.name}
                            onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                            placeholder="Your full name"
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <InputField
                                label="Email Address"
                                id="email"
                                type="email"
                                value={profile.email}
                                onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                                placeholder="you@example.com"
                                rightElement={<Mail className="w-4 h-4 text-gray-400" />}
                            />
                            <InputField
                                label="Phone Number"
                                id="phone"
                                type="tel"
                                value={profile.phone}
                                onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                                placeholder="+91 9876543210"
                                rightElement={<Phone className="w-4 h-4 text-gray-400" />}
                            />
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={handleProfileSave}
                                disabled={profileLoading}
                                className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 transition flex items-center gap-2 font-medium text-sm"
                            >
                                {profileLoading ? (
                                    <span className="w-4 h-4 border-2 border-white/40 dark:border-gray-900/40 border-t-white dark:border-t-gray-900 rounded-full animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                Save Changes
                            </button>
                        </div>
                    </div>
                </Section>

                {/* ── Change Password ── */}
                <Section title="Change Password" icon={Key}>
                    <div className="space-y-4">
                        <div className="relative">
                            <label htmlFor="cur-pw" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Current Password</label>
                            <input
                                id="cur-pw"
                                type={showCurrent ? "text" : "password"}
                                value={passwords.current}
                                onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))}
                                placeholder="Enter current password"
                                className="w-full px-4 py-2.5 pr-10 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white text-sm"
                            />
                            <button type="button" onClick={() => setShowCurrent(v => !v)}
                                className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>

                        <div className="relative">
                            <label htmlFor="new-pw" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">New Password</label>
                            <input
                                id="new-pw"
                                type={showNew ? "text" : "password"}
                                value={passwords.new_password}
                                onChange={e => setPasswords(p => ({ ...p, new_password: e.target.value }))}
                                placeholder="At least 8 characters"
                                className="w-full px-4 py-2.5 pr-10 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white text-sm"
                            />
                            <button type="button" onClick={() => setShowNew(v => !v)}
                                className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            {strength && (
                                <div className="mt-2">
                                    <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all ${strength.color} ${strength.width}`} />
                                    </div>
                                    <p className={`text-xs mt-1 font-medium ${
                                        strength.label === "Weak" ? "text-red-500" :
                                        strength.label === "Fair" ? "text-amber-500" :
                                        strength.label === "Good" ? "text-blue-500" : "text-green-500"
                                    }`}>{strength.label}</p>
                                </div>
                            )}
                        </div>

                        <div className="relative">
                            <label htmlFor="confirm-pw" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Confirm New Password</label>
                            <input
                                id="confirm-pw"
                                type={showConfirm ? "text" : "password"}
                                value={passwords.confirm}
                                onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))}
                                placeholder="Repeat new password"
                                className={`w-full px-4 py-2.5 pr-10 bg-white dark:bg-gray-700 border rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white text-sm ${
                                    passwords.confirm && passwords.confirm !== passwords.new_password
                                        ? "border-red-400 dark:border-red-500"
                                        : "border-gray-200 dark:border-gray-600"
                                }`}
                            />
                            <button type="button" onClick={() => setShowConfirm(v => !v)}
                                className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={handlePasswordChange}
                                disabled={passwordLoading}
                                className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 transition flex items-center gap-2 font-medium text-sm"
                            >
                                {passwordLoading ? (
                                    <span className="w-4 h-4 border-2 border-white/40 dark:border-gray-900/40 border-t-white dark:border-t-gray-900 rounded-full animate-spin" />
                                ) : (
                                    <Key className="w-4 h-4" />
                                )}
                                Update Password
                            </button>
                        </div>
                    </div>
                </Section>

                {/* ── Account Info (read-only) ── */}
                <Section title="Account Information" icon={IdCard}>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Role</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">{user?.role || "Teacher"}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Account Status</span>
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">Active</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Login User ID</span>
                            <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">{user?.user_id || user?.userId || "—"}</span>
                        </div>
                    </div>
                </Section>

            </div>
        </AdminLayout>
    );
}
