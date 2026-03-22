"use client";

import { useState, useEffect, useRef, useCallback, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

const CodeEditor = dynamic(() => import("@/components/CodeEditor"), { ssr: false });
import {
  ArrowLeft,
  Bot,
  Loader2,
  Send,
  User,
  BookOpen,
  Sparkles,
  Upload,
  Paperclip,
} from "lucide-react";
import { apiUrl, wsUrl } from "@/lib/api";
import { processLatexContent } from "@/lib/latex";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { useGlobal } from "@/context/GlobalContext";

interface UserFile {
  name: string;
  size: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

interface TopicInfo {
  id: string;
  topic_number: string;
  title: string;
}

interface UnitInfo {
  id: string;
  unit_number: number;
  title: string;
}

interface CourseInfo {
  id: string;
  code: string;
  name: string;
}

interface MCQuestion {
  question: string;
  options: Record<string, string>;
  correct: string;
  explanation: string;
  raw_text?: string; // fallback if JSON parsing failed
}

interface FRQuestion {
  question: string;
  frq_type?: string;
  sample_solution: string;
  rubric?: string;
  explanation: string;
  raw_text?: string;
}

interface PreloadedContent {
  intro?: string;
  practice?: string; // legacy single practice (backward compat)
  practice_mcq?: MCQuestion[];
  practice_frq?: FRQuestion[];
  exam?: string;
  mistakes?: string;
}

type SuggestionKey = "intro" | "practice_mcq" | "practice_frq" | "exam" | "mistakes";

const SUGGESTION_KEYS: { label: (topicTitle: string) => string; key: SuggestionKey }[] = [
  { label: (t) => `Explain ${t} step by step`, key: "intro" },
  { label: () => "Practice: Multiple Choice", key: "practice_mcq" },
  { label: () => "Practice: Free Response", key: "practice_frq" },
  { label: () => "How does this appear on the AP exam?", key: "exam" },
  { label: () => "What are common mistakes students make?", key: "mistakes" },
];

/** Try to recover a structured MCQ from raw_text (when JSON parsing failed on backend). */
function tryRecoverMCQ(mcq: MCQuestion): MCQuestion {
  if (!mcq.raw_text) return mcq;
  try {
    let raw = mcq.raw_text.trim();
    // Strip markdown code fences
    if (raw.startsWith("```")) {
      raw = raw.split("\n").slice(1).join("\n");
      raw = raw.replace(/```\s*$/, "").trim();
    }
    // Find JSON object boundaries
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first !== -1 && last > first) {
      let candidate = raw.slice(first, last + 1);
      // Fix trailing commas
      candidate = candidate.replace(/,\s*([}\]])/g, "$1");
      const parsed = JSON.parse(candidate);
      if (parsed.question && parsed.options && parsed.correct && parsed.explanation) {
        return parsed as MCQuestion;
      }
    }
  } catch {
    // recovery failed
  }
  return mcq;
}

/** Try to recover a structured FRQ from raw_text. */
function tryRecoverFRQ(frq: FRQuestion): FRQuestion {
  if (!frq.raw_text) return frq;
  try {
    let raw = frq.raw_text.trim();
    if (raw.startsWith("```")) {
      raw = raw.split("\n").slice(1).join("\n");
      raw = raw.replace(/```\s*$/, "").trim();
    }
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first !== -1 && last > first) {
      let candidate = raw.slice(first, last + 1);
      candidate = candidate.replace(/,\s*([}\]])/g, "$1");
      const parsed = JSON.parse(candidate);
      if (parsed.question && parsed.sample_solution && parsed.explanation) {
        return parsed as FRQuestion;
      }
    }
  } catch {
    // recovery failed
  }
  return frq;
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
  const [preloadedContent, setPreloadedContent] = useState<PreloadedContent | null>(null);
  // MCQ state
  const [activeMCQ, setActiveMCQ] = useState<MCQuestion | null>(null);
  const [mcqIndex, setMcqIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showMCQExplanation, setShowMCQExplanation] = useState(false);
  // FRQ state
  const [activeFRQ, setActiveFRQ] = useState<FRQuestion | null>(null);
  const [frqIndex, setFrqIndex] = useState(0);
  const [frqAnswer, setFrqAnswer] = useState("");
  const [showFRQSolution, setShowFRQSolution] = useState(false);
  // Inline code editor for non-preloaded FRQ responses
  const [showInlineEditor, setShowInlineEditor] = useState(false);
  const [inlineEditorCode, setInlineEditorCode] = useState("");
  // Upload state
  const { user } = useAuth();
  const [userFiles, setUserFiles] = useState<UserFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingInlineEditorRef = useRef(false);

  // Auto-collapse sidebar on study page for more room
  const { sidebarCollapsed, setSidebarCollapsed } = useGlobal();
  const prevCollapsedRef = useRef<boolean | null>(null);
  useEffect(() => {
    // Save the current state and collapse
    if (!sidebarCollapsed) {
      prevCollapsedRef.current = false;
      setSidebarCollapsed(true);
    }
    return () => {
      // Restore sidebar state when leaving study page
      if (prevCollapsedRef.current === false) {
        setSidebarCollapsed(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Load preloaded content for this topic
  useEffect(() => {
    if (!topicId) return;
    async function loadPreloaded() {
      try {
        const res = await fetch(apiUrl(`/api/v1/courses/${courseId}/topics/${topicId}/content`));
        if (res.ok) {
          const data = await res.json();
          if (data.content) {
            setPreloadedContent(data.content);
          }
        }
      } catch (err) {
        console.error("Failed to load preloaded content:", err);
      }
    }
    loadPreloaded();
  }, [courseId, topicId]);

  // Load user-uploaded files for this course
  useEffect(() => {
    if (!user) return;
    async function loadUserFiles() {
      try {
        const token = localStorage.getItem("deeptutor_token");
        const res = await fetch(apiUrl(`/api/v1/courses/${courseId}/user-uploads`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUserFiles(data.files || []);
        }
      } catch (err) {
        console.error("Failed to load user files:", err);
      }
    }
    loadUserFiles();
  }, [courseId, user]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const token = localStorage.getItem("deeptutor_token");
      const formData = new FormData();
      for (const f of Array.from(files)) {
        formData.append("files", f);
      }
      const res = await fetch(apiUrl(`/api/v1/courses/${courseId}/user-upload`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        // Refresh file list
        const listRes = await fetch(apiUrl(`/api/v1/courses/${courseId}/user-uploads`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (listRes.ok) {
          const data = await listRes.json();
          setUserFiles(data.files || []);
        }
      }
    } catch (err) {
      console.error("Failed to upload file:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteFile(filename: string) {
    try {
      const token = localStorage.getItem("deeptutor_token");
      const res = await fetch(
        apiUrl(`/api/v1/courses/${courseId}/user-uploads/${encodeURIComponent(filename)}`),
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        setUserFiles((prev) => prev.filter((f) => f.name !== filename));
      }
    } catch (err) {
      console.error("Failed to delete file:", err);
    }
  }

  // Handle suggestion button click — use preloaded content if available
  function handleSuggestion(label: string, key: SuggestionKey) {
    if (!preloadedContent) {
      if (key === "practice_frq") {
        setShowInlineEditor(false);
        setInlineEditorCode("");
        pendingInlineEditorRef.current = true;
      }
      sendMessage(label);
      return;
    }

    if (key === "practice_mcq") {
      let mcqs = preloadedContent.practice_mcq;
      // Try to recover any raw_text items
      if (mcqs && mcqs.length > 0) {
        mcqs = mcqs.map(tryRecoverMCQ);
      }
      if (mcqs && mcqs.length > 0 && !mcqs[0].raw_text) {
        setMessages((prev) => [...prev, { role: "user", content: label }]);
        setMcqIndex(0);
        setActiveMCQ(mcqs[0]);
        setSelectedAnswer(null);
        setShowMCQExplanation(false);
        // Update preloadedContent with recovered MCQs for next navigation
        if (preloadedContent) {
          preloadedContent.practice_mcq = mcqs;
        }
        return;
      }
      // legacy fallback
      if (preloadedContent.practice) {
        const legacyContent = preloadedContent.practice;
        setMessages((prev) => [
          ...prev,
          { role: "user", content: label },
          { role: "assistant", content: legacyContent },
        ]);
        return;
      }
      sendMessage(label);
      return;
    }

    if (key === "practice_frq") {
      let frqs = preloadedContent.practice_frq;
      if (frqs && frqs.length > 0) {
        frqs = frqs.map(tryRecoverFRQ);
        preloadedContent.practice_frq = frqs;
      }
      if (frqs && frqs.length > 0 && !frqs[0].raw_text) {
        setMessages((prev) => [...prev, { role: "user", content: label }]);
        setFrqIndex(0);
        setActiveFRQ(frqs[0]);
        setFrqAnswer("");
        setShowFRQSolution(false);
        return;
      }
      // No preloaded FRQ — send to LLM but show code editor after response
      setShowInlineEditor(false);
      setInlineEditorCode("");
      sendMessage(label);
      // Flag to show code editor once response arrives
      pendingInlineEditorRef.current = true;
      return;
    }

    // intro, exam, mistakes — simple text content
    const textKeys: Record<string, string | undefined> = {
      intro: preloadedContent.intro,
      exam: preloadedContent.exam,
      mistakes: preloadedContent.mistakes,
    };
    if (textKeys[key]) {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: label },
        { role: "assistant", content: textKeys[key]! },
      ]);
    } else {
      sendMessage(label);
    }
  }

  // ── MCQ handlers ──
  function handleAnswerSelect(letter: string) {
    if (!activeMCQ || showMCQExplanation) return;
    setSelectedAnswer(letter);
  }

  function handleSubmitMCQ() {
    if (!activeMCQ || !selectedAnswer) return;
    setShowMCQExplanation(true);
    const isCorrect = selectedAnswer === activeMCQ.correct;
    const resultMsg = isCorrect
      ? `✅ **Correct!** You selected **(${selectedAnswer})** ${activeMCQ.options[selectedAnswer]}`
      : `❌ **Incorrect.** You selected **(${selectedAnswer})** ${activeMCQ.options[selectedAnswer]}.\nThe correct answer is **(${activeMCQ.correct})** ${activeMCQ.options[activeMCQ.correct]}`;
    const fullExplanation = `${resultMsg}\n\n---\n\n${activeMCQ.explanation}`;
    setMessages((prev) => [...prev, { role: "assistant", content: fullExplanation }]);
    setActiveMCQ(null);
  }

  function handleNextMCQ() {
    const mcqs = preloadedContent?.practice_mcq;
    if (!mcqs) return;
    const nextIdx = mcqIndex + 1;
    if (nextIdx < mcqs.length && !mcqs[nextIdx].raw_text) {
      setMcqIndex(nextIdx);
      setActiveMCQ(mcqs[nextIdx]);
      setSelectedAnswer(null);
      setShowMCQExplanation(false);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: `Practice MCQ ${nextIdx + 1} of ${mcqs.length}` },
      ]);
    }
  }

  // ── FRQ handlers ──
  function handleSubmitFRQ() {
    if (!activeFRQ) return;
    setShowFRQSolution(true);
    const header = `**Your Answer:**\n\`\`\`java\n${frqAnswer || "(no answer submitted)"}\n\`\`\`\n\n---\n\n`;
    const solution = `**Sample Solution:**\n\`\`\`java\n${activeFRQ.sample_solution}\n\`\`\`\n\n`;
    const rubric = activeFRQ.rubric ? `**Rubric:**\n${activeFRQ.rubric}\n\n` : "";
    const explanation = `**Explanation:**\n${activeFRQ.explanation}`;
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: header + solution + rubric + explanation },
    ]);
    setActiveFRQ(null);
  }

  function handleEvaluateFRQ() {
    if (!activeFRQ || !frqAnswer.trim()) return;
    // Build evaluation prompt and send to TutorAgent via WebSocket
    const evalPrompt = [
      "**Evaluate my Java code for this FRQ.**\n",
      `**Question:** ${activeFRQ.question}\n`,
      `**My Code:**\n\`\`\`java\n${frqAnswer}\n\`\`\`\n`,
      "**Instructions for evaluation:**",
      "1. Review my code **line by line**. For each line that has an issue, quote the line, explain what's wrong, and suggest the fix.",
      "2. Check for: correctness, edge cases, style, and common AP CSA mistakes.",
      `3. Score my solution against this rubric:\n${activeFRQ.rubric || "Standard AP FRQ rubric"}`,
      "4. End with an overall score (e.g., 5/9 points) and key areas to improve.",
    ].join("\n");
    setShowFRQSolution(true);
    setActiveFRQ(null);
    sendMessage(evalPrompt);
  }

  function handleNextFRQ() {
    const frqs = preloadedContent?.practice_frq;
    if (!frqs) return;
    const nextIdx = frqIndex + 1;
    if (nextIdx < frqs.length && !frqs[nextIdx].raw_text) {
      setFrqIndex(nextIdx);
      setActiveFRQ(frqs[nextIdx]);
      setFrqAnswer("");
      setShowFRQSolution(false);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: `Practice FRQ ${nextIdx + 1} of ${frqs.length}` },
      ]);
    }
  }

  function handleInlineEvaluate() {
    if (!inlineEditorCode.trim()) return;
    // Find the last assistant message to use as the question context
    const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
    const questionContext = lastAssistantMsg?.content || "the FRQ above";
    const evalPrompt = [
      "**Evaluate my Java code for this FRQ.**\n",
      `**Question context (from previous message):** ${questionContext.slice(0, 1000)}\n`,
      `**My Code:**\n\`\`\`java\n${inlineEditorCode}\n\`\`\`\n`,
      "**Instructions for evaluation:**",
      "1. Review my code **line by line**. For each line that has an issue, quote the line, explain what's wrong, and suggest the fix.",
      "2. Check for: correctness, edge cases, style, and common AP CSA mistakes.",
      "3. Score my solution against the standard AP FRQ rubric.",
      "4. End with an overall score (e.g., 5/9 points) and key areas to improve.",
    ].join("\n");
    setShowInlineEditor(false);
    sendMessage(evalPrompt);
  }

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
            course_id: courseId,
            topic_id: topicId || null,
            user_id: user?.id || null,
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
          // Show inline code editor if this was an FRQ response
          if (pendingInlineEditorRef.current) {
            pendingInlineEditorRef.current = false;
            setShowInlineEditor(true);
            setInlineEditorCode("");
          }
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
    [isLoading, messages, courseId, topicId, course, user]
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

  // Whether to show the right-side code editor panel
  const showEditorPanel = !!(activeFRQ && !showFRQSolution) || (showInlineEditor && !isLoading);

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
          {/* Upload button */}
          <button
            onClick={() => setShowUploadPanel(!showUploadPanel)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex-shrink-0
              border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Paperclip className="w-3.5 h-3.5" />
            {t("My Files")}
            {userFiles.length > 0 && (
              <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                {userFiles.length}
              </span>
            )}
          </button>
        </div>
        {/* Upload Panel (collapsible) */}
        {showUploadPanel && (
          <div className="mt-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {t("Personal Study Materials")}
              </span>
              <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 cursor-pointer transition-colors">
                <Upload className="w-3 h-3" />
                {uploading ? t("Uploading...") : t("Upload")}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.txt,.md,.docx,.doc"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>
            {userFiles.length === 0 ? (
              <p className="text-xs text-slate-400">
                {t("No files uploaded yet. Upload PDFs, notes, or documents to enhance your AI tutoring.")}
              </p>
            ) : (
              <div className="space-y-1">
                {userFiles.map((f) => (
                  <div
                    key={f.name}
                    className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Paperclip className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span className="truncate text-slate-700 dark:text-slate-300">{f.name}</span>
                      <span className="text-slate-400 flex-shrink-0">
                        ({(f.size / 1024).toFixed(0)}KB)
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteFile(f.name)}
                      className="text-red-400 hover:text-red-600 text-[10px] font-medium ml-2 flex-shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main content: messages + optional right-side editor */}
      <div className="flex flex-1 overflow-hidden">
      {/* Messages column */}
      <div className={`flex flex-col min-w-0 ${showEditorPanel ? "w-1/2" : "flex-1"}`}>
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
              {SUGGESTION_KEYS.map(({ label, key }) => {
                const text = label(topic?.title || "this topic");
                let hasPreloaded = false;
                let count = 0;
                if (preloadedContent) {
                  if (key === "practice_mcq") {
                    const mcqs = preloadedContent.practice_mcq;
                    hasPreloaded = !!(mcqs && mcqs.length > 0);
                    count = mcqs?.length || 0;
                  } else if (key === "practice_frq") {
                    const frqs = preloadedContent.practice_frq;
                    hasPreloaded = !!(frqs && frqs.length > 0);
                    count = frqs?.length || 0;
                  } else {
                    hasPreloaded = !!(preloadedContent as Record<string, unknown>)[key];
                  }
                }
                return (
                  <button
                    key={key}
                    onClick={() => handleSuggestion(text, key)}
                    className={`text-xs px-3 py-2 rounded-lg border transition-colors inline-flex items-center gap-1.5 ${
                      hasPreloaded
                        ? "border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 hover:border-blue-200"
                    }`}
                  >
                    {hasPreloaded && <Sparkles className="w-3 h-3" />}
                    {text}
                    {count > 0 && (
                      <span className="bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {preloadedContent && (
              <p className="text-xs text-purple-400 mt-3 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {t("Purple buttons have instant pre-generated answers")}
              </p>
            )}
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

        {/* Interactive MCQ */}
        {activeMCQ && !showMCQExplanation && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot className="w-4 h-4 text-blue-500" />
            </div>
            <div className="max-w-[80%] rounded-xl px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
                  MCQ {mcqIndex + 1} of {preloadedContent?.practice_mcq?.length || 1}
                </span>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none mb-4">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {processLatexContent(activeMCQ.question)}
                </ReactMarkdown>
              </div>
              <div className="space-y-2 mb-4">
                {Object.entries(activeMCQ.options).map(([letter, text]) => (
                  <button
                    key={letter}
                    onClick={() => handleAnswerSelect(letter)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                      selectedAnswer === letter
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500"
                        : "border-slate-200 dark:border-slate-600 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-900/10"
                    }`}
                  >
                    <span className="font-semibold mr-2">({letter})</span>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{ p: ({ children }) => <span>{children}</span> }}
                    >
                      {processLatexContent(text)}
                    </ReactMarkdown>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSubmitMCQ}
                  disabled={!selectedAnswer}
                  className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {t("Submit Answer")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* "Next MCQ" button after explanation */}
        {showMCQExplanation && preloadedContent?.practice_mcq && mcqIndex < (preloadedContent.practice_mcq.length - 1) && (
          <div className="flex justify-center">
            <button
              onClick={handleNextMCQ}
              className="text-xs px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors"
            >
              Next MCQ →
            </button>
          </div>
        )}

        {/* FRQ question shown in chat (without editor — editor is on the right panel) */}
        {activeFRQ && !showFRQSolution && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot className="w-4 h-4 text-blue-500" />
            </div>
            <div className="max-w-[80%] rounded-xl px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded">
                  FRQ {frqIndex + 1} of {preloadedContent?.practice_frq?.length || 1}
                  {activeFRQ.frq_type && ` • ${activeFRQ.frq_type}`}
                </span>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {processLatexContent(activeFRQ.question)}
                </ReactMarkdown>
              </div>
              <p className="text-xs text-slate-400 mt-3 italic">
                ← Write your solution in the editor panel on the right
              </p>
            </div>
          </div>
        )}

        {/* "Next FRQ" button after solution */}
        {showFRQSolution && preloadedContent?.practice_frq && frqIndex < (preloadedContent.practice_frq.length - 1) && (
          <div className="flex justify-center">
            <button
              onClick={handleNextFRQ}
              className="text-xs px-4 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-100 transition-colors"
            >
              Next FRQ →
            </button>
          </div>
        )}

        {/* Hint for inline editor */}
        {showInlineEditor && !isLoading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot className="w-4 h-4 text-green-500" />
            </div>
            <div className="rounded-xl px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
              <p className="text-xs text-slate-400 italic">
                ← Write your solution in the editor panel on the right
              </p>
            </div>
          </div>
        )}

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
      </div>{/* end messages column */}

      {/* Right-side Code Editor Panel */}
      {showEditorPanel && (
        <div className="w-1/2 flex-shrink-0 border-l border-slate-200 dark:border-slate-700 flex flex-col bg-white dark:bg-slate-900">
          {/* Editor header */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {activeFRQ ? (
                <>FRQ {frqIndex + 1}{activeFRQ.frq_type && ` — ${activeFRQ.frq_type}`}</>
              ) : (
                t("Write Your Solution")
              )}
            </span>
            <button
              onClick={() => {
                if (activeFRQ) { setShowFRQSolution(true); setActiveFRQ(null); }
                else { setShowInlineEditor(false); }
              }}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              ✕ {t("Close")}
            </button>
          </div>

          {/* Editor body */}
          <div className="flex-1 overflow-y-auto p-4">
            <label className="text-xs text-slate-500 mb-2 block">{t("Write your Java code:")}</label>
            <CodeEditor
              value={activeFRQ ? frqAnswer : inlineEditorCode}
              onChange={activeFRQ ? setFrqAnswer : setInlineEditorCode}
              language="java"
              height="calc(100vh - 320px)"
            />
          </div>

          {/* Editor actions */}
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-2">
            {activeFRQ ? (
              <>
                <button
                  onClick={handleEvaluateFRQ}
                  disabled={!frqAnswer.trim() || isLoading}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {t("Evaluate My Code")}
                </button>
                <button
                  onClick={handleSubmitFRQ}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  {t("View Solution")}
                </button>
                <button
                  onClick={() => { setShowFRQSolution(true); handleSubmitFRQ(); }}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  {t("Skip")}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleInlineEvaluate}
                  disabled={!inlineEditorCode.trim() || isLoading}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {t("Evaluate My Code")}
                </button>
                <button
                  onClick={() => setShowInlineEditor(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  {t("Dismiss")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      </div>{/* end flex row */}
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
