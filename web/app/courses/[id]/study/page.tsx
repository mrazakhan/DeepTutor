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
const DrawingCanvas = dynamic(() => import("@/components/DrawingCanvas"), { ssr: false });
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
  Pen,
  Type,
} from "lucide-react";
import { apiUrl, wsUrl } from "@/lib/api";
import ProficiencyBreakdown, { type ProficiencyDimension } from "@/components/ProficiencyBreakdown";
import { processLatexContent } from "@/lib/latex";
import { parseChatMCQ } from "@/lib/mcqParser";
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

interface ExamFormat {
  type?: string;
  sections?: { name: string; type?: string; count?: number }[];
  weight?: { mcq: number; frq: number };
}

interface CourseInfo {
  id: string;
  code: string;
  name: string;
  exam_format?: ExamFormat | null;
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

const SUGGESTION_KEYS: { label: (topicTitle: string) => string; shortLabel: string; desc: string; key: SuggestionKey; color: string }[] = [
  { label: (t) => `Explain ${t} step by step`, shortLabel: "Learn", desc: "Step-by-step explanation", key: "intro", color: "blue" },
  { label: () => "Practice: Multiple Choice", shortLabel: "Practice MCQs", desc: "Multiple choice questions", key: "practice_mcq", color: "green" },
  { label: () => "Practice: Free Response", shortLabel: "Practice FRQs", desc: "Free response coding", key: "practice_frq", color: "amber" },
  { label: () => "How does this appear on the AP exam?", shortLabel: "AP Exam Tips", desc: "What to expect on test day", key: "exam", color: "purple" },
  { label: () => "What are common mistakes students make?", shortLabel: "Common Mistakes", desc: "Pitfalls to avoid", key: "mistakes", color: "red" },
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
  const [nextTopic, setNextTopic] = useState<{ id: string; unitId: string; topicNumber: string; title: string } | null>(null);
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
  const [mcqAnswers, setMcqAnswers] = useState<Record<number, { selected: string; correct: boolean }>>({});
  // Chat-generated MCQ state
  const [chatMcqMode, setChatMcqMode] = useState(false);
  const [chatMcqTrailing, setChatMcqTrailing] = useState<string | null>(null);
  const pendingMcqRef = useRef(false);
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
  const [revealedIssues, setRevealedIssues] = useState(0); // progressive reveal count
  // FRQ input mode (type vs draw)
  const [frqInputMode, setFrqInputMode] = useState<"type" | "draw">("type");
  const drawingCanvasRef = useRef<{ exportImage: () => Promise<string>; clearCanvas: () => void } | null>(null);
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
        setCourse({ id: data.id, code: data.code, name: data.name, exam_format: data.exam_format || null });

        // Find the unit, topic, and next topic
        const allTopics: { id: string; unitId: string; topicNumber: string; title: string }[] = [];
        for (const u of data.units) {
          for (const tp of u.topics) {
            allTopics.push({ id: tp.id, unitId: u.id, topicNumber: tp.topic_number, title: tp.title });
          }
          if (unitId && String(u.id) === unitId) {
            setUnit({ id: u.id, unit_number: u.unit_number, title: u.title });
            for (const tp of u.topics) {
              if (topicId && String(tp.id) === topicId) {
                setTopic({ id: tp.id, topic_number: tp.topic_number, title: tp.title });
              }
            }
          }
        }
        // Find next topic in sequence
        const currentIdx = allTopics.findIndex((t) => t.id === topicId);
        if (currentIdx >= 0 && currentIdx + 1 < allTopics.length) {
          setNextTopic(allTopics[currentIdx + 1]);
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
      if (key === "practice_mcq") {
        pendingMcqRef.current = true;
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
      pendingMcqRef.current = true;
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
    if (showMCQExplanation) return;
    if (!activeMCQ && !assessmentMode) return;
    setSelectedAnswer(letter);
  }

  function handleSubmitMCQ() {
    if (!activeMCQ || !selectedAnswer) return;
    setShowMCQExplanation(true);
    const isCorrect = selectedAnswer === activeMCQ.correct;
    // Record answer without appending to chat messages
    setMcqAnswers(prev => ({ ...prev, [mcqIndex]: { selected: selectedAnswer, correct: isCorrect } }));

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

  function handleSubmitChatMCQ() {
    if (!activeMCQ || !selectedAnswer) return;
    const answerText = activeMCQ.options[selectedAnswer] || "";
    setActiveMCQ(null);
    setChatMcqMode(false);
    setChatMcqTrailing(null);
    setSelectedAnswer(null);
    // Send selection to tutor — they'll respond with feedback
    sendMessage(`My answer is (${selectedAnswer}) ${answerText}`);
  }

  function handleNextMCQ() {
    if (!sessionMcqs.length) return;
    const nextIdx = mcqIndex + 1;
    if (nextIdx < sessionMcqs.length) {
      setMcqIndex(nextIdx);
      setActiveMCQ(sessionMcqs[nextIdx]);
      setSelectedAnswer(null);
      setShowMCQExplanation(false);
    }
  }

  // ── FRQ handlers ──
  function handleSubmitFRQ() {
    if (!activeFRQ) return;
    setShowFRQSolution(true);
    // Don't append to chat — solution shown inline in the FRQ card
  }

  async function handleEvaluateFRQ() {
    if (!activeFRQ) return;

    let evalPrompt: string;
    let imageData: string | null = null;

    if (frqInputMode === "draw") {
      // Export canvas as base64 PNG
      if (!drawingCanvasRef.current) {
        console.error("Canvas ref not available");
        return;
      }
      const dataUrl = await drawingCanvasRef.current.exportImage();
      if (!dataUrl) {
        console.error("Canvas export returned empty");
        return;
      }
      imageData = dataUrl;

      evalPrompt = [
        "Evaluate the student's handwritten FRQ answer shown in the attached image.\n",
        `**Question:** ${activeFRQ.question}\n`,
        "The student wrote their answer by hand. Please read and evaluate their handwritten response.\n",
        "Format your response using EXACTLY these section headers (each on its own line preceded by ##):\n",
        "## Summary",
        "1-2 sentences on overall quality, followed by **Score: X/Y points**\n",
        "## Issues",
        "For EACH issue, write a subsection like:",
        "### Issue N: short title",
        "Then explain what's wrong and the fix.",
        "Use a separate ### for each issue. If no issues, write 'No issues found.'\n",
        "## Rubric",
        "Score each rubric point with ✅ or ❌:",
        `${activeFRQ.rubric || "Standard AP FRQ rubric"}\n`,
        "## Improvements",
        "2-3 bullet points for the most important things to study/practice.",
        "\nIMPORTANT: Always use ### Issue N: format for each issue so they can be displayed one at a time.",
      ].join("\n");

      setFrqEvalCode("[Handwritten answer]");
    } else {
      if (!frqAnswer.trim()) return;

      const numberedCode = frqAnswer
        .split("\n")
        .map((line, i) => `${i + 1}: ${line}`)
        .join("\n");

      evalPrompt = [
        "Evaluate my Java code for this FRQ.\n",
        `**Question:** ${activeFRQ.question}\n`,
        `**My Code (with line numbers):**\n\`\`\`\n${numberedCode}\n\`\`\`\n`,
        "Format your response using EXACTLY these section headers (each on its own line preceded by ##):\n",
        "## Summary",
        "1-2 sentences on overall quality, followed by **Score: X/Y points**\n",
        "## Issues",
        "For EACH issue, write a subsection like:",
        "### Line N: short title",
        "Then explain: quote the problematic code, what's wrong, and the fix.",
        "Use a separate ### for each issue. If no issues, write 'No issues found.'\n",
        "## Rubric",
        "Score each rubric point with ✅ or ❌:",
        `${activeFRQ.rubric || "Standard AP FRQ rubric"}\n`,
        "## Improvements",
        "2-3 bullet points for the most important things to study/practice.",
        "\nIMPORTANT: Always use ### Line N: format for each issue so they can be displayed one at a time.",
      ].join("\n");

      setFrqEvalCode(frqAnswer);
    }

    setFrqEvalResult("");
    setFrqEvalStreaming(true);
    setRevealedIssues(0);

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
        image_data: imageData,
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
      setFrqEvalResult(null);
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
          body: JSON.stringify({ count: 3, use_uploads: userFiles.length > 0 }),
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
          // Detect chat-generated MCQ and activate button UI
          if (pendingMcqRef.current) {
            pendingMcqRef.current = false;
            const parsed = parseChatMCQ(data.content);
            if (parsed) {
              // Hide the raw text message, show structured MCQ instead
              setMessages((prev) => {
                const msgs = [...prev];
                const last = msgs[msgs.length - 1];
                if (last?.role === "assistant") {
                  msgs[msgs.length - 1] = { ...last, type: "mcq_source" as const };
                }
                return msgs;
              });
              setActiveMCQ({
                question: parsed.question,
                options: parsed.options,
                correct: "",      // unknown — tutor will evaluate after submission
                explanation: "",
              });
              setSelectedAnswer(null);
              setShowMCQExplanation(false);
              setChatMcqMode(true);
              setChatMcqTrailing(parsed.trailingText || null);
            }
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

  // Parse evaluation result into structured sections
  const evalSections = (() => {
    if (!frqEvalResult) return { summary: "", issues: [] as { title: string; line: number | null; content: string }[], rubric: "", improvements: "" };

    const text = frqEvalResult;

    // Extract sections by ## headers
    const summaryMatch = text.match(/## Summary\s*\n([\s\S]*?)(?=\n## |$)/i);
    const issuesMatch = text.match(/## Issues\s*\n([\s\S]*?)(?=\n## |$)/i);
    const rubricMatch = text.match(/## Rubric\s*\n([\s\S]*?)(?=\n## |$)/i);
    const improvementsMatch = text.match(/## Improvements\s*\n([\s\S]*?)(?=\n## |$)/i);

    // Parse individual issues from ### subsections
    const issuesText = issuesMatch?.[1] || "";
    const issueBlocks = issuesText.split(/(?=### )/g).filter((b) => b.trim().startsWith("### "));
    const issues = issueBlocks.map((block) => {
      const titleMatch = block.match(/### (.+)/);
      const title = titleMatch?.[1]?.trim() || "Issue";
      const lineMatch = title.match(/Line\s+(\d+)/i);
      const line = lineMatch ? parseInt(lineMatch[1], 10) : null;
      const content = block.replace(/### .+\n?/, "").trim();
      return { title, line, content };
    });

    return {
      summary: summaryMatch?.[1]?.trim() || "",
      issues,
      rubric: rubricMatch?.[1]?.trim() || "",
      improvements: improvementsMatch?.[1]?.trim() || "",
    };
  })();

  // Extract error line numbers from parsed issues (only for revealed issues)
  const evalErrorLines = evalSections.issues
    .slice(0, revealedIssues || evalSections.issues.length)
    .map((i) => i.line)
    .filter((l): l is number => l !== null);

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

      {/* ── LEFT PANEL: FRQ Problem Statement (when FRQ is active) ── */}
      {activeFRQ && showEditorPanel && !frqEvalResult && (() => {
        const allFrqs = [...(preloadedContent?.practice_frq || []), ...(extraFrqs || [])];
        const totalFrqs = allFrqs.length;
        return (
        <div className="w-1/2 flex flex-col min-w-0 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          {/* FRQ header with navigation */}
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1 rounded-full shadow-sm">
                FRQ {frqIndex + 1} / {totalFrqs}
              </span>
              {activeFRQ.frq_type && (
                <span className="text-[10px] font-medium text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 rounded-full">
                  {activeFRQ.frq_type}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {/* Navigation dots */}
              {totalFrqs > 1 && allFrqs.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (allFrqs[i] && !allFrqs[i].raw_text) {
                      setFrqIndex(i);
                      setActiveFRQ(allFrqs[i]);
                      setFrqAnswer("");
                      setShowFRQSolution(false);
                      setShowGoldenSolution(false);
                      setFrqEvalResult(null);
                    }
                  }}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i === frqIndex ? "w-6 bg-amber-500" : "bg-slate-300 dark:bg-slate-600 hover:bg-slate-400"
                  }`}
                  title={`FRQ ${i + 1}`}
                />
              ))}
              <button
                onClick={() => { setActiveFRQ(null); setShowFRQSolution(false); setFrqEvalResult(null); }}
                className="ml-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* Problem statement - full scrollable area */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-slate-800 prose-pre:text-slate-100 prose-code:text-amber-600 dark:prose-code:text-amber-400">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                {processLatexContent(activeFRQ.question)}
              </ReactMarkdown>
            </div>

            {/* Solution (shown after View Solution) */}
            {showFRQSolution && (
              <div className="mt-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-2">Sample Solution</h4>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {`\`\`\`java\n${activeFRQ.sample_solution}\n\`\`\`\n\n${activeFRQ.rubric ? `**Rubric:**\n${activeFRQ.rubric}\n\n` : ""}**Explanation:**\n${activeFRQ.explanation}`}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* Golden solution */}
            {goldenSolutions?.find(g => g.frq_index === frqIndex) && (
              <div className="mt-3">
                <button
                  onClick={() => setShowGoldenSolution(!showGoldenSolution)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 transition-colors flex items-center gap-1.5"
                >
                  {showGoldenSolution ? "▾ Hide Golden Solution" : "▸ Show Golden Solution"}
                </button>
                {showGoldenSolution && (() => {
                  const gs = goldenSolutions!.find(g => g.frq_index === frqIndex)!;
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
          </div>

          {/* Bottom controls */}
          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex gap-2 flex-wrap">
            <button
              onClick={handleEvaluateFRQ}
              disabled={frqEvalStreaming || (frqInputMode === "type" ? !frqAnswer.trim() : false)}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {frqInputMode === "draw" ? t("Evaluate My Answer") : t("Evaluate My Code")}
            </button>
            <button
              onClick={handleSubmitFRQ}
              className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
            >
              {t("View Solution")}
            </button>
            {frqIndex < totalFrqs - 1 && (
              <button
                onClick={() => {
                  const nextIdx = frqIndex + 1;
                  if (allFrqs[nextIdx]) {
                    setFrqIndex(nextIdx);
                    setActiveFRQ(allFrqs[nextIdx]);
                    setFrqAnswer("");
                    setShowFRQSolution(false);
                    setShowGoldenSolution(false);
                    setFrqEvalResult(null);
                  }
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Next FRQ →
              </button>
            )}
          </div>
        </div>
        );
      })()}

      {/* Messages column (hidden when FRQ problem view is active) */}
      {!(activeFRQ && showEditorPanel && !frqEvalResult) && (
      <div className={`flex flex-col min-w-0 ${showEditorPanel ? "w-1/2" : "flex-1"}`}>
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-1">
              {topicLabel}
            </h2>
            <p className="text-sm text-slate-400 mb-8">
              {t("Choose how you'd like to study")}
            </p>
            <div className="grid grid-cols-3 gap-3 max-w-2xl w-full mb-4">
              {SUGGESTION_KEYS.filter(({ key }) => {
                // Filter study modes based on course exam format
                const ef = course?.exam_format;
                const isAP = course?.code?.startsWith("AP_");
                const hasMcq = ef?.weight?.mcq !== 0; // default true unless explicitly 0
                const hasFrq = ef?.weight?.frq !== 0;

                if (key === "practice_mcq" && ef && !hasMcq) return false;
                if (key === "practice_frq" && preloadedContent && !preloadedContent.practice_frq?.length) return false;
                if (key === "practice_frq" && ef && !hasFrq) return false;
                if (key === "exam" && !isAP) return false; // "AP Exam Tips" only for AP courses
                return true;
              }).map(({ label, shortLabel: rawShortLabel, desc: rawDesc, key, color }) => {
                const isContest = course?.exam_format?.type === "programming_contest";
                const text = label(topic?.title || "this topic");
                // Dynamic labels for non-AP courses
                const shortLabel = (key === "practice_frq" && isContest) ? "Solve Problems" : rawShortLabel;
                const desc = (key === "practice_frq" && isContest) ? "Programming challenges" : rawDesc;
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
                const colorMap: Record<string, string> = {
                  blue: "border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300",
                  green: "border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300",
                  amber: "border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-300",
                  purple: "border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300",
                  red: "border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300",
                };
                const iconMap: Record<string, typeof BookOpen> = {
                  blue: BookOpen,
                  green: Sparkles,
                  amber: Send,
                  purple: GraduationCap,
                  red: AlertTriangle,
                };
                const textColorMap: Record<string, string> = {
                  blue: "text-blue-600 dark:text-blue-400",
                  green: "text-green-600 dark:text-green-400",
                  amber: "text-amber-600 dark:text-amber-400",
                  purple: "text-purple-600 dark:text-purple-400",
                  red: "text-red-600 dark:text-red-400",
                };
                const bgIconMap: Record<string, string> = {
                  blue: "bg-blue-100 dark:bg-blue-900/30",
                  green: "bg-green-100 dark:bg-green-900/30",
                  amber: "bg-amber-100 dark:bg-amber-900/30",
                  purple: "bg-purple-100 dark:bg-purple-900/30",
                  red: "bg-red-100 dark:bg-red-900/30",
                };
                const IconComponent = iconMap[color] || BookOpen;
                return (
                  <button
                    key={key}
                    onClick={() => handleSuggestion(text, key)}
                    className={`flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all hover:scale-[1.03] hover:shadow-md ${colorMap[color] || colorMap.blue}`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bgIconMap[color] || bgIconMap.blue}`}>
                      <IconComponent className={`w-6 h-6 ${textColorMap[color] || textColorMap.blue}`} />
                    </div>
                    <span className={`text-sm font-bold ${textColorMap[color] || textColorMap.blue}`}>
                      {shortLabel}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {count > 0 ? `${count} questions ready` : desc}
                    </span>
                  </button>
                );
              })}
              {/* Assessment card — only for courses with MCQs */}
              {course?.exam_format?.weight?.mcq !== 0 && preloadedContent?.practice_mcq && preloadedContent.practice_mcq.length > 0 && (
                <button
                  onClick={() => {
                    const allMcqs = (preloadedContent?.practice_mcq || []).filter((q: MCQuestion) => !q.raw_text);
                    if (allMcqs.length > 0) {
                      setAssessmentQuestions(shuffleArray([...allMcqs]));
                      setAssessmentIndex(0);
                      setAssessmentScore({ correct: 0, total: 0 });
                      setAssessmentMode(true);
                      setSelectedAnswer(null);
                      setShowMCQExplanation(false);
                    }
                  }}
                  className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-300 transition-all hover:scale-[1.03] hover:shadow-md"
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/30">
                    <GraduationCap className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    Take Assessment
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {preloadedContent.practice_mcq.filter((q: MCQuestion) => !q.raw_text).length} graded questions
                  </span>
                </button>
              )}
            </div>
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
                    <div className="space-y-2.5 mb-5">
                      {Object.entries(q.options).map(([letter, text]) => {
                        const isSelected = selectedAnswer === letter;
                        const isSubmitted = showMCQExplanation;
                        const isCorrect = letter === q.correct;
                        const letterColors: Record<string, string> = {
                          A: "from-blue-500 to-blue-600",
                          B: "from-violet-500 to-violet-600",
                          C: "from-emerald-500 to-emerald-600",
                          D: "from-amber-500 to-amber-600",
                        };

                        let btnClass = "border-slate-200 dark:border-slate-600/50 hover:border-purple-300 dark:hover:border-purple-500/50 hover:shadow-md hover:scale-[1.005] bg-slate-50/50 dark:bg-slate-700/30";
                        let letterBg = `from-slate-400 to-slate-500 dark:from-slate-500 dark:to-slate-600 group-hover:from-purple-400 group-hover:to-purple-500`;
                        if (isSubmitted && isCorrect) {
                          btnClass = "border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-md shadow-emerald-500/10 scale-[1.01]";
                          letterBg = "from-emerald-500 to-emerald-600";
                        } else if (isSubmitted && isSelected && !isCorrect) {
                          btnClass = "border-2 border-red-400 bg-red-50 dark:bg-red-900/20 shadow-md shadow-red-500/10";
                          letterBg = "from-red-500 to-red-600";
                        } else if (isSelected) {
                          btnClass = "border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-md shadow-purple-500/10 scale-[1.01]";
                          letterBg = letterColors[letter] || "from-purple-500 to-purple-600";
                        }
                        return (
                          <button
                            key={letter}
                            onClick={() => !showMCQExplanation && handleAnswerSelect(letter)}
                            disabled={showMCQExplanation}
                            className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all duration-200 group ${btnClass}`}
                          >
                            <div className="flex items-start gap-3">
                              <span className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br ${letterBg} transition-all shadow-sm`}>
                                {letter}
                              </span>
                              <span className="flex-1 pt-0.5">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm, remarkMath]}
                                  rehypePlugins={[rehypeKatex]}
                                  components={{ p: ({ children }) => <span>{children}</span> }}
                                >
                                  {processLatexContent(text)}
                                </ReactMarkdown>
                              </span>
                              {isSubmitted && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />}
                              {isSubmitted && isSelected && !isCorrect && <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />}
                            </div>
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
                              const nextTopicHint = nextTopic
                                ? `\n\n➡️ Ready for the next topic? **${nextTopic.topicNumber} ${nextTopic.title}**`
                                : "";
                              setMessages(prev => [...prev, {
                                role: "assistant",
                                content: `${emoji} **Assessment Complete!**\n\nYou scored **${score.correct}/${score.total}** (${pct}%)\n\n${
                                  pct >= 80 ? "Excellent! You've mastered this topic." :
                                  pct >= 60 ? "Good progress! Review the questions you missed and try again." :
                                  "Keep studying! Review the explanations and practice more to improve."
                                }${pct < 70 ? "\n\n💡 **Tip:** Click **More Practice Questions** below to generate additional practice tailored to your level." : ""}${nextTopicHint}`,
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

        {/* Interactive MCQ — single-card view with back/forward navigation */}
        {activeMCQ && !assessmentMode && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md shadow-blue-500/20">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="max-w-[85%] rounded-2xl px-5 py-4 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 shadow-lg shadow-slate-200/50 dark:shadow-black/20 border border-slate-100 dark:border-slate-700/50 backdrop-blur-sm">
              {/* Header with progress + navigation dots */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-500 px-3 py-1 rounded-full shadow-sm">
                    {chatMcqMode ? "Practice" : `${mcqIndex + 1} / ${sessionMcqs.length}`}
                  </span>
                </div>
                {/* Mini answer dots for quick navigation */}
                {!chatMcqMode && sessionMcqs.length > 1 && (
                  <div className="flex items-center gap-1">
                    {sessionMcqs.map((_, i) => {
                      const ans = mcqAnswers[i];
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            setMcqIndex(i);
                            setActiveMCQ(sessionMcqs[i]);
                            if (ans) {
                              setSelectedAnswer(ans.selected);
                              setShowMCQExplanation(true);
                            } else {
                              setSelectedAnswer(null);
                              setShowMCQExplanation(false);
                            }
                          }}
                          className={`w-2.5 h-2.5 rounded-full transition-all ${
                            i === mcqIndex
                              ? "w-6 bg-blue-500 rounded-full"
                              : ans
                                ? ans.correct ? "bg-emerald-400" : "bg-red-400"
                                : "bg-slate-300 dark:bg-slate-600"
                          }`}
                          title={`Question ${i + 1}${ans ? (ans.correct ? " ✓" : " ✗") : ""}`}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {!chatMcqMode && sessionMcqs.length > 1 && (
                <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full mb-4 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${(Object.keys(mcqAnswers).length / sessionMcqs.length) * 100}%` }}
                  />
                </div>
              )}

              {/* Question */}
              <div className="prose prose-sm dark:prose-invert max-w-none mb-5">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {processLatexContent(activeMCQ.question)}
                </ReactMarkdown>
              </div>

              {/* Answer options */}
              <div className="space-y-2.5 mb-5">
                {Object.entries(activeMCQ.options).map(([letter, text]) => {
                  const isSelected = selectedAnswer === letter;
                  const isSubmitted = showMCQExplanation;
                  const isCorrect = letter === activeMCQ.correct;
                  const letterColors: Record<string, string> = {
                    A: "from-blue-500 to-blue-600",
                    B: "from-violet-500 to-violet-600",
                    C: "from-emerald-500 to-emerald-600",
                    D: "from-amber-500 to-amber-600",
                  };

                  let btnClass = "border-slate-200 dark:border-slate-600/50 hover:border-blue-300 dark:hover:border-blue-500/50 hover:shadow-md hover:scale-[1.005] bg-slate-50/50 dark:bg-slate-700/30";
                  let letterBg = "from-slate-400 to-slate-500 dark:from-slate-500 dark:to-slate-600 group-hover:from-blue-400 group-hover:to-blue-500";

                  if (isSubmitted && isCorrect) {
                    btnClass = "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-md shadow-emerald-500/10 scale-[1.01]";
                    letterBg = "from-emerald-500 to-emerald-600";
                  } else if (isSubmitted && isSelected && !isCorrect) {
                    btnClass = "border-red-400 bg-red-50 dark:bg-red-900/20 shadow-md shadow-red-500/10";
                    letterBg = "from-red-500 to-red-600";
                  } else if (isSelected && !isSubmitted) {
                    btnClass = "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md shadow-blue-500/10 scale-[1.01]";
                    letterBg = letterColors[letter] || "from-blue-500 to-blue-600";
                  }

                  return (
                    <button
                      key={letter}
                      onClick={() => !showMCQExplanation && handleAnswerSelect(letter)}
                      disabled={showMCQExplanation}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all duration-200 group ${btnClass}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br ${letterBg} transition-all shadow-sm`}>
                          {letter}
                        </span>
                        <span className="flex-1 pt-0.5">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{ p: ({ children }) => <span>{children}</span> }}
                          >
                            {processLatexContent(text)}
                          </ReactMarkdown>
                        </span>
                        {isSubmitted && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />}
                        {isSubmitted && isSelected && !isCorrect && <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Explanation (inline after submit) */}
              {showMCQExplanation && (
                <div className={`mb-4 p-4 rounded-xl text-sm ${
                  selectedAnswer === activeMCQ.correct
                    ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
                    : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                }`}>
                  <div className={`font-semibold mb-2 ${selectedAnswer === activeMCQ.correct ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                    {selectedAnswer === activeMCQ.correct ? "✅ Correct!" : `❌ Incorrect — correct answer: ${activeMCQ.correct}`}
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {processLatexContent(activeMCQ.explanation)}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {!showMCQExplanation ? (
                  <>
                    <button
                      onClick={chatMcqMode ? handleSubmitChatMCQ : handleSubmitMCQ}
                      disabled={!selectedAnswer}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-400 dark:disabled:from-slate-600 dark:disabled:to-slate-700 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-500/20 disabled:shadow-none"
                    >
                      {t("Submit Answer")}
                    </button>
                  </>
                ) : (
                  <>
                    {/* Back button */}
                    {mcqIndex > 0 && (
                      <button
                        onClick={() => {
                          const prevIdx = mcqIndex - 1;
                          setMcqIndex(prevIdx);
                          setActiveMCQ(sessionMcqs[prevIdx]);
                          const prevAns = mcqAnswers[prevIdx];
                          if (prevAns) {
                            setSelectedAnswer(prevAns.selected);
                            setShowMCQExplanation(true);
                          } else {
                            setSelectedAnswer(null);
                            setShowMCQExplanation(false);
                          }
                        }}
                        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        ← {t("Previous")}
                      </button>
                    )}
                    {/* Forward / Next button */}
                    {mcqIndex < sessionMcqs.length - 1 ? (
                      <button
                        onClick={() => {
                          const nextIdx = mcqIndex + 1;
                          setMcqIndex(nextIdx);
                          setActiveMCQ(sessionMcqs[nextIdx]);
                          const nextAns = mcqAnswers[nextIdx];
                          if (nextAns) {
                            setSelectedAnswer(nextAns.selected);
                            setShowMCQExplanation(true);
                          } else {
                            setSelectedAnswer(null);
                            setShowMCQExplanation(false);
                          }
                        }}
                        className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md shadow-blue-500/20"
                      >
                        {t("Next")} →
                      </button>
                    ) : (
                      /* End-of-session actions */
                      <>
                        {/* Load More MCQs */}
                        {preloadedContent?.practice_mcq && (() => {
                          const allValid = (preloadedContent.practice_mcq || []).filter((q: MCQuestion) => !q.raw_text);
                          const seenQuestions = new Set(sessionMcqs.map((q: MCQuestion) => q.question));
                          const unseen = allValid.filter((q: MCQuestion) => !seenQuestions.has(q.question));
                          if (unseen.length === 0) return null;
                          return (
                            <button
                              onClick={() => {
                                const nextBatch = shuffleArray(unseen).slice(0, MCQ_SESSION_SIZE);
                                setSessionMcqs(prev => [...prev, ...nextBatch]);
                                setMcqIndex(sessionMcqs.length);
                                setActiveMCQ(nextBatch[0]);
                                setSelectedAnswer(null);
                                setShowMCQExplanation(false);
                              }}
                              className="px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-sm hover:bg-blue-100 transition-colors"
                            >
                              Load More ({unseen.length})
                            </button>
                          );
                        })()}
                        {/* Take Assessment */}
                        {preloadedContent?.practice_mcq && (
                          <button
                            onClick={() => {
                              setActiveMCQ(null);
                              setShowMCQExplanation(false);
                              setSelectedAnswer(null);
                              setMcqAnswers({});
                              const allMcqs = (preloadedContent.practice_mcq || []).filter((q: MCQuestion) => !q.raw_text);
                              if (allMcqs.length > 0) {
                                setAssessmentQuestions(shuffleArray([...allMcqs]));
                                setAssessmentIndex(0);
                                setAssessmentScore({ correct: 0, total: 0 });
                                setAssessmentMode(true);
                              }
                            }}
                            className="px-4 py-2 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 text-sm hover:bg-green-100 transition-colors inline-flex items-center gap-1.5"
                          >
                            <GraduationCap className="w-3.5 h-3.5" />
                            Assessment
                          </button>
                        )}
                        {/* Back to study */}
                        <button
                          onClick={() => {
                            setActiveMCQ(null);
                            setSessionMcqs([]);
                            setMcqIndex(0);
                            setSelectedAnswer(null);
                            setShowMCQExplanation(false);
                            setMcqAnswers({});
                          }}
                          className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          ← {t("Study Options")}
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Trailing guidance text for chat-generated MCQs */}
              {chatMcqMode && chatMcqTrailing && (
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 prose prose-sm dark:prose-invert max-w-none text-slate-500 dark:text-slate-400">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {processLatexContent(chatMcqTrailing)}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        )}

        {/* FRQ question — single-card view with navigation */}
        {activeFRQ && (() => {
          const allFrqs = [...(preloadedContent?.practice_frq || []), ...(extraFrqs || [])];
          const totalFrqs = allFrqs.length;
          const hasNext = frqIndex < totalFrqs - 1;
          return (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md shadow-amber-500/20">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="max-w-[85%] rounded-2xl px-5 py-4 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 shadow-lg shadow-slate-200/50 dark:shadow-black/20 border border-slate-100 dark:border-slate-700/50 backdrop-blur-sm">
              {/* Header with progress dots */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1 rounded-full shadow-sm">
                    FRQ {frqIndex + 1} / {totalFrqs || 1}
                  </span>
                  {activeFRQ.frq_type && (
                    <span className="text-[10px] font-medium text-purple-500 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-full">
                      {activeFRQ.frq_type}
                    </span>
                  )}
                </div>
                {/* Navigation dots */}
                {totalFrqs > 1 && (
                  <div className="flex items-center gap-1">
                    {allFrqs.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (allFrqs[i] && !allFrqs[i].raw_text) {
                            setFrqIndex(i);
                            setActiveFRQ(allFrqs[i]);
                            setFrqAnswer("");
                            setShowFRQSolution(false);
                            setShowGoldenSolution(false);
                            setFrqEvalResult(null);
                          }
                        }}
                        className={`w-2.5 h-2.5 rounded-full transition-all ${
                          i === frqIndex ? "w-6 bg-amber-500 rounded-full" : "bg-slate-300 dark:bg-slate-600"
                        }`}
                        title={`FRQ ${i + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {totalFrqs > 1 && (
                <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full mb-4 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                    style={{ width: `${((frqIndex + 1) / totalFrqs) * 100}%` }}
                  />
                </div>
              )}

              {/* Question */}
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {processLatexContent(activeFRQ.question)}
                </ReactMarkdown>
              </div>

              {/* Solution (shown after View Solution) */}
              {showFRQSolution && (
                <div className="mt-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {`**Sample Solution:**\n\`\`\`java\n${activeFRQ.sample_solution}\n\`\`\`\n\n${activeFRQ.rubric ? `**Rubric:**\n${activeFRQ.rubric}\n\n` : ""}**Explanation:**\n${activeFRQ.explanation}`}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Golden solution toggle */}
              {goldenSolutions?.find(g => g.frq_index === frqIndex) && (
                <div className="mt-3 border-t border-slate-200 dark:border-slate-700 pt-3">
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

              {/* Navigation / action buttons */}
              {showFRQSolution ? (
                <div className="flex items-center gap-2 flex-wrap mt-4">
                  {frqIndex > 0 && (
                    <button
                      onClick={() => {
                        setFrqIndex(frqIndex - 1);
                        setActiveFRQ(allFrqs[frqIndex - 1]);
                        setFrqAnswer("");
                        setShowFRQSolution(false);
                        setShowGoldenSolution(false);
                        setFrqEvalResult(null);
                      }}
                      className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      ← Previous
                    </button>
                  )}
                  {hasNext ? (
                    <button
                      onClick={handleNextFRQ}
                      className="px-6 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-semibold hover:from-amber-600 hover:to-orange-700 transition-all shadow-md shadow-amber-500/20"
                    >
                      Next FRQ →
                    </button>
                  ) : (
                    <>
                      {preloadedContent?.practice_mcq && (
                        <button
                          onClick={() => {
                            setActiveFRQ(null);
                            setShowFRQSolution(false);
                            const allMcqs = (preloadedContent.practice_mcq || []).filter((q: MCQuestion) => !q.raw_text);
                            if (allMcqs.length > 0) {
                              setAssessmentQuestions(shuffleArray([...allMcqs]));
                              setAssessmentIndex(0);
                              setAssessmentScore({ correct: 0, total: 0 });
                              setAssessmentMode(true);
                              setSelectedAnswer(null);
                              setShowMCQExplanation(false);
                            }
                          }}
                          className="px-4 py-2 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 text-sm hover:bg-green-100 transition-colors inline-flex items-center gap-1.5"
                        >
                          <GraduationCap className="w-3.5 h-3.5" />
                          Assessment
                        </button>
                      )}
                    </>
                  )}
                  <button
                    onClick={() => {
                      setActiveFRQ(null);
                      setShowFRQSolution(false);
                      setFrqAnswer("");
                      setFrqIndex(0);
                      setFrqEvalResult(null);
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    ← Study Options
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-400 mt-3 italic">
                  ← Write your solution in the editor panel on the right
                </p>
              )}
            </div>
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
      </div>
      )}

      {/* Right-side Code Editor Panel */}
      {showEditorPanel && (
        <div className="w-1/2 flex-shrink-0 border-l border-slate-200 dark:border-slate-700 flex flex-col bg-white dark:bg-slate-900">

          {/* ── SPLIT VIEW: Code (top) + Evaluation (bottom) ── */}
          {frqEvalResult !== null ? (
            <>
              {/* Top half: student code with error highlights */}
              <div className="flex flex-col flex-shrink-0">
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
                <CodeEditor
                  value={frqEvalCode}
                  onChange={() => {}}
                  language="java"
                  height="calc(45vh - 40px)"
                  readOnly
                  errorLines={evalErrorLines}
                />
              </div>

              {/* Divider */}
              <div className="h-px bg-slate-200 dark:bg-slate-700 flex-shrink-0" />

              {/* Bottom half: progressive reveal evaluation */}
              <div className="flex flex-col flex-1 min-h-0">
                <div
                  ref={evalScrollRef}
                  className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
                >
                  {/* Streaming indicator */}
                  {frqEvalStreaming && (
                    <div className="flex items-center gap-2 text-xs text-blue-500 font-medium">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Analyzing your code...
                    </div>
                  )}

                  {/* Summary card — always visible once available */}
                  {evalSections.summary && (
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800/80 dark:to-slate-800/80 p-3">
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-p:my-0 prose-strong:text-slate-900 dark:prose-strong:text-slate-100">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{evalSections.summary}</ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {/* Issue cards — progressive reveal */}
                  {evalSections.issues.length > 0 && !frqEvalStreaming && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Issues ({revealedIssues} of {evalSections.issues.length} revealed)
                      </div>

                      {evalSections.issues.map((issue, idx) => {
                        const isRevealed = idx < revealedIssues;
                        const isNext = idx === revealedIssues;

                        if (!isRevealed && !isNext) {
                          // Hidden issues — just show a locked placeholder
                          return (
                            <div
                              key={idx}
                              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-xs text-slate-400 flex items-center gap-2"
                            >
                              <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                {idx + 1}
                              </span>
                              <span className="italic">Hidden — reveal previous issues first</span>
                            </div>
                          );
                        }

                        if (isNext && !isRevealed) {
                          // Next issue to reveal — show as clickable
                          return (
                            <button
                              key={idx}
                              onClick={() => setRevealedIssues(idx + 1)}
                              className="w-full rounded-lg border-2 border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/20 px-3 py-3 text-sm text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center gap-2"
                            >
                              <AlertTriangle className="w-4 h-4" />
                              Reveal Issue {idx + 1}: {issue.line ? `Line ${issue.line}` : "Click to see"}
                            </button>
                          );
                        }

                        // Revealed issue
                        return (
                          <div
                            key={idx}
                            className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 overflow-hidden"
                          >
                            <div className="px-3 py-2 bg-red-100/60 dark:bg-red-900/20 flex items-center gap-2 border-b border-red-200 dark:border-red-900/50">
                              <span className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-[10px] font-bold text-white">
                                {idx + 1}
                              </span>
                              <span className="text-sm font-medium text-red-700 dark:text-red-400">
                                {issue.title}
                              </span>
                            </div>
                            <div className="px-3 py-2 prose prose-sm dark:prose-invert max-w-none prose-p:text-slate-600 dark:prose-p:text-slate-300 prose-p:my-1 prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-slate-900 prose-pre:text-sm">
                              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {processLatexContent(issue.content)}
                              </ReactMarkdown>
                            </div>
                          </div>
                        );
                      })}

                      {/* Reveal all button */}
                      {revealedIssues < evalSections.issues.length && revealedIssues > 0 && (
                        <button
                          onClick={() => setRevealedIssues(evalSections.issues.length)}
                          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors underline"
                        >
                          Show all remaining issues
                        </button>
                      )}
                    </div>
                  )}

                  {/* Rubric section — collapsed by default, shown after all issues revealed */}
                  {evalSections.rubric && !frqEvalStreaming && revealedIssues >= evalSections.issues.length && (
                    <details className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <summary className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        📋 Rubric Scoring
                      </summary>
                      <div className="px-3 py-2 prose prose-sm dark:prose-invert max-w-none prose-p:text-slate-600 dark:prose-p:text-slate-300 prose-p:my-1 prose-li:text-slate-600 dark:prose-li:text-slate-300">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{evalSections.rubric}</ReactMarkdown>
                      </div>
                    </details>
                  )}

                  {/* Improvements — shown after rubric */}
                  {evalSections.improvements && !frqEvalStreaming && revealedIssues >= evalSections.issues.length && (
                    <div className="rounded-lg border border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-900/10 p-3">
                      <div className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider mb-1">
                        💡 Key Improvements
                      </div>
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:text-slate-600 dark:prose-p:text-slate-300 prose-p:my-1 prose-li:text-slate-600 dark:prose-li:text-slate-300">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{evalSections.improvements}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer actions */}
                {!frqEvalStreaming && evalSections.summary && (
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
                    <>{frqInputMode === "draw" ? "✏️ Draw Your Answer" : "💻 Write Your Code"}</>
                  ) : (
                    t("Write Your Solution")
                  )}
                </span>
                {!activeFRQ && (
                  <button
                    onClick={() => setShowInlineEditor(false)}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    ✕ {t("Close")}
                  </button>
                )}
              </div>

              {/* Input mode toggle (only for active FRQ) */}
              {activeFRQ && (
                <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-1">
                  <button
                    onClick={() => setFrqInputMode("type")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      frqInputMode === "type"
                        ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                        : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    <Type className="w-3.5 h-3.5" />
                    {t("Type")}
                  </button>
                  <button
                    onClick={() => setFrqInputMode("draw")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      frqInputMode === "draw"
                        ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                        : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    <Pen className="w-3.5 h-3.5" />
                    {t("Draw")}
                  </button>
                  {frqInputMode === "draw" && (
                    <span className="ml-auto text-[10px] text-slate-400">
                      Stylus, touch, or mouse
                    </span>
                  )}
                </div>
              )}

              {/* Editor body */}
              <div className="flex-1 overflow-y-auto p-4">
                {frqInputMode === "draw" && activeFRQ ? (
                  <DrawingCanvas
                    ref={drawingCanvasRef}
                    height="calc(100vh - 380px)"
                  />
                ) : (
                  <>
                    <label className="text-xs text-slate-500 mb-2 block">{t("Write your Java code:")}</label>
                    <CodeEditor
                      value={activeFRQ ? frqAnswer : inlineEditorCode}
                      onChange={activeFRQ ? setFrqAnswer : setInlineEditorCode}
                      language="java"
                      height="calc(100vh - 320px)"
                    />
                  </>
                )}
              </div>

              {/* Editor actions (only for non-FRQ inline editor; FRQ controls are in left panel) */}
              {!activeFRQ && (
              <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-2">
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
              </div>
              )}
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
