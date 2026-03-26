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
  sections: { name: string; type: string; count: number; minutes: number }[];
  question_count: number;
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
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const headers = useCallback(() => {
    const token = localStorage.getItem("deeptutor_token");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [courseRes, examsRes] = await Promise.all([
          fetch(apiUrl(`/api/v1/courses/${courseId}`), { headers: headers() }),
          fetch(apiUrl(`/api/v1/courses/${courseId}/exams`), { headers: headers() }),
        ]);
        if (courseRes.ok) setCourse(await courseRes.json());
        if (examsRes.ok) setExams(await examsRes.json());
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

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(apiUrl(`/api/v1/courses/${courseId}/exams/generate`), {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratingId(data.exam_id);
      } else {
        setGenerating(false);
      }
    } catch {
      setGenerating(false);
    }
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
      <p className="text-slate-500 dark:text-slate-400 mb-8">
        {course?.name} — Full timed exam simulation
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

      {/* Generate New Exam */}
      <div className="mb-8">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-6 py-3 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating exam questions...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Generate New Mock Exam
            </>
          )}
        </button>
        {generating && (
          <p className="text-xs text-slate-400 mt-2">
            This may take a few minutes as fresh questions are being created by AI...
          </p>
        )}
      </div>

      {/* Past Exams */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Trophy className="w-4 h-4" /> Your Exams
        </h2>

        {exams.length === 0 ? (
          <p className="text-slate-400 text-sm">No exams yet. Generate one to get started!</p>
        ) : (
          <div className="space-y-3">
            {exams.map((exam) => (
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
                      Score: <strong>{exam.total_score}%</strong>
                      {exam.mcq_score !== null && <span className="text-xs text-slate-400 ml-2">MCQ: {exam.mcq_score}%</span>}
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
