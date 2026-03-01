// @ts-nocheck
// Rewritten for Next.js – removes all shadcn Sheet/Button/Badge/Card/ScrollArea deps
import React, { useEffect, useState } from 'react';
import { History, StickyNote, Sparkles, Trash2, Clock, ChevronDown, ChevronUp, X } from 'lucide-react';
import useAnnotationStore from '@/stores/annotationStore';
import useUserStore from '@/stores/userStore';
import ReactMarkdown from 'react-markdown';

// Expandable text with show-more toggle
const ExpandableText = ({ text, limit = 600 }) => {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const isLong = text.length > limit;
  const display = expanded || !isLong ? text : text.slice(0, limit) + '…';
  return (
    <div>
      <div className={`text-sm ${!expanded && isLong ? 'line-clamp-4' : ''}`}>
        <ReactMarkdown>{display}</ReactMarkdown>
      </div>
      {isLong && (
        <button onClick={() => setExpanded(!expanded)} className="mt-1 flex items-center gap-1 text-xs text-violet-600 hover:underline">
          {expanded ? <><ChevronUp className="h-3 w-3" />Show Less</> : <><ChevronDown className="h-3 w-3" />Show More</>}
        </button>
      )}
    </div>
  );
};

const fmtDate = (ts: string | number | Date) => {
  try {
    const d = typeof ts === 'string' && !ts.endsWith('Z') ? new Date(ts + 'Z') : new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return 'Just now'; }
};

// ── History Panel – slide-over showing saved AI + note annotations ─────────────
export default function HistoryPanel({ open, onClose, currentLesson }) {
  const { annotations, clearAnnotations } = useAnnotationStore();
  const { user } = useUserStore();

  // In this shim the store is in-memory; filter to current lesson if present
  const relevant = currentLesson
    ? annotations.filter((a) => a.lessonId === currentLesson?.id || a.chapter === currentLesson?.number)
    : annotations;

  const aiAnnotations = relevant.filter((a) => a.action);
  const noteAnnotations = relevant.filter((a) => !a.action);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-[600px] max-w-[92vw] flex-col bg-white shadow-2xl dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-gray-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Annotations History</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {/* AI Annotations */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-600" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">AI Annotations ({aiAnnotations.length})</h3>
            </div>
            {aiAnnotations.length === 0 ? (
              <p className="rounded-lg bg-gray-50 py-4 text-center text-sm text-gray-400 dark:bg-gray-800">No AI annotations saved yet.</p>
            ) : (
              <div className="space-y-3">
                {aiAnnotations.map((a, i) => (
                  <div key={i} className="rounded-xl border-l-4 border-l-violet-500 bg-white p-4 shadow-sm dark:bg-gray-800">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium capitalize text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">{a.action?.replace('_', ' ') || 'AI'}</span>
                      <div className="flex items-center gap-1 text-xs text-gray-400"><Clock className="h-3 w-3" /> Page {a.pageNumber}</div>
                    </div>
                    <p className="mb-2 rounded bg-gray-50 p-2 text-xs italic text-gray-600 dark:bg-gray-700 dark:text-gray-400 line-clamp-2">"{a.text}"</p>
                    {a.response && (
                      <div className="rounded-lg bg-violet-50 p-3 dark:bg-violet-950/20">
                        <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-violet-600"><Sparkles className="h-3 w-3" />AI Response</p>
                        <ExpandableText text={a.response} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Note Annotations */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-green-600" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Personal Notes ({noteAnnotations.length})</h3>
            </div>
            {noteAnnotations.length === 0 ? (
              <p className="rounded-lg bg-gray-50 py-4 text-center text-sm text-gray-400 dark:bg-gray-800">No notes saved yet.</p>
            ) : (
              <div className="space-y-3">
                {noteAnnotations.map((a, i) => (
                  <div key={i} className="rounded-xl border-l-4 border-l-green-500 bg-white p-4 shadow-sm dark:bg-gray-800">
                    <p className="mb-1 text-xs italic text-gray-500 line-clamp-2">"{a.text}"</p>
                    <p className="text-xs text-gray-400">Page {a.pageNumber}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clear all */}
          {(aiAnnotations.length + noteAnnotations.length) > 0 && (
            <button onClick={() => { if (confirm('Clear all annotations?')) clearAnnotations(); }}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-200 py-2 text-sm text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/20">
              <Trash2 className="h-4 w-4" /> Clear All
            </button>
          )}
        </div>
      </div>
    </>
  );
}
