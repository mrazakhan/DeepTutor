"use client";

import { useState, useEffect, useRef, useCallback, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  ArrowLeft,
  Bot,
  Loader2,
  Send,
  User,
  BookOpen,
} from "lucide-react";
import { apiUrl, wsUrl } from "@/lib/api";
import { processLatexContent } from "@/lib/latex";
import { useTranslation } from "react-i18next";

interface Message {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

interface TopicInfo {
  id: number;
  topic_number: string;
  title: string;
}

interface UnitInfo {
  id: number;
  unit_number: number;
  title: string;
}

interface CourseInfo {
  id: number;
  code: string;
  name: string;
}

export default function StudyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: courseId } = use(params);
  const searchParams = useSearchParams();
  const topicId = searchParams.get("topicId");
  const unitId = searchParams.get("unitId");
  const { t } = useTranslation();

  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [topic, setTopic] = useState<TopicInfo | null>(null);
  const [unit, setUnit] = useState<UnitInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load course/topic info
  useEffect(() => {
    async function loadInfo() {
      try {
        const res = await fetch(apiUrl(`/api/v1/courses/${courseId}`));
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        setCourse({ id: data.id, code: data.code, name: data.name });

        // Find the unit and topic
        for (const u of data.units) {
          if (unitId && String(u.id) === unitId) {
            setUnit({ id: u.id, unit_number: u.unit_number, title: u.title });
            for (const tp of u.topics) {
              if (topicId && String(tp.id) === topicId) {
                setTopic({ id: tp.id, topic_number: tp.topic_number, title: tp.title });
                break;
              }
            }
            break;
          }
        }
      } catch (err) {
        console.error("Failed to load course info:", err);
      } finally {
        setInfoLoading(false);
      }
    }
    loadInfo();
  }, [courseId, topicId, unitId]);

  const sendMessage = useCallback(
    (message: string) => {
      if (!message.trim() || isLoading || !course) return;

      setIsLoading(true);
      setCurrentStage("connecting");
      setMessages((prev) => [...prev, { role: "user", content: message }]);
      setInputMessage("");

      // Close existing WS
      if (wsRef.current) {
        wsRef.current.close();
      }

      const ws = new WebSocket(wsUrl("/api/v1/tutor/chat"));
      wsRef.current = ws;

      let assistantMessage = "";

      ws.onopen = () => {
        const history = messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        ws.send(
          JSON.stringify({
            message,
            session_id: sessionIdRef.current,
            history,
            course_id: parseInt(courseId),
            topic_id: topicId ? parseInt(topicId) : null,
          })
        );
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "session") {
          sessionIdRef.current = data.session_id;
          setSessionId(data.session_id);
        } else if (data.type === "status") {
          setCurrentStage(data.stage || data.message);
        } else if (data.type === "stream") {
          assistantMessage += data.content;
          setMessages((prev) => {
            const msgs = [...prev];
            const last = msgs[msgs.length - 1];
            if (last?.role === "assistant" && last?.isStreaming) {
              msgs[msgs.length - 1] = { ...last, content: assistantMessage };
            } else {
              msgs.push({ role: "assistant", content: assistantMessage, isStreaming: true });
            }
            return msgs;
          });
          setCurrentStage("generating");
        } else if (data.type === "result") {
          setMessages((prev) => {
            const msgs = [...prev];
            const last = msgs[msgs.length - 1];
            if (last?.role === "assistant") {
              msgs[msgs.length - 1] = { ...last, content: data.content, isStreaming: false };
            }
            return msgs;
          });
          setIsLoading(false);
          setCurrentStage(null);
          ws.close();
        } else if (data.type === "error") {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `Error: ${data.message}` },
          ]);
          setIsLoading(false);
          setCurrentStage(null);
          ws.close();
        }
      };

      ws.onerror = () => {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Connection error. Please try again." },
        ]);
        setIsLoading(false);
        setCurrentStage(null);
      };

      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        setIsLoading(false);
        setCurrentStage(null);
      };
    },
    [isLoading, messages, courseId, topicId, course]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(inputMessage);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputMessage);
    }
  }

  if (infoLoading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const topicLabel = topic
    ? `${topic.topic_number} ${topic.title}`
    : "General Study";
  const unitLabel = unit
    ? `Unit ${unit.unit_number}: ${unit.title}`
    : "";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href={`/courses/${courseId}`}
            className="text-slate-400 hover:text-blue-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <h1 className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                {course?.name}
              </h1>
            </div>
            <div className="text-xs text-slate-400 truncate mt-0.5">
              {unitLabel && <span>{unitLabel} &middot; </span>}
              {topicLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
              <GraduationCapIcon className="w-8 h-8 text-blue-500" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">
              {t("Study")}: {topicLabel}
            </h2>
            <p className="text-sm text-slate-400 max-w-md mb-6">
              {t("Ask me anything about this topic. I can explain concepts, give practice questions, or help you prepare for the AP exam.")}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                `Explain ${topic?.title || "this topic"} step by step`,
                "Give me a practice question",
                "How does this appear on the AP exam?",
                "What are common mistakes students make?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  className="text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 hover:border-blue-200 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-blue-500" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-li:my-0.5 prose-pre:my-2">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {processLatexContent(msg.content)}
                  </ReactMarkdown>
                  {msg.isStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-blue-500 animate-pulse ml-0.5" />
                  )}
                </div>
              ) : (
                msg.content
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </div>
            )}
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-blue-500" />
            </div>
            <div className="bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
              {currentStage === "rag"
                ? `Searching ${course?.name} materials...`
                : "Thinking..."}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-3 flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask about ${topic?.title || course?.name || "this course"}...`}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !inputMessage.trim()}
            className="px-4 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function GraduationCapIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  );
}
