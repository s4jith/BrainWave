import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useNotesStore = create(
  persist(
    (set, get) => ({
      
      notes: [],

      addNote: (note) => {
        const newNote = {
          id: Date.now().toString(),
          title: note.title || 'Untitled Note',
          content: note.content,
          source: note.source || 'Manual', 
          sourceDetails: note.sourceDetails || null, 
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          notes: [newNote, ...state.notes],
        }));
        return newNote;
      },

      updateNote: (noteId, updates) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === noteId
              ? { ...note, ...updates, updatedAt: new Date().toISOString() }
              : note
          ),
        }));
      },

      deleteNote: (noteId) => {
        set((state) => ({
          notes: state.notes.filter((note) => note.id !== noteId),
        }));
      },

      getRecentNotes: (limit = 3) => {
        const { notes } = get();
        return notes.slice(0, limit);
      },

      searchNotes: (query) => {
        const { notes } = get();
        const lowerQuery = query.toLowerCase();
        return notes.filter(
          (note) =>
            note.title.toLowerCase().includes(lowerQuery) ||
            note.content.toLowerCase().includes(lowerQuery)
        );
      },

      getNotesBySource: (source) => {
        const { notes } = get();
        return notes.filter((note) => note.source === source);
      },

      clearAllNotes: () => {
        set({ notes: [] });
      },
    }),
    {
      name: 'brainwave-notes-storage', 
    }
  )
);

export default useNotesStore;
