'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, KeyRound, Lock, ArrowLeft, Loader2, CheckCircle, ShieldCheck } from 'lucide-react';
import { authService } from '@/services/auth.service';

type Step = 1 | 2 | 3;

const STEP_INFO = [
    { num: 1 as Step, label: 'Email', icon: Mail },
    { num: 2 as Step, label: 'Verify', icon: ShieldCheck },
    { num: 3 as Step, label: 'Reset', icon: Lock },
];

// ── Forgot Password – 3-step OTP flow (Email → OTP → New Password) ────────────
export default function ForgotPasswordPage() {
    const router = useRouter();
    const [step, setStep] = useState<Step>(1);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [newPwd, setNewPwd] = useState('');
    const [confirmPwd, setConfirmPwd] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Step 1 – Send OTP to email
    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) { setError('Please enter your email'); return; }
        setLoading(true); setError(''); setSuccess('');
        try {
            await authService.forgotPassword({ email });
            setSuccess('OTP sent! Check your email.');
            setStep(2);
            console.log('[auth] OTP sent to:', email);
        } catch {
            setError('Failed to send OTP. Please check your email address.');
        } finally { setLoading(false); }
    };

    // Step 2 – Verify OTP
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otp) { setError('Please enter the OTP'); return; }
        setLoading(true); setError(''); setSuccess('');
        try {
            const data = await authService.verifyOtp(email, otp);
            setResetToken(data.reset_token);
            setSuccess('OTP verified!');
            setStep(3);
            console.log('[auth] OTP verified, proceeding to reset');
        } catch {
            setError('Invalid or expired OTP. Please try again.');
        } finally { setLoading(false); }
    };

    // Step 3 – Reset password
    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPwd.length < 8) { setError('Password must be at least 8 characters'); return; }
        if (newPwd !== confirmPwd) { setError('Passwords do not match'); return; }
        setLoading(true); setError(''); setSuccess('');
        try {
            await authService.resetPassword(email, resetToken, newPwd);
            setSuccess('Password reset successfully! Redirecting to login…');
            console.log('[auth] Password reset successful for:', email);
            setTimeout(() => router.push('/login'), 2000);
        } catch {
            setError('Failed to reset password. Please start over.');
        } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 px-4">
            <div className="w-full max-w-md">
                {/* Back link */}
                <Link href="/login" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-8 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Login
                </Link>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <KeyRound className="w-8 h-8 text-indigo-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
                        <p className="text-gray-500 mt-2 text-sm">
                            {step === 1 && 'Enter your email to receive a verification code.'}
                            {step === 2 && 'Enter the 6-digit OTP sent to your email.'}
                            {step === 3 && 'Create a new password for your account.'}
                        </p>
                    </div>

                    {/* Step indicator */}
                    <div className="flex items-center justify-center gap-2 mb-8">
                        {STEP_INFO.map((s, i) => {
                            const Icon = s.icon;
                            const isDone = step > s.num;
                            const isActive = step === s.num;
                            return (
                                <div key={s.num} className="flex items-center gap-2">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all ${isDone ? 'bg-green-500 text-white' : isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gray-100 text-gray-400'
                                        }`}>
                                        {isDone ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                                    </div>
                                    {i < STEP_INFO.length - 1 && (
                                        <div className={`w-8 h-0.5 ${isDone ? 'bg-green-400' : 'bg-gray-200'}`} />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Step 1 – Email */}
                    {step === 1 && (
                        <form onSubmit={handleSendOtp} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Enter your registered email"
                                        className="w-full h-14 px-5 pl-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all"
                                    />
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                </div>
                            </div>
                            {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">{error}</p>}
                            {success && <p className="text-green-600 text-sm text-center bg-green-50 p-2 rounded-lg">{success}</p>}
                            <button
                                type="submit" disabled={loading}
                                className="w-full h-14 font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                                {loading ? 'Sending OTP…' : 'Send OTP'}
                            </button>
                        </form>
                    )}

                    {/* Step 2 – OTP */}
                    {step === 2 && (
                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Verification Code (OTP)</label>
                                <input
                                    type="text"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="Enter 6-digit OTP"
                                    maxLength={6}
                                    className="w-full h-14 px-5 bg-gray-50 border border-gray-200 rounded-xl text-center text-2xl font-mono tracking-[0.5em] text-gray-900 placeholder:text-gray-400 placeholder:text-base placeholder:tracking-normal outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all"
                                />
                            </div>
                            <p className="text-xs text-gray-500 text-center">
                                OTP sent to <span className="font-medium text-gray-700">{email}</span>. Valid for 10 minutes.
                            </p>
                            {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">{error}</p>}
                            <button
                                type="submit" disabled={loading || otp.length < 6}
                                className="w-full h-14 font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                                {loading ? 'Verifying…' : 'Verify OTP'}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setStep(1); setError(''); setOtp(''); }}
                                className="w-full text-sm text-gray-500 hover:text-indigo-600 transition-colors"
                            >
                                Didn&apos;t receive the code? Try again
                            </button>
                        </form>
                    )}

                    {/* Step 3 – New Password */}
                    {step === 3 && (
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                                <div className="relative">
                                    <input
                                        type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
                                        placeholder="Min 8 characters"
                                        className="w-full h-14 px-5 pl-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all"
                                    />
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                                <div className="relative">
                                    <input
                                        type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)}
                                        placeholder="Re-enter your password"
                                        className="w-full h-14 px-5 pl-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all"
                                    />
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                </div>
                            </div>
                            {newPwd && confirmPwd && newPwd !== confirmPwd && (
                                <p className="text-red-500 text-xs">Passwords do not match</p>
                            )}
                            {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">{error}</p>}
                            {success && <p className="text-green-600 text-sm text-center bg-green-50 p-2 rounded-lg">{success}</p>}
                            <button
                                type="submit" disabled={loading}
                                className="w-full h-14 font-semibold rounded-xl bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                                {loading ? 'Resetting…' : 'Reset Password'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
