// @ts-nocheck
// Rewritten for Next.js – removes shadcn Sheet/Button/Input/Textarea deps
import React, { useState } from 'react';
import { StickyNote, X, Save } from 'lucide-react';
import useAnnotationStore from '@/stores/annotationStore';
import useUserStore from '@/stores/userStore';

// ── Notes Panel – slide-over for saving personal notes on selected PDF text ─────
export default function NotesPanel({ open, onClose, pageNumber, currentLesson }) {
  const selectedText = useAnnotationStore((state) => state.selectedText);
  const addAIAnnotation = useAnnotationStore((state) => state.addAIAnnotation);
  const { user } = useUserStore();
  const [heading, setHeading] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!heading.trim()) return;
    setSaving(true);
    addAIAnnotation({
      text: selectedText?.text || '',
      action: '', // empty action = note type
      response: content,
      pageNumber: pageNumber || selectedText?.pageNumber || 1,
      position: selectedText?.position,
      lessonId: currentLesson?.id,
      classLevel: user.classLevel,
      subject: currentLesson?.subject || user.preferredSubject,
      chapter: currentLesson?.number,
    });
    console.log('[notes-panel] Note saved:', heading);
    setHeading(''); setContent('');
    setSaving(false);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-[420px] max-w-[92vw] flex-col bg-white shadow-2xl dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-green-600" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Add Note</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Selected text */}
          {selectedText?.text && (
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
              <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">Selected text</p>
              <p className="text-sm italic text-gray-700 dark:text-gray-300 line-clamp-3">"{selectedText.text}"</p>
            </div>
          )}

          {/* Heading */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Note heading *</label>
            <input
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              placeholder="E.g. Important definition…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          {/* Content */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Your note</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="Write your notes here…"
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
          <button
            onClick={handleSave}
            disabled={saving || !heading.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save Note'}
          </button>
        </div>
      </div>
    </>
  );
}
