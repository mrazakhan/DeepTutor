"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Filter,
  Loader2,
  XCircle,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CourseItem {
  id: string;
  name: string;
  code: string;
  subject_area: string;
  unit_count: number;
  topic_count: number;
}

interface TopicProgress {
  proficiency: number;
  total_questions: number;
  correct_answers: number;
  last_assessed_at: string | null;
}

interface TopicDetail {
  id: string;
  topic_number: string;
  title: string;
}

interface UnitDetail {
  id: string;
  unit_number: number;
  title: string;
  topics: TopicDetail[];
}

interface CourseDetail {
  id: string;
  name: string;
  units: UnitDetail[];
}

interface Mistake {
  question_text: string;
  student_answer: string;
  correct_answer: string;
  explanation: string | null;
  question_type: string;
  question_category: string | null;
  created_at: string | null;
}

interface TopicMistakes {
  topic_title: string;
  topic_number: string;
  unit_title: string;
  unit_number: number;
  mistakes: Mistake[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("deeptutor_token")
      : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function proficiencyColor(p: number): string {
  if (p >= 80) return "bg-emerald-500";
  if (p >= 50) return "bg-amber-500";
  return "bg-red-400";
}

function proficiencyTextColor(p: number): string {
  if (p >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (p >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProficiencyBar({ value, label }: { value: number; label?: string }) {
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${proficiencyColor(value)}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className={`text-xs font-semibold w-8 text-right ${proficiencyTextColor(value)}`}>
        {Math.round(value)}%
      </span>
      {label && (
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      )}
    </div>
  );
}

function UnitCard({
  unit,
  progress,
}: {
  unit: UnitDetail;
  progress: Record<string, TopicProgress>;
}) {
  const [expanded, setExpanded] = useState(false);

  const topicsAssessed = unit.topics.filter((t) => progress[t.id]).length;
  const assessed = unit.topics
    .map((t) => progress[t.id]?.proficiency ?? null)
    .filter((p) => p !== null) as number[];
  const avgProficiency =
    assessed.length > 0
      ? Math.round(assessed.reduce((a, b) => a + b, 0) / assessed.length)
      : 0;

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((x) => !x)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Unit {unit.unit_number}
            </span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
              {unit.title}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ProficiencyBar value={avgProficiency} />
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {topicsAssessed}/{unit.topics.length} topics
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="divide-y divide-slate-100 dark:divide-slate-700 bg-slate-50 dark:bg-slate-850">
          {unit.topics.map((topic) => {
            const tp = progress[topic.id];
            return (
              <div
                key={topic.id}
                className="flex items-center gap-3 px-6 py-2.5"
              >
                <span className="text-xs text-slate-400 w-12 flex-shrink-0">
                  {topic.topic_number}
                </span>
                <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 min-w-0 truncate">
                  {topic.title}
                </span>
                {tp ? (
                  <div className="w-40 flex-shrink-0">
                    <ProficiencyBar value={tp.proficiency} />
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic">
                    Not started
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MistakeCard({ mistake }: { mistake: Mistake }) {
  const [showExplanation, setShowExplanation] = useState(false);

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed flex-1">
          {mistake.question_text}
        </p>
        <div className="flex gap-1 flex-shrink-0">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              mistake.question_type === "mcq"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                : "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
            }`}
          >
            {mistake.question_type?.toUpperCase() ?? "Q"}
          </span>
          {mistake.question_category && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">
              {mistake.question_category}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-1.5 mb-1">
            <XCircle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs font-medium text-red-600 dark:text-red-400">
              Your answer
            </span>
          </div>
          <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
            {mistake.student_answer || "—"}
          </p>
        </div>
        <div className="rounded-lg p-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Correct answer
            </span>
          </div>
          <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
            {mistake.correct_answer || "—"}
          </p>
        </div>
      </div>

      {mistake.explanation && (
        <div>
          <button
            onClick={() => setShowExplanation((x) => !x)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showExplanation ? "Hide explanation" : "Show explanation"}
          </button>
          {showExplanation && (
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-750 rounded-lg p-2.5">
              {mistake.explanation}
            </p>
          )}
        </div>
      )}

      {mistake.created_at && (
        <p className="text-xs text-slate-400">{formatDate(mistake.created_at)}</p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const { user } = useAuth();

  // Course list
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");

  // Course structure + progress
  const [courseDetail, setCourseDetail] = useState<CourseDetail | null>(null);
  const [progress, setProgress] = useState<Record<string, TopicProgress>>({});

  // Mistakes
  const [mistakesData, setMistakesData] = useState<Record<string, TopicMistakes>>({});
  const [totalMistakes, setTotalMistakes] = useState(0);
  const [mistakeFilter, setMistakeFilter] = useState<"all" | "mcq" | "frq">("all");
  const [mistakeUnitFilter, setMistakeUnitFilter] = useState<string>("all");
  const [mistakesVisible, setMistakesVisible] = useState(10);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load courses
  useEffect(() => {
    async function loadCourses() {
      try {
        const headers = getAuthHeaders();
        const res = await fetch(apiUrl("/api/v1/courses/list"), { headers });
        if (!res.ok) return;
        const data: CourseItem[] = await res.json();
        setCourses(data);
        if (data.length > 0) setSelectedCourseId(data[0].id);
      } catch {
        // ignore
      }
    }
    loadCourses();
  }, []);

  // Load course data when selection changes
  const loadCourseData = useCallback(async (courseId: string) => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    try {
      const headers = getAuthHeaders();
      const [detailRes, progressRes, mistakesRes] = await Promise.all([
        fetch(apiUrl(`/api/v1/courses/${courseId}`), { headers }),
        fetch(apiUrl(`/api/v1/assessments/${courseId}/progress`), { headers }),
        fetch(apiUrl(`/api/v1/assessments/${courseId}/progress/mistakes`), { headers }),
      ]);

      if (detailRes.ok) {
        const d = await detailRes.json();
        setCourseDetail(d);
      }
      if (progressRes.ok) {
        setProgress(await progressRes.json());
      }
      if (mistakesRes.ok) {
        const m = await mistakesRes.json();
        setMistakesData(m.mistakes ?? {});
        setTotalMistakes(m.total_mistakes ?? 0);
      }
    } catch {
      setError("Failed to load progress data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      setMistakesVisible(10);
      setMistakeFilter("all");
      setMistakeUnitFilter("all");
      loadCourseData(selectedCourseId);
    }
  }, [selectedCourseId, loadCourseData]);

  // Derived stats
  const allTopics = courseDetail?.units.flatMap((u) => u.topics) ?? [];
  const assessedTopics = allTopics.filter((t) => progress[t.id]);
  const overallProficiency =
    assessedTopics.length > 0
      ? Math.round(
          assessedTopics.reduce((s, t) => s + (progress[t.id]?.proficiency ?? 0), 0) /
            assessedTopics.length
        )
      : 0;

  // Filtered mistakes
  const allMistakeEntries = Object.entries(mistakesData);
  const filteredMistakeEntries = allMistakeEntries
    .map(([topicId, tm]) => ({
      topicId,
      tm: {
        ...tm,
        mistakes: tm.mistakes.filter((m) =>
          mistakeFilter === "all" ? true : m.question_type === mistakeFilter
        ),
      },
    }))
    .filter(({ tm }) => {
      if (mistakeUnitFilter !== "all" && String(tm.unit_number) !== mistakeUnitFilter)
        return false;
      return tm.mistakes.length > 0;
    });

  const allFilteredMistakes = filteredMistakeEntries.flatMap(({ tm, topicId }) =>
    tm.mistakes.map((m) => ({ ...m, topicId, topic_title: tm.topic_title, unit_title: tm.unit_title }))
  );

  const visibleMistakes = allFilteredMistakes.slice(0, mistakesVisible);

  const uniqueUnits = Array.from(
    new Map(allMistakeEntries.map(([, tm]) => [String(tm.unit_number), tm.unit_title])).entries()
  ).sort((a, b) => Number(a[0]) - Number(b[0]));

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Please log in to view your progress.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Progress Dashboard
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Track your performance across topics and review mistakes
            </p>
          </div>
        </div>

        {/* Course selector */}
        <div className="flex items-center gap-2">
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {!loading && courseDetail && (
        <div className="flex-1 px-6 py-6 space-y-8">
          {/* Overall summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
              <p className={`text-3xl font-bold ${proficiencyTextColor(overallProficiency)}`}>
                {overallProficiency}%
              </p>
              <p className="text-xs text-slate-500 mt-1">Overall Proficiency</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
              <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                {assessedTopics.length}
                <span className="text-lg font-normal text-slate-400">/{allTopics.length}</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">Topics Studied</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
              <p className="text-3xl font-bold text-red-500">{totalMistakes}</p>
              <p className="text-xs text-slate-500 mt-1">Mistakes to Review</p>
            </div>
          </div>

          {/* Unit / Chapter Scores */}
          <section>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">
              Units &amp; Topics
            </h2>
            <div className="space-y-2">
              {courseDetail.units.length === 0 && (
                <p className="text-sm text-slate-400 italic">No units found for this course.</p>
              )}
              {courseDetail.units.map((unit) => (
                <UnitCard key={unit.id} unit={unit} progress={progress} />
              ))}
            </div>
          </section>

          {/* Mistakes Review */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                Mistakes Review
              </h2>
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={mistakeFilter}
                  onChange={(e) => {
                    setMistakeFilter(e.target.value as "all" | "mcq" | "frq");
                    setMistakesVisible(10);
                  }}
                  className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                >
                  <option value="all">All types</option>
                  <option value="mcq">MCQ only</option>
                  <option value="frq">FRQ only</option>
                </select>
                {uniqueUnits.length > 1 && (
                  <select
                    value={mistakeUnitFilter}
                    onChange={(e) => {
                      setMistakeUnitFilter(e.target.value);
                      setMistakesVisible(10);
                    }}
                    className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                  >
                    <option value="all">All units</option>
                    {uniqueUnits.map(([num, title]) => (
                      <option key={num} value={num}>
                        Unit {num}: {title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {totalMistakes === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-3" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  No mistakes yet — great work!
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Complete some{" "}
                  <Link
                    href={`/courses/${selectedCourseId}/study`}
                    className="text-blue-500 hover:underline"
                  >
                    practice questions
                  </Link>{" "}
                  to see your mistakes here.
                </p>
              </div>
            ) : allFilteredMistakes.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400 italic">
                No mistakes match the current filter.
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {visibleMistakes.map((m, i) => (
                    <div key={i}>
                      {(i === 0 ||
                        visibleMistakes[i - 1].topic_title !== m.topic_title) && (
                        <div className="flex items-center gap-2 mb-2 mt-1">
                          <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                            {m.unit_title} › {m.topic_title}
                          </span>
                        </div>
                      )}
                      <MistakeCard mistake={m} />
                    </div>
                  ))}
                </div>
                {mistakesVisible < allFilteredMistakes.length && (
                  <button
                    onClick={() => setMistakesVisible((v) => v + 10)}
                    className="mt-4 w-full py-2 text-sm text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    Show more ({allFilteredMistakes.length - mistakesVisible} remaining)
                  </button>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {!loading && !courseDetail && !error && courses.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-center text-slate-500">
          <BookOpen className="w-10 h-10 mb-3 text-slate-300" />
          <p className="text-sm">No courses available.</p>
          <Link href="/courses" className="mt-2 text-sm text-blue-500 hover:underline">
            Browse courses
          </Link>
        </div>
      )}
    </div>
  );
}
