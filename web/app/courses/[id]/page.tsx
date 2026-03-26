"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileText,
  GraduationCap,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import ProficiencyBreakdown, { type ProficiencyDimension } from "@/components/ProficiencyBreakdown";

interface TopicDetail {
  id: string;
  topic_number: string;
  title: string;
  description: string | null;
}

interface UnitDetail {
  id: string;
  unit_number: number;
  title: string;
  big_idea: string | null;
  description: string | null;
  topic_count: number;
  topics: TopicDetail[];
}

interface ExamSection {
  name: string;
  count: number;
  minutes: number;
  calculator?: boolean;
}

interface CourseDetail {
  id: string;
  code: string;
  name: string;
  subject_area: string;
  description: string;
  exam_format: { sections: ExamSection[]; reference?: string; note?: string } | null;
  units: UnitDetail[];
}

export default function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useTranslation();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [contentStatus, setContentStatus] = useState<Record<string, boolean>>({});
  const [loadingTopics, setLoadingTopics] = useState<Set<string>>(new Set());
  const [preloadingAll, setPreloadingAll] = useState(false);
  const [topicProgress, setTopicProgress] = useState<Record<string, { proficiency: number; total_questions: number; correct_answers: number }>>({});
  const [courseDimensions, setCourseDimensions] = useState<ProficiencyDimension[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    fetchCourse();
    fetchContentStatus();
    if (user) {
      fetchProgress();
      fetchCourseDimensions();
    }
  }, [id, user]);

  async function fetchCourse() {
    try {
      const res = await fetch(apiUrl(`/api/v1/courses/${id}`));
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setCourse(data);
      // Auto-expand first unit
      if (data.units.length > 0) {
        setExpandedUnits(new Set([data.units[0].id]));
      }
    } catch (err) {
      console.error("Failed to fetch course:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchContentStatus() {
    try {
      const res = await fetch(apiUrl(`/api/v1/courses/${id}/content-status`));
      if (res.ok) {
        const data = await res.json();
        setContentStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch content status:", err);
    }
  }

  async function fetchProgress() {
    try {
      const token = localStorage.getItem("deeptutor_token");
      const res = await fetch(apiUrl(`/api/v1/courses/${id}/progress`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTopicProgress(data);
      }
    } catch (err) {
      console.error("Failed to fetch progress:", err);
    }
  }

  async function fetchCourseDimensions() {
    try {
      const token = localStorage.getItem("deeptutor_token");
      const res = await fetch(apiUrl(`/api/v1/courses/${id}/progress/dimensions`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const dims: ProficiencyDimension[] = [];
        // Show MCQ/FRQ accuracy
        for (const [value, info] of Object.entries(data.question_type || {})) {
          const d = info as { correct: number; total: number; proficiency: number; mastered: boolean };
          dims.push({ label: value === "mcq" ? "MCQ Accuracy" : "FRQ Competency", ...d });
        }
        // Show only the 3 weakest categories (areas needing most work)
        const categories = Object.entries(data.category || {})
          .map(([value, info]) => {
            const d = info as { correct: number; total: number; proficiency: number; mastered: boolean };
            return { label: value, ...d };
          })
          .sort((a, b) => a.proficiency - b.proficiency)
          .slice(0, 3);
        dims.push(...categories);
        setCourseDimensions(dims);
      }
    } catch (err) {
      console.error("Failed to fetch course dimensions:", err);
    }
  }

  async function preloadTopic(topicId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (loadingTopics.has(topicId) || contentStatus[topicId]) return;

    setLoadingTopics((prev) => new Set([...prev, topicId]));
    try {
      const res = await fetch(
        apiUrl(`/api/v1/courses/${id}/topics/${topicId}/preload`),
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }
      );
      if (res.ok) {
        setContentStatus((prev) => ({ ...prev, [topicId]: true }));
      }
    } catch (err) {
      console.error("Failed to preload topic:", err);
    } finally {
      setLoadingTopics((prev) => {
        const next = new Set(prev);
        next.delete(topicId);
        return next;
      });
    }
  }

  async function preloadAll() {
    if (!course || preloadingAll) return;
    setPreloadingAll(true);
    for (const unit of course.units) {
      for (const topic of unit.topics) {
        if (contentStatus[topic.id]) continue;
        setLoadingTopics((prev) => new Set([...prev, topic.id]));
        try {
          const res = await fetch(
            apiUrl(`/api/v1/courses/${id}/topics/${topic.id}/preload`),
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }
          );
          if (res.ok) {
            setContentStatus((prev) => ({ ...prev, [topic.id]: true }));
          }
        } catch (err) {
          console.error(`Failed to preload topic ${topic.id}:`, err);
        } finally {
          setLoadingTopics((prev) => {
            const next = new Set(prev);
            next.delete(topic.id);
            return next;
          });
        }
      }
    }
    setPreloadingAll(false);
  }

  function toggleUnit(unitId: string) {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });
  }

  function expandAll() {
    if (!course) return;
    setExpandedUnits(new Set(course.units.map((u) => u.id)));
  }

  function collapseAll() {
    setExpandedUnits(new Set());
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
        <p>{t("Course not found")}</p>
        <Link href="/courses" className="text-blue-500 hover:underline text-sm">
          {t("Back to catalog")}
        </Link>
      </div>
    );
  }

  const totalTopics = course.units.reduce((sum, u) => sum + u.topic_count, 0);
  const totalExamMinutes = course.exam_format?.sections.reduce(
    (sum, s) => sum + s.minutes,
    0,
  );

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Back link */}
      <Link
        href="/courses"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-blue-500 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("All Courses")}
      </Link>

      {/* Course Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            {course.subject_area.replace("_", " ")}
          </span>
          <span className="text-xs text-slate-400">{course.code.replace(/_/g, " ")}</span>
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
          {course.name}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
          {course.description}
        </p>
      </div>

      {/* Stats Bar */}
      <div className="flex flex-wrap gap-6 mb-8 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-500" />
          <span className="text-sm text-slate-600 dark:text-slate-300">
            <strong>{course.units.length}</strong> {t("units")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-500" />
          <span className="text-sm text-slate-600 dark:text-slate-300">
            <strong>{totalTopics}</strong> {t("topics")}
          </span>
        </div>
        {totalExamMinutes && (
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {t("Exam")}: <strong>{totalExamMinutes}</strong> {t("minutes")}
            </span>
          </div>
        )}
        {Object.keys(topicProgress).length > 0 && (() => {
          const assessed = Object.values(topicProgress).filter(p => p.total_questions > 0);
          const completionPct = totalTopics > 0
            ? Math.round((assessed.length / totalTopics) * 100)
            : 0;
          return (
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {t("Progress")}: <strong>{completionPct}%</strong> ({assessed.length}/{totalTopics} {t("assessed")})
              </span>
            </div>
          );
        })()}
      </div>

      {/* Overall Course Progress Card */}
      {user && Object.keys(topicProgress).length > 0 && (() => {
        const assessed = Object.values(topicProgress).filter(p => p.total_questions > 0);
        const completionPct = totalTopics > 0
          ? Math.round((assessed.length / totalTopics) * 100)
          : 0;
        const totalCorrect = assessed.reduce((s, p) => s + p.correct_answers, 0);
        const totalQs = assessed.reduce((s, p) => s + p.total_questions, 0);
        const accuracy = totalQs > 0 ? Math.round((totalCorrect / totalQs) * 100) : 0;
        const MIN_FOR_MASTERY = 5;
        const mastered = assessed.filter(p => p.proficiency >= 80 && p.total_questions >= MIN_FOR_MASTERY).length;
        const developing = assessed.filter(p => (p.proficiency >= 50 && p.proficiency < 80) || (p.proficiency >= 80 && p.total_questions < MIN_FOR_MASTERY)).length;
        const needsWork = assessed.filter(p => p.proficiency < 50).length;
        return (
          <div className="mb-8 p-5 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border border-blue-100 dark:border-blue-900/50">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                {t("Your Progress")}
              </h2>
              <div className="text-right">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{completionPct}%</span>
                <div className="text-[10px] text-slate-400">{assessed.length}/{totalTopics} topics</div>
              </div>
            </div>
            {/* Completion progress bar */}
            <div className="h-3 bg-white/60 dark:bg-slate-800/60 rounded-full overflow-hidden mb-3">
              <div
                className="h-full rounded-full transition-all duration-500 bg-blue-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span>{totalCorrect}/{totalQs} questions correct ({accuracy}% accuracy)</span>
              <span className="text-emerald-600 dark:text-emerald-400">◉ {mastered} mastered</span>
              <span className="text-amber-600 dark:text-amber-400">◉ {developing} developing</span>
              {needsWork > 0 && <span className="text-red-600 dark:text-red-400">✗ {needsWork} needs work</span>}
              <span className="text-slate-400">{totalTopics - assessed.length} not assessed</span>
            </div>
            {/* Dimensional proficiency breakdown */}
            {courseDimensions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-blue-100 dark:border-blue-900/50">
                <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3">Skill Breakdown — weakest areas</h3>
                <div className={courseDimensions.length >= 3 ? "grid grid-cols-2 gap-4" : ""}>
                  {courseDimensions.length >= 3 && (
                    <ProficiencyBreakdown dimensions={courseDimensions} view="radar" />
                  )}
                  <ProficiencyBreakdown dimensions={courseDimensions} view="bars" compact />
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Exam Format */}
      {course.exam_format && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-blue-500" />
            {t("AP Exam Format")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {course.exam_format.sections.map((section, i) => (
              <div
                key={i}
                className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <div className="font-medium text-slate-800 dark:text-slate-200 text-sm mb-1">
                  {section.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                  <div>
                    {section.count} {t("questions")} &middot; {section.minutes} {t("minutes")}
                  </div>
                  {section.calculator !== undefined && (
                    <div>
                      {section.calculator
                        ? t("Calculator permitted")
                        : t("No calculator")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {course.exam_format.reference && (
            <p className="text-xs text-slate-400 mt-2">
              {t("Reference provided")}: {course.exam_format.reference}
            </p>
          )}
          {course.exam_format.note && (
            <p className="text-xs text-slate-400 mt-2">{course.exam_format.note}</p>
          )}
          {user && (
            <Link
              href={`/courses/${courseId}/exam`}
              className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors"
            >
              <GraduationCap className="w-4 h-4" />
              {t("Take Mock Exam")}
            </Link>
          )}
        </div>
      )}

      {/* Units & Topics */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            {t("Course Content")}
          </h2>
          <div className="flex gap-2 text-xs items-center">
            <button
              onClick={preloadAll}
              disabled={preloadingAll}
              className="inline-flex items-center gap-1 text-purple-500 hover:text-purple-600 transition-colors disabled:opacity-50"
              title="Generate intro content for all topics"
            >
              {preloadingAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {preloadingAll ? t("Loading...") : t("Load All")}
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={expandAll}
              className="text-blue-500 hover:text-blue-600 transition-colors"
            >
              {t("Expand all")}
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={collapseAll}
              className="text-blue-500 hover:text-blue-600 transition-colors"
            >
              {t("Collapse all")}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {course.units.map((unit) => {
            const isExpanded = expandedUnits.has(unit.id);
            return (
              <div
                key={unit.id}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
              >
                {/* Unit Header */}
                <button
                  onClick={() => toggleUnit(unit.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-sm flex-shrink-0">
                    {unit.unit_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                      {t("Unit")} {unit.unit_number}: {unit.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400">
                        {unit.topic_count} {t("topics")}
                      </span>
                      {/* Unit progress bar */}
                      {(() => {
                        const unitAssessed = unit.topics.filter(t => topicProgress[t.id]?.total_questions > 0);
                        if (unitAssessed.length === 0) return null;
                        const unitAvg = Math.round(unitAssessed.reduce((s, t) => s + (topicProgress[t.id]?.proficiency || 0), 0) / unitAssessed.length);
                        return (
                          <div className="flex items-center gap-1.5 flex-1 max-w-[120px]">
                            <div className="h-1.5 flex-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  unitAvg >= 80 ? "bg-emerald-500" : unitAvg >= 50 ? "bg-amber-500" : "bg-red-400"
                                }`}
                                style={{ width: `${unitAvg}%` }}
                              />
                            </div>
                            <span className={`text-[10px] font-semibold ${
                              unitAvg >= 80 ? "text-emerald-600 dark:text-emerald-400" : unitAvg >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                            }`}>{unitAvg}%</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  )}
                </button>

                {/* Topics */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-700">
                    {unit.topics.map((topic, idx) => (
                      <div
                        key={topic.id}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors group ${
                          idx < unit.topics.length - 1
                            ? "border-b border-slate-50 dark:border-slate-700/50"
                            : ""
                        }`}
                      >
                        <span className="text-xs font-mono text-slate-400 w-8 text-right flex-shrink-0">
                          {topic.topic_number}
                        </span>
                        <Link
                          href={`/courses/${id}/study?topicId=${topic.id}&unitId=${unit.id}`}
                          className="text-slate-700 dark:text-slate-300 flex-1 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                        >
                          {topic.title}
                        </Link>
                        {/* Proficiency badge with mini progress bar */}
                        {topicProgress[topic.id] && topicProgress[topic.id].total_questions > 0 && (
                          <div
                            className="flex items-center gap-1.5 flex-shrink-0"
                            title={`${topicProgress[topic.id].correct_answers}/${topicProgress[topic.id].total_questions} correct`}
                          >
                            <div className="w-12 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  topicProgress[topic.id].proficiency >= 80
                                    ? "bg-emerald-500"
                                    : topicProgress[topic.id].proficiency >= 50
                                    ? "bg-amber-500"
                                    : "bg-red-400"
                                }`}
                                style={{ width: `${topicProgress[topic.id].proficiency}%` }}
                              />
                            </div>
                            <span
                              className={`text-[10px] font-semibold w-7 text-right ${
                                topicProgress[topic.id].proficiency >= 80
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : topicProgress[topic.id].proficiency >= 50
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {topicProgress[topic.id].proficiency}%
                            </span>
                          </div>
                        )}
                        <button
                          onClick={(e) => preloadTopic(topic.id, e)}
                          disabled={loadingTopics.has(topic.id) || contentStatus[topic.id]}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${
                            contentStatus[topic.id]
                              ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 cursor-default"
                              : loadingTopics.has(topic.id)
                              ? "text-purple-500 bg-purple-50 dark:bg-purple-900/20"
                              : "text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                          }`}
                          title={
                            contentStatus[topic.id]
                              ? "Content loaded"
                              : loadingTopics.has(topic.id)
                              ? "Loading..."
                              : "Load content for this topic"
                          }
                        >
                          {loadingTopics.has(topic.id) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : contentStatus[topic.id] ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <Link
                          href={`/courses/${id}/study?topicId=${topic.id}&unitId=${unit.id}`}
                          className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        >
                          {t("Study")}
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
