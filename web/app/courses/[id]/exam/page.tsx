"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  FileText,
  Loader2,
  Play,
  RotateCcw,
  Trophy,
  BookOpen,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface ExamSummary {
  id: string;
  status: string;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  time_limit_minutes: number;
  total_score: number | null;
  mcq_score: number | null;
  frq_score: number | null;
  ap_score: number | null;
  exam_type: string;
  sections: { name: string; type: string; count: number; minutes: number }[];
  question_count: number;
}

interface FinalStatus {
  available: boolean;
  template_status?: string;
  student_attempt?: {
    exam_id: string;
    status: string;
    total_score: number | null;
    ap_score: number | null;
  } | null;
}

interface CourseInfo {
  id: string;
  name: string;
  code: string;
  exam_format: {
    sections: { name: string; count: number; minutes: number; calculator?: boolean }[];
    frq_types?: string[];
    weight?: string;
    reference?: string;
  } | null;
}

export default function ExamLauncherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [finalStatus, setFinalStatus] = useState<FinalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingFinal, setGeneratingFinal] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const isAdmin = user?.role === "admin";

  const headers = useCallback(() => {
    const token = localStorage.getItem("deeptutor_token");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [courseRes, examsRes, finalRes] = await Promise.all([
          fetch(apiUrl(`/api/v1/courses/${courseId}`), { headers: headers() }),
          fetch(apiUrl(`/api/v1/courses/${courseId}/exams`), { headers: headers() }),
          fetch(apiUrl(`/api/v1/courses/${courseId}/exams/final-status`), { headers: headers() }),
        ]);
        if (courseRes.ok) setCourse(await courseRes.json());
        if (examsRes.ok) setExams(await examsRes.json());
        if (finalRes.ok) setFinalStatus(await finalRes.json());
      } catch { /* skip */ }
      setLoading(false);
    }
    load();
  }, [courseId, headers]);

  // Poll for generating exam status
  useEffect(() => {
    if (!generatingId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(apiUrl(`/api/v1/courses/${courseId}/exams/${generatingId}`), { headers: headers() });
        if (res.ok) {
          const data = await res.json();
          if (data.status === "ready") {
            setGenerating(false);
            setGeneratingId(null);
            // Refresh exam list
            const examsRes = await fetch(apiUrl(`/api/v1/courses/${courseId}/exams`), { headers: headers() });
            if (examsRes.ok) setExams(await examsRes.json());
          }
        }
      } catch { /* skip */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [generatingId, courseId, headers]);

  async function handleGenerate(examType: "practice" | "final" = "practice") {
    if (examType === "final") setGeneratingFinal(true);
    else setGenerating(true);
    try {
      const res = await fetch(apiUrl(`/api/v1/courses/${courseId}/exams/generate`), {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ exam_type: examType }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratingId(data.exam_id);
      } else {
        setGenerating(false);
        setGeneratingFinal(false);
      }
    } catch {
      setGenerating(false);
      setGeneratingFinal(false);
    }
  }

  async function handleStartFinal() {
    try {
      const res = await fetch(apiUrl(`/api/v1/courses/${courseId}/exams/start-final`), {
        method: "POST",
        headers: headers(),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/courses/${courseId}/exam/${data.exam_id}`);
      }
    } catch { /* skip */ }
  }

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  }

  function formatMinutes(mins: number) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  const examFormat = course?.exam_format;
  const totalMinutes = examFormat?.sections?.reduce((s, sec) => s + sec.minutes, 0) || 0;
  const totalQuestions = examFormat?.sections?.reduce((s, sec) => s + sec.count, 0) || 0;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <Link href={`/courses/${courseId}`} className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to {course?.name}
      </Link>

      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
        Mock AP Exam
      </h1>
      <p className="text-slate-500 dark:text-slate-400 mb-1">
        {course?.name} — Full timed exam simulation
      </p>
      <p className="text-xs text-slate-400 mb-8">
        Practice exams with AI-generated questions matching official AP format. Scores are estimates — not official College Board scores.
      </p>

      {/* Exam Format Summary */}
      {examFormat && (
        <div className="mb-8 p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> Exam Format
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {examFormat.sections.map((s, i) => (
              <div key={i} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 text-center">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{s.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {s.count} questions · {s.minutes} min
                </div>
                {s.calculator && (
                  <div className="text-[10px] text-green-600 dark:text-green-400 mt-0.5">Calculator OK</div>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-6 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Total: {formatMinutes(totalMinutes)}</span>
            <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {totalQuestions} questions</span>
            {examFormat.frq_types && examFormat.frq_types.length > 0 && (
              <span>FRQ types: {examFormat.frq_types.join(", ")}</span>
            )}
          </div>
        </div>
      )}

      {/* ── Final Exam Section ── */}
      <div className="mb-8 p-5 rounded-xl border-2 border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20">
        <h2 className="text-sm font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4" /> Final Exam
        </h2>

        {finalStatus?.student_attempt?.status === "completed" ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Completed — Score: <strong>{Math.round(finalStatus.student_attempt.total_score || 0)}%</strong>
                {finalStatus.student_attempt.ap_score && (
                  <span className="ml-2">Est. AP: <strong>{finalStatus.student_attempt.ap_score}/5</strong></span>
                )}
              </p>
            </div>
            <Link
              href={`/courses/${courseId}/exam/${finalStatus.student_attempt.exam_id}/results`}
              className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700"
            >
              View Results
            </Link>
          </div>
        ) : finalStatus?.student_attempt ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-amber-600">Final exam in progress</p>
            <Link
              href={`/courses/${courseId}/exam/${finalStatus.student_attempt.exam_id}`}
              className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600"
            >
              <RotateCcw className="w-4 h-4 inline mr-1" /> Resume
            </Link>
          </div>
        ) : finalStatus?.available ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600 dark:text-slate-400">Final exam is available. You have one attempt.</p>
            <button
              onClick={handleStartFinal}
              className="px-5 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 flex items-center gap-1"
            >
              <Play className="w-4 h-4" /> Start Final Exam
            </button>
          </div>
        ) : isAdmin ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">No final exam created yet.</p>
            <button
              onClick={() => handleGenerate("final")}
              disabled={generatingFinal}
              className="px-5 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
            >
              {generatingFinal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {generatingFinal ? "Generating..." : "Generate Final Exam"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Final exam not yet available. Your instructor will publish it when ready.</p>
        )}
      </div>

      {/* ── Practice Exams Section ── */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4" /> Practice Exams
        </h2>
        <button
          onClick={() => handleGenerate("practice")}
          disabled={generating}
          className="px-6 py-3 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 mb-4"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating practice exam...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Generate Practice Exam
            </>
          )}
        </button>
        {generating && (
          <p className="text-xs text-slate-400 mb-4">
            This may take a few minutes as fresh questions are being created by AI...
          </p>
        )}

        {exams.filter((e) => e.exam_type !== "final").length === 0 ? (
          <p className="text-slate-400 text-sm">No practice exams yet.</p>
        ) : (
          <div className="space-y-3">
            {exams.filter((e) => e.exam_type !== "final").map((exam) => (
              <div
                key={exam.id}
                className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      exam.status === "completed" ? "bg-green-100 dark:bg-green-900/30 text-green-600" :
                      exam.status === "in_progress" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600" :
                      exam.status === "ready" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600" :
                      exam.status === "generating" ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600" :
                      "bg-slate-100 dark:bg-slate-700 text-slate-500"
                    }`}>
                      {exam.status}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {formatDate(exam.created_at)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {exam.question_count} questions · {formatMinutes(exam.time_limit_minutes)}
                    </span>
                  </div>
                  {exam.total_score !== null && (
                    <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                      Score: <strong>{Math.round(exam.total_score)}%</strong>
                      {exam.ap_score && <span className="ml-2 text-xs font-bold text-purple-600">Est. AP: {exam.ap_score}/5</span>}
                      {exam.mcq_score !== null && <span className="text-xs text-slate-400 ml-2">MCQ: {Math.round(exam.mcq_score)}%</span>}
                      {exam.frq_score !== null && <span className="text-xs text-slate-400 ml-2">FRQ: {exam.frq_score}%</span>}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {exam.status === "ready" && (
                    <Link
                      href={`/courses/${courseId}/exam/${exam.id}`}
                      className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-1"
                    >
                      <Play className="w-4 h-4" /> Start
                    </Link>
                  )}
                  {exam.status === "in_progress" && (
                    <Link
                      href={`/courses/${courseId}/exam/${exam.id}`}
                      className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors flex items-center gap-1"
                    >
                      <RotateCcw className="w-4 h-4" /> Resume
                    </Link>
                  )}
                  {(exam.status === "completed" || exam.status === "timed_out") && (
                    <Link
                      href={`/courses/${courseId}/exam/${exam.id}/results`}
                      className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-1"
                    >
                      <Trophy className="w-4 h-4" /> Results
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
