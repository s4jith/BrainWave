'use client';
// @ts-nocheck
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bot } from 'lucide-react';
import ChatbotPanel from '@/components/features/ChatbotPanel';
import { studentService } from '@/services/student.service';
import { useAuthStore } from '@/stores/authStore';
import { useAsync } from '@/hooks/useAsync';
import { useEffect } from 'react';

// ── Standalone AI Chat page – full-screen chatbot for unlocked students ────────
export default function StudentAiChatPage() {
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const [chatOpen, setChatOpen] = useState(true);

    // Check if student has AI chat unlocked
    const { data: features } = useAsync(async () => {
        if (!user) return null;
        const res = await studentService.getFeatures();
        console.log('[ai-chat] Feature flags loaded');
        return res;
    });
    useEffect(() => { }, []); // trigger initial render

    const aiUnlocked = features?.features?.ai_chatbot === true;

    return (
        <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-950">
            {/* Slim top bar for back navigation */}
            <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
                <button
                    onClick={() => router.push('/student')}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Dashboard
                </button>
                <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
                <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-indigo-600" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">AI Study Assistant</span>
                </div>
            </div>

            {/* Locked state guard */}
            {features && !aiUnlocked ? (
                <div className="flex flex-1 items-center justify-center">
                    <div className="text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-gray-400">
                                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                        </div>
                        <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">AI Chat Locked</h2>
                        <p className="max-w-xs text-sm text-gray-500 dark:text-gray-400">
                            Your AI chat feature isn&apos;t unlocked yet. Complete more exercises or contact your teacher to unlock it.
                        </p>
                        <button
                            onClick={() => router.push('/student')}
                            className="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                        >
                            Go to Dashboard
                        </button>
                    </div>
                </div>
            ) : (
                /* Full-screen ChatbotPanel – pass isOpen=true, onClose navigates back */
                <div className="flex-1 overflow-hidden">
                    <ChatbotPanel isOpen={chatOpen} onClose={() => router.push('/student')} />
                </div>
            )}
        </div>
    );
}
