
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import useUserStore from "./userStore";
import authFetch from "../utils/authFetch";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const useAssessmentStore = create(
    devtools(
        (set, get) => ({
            
            assessments: [],
            currentAssessment: null,
            submissions: [],
            mySubmissions: [],
            loading: false,
            error: null,

            timeRemaining: null,
            timerActive: false,

            fetchAssessments: async (courseId = null) => {
                set({ loading: true, error: null });
                try {
                    const { getAuthHeader } = useUserStore.getState();
                    const params = courseId ? `?course_id=${courseId}` : '';

                    const res = await authFetch(`${API_URL}/api/assessments${params}`, {
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

            fetchAssessmentDetails: async (assessmentId) => {
                set({ loading: true, error: null });
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await authFetch(`${API_URL}/api/assessments/${assessmentId}`, {
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

            createAssessment: async (assessmentData) => {
                set({ loading: true, error: null });
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await authFetch(`${API_URL}/api/assessments`, {
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

            updateAssessment: async (assessmentId, updateData) => {
                set({ loading: true, error: null });
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await authFetch(`${API_URL}/api/assessments/${assessmentId}`, {
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

            publishAssessment: async (assessmentId) => {
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await authFetch(`${API_URL}/api/assessments/${assessmentId}/publish`, {
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

            addQuestion: async (assessmentId, questionData) => {
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await authFetch(`${API_URL}/api/assessments/${assessmentId}/questions`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...getAuthHeader()
                        },
                        body: JSON.stringify(questionData)
                    });

                    if (!res.ok) throw new Error("Failed to add question");

                    const question = await res.json();

                    await get().fetchAssessmentDetails(assessmentId);

                    return question;
                } catch (error) {
                    console.error("Add question error:", error);
                    set({ error: error.message });
                    return null;
                }
            },

            deleteQuestion: async (assessmentId, questionId) => {
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await authFetch(
                        `${API_URL}/api/assessments/${assessmentId}/questions/${questionId}`,
                        {
                            method: "DELETE",
                            headers: getAuthHeader()
                        }
                    );

                    if (!res.ok) throw new Error("Failed to delete question");

                    await get().fetchAssessmentDetails(assessmentId);

                    return true;
                } catch (error) {
                    console.error("Delete question error:", error);
                    return false;
                }
            },

            startAssessment: async (assessmentId) => {
                set({ loading: true, error: null });
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await authFetch(`${API_URL}/api/assessments/${assessmentId}/start`, {
                        headers: getAuthHeader()
                    });

                    if (!res.ok) {
                        const error = await res.json();
                        throw new Error(error.detail || "Cannot start assessment");
                    }

                    const assessment = await res.json();

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

            submitAnswers: async (assessmentId, answers) => {
                set({ loading: true, error: null, timerActive: false });
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await authFetch(`${API_URL}/api/assessments/${assessmentId}/submit`, {
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

            fetchMySubmissions: async () => {
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await authFetch(`${API_URL}/api/assessments/submissions/my`, {
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

            fetchSubmissions: async (assessmentId) => {
                set({ loading: true });
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await authFetch(
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

            gradeSubmission: async (submissionId, grades, feedback) => {
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await authFetch(
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

            tickTimer: () => {
                const { timeRemaining, timerActive } = get();
                if (timerActive && timeRemaining !== null && timeRemaining > 0) {
                    set({ timeRemaining: timeRemaining - 1 });
                } else if (timeRemaining === 0) {
                    set({ timerActive: false });
                }
            },

            stopTimer: () => set({ timerActive: false, timeRemaining: null }),

            clearCurrentAssessment: () => set({ currentAssessment: null, timeRemaining: null, timerActive: false }),
            clearError: () => set({ error: null })
        }),
        { name: "assessment-store" }
    )
);

export default useAssessmentStore;
