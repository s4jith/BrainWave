import { useState, useRef, useEffect } from "react";
import {
  X, Send, Plus, Clock, Search, Share2, LayoutGrid, ArrowUp,
  ChevronLeft, Settings, Sparkles, Zap, Brain,
  FileText, TrendingUp, HelpCircle, Camera, Image as ImageIcon, XCircle
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import useUserStore from "../../stores/userStore";
import { chatService, userStatsService, topQuestionsService } from "../../services/api";
import { exportChatAsDoc } from "../../utils/chatExport";
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

/**
 * ChatbotPanel - Clean UI matching reference design
 */

export default function ChatbotPanel({ isOpen, onClose }) {
  const { user } = useUserStore();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatMode, setChatMode] = useState("quick");
  const messagesEndRef = useRef(null);
  const imageInputRef = useRef(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // Dynamic subjects from database
  const [subjects, setSubjects] = useState([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [activeSubject, setActiveSubject] = useState("");

  /**
   * TOP QUESTIONS STATE
   * Now fetched dynamically from the database based on selected subject and mode
   */
  const [topQuestions, setTopQuestions] = useState([]);
  const [topQuestionsLoading, setTopQuestionsLoading] = useState(false);

  /**
   * FETCH AVAILABLE SUBJECTS FROM DATABASE
   * Only shows subjects that have data for the student's class level
   */
  useEffect(() => {
    const fetchSubjects = async () => {
      if (!isOpen) return;

      setSubjectsLoading(true);
      try {
        const response = await topQuestionsService.getAvailableSubjects(user.classLevel || 7);
        console.log("Subjects API response for class", user.classLevel, ":", response);

        if (response.success && response.subjects && response.subjects.length > 0) {
          setSubjects(response.subjects);
          // Auto-select first subject or user's preferred subject
          const preferredSubject = response.subjects.find(
            s => s.value.toLowerCase() === (user.preferredSubject || "").toLowerCase()
          );
          setActiveSubject(preferredSubject ? preferredSubject.value : response.subjects[0].value);
        } else {
          // No subjects available for this class - show empty state
          console.log("No subjects found for class", user.classLevel);
          setSubjects([]);
          setActiveSubject("");
        }
      } catch (error) {
        console.error("Failed to fetch subjects:", error);
        // On error, show empty state - don't use fallback
        setSubjects([]);
        setActiveSubject("");
      } finally {
        setSubjectsLoading(false);
      }
    };

    fetchSubjects();
  }, [isOpen, user.classLevel]);

  /**
   * FETCH TOP QUESTIONS FROM DATABASE
   * Updates when subject or mode changes
   */
  useEffect(() => {
    const fetchTopQuestions = async () => {
      if (!isOpen || !activeSubject) return;

      setTopQuestionsLoading(true);
      try {
        const mode = chatMode === "deepdive" ? "deep" : "quick";
        const response = await topQuestionsService.getTopQuestions(
          activeSubject,
          user.classLevel || 7,
          mode,
          5
        );

        if (response.success && response.questions) {
          // Transform API response to match UI format
          const formattedQuestions = response.questions.map((q, index) => ({
            id: index + 1,
            text: q.question,
            category: q.subject ? q.subject.charAt(0).toUpperCase() + q.subject.slice(1) : activeSubject,
            askCount: q.ask_count || 0,
            chapter: q.chapter
          }));
          setTopQuestions(formattedQuestions);
        } else {
          setTopQuestions([]);
        }
      } catch (error) {
        console.error("Failed to fetch top questions:", error);
        setTopQuestions([]);
      } finally {
        setTopQuestionsLoading(false);
      }
    };

    fetchTopQuestions();
  }, [isOpen, activeSubject, chatMode, user.classLevel]);

  const starterCards = [
    { id: 1, icon: FileText, title: "Explain a concept", description: "Get a clear explanation of any topic from your textbook", action: "Get Started" },
    { id: 2, icon: HelpCircle, title: "Practice questions", description: "Generate practice questions to test your understanding", action: "Start Practice" },
    { id: 3, icon: TrendingUp, title: "Exam preparation", description: "Get tips and important points for your upcoming exams", action: "Prepare Now" }
  ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good Morning";
    if (hour >= 12 && hour < 17) return "Good Afternoon";
    if (hour >= 17 && hour < 21) return "Good Evening";
    return "Good Night";
  };

  const getAvatarUrl = () => {
    if (user.avatarSeed && user.avatarStyle) {
      return `https://api.dicebear.com/7.x/${user.avatarStyle}/svg?seed=${user.avatarSeed}`;
    }
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id || 'default'}`;
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleModeChange = (mode) => {
    setChatMode(mode);
    setMessages(prev => [...prev, {
      role: "assistant",
      content: mode === "quick"
        ? "**Quick Mode activated!** I'll give you direct, exam-style answers."
        : "**DeepDive Mode activated!** I'll provide comprehensive explanations.",
      timestamp: new Date(),
    }]);
  };

  const handleSend = async () => {
    if ((!message.trim() && !selectedImage) || isLoading) return;

    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
      imagePreview: selectedImage ? URL.createObjectURL(selectedImage) : null
    };

    setMessages(prev => [...prev, userMessage]);
    const currentMessage = message;
    const currentImage = selectedImage;

    setMessage("");
    setSelectedImage(null);
    setIsLoading(true);

    try {
      let result;

      if (currentImage) {
        // Image chat (with optional text)
        result = await chatService.imageChat(
          currentImage,
          user.classLevel || 6,
          activeSubject,
          1,
          chatMode,
          currentMessage // Pass text as userQuery
        );
      } else {
        // Text-only chat
        result = await chatService.studentChat(
          currentMessage,
          user.classLevel || 6,
          activeSubject,
          1, chatMode
        );
      }

      setMessages(prev => [...prev, {
        role: "assistant",
        content: result.answer,
        timestamp: new Date(),
        mode: chatMode,
        imageAnalysis: result.imageAnalysis
      }]);
      userStatsService.logActivity(user.id || "guest", 0.1);

      // Track the question for top questions feature (non-blocking)
      if (currentMessage.trim() && !currentImage) {
        topQuestionsService.trackQuestion({
          question: currentMessage,
          answer: result.answer,
          subject: activeSubject,
          class_level: user.classLevel || 7,
          mode: chatMode === "deepdive" ? "deep" : "quick",
          user_id: user.id || "guest",
          session_id: `${user.id || "guest"}_${Date.now()}`
        }).catch(err => console.log("Question tracking failed:", err));
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, {
        role: "assistant", content: "Sorry, I couldn't process that.", timestamp: new Date(), isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle image upload
  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: (<span className="flex items-center gap-2"><XCircle className="w-4 h-4 inline text-red-500" /> Please upload a valid image (JPG, PNG, or WebP).</span>),
        timestamp: new Date(),
        isError: true
      }]);
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: (<span className="flex items-center gap-2"><XCircle className="w-4 h-4 inline text-red-500" /> Image is too large. Maximum size is 5MB.</span>),
        timestamp: new Date(),
        isError: true
      }]);
      return;
    }

    setSelectedImage(file);
    // Reset input so same file can be selected again if cleared
    event.target.value = '';
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
  };

  const renderMarkdown = (content) => (
    <div className="prose prose-sm max-w-none [&_strong]:font-bold [&_p]:my-2 [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/20" onClick={onClose}>
      <div className="absolute inset-0 flex" onClick={e => e.stopPropagation()}>

        {/* Left Sidebar */}
        <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
          {/* Profile */}
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <img src={getAvatarUrl()} alt="" className="w-10 h-10 rounded-full bg-gray-200" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{user.name || 'Student'}</p>
              <p className="text-xs text-gray-500">Class {user.classLevel}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Subject Selector */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2">Subject</p>
            {subjectsLoading ? (
              <div className="w-full p-2 rounded-lg bg-gray-50 border border-gray-200 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-3/4"></div>
              </div>
            ) : (
              <select
                value={activeSubject}
                onChange={(e) => setActiveSubject(e.target.value)}
                className="w-full p-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
                disabled={subjects.length === 0}
              >
                {subjects.length === 0 ? (
                  <option value="">No subjects available</option>
                ) : (
                  subjects.map(sub => (
                    <option key={sub.value} value={sub.value}>{sub.name}</option>
                  ))
                )}
              </select>
            )}
          </div>

          {/* Mode Toggle */}
          <div className="p-3 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2 px-1">Mode</p>
            <div className="flex gap-2">
              <button onClick={() => handleModeChange("quick")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${chatMode === "quick" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>
                <Zap className="w-3.5 h-3.5" /> Quick
              </button>
              <button onClick={() => handleModeChange("deepdive")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${chatMode === "deepdive" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>
                <Brain className="w-3.5 h-3.5" /> Deep
              </button>
            </div>
          </div>

          {/* Top Questions */}
          <div className="flex-1 overflow-y-auto p-3">
            <p className="text-xs font-medium text-gray-500 mb-3 px-1">
              Top Questions {activeSubject && `- ${activeSubject.charAt(0).toUpperCase() + activeSubject.slice(1)}`}
            </p>
            <div className="space-y-2">
              {topQuestionsLoading ? (
                // Loading skeleton
                [...Array(5)].map((_, i) => (
                  <div key={i} className="w-full p-3 rounded-lg bg-gray-50 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                  </div>
                ))
              ) : topQuestions.length > 0 ? (
                topQuestions.map(q => (
                  <button key={q.id} onClick={() => setMessage(q.text)}
                    className="w-full text-left p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <p className="text-sm text-gray-800 font-medium line-clamp-2">{q.text}</p>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-gray-400">{q.category}</p>
                      {q.askCount > 0 && (
                        <p className="text-xs text-gray-400">Asked {q.askCount}x</p>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-400 mb-2">No questions asked yet</p>
                  <p className="text-xs text-gray-300">Be the first to ask about {activeSubject || 'this subject'}!</p>
                </div>
              )}
            </div>
          </div>


        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-[#fafafa] relative overflow-hidden">

          {/* Animated Grid Background */}
          <div className="absolute inset-0 opacity-[0.15]" style={{
            backgroundImage: 'linear-gradient(to right, #6b7280 1px, transparent 1px), linear-gradient(to bottom, #6b7280 1px, transparent 1px)',
            backgroundSize: '50px 50px',
            animation: 'gridScroll 8s linear infinite'
          }} />
          <div className="absolute right-0 top-0 w-1/3 h-1/3 rounded-full blur-[100px] bg-orange-200/40" />
          <div className="absolute left-0 bottom-0 w-1/4 h-1/4 rounded-full blur-[80px] bg-orange-300/30" />

          {/* Header */}
          <div className="relative z-10 h-14 border-b border-gray-100 bg-white/80 backdrop-blur-sm flex items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setMessages([])} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
                <Plus className="w-4 h-4 text-gray-600" /><span className="text-sm font-medium text-gray-700">New Chat</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (messages.length > 0) {
                    exportChatAsDoc(messages, {
                      title: "Study Chat Conversation",
                      userName: "You asked",
                      aiName: "AI said",
                      filename: `chat-${new Date().toISOString().split('T')[0]}.doc`
                    });
                  }
                }}
                className={`flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 rounded-lg ${messages.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={messages.length === 0}
              >
                <Share2 className="w-4 h-4 text-gray-500" /><span className="text-sm text-gray-600">Share</span>
              </button>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg ml-2"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
          </div>

          {/* Content Area - Scrollable */}
          <div className="relative z-10 flex-1 overflow-y-scroll">
            {messages.length === 0 ? (
              /* Welcome State */
              <div className="h-full flex flex-col items-center justify-center px-6 pb-32">
                <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mb-6 shadow-sm">
                  <Sparkles className="w-7 h-7 text-gray-700" />
                </div>
                <h1 className="text-3xl font-semibold text-gray-900 mb-2">
                  {getGreeting()}, <span className="text-gray-500">{user.name || 'Student'}</span>
                </h1>
                <p className="text-gray-500 mb-12">Hey there! What can I do for your studies today?</p>
                <div className="grid grid-cols-3 gap-4 max-w-4xl w-full">
                  {starterCards.map(card => {
                    const Icon = card.icon;
                    return (
                      <div key={card.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-lg transition-all">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
                          <Icon className="w-5 h-5 text-gray-600" />
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-2">{card.title}</h3>
                        <p className="text-sm text-gray-500 mb-4 leading-relaxed">{card.description}</p>
                        <button onClick={() => setMessage(card.title)}
                          className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                          {card.action}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Messages */
              <div className="max-w-3xl mx-auto p-6 pb-32 space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div className={`max-w-[75%] px-4 py-3 rounded-2xl ${msg.role === 'user' ? 'bg-gray-900 text-white'
                      : msg.isError ? 'bg-red-50 text-red-800 border border-red-200'
                        : 'bg-white text-gray-800 border border-gray-200'
                      }`}>
                      <div className="text-sm leading-relaxed">
                        {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                      </div>
                      <div className={`text-xs mt-2 ${msg.role === 'user' ? 'text-gray-400' : 'text-gray-500'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    {msg.role === 'user' && (
                      <img src={getAvatarUrl()} alt="" className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input - Fixed at Bottom */}
          <div className="absolute bottom-0 left-0 right-0 z-20 p-6 bg-gradient-to-t from-[#fafafa] via-[#fafafa] to-transparent pt-12">
            <div className="max-w-3xl mx-auto">
              {/* Image Preview */}
              {selectedImage && (
                <div className="mb-2 flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-200 w-fit shadow-sm">
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={URL.createObjectURL(selectedImage)}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-gray-700 truncate max-w-[150px]">
                      {selectedImage.name}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {(selectedImage.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <button
                    onClick={removeSelectedImage}
                    className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-3 bg-white rounded-full border border-gray-200 px-4 py-2 shadow-sm">
                <input
                  type="file"
                  ref={imageInputRef}
                  onChange={handleImageUpload}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isLoading || uploadingImage}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-400 disabled:opacity-50"
                  title="Upload image of textbook/question"
                >
                  <Camera className="w-5 h-5" />
                </button>
                <input
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder={selectedImage ? "Add a question about this image..." : "Write a message here..."}
                  className="flex-1 bg-transparent border-none outline-none text-gray-700 placeholder-gray-400 text-sm"
                  disabled={isLoading}
                />
                <button onClick={handleSend} disabled={(!message.trim() && !selectedImage) || isLoading}
                  className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 disabled:opacity-50 hover:bg-gray-200">
                  <ArrowUp className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <style>{`
            @keyframes gridScroll {
              0% { background-position: 0 0; }
              100% { background-position: 50px 50px; }
            }
          `}</style>
        </div>
      </div>
    </div>
  );
}
