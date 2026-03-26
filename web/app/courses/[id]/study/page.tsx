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
const StepByStepViewer = dynamic(() => import("@/components/StepByStepViewer"), { ssr: false });
import {
  ArrowLeft,
  Bot,
  GraduationCap,
  Loader2,
  Send,
  User,
  BookOpen,
  Sparkles,
  Upload,
  Paperclip,
  X,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { apiUrl, wsUrl } from "@/lib/api";
import ProficiencyBreakdown, { type ProficiencyDimension } from "@/components/ProficiencyBreakdown";
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
  type?: "chat" | "mcq_source" | "frq_source" | "assessment" | "system";
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
  category?: string; // AP CSA concept category, e.g. "Methods", "ArrayList"
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

interface GoldenSolution {
  frq_index: number;
  solution_code: string;
  explanation: string;
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

const MCQ_SESSION_SIZE = 5; // Show 5 MCQs per practice session from the larger pool

/** Fisher-Yates shuffle (returns a new array). */
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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

// ── Assessment session persistence (localStorage) ──
interface AssessmentSession {
  questions: MCQuestion[];
  index: number;
  score: { correct: number; total: number };
  timestamp: number;
}

const assessmentStorageKey = (courseId: string, topicId: string) =>
  `assessment_session_${courseId}_${topicId}`;

function saveAssessmentSession(courseId: string, topicId: string, session: AssessmentSession) {
  try {
    localStorage.setItem(assessmentStorageKey(courseId, topicId), JSON.stringify(session));
  } catch { /* quota exceeded */ }
}

function loadAssessmentSession(courseId: string, topicId: string): AssessmentSession | null {
  try {
    const raw = localStorage.getItem(assessmentStorageKey(courseId, topicId));
    if (!raw) return null;
    const session = JSON.parse(raw) as AssessmentSession;
    // Expire after 24 hours
    if (Date.now() - session.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(assessmentStorageKey(courseId, topicId));
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function clearAssessmentSession(courseId: string, topicId: string) {
  localStorage.removeItem(assessmentStorageKey(courseId, topicId));
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
  const [sessionMcqs, setSessionMcqs] = useState<MCQuestion[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showMCQExplanation, setShowMCQExplanation] = useState(false);
  // FRQ state
  const [activeFRQ, setActiveFRQ] = useState<FRQuestion | null>(null);
  const [frqIndex, setFrqIndex] = useState(0);
  const [frqAnswer, setFrqAnswer] = useState("");
  const [showFRQSolution, setShowFRQSolution] = useState(false);
  // Golden solution & extra FRQ state
  const [goldenSolutions, setGoldenSolutions] = useState<GoldenSolution[] | null>(null);
  const [extraFrqs, setExtraFrqs] = useState<FRQuestion[] | null>(null);
  const [showGoldenSolution, setShowGoldenSolution] = useState(false);
  // FRQ evaluation overlay state
  const [frqEvalResult, setFrqEvalResult] = useState<string | null>(null);
  const [frqEvalStreaming, setFrqEvalStreaming] = useState(false);
  const frqEvalWsRef = useRef<WebSocket | null>(null);
  const evalScrollRef = useRef<HTMLDivElement>(null);
  const [frqEvalCode, setFrqEvalCode] = useState(""); // snapshot of code at eval time
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
  // Step-by-step intro viewer
  const [activeIntroContent, setActiveIntroContent] = useState<string | null>(null);
  // Cache AI responses — track which suggestion key triggered the current WS request
  const pendingSuggestionKeyRef = useRef<SuggestionKey | null>(null);
  // Assessment / progress tracking
  const [topicProficiency, setTopicProficiency] = useState<{ proficiency: number; total_questions: number; correct_answers: number } | null>(null);
  const [additionalMCQs, setAdditionalMCQs] = useState<MCQuestion[]>([]);
  const [additionalMCQIndex, setAdditionalMCQIndex] = useState(0);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  // Assessment mode
  const [assessmentMode, setAssessmentMode] = useState(false);
  const [assessmentQuestions, setAssessmentQuestions] = useState<MCQuestion[]>([]);
  const [assessmentIndex, setAssessmentIndex] = useState(0);
  const [assessmentScore, setAssessmentScore] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 });
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [savedSession, setSavedSession] = useState<AssessmentSession | null>(null);
  // Multi-dimensional proficiency
  const [dimensionData, setDimensionData] = useState<ProficiencyDimension[]>([]);
  const [showBreakdown, setShowBreakdown] = useState(false);

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

  // Auto-scroll evaluation overlay as content streams
  useEffect(() => {
    if (frqEvalResult && evalScrollRef.current) {
      evalScrollRef.current.scrollTop = evalScrollRef.current.scrollHeight;
    }
  }, [frqEvalResult]);

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
          if (data.golden_solutions) {
            setGoldenSolutions(data.golden_solutions);
          }
          if (data.extra_frqs) {
            setExtraFrqs(data.extra_frqs);
          }
        }
      } catch (err) {
        console.error("Failed to load preloaded content:", err);
      }
    }
    loadPreloaded();
  }, [courseId, topicId]);

  // Load topic progress/proficiency
  useEffect(() => {
    if (!topicId || !user) return;
    async function loadProgress() {
      try {
        const token = localStorage.getItem("deeptutor_token");
        const res = await fetch(apiUrl(`/api/v1/courses/${courseId}/topics/${topicId}/progress`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.total_questions > 0) {
            setTopicProficiency(data);
          }
        }
      } catch (err) {
        console.error("Failed to load progress:", err);
      }
    }
    loadProgress();
  }, [courseId, topicId, user]);

  // Load dimensional proficiency breakdown
  useEffect(() => {
    if (!topicId || !user) return;
    async function loadDimensions() {
      try {
        const token = localStorage.getItem("deeptutor_token");
        const res = await fetch(apiUrl(`/api/v1/courses/${courseId}/topics/${topicId}/progress/dimensions`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const dims: ProficiencyDimension[] = [];
          // Add question type dimensions
          for (const [value, info] of Object.entries(data.question_type || {})) {
            const d = info as { correct: number; total: number; proficiency: number; mastered: boolean };
            dims.push({ label: value === "mcq" ? "MCQ Accuracy" : "FRQ Competency", ...d });
          }
          // Add category dimensions
          for (const [value, info] of Object.entries(data.category || {})) {
            const d = info as { correct: number; total: number; proficiency: number; mastered: boolean };
            dims.push({ label: value, ...d });
          }
          setDimensionData(dims);
        }
      } catch (err) {
        console.error("Failed to load dimensions:", err);
      }
    }
    loadDimensions();
  }, [courseId, topicId, user, topicProficiency]); // Re-fetch when proficiency updates

  // Check for saved assessment session to offer resume
  useEffect(() => {
    if (!topicId) return;
    const session = loadAssessmentSession(courseId, topicId);
    if (session && session.questions.length > 0 && session.index < session.questions.length) {
      setSavedSession(session);
      setShowResumeDialog(true);
    }
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
      // Track suggestion key for caching the AI response
      if (key === "intro" || key === "exam" || key === "mistakes") {
        pendingSuggestionKeyRef.current = key;
      }
      sendMessage(label);
      return;
    }

    if (key === "practice_mcq") {
      let mcqs = preloadedContent.practice_mcq;
      // Try to recover any raw_text items
      if (mcqs && mcqs.length > 0) {
        mcqs = mcqs.map(tryRecoverMCQ).filter(q => !q.raw_text);
      }
      if (mcqs && mcqs.length > 0) {
        // Shuffle the full pool and pick a session-sized subset
        const picked = shuffleArray(mcqs).slice(0, MCQ_SESSION_SIZE);
        setSessionMcqs(picked);
        setMessages((prev) => [...prev, { role: "user", content: label }]);
        setMcqIndex(0);
        setActiveMCQ(picked[0]);
        setSelectedAnswer(null);
        setShowMCQExplanation(false);
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
      // Merge extra FRQs (appended after preloaded ones)
      const mergedFrqs = [...(frqs || [])];
      if (extraFrqs && extraFrqs.length > 0) {
        mergedFrqs.push(...extraFrqs.map(tryRecoverFRQ));
      }
      if (mergedFrqs.length > 0 && !mergedFrqs[0].raw_text) {
        setMessages((prev) => [...prev, { role: "user", content: label }]);
        setFrqIndex(0);
        setActiveFRQ(mergedFrqs[0]);
        setFrqAnswer("");
        setShowFRQSolution(false);
        setShowGoldenSolution(false);
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

    // intro, exam, mistakes — text content
    const textKeys: Record<string, string | undefined> = {
      intro: preloadedContent.intro,
      exam: preloadedContent.exam,
      mistakes: preloadedContent.mistakes,
    };
    if (textKeys[key]) {
      setMessages((prev) => [...prev, { role: "user", content: label }]);
      if (key === "intro") {
        // Show step-by-step viewer for intro content
        setActiveIntroContent(textKeys[key]!);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: textKeys[key]! },
        ]);
      }
    } else {
      // No preloaded content — send to AI and cache the response
      if (key === "intro" || key === "exam" || key === "mistakes") {
        pendingSuggestionKeyRef.current = key;
      }
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

    // Submit answer to assessment API
    if (topicId && user) {
      const token = localStorage.getItem("deeptutor_token");
      fetch(apiUrl(`/api/v1/courses/${courseId}/topics/${topicId}/submit-answer`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          question_type: "mcq",
          question_text: activeMCQ.question,
          student_answer: selectedAnswer,
          correct_answer: activeMCQ.correct,
          is_correct: isCorrect,
          explanation: activeMCQ.explanation,
          question_category: activeMCQ.category || topic?.title || null,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          setTopicProficiency({
            proficiency: data.proficiency,
            total_questions: data.total_questions,
            correct_answers: data.correct_answers,
          });
        })
        .catch(console.error);
    }
  }

  function handleNextMCQ() {
    if (!sessionMcqs.length) return;
    const nextIdx = mcqIndex + 1;
    if (nextIdx < sessionMcqs.length) {
      setMcqIndex(nextIdx);
      setActiveMCQ(sessionMcqs[nextIdx]);
      setSelectedAnswer(null);
      setShowMCQExplanation(false);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: `Practice MCQ ${nextIdx + 1} of ${sessionMcqs.length}`, type: "system" as const },
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

    // Number lines so the LLM can reference them
    const numberedCode = frqAnswer
      .split("\n")
      .map((line, i) => `${i + 1}: ${line}`)
      .join("\n");

    const evalPrompt = [
      "**Evaluate my Java code for this FRQ.**\n",
      `**Question:** ${activeFRQ.question}\n`,
      `**My Code (with line numbers):**\n\`\`\`\n${numberedCode}\n\`\`\`\n`,
      "**Instructions for evaluation:**",
      "1. Start with a brief **Summary** (1-2 sentences on overall quality).",
      "2. Then list **Issues Found**. For EACH issue, format EXACTLY like this:",
      "   **Line X:** `quoted code` — explanation of what's wrong and the fix.",
      "   If multiple lines have issues, list each separately with **Line N:** prefix.",
      "3. Then a **Rubric Scoring** section — score each rubric point with ✅ or ❌:",
      `${activeFRQ.rubric || "Standard AP FRQ rubric"}`,
      "4. End with **Overall Score: X/Y points** and 2-3 bullet points for key improvements.",
      "5. IMPORTANT: Always use **Line N:** format when referencing code lines so errors can be highlighted.",
    ].join("\n");

    // Save code snapshot and stream evaluation into split panel (not chat)
    setFrqEvalCode(frqAnswer);
    setFrqEvalResult("");
    setFrqEvalStreaming(true);

    if (frqEvalWsRef.current) frqEvalWsRef.current.close();

    const ws = new WebSocket(wsUrl("/api/v1/tutor/chat"));
    frqEvalWsRef.current = ws;

    let result = "";

    ws.onopen = () => {
      const history = messages.map((msg) => ({ role: msg.role, content: msg.content }));
      ws.send(JSON.stringify({
        message: evalPrompt,
        session_id: sessionIdRef.current,
        history,
        course_id: courseId,
        topic_id: topicId || null,
        user_id: user?.id || null,
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "session") {
        sessionIdRef.current = data.session_id;
        setSessionId(data.session_id);
      } else if (data.type === "stream") {
        result += data.content;
        setFrqEvalResult(result);
      } else if (data.type === "result") {
        setFrqEvalResult(data.content);
        setFrqEvalStreaming(false);
        ws.close();
      } else if (data.type === "error") {
        setFrqEvalResult(`Error: ${data.message}`);
        setFrqEvalStreaming(false);
        ws.close();
      }
    };

    ws.onerror = () => {
      setFrqEvalResult("Connection error. Please try again.");
      setFrqEvalStreaming(false);
    };

    ws.onclose = () => {
      if (frqEvalWsRef.current === ws) frqEvalWsRef.current = null;
      setFrqEvalStreaming(false);
    };
  }

  function handleNextFRQ() {
    // Merge preloaded + extra FRQs
    const frqs = [
      ...(preloadedContent?.practice_frq || []),
      ...(extraFrqs || []),
    ];
    if (!frqs.length) return;
    const nextIdx = frqIndex + 1;
    if (nextIdx < frqs.length && !frqs[nextIdx].raw_text) {
      setFrqIndex(nextIdx);
      setActiveFRQ(frqs[nextIdx]);
      setFrqAnswer("");
      setShowFRQSolution(false);
      setShowGoldenSolution(false);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: `Practice FRQ ${nextIdx + 1} of ${frqs.length}`, type: "system" as const },
      ]);
    }
  }

  async function handleGenerateMoreQuestions() {
    if (!topicId || generatingQuestions) return;
    setGeneratingQuestions(true);
    try {
      const token = localStorage.getItem("deeptutor_token");
      const res = await fetch(
        apiUrl(`/api/v1/courses/${courseId}/topics/${topicId}/generate-questions`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ count: 3 }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const questions = (data.questions || []).filter((q: MCQuestion) => q.question && q.options);
        if (questions.length > 0) {
          setAdditionalMCQs(questions);
          setAdditionalMCQIndex(0);
          setActiveMCQ(questions[0]);
          setSelectedAnswer(null);
          setShowMCQExplanation(false);
          setMessages((prev) => [
            ...prev,
            { role: "user", content: "Generate more practice questions" },
          ]);
        }
      }
    } catch (err) {
      console.error("Failed to generate questions:", err);
    } finally {
      setGeneratingQuestions(false);
    }
  }

  function handleNextAdditionalMCQ() {
    const nextIdx = additionalMCQIndex + 1;
    if (nextIdx < additionalMCQs.length) {
      setAdditionalMCQIndex(nextIdx);
      setActiveMCQ(additionalMCQs[nextIdx]);
      setSelectedAnswer(null);
      setShowMCQExplanation(false);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: `Practice MCQ ${nextIdx + 1} of ${additionalMCQs.length}`, type: "system" as const },
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
          // Cache AI response for cacheable suggestion keys
          const cacheKey = pendingSuggestionKeyRef.current;
          if (cacheKey && topicId && ["intro", "exam", "mistakes"].includes(cacheKey)) {
            pendingSuggestionKeyRef.current = null;
            const token = localStorage.getItem("deeptutor_token");
            fetch(apiUrl(`/api/v1/courses/${courseId}/topics/${topicId}/content`), {
              method: "PATCH",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ key: cacheKey, content: data.content }),
            })
              .then(() => {
                // Update local preloadedContent so button turns purple
                setPreloadedContent((prev) => ({
                  ...prev,
                  [cacheKey]: data.content,
                } as PreloadedContent));
              })
              .catch(console.error);
            // Show step-by-step viewer for intro responses
            if (cacheKey === "intro") {
              setActiveIntroContent(data.content);
            }
          } else {
            pendingSuggestionKeyRef.current = null;
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

  // Whether to show the right-side code editor panel (also show during evaluation)
  const showEditorPanel = !!(activeFRQ && !showFRQSolution) || (showInlineEditor && !isLoading) || frqEvalResult !== null;

  // Extract error line numbers from evaluation text (matches "**Line N:**" pattern)
  const evalErrorLines = (() => {
    if (!frqEvalResult) return [];
    const matches = frqEvalResult.matchAll(/\*\*Line\s+(\d+)\s*[:\*]/gi);
    const lines = new Set<number>();
    for (const m of matches) lines.add(parseInt(m[1], 10));
    return Array.from(lines).sort((a, b) => a - b);
  })();

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
          {/* Proficiency display with breakdown popover */}
          {topicProficiency && topicProficiency.total_questions > 0 && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                title="Click for detailed breakdown"
              >
                <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      topicProficiency.proficiency >= 80
                        ? "bg-emerald-500"
                        : topicProficiency.proficiency >= 50
                        ? "bg-amber-500"
                        : "bg-red-400"
                    }`}
                    style={{ width: `${topicProficiency.proficiency}%` }}
                  />
                </div>
                <span className={`text-xs font-bold ${
                  topicProficiency.proficiency >= 80
                    ? "text-emerald-600 dark:text-emerald-400"
                    : topicProficiency.proficiency >= 50
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400"
                }`}>
                  {topicProficiency.proficiency}%
                </span>
                <span className="text-[10px] text-slate-400">
                  {topicProficiency.correct_answers}/{topicProficiency.total_questions}
                </span>
              </button>
              {/* Breakdown popover */}
              {showBreakdown && dimensionData.length > 0 && (
                <div className="absolute top-full right-0 mt-2 w-64 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg z-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Proficiency Breakdown</span>
                    <button
                      onClick={() => setShowBreakdown(false)}
                      className="text-[10px] text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  </div>
                  <ProficiencyBreakdown dimensions={dimensionData} view="bars" compact />
                </div>
              )}
            </div>
          )}
          {/* Take Assessment button */}
          {user && topicId && preloadedContent && (
            <button
              onClick={() => {
                // Launch assessment mode — generate questions and start quiz
                if (preloadedContent?.practice_mcq && preloadedContent.practice_mcq.length > 0) {
                  setAssessmentMode(true);
                  const allMcqs = preloadedContent.practice_mcq.map(tryRecoverMCQ).filter(q => !q.raw_text);
                  setAssessmentQuestions(shuffleArray(allMcqs));
                  setAssessmentIndex(0);
                  setAssessmentScore({ correct: 0, total: 0 });
                  setSelectedAnswer(null);
                  setShowMCQExplanation(false);
                  setActiveMCQ(null);
                  setMessages(prev => [...prev, { role: "user", content: "📝 Take Assessment" }]);
                } else {
                  handleGenerateMoreQuestions();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex-shrink-0
                border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              {t("Assess")}
            </button>
          )}
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
                // Hide FRQ button if preloaded content has no FRQs (course doesn't have FRQ section)
                if (key === "practice_frq" && preloadedContent && !preloadedContent.practice_frq?.length) {
                  return null;
                }
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

        {messages.map((msg, idx) => {
          // Skip rendering messages tagged as MCQ/FRQ source content (shown as interactive cards instead)
          if (msg.type === "mcq_source" || msg.type === "system") {
            return null;
          }
          return (
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
          );
        })}

        {/* Step-by-step intro viewer */}
        {activeIntroContent && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex-1 max-w-[85%] rounded-xl px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm leading-relaxed">
              <StepByStepViewer
                content={activeIntroContent}
                topicTitle={topic?.title}
                onDone={() => {
                  // Push full content into messages for chat history, then clear viewer
                  setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: activeIntroContent },
                  ]);
                  setActiveIntroContent(null);
                }}
              />
            </div>
          </div>
        )}

        {/* Assessment Resume Dialog */}
        {showResumeDialog && savedSession && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <GraduationCap className="w-4 h-4 text-purple-500" />
            </div>
            <div className="max-w-[80%] rounded-xl px-4 py-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 text-slate-800 dark:text-slate-200">
              <p className="text-sm font-medium mb-2">Resume Assessment?</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                You have an incomplete assessment — Q{savedSession.index + 1}/{savedSession.questions.length}, score: {savedSession.score.correct}/{savedSession.score.total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setAssessmentMode(true);
                    setAssessmentQuestions(savedSession.questions);
                    setAssessmentIndex(savedSession.index);
                    setAssessmentScore(savedSession.score);
                    setSelectedAnswer(null);
                    setShowMCQExplanation(false);
                    setActiveMCQ(null);
                    setShowResumeDialog(false);
                    setSavedSession(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-purple-500 text-white text-xs font-medium hover:bg-purple-600 transition-colors"
                >
                  Resume
                </button>
                <button
                  onClick={() => {
                    if (topicId) clearAssessmentSession(courseId, topicId);
                    setShowResumeDialog(false);
                    setSavedSession(null);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-600 border border-slate-200 dark:border-slate-700 transition-colors"
                >
                  Start Fresh
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assessment Mode */}
        {assessmentMode && assessmentQuestions.length > 0 && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <GraduationCap className="w-4 h-4 text-purple-500" />
            </div>
            <div className="max-w-[85%] rounded-xl px-4 py-3 bg-gradient-to-b from-purple-50 to-white dark:from-purple-950/20 dark:to-slate-800 border border-purple-200 dark:border-purple-800 text-slate-800 dark:text-slate-200">
              {/* Assessment header */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5" />
                  Assessment
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-mono">
                    Q{assessmentIndex + 1}/{assessmentQuestions.length}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    assessmentScore.total === 0 ? "bg-slate-100 dark:bg-slate-700 text-slate-400" :
                    (assessmentScore.correct / assessmentScore.total) >= 0.7 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  }`}>
                    {assessmentScore.correct}/{assessmentScore.total}
                  </span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${((assessmentIndex + 1) / assessmentQuestions.length) * 100}%` }}
                />
              </div>

              {assessmentIndex < assessmentQuestions.length ? (() => {
                const q = assessmentQuestions[assessmentIndex];
                return (
                  <>
                    <div className="prose prose-sm dark:prose-invert max-w-none mb-4">
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {processLatexContent(q.question)}
                      </ReactMarkdown>
                    </div>
                    <div className="space-y-2 mb-4">
                      {Object.entries(q.options).map(([letter, text]) => {
                        const isSelected = selectedAnswer === letter;
                        const isSubmitted = showMCQExplanation;
                        const isCorrect = letter === q.correct;
                        let btnClass = "border-slate-200 dark:border-slate-600 hover:border-purple-300 hover:bg-purple-50/50 dark:hover:bg-purple-900/10";
                        if (isSubmitted && isCorrect) {
                          btnClass = "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500";
                        } else if (isSubmitted && isSelected && !isCorrect) {
                          btnClass = "border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 ring-1 ring-red-400";
                        } else if (isSelected) {
                          btnClass = "border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500";
                        }
                        return (
                          <button
                            key={letter}
                            onClick={() => !showMCQExplanation && handleAnswerSelect(letter)}
                            disabled={showMCQExplanation}
                            className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${btnClass}`}
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
                        );
                      })}
                    </div>

                    {/* Explanation shown after submit */}
                    {showMCQExplanation && (
                      <div className={`mb-4 p-3 rounded-lg text-xs ${
                        selectedAnswer === q.correct
                          ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                          : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
                      }`}>
                        <div className="font-semibold mb-1">
                          {selectedAnswer === q.correct ? "✅ Correct!" : `❌ Incorrect — correct answer: (${q.correct})`}
                        </div>
                        <div className="prose prose-xs dark:prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {processLatexContent(q.explanation)}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {!showMCQExplanation ? (
                        <button
                          onClick={() => {
                            if (!selectedAnswer) return;
                            setShowMCQExplanation(true);
                            const isCorrect = selectedAnswer === q.correct;
                            const newScore = {
                              correct: assessmentScore.correct + (isCorrect ? 1 : 0),
                              total: assessmentScore.total + 1,
                            };
                            setAssessmentScore(newScore);
                            // Save session to localStorage for resume
                            if (topicId) {
                              saveAssessmentSession(courseId, topicId, {
                                questions: assessmentQuestions,
                                index: assessmentIndex,
                                score: newScore,
                                timestamp: Date.now(),
                              });
                            }
                            // Submit to backend
                            if (topicId && user) {
                              const token = localStorage.getItem("deeptutor_token");
                              fetch(apiUrl(`/api/v1/courses/${courseId}/topics/${topicId}/submit-answer`), {
                                method: "POST",
                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                body: JSON.stringify({
                                  question_type: "mcq",
                                  question_text: q.question,
                                  student_answer: selectedAnswer,
                                  correct_answer: q.correct,
                                  is_correct: isCorrect,
                                  explanation: q.explanation,
                                  question_category: q.category || topic?.title || null,
                                }),
                              })
                                .then(res => res.json())
                                .then(data => {
                                  setTopicProficiency({
                                    proficiency: data.proficiency,
                                    total_questions: data.total_questions,
                                    correct_answers: data.correct_answers,
                                  });
                                })
                                .catch(console.error);
                            }
                          }}
                          disabled={!selectedAnswer}
                          className="px-4 py-2 rounded-lg bg-purple-500 text-white text-sm font-medium hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Submit
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const nextIdx = assessmentIndex + 1;
                            if (nextIdx < assessmentQuestions.length) {
                              setAssessmentIndex(nextIdx);
                              setSelectedAnswer(null);
                              setShowMCQExplanation(false);
                              // Save progress for resume
                              if (topicId) {
                                saveAssessmentSession(courseId, topicId, {
                                  questions: assessmentQuestions,
                                  index: nextIdx,
                                  score: assessmentScore,
                                  timestamp: Date.now(),
                                });
                              }
                            } else {
                              // Assessment complete — clear saved session and show results
                              if (topicId) clearAssessmentSession(courseId, topicId);
                              const score = assessmentScore;
                              const pct = Math.round((score.correct / score.total) * 100);
                              const emoji = pct >= 80 ? "🎉" : pct >= 60 ? "👍" : "📚";
                              setMessages(prev => [...prev, {
                                role: "assistant",
                                content: `${emoji} **Assessment Complete!**\n\nYou scored **${score.correct}/${score.total}** (${pct}%)\n\n${
                                  pct >= 80 ? "Excellent! You've mastered this topic." :
                                  pct >= 60 ? "Good progress! Review the questions you missed and try again." :
                                  "Keep studying! Review the explanations and practice more to improve."
                                }\n\n${pct < 70 ? "💡 **Tip:** Click **More Practice Questions** below to generate additional practice tailored to your level." : ""}`,
                              }]);
                              setAssessmentMode(false);
                              setAssessmentQuestions([]);
                              setAssessmentIndex(0);
                              setSelectedAnswer(null);
                              setShowMCQExplanation(true); // Show "generate more" buttons
                            }
                          }}
                          className="px-4 py-2 rounded-lg bg-purple-500 text-white text-sm font-medium hover:bg-purple-600 transition-colors"
                        >
                          {assessmentIndex + 1 < assessmentQuestions.length ? "Next Question →" : "See Results"}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (topicId) clearAssessmentSession(courseId, topicId);
                          setAssessmentMode(false);
                          setAssessmentQuestions([]);
                          setSelectedAnswer(null);
                          setShowMCQExplanation(false);
                        }}
                        className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        Exit
                      </button>
                      <button
                        onClick={() => {
                          if (topicId) clearAssessmentSession(courseId, topicId);
                          setAssessmentIndex(0);
                          setAssessmentScore({ correct: 0, total: 0 });
                          setSelectedAnswer(null);
                          setShowMCQExplanation(false);
                        }}
                        className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        Reset
                      </button>
                    </div>
                  </>
                );
              })() : null}
            </div>
          </div>
        )}

        {/* Interactive MCQ */}
        {activeMCQ && !showMCQExplanation && !assessmentMode && (
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

        {/* "Next MCQ" / "Generate More" buttons after explanation */}
        {showMCQExplanation && (
          <div className="flex justify-center gap-2 flex-wrap">
            {/* Next preloaded MCQ */}
            {sessionMcqs.length > 0 && mcqIndex < (sessionMcqs.length - 1) && additionalMCQs.length === 0 && (
              <button
                onClick={handleNextMCQ}
                className="text-xs px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors"
              >
                Next MCQ →
              </button>
            )}
            {/* Next additional MCQ */}
            {additionalMCQs.length > 0 && additionalMCQIndex < additionalMCQs.length - 1 && (
              <button
                onClick={handleNextAdditionalMCQ}
                className="text-xs px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors"
              >
                Next MCQ →
              </button>
            )}
            {/* Generate more questions button */}
            {user && topicId && (
              <button
                onClick={handleGenerateMoreQuestions}
                disabled={generatingQuestions}
                className="text-xs px-4 py-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {generatingQuestions ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-3 h-3" /> More Practice Questions</>
                )}
              </button>
            )}
          </div>
        )}

        {/* FRQ question shown in chat (without editor — editor is on the right panel) */}
        {activeFRQ && !showFRQSolution && (() => {
          const totalFrqs = (preloadedContent?.practice_frq?.length || 0) + (extraFrqs?.length || 0);
          return (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot className="w-4 h-4 text-blue-500" />
            </div>
            <div className="max-w-[80%] rounded-xl px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded">
                  FRQ {frqIndex + 1} of {totalFrqs || 1}
                  {activeFRQ.frq_type && ` • ${activeFRQ.frq_type}`}
                </span>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {processLatexContent(activeFRQ.question)}
                </ReactMarkdown>
              </div>
              {/* Golden solution toggle */}
              {goldenSolutions?.find(g => g.frq_index === frqIndex) && (
                <div className="mt-3 border-t border-slate-200 dark:border-slate-700 pt-3">
                  <button
                    onClick={() => setShowGoldenSolution(!showGoldenSolution)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors flex items-center gap-1.5"
                  >
                    {showGoldenSolution ? "▾ Hide Solution" : "▸ Show Solution"}
                  </button>
                  {showGoldenSolution && (() => {
                    const gs = goldenSolutions.find(g => g.frq_index === frqIndex)!;
                    return (
                      <div className="mt-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {"```java\n" + gs.solution_code + "\n```\n\n**Explanation:**\n" + gs.explanation}
                          </ReactMarkdown>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              <p className="text-xs text-slate-400 mt-3 italic">
                ← Write your solution in the editor panel on the right
              </p>
            </div>
          </div>
          );
        })()}

        {/* "Next FRQ" button after solution + golden solution toggle */}
        {showFRQSolution && (() => {
          const totalFrqs = (preloadedContent?.practice_frq?.length || 0) + (extraFrqs?.length || 0);
          const hasNext = frqIndex < totalFrqs - 1;
          return (
            <div className="flex flex-col items-center gap-2">
              {/* Golden solution toggle in post-submit view */}
              {goldenSolutions?.find(g => g.frq_index === frqIndex) && (
                <div className="w-full max-w-2xl">
                  <button
                    onClick={() => setShowGoldenSolution(!showGoldenSolution)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors flex items-center gap-1.5"
                  >
                    {showGoldenSolution ? "▾ Hide Golden Solution" : "▸ Show Golden Solution"}
                  </button>
                  {showGoldenSolution && (() => {
                    const gs = goldenSolutions.find(g => g.frq_index === frqIndex)!;
                    return (
                      <div className="mt-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {"```java\n" + gs.solution_code + "\n```\n\n**Explanation:**\n" + gs.explanation}
                          </ReactMarkdown>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              {hasNext && (
                <button
                  onClick={handleNextFRQ}
                  className="text-xs px-4 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-100 transition-colors"
                >
                  Next FRQ →
                </button>
              )}
            </div>
          );
        })()}

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

          {/* ── SPLIT VIEW: Code (top) + Evaluation (bottom) ── */}
          {frqEvalResult !== null ? (
            <>
              {/* Top half: student code with error highlights */}
              <div className="flex flex-col" style={{ height: "45%" }}>
                <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Your Code
                    {evalErrorLines.length > 0 && (
                      <span className="ml-2 text-red-500 normal-case tracking-normal font-medium">
                        — {evalErrorLines.length} issue{evalErrorLines.length !== 1 ? "s" : ""} found
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => { setFrqEvalResult(null); setFrqEvalStreaming(false); }}
                    className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    title="Close evaluation"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <CodeEditor
                    value={frqEvalCode}
                    onChange={() => {}}
                    language="java"
                    height="100%"
                    readOnly
                    errorLines={evalErrorLines}
                  />
                </div>
              </div>

              {/* Divider with resize handle styling */}
              <div className="h-1 bg-slate-200 dark:bg-slate-700 flex-shrink-0" />

              {/* Bottom half: evaluation feedback */}
              <div className="flex flex-col" style={{ height: "calc(55% - 4px)" }}>
                <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800">
                  {frqEvalStreaming ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  )}
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    {frqEvalStreaming ? "Evaluating..." : "Evaluation"}
                  </span>
                </div>

                <div
                  ref={evalScrollRef}
                  className="flex-1 overflow-y-auto px-4 py-3"
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-slate-800 dark:prose-headings:text-slate-200 prose-headings:text-base prose-p:text-slate-600 dark:prose-p:text-slate-300 prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-slate-900 dark:prose-pre:bg-slate-950 prose-pre:text-sm prose-strong:text-slate-800 dark:prose-strong:text-slate-200 prose-li:text-slate-600 dark:prose-li:text-slate-300">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {processLatexContent(frqEvalResult)}
                    </ReactMarkdown>
                    {frqEvalStreaming && (
                      <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-0.5" />
                    )}
                  </div>
                </div>

                {/* Footer actions */}
                {!frqEvalStreaming && (
                  <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 flex gap-2">
                    <button
                      onClick={() => { setFrqEvalResult(null); }}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
                    >
                      ← Edit Code
                    </button>
                    <button
                      onClick={() => { setFrqEvalResult(null); handleNextFRQ(); }}
                      className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
                    >
                      Next FRQ →
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ── NORMAL: Editor only ── */
            <>
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
                      disabled={!frqAnswer.trim() || frqEvalStreaming}
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
            </>
          )}
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
