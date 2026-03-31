"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Calculator,
  Code,
  FlaskConical,
  ChevronRight,
  ChevronDown,
  Search,
  Star,
  Plus,
  Upload,
  X,
  Check,
  Loader2,
  Trash2,
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

interface ParsedTopic {
  number: string;
  title: string;
}

interface ParsedUnit {
  title: string;
  topics: ParsedTopic[];
}

interface ParsedCourse {
  name: string;
  subject_area: string;
  description: string;
  units: ParsedUnit[];
}

interface CreatedCourse {
  id: string;
  name: string;
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

const SUBJECT_OPTIONS = [
  { value: "computer_science", label: "Computer Science" },
  { value: "math", label: "Mathematics" },
  { value: "science", label: "Science" },
  { value: "history", label: "History" },
  { value: "english", label: "English" },
  { value: "art", label: "Art" },
  { value: "other", label: "Other" },
];

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

/** Step indicator for the wizard */
function WizardSteps({ current }: { current: number }) {
  const steps = ["Upload", "Review", "Done"];
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === current;
        const isDone = stepNum < current;
        return (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`w-8 h-px ${
                  isDone ? "bg-blue-500" : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  isDone
                    ? "bg-blue-500 text-white"
                    : isActive
                      ? "bg-blue-500 text-white ring-4 ring-blue-500/20"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500"
                }`}
              >
                {isDone ? <Check className="w-3.5 h-3.5" /> : stepNum}
              </div>
              <span
                className={`text-sm font-medium ${
                  isActive
                    ? "text-slate-900 dark:text-slate-100"
                    : isDone
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CourseCatalogPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [coursesWithProgress, setCoursesWithProgress] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardParsing, setWizardParsing] = useState(false);
  const [wizardCreating, setWizardCreating] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [wizardFile, setWizardFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsedCourse, setParsedCourse] = useState<ParsedCourse | null>(null);
  const [expandedUnits, setExpandedUnits] = useState<Set<number>>(new Set());
  const [createdCourse, setCreatedCourse] = useState<CreatedCourse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // ─── Wizard helpers ───

  function openWizard() {
    setWizardOpen(true);
    setWizardStep(1);
    setWizardParsing(false);
    setWizardCreating(false);
    setWizardError(null);
    setWizardFile(null);
    setParsedCourse(null);
    setExpandedUnits(new Set());
    setCreatedCourse(null);
    setDragOver(false);
  }

  function closeWizard() {
    setWizardOpen(false);
  }

  function handleFileSelect(file: File) {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!allowed.includes(file.type) && !["pdf", "docx", "txt"].includes(ext || "")) {
      setWizardError(t("Please upload a PDF, DOCX, or TXT file."));
      return;
    }
    setWizardFile(file);
    setWizardError(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }

  async function parseSyllabus() {
    if (!wizardFile) return;
    setWizardParsing(true);
    setWizardError(null);

    try {
      const headers: Record<string, string> = {};
      const token = localStorage.getItem("deeptutor_token");
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const formData = new FormData();
      formData.append("file", wizardFile);

      const res = await fetch(apiUrl("/api/v1/courses/parse-syllabus"), {
        method: "POST",
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(errBody || `Server error ${res.status}`);
      }

      const data: ParsedCourse = await res.json();
      setParsedCourse(data);
      // Expand all units by default
      setExpandedUnits(new Set(data.units.map((_, i) => i)));
      setWizardStep(2);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to parse syllabus";
      setWizardError(message);
    } finally {
      setWizardParsing(false);
    }
  }

  function updateCourseName(name: string) {
    if (!parsedCourse) return;
    setParsedCourse({ ...parsedCourse, name });
  }

  function updateCourseSubject(subject_area: string) {
    if (!parsedCourse) return;
    setParsedCourse({ ...parsedCourse, subject_area });
  }

  function updateCourseDescription(description: string) {
    if (!parsedCourse) return;
    setParsedCourse({ ...parsedCourse, description });
  }

  function updateUnitTitle(unitIndex: number, title: string) {
    if (!parsedCourse) return;
    const units = [...parsedCourse.units];
    units[unitIndex] = { ...units[unitIndex], title };
    setParsedCourse({ ...parsedCourse, units });
  }

  function updateTopicNumber(unitIndex: number, topicIndex: number, number: string) {
    if (!parsedCourse) return;
    const units = [...parsedCourse.units];
    const topics = [...units[unitIndex].topics];
    topics[topicIndex] = { ...topics[topicIndex], number };
    units[unitIndex] = { ...units[unitIndex], topics };
    setParsedCourse({ ...parsedCourse, units });
  }

  function updateTopicTitle(unitIndex: number, topicIndex: number, title: string) {
    if (!parsedCourse) return;
    const units = [...parsedCourse.units];
    const topics = [...units[unitIndex].topics];
    topics[topicIndex] = { ...topics[topicIndex], title };
    units[unitIndex] = { ...units[unitIndex], topics };
    setParsedCourse({ ...parsedCourse, units });
  }

  function deleteTopic(unitIndex: number, topicIndex: number) {
    if (!parsedCourse) return;
    const units = [...parsedCourse.units];
    const topics = [...units[unitIndex].topics];
    topics.splice(topicIndex, 1);
    units[unitIndex] = { ...units[unitIndex], topics };
    setParsedCourse({ ...parsedCourse, units });
  }

  function toggleUnit(index: number) {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function createCourse() {
    if (!parsedCourse) return;
    setWizardCreating(true);
    setWizardError(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const token = localStorage.getItem("deeptutor_token");
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(apiUrl("/api/v1/courses/create-custom"), {
        method: "POST",
        headers,
        body: JSON.stringify(parsedCourse),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(errBody || `Server error ${res.status}`);
      }

      const data: CreatedCourse = await res.json();
      setCreatedCourse(data);
      setWizardStep(3);
      // Refresh course list
      fetchCourses();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create course";
      setWizardError(message);
    } finally {
      setWizardCreating(false);
    }
  }

  const totalTopics = parsedCourse
    ? parsedCourse.units.reduce((sum, u) => sum + u.topics.length, 0)
    : 0;

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
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            {t("AP Course Catalog")}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg">
            {t("13 Advanced Placement courses in Computer Science, Mathematics, and Science")}
          </p>
        </div>
        <button
          onClick={openWizard}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-sm hover:shadow transition-all flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t("Add Custom Course")}
        </button>
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

      {/* ─── Add Custom Course Wizard Modal ─── */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeWizard}
          />

          {/* Modal */}
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 shadow-2xl">
            {/* Close button */}
            <button
              onClick={closeWizard}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 text-center mb-2">
                {t("Add Custom Course")}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
                {t("Upload a syllabus to automatically create a course structure")}
              </p>

              <WizardSteps current={wizardStep} />

              {/* Error banner */}
              {wizardError && (
                <div className="mb-6 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                  {wizardError}
                </div>
              )}

              {/* ─── Step 1: Upload ─── */}
              {wizardStep === 1 && (
                <div>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
                      dragOver
                        ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                        : wizardFile
                          ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10"
                          : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                      }}
                    />
                    {wizardFile ? (
                      <div>
                        <Check className="w-10 h-10 text-green-500 mx-auto mb-3" />
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {wizardFile.name}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {(wizardFile.size / 1024).toFixed(1)} KB
                        </p>
                        <p className="text-xs text-blue-500 mt-2">
                          {t("Click to change file")}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          {t("Drop your syllabus here or click to browse")}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {t("Supports PDF, DOCX, and TXT files")}
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={parseSyllabus}
                    disabled={!wizardFile || wizardParsing}
                    className="mt-6 w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {wizardParsing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("Parsing syllabus...")}
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        {t("Parse Syllabus")}
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* ─── Step 2: Review & Edit ─── */}
              {wizardStep === 2 && parsedCourse && (
                <div>
                  {/* Course metadata */}
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {t("Course Name")}
                      </label>
                      <input
                        type="text"
                        value={parsedCourse.name}
                        onChange={(e) => updateCourseName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {t("Subject Area")}
                      </label>
                      <select
                        value={parsedCourse.subject_area}
                        onChange={(e) => updateCourseSubject(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                      >
                        {SUBJECT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {t(opt.label)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {t("Description")}
                      </label>
                      <textarea
                        value={parsedCourse.description}
                        onChange={(e) => updateCourseDescription(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex gap-4 mb-4 text-sm text-slate-500 dark:text-slate-400">
                    <span>{parsedCourse.units.length} {t("units")}</span>
                    <span>{totalTopics} {t("topics")}</span>
                  </div>

                  {/* Unit tree */}
                  <div className="space-y-2 mb-6 max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                    {parsedCourse.units.map((unit, ui) => (
                      <div key={ui} className="rounded-lg bg-slate-50 dark:bg-slate-800/50">
                        <button
                          onClick={() => toggleUnit(ui)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left"
                        >
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${
                              expandedUnits.has(ui) ? "" : "-rotate-90"
                            }`}
                          />
                          <input
                            type="text"
                            value={unit.title}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateUnitTitle(ui, e.target.value)}
                            className="flex-1 bg-transparent text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1"
                          />
                          <span className="text-xs text-slate-400 flex-shrink-0">
                            {unit.topics.length} {t("topics")}
                          </span>
                        </button>

