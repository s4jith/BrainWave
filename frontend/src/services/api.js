/**
 * API Service - Backend Integration
 * 
 * This file contains all API calls to the FastAPI backend
 * Base URL: http://localhost:8000
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * Chat Service - AI Explanations with RAG
 * Integrates with the backend RAG system for annotations and assessment
 */
export const chatService = {
  /**
   * Process annotation with AI (Define, Elaborate, Stick Flow)
   * UNIFIED ENDPOINT - Main function for text annotations
   * Supports both text and image-based (screenshot) annotations
   * @param {string} text - The selected text to process
   * @param {string} action - Action type: "define", "elaborate", "stick_flow", "summarize_page", or "summarize_chapter"
   * @param {number} classLevel - User's class level (5-10)
   * @param {string} subject - Subject name
   * @param {number} chapter - Chapter number
   * @param {string} imageData - Optional base64 image data for screenshot doubts
   * @param {number} pageNumber - Optional page number for page-specific actions
   * @returns {Promise<{answer: string, action_type: string, source_count: number}>}
   */
  async processAnnotation(text, action, classLevel, subject, chapter, imageData = null, pageNumber = null) {
    try {
      const requestBody = {
        selected_text: text,
        action: action,
        class_level: classLevel,
        subject: subject,
        chapter: chapter,
      };

      // Add image data if provided (for screenshot-based doubts)
      if (imageData) {
        requestBody.image_data = imageData;
      }

      // Add page number if provided (for page-specific actions like summarize_page)
      if (pageNumber) {
        requestBody.page_number = pageNumber;
      }

      const response = await fetch(`${API_BASE_URL}/api/annotation/`, {
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

  /**
   * @deprecated Use processAnnotation() instead
   * Get AI explanation for selected text
   */
  async getExplanation(text, mode, classLevel, subject, chapter) {
    return this.processAnnotation(text, mode, classLevel, subject, chapter);
  },

  /**
   * @deprecated Use processAnnotation() with action="stick_flow" instead
   * Get Stick Flow visual diagram
   */
  async getStickFlow(text, classLevel, subject, chapter) {
    return this.processAnnotation(text, "stick_flow", classLevel, subject, chapter);
  },

  /**
   * Student chatbot - Open-ended questions with RAG
   * @param {string} question - Student's question
   * @param {number} classLevel - User's class level (5-10)
   * @param {string} subject - Subject name
   * @param {number} chapter - Chapter number
   * @param {string} mode - Chat mode: "quick" (exam-style) or "deepdive" (comprehensive)
   * @returns {Promise<{answer: string, sources: array}>}
   */
  async studentChat(question, classLevel, subject, chapter, mode = "quick") {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/student`, {
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

  /**
   * Student chatbot with STREAMING - Reduced perceived latency
   * Streams the response token-by-token using Server-Sent Events (SSE)
   * 
   * @param {string} question - Student's question
   * @param {number} classLevel - User's class level (5-12)
   * @param {string} subject - Subject name
   * @param {number} chapter - Chapter number
   * @param {string} mode - Chat mode: "quick" or "deepdive"
   * @param {function} onChunk - Callback for each text chunk: (text) => void
   * @param {function} onComplete - Callback when complete: ({sources, cached}) => void
   * @param {function} onError - Callback on error: (error) => void
   * @returns {function} Abort function to cancel the stream
   */
  studentChatStream(question, classLevel, subject, chapter, mode = "quick", onChunk, onComplete, onError) {
    const controller = new AbortController();

    const fetchStream = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/chat/student/stream`, {
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

          // Process complete SSE messages
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || ""; // Keep incomplete message in buffer

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

    // Return abort function
    return () => controller.abort();
  },

  /**
   * Image-based chat - Upload photo of textbook/diagram/handwritten question
   * Uses Intel OpenVINO OCR to extract text and generate RAG answer
   * @param {File} imageFile - Image file (jpg/png, max 5MB)
   * @param {number} classLevel - User's class level (5-12)
   * @param {string} subject - Subject name
   * @param {number} chapter - Chapter number
   * @param {string} mode - Chat mode: "quick" or "deepdive"
   * @returns {Promise<{answer: string, sources: array, imageAnalysis: object}>}
   */
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

      const response = await fetch(`${API_BASE_URL}/api/chat/image`, {
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

/**
 * Assessment Service - Voice Assessment Integration
 */
export const assessmentService = {
  /**
   * Get enhanced assessment questions (15 questions for 10-page interval)
   */
  async getEnhancedQuestions(classLevel, subject, chapter, lessonName, pageRange, studentId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/assessment/questions/enhanced`, {
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

  /**
   * Get assessment questions from textbook content (RAG-based)
   */
  async getQuestions(classLevel, subject, chapter, numQuestions = 3) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/assessment/questions`, {
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

  /**
   * Evaluate voice assessment answers
   */
  async evaluateAnswers(classLevel, subject, chapter, answers) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/assessment/evaluate`, {
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

/**
 * User Stats Service - Dashboard data (progress, streaks, notes)
 */
export const userStatsService = {
  /**
   * Get all dashboard data in one call
   * @param {string} studentId - Student identifier
   * @param {string} subject - Optional subject filter
   * @returns {Promise<{streak, progress, recent_notes, total_notes}>}
   */
  async getDashboardData(studentId, subject = null) {
    try {
      let url = `${API_BASE_URL}/api/user/dashboard/${studentId}`;
      if (subject) {
        url += `?subject=${encodeURIComponent(subject)}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Dashboard API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Dashboard API Error:", error);
      throw error;
    }
  },

  /**
   * Get streak data only
   * @param {string} studentId - Student identifier
   * @returns {Promise<{current_streak, longest_streak, weekly_activity}>}
   */
  async getStreakData(studentId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/streak/${studentId}`);

      if (!response.ok) {
        throw new Error(`Streak API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Streak API Error:", error);
      throw error;
    }
  },

  /**
   * Get progress data only
   * @param {string} studentId - Student identifier
   * @param {string} subject - Optional subject filter
   * @returns {Promise<{overall_progress, total_tests, completed_tests, average_score}>}
   */
  async getProgressData(studentId, subject = null) {
    try {
      let url = `${API_BASE_URL}/api/user/progress/${studentId}`;
      if (subject) {
        url += `?subject=${encodeURIComponent(subject)}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Progress API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Progress API Error:", error);
      throw error;
    }
  },

  /**
   * Log user activity for streak tracking
   * @param {string} studentId - Student identifier
   * @param {number} hours - Hours of activity (default 0.5)
   */
  async logActivity(studentId, hours = 0.5) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/user/activity/log?student_id=${studentId}&hours=${hours}`,
        { method: "POST" }
      );

      if (!response.ok) {
        throw new Error(`Activity Log API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Activity Log API Error:", error);
      // Don't throw - activity logging shouldn't break the app
    }
  },
};

/**
 * Notes Service - User saved notes
 */
export const notesService = {
  /**
   * Get notes for a student
   * @param {string} studentId - Student identifier
   * @param {object} filters - Optional filters (class_level, subject, chapter)
   * @returns {Promise<{notes: array, total: number}>}
   */
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

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Notes API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Notes API Error:", error);
      throw error;
    }
  },

  /**
   * Create a new note
   * @param {object} noteData - Note data
   * @returns {Promise<Note>}
   */
  async createNote(noteData) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/notes/`, {
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

  /**
   * Update a note
   * @param {string} id
   * @param {object} updates
   * @returns {Promise<Note>}
   */
  async updateNote(id, updates) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/notes/${id}`, {
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

  /**
   * Delete a note
   * @param {string} id
   */
  async deleteNote(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/notes/${id}`, {
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

/**
 * AI Annotation History Service
 */
export const historyService = {
  /**
   * Save an AI annotation to history
   * @param {object} data - Annotation data
   * @returns {Promise<AnnotationHistoryItem>}
   */
  async createEntry(data) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/history/`, {
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

  /**
   * Get annotation history for a student
   * @param {string} studentId
   * @param {object} filters
   * @returns {Promise<{history: array, total: number}>}
   */
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

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Get History Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Get History Error:", error);
      throw error;
    }
  },

  /**
   * Delete a history entry
   * @param {string} id
   */
  async deleteEntry(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/history/${id}`, {
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

/**
 * Test Service - AI and Staff Tests
 */
export const testService = {
  // ==================== TOPIC-BASED TEST SELECTION ====================

  /**
   * Get available subjects for a class level
   * @param {number} classLevel - Class level (5-12)
   * @returns {Promise<array>} - List of subjects with chapter/question counts
   */
  async getAvailableSubjects(classLevel) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/test/subjects/${classLevel}`);
      if (!response.ok) throw new Error(`Subjects API Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Get Subjects Error:", error);
      return [];
    }
  },

  /**
   * Get chapters for a subject
   * @param {number} classLevel - Class level
   * @param {string} subject - Subject name
   * @returns {Promise<array>} - List of chapters with topic/question counts
   */
  async getChaptersForSubject(classLevel, subject, studentId = null) {
    try {
      const params = studentId ? `?student_id=${studentId}` : '';
      const response = await fetch(
        `${API_BASE_URL}/api/test/chapters/${classLevel}/${encodeURIComponent(subject)}${params}`
      );
      if (!response.ok) throw new Error(`Chapters API Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Get Chapters Error:", error);
      return [];
    }
  },

  /**
   * Get topics for a chapter with student performance
   * @param {number} classLevel - Class level
   * @param {string} subject - Subject name
   * @param {number} chapterNumber - Chapter number
   * @param {string} studentId - Student ID for performance data
   * @returns {Promise<array>} - Topics with student scores and recommendations
   */
  async getTopicsForChapter(classLevel, subject, chapterNumber, studentId = null) {
    try {
      const params = studentId ? `?student_id=${studentId}` : '';
      const response = await fetch(
        `${API_BASE_URL}/api/test/topics/${classLevel}/${encodeURIComponent(subject)}/${chapterNumber}${params}`
      );
      if (!response.ok) throw new Error(`Topics API Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Get Topics Error:", error);
      return [];
    }
  },

  /**
   * Get personalized topic recommendations for student
   * @param {number} classLevel - Class level
   * @param {string} subject - Subject name
   * @param {string} studentId - Student ID
   * @param {number} limit - Max recommendations
   * @returns {Promise<array>} - Recommended topics based on weak areas
   */
  async getRecommendations(classLevel, subject, studentId, limit = 5) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/test/recommendations/${classLevel}/${encodeURIComponent(subject)}/${studentId}?limit=${limit}`
      );
      if (!response.ok) throw new Error(`Recommendations API Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Get Recommendations Error:", error);
      return [];
    }
  },

  // ==================== AI TEST SESSION ====================

  /**
   * Start a topic-based AI test
   * @param {object} params - Test parameters
   * @returns {Promise<{session_id, questions, time_limit}>}
   */
  async startTopicTest(params) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/test/start`, {
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

  /**
   * Start fixed-format chapter test (15 questions, 20 marks, 40 minutes)
   * @param {object} params - Test parameters
   * @param {string} params.studentId - Student ID
   * @param {number} params.classLevel - Class level (default 11)
   * @param {string} params.subject - Subject name
   * @param {number} params.chapterNumber - Chapter number
   * @returns {Promise<{session_id, questions, total_marks, time_limit_minutes}>}
   */
  async startChapterTest(params) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/test/start-chapter`, {
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


  /**
   * Submit a single answer during test
   * @param {string} sessionId - Session ID
   * @param {string} questionId - Question ID
   * @param {number} questionNumber - Question number
   * @param {string} answer - Student's answer
   * @returns {Promise<{status: string}>}
   */
  async submitAnswer(sessionId, questionId, questionNumber, answer) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/test/answer`, {
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

  /**
   * Complete test and get RAG-based evaluation
   * @param {string} sessionId - Session ID
   * @param {string} studentId - Student ID
   * @returns {Promise<{score, evaluations, feedback, strengths, improvements}>}
   */
  async completeTest(sessionId, studentId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/test/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          student_id: studentId,
        }),
      });

      if (!response.ok) throw new Error(`Complete Test Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Complete Test Error:", error);
      throw error;
    }
  },

  /**
   * Get test history for a student
   * @param {string} studentId - Student ID
   * @param {number} limit - Number of results to return
   * @returns {Promise<{history, total, analytics}>}
   */
  async getTestHistory(studentId, limit = 20) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/test/history/${studentId}?limit=${limit}`
      );
      if (!response.ok) throw new Error(`Get Test History Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Get Test History Error:", error);
      throw error;
    }
  },

  /**
   * Get full test result for a session (for viewing historical results)
   * @param {string} sessionId - Session ID
   * @returns {Promise<{score, evaluations, feedback, ...}>}
   */
  async getTestResult(sessionId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/test/result/${sessionId}`);
      if (!response.ok) throw new Error(`Get Test Result Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Get Test Result Error:", error);
      throw error;
    }
  },

  /**
   * Delete a single test history item
   * @param {string} sessionId - Session ID to delete
   * @returns {Promise<{status, session_id}>}
   */
  async deleteTestHistory(sessionId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/test/history/${sessionId}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error(`Delete Test History Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Delete Test History Error:", error);
      throw error;
    }
  },

  /**
   * Delete all test history for a student
   * @param {string} studentId - Student ID
   * @returns {Promise<{status, deleted_count}>}
   */
  async deleteAllTestHistory(studentId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/test/history/all/${studentId}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error(`Delete All Test History Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Delete All Test History Error:", error);
      throw error;
    }
  },

  /**
   * Start Test V2 - Supports on-demand generation
   * @param {object} params - Test parameters
   * @returns {Promise<{session_id, questions, time_limit}>}
   */
  async startTestV2(params) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/test/start-v3`, {
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

  /**
   * Start an AI test with topic-level analytics support
   * @param {object} params - Test parameters
   * @returns {Promise<{session_id, chapter_name, questions, topics_covered}>}
   */
  async startAITest(params) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/test/ai-test/start`, {
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

  /**
   * Check if questions are available for a chapter
   * @param {number} classLevel
   * @param {string} subject
   * @param {number} chapterNumber
   * @returns {Promise<{available, count, difficulty_distribution}>}
   */
  async checkQuestionsAvailable(classLevel, subject, chapterNumber) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/test/check-questions/${classLevel}/${encodeURIComponent(subject)}/${chapterNumber}`
      );
      if (!response.ok) throw new Error(`Check Questions Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Check Questions Error:", error);
      return { available: false, count: 0 };
    }
  },

  /**
   * Get student analytics
   * @param {string} studentId
   * @param {number} classLevel
   * @param {string} subject
   * @returns {Promise<object>}
   */
  async getStudentAnalytics(studentId, classLevel = 10, subject = null) {
    try {
      const params = new URLSearchParams();
      params.append("class_level", classLevel);
      if (subject) params.append("subject", subject);

      const response = await fetch(
        `${API_BASE_URL}/api/test/analytics/${studentId}?${params.toString()}`
      );
      if (!response.ok) throw new Error(`Analytics API Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Get Analytics Error:", error);
      return null;
    }
  },

  // ==================== LEGACY AI TEST ENDPOINTS (kept for compatibility) ====================

  /**
   * Get AI tests available
   * @param {string} subject - Optional subject filter
   * @param {number} chapter - Optional chapter filter
   * @param {string} studentId - Student ID for best scores
   * @returns {Promise<array>}
   */
  async getAITests(subject = null, chapter = null, studentId = null) {
    try {
      const params = new URLSearchParams();
      if (subject) params.append("subject", subject);
      if (chapter) params.append("chapter", chapter);
      if (studentId) params.append("student_id", studentId);

      const url = `${API_BASE_URL}/api/test/ai-tests${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`AI Tests API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("AI Tests API Error:", error);
      return [];
    }
  },

  /**
   * Start an AI test session (legacy) - used by AITestModal
   * @param {string} testId - Test ID
   * @param {string} studentId - Student ID
   * @returns {Promise<{session_id, questions, time_limit}>}
   */
  async startAITestLegacy(testId, studentId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/test/ai-test/start`, {
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

  /**
   * Submit a single answer during AI test (legacy)
   * @param {string} sessionId - Session ID
   * @param {number} questionNumber - Question number
   * @param {string} answer - Student's answer
   * @returns {Promise<{status: string}>}
   */
  async submitAIAnswer(sessionId, questionNumber, answer) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/test/ai-tests/answer`, {
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

  /**
   * Complete AI test and get results (legacy)
   * @param {string} sessionId - Session ID
   * @param {string} studentId - Student ID
   * @returns {Promise<{score, feedback, question_results, topics_to_review}>}
   */
  async completeAITest(sessionId, studentId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/test/ai-tests/complete`, {
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

  /**
   * Get staff-assigned tests for a student
   * Fetches from the assessments collection (tests created by admin/teacher via CreateTest)
   * @param {string} subject - Optional subject filter (not used currently)
   * @param {number} chapter - Optional chapter filter (not used currently)
   * @param {string} studentId - Student ID for getting assigned tests
   * @returns {Promise<array>}
   */
  async getStaffTests(subject = null, chapter = null, studentId = null) {
    try {
      if (!studentId) {
        console.error("Student ID is required");
        return [];
      }

      // Get auth token for the assessments endpoint
      const token = localStorage.getItem("token") 
        || JSON.parse(localStorage.getItem("user-storage") || '{}')?.state?.accessToken;
      if (!token) {
        console.error("No auth token found");
        return [];
      }

      const url = `${API_BASE_URL}/api/assessments`;
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Staff Tests API Error: ${response.statusText}`);
      }

      const data = await response.json();

      // Backend returns { assessments: [...], total: N }
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

  /**
   * Upload student's answer sheet for a staff test
   * @param {string} testId - Test ID
   * @param {string} studentId - Student ID
   * @param {File} pdfFile - Answer sheet PDF file
   * @returns {Promise<{success, message, submission}>}
   */
  async uploadAnswerSheet(testId, studentId, pdfFile) {
    try {
      console.log("📤 Upload Answer Sheet:", { testId, studentId, fileName: pdfFile?.name });

      const formData = new FormData();
      formData.append("test_id", testId);
      formData.append("student_id", studentId);
      formData.append("pdf_file", pdfFile);

      const response = await fetch(`${API_BASE_URL}/api/tests/submit`, {
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

  /**
   * Download question paper PDF
   * @param {string} filename - PDF filename
   * @returns {string} - Download URL
   */
  getQuestionPaperUrl(filename) {
    return `${API_BASE_URL}/api/tests/pdf/${filename}`;
  },

  /**
   * Upload answer sheet for a staff test
   * @param {string} testId - Test ID
   * @param {string} studentId - Student ID
   * @param {File} file - PDF file to upload
   * @returns {Promise<{success, submission_id, message}>}
   */
  async uploadAnswerSheet(testId, studentId, file) {
    try {
      const formData = new FormData();
      formData.append("submission_file", file);
      formData.append("test_id", testId);
      formData.append("student_id", studentId);

      const response = await fetch(`${API_BASE_URL}/api/tests/submit`, {
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

  /**
   * Get test analytics for a student
   * @param {string} studentId - Student ID
   * @param {number} classLevel - Class level
   * @param {string} subject - Optional subject filter
   * @returns {Promise<{total_tests_taken, average_score, topic_breakdown, performance_history}>}
   */
  async getTestAnalytics(studentId, classLevel = 10, subject = null) {
    try {
      const params = new URLSearchParams();
      params.append("class_level", classLevel);
      if (subject) params.append("subject", subject);

      const response = await fetch(`${API_BASE_URL}/api/test/analytics/${studentId}?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Test Analytics API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Test Analytics API Error:", error);
      return null;
    }
  },

  /**
   * Get question bank statistics
   * @returns {Promise<{total_subjects, total_chapters, total_questions, breakdown}>}
   */
  async getQuestionBankStats() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/test/question-bank/stats`);

      if (!response.ok) {
        throw new Error(`Question Bank Stats API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Question Bank Stats API Error:", error);
      return null;
    }
  },

  /**
   * Alias for getTestAnalytics (for backward compatibility)
   */
  async getStudentAnalytics(studentId, classLevel = 10, subject = null) {
    return this.getTestAnalytics(studentId, classLevel, subject);
  },
};

/**
 * Utility: Check backend health
 */
export const healthCheck = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch (error) {
    console.error("Backend health check failed:", error);
    return false;
  }
};

/**
 * Top Questions Service - Dynamic subjects and top questions from database
 */
export const topQuestionsService = {
  /**
   * Get available subjects for a class level
   * Only returns subjects that have data in the database
   * @param {number} classLevel - Class level (6-12)
   * @returns {Promise<{success: boolean, subjects: Array, count: number}>}
   */
  async getAvailableSubjects(classLevel) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/top-questions/subjects/${classLevel}`);

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Get Available Subjects Error:", error);
      // Return empty - no fallback to prevent showing incorrect subjects
      return {
        success: false,
        subjects: [],
        count: 0
      };
    }
  },

  /**
   * Get top questions for a subject
   * @param {string} subject - Subject name
   * @param {number} classLevel - Class level
   * @param {string} mode - "quick" or "deep"
   * @param {number} limit - Number of questions to return
   * @returns {Promise<{success: boolean, questions: Array, count: number}>}
   */
  async getTopQuestions(subject, classLevel, mode = "quick", limit = 5) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/top-questions/top`, {
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

  /**
   * Track a question-answer pair
   * @param {Object} data - Question data
   * @returns {Promise<{success: boolean, question_id: string}>}
   */
  async trackQuestion(data) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/top-questions/track`, {
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

  /**
   * Get personalized recommendations for a user
   * @param {string} userId - User ID
   * @param {string} subject - Subject name
   * @param {number} classLevel - Class level
   * @param {string} mode - "quick" or "deep"
   * @param {number} limit - Number of recommendations
   * @returns {Promise<{success: boolean, recommendations: Array}>}
   */
  async getRecommendations(userId, subject, classLevel, mode = "quick", limit = 5) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/top-questions/recommendations`, {
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
