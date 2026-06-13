"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface StickyNote {
  id: string;
  title: string;
  content: string;
  source: string;
  sourceDetails?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface NewStickyNote {
  title?: string;
  content?: string;
  source?: string;
  sourceDetails?: unknown;
}

interface NotesState {
  notes: StickyNote[];
}

interface NotesActions {
  addNote: (note: NewStickyNote) => StickyNote;
  updateNote: (id: string, updates: Partial<StickyNote>) => void;
  deleteNote: (id: string) => void;
  getRecentNotes: (limit?: number) => StickyNote[];
  searchNotes: (query: string) => StickyNote[];
  getNotesBySource: (source: string) => StickyNote[];
  clearAllNotes: () => void;
}

export const useNotesStore = create<NotesState & NotesActions>()(
  persist(
    (set, get) => ({
      notes: [],

      addNote: (note) => {
        const now = new Date().toISOString();
        const newNote: StickyNote = {
          id: Date.now().toString(),
          title: note.title || "Untitled Note",
          content: note.content ?? "",
          source: note.source ?? "Manual",
          sourceDetails: note.sourceDetails,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ notes: [newNote, ...state.notes] }));
        return newNote;
      },

      updateNote: (id, updates) =>
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n,
          ),
        })),

      deleteNote: (id) =>
        set((state) => ({ notes: state.notes.filter((n) => n.id !== id) })),

      getRecentNotes: (limit = 3) => get().notes.slice(0, limit),

      searchNotes: (query) => {
        const q = query.toLowerCase();
        return get().notes.filter(
          (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q),
        );
      },

      getNotesBySource: (source) => get().notes.filter((n) => n.source === source),

      clearAllNotes: () => set({ notes: [] }),
    }),
    {
      name: "brainwave-notes-storage",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
        return window.localStorage;
      }),
    },
  ),
);
