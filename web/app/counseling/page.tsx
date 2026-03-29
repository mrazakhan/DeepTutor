"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  GraduationCap,
  Trophy,
  Code,
  FlaskConical,
  FileText,
  Target,
  BookOpen,
  Lightbulb,
  Star,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  Loader2,
  Zap,
  Wrench,
  Building2,
  Microscope,
  Atom,
  type LucideIcon,
} from "lucide-react";
import { apiUrl } from "@/lib/api";

// --------------- icon mapping ---------------

const ICON_MAP: Record<string, LucideIcon> = {
  GraduationCap,
  Trophy,
  Code,
  FlaskConical,
  FileText,
  Target,
  BookOpen,
  Lightbulb,
  Star,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Zap,
  Wrench,
  Building2,
  Microscope,
  Atom,
};

function IconFromName({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] || Star;
  return <Icon className={className} />;
}

// --------------- types ---------------

type GradeTab = "big-picture" | "9th" | "10th" | "11th" | "12th";

interface StemArea {
  stem_area: string;
  display_name: string;
  icon: string;
  description: string;
}

interface TimelineItem {
  title: string;
  description: string;
  icon: string;
  tags?: string[];
}

interface GradeData {
  label: string;
  subtitle: string;
  color: string;
  academics: TimelineItem[];
  competitions: TimelineItem[];
  projects: TimelineItem[];
  summer: TimelineItem[];
}

interface KeyInsight {
  icon: string;
  icon_color: string;
  title: string;
  description: string;
  resources: string[];
}

interface CompetitionTrack {
  title: string;
  steps: string[];
  color: string;
}

interface TargetSchool {
  school: string;
  program: string;
  strategy: string;
  deadline: string;
}

interface CounselingData {
  grade_data: Record<string, GradeData>;
  key_insights: KeyInsight[];
  ap_course_timeline: { grade: string; courses: string[] }[];
  competition_milestones: CompetitionTrack[];
  target_schools: TargetSchool[];
  footer_note: string;
}

// --------------- color map ---------------

const colorMap: Record<string, { bg: string; border: string; text: string; badge: string; light: string }> = {
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-400",
    badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
    light: "bg-emerald-500",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-700 dark:text-blue-400",
    badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
    light: "bg-blue-500",
  },
  violet: {
    bg: "bg-violet-50 dark:bg-violet-900/20",
    border: "border-violet-200 dark:border-violet-800",
    text: "text-violet-700 dark:text-violet-400",
    badge: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300",
    light: "bg-violet-500",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-700 dark:text-amber-400",
    badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
    light: "bg-amber-500",
  },
  slate: {
    bg: "bg-slate-50 dark:bg-slate-800/50",
    border: "border-slate-200 dark:border-slate-700",
    text: "text-slate-700 dark:text-slate-300",
    badge: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
    light: "bg-slate-500",
  },
};

// --------------- area card colors ---------------

