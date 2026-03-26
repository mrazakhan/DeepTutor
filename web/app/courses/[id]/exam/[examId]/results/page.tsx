"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Trophy,
  BarChart3,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { processLatexContent } from "@/lib/latex";

interface ExamResult {
  id: string;
  status: string;
  sections: { name: string; type: string; count: number; minutes: number }[];
  mcq_score: number | null;
  frq_score: number | null;
  ap_score: number | null;
  exam_type: string;
  total_score: number | null;
  started_at: string | null;
  completed_at: string | null;
  questions: {
    id: string;
    section_index: number;
    question_index: number;
    question_type: string;
    question_data: Record<string, unknown>;
    student_answer: string | null;
    is_correct: boolean | null;
    score: number | null;
    max_score: number;
    evaluation: { feedback?: string; score?: number } | null;
  }[];
}

export default function ExamResultsPage({
  params,
}: {
  params: Promise<{ id: string; examId: string }>;
}) {
  const { id: courseId, examId } = use(params);
  const { user } = useAuth();
  const [result, setResult] = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedQ, setExpandedQ] = useState<Set<string>>(new Set());

  const headers = useCallback(() => {
    const token = localStorage.getItem("deeptutor_token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          apiUrl(`/api/v1/courses/${courseId}/exams/${examId}/results`),
          { headers: headers() }
        );
        if (res.ok) setResult(await res.json());
      } catch {
        /* skip */
      }
      setLoading(false);
    }
    load();
    // Poll for FRQ evaluation completion
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [courseId, examId, headers]);

  function toggleExpand(qId: string) {
    setExpandedQ((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  }

  if (loading || !result) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  const mcqQuestions = result.questions.filter((q) => q.question_type === "mcq");
  const frqQuestions = result.questions.filter((q) => q.question_type === "frq");
  const mcqCorrect = mcqQuestions.filter((q) => q.is_correct).length;
  const frqEvaluated = frqQuestions.filter((q) => q.evaluation).length;
  const frqPending = frqQuestions.length - frqEvaluated;

  // AP score from API (computed server-side using official cutoffs)
  const apScore = result.ap_score || 1;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <Link
        href={`/courses/${courseId}/exam`}
        className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Exams
      </Link>

      {/* Score Summary */}
      <div className="mb-8 p-6 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border border-blue-100 dark:border-blue-900/50">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            Exam Results
          </h1>
          <div className="text-right">
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
              {result.total_score !== null ? `${Math.round(result.total_score)}%` : "—"}
            </div>
            <div className="text-sm text-slate-500 mt-1">
              Estimated AP Score: <strong className="text-lg">{apScore}</strong>/5
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-white/60 dark:bg-slate-800/60">
            <div className="text-sm text-slate-500">Multiple Choice</div>
            <div className="text-xl font-bold text-slate-800 dark:text-slate-200">
              {mcqCorrect}/{mcqQuestions.length}
              {result.mcq_score !== null && (
                <span className="text-sm font-normal text-slate-400 ml-1">
                  ({Math.round(result.mcq_score)}%)
                </span>
              )}
            </div>
          </div>

          {frqQuestions.length > 0 && (
            <div className="p-3 rounded-lg bg-white/60 dark:bg-slate-800/60">
              <div className="text-sm text-slate-500">Free Response</div>
              <div className="text-xl font-bold text-slate-800 dark:text-slate-200">
                {result.frq_score !== null ? (
                  <>
                    {Math.round(result.frq_score)}%
                  </>
                ) : frqPending > 0 ? (
                  <span className="text-sm text-amber-500 flex items-center gap-1">
                    <Loader2 className="w-4 h-4 animate-spin" /> Evaluating {frqPending} FRQ(s)...
                  </span>
                ) : (
                  "—"
                )}
              </div>
            </div>
          )}

          <div className="p-3 rounded-lg bg-white/60 dark:bg-slate-800/60">
            <div className="text-sm text-slate-500">Time</div>
            <div className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1">
              {result.started_at && result.completed_at
                ? (() => {
                    const mins = Math.round(
                      (new Date(result.completed_at).getTime() -
                        new Date(result.started_at).getTime()) /
                        60000
                    );
                    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
                  })()
                : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* MCQ Review */}
      {mcqQuestions.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Multiple Choice Review
          </h2>
          <div className="space-y-2">
            {mcqQuestions.map((q, idx) => {
              const qd = q.question_data as {
                question: string;
                options: Record<string, string>;
                correct: string;
                explanation: string;
              };
              const expanded = expandedQ.has(q.id);

              return (
                <div
                  key={q.id}
                  className={`rounded-lg border overflow-hidden ${
                    q.is_correct
                      ? "border-green-200 dark:border-green-900/50"
                      : "border-red-200 dark:border-red-900/50"
                  }`}
                >
                  <button
                    onClick={() => toggleExpand(q.id)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm ${
                      q.is_correct
                        ? "bg-green-50 dark:bg-green-900/10"
                        : "bg-red-50 dark:bg-red-900/10"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {q.is_correct ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        Q{idx + 1}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 truncate max-w-md">
                        {(qd.question || "").slice(0, 80)}...
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!q.is_correct && (
                        <span className="text-xs text-red-500">
                          Yours: ({q.student_answer}) Correct: ({qd.correct})
                        </span>
                      )}
                      {expanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {expanded && (
                    <div className="px-4 py-3 bg-white dark:bg-slate-800/50">
                      <div className="prose prose-sm dark:prose-invert max-w-none mb-3">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {processLatexContent(qd.question || "")}
                        </ReactMarkdown>
                      </div>
                      <div className="space-y-1 mb-3">
                        {Object.entries(qd.options || {}).map(([letter, text]) => (
                          <div
                            key={letter}
                            className={`px-3 py-1.5 rounded text-sm ${
                              letter === qd.correct
                                ? "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-medium"
                                : letter === q.student_answer && !q.is_correct
                                  ? "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 line-through"
                                  : "text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            ({letter}) {text}
                          </div>
                        ))}
                      </div>
                      {qd.explanation && (
                        <div className="prose prose-sm dark:prose-invert max-w-none border-t border-slate-200 dark:border-slate-700 pt-2 text-slate-500 dark:text-slate-400">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {processLatexContent(qd.explanation)}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FRQ Review */}
      {frqQuestions.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">
            Free Response Review
          </h2>
          <div className="space-y-4">
            {frqQuestions.map((q, idx) => {
              const qd = q.question_data as {
                question: string;
                frq_type?: string;
                sample_solution?: string;
                rubric?: string;
              };

              return (
                <div
                  key={q.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      FRQ {idx + 1}
                      {qd.frq_type && (
                        <span className="text-xs text-purple-500 ml-2">
                          {qd.frq_type}
                        </span>
                      )}
                    </span>
                    <span className="text-sm font-bold">
                      {q.score !== null ? (
                        <span
                          className={
                            q.score >= q.max_score * 0.7
                              ? "text-green-600"
                              : q.score >= q.max_score * 0.4
                                ? "text-amber-600"
                                : "text-red-600"
                          }
                        >
                          {q.score}/{q.max_score}
                        </span>
                      ) : (
                        <span className="text-amber-500 text-xs flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Evaluating...
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="p-4">
                    {/* Question */}
                    <details className="mb-3">
                      <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                        Show question
                      </summary>
                      <div className="prose prose-sm dark:prose-invert max-w-none mt-2">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {processLatexContent(qd.question || "")}
                        </ReactMarkdown>
                      </div>
                    </details>

                    {/* Student answer */}
                    {q.student_answer && (
                      <div className="mb-3">
                        <div className="text-xs text-slate-500 mb-1">Your answer:</div>
                        <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs overflow-x-auto">
                          {q.student_answer}
                        </pre>
                      </div>
                    )}

                    {/* Evaluation */}
                    {q.evaluation?.feedback && (
                      <div className="mb-3">
                        <div className="text-xs text-slate-500 mb-1">Evaluation:</div>
                        <div className="prose prose-sm dark:prose-invert max-w-none bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {processLatexContent(q.evaluation.feedback)}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {/* Sample solution */}
                    {qd.sample_solution && (
                      <details className="mt-3">
                        <summary className="text-xs text-green-600 dark:text-green-400 cursor-pointer hover:underline">
                          Show sample solution
                        </summary>
                        <pre className="bg-slate-900 text-green-300 p-3 rounded-lg text-xs overflow-x-auto mt-2">
                          {qd.sample_solution}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-center mt-8">
        <Link
          href={`/courses/${courseId}/exam`}
          className="px-6 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Back to Exams
        </Link>
        <Link
          href={`/courses/${courseId}/exam`}
          className="px-6 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          Take Another Exam
        </Link>
      </div>
    </div>
  );
}
