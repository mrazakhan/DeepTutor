"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  BookOpen,
  Target,
  Trophy,
  Filter,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { processLatexContent } from "@/lib/latex";

// ---------- types ----------

interface CourseInfo {
  id: string;
  code: string;
  name: string;
  subject_area: string;
  units: {
    id: string;
    unit_number: number;
    title: string;
    topics: { id: string; topic_number: string; title: string }[];
  }[];
}

interface TopicProgress {
  proficiency: number;
  total_questions: number;
  correct_answers: number;
  last_assessed_at: string | null;
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

// ---------- helpers ----------

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("deeptutor_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function profColor(p: number): string {
  if (p >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (p >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

function profBg(p: number): string {
  if (p >= 80) return "bg-emerald-500";
  if (p >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function profBgLight(p: number): string {
  if (p >= 80) return "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800";
  if (p >= 50) return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
  return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
}

// ---------- component ----------

export default function ProgressPage() {
  const { t } = useTranslation();
  const [courses, setCourses] = useState<{ id: string; name: string; code: string }[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(null);
  const [progress, setProgress] = useState<Record<string, TopicProgress>>({});
  const [mistakes, setMistakes] = useState<Record<string, TopicMistakes>>({});
  const [totalMistakes, setTotalMistakes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [expandedMistakeTopics, setExpandedMistakeTopics] = useState<Set<string>>(new Set());
  const [mistakeFilter, setMistakeFilter] = useState<"all" | "mcq" | "frq">("all");

  // Fetch courses on mount
  useEffect(() => {
    async function fetchCourses() {
      try {
        const res = await fetch(apiUrl("/api/v1/courses/list"), { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          const courseList = data.map((c: any) => ({ id: c.id, name: c.name, code: c.code }));
          setCourses(courseList);
          // Auto-select first course
          if (courseList.length > 0) {
            setSelectedCourseId(courseList[0].id);
          }
        }
      } catch (e) {
        console.error("Failed to fetch courses:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchCourses();
  }, []);

  // Fetch data when course changes
  const fetchCourseData = useCallback(async (courseId: string) => {
    setDataLoading(true);
    try {
      const [infoRes, progressRes, mistakesRes] = await Promise.all([
        fetch(apiUrl(`/api/v1/courses/${courseId}`), { headers: getAuthHeaders() }),
        fetch(apiUrl(`/api/v1/courses/${courseId}/progress`), { headers: getAuthHeaders() }),
        fetch(apiUrl(`/api/v1/courses/${courseId}/progress/mistakes`), { headers: getAuthHeaders() }),
      ]);

      if (infoRes.ok) {
        setCourseInfo(await infoRes.json());
      }
      if (progressRes.ok) {
        setProgress(await progressRes.json());
      }
      if (mistakesRes.ok) {
        const mData = await mistakesRes.json();
        setMistakes(mData.mistakes || {});
        setTotalMistakes(mData.total_mistakes || 0);
      }
    } catch (e) {
      console.error("Failed to fetch course data:", e);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      fetchCourseData(selectedCourseId);
    }
  }, [selectedCourseId, fetchCourseData]);

  // ---------- computed stats ----------

  const overallStats = (() => {
    if (!courseInfo) return { totalTopics: 0, assessed: 0, avgProficiency: 0, totalQ: 0, totalCorrect: 0, mastered: 0, needsWork: 0 };

    let totalTopics = 0;
    let assessed = 0;
    let profSum = 0;
    let totalQ = 0;
    let totalCorrect = 0;
    let mastered = 0;
    let needsWork = 0;

    for (const unit of courseInfo.units) {
      for (const topic of unit.topics) {
        totalTopics++;
        const p = progress[topic.id];
        if (p && p.total_questions > 0) {
          assessed++;
          profSum += p.proficiency;
          totalQ += p.total_questions;
          totalCorrect += p.correct_answers;
          if (p.proficiency >= 80 && p.total_questions >= 5) mastered++;
          if (p.proficiency < 50) needsWork++;
        }
      }
    }

    return {
      totalTopics,
      assessed,
      avgProficiency: assessed > 0 ? Math.round(profSum / assessed) : 0,
      totalQ,
      totalCorrect,
      mastered,
      needsWork,
    };
  })();

  // ---------- render ----------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
          <BarChart3 className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">My Progress</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track your performance and review mistakes</p>
        </div>
      </div>

      {/* Course selector */}
      <div className="mb-6">
        <select
          value={selectedCourseId || ""}
          onChange={(e) => setSelectedCourseId(e.target.value)}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {dataLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : courseInfo ? (
        <>
          {/* Overview cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{overallStats.avgProficiency}%</div>
              <div className="text-xs text-slate-500 mt-1">Avg Proficiency</div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{overallStats.mastered}</div>
              <div className="text-xs text-slate-500 mt-1">Topics Mastered</div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">{overallStats.totalCorrect}/{overallStats.totalQ}</div>
              <div className="text-xs text-slate-500 mt-1">Questions Correct</div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
              <div className="text-2xl font-bold text-red-500">{totalMistakes}</div>
              <div className="text-xs text-slate-500 mt-1">Total Mistakes</div>
            </div>
          </div>

          {/* Two-column layout: Units + Mistakes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Unit/Chapter Scores */}
            <div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-500" />
                Unit Scores
              </h2>
              <div className="space-y-3">
                {courseInfo.units.map((unit) => {
                  const unitTopics = unit.topics;
                  const unitProgress = unitTopics.map((t) => progress[t.id]).filter(Boolean);
                  const unitAvg = unitProgress.length > 0
                    ? Math.round(unitProgress.reduce((s, p) => s + p.proficiency, 0) / unitProgress.length)
                    : 0;
                  const assessed = unitProgress.length;
                  const isExpanded = expandedUnits.has(unit.id);

                  return (
                    <div key={unit.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
                      <button
                        onClick={() => {
                          const next = new Set(expandedUnits);
                          isExpanded ? next.delete(unit.id) : next.add(unit.id);
                          setExpandedUnits(next);
                        }}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        <div className="flex-1 text-left">
                          <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            Unit {unit.unit_number}: {unit.title}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {assessed}/{unitTopics.length} topics studied
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${profBg(unitAvg)}`} style={{ width: `${unitAvg}%` }} />
                          </div>
                          <span className={`text-sm font-semibold w-10 text-right ${profColor(unitAvg)}`}>
                            {assessed > 0 ? `${unitAvg}%` : "—"}
                          </span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-slate-100 dark:border-slate-700">
                          {unitTopics.map((topic) => {
                            const tp = progress[topic.id];
                            const prof = tp ? tp.proficiency : -1;
                            return (
                              <div key={topic.id} className="px-4 py-2.5 flex items-center gap-3 border-b border-slate-50 dark:border-slate-700/50 last:border-b-0">
                                <span className="text-xs text-slate-400 w-8 flex-shrink-0">{topic.topic_number}</span>
                                <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">{topic.title}</span>
                                {prof >= 0 ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${profBg(prof)}`} style={{ width: `${prof}%` }} />
                                    </div>
                                    <span className={`text-xs font-medium w-8 text-right ${profColor(prof)}`}>{prof}%</span>
                                    <span className="text-[10px] text-slate-400">{tp!.correct_answers}/{tp!.total_questions}</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-300 dark:text-slate-600">Not started</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Mistakes Review */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Mistakes to Review ({totalMistakes})
                </h2>
                <div className="flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  {(["all", "mcq", "frq"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setMistakeFilter(f)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        mistakeFilter === f
                          ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                          : "text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {Object.keys(mistakes).length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-300" />
                  <p className="text-sm font-medium">No mistakes yet!</p>
                  <p className="text-xs mt-1">Start practicing to see your progress here.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                  {Object.entries(mistakes)
                    .sort(([, a], [, b]) => a.unit_number - b.unit_number || a.topic_number.localeCompare(b.topic_number))
                    .map(([topicId, data]) => {
                      const filtered = data.mistakes.filter(
                        (m) => mistakeFilter === "all" || m.question_type === mistakeFilter
                      );
                      if (filtered.length === 0) return null;
                      const isExpanded = expandedMistakeTopics.has(topicId);

                      return (
                        <div key={topicId} className="rounded-xl border border-red-100 dark:border-red-900/30 bg-white dark:bg-slate-800 overflow-hidden">
                          <button
                            onClick={() => {
                              const next = new Set(expandedMistakeTopics);
                              isExpanded ? next.delete(topicId) : next.add(topicId);
                              setExpandedMistakeTopics(next);
                            }}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-red-400" /> : <ChevronRight className="w-4 h-4 text-red-400" />}
                            <div className="flex-1 text-left">
                              <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                {data.topic_number}: {data.topic_title}
                              </div>
                              <div className="text-xs text-slate-400">
                                Unit {data.unit_number}: {data.unit_title}
                              </div>
                            </div>
                            <span className="text-xs font-semibold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                              {filtered.length} mistake{filtered.length !== 1 ? "s" : ""}
                            </span>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-red-100 dark:border-red-900/30 divide-y divide-red-50 dark:divide-red-900/20">
                              {filtered.map((m, idx) => (
                                <div key={idx} className="px-4 py-3">
                                  {/* Type badge + date */}
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      m.question_type === "mcq"
                                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                        : "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                                    }`}>
                                      {m.question_type.toUpperCase()}
                                    </span>
                                    {m.question_category && (
                                      <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                                        {m.question_category}
                                      </span>
                                    )}
                                    {m.created_at && (
                                      <span className="text-[10px] text-slate-400 ml-auto">
                                        {new Date(m.created_at).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>

                                  {/* Question */}
                                  <div className="text-sm text-slate-700 dark:text-slate-300 mb-2 prose prose-sm dark:prose-invert max-w-none line-clamp-4">
                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                                      {processLatexContent(m.question_text || "")}
                                    </ReactMarkdown>
                                  </div>

                                  {/* Answers */}
                                  <div className="space-y-1.5">
                                    <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30">
                                      <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                      <div className="text-xs text-red-700 dark:text-red-400">
                                        <span className="font-semibold">Your answer:</span> {m.student_answer}
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                      <div className="text-xs text-emerald-700 dark:text-emerald-400">
                                        <span className="font-semibold">Correct answer:</span> {m.correct_answer}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Explanation */}
                                  {m.explanation && (
                                    <details className="mt-2">
                                      <summary className="text-xs text-blue-500 cursor-pointer hover:text-blue-600 font-medium">
                                        Show explanation
                                      </summary>
                                      <div className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                                          {processLatexContent(m.explanation)}
                                        </ReactMarkdown>
                                      </div>
                                    </details>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-20 text-slate-400">
          Select a course to view your progress.
        </div>
      )}
    </div>
  );
}
