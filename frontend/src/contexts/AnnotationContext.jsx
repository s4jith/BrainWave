import React, { createContext, useContext, useState, useCallback } from "react";

const AnnotationContext = createContext(undefined);

export const useAnnotations = () => {
  const context = useContext(AnnotationContext);
  if (!context) {
    throw new Error("useAnnotations must be used within AnnotationProvider");
  }
  return context;
};

export const AnnotationProvider = ({ children }) => {
  const [annotations, setAnnotations] = useState([]);
  const [selectedText, setSelectedText] = useState(null);
  const [activePanel, setActivePanel] = useState(null); 
  const [viewingAnnotation, setViewingAnnotation] = useState(null);

  const addNote = useCallback((data) => {
    const newAnnotation = {
      id: Date.now(),
      type: "note",
      text: data.text,
      heading: data.heading,
      content: data.content,
      pageNumber: data.pageNumber,
      position: data.position,
      timestamp: new Date().toISOString(),
      lessonId: data.lessonId,
    };
    setAnnotations((prev) => [...prev, newAnnotation]);
    setActivePanel(null);
    setSelectedText(null);
    return newAnnotation;
  }, []);

  const addAIAnnotation = useCallback((data) => {
    const newAnnotation = {
      id: Date.now(),
      type: "ai",
      text: data.text,
      action: data.action, 
      response: data.response,
      pageNumber: data.pageNumber,
      position: data.position,
      timestamp: new Date().toISOString(),
      lessonId: data.lessonId,
    };
    setAnnotations((prev) => [...prev, newAnnotation]);
    return newAnnotation;
  }, []);

  const updateAIResponse = useCallback((id, response) => {
    setAnnotations((prev) =>
      prev.map((ann) => (ann.id === id ? { ...ann, response } : ann))
    );
  }, []);

  const deleteAnnotation = useCallback((id) => {
    setAnnotations((prev) => prev.filter((ann) => ann.id !== id));
  }, []);

  const getAnnotationsByLesson = useCallback(
    (lessonId) => {
      return annotations.filter((ann) => ann.lessonId === lessonId);
    },
    [annotations]
  );

  const getAnnotationsByPage = useCallback(
    (lessonId, pageNumber) => {
      return annotations.filter(
        (ann) => ann.lessonId === lessonId && ann.pageNumber === pageNumber
      );
    },
    [annotations]
  );

  const value = {
    annotations,
    selectedText,
    activePanel,
    viewingAnnotation,
    setSelectedText,
    setActivePanel,
    setViewingAnnotation,
    addNote,
    addAIAnnotation,
    updateAIResponse,
    deleteAnnotation,
    getAnnotationsByLesson,
    getAnnotationsByPage,
  };

  return (
    <AnnotationContext.Provider value={value}>
      {children}
    </AnnotationContext.Provider>
  );
};
