'use client';

import { useState } from 'react';
import { User, Lock, Eye, EyeOff, Save } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import apiClient from '@/lib/axios';

// ── Admin Settings – identical layout to other role settings pages ─────────────
export default function AdminSettingsPage() {
    const { user, updateUser } = useAuthStore();
    const [name, setName] = useState(user?.name ?? '');
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [oldPwd, setOldPwd] = useState('');
    const [newPwd, setNewPwd] = useState('');
    const [confirmPwd, setConfirmPwd] = useState('');
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [savingPwd, setSavingPwd] = useState(false);
    const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingProfile(true); setProfileMsg(null);
        try {
            await apiClient.put('/api/user/profile', { name });
            updateUser({ name });
            setProfileMsg({ type: 'success', text: 'Profile updated.' });
            console.log('[admin-settings] Profile updated');
        } catch { setProfileMsg({ type: 'error', text: 'Failed to update profile.' }); }
        finally { setSavingProfile(false); }
    };

    const handleChangePwd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPwd.length < 8) { setPwdMsg({ type: 'error', text: 'Password must be at least 8 characters.' }); return; }
        if (newPwd !== confirmPwd) { setPwdMsg({ type: 'error', text: 'Passwords do not match.' }); return; }
        setSavingPwd(true); setPwdMsg(null);
        try {
            await apiClient.post('/api/auth/change-password', { user_id: user?.id, old_password: oldPwd, new_password: newPwd });
            setPwdMsg({ type: 'success', text: 'Password changed.' });
            setOldPwd(''); setNewPwd(''); setConfirmPwd('');
            console.log('[admin-settings] Password changed');
        } catch { setPwdMsg({ type: 'error', text: 'Failed. Check your current password.' }); }
        finally { setSavingPwd(false); }
    };

    const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white';

    return (
        <DashboardLayout>
            <PageHeader title="Settings" description="Manage your admin profile and account security." />

            <div className="mx-auto max-w-2xl space-y-6">
                {/* Profile */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                    <div className="mb-5 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30"><User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /></div>
                        <h2 className="font-semibold text-gray-900 dark:text-white">Profile Information</h2>
                    </div>
                    {profileMsg && <AlertBanner variant={profileMsg.type === 'success' ? 'success' : 'error'} message={profileMsg.text} className="mb-4" />}
                    <form onSubmit={handleSaveProfile} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Full Name</label>
                            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email Address</label>
                            <input value={user?.email ?? ''} disabled className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-400 dark:border-gray-700 cursor-not-allowed" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Role</label>
                            <input value="Administrator" disabled className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-400 dark:border-gray-700 cursor-not-allowed" />
                        </div>
                        <Button type="submit" leftIcon={<Save className="h-4 w-4" />} loading={savingProfile}>Save Changes</Button>
                    </form>
                </div>

                {/* Password */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                    <div className="mb-5 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30"><Lock className="h-5 w-5 text-orange-600 dark:text-orange-400" /></div>
                        <h2 className="font-semibold text-gray-900 dark:text-white">Change Password</h2>
                    </div>
                    {pwdMsg && <AlertBanner variant={pwdMsg.type === 'success' ? 'success' : 'error'} message={pwdMsg.text} className="mb-4" />}
                    <form onSubmit={handleChangePwd} className="space-y-4">
                        {/* Current */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Current Password</label>
                            <div className="relative">
                                <input type={showOld ? 'text' : 'password'} value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} required className={`${inputClass} pr-10`} />
                                <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        {/* New */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">New Password</label>
                            <div className="relative">
                                <input type={showNew ? 'text' : 'password'} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required className={`${inputClass} pr-10`} />
                                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        {/* Confirm */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Confirm New Password</label>
                            <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} required className={inputClass} />
                        </div>
                        <Button type="submit" variant="outline" leftIcon={<Lock className="h-4 w-4" />} loading={savingPwd}>Change Password</Button>
                    </form>
                </div>
            </div>
        </DashboardLayout>
    );
}
