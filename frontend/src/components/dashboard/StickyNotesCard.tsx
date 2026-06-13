"use client";

import { useState } from "react";
import { Edit3, Plus, Save, StickyNote as StickyIcon, Trash2, X } from "lucide-react";
import { useNotesStore, type StickyNote } from "@stores/notesStore";

const stickyColors = [
  "bg-pink-500",
  "bg-orange-500",
  "bg-slate-700",
  "bg-fuchsia-500",
  "bg-cyan-500",
  "bg-orange-600",
];

function colorFor(index: number): string {
  return stickyColors[index % stickyColors.length]!;
}

/**
 * Compact sticky-note widget for the student dashboard. Holds notes
 * in the client-side notesStore (persisted to localStorage); server-
 * side notes live under the Notes feature.
 */
export function StickyNotesCard() {
  const { notes, addNote, updateNote, deleteNote } = useNotesStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingNote, setEditingNote] = useState<StickyNote | null>(null);
  const [draft, setDraft] = useState({ title: "", content: "" });

  const recentNotes = notes.slice(0, 6);

  function handleAddNote() {
    if (!draft.title.trim() && !draft.content.trim()) return;
    addNote({ title: draft.title || "Quick Note", content: draft.content, source: "Sticky Note" });
    setDraft({ title: "", content: "" });
    setShowAddModal(false);
  }

  function handleUpdateNote() {
    if (!editingNote) return;
    updateNote(editingNote.id, { title: editingNote.title, content: editingNote.content });
    setEditingNote(null);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-700">
            <StickyIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Sticky Notes</h3>
            <p className="text-xs text-slate-500">{notes.length} notes</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-lg bg-slate-900 p-2 text-white hover:opacity-90"
          aria-label="Add note"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {recentNotes.length === 0 ? (
        <div className="py-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-200">
            <StickyIcon className="h-8 w-8 text-slate-500" />
          </div>
          <p className="mb-3 text-slate-500">No sticky notes yet</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Create Your First Note
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {recentNotes.map((note, index) => (
            <div
              key={note.id}
              className={`${colorFor(index)} group relative min-h-[120px] cursor-pointer rounded-xl p-4 text-white shadow-lg transition-transform hover:scale-105`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNote(note.id);
                }}
                className="absolute right-2 top-2 rounded-full bg-white/20 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingNote(note);
                }}
                className="absolute right-8 top-2 rounded-full bg-white/20 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Edit"
              >
                <Edit3 className="h-3 w-3" />
              </button>
              <h4 className="mb-2 line-clamp-1 text-sm font-bold">{note.title}</h4>
              <p className="line-clamp-3 text-xs opacity-80">{note.content}</p>
            </div>
          ))}
        </div>
      )}

      {showAddModal ? (
        <NoteModal
          title="New Sticky Note"
          note={draft}
          onChange={setDraft}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddNote}
          submitLabel="Save Note"
        />
      ) : null}

      {editingNote ? (
        <NoteModal
          title="Edit Note"
          note={{ title: editingNote.title, content: editingNote.content }}
          onChange={(next) => setEditingNote({ ...editingNote, ...next })}
          onClose={() => setEditingNote(null)}
          onSubmit={handleUpdateNote}
          submitLabel="Update"
        />
      ) : null}
    </div>
  );
}

interface NoteModalProps {
  title: string;
  note: { title: string; content: string };
  onChange: (next: { title: string; content: string }) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
}

function NoteModal({ title, note, onChange, onClose, onSubmit, submitLabel }: NoteModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <input
          type="text"
          placeholder="Note title..."
          value={note.title}
          onChange={(e) => onChange({ ...note, title: e.target.value })}
          className="mb-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
        <textarea
          placeholder="Write your note..."
          value={note.content}
          onChange={(e) => onChange({ ...note, content: e.target.value })}
          rows={4}
          className="mb-4 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-slate-500 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={onSubmit}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 font-medium text-white hover:opacity-90"
          >
            <Save className="h-4 w-4" />
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
