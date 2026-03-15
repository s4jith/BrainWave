'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, Slack } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { SignupRequest } from '@/types/auth.types';
import { AnimatedCharacters } from '@/components/ui/animated-characters';

// ── Signup Page – replicates old frontend split-panel design ─────────────────
export default function SignupPage() {
    const { signup } = useAuth();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [isTypingPwd, setIsTypingPwd] = useState(false);
    const [role, setRole] = useState<'STUDENT' | 'TEACHER'>('STUDENT');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email || !password) { setError('Please fill in all fields'); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters'); return; }

        setLoading(true);
        setError('');
        console.log('[auth] Attempting signup for:', email, 'role:', role);

        try {
            // Split full name into first_name / last_name for the API
            const nameParts = name.trim().split(' ');
            const payload: SignupRequest = {
                name,
                first_name: nameParts[0],
                last_name: nameParts.slice(1).join(' ') || nameParts[0],
                email,
                password,
                role,
            };
            await signup(payload);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            setError(msg ?? 'Signup failed. Please try again.');
            console.error('[auth] Signup error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-white">

            {/* Left panel – brand */}
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

                <div className="mb-10 w-full flex justify-center transform scale-90 xxl:scale-100">
                    <AnimatedCharacters password={password} showPassword={showPwd} isTyping={isTypingPwd} />
                </div>
            </div>

            {/* Right panel – signup form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center px-8">
                <div className="w-full max-w-md">
                    <div className="text-center mb-10">
                        <h1 className="text-4xl font-bold text-gray-900 mb-3">Join us!</h1>
                        <p className="text-gray-500">Create your account to start learning today.</p>
                    </div>

                    {/* Role toggle */}
                    <div className="flex justify-center gap-6 mb-8">
                        {(['STUDENT', 'TEACHER'] as const).map((r, i, arr) => (
                            <div key={r} className="flex items-center gap-6">
                                <button
                                    type="button"
                                    onClick={() => setRole(r)}
                                    className={`text-sm font-medium transition-colors ${role === r ? 'text-green-500' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    {r.charAt(0) + r.slice(1).toLowerCase()}
                                </button>
                                {i < arr.length - 1 && <span className="text-gray-300">|</span>}
                            </div>
                        ))}
                    </div>

                    <form onSubmit={handleSignup} className="space-y-4">
                        <input
                            type="text"
                            placeholder="Your full name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full h-14 px-5 bg-gray-100 rounded-2xl text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-gray-200 transition-all"
                        />
                        <input
                            type="email"
                            placeholder="Your email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full h-14 px-5 bg-gray-100 rounded-2xl text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-gray-200 transition-all"
                        />
                        <div className="relative">
                            <input
                                type={showPwd ? 'text' : 'password'}
                                placeholder="Create a password"
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

                        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-14 mt-4 font-semibold rounded-2xl bg-gray-900 hover:bg-gray-800 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {loading ? 'Creating account…' : 'Get Started'}
                        </button>
                    </form>

                    <div className="text-center mt-10 text-gray-400 text-sm space-y-1">
                        <p>Already have an account?</p>
                        <Link href="/login" className="text-green-500 hover:text-green-600 font-medium">
                            Sign in here
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
