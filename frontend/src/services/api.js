
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

import useUserStore from "../stores/userStore";

/**
 * Authenticated fetch wrapper.
 * Automatically injects the JWT Bearer token from the user store
 * into every request's Authorization header.
 */
function authFetch(url, options = {}) {
  const token = useUserStore.getState().accessToken;
  const headers = { ...(options.headers || {}) };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
}

export const chatService = {
  
  async processAnnotation(text, action, classLevel, subject, chapter, imageData = null, pageNumber = null) {
    try {
      const requestBody = {
        selected_text: text,
        action: action,
        class_level: classLevel,
        subject: subject,
        chapter: chapter,
      };

      if (imageData) {
        requestBody.image_data = imageData;
      }

      if (pageNumber) {
        requestBody.page_number = pageNumber;
      }

      const response = await authFetch(`${API_BASE_URL}/api/annotation/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `API Error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        answer: data.answer,
        actionType: data.action_type,
        sourceCount: data.source_count,
      };
    } catch (error) {
      console.error("Annotation API Error:", error);
      throw error;
    }
  },

  async getExplanation(text, mode, classLevel, subject, chapter) {
    return this.processAnnotation(text, mode, classLevel, subject, chapter);
  },

  async getStickFlow(text, classLevel, subject, chapter) {
    return this.processAnnotation(text, "stick_flow", classLevel, subject, chapter);
  },

  async studentChat(question, classLevel, subject, chapter, mode = "quick") {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/chat/student`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: question,
          class_level: classLevel,
          subject: subject,
          chapter: chapter,
          mode: mode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Student Chat API Error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        answer: data.answer,
        sources: data.source_chunks || [],
      };
    } catch (error) {
      console.error("Student Chat API Error:", error);
      throw error;
    }
  },

  studentChatStream(question, classLevel, subject, chapter, mode = "quick", onChunk, onComplete, onError) {
    const controller = new AbortController();

    const fetchStream = async () => {
      try {
        const response = await authFetch(`${API_BASE_URL}/api/chat/student/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: question,
            class_level: classLevel,
            subject: subject,
            chapter: chapter,
            mode: mode,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Streaming Chat API Error: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n\n");
          buffer = lines.pop() || ""; 

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.error) {
                  onError?.(new Error(data.error));
                  return;
                }

                if (data.done) {
                  onComplete?.({
                    sources: data.sources || [],
                    cached: data.cached || false,
                    totalLength: data.total_length || 0,
                  });
                } else if (data.text) {
                  onChunk?.(data.text);
                }
              } catch (parseError) {
                console.warn("Failed to parse SSE message:", line);
              }
            }
          }
        }
      } catch (error) {
        if (error.name === "AbortError") {
          console.log("Stream aborted by user");
        } else {
          console.error("Streaming Chat Error:", error);
          onError?.(error);
        }
      }
    };

    fetchStream();

    return () => controller.abort();
  },

  async imageChat(imageFile, classLevel, subject, chapter, mode = "quick", userQuery = null) {
    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("class_level", classLevel);
      formData.append("subject", subject);
      formData.append("chapter", chapter);
      formData.append("mode", mode);
      if (userQuery) {
        formData.append("user_query", userQuery);
      }

      const response = await authFetch(`${API_BASE_URL}/api/chat/image`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Image Chat API Error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        answer: data.answer,
        sources: data.source_chunks || [],
        imageAnalysis: data.image_analysis || {},
      };
    } catch (error) {
      console.error("Image Chat API Error:", error);
      throw error;
    }
  },
};

