
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import useUserStore from "./userStore";
import authFetch from "../utils/authFetch";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const useCourseStore = create(
    devtools(
        (set, get) => ({
            
            courses: [],
            myCourses: [],
            currentCourse: null,
            categories: [],
            loading: false,
            error: null,
            pagination: {
                total: 0,
                page: 1,
                pageSize: 20
            },

            fetchCourses: async (filters = {}) => {
                set({ loading: true, error: null });
                try {
                    const { getAuthHeader } = useUserStore.getState();
                    const params = new URLSearchParams();

                    if (filters.page) params.append("page", filters.page);
                    if (filters.pageSize) params.append("page_size", filters.pageSize);
                    if (filters.category) params.append("category", filters.category);
                    if (filters.difficulty) params.append("difficulty", filters.difficulty);
                    if (filters.classLevel) params.append("class_level", filters.classLevel);
                    if (filters.instructorId) params.append("instructor_id", filters.instructorId);
                    if (filters.enrolledOnly) params.append("enrolled_only", "true");

                    const res = await authFetch(`${API_URL}/api/courses?${params}`, {
                        headers: getAuthHeader()
                    });

                    if (!res.ok) throw new Error("Failed to fetch courses");

                    const data = await res.json();

                    set({
                        courses: data.courses || [],
                        pagination: {
                            total: data.total || 0,
                            page: data.page || 1,
                            pageSize: data.page_size || 20
                        },
                        loading: false
                    });

                    return data.courses;
                } catch (error) {
                    console.error("Fetch courses error:", error);
                    set({ error: error.message, loading: false });
                    return [];
                }
            },

            fetchMyCourses: async () => {
                set({ loading: true, error: null });
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await authFetch(`${API_URL}/api/courses/my-courses`, {
                        headers: getAuthHeader()
                    });

                    if (!res.ok) throw new Error("Failed to fetch my courses");

                    const data = await res.json();
                    set({ myCourses: data.courses || [], loading: false });

                    return data.courses;
                } catch (error) {
                    console.error("Fetch my courses error:", error);
                    set({ error: error.message, loading: false });
                    return [];
                }
            },

            fetchCourseDetails: async (courseId) => {
                set({ loading: true, error: null });
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await authFetch(`${API_URL}/api/courses/${courseId}`, {
                        headers: getAuthHeader()
                    });

                    if (!res.ok) throw new Error("Course not found");

                    const course = await res.json();
                    set({ currentCourse: course, loading: false });

                    return course;
                } catch (error) {
                    console.error("Fetch course details error:", error);
                    set({ error: error.message, loading: false, currentCourse: null });
                    return null;
                }
            },

            createCourse: async (courseData) => {
                set({ loading: true, error: null });
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await authFetch(`${API_URL}/api/courses`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...getAuthHeader()
                        },
                        body: JSON.stringify(courseData)
                    });

                    if (!res.ok) {
                        const error = await res.json();
                        throw new Error(error.detail || "Failed to create course");
                    }

                    const course = await res.json();

                    set(state => ({
                        myCourses: [course, ...state.myCourses],
                        loading: false
                    }));

                    return course;
                } catch (error) {
                    console.error("Create course error:", error);
                    set({ error: error.message, loading: false });
                    return null;
                }
            },

            updateCourse: async (courseId, updateData) => {
                set({ loading: true, error: null });
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await authFetch(`${API_URL}/api/courses/${courseId}`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            ...getAuthHeader()
                        },
                        body: JSON.stringify(updateData)
                    });

                    if (!res.ok) throw new Error("Failed to update course");

                    const course = await res.json();

                    set(state => ({
                        myCourses: state.myCourses.map(c => c.id === courseId ? course : c),
                        currentCourse: state.currentCourse?.id === courseId ? course : state.currentCourse,
                        loading: false
                    }));

                    return course;
                } catch (error) {
                    console.error("Update course error:", error);
                    set({ error: error.message, loading: false });
                    return null;
                }
            },

            publishCourse: async (courseId) => {
                set({ loading: true, error: null });
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await authFetch(`${API_URL}/api/courses/${courseId}/publish`, {
                        method: "POST",
                        headers: getAuthHeader()
                    });

                    if (!res.ok) throw new Error("Failed to publish course");

                    const course = await res.json();

                    set(state => ({
                        myCourses: state.myCourses.map(c => c.id === courseId ? course : c),
                        currentCourse: state.currentCourse?.id === courseId ? course : state.currentCourse,
                        loading: false
                    }));

                    return course;
                } catch (error) {
                    console.error("Publish course error:", error);
                    set({ error: error.message, loading: false });
                    return null;
                }
            },

            addModule: async (courseId, moduleData) => {
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await authFetch(`${API_URL}/api/courses/${courseId}/modules`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...getAuthHeader()
                        },
                        body: JSON.stringify(moduleData)
                    });

                    if (!res.ok) throw new Error("Failed to add module");

                    const module = await res.json();

                    await get().fetchCourseDetails(courseId);

                    return module;
                } catch (error) {
                    console.error("Add module error:", error);
                    set({ error: error.message });
                    return null;
                }
            },

            addContent: async (courseId, moduleId, contentData) => {
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await authFetch(`${API_URL}/api/courses/${courseId}/modules/${moduleId}/content`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...getAuthHeader()
                        },
                        body: JSON.stringify(contentData)
                    });

                    if (!res.ok) throw new Error("Failed to add content");

                    const content = await res.json();

                    await get().fetchCourseDetails(courseId);

                    return content;
                } catch (error) {
                    console.error("Add content error:", error);
                    set({ error: error.message });
                    return null;
                }
            },

            enrollInCourse: async (courseId) => {
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await authFetch(`${API_URL}/api/courses/${courseId}/enroll`, {
                        method: "POST",
                        headers: getAuthHeader()
                    });

                    if (!res.ok) throw new Error("Failed to enroll");

                    const result = await res.json();

                    if (result.success) {
                        
                        set(state => ({
                            courses: state.courses.map(c =>
                                c.id === courseId ? { ...c, is_enrolled: true } : c
                            )
                        }));

                        await get().fetchMyCourses();
                    }

                    return result;
                } catch (error) {
                    console.error("Enrollment error:", error);
                    return { success: false, message: error.message };
                }
            },

            unenrollFromCourse: async (courseId) => {
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await authFetch(`${API_URL}/api/courses/${courseId}/enroll`, {
                        method: "DELETE",
                        headers: getAuthHeader()
                    });

                    if (!res.ok) throw new Error("Failed to unenroll");

                    const result = await res.json();

                    if (result.success) {
                        set(state => ({
                            courses: state.courses.map(c =>
                                c.id === courseId ? { ...c, is_enrolled: false } : c
                            ),
                            myCourses: state.myCourses.filter(c => c.id !== courseId)
                        }));
                    }

                    return result;
                } catch (error) {
                    console.error("Unenrollment error:", error);
                    return { success: false, message: error.message };
                }
            },

            rateCourse: async (courseId, rating, review = null) => {
                try {
                    const { getAuthHeader } = useUserStore.getState();

                    const res = await authFetch(`${API_URL}/api/courses/${courseId}/rate`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...getAuthHeader()
                        },
                        body: JSON.stringify({ rating, review })
                    });

                    if (!res.ok) throw new Error("Failed to rate course");

                    return await res.json();
                } catch (error) {
                    console.error("Rate course error:", error);
                    return { success: false, message: error.message };
                }
            },

            fetchCategories: async () => {
                try {
                    const res = await authFetch(`${API_URL}/api/courses/categories/list`);

                    if (!res.ok) throw new Error("Failed to fetch categories");

                    const data = await res.json();
                    set({ categories: data.categories || [] });

                    return data.categories;
                } catch (error) {
                    console.error("Fetch categories error:", error);
                    return [];
                }
            },

            clearCurrentCourse: () => set({ currentCourse: null }),

            clearError: () => set({ error: null })
        }),
        { name: "course-store" }
    )
);

export default useCourseStore;
