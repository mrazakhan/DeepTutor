"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Flag,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Send,
  Pen,
  Type,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { processLatexContent } from "@/lib/latex";

const CodeEditor = dynamic(() => import("@/components/CodeEditor"), { ssr: false });
const DrawingCanvas = dynamic(() => import("@/components/DrawingCanvas"), { ssr: false });

interface ExamQuestion {
  id: string;
  section_index: number;
  question_index: number;
  question_type: "mcq" | "frq";
  question_data: Record<string, unknown>;
  student_answer: string | null;
  flagged: boolean;
  answered: boolean;
}

interface ExamState {
  id: string;
  status: string;
  current_section: number;
  sections: { name: string; type: string; count: number; minutes: number }[];
  time_remaining_seconds: number | null;
  questions: ExamQuestion[];
}

export default function ExamTakingPage({ params }: { params: Promise<{ id: string; examId: string }> }) {
  const { id: courseId, examId } = use(params);
  const { user } = useAuth();
  const router = useRouter();

  const [exam, setExam] = useState<ExamState | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const saveRef = useRef<NodeJS.Timeout | null>(null);
  const [frqInputMode, setFrqInputMode] = useState<"type" | "draw">("type");
  const examCanvasRef = useRef<{ exportImage: () => Promise<string>; clearCanvas: () => void } | null>(null);

  const headers = useCallback(() => {
    const token = localStorage.getItem("deeptutor_token");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }, []);

  // Load exam
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(apiUrl(`/api/v1/courses/${courseId}/exams/${examId}`), { headers: headers() });
        if (!res.ok) { router.push(`/courses/${courseId}/exam`); return; }
        const data: ExamState = await res.json();
        setExam(data);

        // If exam is ready but not started, start it
        if (data.status === "ready") {
          const startRes = await fetch(apiUrl(`/api/v1/courses/${courseId}/exams/${examId}/start`), {
            method: "POST", headers: headers(),
          });
          if (startRes.ok) {
            // Reload
            const res2 = await fetch(apiUrl(`/api/v1/courses/${courseId}/exams/${examId}`), { headers: headers() });
            if (res2.ok) {
              const data2 = await res2.json();
              setExam(data2);
              setTimeLeft(data2.time_remaining_seconds);
            }
          }
        } else if (data.status === "in_progress") {
          setTimeLeft(data.time_remaining_seconds);
        } else if (data.status === "completed" || data.status === "timed_out") {
          router.push(`/courses/${courseId}/exam/${examId}/results`);
          return;
        }

        // Load existing answers into state
        const existingAnswers: Record<string, string> = {};
        const existingFlags = new Set<string>();
        for (const q of data.questions) {
          if (q.student_answer) existingAnswers[q.id] = q.student_answer;
          if (q.flagged) existingFlags.add(q.id);
        }
        setAnswers(existingAnswers);
        setFlags(existingFlags);
      } catch { /* skip */ }
      setLoading(false);
    }
    load();
  }, [courseId, examId, headers, router]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          // Time's up — auto-submit
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timeLeft !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save answer after 2s of inactivity
  function debounceSave(questionId: string, answer: string) {
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => {
      fetch(apiUrl(`/api/v1/courses/${courseId}/exams/${examId}/answer`), {
        method: "POST", headers: headers(),
        body: JSON.stringify({ question_id: questionId, answer }),
      }).catch(() => {});
    }, 2000);
  }

  function handleAnswer(questionId: string, answer: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    debounceSave(questionId, answer);
  }

  // Save canvas drawing as base64 for exam auto-save
  async function handleSaveDrawing(questionId: string) {
    if (!examCanvasRef.current) return;
    const dataUrl = await examCanvasRef.current.exportImage();
    if (dataUrl) {
      const answer = `[DRAWING]${dataUrl}`;
      setAnswers((prev) => ({ ...prev, [questionId]: answer }));
      debounceSave(questionId, answer);
    }
  }

  function handleFlag(questionId: string) {
    setFlags((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
    fetch(apiUrl(`/api/v1/courses/${courseId}/exams/${examId}/flag`), {
      method: "POST", headers: headers(),
      body: JSON.stringify({ question_id: questionId, answer: "" }),
    }).catch(() => {});
  }

  async function handleSubmit() {
    setSubmitting(true);
    setShowSubmitConfirm(false);
    // Save all pending answers first
    const currentSection = exam?.current_section ?? 0;
    const sectionQuestions = exam?.questions.filter((q) => q.section_index === currentSection) || [];
    for (const q of sectionQuestions) {
      if (answers[q.id] !== undefined && answers[q.id] !== q.student_answer) {
        await fetch(apiUrl(`/api/v1/courses/${courseId}/exams/${examId}/answer`), {
          method: "POST", headers: headers(),
          body: JSON.stringify({ question_id: q.id, answer: answers[q.id] }),
        }).catch(() => {});
      }
    }

    // Check if there are more sections
    const sections = exam?.sections || [];
    if (currentSection + 1 < sections.length) {
      // Move to next section
      await fetch(apiUrl(`/api/v1/courses/${courseId}/exams/${examId}/next-section`), {
        method: "POST", headers: headers(),
      });
      // Reload exam state
      const res = await fetch(apiUrl(`/api/v1/courses/${courseId}/exams/${examId}`), { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setExam(data);
        setTimeLeft(data.time_remaining_seconds);
        setCurrentQ(0);
      }
      setSubmitting(false);
    } else {
      // Final submission
      await fetch(apiUrl(`/api/v1/courses/${courseId}/exams/${examId}/submit`), {
        method: "POST", headers: headers(),
      });
      router.push(`/courses/${courseId}/exam/${examId}/results`);
    }
  }

  if (loading || !exam) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  const sections = exam.sections || [];
  const currentSection = sections[exam.current_section] || { name: "Exam", type: "mcq", count: 0, minutes: 0 };
  const sectionQuestions = exam.questions.filter((q) => q.section_index === exam.current_section);
  const currentQuestion = sectionQuestions[currentQ];
  const answeredCount = sectionQuestions.filter((q) => answers[q.id]).length;

  // Format timer
  const timerMinutes = timeLeft !== null ? Math.floor(timeLeft / 60) : 0;
  const timerSeconds = timeLeft !== null ? Math.floor(timeLeft % 60) : 0;
  const timerWarning = timeLeft !== null && timeLeft < 300; // <5 min
  const timerCritical = timeLeft !== null && timeLeft < 60; // <1 min

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {currentSection.name}
          </span>
          <span className="text-xs text-slate-400">
            Q {currentQ + 1} of {sectionQuestions.length}
          </span>
          <span className="text-xs text-slate-400">
            {answeredCount}/{sectionQuestions.length} answered
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Timer */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono font-bold ${
            timerCritical ? "bg-red-100 dark:bg-red-900/30 text-red-600 animate-pulse" :
            timerWarning ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600" :
            "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          }`}>
            <Clock className="w-4 h-4" />
            {String(timerMinutes).padStart(2, "0")}:{String(timerSeconds).padStart(2, "0")}
          </div>

          <button
            onClick={() => setShowSubmitConfirm(true)}
            className="px-4 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-1"
          >
            <Send className="w-4 h-4" />
            {exam.current_section + 1 < sections.length ? "Next Section" : "Submit Exam"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Question Navigator Sidebar */}
        <div className="w-20 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 overflow-y-auto flex-shrink-0">
          <div className="grid grid-cols-4 gap-1">
            {sectionQuestions.map((q, idx) => {
              const isActive = idx === currentQ;
              const isAnswered = !!answers[q.id];
              const isFlagged = flags.has(q.id);

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQ(idx)}
                  className={`w-full aspect-square rounded text-[10px] font-bold relative transition-colors ${
                    isActive
                      ? "bg-blue-500 text-white ring-2 ring-blue-300"
                      : isAnswered
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {idx + 1}
                  {isFlagged && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Question Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentQuestion && (
            <div className="max-w-3xl mx-auto">
              {/* Question header */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Question {currentQ + 1} — {currentQuestion.question_type.toUpperCase()}
                </span>
                <button
                  onClick={() => handleFlag(currentQuestion.id)}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                    flags.has(currentQuestion.id)
                      ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600"
                      : "text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  {flags.has(currentQuestion.id) ? "Flagged" : "Flag"}
                </button>
              </div>

              {/* MCQ Question */}
              {currentQuestion.question_type === "mcq" && (() => {
                const qd = currentQuestion.question_data as { question: string; options: Record<string, string> };
                const selected = answers[currentQuestion.id] || null;

                return (
                  <div>
                    <div className="prose prose-sm dark:prose-invert max-w-none mb-6">
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {processLatexContent(qd.question || "")}
                      </ReactMarkdown>
                    </div>

                    <div className="space-y-2">
                      {Object.entries(qd.options || {}).map(([letter, text]) => (
                        <button
                          key={letter}
                          onClick={() => handleAnswer(currentQuestion.id, letter)}
                          className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                            selected === letter
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
                            {processLatexContent(text || "")}
                          </ReactMarkdown>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* FRQ Question */}
              {currentQuestion.question_type === "frq" && (() => {
                const qd = currentQuestion.question_data as { question: string; frq_type?: string };
                const code = answers[currentQuestion.id] || "";

                return (
                  <div>
                    {qd.frq_type && (
                      <span className="text-xs font-medium text-purple-500 bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded mb-3 inline-block">
                        {qd.frq_type}
                      </span>
                    )}
                    <div className="prose prose-sm dark:prose-invert max-w-none mb-6">
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {processLatexContent(qd.question || "")}
                      </ReactMarkdown>
                    </div>

                    {/* Type / Draw toggle */}
                    <div className="flex items-center gap-1 mb-3">
                      <button
                        onClick={() => setFrqInputMode("type")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          frqInputMode === "type"
                            ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                            : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                        }`}
                      >
                        <Type className="w-3.5 h-3.5" />
                        Type
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
                        Draw
                      </button>
                      {frqInputMode === "draw" && (
                        <span className="ml-auto text-[10px] text-slate-400">Stylus, touch, or mouse</span>
                      )}
                    </div>

                    <div className="mb-2">
                      {frqInputMode === "draw" ? (
                        <DrawingCanvas
                          ref={examCanvasRef}
                          height="350px"
                        />
                      ) : (
                        <>
                          <label className="text-xs text-slate-500 mb-2 block">Write your Java code:</label>
                          <CodeEditor
                            value={code}
                            onChange={(v) => handleAnswer(currentQuestion.id, v)}
                            language="java"
                            height="350px"
                          />
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
                  disabled={currentQ === 0}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Previous
                </button>
                <button
                  onClick={() => setCurrentQ(Math.min(sectionQuestions.length - 1, currentQ + 1))}
                  disabled={currentQ === sectionQuestions.length - 1}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                {exam.current_section + 1 < sections.length ? "Finish Section?" : "Submit Exam?"}
              </h3>
            </div>
            <p className="text-sm text-slate-500 mb-2">
              {answeredCount} of {sectionQuestions.length} questions answered.
              {sectionQuestions.length - answeredCount > 0 && (
                <span className="text-amber-600 font-medium">
                  {" "}{sectionQuestions.length - answeredCount} unanswered!
                </span>
              )}
            </p>
            {flags.size > 0 && (
              <p className="text-xs text-amber-600 mb-3">{flags.size} question(s) flagged for review.</p>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {submitting ? "Submitting..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