                        {expandedUnits.has(ui) && unit.topics.length > 0 && (
                          <div className="pb-2 px-3 pl-9 space-y-1">
                            {unit.topics.map((topic, ti) => (
                              <div
                                key={ti}
                                className="flex items-center gap-2 group/topic"
                              >
                                <input
                                  type="text"
                                  value={topic.number}
                                  onChange={(e) =>
                                    updateTopicNumber(ui, ti, e.target.value)
                                  }
                                  className="w-12 text-xs text-slate-400 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 flex-shrink-0"
                                />
                                <input
                                  type="text"
                                  value={topic.title}
                                  onChange={(e) =>
                                    updateTopicTitle(ui, ti, e.target.value)
                                  }
                                  className="flex-1 text-sm text-slate-600 dark:text-slate-400 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1"
                                />
                                <button
                                  onClick={() => deleteTopic(ui, ti)}
                                  className="p-0.5 rounded text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover/topic:opacity-100 transition-opacity flex-shrink-0"
                                  title={t("Delete topic")}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setWizardStep(1)}
                      className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      {t("Back")}
                    </button>
                    <button
                      onClick={createCourse}
                      disabled={wizardCreating || !parsedCourse.name.trim()}
                      className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {wizardCreating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t("Creating...")}
                        </>
                      ) : (
                        t("Create Course")
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* ─── Step 3: Confirmation ─── */}
              {wizardStep === 3 && createdCourse && (
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    {t("Course Created!")}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {createdCourse.name}
                    </span>
                    <br />
                    {createdCourse.unit_count} {t("units")} &middot;{" "}
                    {createdCourse.topic_count} {t("topics")}
                  </p>

                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={closeWizard}
                      className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      {t("Close")}
                    </button>
                    <button
                      onClick={() => {
                        closeWizard();
                        router.push(`/courses/${createdCourse.id}`);
                      }}
                      className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-sm transition-all"
                    >
                      {t("Go to Course")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
