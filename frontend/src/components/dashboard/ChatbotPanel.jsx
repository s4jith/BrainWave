import { useState, useRef, useEffect } from "react";
import {
  X, Send, Plus, Clock, Search, Share2, LayoutGrid, ArrowUp,
  ChevronLeft, Settings, Sparkles, Zap, Brain,
  FileText, TrendingUp, HelpCircle
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import useUserStore from "../../stores/userStore";
import { chatService, userStatsService, topQuestionsService } from "../../services/api";
import { exportChatAsDoc } from "../../utils/chatExport";
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export default function ChatbotPanel({ isOpen, onClose }) {
  const { user } = useUserStore();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatMode, setChatMode] = useState("quick");
  const messagesEndRef = useRef(null);
  const [streamingMessageId, setStreamingMessageId] = useState(null);
  const abortStreamRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    return () => {
      if (abortStreamRef.current) {
        abortStreamRef.current();
      }
    };
  }, []);

  const [subjects, setSubjects] = useState([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [activeSubject, setActiveSubject] = useState("");

  const [topQuestions, setTopQuestions] = useState([]);
  const [topQuestionsLoading, setTopQuestionsLoading] = useState(false);

  useEffect(() => {
    const fetchSubjects = async () => {
      if (!isOpen) return;

      setSubjectsLoading(true);
      try {
        const response = await topQuestionsService.getAvailableSubjects(user.classLevel || 7);
        console.log("Subjects API response for class", user.classLevel, ":", response);

        if (response.success && response.subjects && response.subjects.length > 0) {
          setSubjects(response.subjects);
          
          const preferredSubject = response.subjects.find(
            s => s.value.toLowerCase() === (user.preferredSubject || "").toLowerCase()
          );
          setActiveSubject(preferredSubject ? preferredSubject.value : response.subjects[0].value);
        } else {
          
          console.log("No subjects found for class", user.classLevel);
          setSubjects([]);
          setActiveSubject("");
        }
      } catch (error) {
        console.error("Failed to fetch subjects:", error);
        
        setSubjects([]);
        setActiveSubject("");
      } finally {
        setSubjectsLoading(false);
      }
    };

    fetchSubjects();
  }, [isOpen, user.classLevel]);

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
    if (!message.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentMessage = message;

    setMessage("");
    setIsLoading(true);
    
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      const messageId = Date.now();
      setStreamingMessageId(messageId);

      setMessages(prev => [...prev, {
        id: messageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        mode: chatMode,
        isStreaming: true
      }]);
      setIsLoading(false);

      let fullAnswer = "";

      if (abortStreamRef.current) {
        abortStreamRef.current();
      }

      const abort = chatService.studentChatStream(
        currentMessage,
        user.classLevel || 6,
        activeSubject,
        1,
        chatMode,

        (text) => {
          fullAnswer += text;
          setMessages(prev => prev.map(msg =>
            msg.id === messageId
              ? { ...msg, content: fullAnswer }
              : msg
          ));
        },

        (data) => {
          setStreamingMessageId(null);
          abortStreamRef.current = null;
          setMessages(prev => prev.map(msg =>
            msg.id === messageId
              ? { ...msg, isStreaming: false }
              : msg
          ));

          topQuestionsService.trackQuestion({
            question: currentMessage,
            answer: fullAnswer,
            subject: activeSubject,
            class_level: user.classLevel || 7,
            mode: chatMode === "deepdive" ? "deep" : "quick",
            user_id: user.id || "guest",
            session_id: `${user.id || "guest"}_${Date.now()}`
          }).then(() => {

            const mode = chatMode === "deepdive" ? "deep" : "quick";
            return topQuestionsService.getTopQuestions(activeSubject, user.classLevel || 7, mode, 5);
          }).then(response => {
            if (response?.success && response.questions) {
              const formattedQuestions = response.questions.map((q, index) => ({
                id: index + 1,
                text: q.question,
                category: q.subject ? q.subject.charAt(0).toUpperCase() + q.subject.slice(1) : activeSubject,
                askCount: q.ask_count || 0,
                chapter: q.chapter
              }));
              setTopQuestions(formattedQuestions);
            }
          }).catch(err => console.log("Question tracking/refresh failed:", err));
        },

        (error) => {
          console.error("Stream error:", error);
          setStreamingMessageId(null);
          abortStreamRef.current = null;
          setMessages(prev => prev.map(msg =>
            msg.id === messageId
              ? { ...msg, content: fullAnswer || "Sorry, I couldn't process that.", isStreaming: false, isError: !fullAnswer }
              : msg
          ));
        }
      );

      abortStreamRef.current = abort;

      userStatsService.logActivity(user.id || "guest", 0.1);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, {
        role: "assistant", content: "Sorry, I couldn't process that.", timestamp: new Date(), isError: true
      }]);
      setIsLoading(false);
    }
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

        {}
        <div className="w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
          {}
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
            <img src={getAvatarUrl()} alt="" className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{user.name || 'Student'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Class {user.classLevel}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <ChevronLeft className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Subject</p>
            {subjectsLoading ? (
              <div className="w-full p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 animate-pulse">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              </div>
            ) : (
              <select
                value={activeSubject}
                onChange={(e) => setActiveSubject(e.target.value)}
                className="w-full p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-600"
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
          <div className="p-3 border-b border-gray-100 dark:border-gray-800">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-1">Mode</p>
            <div className="flex gap-2">
              <button onClick={() => handleModeChange("quick")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${chatMode === "quick" ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}>
                <Zap className="w-3.5 h-3.5" /> Quick
              </button>
              <button onClick={() => handleModeChange("deepdive")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${chatMode === "deepdive" ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}>
                <Brain className="w-3.5 h-3.5" /> Deep
              </button>
            </div>
          </div>

          {/* Top Questions */}
          <div className="flex-1 overflow-y-auto p-3">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 px-1">
              Top Questions {activeSubject && `- ${activeSubject.charAt(0).toUpperCase() + activeSubject.slice(1)}`}
            </p>
            <div className="space-y-2">
              {topQuestionsLoading ? (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="w-full p-3 rounded-lg bg-gray-50 dark:bg-gray-800 animate-pulse">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                  </div>
                ))
              ) : topQuestions.length > 0 ? (
                topQuestions.map(q => (
                  <button key={q.id} onClick={() => setMessage(q.text)}
                    className="w-full text-left p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <p className="text-sm text-gray-800 dark:text-gray-200 font-medium line-clamp-2">{q.text}</p>
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
                  <p className="text-xs text-gray-300 dark:text-gray-500">Be the first to ask about {activeSubject || 'this subject'}!</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-[#fafafa] dark:bg-gray-950 relative overflow-hidden">

          {/* Animated Grid Background */}
          <div className="absolute inset-0 opacity-[0.15] dark:opacity-[0.08]" style={{
            backgroundImage: 'linear-gradient(to right, #6b7280 1px, transparent 1px), linear-gradient(to bottom, #6b7280 1px, transparent 1px)',
            backgroundSize: '50px 50px',
            animation: 'gridScroll 8s linear infinite'
          }} />
          <div className="absolute right-0 top-0 w-1/3 h-1/3 rounded-full blur-[100px] bg-orange-200/40 dark:bg-orange-500/10" />
          <div className="absolute left-0 bottom-0 w-1/4 h-1/4 rounded-full blur-[80px] bg-orange-300/30 dark:bg-orange-500/10" />

          {/* Header */}
          <div className="relative z-10 h-14 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setMessages([])} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                <Plus className="w-4 h-4 text-gray-600 dark:text-gray-400" /><span className="text-sm font-medium text-gray-700 dark:text-gray-300">New Chat</span>
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
                className={`flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg ${messages.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={messages.length === 0}
              >
                <Share2 className="w-4 h-4 text-gray-500 dark:text-gray-400" /><span className="text-sm text-gray-600 dark:text-gray-400">Share</span>
              </button>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg ml-2"><X className="w-5 h-5 text-gray-500 dark:text-gray-400" /></button>
            </div>
          </div>

          {/* Content Area - Scrollable */}
          <div className="relative z-10 flex-1 overflow-y-scroll">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center px-6 pb-32">
                <div className="w-14 h-14 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center mb-6 shadow-sm">
                  <Sparkles className="w-7 h-7 text-gray-700 dark:text-gray-300" />
                </div>
                <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
                  {getGreeting()}, <span className="text-gray-500 dark:text-gray-400">{user.name || 'Student'}</span>
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mb-12">Hey there! What can I do for your studies today?</p>
                <div className="grid grid-cols-3 gap-4 max-w-4xl w-full">
                  {starterCards.map(card => {
                    const Icon = card.icon;
                    return (
                      <div key={card.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-lg transition-all">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                          <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </div>
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{card.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">{card.description}</p>
                        <button onClick={() => setMessage(card.title)}
                          className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                          {card.action}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto p-6 pb-32 space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-gray-900 dark:bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-4 h-4 text-white dark:text-gray-900" />
                      </div>
                    )}
                    <div className={`max-w-[75%] px-4 py-3 rounded-2xl ${msg.role === 'user' ? 'bg-gray-900 dark:bg-gray-200 text-white dark:text-gray-900'
                      : msg.isError ? 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
                        : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700'
                      }`}>
                      <div className="text-sm leading-relaxed">
                        {msg.role === 'assistant' ? (
                          <div className="relative">
                            {renderMarkdown(msg.content)}
                            {msg.isStreaming && (
                              <span className="inline-block w-0.5 h-4 bg-gray-900 dark:bg-gray-200 ml-0.5 animate-pulse" />
                            )}
                          </div>
                        ) : msg.content}
                      </div>
                      <div className={`text-xs mt-2 ${msg.role === 'user' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    {msg.role === 'user' && (
                      <img src={getAvatarUrl()} alt="" className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-900 dark:bg-gray-200 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white dark:text-gray-900" />
                    </div>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
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
          <div className="absolute bottom-0 left-0 right-0 z-20 p-6 bg-gradient-to-t from-[#fafafa] dark:from-gray-950 via-[#fafafa] dark:via-gray-950 to-transparent pt-12">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-end gap-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-4 py-2 shadow-sm">
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={e => {
                    setMessage(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Write a message here..."
                  className="flex-1 bg-transparent border-none outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 text-sm resize-none overflow-y-auto"
                  style={{ minHeight: '36px', maxHeight: '120px' }}
                  rows={1}
                  disabled={isLoading}
                />
                <button onClick={handleSend} disabled={!message.trim() || isLoading}
                  className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-600 mb-0.5 flex-shrink-0">
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
