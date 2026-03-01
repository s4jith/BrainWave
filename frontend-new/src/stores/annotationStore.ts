/**
 * annotationStore – shim for the old Vite annotation store.
 * Provides the shape AIPanel and HighlightOverlay depend on without
 * needing the full Zustand persist store from the old code.
 */
import { create } from 'zustand';

interface SelectedText {
    text: string;
    action?: string;
    imageData?: string;
    pageNumber?: number;
    position?: { x: number; y: number; width: number; height: number };
}

interface AIAnnotation {
    text: string;
    action: string;
    response: string;
    pageNumber: number;
    position?: SelectedText['position'];
    lessonId?: string;
    classLevel: number;
    subject: string;
    chapter?: number;
}

interface AnnotationState {
    selectedText: SelectedText | null;
    annotations: AIAnnotation[];
    viewingAnnotation: AIAnnotation | null;
    activePanel: string | null;
    setSelectedText: (t: SelectedText | null) => void;
    addAIAnnotation: (a: AIAnnotation) => void;
    clearAnnotations: () => void;
    getAnnotationsByPage: (lessonId: string | undefined, page: number) => AIAnnotation[];
    setViewingAnnotation: (a: AIAnnotation | null) => void;
    setActivePanel: (panel: string | null) => void;
}

// In-memory annotation state shared by AIPanel, HighlightOverlay, and HistoryPanel
const useAnnotationStore = create<AnnotationState>((set, get) => ({
    selectedText: null,
    annotations: [],
    viewingAnnotation: null,
    activePanel: null,
    setSelectedText: (t) => set({ selectedText: t }),
    addAIAnnotation: (a) => set((s) => ({ annotations: [...s.annotations, a] })),
    clearAnnotations: () => set({ annotations: [] }),
    getAnnotationsByPage: (lessonId, page) =>
        get().annotations.filter((a) => a.pageNumber === page && (!lessonId || a.lessonId === lessonId)),
    setViewingAnnotation: (a) => set({ viewingAnnotation: a }),
    setActivePanel: (panel) => set({ activePanel: panel }),
}));

export default useAnnotationStore;