export const assessmentService = {
  
  async getEnhancedQuestions(classLevel, subject, chapter, lessonName, pageRange, studentId) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/assessment/questions/enhanced`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          class_level: classLevel,
          subject: subject,
          chapter: chapter,
          lesson_name: lessonName,
          page_range: pageRange,
          student_id: studentId,
          force_regenerate: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Enhanced Questions API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Enhanced Questions API Error:", error);
      throw error;
    }
  },

  async getQuestions(classLevel, subject, chapter, numQuestions = 3) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/assessment/questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          class_level: classLevel,
          subject: subject,
          chapter: chapter,
          num_questions: numQuestions,
        }),
      });

      if (!response.ok) {
        throw new Error(`Assessment API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Assessment Questions API Error:", error);
      throw error;
    }
  },

  async evaluateAnswers(classLevel, subject, chapter, answers) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/assessment/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          class_level: classLevel,
          subject: subject,
          chapter: chapter,
          answers: answers,
        }),
      });

      if (!response.ok) {
        throw new Error(`Evaluation API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Assessment Evaluation API Error:", error);
      throw error;
    }
  },
};

export const userStatsService = {
  
  async getDashboardData(studentId, subject = null) {
    try {
      let url = `${API_BASE_URL}/api/user/dashboard/${studentId}`;
      if (subject) {
        url += `?subject=${encodeURIComponent(subject)}`;
      }

      const response = await authFetch(url);

      if (!response.ok) {
        throw new Error(`Dashboard API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Dashboard API Error:", error);
      throw error;
    }
  },

  async getStreakData(studentId) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/user/streak/${studentId}`);

      if (!response.ok) {
        throw new Error(`Streak API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Streak API Error:", error);
      throw error;
    }
  },

  async getProgressData(studentId, subject = null) {
    try {
      let url = `${API_BASE_URL}/api/user/progress/${studentId}`;
      if (subject) {
        url += `?subject=${encodeURIComponent(subject)}`;
      }

      const response = await authFetch(url);

      if (!response.ok) {
        throw new Error(`Progress API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Progress API Error:", error);
      throw error;
    }
  },

  async logActivity(studentId, hours = 0.5) {
    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/user/activity/log?student_id=${studentId}&hours=${hours}`,
        { method: "POST" }
      );

      if (!response.ok) {
        throw new Error(`Activity Log API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Activity Log API Error:", error);
      
    }
  },
};

export const notesService = {
  
  async getNotes(studentId, filters = {}) {
    try {
      let url = `${API_BASE_URL}/api/notes/${studentId}`;
      const params = new URLSearchParams();

      if (filters.class_level) params.append("class_level", filters.class_level);
      if (filters.subject) params.append("subject", filters.subject);
      if (filters.chapter) params.append("chapter", filters.chapter);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await authFetch(url);

      if (!response.ok) {
        throw new Error(`Notes API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Notes API Error:", error);
      throw error;
    }
  },

  async createNote(noteData) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/notes/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(noteData),
      });

      if (!response.ok) {
        throw new Error(`Create Note API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Create Note API Error:", error);
      throw error;
    }
  },

  async updateNote(id, updates) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Update Note API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Update Note API Error:", error);
      throw error;
    }
  },

  async deleteNote(id) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/notes/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Delete Note API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Delete Note API Error:", error);
      throw error;
    }
  },
};

export const historyService = {
  
  async createEntry(data) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/history/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Create History Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Create History Error:", error);
      throw error;
    }
  },

  async getHistory(studentId, filters = {}) {
    try {
      let url = `${API_BASE_URL}/api/history/${studentId}`;
      const params = new URLSearchParams();

      if (filters.class_level) params.append("class_level", filters.class_level);
      if (filters.subject) params.append("subject", filters.subject);
      if (filters.chapter) params.append("chapter", filters.chapter);
      if (filters.limit) params.append("limit", filters.limit);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await authFetch(url);

      if (!response.ok) {
        throw new Error(`Get History Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Get History Error:", error);
      throw error;
    }
  },

  async deleteEntry(id) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/history/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Delete History Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Delete History Error:", error);
      throw error;
    }
  },
};

