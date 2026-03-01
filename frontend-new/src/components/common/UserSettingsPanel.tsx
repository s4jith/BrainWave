'use client';

// Rewritten for Next.js (was a Vite component using import.meta.env and shadcn Sheet)
import React, { useState, useEffect } from 'react';
import { Settings, BookOpen, Loader2, CheckCircle, X } from 'lucide-react';
import useUserStore from '@/stores/userStore';
import { API_BASE_URL } from '@/config/features';

const LANGUAGE_DESCRIPTIONS: Record<number, string> = {
  5: 'Very simple language (like talking to a 10-year-old)',
  6: 'Simple, clear language (like talking to a 11-year-old)',
  7: 'Clear language with some details (like talking to a 12-year-old)',
  8: 'Standard language with technical terms explained',
  9: 'Academic language with technical terms',
  10: 'Full academic language (board exam level)',
  11: 'Advanced academic language (higher secondary)',
  12: 'Full academic language with exam focus',
};

interface Subject { name: string; has_ai_support?: boolean }

// ── Slide-over settings panel – replaces Vite/shadcn Sheet with plain Next.js ──
export default function UserSettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, setPreferredSubject } = useUserStore();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const fetchSubjects = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/books/student/subjects?class_level=${user.classLevel}`);
        if (res.ok) {
          const data = await res.json();
          setSubjects(data.subjects ?? []);
        }
      } catch { /* silently ignore */ }
      finally { setLoading(false); }
    };
    fetchSubjects();
  }, [open, user.classLevel]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Slide-over panel */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-[400px] max-w-[92vw] flex-col bg-white shadow-2xl dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">User Settings</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Class card */}
          <div className="rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 p-4 dark:border-purple-700 dark:from-purple-900/20 dark:to-blue-900/20">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Your Class</p>
              <span className="rounded-full bg-purple-600 px-3 py-0.5 text-sm font-semibold text-white">Class {user.classLevel}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Contact admin to update your class level.</p>
          </div>

          {/* AI language level */}
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">AI Language Level</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {LANGUAGE_DESCRIPTIONS[user.classLevel] ?? LANGUAGE_DESCRIPTIONS[10]}
            </p>
          </div>

          {/* Subject selector */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-gray-400" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Preferred Subject</p>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 py-4 text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading subjects…</span>
              </div>
            ) : subjects.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {subjects.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => setPreferredSubject(s.name)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${user.preferredSubject === s.name
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                  >
                    {s.name}
                    {s.has_ai_support && <CheckCircle className="h-3 w-3 text-green-400" />}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No subjects available for Class {user.classLevel}. Contact your admin to upload books.</p>
            )}
          </div>

          {/* Current settings summary */}
          <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Current Settings</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Class</span>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium dark:bg-gray-700">Class {user.classLevel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Subject</span>
                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{user.preferredSubject || '—'}</span>
              </div>
            </div>
          </div>

          {/* Tip */}
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-950/20">
            <p className="text-xs text-orange-800 dark:text-orange-200">
              <strong>Tip:</strong> The AI adjusts its language complexity to your class level. Only subjects with uploaded books for your class are shown.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            Save & Close
          </button>
        </div>
      </div>
    </>
  );
}
