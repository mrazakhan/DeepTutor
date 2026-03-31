"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  BookOpen,
  ChevronRight,
  TrendingUp,
  Calculator,
  Code,
  FlaskConical,
  Star,
  GraduationCap,
  Upload,
  MessageCircle,
  LayoutGrid,
  BarChart3,
  GitBranch,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "react-i18next";

interface CourseListItem {
  id: string;
  code: string;
  name: string;
  subject_area: string;
  description: string;
  unit_count: number;
  topic_count: number;
}

interface CourseProgress {
  [topicId: string]: {
    proficiency: number;
    total_questions: number;
    correct_answers: number;
  };
}

const SUBJECT_ICON: Record<string, typeof BookOpen> = {
  computer_science: Code,
  math: Calculator,
  science: FlaskConical,
};

const SUBJECT_COLOR: Record<string, { text: string; bg: string }> = {
  computer_science: {
    text: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-900/30",
  },
  math: {
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/30",
  },
  science: {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
  },
  custom: {
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/30",
  },
};

/** Star with three states: hollow, half-filled, fully filled */
function CourseStarIcon({ state }: { state: "empty" | "half" | "full" }) {
  if (state === "full") {
    return <Star className="w-4 h-4 fill-amber-400 text-amber-400" />;
  }
  if (state === "half") {
    return (
      <span className="relative inline-flex w-4 h-4">
        {/* Outline star (background) */}
        <Star className="w-4 h-4 text-amber-400 absolute inset-0" />
        {/* Filled star clipped to left half */}
        <Star
          className="w-4 h-4 fill-amber-400 text-amber-400 absolute inset-0"
          style={{ clipPath: "inset(0 50% 0 0)" }}
        />
      </span>
    );
  }
  return <Star className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover/star:text-amber-400 transition-colors" />;
}