const AREA_COLORS: Record<string, { gradient: string; iconBg: string }> = {
  cs: { gradient: "from-blue-500 to-violet-500", iconBg: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" },
  electrical_engineering: { gradient: "from-amber-500 to-orange-500", iconBg: "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" },
  mechanical_engineering: { gradient: "from-slate-500 to-slate-700", iconBg: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300" },
  civil_engineering: { gradient: "from-emerald-500 to-teal-500", iconBg: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" },
  biology: { gradient: "from-green-500 to-emerald-600", iconBg: "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400" },
  chemistry: { gradient: "from-violet-500 to-purple-600", iconBg: "bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400" },
  physics: { gradient: "from-cyan-500 to-blue-600", iconBg: "bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400" },
};

const DEFAULT_AREA_COLOR = { gradient: "from-blue-500 to-violet-500", iconBg: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" };

// --------------- component ---------------

export default function CounselingPage() {
  const { t } = useTranslation();
  const [areas, setAreas] = useState<StemArea[]>([]);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedAreaMeta, setSelectedAreaMeta] = useState<StemArea | null>(null);
  const [content, setContent] = useState<CounselingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<GradeTab>("big-picture");

  // Fetch available areas on mount
  useEffect(() => {
    async function fetchAreas() {
      try {
        const res = await fetch(apiUrl("/api/v1/counseling/areas"));
        if (res.ok) {
          const data = await res.json();
          setAreas(data);
        }
      } catch (e) {
        console.error("Failed to fetch counseling areas:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchAreas();
  }, []);

  // Fetch content when area is selected
  const selectArea = useCallback(async (area: StemArea) => {
    setSelectedArea(area.stem_area);
    setSelectedAreaMeta(area);
    setContentLoading(true);
    setActiveTab("big-picture");
    try {
      const res = await fetch(apiUrl(`/api/v1/counseling/content/${area.stem_area}`));
      if (res.ok) {
        const data = await res.json();
        setContent(data.content);
      }
    } catch (e) {
      console.error("Failed to fetch counseling content:", e);
    } finally {
      setContentLoading(false);
    }
  }, []);

  const goBack = () => {
    setSelectedArea(null);
    setSelectedAreaMeta(null);
    setContent(null);
  };

  // --------------- render helpers ---------------

  const tabs: { id: GradeTab; label: string }[] = [
    { id: "big-picture", label: "The Big Picture" },
    { id: "9th", label: "9th Grade" },
    { id: "10th", label: "10th Grade" },
    { id: "11th", label: "11th Grade" },
    { id: "12th", label: "12th Grade" },
  ];

  function renderSection(title: string, items: TimelineItem[], color: string, sectionIconName: string) {
    const c = colorMap[color] || colorMap.slate;
    return (
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className={`p-1.5 rounded-lg ${c.bg}`}>
            <IconFromName name={sectionIconName} className={`w-5 h-5 ${c.text}`} />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
        </div>
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className={`p-4 rounded-xl border ${c.border} ${c.bg} transition-all hover:shadow-md`}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${c.text}`}>
                  <IconFromName name={item.icon} className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">{item.title}</h4>
                    {item.tags?.map((tag) => (
                      <span key={tag} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${c.badge}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{item.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderGradeContent(grade: Exclude<GradeTab, "big-picture">) {
    if (!content) return null;
    const data = content.grade_data[grade];
    if (!data) return null;
    const color = data.color;

    return (
      <div>
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">{data.label}</h2>
          <p className={`text-lg font-medium ${(colorMap[color] || colorMap.slate).text} mt-1`}>{data.subtitle}</p>
        </div>
        {renderSection("Academics & AP Courses", data.academics, color, "BookOpen")}
        {renderSection("Competitions & Awards", data.competitions, color, "Trophy")}
        {renderSection("Projects & Research", data.projects, color, "Code")}
        {renderSection("Summer Plan", data.summer, color, "Sparkles")}
      </div>
    );
  }

  function renderBigPicture() {
    if (!content) return null;

    return (
      <div>
        <div className="mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">The Big Picture</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-2 text-base">
            A strategic roadmap for high school students targeting admission to top {selectedAreaMeta?.display_name} programs.
            Start in 9th grade for the best outcome.
          </p>
        </div>

        {/* Key Insights */}
        <div className="mb-10">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-500" />
            Key Insights
          </h3>
          <div className="space-y-4">
            {content.key_insights.map((insight, idx) => (
              <div
                key={idx}
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 flex-shrink-0">
                    <IconFromName name={insight.icon} className={`w-6 h-6 ${insight.icon_color}`} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-base">{insight.title}</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                      {insight.description}
                    </p>
                    {insight.resources.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {insight.resources.map((r) => (
                          <span
                            key={r}
                            className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AP Course Timeline */}
        <div className="mb-10">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-violet-500" />
            AP Course Progression
          </h3>
          <div className="relative">
            <div className="absolute left-[18px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-emerald-400 via-blue-400 via-violet-400 to-amber-400" />
            <div className="space-y-6">
              {content.ap_course_timeline.map((item, idx) => {
                const colors = ["emerald", "blue", "violet", "amber"];
                const c = colorMap[colors[idx]] || colorMap.slate;
                return (
                  <div key={item.grade} className="flex gap-4">
                    <div className={`w-9 h-9 rounded-full ${c.light} flex items-center justify-center flex-shrink-0 z-10 shadow-sm`}>
                      <span className="text-white text-xs font-bold">{item.grade.replace("th", "")}</span>
                    </div>
                    <div className="flex-1 pb-2">
                      <h4 className={`font-semibold ${c.text} mb-2`}>{item.grade}</h4>
                      <div className="flex flex-wrap gap-2">
                        {item.courses.map((course) => (
                          <span
                            key={course}
                            className={`text-sm px-3 py-1.5 rounded-lg border ${c.border} ${c.bg} text-slate-700 dark:text-slate-300`}
                          >
                            {course}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Competition Milestones */}
        <div className="mb-10">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Competition Milestones
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {content.competition_milestones.map((track) => {
              const c = colorMap[track.color] || colorMap.slate;
              return (
                <div key={track.title} className={`p-4 rounded-xl border ${c.border} ${c.bg}`}>
                  <h4 className={`font-semibold ${c.text} mb-3`}>{track.title}</h4>
                  <div className="space-y-2">
                    {track.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <ChevronRight className={`w-4 h-4 ${c.text} flex-shrink-0`} />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Target Schools */}
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-rose-500" />
            Target Schools & Application Strategy
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {content.target_schools.map((school) => (
              <div
                key={school.school}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-lg text-slate-900 dark:text-slate-100">{school.school}</h4>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400">
                    {school.deadline}
                  </span>
                </div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">{school.program}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{school.strategy}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --------------- area selector ---------------

  function renderAreaSelector() {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      );
    }

    if (areas.length === 0) {
      return (
        <div className="text-center py-32 text-slate-500 dark:text-slate-400">
          No counseling areas available yet. Check back soon.
        </div>
      );
    }

    return (
      <div>
        <div className="text-center mb-8 sm:mb-10">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Choose Your Area of Interest
          </h2>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
            Select a STEM field to see a tailored 4-year roadmap with AP courses, competitions, research opportunities, and target schools.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {areas.map((area) => {
            const ac = AREA_COLORS[area.stem_area] || DEFAULT_AREA_COLOR;
            return (
              <button
                key={area.stem_area}
                onClick={() => selectArea(area)}
                className="group p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all text-left"
              >
                <div className={`w-12 h-12 rounded-xl ${ac.iconBg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <IconFromName name={area.icon} className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  {area.display_name}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                  {area.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // --------------- main render ---------------

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          {selectedArea && (
            <button
              onClick={goBack}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className={`p-2 rounded-xl bg-gradient-to-br ${selectedArea ? (AREA_COLORS[selectedArea] || DEFAULT_AREA_COLOR).gradient : "from-blue-500 to-violet-500"} text-white`}>
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              {selectedAreaMeta ? `${selectedAreaMeta.display_name} Admissions Counseling` : t("STEM Admissions Counseling")}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {selectedAreaMeta ? `Strategic roadmap for top ${selectedAreaMeta.display_name} programs` : t("Strategic roadmap for top STEM program admissions")}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      {!selectedArea ? (
        renderAreaSelector()
      ) : contentLoading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : content ? (
        <>
          {/* Tab Navigation */}
          <div className="flex gap-1 mb-6 sm:mb-8 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-w-fit px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="min-h-[60vh]">
            {activeTab === "big-picture" && renderBigPicture()}
            {activeTab !== "big-picture" && renderGradeContent(activeTab)}
          </div>

          {/* Footer Note */}
          {content.footer_note && (
            <div className="mt-12 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
                  {content.footer_note}
                </p>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
