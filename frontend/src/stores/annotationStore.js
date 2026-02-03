import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { historyService, notesService } from "../services/api";
import useUserStore from "./userStore";

/**
 * Zustand Store for Annotation Management
 * Handles persistent storage via Backend API
 */

const useAnnotationStore = create(
  devtools(
    persist(
      (set, get) => ({
        // State
        annotations: [],
        selectedText: null,
        activePanel: null, // 'ai' | 'note' | 'history' | null
        viewingAnnotation: null,
        loading: false,

        // Actions
        setSelectedText: (text) => set({ selectedText: text }),

        setActivePanel: (panel) => set({ activePanel: panel }),

        setViewingAnnotation: (annotation) =>
          set({ viewingAnnotation: annotation }),

        // Fetch all annotations (Notes + AI History)
        fetchAnnotations: async (studentId, classLevel, subject, chapter) => {
          if (!studentId) {
            set({ annotations: [], loading: false });
            return;
          }
          set({ loading: true });
          try {
            const [notesData, historyData] = await Promise.all([
              notesService.getNotes(studentId, { class_level: classLevel, subject, chapter }),
              historyService.getHistory(studentId, { class_level: classLevel, subject, chapter, limit: 100 })
            ]);

            // Transform backend data to frontend format
            const notes = (notesData.notes || []).map(n => ({
              id: n.id,
              type: "note",
              text: n.highlight_text,
              heading: n.heading,
              content: n.note_content,
              pageNumber: n.page_number,
              timestamp: n.created_at,
              lessonId: n.chapter, // Approximation if lessonId is chapter
              // We might need a better way to map lessonId if it's not chapter number
              // For now, assuming lessonId in frontend is linked to chapter
            }));

            const history = (historyData.history || []).map(h => ({
              id: h.id,
              type: "ai",
              text: h.selected_text,
              action: h.action_type,
              response: h.ai_response,
              pageNumber: h.page_number,
              timestamp: h.created_at,
              lessonId: h.chapter,
            }));

            set({ annotations: [...notes, ...history], loading: false });
          } catch (error) {
            console.error("Failed to fetch annotations:", error);
            set({ loading: false });
          }
        },

        // Add a note annotation
        addNote: async (data) => {
          const userState = useUserStore.getState().user;
          if (!userState?.id) {
            console.error("User not logged in, cannot save note");
            return;
          }

          // Optimistic update
          const tempId = Date.now().toString();
          const newAnnotation = {
            id: tempId,
            type: "note",
            text: data.text,
            heading: data.heading,
            content: data.content,
            pageNumber: data.pageNumber,
            timestamp: new Date().toISOString(),
            lessonId: data.lessonId,
          };

          set((state) => ({
            annotations: [newAnnotation, ...state.annotations],
            activePanel: null,
            selectedText: null,
          }));

          try {
            // Call backend
            const savedNote = await notesService.createNote({
              student_id: userState.id,
              class_level: data.classLevel || userState.classLevel,
              subject: data.subject || "General",
              chapter: data.chapter || 1,
              page_number: data.pageNumber,
              highlight_text: data.text,
              note_content: data.content || "",
              heading: data.heading,
            });

            // Replace temp ID with real ID
            set((state) => ({
              annotations: state.annotations.map(a =>
                a.id === tempId ? { ...a, id: savedNote.id, timestamp: savedNote.created_at } : a
              )
            }));
          } catch (error) {
            console.error("Failed to save note:", error);
            // Optionally revert:
            set((state) => ({
              annotations: state.annotations.filter(a => a.id !== tempId)
            }));
          }
        },

        // Add an AI annotation
        addAIAnnotation: async (data) => {
          const userState = useUserStore.getState().user;
          if (!userState?.id) {
            console.error("User not logged in, cannot save AI annotation");
            return;
          }

          const tempId = Date.now().toString();
          const newAnnotation = {
            id: tempId,
            type: "ai",
            text: data.text,
            action: data.action,
            response: data.response,
            pageNumber: data.pageNumber,
            timestamp: new Date().toISOString(),
            lessonId: data.lessonId,
          };

          set((state) => ({
            annotations: [newAnnotation, ...state.annotations],
          }));

          try {
            const savedHistory = await historyService.createEntry({
              student_id: userState.id,
              class_level: data.classLevel || userState.classLevel,
              subject: data.subject || "General",
              chapter: data.chapter || 1,
              page_number: data.pageNumber,
              selected_text: data.text,
              action_type: data.action,
              ai_response: data.response,
              source_count: 0 // Optional
            });

            set((state) => ({
              annotations: state.annotations.map(a =>
                a.id === tempId ? { ...a, id: savedHistory.id, timestamp: savedHistory.created_at } : a
              )
            }));
          } catch (error) {
            console.error("Failed to save AI annotation:", error);
            set((state) => ({
              annotations: state.annotations.filter(a => a.id !== tempId)
            }));
          }
        },

        // Update AI annotation with response (Local only - Backend updates not supported yet for history)
        updateAIResponse: (id, response) => {
          set((state) => ({
            annotations: state.annotations.map((ann) =>
              ann.id === id ? { ...ann, response } : ann
            ),
          }));
        },

        // Delete annotation
        deleteAnnotation: async (id, type) => {
          // Optimistic delete
          const previousAnnotations = get().annotations;
          set((state) => ({
            annotations: state.annotations.filter((ann) => ann.id !== id),
          }));

          try {
            if (type === "note") {
              await notesService.deleteNote(id); // notesService needs deleteNote
              // Oops, api.js notesService doesn't have deleteNote? 
              // Wait, previous api.js check showed delete_note endpoint but let's check exact api.js export
            } else if (type === "ai") {
              await historyService.deleteEntry(id);
            }
          } catch (error) {
            console.error("Failed to delete annotation:", error);
            set({ annotations: previousAnnotations }); // Revert
          }
        },

        // Get annotations for current lesson
        getAnnotationsByLesson: (lessonId) => {
          // Filter by lessonId (assuming lessonId match)
          // Since backend returns all for student/subject/chapter, we filter locally
          // Note: Backend 'chapter' field is used as lessonId mapping
          // If lessonId is complex string, we might need adjustments
          return get().annotations.filter((ann) => ann.lessonId == lessonId || ann.lessonId === String(lessonId));
        },

        // Get annotations by page
        getAnnotationsByPage: (lessonId, pageNumber) => {
          return get().annotations.filter(
            (ann) => (ann.lessonId == lessonId || ann.lessonId === String(lessonId)) && ann.pageNumber === pageNumber
          );
        },
      }),
      {
        name: "annotation-storage", // Keep persist for offline/cache
      }
    )
  )
);

export default useAnnotationStore;