export const testService = {
  
  async getQBSubjects(classLevel) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/test/qb-test/subjects/${classLevel}`);
      if (!response.ok) throw new Error(`QB Subjects API Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Get QB Subjects Error:", error);
      return [];
    }
  },

  async getQBChapters(classLevel, subject) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/test/qb-test/chapters/${classLevel}/${encodeURIComponent(subject)}`);
      if (!response.ok) throw new Error(`QB Chapters API Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Get QB Chapters Error:", error);
      return [];
    }
  },

  async startQBTest(params) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/test/qb-test/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: params.studentId || params.student_id,
          class_level: params.classLevel || params.class_level,
          subject: params.subject,
          chapter: params.chapter || params.chapter_number,
          difficulty: params.difficulty,
          mcq_count: params.mcq_count || 0,
          fillup_count: params.fillup_count || 0,
          true_false_count: params.true_false_count || 0,
          short_answer_count: params.short_answer_count || 0,
          long_answer_count: params.long_answer_count || 0,
          time_limit_minutes: params.time_limit_minutes || null
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Start QB Test Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Start QB Test API Error:", error);
      throw error;
    }
  },

  async getAvailableSubjects(classLevel) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/test/subjects/${classLevel}`);
      if (!response.ok) throw new Error(`Subjects API Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Get Subjects Error:", error);
      return [];
    }
  },

  async getChaptersForSubject(classLevel, subject, studentId = null) {
    try {
      const params = studentId ? `?student_id=${studentId}` : '';
      const response = await authFetch(
        `${API_BASE_URL}/api/test/chapters/${classLevel}/${encodeURIComponent(subject)}${params}`
      );
      if (!response.ok) throw new Error(`Chapters API Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Get Chapters Error:", error);
      return [];
    }
  },

  async getTopicsForChapter(classLevel, subject, chapterNumber, studentId = null) {
    try {
      const params = studentId ? `?student_id=${studentId}` : '';
      const response = await authFetch(
        `${API_BASE_URL}/api/test/topics/${classLevel}/${encodeURIComponent(subject)}/${chapterNumber}${params}`
      );
      if (!response.ok) throw new Error(`Topics API Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Get Topics Error:", error);
      return [];
    }
  },

  async getRecommendations(classLevel, subject, studentId, limit = 5) {
    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/test/recommendations/${classLevel}/${encodeURIComponent(subject)}/${studentId}?limit=${limit}`
      );
      if (!response.ok) throw new Error(`Recommendations API Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Get Recommendations Error:", error);
      return [];
    }
  },

  async startTopicTest(params) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/test/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: params.studentId,
          class_level: params.classLevel || 10,
          subject: params.subject,
          chapter_number: params.chapter_number,
          topic_id: params.topic_id,
          num_questions: params.num_questions || 5,
          difficulty: params.difficulty || "mixed"
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Start Test Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Start Topic Test Error:", error);
      throw error;
    }
  },

  async startChapterTest(params) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/test/start-chapter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: params.studentId,
          class_level: params.classLevel || 11,
          subject: params.subject,
          chapter_number: params.chapterNumber,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Start Chapter Test Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Start Chapter Test Error:", error);
      throw error;
    }
  },

  async submitAnswer(sessionId, questionId, questionNumber, answer) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/test/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question_id: questionId,
          question_number: questionNumber,
          answer: answer,
        }),
      });

      if (!response.ok) throw new Error(`Submit Answer Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Submit Answer Error:", error);
      throw error;
    }
  },

  async completeTest(sessionId, studentId, answers = [], completionData = {}) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/test/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          student_id: studentId,
          answers: answers,
          ...completionData
        }),
      });

      if (!response.ok) throw new Error(`Complete Test Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Complete Test Error:", error);
      throw error;
    }
  },

  async getTestHistory(studentId, limit = 20) {
    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/test/history/${studentId}?limit=${limit}`
      );
      if (!response.ok) throw new Error(`Get Test History Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Get Test History Error:", error);
      throw error;
    }
  },

  async getTestResult(sessionId) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/test/result/${sessionId}`);
      if (!response.ok) throw new Error(`Get Test Result Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Get Test Result Error:", error);
      throw error;
    }
  },

  async deleteTestHistory(sessionId) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/test/history/${sessionId}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error(`Delete Test History Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Delete Test History Error:", error);
      throw error;
    }
  },

  async deleteAllTestHistory(studentId) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/test/history/all/${studentId}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error(`Delete All Test History Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Delete All Test History Error:", error);
      throw error;
    }
  },

  async startTestV2(params) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/test/start-v3`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: params.studentId,
          class_level: params.classLevel || 10,
          subject: params.subject,
          chapter_number: params.chapter_number,
          topic_id: params.topic_id || "all",
          num_questions: params.num_questions || 15,
          total_marks: params.total_marks || 25,
          difficulty: params.difficulty || "mixed",
          auto_generate: params.auto_generate || true
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Start Test V2 Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Start Test V2 Error:", error);
      throw error;
    }
  },

  async startAITest(params) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/test/ai-test/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: params.studentId,
          class_level: params.classLevel || 10,
          subject: params.subject,
          chapter_number: params.chapter_number,
          difficulty: params.difficulty || "medium",
          num_questions: params.num_questions || 15
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Start AI Test Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Start AI Test Error:", error);
      throw error;
    }
  },

  async checkQuestionsAvailable(classLevel, subject, chapterNumber) {
    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/test/check-questions/${classLevel}/${encodeURIComponent(subject)}/${chapterNumber}`
      );
      if (!response.ok) throw new Error(`Check Questions Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Check Questions Error:", error);
      return { available: false, count: 0 };
    }
  },

  async getStudentAnalytics(studentId, classLevel = 10, subject = null) {
    try {
      const params = new URLSearchParams();
      params.append("class_level", classLevel);
      if (subject) params.append("subject", subject);

      const response = await authFetch(
        `${API_BASE_URL}/api/test/analytics/${studentId}?${params.toString()}`
      );
      if (!response.ok) throw new Error(`Analytics API Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Get Analytics Error:", error);
      return null;
    }
  },

  async getAITests(subject = null, chapter = null, studentId = null) {
    try {
      const params = new URLSearchParams();
      if (subject) params.append("subject", subject);
      if (chapter) params.append("chapter", chapter);
      if (studentId) params.append("student_id", studentId);

      const url = `${API_BASE_URL}/api/test/ai-tests${params.toString() ? '?' + params.toString() : ''}`;
      const response = await authFetch(url);

      if (!response.ok) {
        throw new Error(`AI Tests API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("AI Tests API Error:", error);
      return [];
    }
  },

  async startAITestLegacy(testId, studentId) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/test/ai-test/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test_id: testId, student_id: studentId }),
      });

      if (!response.ok) {
        throw new Error(`Start AI Test API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Start AI Test API Error:", error);
      throw error;
    }
  },

  async submitAIAnswer(sessionId, questionNumber, answer) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/test/ai-tests/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question_number: questionNumber,
          answer: answer,
        }),
      });

      if (!response.ok) {
        throw new Error(`Submit Answer API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Submit Answer API Error:", error);
      throw error;
    }
  },

  async completeAITest(sessionId, studentId) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/test/ai-tests/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          student_id: studentId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Complete AI Test API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Complete AI Test API Error:", error);
      throw error;
    }
  },

  async getStaffTests(subject = null, chapter = null, studentId = null) {
    try {
      if (!studentId) {
        console.error("Student ID is required");
        return [];
      }

      const url = `${API_BASE_URL}/api/assessments`;
      const response = await authFetch(url);

      if (!response.ok) {
        throw new Error(`Staff Tests API Error: ${response.statusText}`);
      }

      const data = await response.json();

      if (data && Array.isArray(data.assessments)) {
        return data.assessments.map(test => ({
          id: test.id,
          title: test.title,
          description: test.description,
          subject: test.subject,
          class_level: test.class_level,
          type: test.type || "mcq",
          questions_count: test.question_count || 0,
          total_points: test.total_points || 0,
          duration_minutes: test.duration_minutes || 30,
          start_date: test.start_datetime,
          due_date: test.end_datetime,
          created_at: test.created_at,
          created_by: test.instructor_id,
          status: test.status || "published",
          has_attempted: test.has_attempted || false,
          best_score: test.best_score || null,
          attempts_remaining: test.attempts_remaining,
          submission_count: test.submission_count || 0
        }));
      }

      return [];
    } catch (error) {
      console.error("Staff Tests API Error:", error);
      return [];
    }
  },

  async uploadAnswerSheet(testId, studentId, pdfFile) {
    try {
      console.log("📤 Upload Answer Sheet:", { testId, studentId, fileName: pdfFile?.name });

      const formData = new FormData();
      formData.append("test_id", testId);
      formData.append("student_id", studentId);
      formData.append("pdf_file", pdfFile);

      const response = await authFetch(`${API_BASE_URL}/api/tests/submit`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("🚨 Upload Error Full Response:", JSON.stringify(errorData, null, 2));
        throw new Error(errorData.detail || JSON.stringify(errorData) || `Upload failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Upload Answer Sheet Error:", error);
      throw error;
    }
  },

  getQuestionPaperUrl(filename) {
    return `${API_BASE_URL}/api/tests/pdf/${filename}`;
  },

  async uploadAnswerSheet(testId, studentId, file) {
    try {
      const formData = new FormData();
      formData.append("submission_file", file);
      formData.append("test_id", testId);
      formData.append("student_id", studentId);

      const response = await authFetch(`${API_BASE_URL}/api/tests/submit`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload Answer API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Upload Answer API Error:", error);
      throw error;
    }
  },

  async getTestAnalytics(studentId, classLevel = 10, subject = null) {
    try {
      const params = new URLSearchParams();
      params.append("class_level", classLevel);
      if (subject) params.append("subject", subject);

      const response = await authFetch(`${API_BASE_URL}/api/test/analytics/${studentId}?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Test Analytics API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Test Analytics API Error:", error);
      return null;
    }
  },

  async getQuestionBankStats() {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/test/question-bank/stats`);

      if (!response.ok) {
        throw new Error(`Question Bank Stats API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Question Bank Stats API Error:", error);
      return null;
    }
  },

  async getStudentAnalytics(studentId, classLevel = 10, subject = null) {
    return this.getTestAnalytics(studentId, classLevel, subject);
  },
};

export const healthCheck = async () => {
  try {
    const response = await authFetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch (error) {
    console.error("Backend health check failed:", error);
    return false;
  }
};

export const topQuestionsService = {
  
  async getAvailableSubjects(classLevel) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/top-questions/subjects/${classLevel}`);

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Get Available Subjects Error:", error);
      
      return {
        success: false,
        subjects: [],
        count: 0
      };
    }
  },

  async getTopQuestions(subject, classLevel, mode = "quick", limit = 5) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/top-questions/top`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: subject,
          class_level: classLevel,
          mode: mode,
          limit: limit
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Get Top Questions Error:", error);
      return {
        success: false,
        questions: [],
        count: 0
      };
    }
  },

  async trackQuestion(data) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/top-questions/track`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Track Question Error:", error);
      return { success: false };
    }
  },

  async getRecommendations(userId, subject, classLevel, mode = "quick", limit = 5) {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/top-questions/recommendations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          subject: subject,
          class_level: classLevel,
          mode: mode,
          limit: limit
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Get Recommendations Error:", error);
      return { success: false, recommendations: [] };
    }
  }
};

export default {
  chatService,
  assessmentService,
  userStatsService,
  notesService,
  testService,
  topQuestionsService,
  healthCheck,
};