export default function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  type ViewMode = "grid" | "rings" | "timeline";
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [courseProgress, setCourseProgress] = useState<Record<string, CourseProgress>>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("deeptutor_view_mode") as ViewMode) || "grid";
    }
    return "grid";
  });

  // Fetch courses, progress, and favorites
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(apiUrl("/api/v1/courses/list"));
        const data: CourseListItem[] = await res.json();
        setCourses(Array.isArray(data) ? data : []);

        if (user) {
          const token = localStorage.getItem("deeptutor_token");
          const headers = { Authorization: `Bearer ${token}` };

          // Fetch favorites
          try {
            const favRes = await fetch(apiUrl("/api/v1/courses/favorites"), { headers });
            if (favRes.ok) {
              const favIds: string[] = await favRes.json();
              setFavorites(new Set(favIds));
            }
          } catch { /* skip */ }

          // Fetch progress for each course
          const progressMap: Record<string, CourseProgress> = {};
          await Promise.all(
            data.map(async (course: CourseListItem) => {
              try {
                const pRes = await fetch(
                  apiUrl(`/api/v1/courses/${course.id}/progress`),
                  { headers }
                );
                if (pRes.ok) {
                  progressMap[course.id] = await pRes.json();
                }
              } catch { /* skip */ }
            })
          );
          setCourseProgress(progressMap);
        }
      } catch (err) {
        console.error("Failed to fetch courses:", err);
      } finally {
        setCoursesLoading(false);
      }
    }
    loadData();
  }, [user]);

  const toggleFavorite = useCallback(async (courseId: string) => {
    if (!user) return;
    const token = localStorage.getItem("deeptutor_token");
    try {
      const res = await fetch(apiUrl(`/api/v1/courses/${courseId}/favorite`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { favorited } = await res.json();
        setFavorites((prev) => {
          const next = new Set(prev);
          if (favorited) next.add(courseId);
          else next.delete(courseId);
          return next;
        });
      }
    } catch { /* skip */ }
  }, [user]);

  // Compute overall progress for a course
  function getCourseStats(courseId: string) {
    const progress = courseProgress[courseId];
    if (!progress || Object.keys(progress).length === 0) {
      return { assessed: 0, proficiency: 0, totalQ: 0, correct: 0, mastered: 0 };
    }
    const entries = Object.values(progress);
    const assessed = entries.length;
    const totalQ = entries.reduce((s, e) => s + e.total_questions, 0);
    const correct = entries.reduce((s, e) => s + e.correct_answers, 0);
    const mastered = entries.filter(
      (e) => e.proficiency >= 80 && e.total_questions >= 5
    ).length;
    const avgProf =
      entries.reduce((s, e) => s + e.proficiency, 0) / entries.length;
    return { assessed, proficiency: Math.round(avgProf), totalQ, correct, mastered };
  }

  // Split courses into favorited and rest
  const favoritedCourses = courses.filter((c) => favorites.has(c.id));
  const otherCourses = courses.filter((c) => !favorites.has(c.id));

  function renderCourseCard(course: CourseListItem) {
    const stats = getCourseStats(course.id);
    const colors = SUBJECT_COLOR[course.subject_area] || SUBJECT_COLOR.science;
    const Icon = SUBJECT_ICON[course.subject_area] || BookOpen;
    const progressPct = course.topic_count > 0
      ? Math.round((stats.assessed / course.topic_count) * 100)
      : 0;
    const isFav = favorites.has(course.id);
    const hasProgress = stats.assessed > 0;
    const starState = isFav ? "full" : hasProgress ? "half" : "empty";

    return (
      <div
        key={course.id}
        className="group relative flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all"
      >
        {/* Star button */}
        {user && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFavorite(course.id);
            }}
            className="group/star absolute top-3 right-3 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors z-10"
            title={isFav ? t("Remove from My Courses") : t("Add to My Courses")}
          >
            <CourseStarIcon state={starState} />
          </button>
        )}

        <Link
          href={`/courses/${course.id}`}
          className="flex items-center gap-4 flex-1 min-w-0"
        >
          {/* Subject icon */}
          <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-5 h-5 ${colors.text}`} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {course.name}
            </h4>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {course.unit_count} {t("units")} · {course.topic_count} {t("topics")}
              </span>
              {stats.assessed > 0 && (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" />
                  {stats.mastered} {t("mastered")}
                </span>
              )}
            </div>

            {/* Progress bar — shows completion (topics assessed / total) */}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                {stats.assessed > 0 ? (
                  <div
                    className="h-full rounded-full transition-all bg-blue-500"
                    style={{ width: `${progressPct}%` }}
                  />
                ) : (
                  <div className="h-full rounded-full bg-slate-200 dark:bg-slate-600" style={{ width: "0%" }} />
                )}
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500 w-8 text-right tabular-nums">
                {stats.assessed > 0 ? `${progressPct}%` : "—"}
              </span>
            </div>
          </div>

          <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors flex-shrink-0" />
        </Link>
      </div>
    );
  }

  // ---- Progress Ring View ----
  function renderProgressRings() {
    const groups: Record<string, { label: string; courses: CourseListItem[] }> = {
      computer_science: { label: "Computer Science", courses: [] },
      math: { label: "Mathematics", courses: [] },
      science: { label: "Science", courses: [] },
      custom: { label: "Custom", courses: [] },
    };
    for (const c of courses) {
      const area = c.code.startsWith("CUSTOM_") ? "custom" : (c.subject_area || "custom");
      (groups[area] || groups.custom).courses.push(c);
    }
    const subjectGradients: Record<string, string> = {
      computer_science: "stroke-violet-500",
      math: "stroke-blue-500",
      science: "stroke-emerald-500",
      custom: "stroke-amber-500",
    };

    return Object.entries(groups)
      .filter(([, g]) => g.courses.length > 0)
      .map(([key, g]) => (
        <div key={key} className="mb-6">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 px-1">
            {g.label}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {g.courses.map((course) => {
              const stats = getCourseStats(course.id);
              const pct = stats.assessed > 0 ? stats.proficiency : 0;
              const r = 36;
              const circ = 2 * Math.PI * r;
              const offset = circ - (pct / 100) * circ;
              const strokeClass = subjectGradients[key] || "stroke-blue-500";

              return (
                <Link
                  key={course.id}
                  href={`/courses/${course.id}`}
                  className="flex flex-col items-center p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all group"
                >
                  <div className="relative w-20 h-20 mb-3">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r={r} fill="none" className="stroke-slate-100 dark:stroke-slate-700" strokeWidth="6" />
                      <circle
                        cx="40" cy="40" r={r} fill="none"
                        className={`${strokeClass} transition-all duration-700`}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        strokeDashoffset={stats.assessed > 0 ? offset : circ}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-slate-700 dark:text-slate-200">
                        {stats.assessed > 0 ? `${pct}%` : "—"}
                      </span>
                    </div>
                  </div>
                  <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200 text-center line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {course.name}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {course.unit_count} units · {course.topic_count} topics
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      ));
  }

  // ---- Timeline / Learning Path View (horizontal) ----
  function renderTimeline() {
    const groups: Record<string, { label: string; icon: typeof Code; courses: CourseListItem[] }> = {
      computer_science: { label: "Computer Science Path", icon: Code, courses: [] },
      math: { label: "Mathematics Path", icon: Calculator, courses: [] },
      science: { label: "Science Path", icon: FlaskConical, courses: [] },
      custom: { label: "Custom Courses", icon: BookOpen, courses: [] },
    };
    for (const c of courses) {
      const area = c.code.startsWith("CUSTOM_") ? "custom" : (c.subject_area || "custom");
      (groups[area] || groups.custom).courses.push(c);
    }
    const lineGradients: Record<string, string> = {
      computer_science: "from-violet-400 to-violet-600",
      math: "from-blue-400 to-blue-600",
      science: "from-emerald-400 to-emerald-600",
      custom: "from-amber-400 to-amber-600",
    };
    const dotColors: Record<string, string> = {
      computer_science: "bg-violet-500 border-violet-300",
      math: "bg-blue-500 border-blue-300",
      science: "bg-emerald-500 border-emerald-300",
      custom: "bg-amber-500 border-amber-300",
    };

    return Object.entries(groups)
      .filter(([, g]) => g.courses.length > 0)
      .map(([key, g]) => {
        const GroupIcon = g.icon;
        const color = SUBJECT_COLOR[key] || SUBJECT_COLOR.custom;
        return (
          <div key={key} className="mb-10">
            {/* Path label */}
            <div className="flex items-center gap-2 mb-6">
              <div className={`p-1.5 rounded-lg ${color.bg}`}>
                <GroupIcon className={`w-4 h-4 ${color.text}`} />
              </div>
              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {g.label}
              </h3>
            </div>

            {/* Horizontal track */}
            <div className="relative">
              {/* Horizontal connecting line */}
              <div className={`absolute top-[22px] left-8 right-8 h-0.5 bg-gradient-to-r ${lineGradients[key] || "from-blue-400 to-blue-600"} opacity-30`} />

              <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
                {g.courses.map((course, idx) => {
                  const stats = getCourseStats(course.id);
                  const pct = stats.assessed > 0 ? stats.proficiency : 0;
                  const dot = dotColors[key] || "bg-blue-500 border-blue-300";
                  const isComplete = pct >= 80;
                  const isStarted = stats.assessed > 0;

                  return (
                    <Link
                      key={course.id}
                      href={`/courses/${course.id}`}
                      className="flex flex-col items-center group flex-shrink-0 w-40"
                    >
                      {/* Node dot */}
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 z-10 shadow-md border-2 mb-3 transition-transform group-hover:scale-110 ${
                        isComplete
                          ? `${dot}`
                          : isStarted
                          ? `bg-white dark:bg-slate-800 border-slate-300`
                          : "bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600"
                      }`}>
                        {isComplete && <TrendingUp className="w-4 h-4 text-white" />}
                        {isStarted && !isComplete && <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{pct}%</span>}
                        {!isStarted && <span className="text-xs text-slate-400 font-medium">{idx + 1}</span>}
                      </div>

                      {/* Course card below node */}
                      <div className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 group-hover:shadow-md group-hover:border-blue-300 dark:group-hover:border-blue-600 transition-all text-center">
                        <h4 className="font-medium text-xs text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight mb-1.5">
                          {course.name}
                        </h4>
                        <span className="text-[10px] text-slate-400">{course.topic_count} topics</span>
                        {isStarted && (
                          <div className="mt-1.5">
                            <div className="w-full h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-blue-500"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        );
      });
  }

  return (
    <div className="h-screen flex flex-col animate-fade-in">
      <div className="flex-1 overflow-y-auto flex flex-col items-center px-6 py-8">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <div className="w-36 h-28 mx-auto mb-4">
            <Image src="/logo.svg" alt="DeepTutor Logo" width={144} height={112} className="object-contain" priority />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-3 tracking-tight">
            {t("Welcome to DeepTutor++")}
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400">
            {t("Personal tutor for the high schoolers")}
          </p>
          {/* View mode toggle */}
          <div className="flex items-center gap-1 mt-4 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            {([
              { mode: "grid" as ViewMode, icon: LayoutGrid, label: "Card Grid" },
              { mode: "rings" as ViewMode, icon: BarChart3, label: "Progress Rings" },
              { mode: "timeline" as ViewMode, icon: GitBranch, label: "Learning Path" },
            ]).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                title={label}
                onClick={() => {
                  setViewMode(mode);
                  localStorage.setItem("deeptutor_view_mode", mode);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === mode
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="w-full max-w-4xl mx-auto space-y-8">
          {coursesLoading ? (
            <div className="text-center py-16 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              <span className="text-sm">{t("Loading courses...")}</span>
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t("No courses available")}</p>
            </div>
          ) : (
            <>
              {/* Counseling Card */}
              <div>
                <Link
                  href="/counseling"
                  className="block p-5 rounded-2xl border border-violet-200 dark:border-violet-800 bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-900/20 dark:to-blue-900/20 hover:shadow-lg transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-lg">
                        {t("College Admissions Counseling")}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {t("Upload your resume, chat with an AI counselor, and get a personalized roadmap for top STEM programs")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="hidden sm:flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400">
                        <Upload className="w-3 h-3" /> Resume
                      </span>
                      <span className="hidden sm:flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                        <MessageCircle className="w-3 h-3" /> Chat
                      </span>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-violet-500 transition-colors" />
                    </div>
                  </div>
                </Link>
              </div>

              {/* View mode switch */}
              {viewMode === "rings" ? (
                renderProgressRings()
              ) : viewMode === "timeline" ? (
                renderTimeline()
              ) : (
                <>
                  {/* My Courses (favorited) */}
                  {favoritedCourses.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-4 px-1">
                        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          {t("My Courses")}
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {favoritedCourses.map(renderCourseCard)}
                      </div>
                    </div>
                  )}

                  {/* Grouped Courses */}
                  {(() => {
                    const groups: Record<string, { label: string; icon: typeof Code; courses: typeof otherCourses }> = {
                      computer_science: { label: "Computer Science", icon: Code, courses: [] },
                      math: { label: "Mathematics", icon: Calculator, courses: [] },
                      science: { label: "Science", icon: FlaskConical, courses: [] },
                      custom: { label: "Custom Courses", icon: BookOpen, courses: [] },
                    };
                    for (const c of otherCourses) {
                      const area = c.code.startsWith("CUSTOM_") ? "custom" : (c.subject_area || "custom");
                      if (groups[area]) {
                        groups[area].courses.push(c);
                      } else {
                        groups.custom.courses.push(c);
                      }
                    }
                    return Object.entries(groups)
                      .filter(([, g]) => g.courses.length > 0)
                      .map(([key, g]) => {
                        const GroupIcon = g.icon;
                        const color = SUBJECT_COLOR[key] || { text: "text-slate-600 dark:text-slate-400", bg: "bg-slate-50 dark:bg-slate-800" };
                        return (
                          <div key={key}>
                            <div className="flex items-center gap-2 mb-4 px-1">
                              <div className={`p-1 rounded-md ${color.bg}`}>
                                <GroupIcon className={`w-4 h-4 ${color.text}`} />
                              </div>
                              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                {t(g.label)} ({g.courses.length})
                              </h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {g.courses.map(renderCourseCard)}
                            </div>
                          </div>
                        );
                      });
                  })()}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
