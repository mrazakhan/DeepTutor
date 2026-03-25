"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Calculator,
  Code,
  FlaskConical,
  ChevronRight,
  Search,
  Star,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface CourseItem {
  id: string;
  code: string;
  name: string;
  subject_area: string;
  description: string;
  unit_count: number;
  topic_count: number;
}

const SUBJECT_CONFIG: Record<
  string,
  { icon: typeof BookOpen; color: string; bg: string; label: string }
> = {
  computer_science: {
    icon: Code,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-900/30",
    label: "Computer Science",
  },
  math: {
    icon: Calculator,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/30",
    label: "Mathematics",
  },
  science: {
    icon: FlaskConical,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
    label: "Science",
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
        <Star className="w-4 h-4 text-amber-400 absolute inset-0" />
        <Star
          className="w-4 h-4 fill-amber-400 text-amber-400 absolute inset-0"
          style={{ clipPath: "inset(0 50% 0 0)" }}
        />
      </span>
    );
  }
  return <Star className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover/star:text-amber-400 transition-colors" />;
}

export default function CourseCatalogPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [coursesWithProgress, setCoursesWithProgress] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchCourses();
  }, []);

  // Fetch favorites and progress when user is available
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("deeptutor_token");
    const headers = { Authorization: `Bearer ${token}` };

    // Fetch favorites
    fetch(apiUrl("/api/v1/courses/favorites"), { headers })
      .then((res) => (res.ok ? res.json() : []))
      .then((ids: string[]) => setFavorites(new Set(ids)))
      .catch(() => {});

    // Fetch progress for each course to detect which ones have been explored
    if (courses.length > 0) {
      Promise.all(
        courses.map(async (course) => {
          try {
            const res = await fetch(apiUrl(`/api/v1/courses/${course.id}/progress`), { headers });
            if (res.ok) {
              const data = await res.json();
              if (Object.keys(data).length > 0) return course.id;
            }
          } catch { /* skip */ }
          return null;
        })
      ).then((ids) => {
        setCoursesWithProgress(new Set(ids.filter(Boolean) as string[]));
      });
    }
  }, [user, courses]);

  async function fetchCourses() {
    try {
      const res = await fetch(apiUrl("/api/v1/courses/list"));
      const data = await res.json();
      setCourses(data);
    } catch (err) {
      console.error("Failed to fetch courses:", err);
    } finally {
      setLoading(false);
    }
  }

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

  const filtered = courses.filter((c) => {
    if (filter && c.subject_area !== filter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group by subject
  const grouped = filtered.reduce(
    (acc, c) => {
      if (!acc[c.subject_area]) acc[c.subject_area] = [];
      acc[c.subject_area].push(c);
      return acc;
    },
    {} as Record<string, CourseItem[]>,
  );

  const subjectOrder = ["computer_science", "math", "science"];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          {t("AP Course Catalog")}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-lg">
          {t("13 Advanced Placement courses in Computer Science, Mathematics, and Science")}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Search courses...")}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setFilter(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === null
                ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {t("All")} ({courses.length})
          </button>
          {subjectOrder.map((area) => {
            const cfg = SUBJECT_CONFIG[area];
            const count = courses.filter((c) => c.subject_area === area).length;
            if (count === 0) return null;
            return (
              <button
                key={area}
                onClick={() => setFilter(filter === area ? null : area)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === area
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-20 text-slate-400">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          {t("Loading courses...")}
        </div>
      )}

      {/* Course Grid by Subject */}
      {!loading &&
        subjectOrder.map((area) => {
          const items = grouped[area];
          if (!items || items.length === 0) return null;
          const cfg = SUBJECT_CONFIG[area];
          const Icon = cfg.icon;

          return (
            <div key={area} className="mb-10">
              <div className="flex items-center gap-2 mb-4">
                <div className={`p-1.5 rounded-md ${cfg.bg}`}>
                  <Icon className={`w-5 h-5 ${cfg.color}`} />
                </div>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                  {cfg.label}
                </h2>
                <span className="text-sm text-slate-400 ml-1">
                  ({items.length} {items.length === 1 ? "course" : "courses"})
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((course) => {
                  const isFav = favorites.has(course.id);
                  const hasProgress = coursesWithProgress.has(course.id);
                  const starState = isFav ? "full" : hasProgress ? "half" : "empty";

                  return (
                    <div
                      key={course.id}
                      className="group relative block p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all"
                    >
                      {/* Star button */}
                      {user && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleFavorite(course.id);
                          }}
                          className="group/star absolute top-4 right-4 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors z-10"
                          title={isFav ? t("Remove from My Courses") : t("Add to My Courses")}
                        >
                          <CourseStarIcon state={starState} />
                        </button>
                      )}

                      <Link
                        href={`/courses/${course.id}`}
                        className="block"
                      >
                        <div className="flex items-start justify-between mb-3 pr-6">
                          <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight">
                            {course.name}
                          </h3>
                          <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-1" />
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">
                          {course.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5" />
                            {course.unit_count} {t("units")}
                          </span>
                          <span>
                            {course.topic_count} {t("topics")}
                          </span>
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>{t("No courses match your search.")}</p>
        </div>
      )}
    </div>
  );
}
