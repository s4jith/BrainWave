/**
 * Assessment Store - Manages assessments, submissions, and grading
 * Zustand store for quiz/exam creation and student taking
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import useUserStore from "./userStore";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * Assessment Store
 */

const useAssessmentStore = create(
    devtools(
        (set, get) => ({
            // State
            assessments: [],
            currentAssessment: null,
            submissions: [],
            mySubmissions: [],
            loading: false,
            error: null,

            // Timer state for timed assessments
            timeRemaining: null,
            timerActive: false,

            // === Teacher Actions ===

            /**
             * Fetch assessments (teacher sees their own, student sees available)
             */
            fetchAssessments: async (courseId = null) => {
                set({ loading: true, error: null });
                try {
                    const { getAuthHeader } = useUserStore.getState();
                    const params = courseId ? `?course_id=${courseId}` : '';

                    const res = await fetch(`${API_URL}/api/assessments${params}`, {
                        headers: getAuthHeader()
                    });

                    if (!res.ok) throw new Error("Failed to fetch assessments");

                    const data = await res.json();
                    set({ assessments: data.assessments || [], loading: false });

                    return data.assessments;
                } catch (error) {
                    console.error("Fetch assessments error:", error);
                    set({ error: error.message, loading: false });
                    return [];
                }
            },

            /**
             * Get assessment details (teacher view with answers)
             */
            fetchAssessmentDetails: async (assessmentId) => {
                set({ loading: true, error: null });
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await fetch(`${API_URL}/api/assessments/${assessmentId}`, {
                        headers: getAuthHeader()
                    });

                    if (!res.ok) throw new Error("Assessment not found");

                    const assessment = await res.json();
                    set({ currentAssessment: assessment, loading: false });

                    return assessment;
                } catch (error) {
                    console.error("Fetch assessment error:", error);
                    set({ error: error.message, loading: false });
                    return null;
                }
            },

            /**
             * Create a new assessment
             */
            createAssessment: async (assessmentData) => {
                set({ loading: true, error: null });
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await fetch(`${API_URL}/api/assessments`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...getAuthHeader()
                        },
                        body: JSON.stringify(assessmentData)
                    });

                    if (!res.ok) {
                        const error = await res.json();
                        throw new Error(error.detail || "Failed to create assessment");
                    }

                    const assessment = await res.json();
                    set(state => ({
                        assessments: [assessment, ...state.assessments],
                        currentAssessment: assessment,
                        loading: false
                    }));

                    return assessment;
                } catch (error) {
                    console.error("Create assessment error:", error);
                    set({ error: error.message, loading: false });
                    return null;
                }
            },

            /**
             * Update an assessment
             */
            updateAssessment: async (assessmentId, updateData) => {
                set({ loading: true, error: null });
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await fetch(`${API_URL}/api/assessments/${assessmentId}`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            ...getAuthHeader()
                        },
                        body: JSON.stringify(updateData)
                    });

                    if (!res.ok) throw new Error("Failed to update assessment");

                    const assessment = await res.json();
                    set(state => ({
                        assessments: state.assessments.map(a => a.id === assessmentId ? assessment : a),
                        currentAssessment: assessment,
                        loading: false
                    }));

                    return assessment;
                } catch (error) {
                    console.error("Update assessment error:", error);
                    set({ error: error.message, loading: false });
                    return null;
                }
            },

            /**
             * Publish an assessment
             */
            publishAssessment: async (assessmentId) => {
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await fetch(`${API_URL}/api/assessments/${assessmentId}/publish`, {
                        method: "POST",
                        headers: getAuthHeader()
                    });

                    if (!res.ok) throw new Error("Failed to publish assessment");

                    const assessment = await res.json();
                    set(state => ({
                        assessments: state.assessments.map(a => a.id === assessmentId ? assessment : a),
                        currentAssessment: assessment
                    }));

                    return assessment;
                } catch (error) {
                    console.error("Publish assessment error:", error);
                    set({ error: error.message });
                    return null;
                }
            },

            /**
             * Add a question to an assessment
             */
            addQuestion: async (assessmentId, questionData) => {
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await fetch(`${API_URL}/api/assessments/${assessmentId}/questions`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...getAuthHeader()
                        },
                        body: JSON.stringify(questionData)
                    });

                    if (!res.ok) throw new Error("Failed to add question");

                    const question = await res.json();

                    // Refresh assessment details
                    await get().fetchAssessmentDetails(assessmentId);

                    return question;
                } catch (error) {
                    console.error("Add question error:", error);
                    set({ error: error.message });
                    return null;
                }
            },

            /**
             * Delete a question
             */
            deleteQuestion: async (assessmentId, questionId) => {
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await fetch(
                        `${API_URL}/api/assessments/${assessmentId}/questions/${questionId}`,
                        {
                            method: "DELETE",
                            headers: getAuthHeader()
                        }
                    );

                    if (!res.ok) throw new Error("Failed to delete question");

                    // Refresh assessment details
                    await get().fetchAssessmentDetails(assessmentId);

                    return true;
                } catch (error) {
                    console.error("Delete question error:", error);
                    return false;
                }
            },

            // === Student Actions ===

            /**
             * Start an assessment (get student view)
             */
            startAssessment: async (assessmentId) => {
                set({ loading: true, error: null });
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await fetch(`${API_URL}/api/assessments/${assessmentId}/start`, {
                        headers: getAuthHeader()
                    });

                    if (!res.ok) {
                        const error = await res.json();
                        throw new Error(error.detail || "Cannot start assessment");
                    }

                    const assessment = await res.json();

                    // Set up timer if time limit exists
                    if (assessment.time_limit_minutes) {
                        set({
                            timeRemaining: assessment.time_limit_minutes * 60,
                            timerActive: true
                        });
                    }

                    set({ currentAssessment: assessment, loading: false });
                    return assessment;
                } catch (error) {
                    console.error("Start assessment error:", error);
                    set({ error: error.message, loading: false });
                    return null;
                }
            },

            /**
             * Submit answers
             */
            submitAnswers: async (assessmentId, answers) => {
                set({ loading: true, error: null, timerActive: false });
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await fetch(`${API_URL}/api/assessments/${assessmentId}/submit`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...getAuthHeader()
                        },
                        body: JSON.stringify({ answers })
                    });

                    if (!res.ok) throw new Error("Failed to submit answers");

                    const result = await res.json();
                    set({ loading: false, timeRemaining: null });

                    return result;
                } catch (error) {
                    console.error("Submit answers error:", error);
                    set({ error: error.message, loading: false });
                    return null;
                }
            },

            /**
             * Get my submissions
             */
            fetchMySubmissions: async () => {
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await fetch(`${API_URL}/api/assessments/submissions/my`, {
                        headers: getAuthHeader()
                    });

                    if (!res.ok) throw new Error("Failed to fetch submissions");

                    const data = await res.json();
                    set({ mySubmissions: data.submissions || [] });

                    return data.submissions;
                } catch (error) {
                    console.error("Fetch submissions error:", error);
                    return [];
                }
            },

            // === Teacher Grading ===

            /**
             * Get submissions for an assessment
             */
            fetchSubmissions: async (assessmentId) => {
                set({ loading: true });
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await fetch(
                        `${API_URL}/api/assessments/${assessmentId}/submissions`,
                        { headers: getAuthHeader() }
                    );

                    if (!res.ok) throw new Error("Failed to fetch submissions");

                    const data = await res.json();
                    set({ submissions: data.submissions || [], loading: false });

                    return data.submissions;
                } catch (error) {
                    console.error("Fetch submissions error:", error);
                    set({ loading: false });
                    return [];
                }
            },

            /**
             * Grade a submission
             */
            gradeSubmission: async (submissionId, grades, feedback) => {
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await fetch(
                        `${API_URL}/api/assessments/submissions/${submissionId}/grade`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                ...getAuthHeader()
                            },
                            body: JSON.stringify({
                                question_grades: grades,
                                overall_feedback: feedback
                            })
                        }
                    );

                    if (!res.ok) throw new Error("Failed to grade submission");

                    const result = await res.json();

                    // Update local state
                    set(state => ({
                        submissions: state.submissions.map(s =>
                            s.id === submissionId ? { ...s, ...result } : s
                        )
                    }));

                    return result;
                } catch (error) {
                    console.error("Grade submission error:", error);
                    return null;
                }
            },

            // === Timer ===

            /**
             * Tick timer (call every second)
             */
            tickTimer: () => {
                const { timeRemaining, timerActive } = get();
                if (timerActive && timeRemaining !== null && timeRemaining > 0) {
                    set({ timeRemaining: timeRemaining - 1 });
                } else if (timeRemaining === 0) {
                    set({ timerActive: false });
                }
            },

            /**
             * Stop timer
             */
            stopTimer: () => set({ timerActive: false, timeRemaining: null }),

            // Clear state
            clearCurrentAssessment: () => set({ currentAssessment: null, timeRemaining: null, timerActive: false }),
            clearError: () => set({ error: null })
        }),
        { name: "assessment-store" }
    )
);

export default useAssessmentStore;
