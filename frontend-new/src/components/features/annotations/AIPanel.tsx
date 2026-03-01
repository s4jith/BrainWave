// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Sparkles, FileText, BookOpen, Download, X } from 'lucide-react';
import useAnnotationStore from '@/stores/annotationStore';
import useUserStore from '@/stores/userStore';
import { chatService, exportChatAsDoc } from '@/services/api';
import ReactMarkdown from 'react-markdown';

// Actions available in the AI annotation panel
const AI_ACTIONS = [
  { id: 'define', label: 'Define', icon: FileText, description: 'Get clear definitions and meanings', color: 'text-blue-600' },
  { id: 'stick_flow', label: 'Stick Flow', icon: Sparkles, description: 'Visual flow diagram of the concept', color: 'text-purple-600' },
  { id: 'elaborate', label: 'Elaborate', icon: BookOpen, description: 'Detailed explanation with examples', color: 'text-green-600' },
];

// ── AI Annotation Panel – slide-over that processes selected PDF text ──────────
export default function AIPanel({ open, onClose, currentLesson, pageNumber }) {
  const selectedText = useAnnotationStore((state) => state.selectedText);
  const addAIAnnotation = useAnnotationStore((state) => state.addAIAnnotation);
  const { user } = useUserStore();
  const [selectedAction, setSelectedAction] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState('');
  const [error, setError] = useState(null);

  const effectiveSubject = currentLesson?.subject || user.preferredSubject || 'Mathematics';
  const isScreenshotDoubt = !!selectedText?.imageData;
  const preSelectedAction = selectedText?.action;

  useEffect(() => {
    if (open && preSelectedAction && !selectedAction && !isProcessing) {
      const actionMap = { define: 'define', stickflow: 'stick_flow', elaborate: 'elaborate' };
      const mapped = actionMap[preSelectedAction];
      if (mapped) handleActionSelect(AI_ACTIONS.find((a) => a.id === mapped));
    }
  }, [open, preSelectedAction]);

  useEffect(() => {
    if (!open) { setSelectedAction(null); setResponse(''); setError(null); }
  }, [open]);

  const handleActionSelect = async (action) => {
    if (!action) return;
    setSelectedAction(action.id); setIsProcessing(true); setError(null);
    try {
      const queryText = isScreenshotDoubt
        ? `[Screenshot from page ${selectedText?.pageNumber || pageNumber}] Please ${action.id} the content in this area.`
        : selectedText?.text || '';
      const result = await chatService.processAnnotation(
        queryText, action.id, user.classLevel, effectiveSubject,
        currentLesson?.number || 1, selectedText?.imageData, selectedText?.pageNumber || pageNumber
      );
      setResponse(result.answer);
    } catch (err) {
      setError(err?.message || 'Failed to get AI response');
    }
    setIsProcessing(false);
  };

  const handleSave = () => {
    if (selectedText && selectedAction) {
      addAIAnnotation({
        text: selectedText.text, action: selectedAction, response,
        pageNumber, position: selectedText.position, lessonId: currentLesson?.id,
        classLevel: user.classLevel, subject: effectiveSubject, chapter: currentLesson?.number,
      });
      setSelectedAction(null); setResponse(''); onClose();
    }
  };

  const handleDownload = () => {
    if (!response) return;
    const actionLabel = AI_ACTIONS.find((a) => a.id === selectedAction)?.label || 'AI Response';
    exportChatAsDoc(
      [
        { role: 'user', content: `"${selectedText?.text || ''}" — Action: ${actionLabel}`, timestamp: new Date().toISOString() },
        { role: 'assistant', content: response, timestamp: new Date().toISOString() },
      ],
      { filename: `AI-${actionLabel}-${Date.now()}.doc`, title: `AI ${actionLabel}`, userName: 'Your Question', aiName: 'AI Response' }
    );
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-[500px] max-w-[92vw] flex-col bg-white shadow-2xl dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" />
            <h2 className="font-semibold text-gray-900 dark:text-white">AI Assistant</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Selected text preview */}
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
            <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              {isScreenshotDoubt ? 'Selected Area' : 'Selected Text'}
            </p>
            {isScreenshotDoubt && selectedText?.imageData && (
              <img src={selectedText.imageData} alt="Selected area" className="mb-2 max-h-32 rounded border object-contain" />
            )}
            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{selectedText?.text || 'No text selected'}</p>
            {selectedText?.pageNumber && (
              <span className="mt-2 inline-block rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium dark:bg-gray-700">
                Page {selectedText.pageNumber}
              </span>
            )}
          </div>

          {/* Action selector */}
          {!selectedAction && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">What would you like to do?</p>
              {AI_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button key={action.id} disabled={isProcessing} onClick={() => handleActionSelect(action)}
                    className="flex w-full items-start gap-3 rounded-xl border border-gray-200 p-4 text-left hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800">
                    <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${action.color}`} />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{action.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{action.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Response */}
          {selectedAction && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-violet-100 px-3 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                  {AI_ACTIONS.find((a) => a.id === selectedAction)?.label}
                </span>
                <button onClick={() => { setSelectedAction(null); setResponse(''); }} disabled={isProcessing}
                  className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white">Change Action</button>
              </div>

              <div className="min-h-[200px] rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                {isProcessing ? (
                  <div className="flex h-full items-center justify-center py-10">
                    <div className="text-center">
                      <Sparkles className="mx-auto h-8 w-8 animate-pulse text-violet-600" />
                      <p className="mt-2 text-sm text-gray-500">AI is thinking…</p>
                    </div>
                  </div>
                ) : error ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-red-500 mb-2">Error: {error}</p>
                    <button onClick={() => handleActionSelect(AI_ACTIONS.find((a) => a.id === selectedAction))}
                      className="text-xs text-indigo-600 hover:underline">Try Again</button>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{response}</ReactMarkdown>
                  </div>
                )}
              </div>

              {!isProcessing && response && (
                <div className="flex gap-2">
                  <button onClick={handleSave} className="flex-1 rounded-xl bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">
                    Save Annotation
                  </button>
                  <button onClick={handleDownload} className="rounded-xl border border-gray-200 px-3 py-2 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800" title="Download">
                    <Download className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleActionSelect(AI_ACTIONS.find((a) => a.id === selectedAction))}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                    Regenerate
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
