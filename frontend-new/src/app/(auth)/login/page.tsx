'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, KeyRound, Lock, Loader2, Slack } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/auth.service';
import { siteConfig } from '@/config/site';

// ── Login Page – replicates THE BRAINWAVE split-panel design ─────────────────
export default function LoginPage() {
    const router = useRouter();
    const { setAuth } = useAuthStore();

    // Form state
    const [userId, setUserId] = useState('');
    const [password, setPassword] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [isTypingPwd, setIsTypingPwd] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // First-login password change modal state
    const [showChangePwd, setShowChangePwd] = useState(false);
    const [tempUserId, setTempUserId] = useState<string | null>(null);
    const [newPwd, setNewPwd] = useState('');
    const [confirmPwd, setConfirmPwd] = useState('');
    const [changePwdLoading, setChangePwdLoading] = useState(false);

    // ── Handlers ─────────────────────────────────────────────────────────────

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId || !password) { setError('Please fill in all fields'); return; }

        setLoading(true);
        setError('');
        console.log('[auth] Attempting login for user_id:', userId);

        try {
            const data = await authService.loginWithUserId(userId, password);

            // Handle first-login: force password change before proceeding
            if ((data as unknown as { first_login?: boolean }).first_login) {
                setTempUserId((data as unknown as { user_id?: string }).user_id ?? userId);
                setShowChangePwd(true);
                setLoading(false);
                return;
            }

            setAuth(data.user, data.access_token);
            console.log('[auth] Login successful, role:', data.user.role);
            router.push(siteConfig.roleDefaultRoutes[data.user.role.toUpperCase() as keyof typeof siteConfig.roleDefaultRoutes]);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            setError(msg ?? 'Invalid credentials. Please try again.');
            console.error('[auth] Login error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = async () => {
        if (newPwd.length < 8) { setError('Password must be at least 8 characters'); return; }
        if (newPwd !== confirmPwd) { setError('Passwords do not match'); return; }

        setChangePwdLoading(true);
        setError('');
        try {
            await authService.changePassword(tempUserId!, password, newPwd);
            console.log('[auth] First-login password changed successfully');
            setShowChangePwd(false);
            alert('Password changed! Please sign in with your new password.');
            setPassword('');
            setNewPwd('');
            setConfirmPwd('');
        } catch {
            setError('Failed to change password. Please try again.');
        } finally {
            setChangePwdLoading(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen w-full flex bg-white">

            {/* Left panel – brand + animated characters */}
            <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-between bg-slate-50 py-12">
                <div className="mb-2 flex items-center gap-2 relative right-[150px]">
                    <Slack />
                    <h1
                        className="text-3xl font-bold tracking-wide"
                        style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#ef4444' }}
                    >
                        THE BRAINWAVE
                    </h1>
                    <p className="absolute -bottom-[60px] left-12 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                        Synchronizing minds with smarter learning. Built for focus, clarity, and growth.
                    </p>
                </div>

                {/* Owl or avatar that reacts to password typing */}
                <OwlAvatar isTyping={isTypingPwd} showPassword={showPwd} />
            </div>

            {/* Right panel – login form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center px-8">
                <div className="w-full max-w-md">
                    <div className="text-center mb-10">
                        <h1 className="text-4xl font-bold text-gray-900 mb-3">Welcome back!</h1>
                        <p className="text-gray-500">Sign in with your User ID and password to continue.</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        {/* User ID input */}
                        <input
                            type="text"
                            placeholder="Your User ID or Email"
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            className="w-full h-14 px-5 bg-gray-100 rounded-2xl text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-gray-200 transition-all"
                        />

                        {/* Password input with show/hide toggle */}
                        <div className="relative">
                            <input
                                type={showPwd ? 'text' : 'password'}
                                placeholder="Your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onFocus={() => setIsTypingPwd(true)}
                                onBlur={() => setIsTypingPwd(false)}
                                className="w-full h-14 px-5 pr-12 bg-gray-100 rounded-2xl text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-gray-200 transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPwd(!showPwd)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>

                        {/* Forgot password link */}
                        <div className="text-left">
                            <Link href="/forgot-password" className="text-sm text-green-500 hover:text-green-600">
                                Forgot password?
                            </Link>
                        </div>

                        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                        {/* Submit button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-14 mt-4 font-semibold rounded-2xl bg-gray-900 hover:bg-gray-800 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {loading ? 'Signing in…' : 'Sign In'}
                        </button>
                    </form>

                    <div className="text-center mt-10 text-gray-400 text-sm">
                        <p>Please contact your administrator if you need an account.</p>
                    </div>
                </div>
            </div>

            {/* First-login change password modal */}
            {showChangePwd && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <KeyRound className="w-8 h-8 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900">Change Your Password</h2>
                            <p className="text-gray-500 mt-2">This is your first login. Please set a new password.</p>
                        </div>
                        <div className="space-y-4">
                            <div className="relative">
                                <input
                                    type="password"
                                    placeholder="New password (min 8 characters)"
                                    value={newPwd}
                                    onChange={(e) => setNewPwd(e.target.value)}
                                    className="w-full h-14 px-5 pr-12 bg-gray-100 rounded-2xl text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-green-200"
                                />
                                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            </div>
                            <div className="relative">
                                <input
                                    type="password"
                                    placeholder="Confirm new password"
                                    value={confirmPwd}
                                    onChange={(e) => setConfirmPwd(e.target.value)}
                                    className="w-full h-14 px-5 pr-12 bg-gray-100 rounded-2xl text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-green-200"
                                />
                                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            </div>
                            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                            <button
                                onClick={handlePasswordChange}
                                disabled={changePwdLoading}
                                className="w-full h-14 mt-4 font-semibold rounded-2xl bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {changePwdLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                {changePwdLoading ? 'Changing…' : 'Set New Password'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Inline owl avatar (replaces animated-characters from old frontend) ────────
function OwlAvatar({ isTyping, showPassword }: { isTyping: boolean; showPassword: boolean }) {
    return (
        <div className="flex flex-col items-center gap-6">
            {/* Owl SVG */}
            <div
                className={`transition-all duration-300 ${isTyping ? 'scale-110' : 'scale-100'}`}
            >
                <svg width="180" height="180" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Body */}
                    <ellipse cx="90" cy="110" rx="55" ry="60" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="2" />
                    {/* Head */}
                    <ellipse cx="90" cy="65" rx="45" ry="42" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="2" />
                    {/* Ears/horns */}
                    <polygon points="60,30 50,10 70,25" fill="#e2e8f0" />
                    <polygon points="120,30 130,10 110,25" fill="#e2e8f0" />
                    {/* Left eye */}
                    <circle cx="72" cy="62" r="14" fill="white" stroke="#94a3b8" strokeWidth="1.5" />
                    <circle
                        cx="72"
                        cy={showPassword ? '58' : '62'}
                        r="7"
                        fill="#1e293b"
                        className="transition-all duration-200"
                    />
                    {/* Right eye */}
                    <circle cx="108" cy="62" r="14" fill="white" stroke="#94a3b8" strokeWidth="1.5" />
                    <circle
                        cx="108"
                        cy={showPassword ? '58' : '62'}
                        r="7"
                        fill="#1e293b"
                        className="transition-all duration-200"
                    />
                    {/* Arms covering eyes when typing password (peeking effect) */}
                    {isTyping && !showPassword && (
                        <>
                            <rect x="48" y="54" width="34" height="14" rx="7" fill="#cbd5e1" />
                            <rect x="98" y="54" width="34" height="14" rx="7" fill="#cbd5e1" />
                        </>
                    )}
                    {/* Beak */}
                    <polygon points="90,72 83,82 97,82" fill="#fbbf24" />
                    {/* Belly pattern */}
                    <ellipse cx="90" cy="120" rx="30" ry="35" fill="#e2e8f0" />
                    {/* Feet */}
                    <ellipse cx="72" cy="166" rx="18" ry="8" fill="#fbbf24" />
                    <ellipse cx="108" cy="166" rx="18" ry="8" fill="#fbbf24" />
                </svg>
            </div>
            <p className="text-sm text-slate-400 italic">
                {isTyping && !showPassword ? "I'm not peeking! 🙈" : isTyping ? 'Watching you type…' : 'Ready to learn?'}
            </p>
        </div>
    );
}
