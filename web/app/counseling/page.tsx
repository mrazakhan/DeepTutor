"use client";

import { useState } from "react";
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
} from "lucide-react";

type GradeTab = "big-picture" | "9th" | "10th" | "11th" | "12th";

interface TimelineItem {
  title: string;
  description: string;
  icon: React.ReactNode;
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

const GRADE_DATA: Record<Exclude<GradeTab, "big-picture">, GradeData> = {
  "9th": {
    label: "9th Grade",
    subtitle: "Build the Foundation",
    color: "emerald",
    academics: [
      {
        title: "AP Computer Science A",
        description:
          "Your first AP. Aim for a 5. This is the baseline signal that you're serious about CS.",
        icon: <Code className="w-5 h-5" />,
        tags: ["AP Exam", "Java"],
      },
      {
        title: "Honors/AP Math Track",
        description:
          "Take the most advanced math available (Honors Algebra II or AP Precalculus). Math rigor matters for MIT/Caltech.",
        icon: <BookOpen className="w-5 h-5" />,
        tags: ["Math", "Core"],
      },
      {
        title: "Strong GPA Foundation",
        description:
          "Target unweighted 3.9+. Take honors in English, Science, and History where available.",
        icon: <Star className="w-5 h-5" />,
        tags: ["GPA", "All Subjects"],
      },
    ],
    competitions: [
      {
        title: "USACO Bronze & Silver",
        description:
          "Start competitive programming NOW. Work through usaco.guide systematically. Goal: reach Silver by end of 9th grade, ideally Gold.",
        icon: <Trophy className="w-5 h-5" />,
        tags: ["USACO", "Critical"],
      },
      {
        title: "AMC 10",
        description:
          "Take the AMC 10 in November/February. Strong math scores complement your CS profile. Aim for AIME qualification.",
        icon: <Target className="w-5 h-5" />,
        tags: ["Math Competition"],
      },
      {
        title: "Hackathons",
        description:
          "Participate in 2-3 local or online hackathons. Focus on learning and building, not winning yet.",
        icon: <Code className="w-5 h-5" />,
        tags: ["Team Building"],
      },
    ],
    projects: [
      {
        title: "Personal Website / Portfolio",
        description:
          "Build a personal site from scratch (not a template). Learn HTML/CSS/JS, then React. This becomes your portfolio hub.",
        icon: <FileText className="w-5 h-5" />,
        tags: ["Web Dev", "Portfolio"],
      },
      {
        title: "First Meaningful Project",
        description:
          "Build something that solves a real problem. A tool for your school, a community app, or a data visualization. Quality over quantity.",
        icon: <Lightbulb className="w-5 h-5" />,
        tags: ["Impact", "Real-World"],
      },
    ],
    summer: [
      {
        title: "USACO Intensive Training",
        description:
          "Dedicate significant summer time to competitive programming. Target: Gold division by fall of 10th grade.",
        icon: <Trophy className="w-5 h-5" />,
        tags: ["USACO", "Priority"],
      },
      {
        title: "Learn a Framework / Language",
        description:
          "Pick up Python deeply, or learn a framework like React/Flask. Build 2-3 small projects to solidify skills.",
        icon: <Code className="w-5 h-5" />,
        tags: ["Skill Building"],
      },
      {
        title: "Start Cold-Emailing Professors",
        description:
          "Begin reaching out to CS professors at local universities for research mentorship. Send 20 emails, expect 1-2 responses.",
        icon: <FlaskConical className="w-5 h-5" />,
        tags: ["Research", "Networking"],
      },
    ],
  },
  "10th": {
    label: "10th Grade",
    subtitle: "Sharpen the Spike",
    color: "blue",
    academics: [
      {
        title: "AP Calculus BC",
        description:
          "Essential for top CS schools. Take BC directly if possible. Score of 5 expected.",
        icon: <BookOpen className="w-5 h-5" />,
        tags: ["AP Exam", "Math"],
      },
      {
        title: "AP Physics C: Mechanics",
        description:
          "Shows quantitative depth. Pairs well with CS for MIT/Caltech applications.",
        icon: <FlaskConical className="w-5 h-5" />,
        tags: ["AP Exam", "Science"],
      },
      {
        title: "AP CS Principles or AP Statistics",
        description:
          "Easy 5. Frees up bandwidth for competitions and projects. Take whichever fits your schedule.",
        icon: <Code className="w-5 h-5" />,
        tags: ["AP Exam"],
      },
    ],
    competitions: [
      {
        title: "USACO Gold & Platinum",
        description:
          "This is THE year to push hard. USACO Platinum is the single strongest CS signal on your application. Train daily.",
        icon: <Trophy className="w-5 h-5" />,
        tags: ["USACO", "Critical"],
      },
      {
        title: "AIME Qualification",
        description:
          "If you scored well on AMC 10 last year, push for AIME this year. Even qualifying is a strong signal.",
        icon: <Target className="w-5 h-5" />,
        tags: ["Math Competition"],
      },
      {
        title: "Science Fair (Regional/State)",
        description:
          "Start a CS-related science fair project. This is your pipeline to ISEF. Choose a topic at the intersection of CS and another field.",
        icon: <FlaskConical className="w-5 h-5" />,
        tags: ["ISEF Pipeline", "Research"],
      },
    ],
    projects: [
      {
        title: "Flagship Open Source Project",
        description:
          "Build something substantial on GitHub. Aim for 100+ stars. Could be a developer tool, ML project, or novel application.",
        icon: <Code className="w-5 h-5" />,
        tags: ["GitHub", "Impact"],
      },
      {
        title: "Research with a Professor",
        description:
          "Formalize your research relationship. Work toward a publishable result. Even a workshop paper or poster matters.",
        icon: <FlaskConical className="w-5 h-5" />,
        tags: ["Research", "Publication"],
      },
    ],
    summer: [
      {
        title: "Apply to RSI (Research Science Institute)",
        description:
          "Apply in November. ~4% acceptance rate, but the application process itself is valuable. Run by MIT/CEE.",
        icon: <Star className="w-5 h-5" />,
        tags: ["Elite Program", "MIT"],
      },
      {
        title: "Research Internship at University",
        description:
          "Spend the summer in a professor's lab. Aim for a concrete deliverable: paper draft, poster, or working system.",
        icon: <FlaskConical className="w-5 h-5" />,
        tags: ["Research", "Priority"],
      },
      {
        title: "Science Fair Project Development",
        description:
          "Use summer to advance your ISEF-track project. Regional fairs happen in fall/winter of 11th grade.",
        icon: <Trophy className="w-5 h-5" />,
        tags: ["ISEF", "Long-term"],
      },
    ],
  },
  "11th": {
    label: "11th Grade",
    subtitle: "Peak Performance Year",
    color: "violet",
    academics: [
      {
        title: "AP Physics C: E&M + Multivariable Calculus / Linear Algebra",
        description:
          "Take college-level math if available (dual enrollment). Shows you've outgrown the AP curriculum.",
        icon: <BookOpen className="w-5 h-5" />,
        tags: ["Beyond AP", "Math"],
      },
      {
        title: "AP English Language + AP US History",
        description:
          "Humanities APs show intellectual breadth. Important for Stanford especially.",
        icon: <FileText className="w-5 h-5" />,
        tags: ["AP Exam", "Breadth"],
      },
      {
        title: "SAT/ACT + SAT Math II + SAT Physics",
        description:
          "Take in spring. Target: 1550+ SAT or 35+ ACT. These are table stakes, not differentiators.",
        icon: <Target className="w-5 h-5" />,
        tags: ["Standardized Tests"],
      },
    ],
    competitions: [
      {
        title: "USACO Platinum (if not already)",
        description:
          "Last chance for December/January contests. Platinum on your application is transformative.",
        icon: <Trophy className="w-5 h-5" />,
        tags: ["USACO", "Critical"],
      },
      {
        title: "ISEF Qualification",
        description:
          "Present at regional science fair. Win your category to advance to state, then ISEF. A top-3 ISEF finish is Ivy-level.",
        icon: <Trophy className="w-5 h-5" />,
        tags: ["ISEF", "Elite"],
      },
      {
        title: "Other CS Competitions",
        description:
          "Google Code Jam, Facebook Hacker Cup, Codeforces Div 1 — any of these add credibility to your competitive programming profile.",
        icon: <Code className="w-5 h-5" />,
        tags: ["Competitive Programming"],
      },
    ],
    projects: [
      {
        title: "Research Publication",
        description:
          "Submit to a workshop or conference. Even arXiv preprints count. The goal is demonstrating research capability.",
        icon: <FlaskConical className="w-5 h-5" />,
        tags: ["Publication", "Critical"],
      },
      {
        title: "Leadership in CS Community",
        description:
          "Teach CS at your school, organize a hackathon, lead a competitive programming club. Show you lift others up.",
        icon: <GraduationCap className="w-5 h-5" />,
        tags: ["Leadership", "Community"],
      },
    ],
    summer: [
      {
        title: "RSI or Equivalent Elite Program",
        description:
          "If accepted to RSI, this is your summer. If not, pursue a serious research internship at a top university.",
        icon: <Star className="w-5 h-5" />,
        tags: ["Elite Program"],
      },
      {
        title: "College Application Prep",
        description:
          "Start drafting essays. Begin the Common App. Research specific programs (CMU SCS, MIT EECS, Stanford CS, Caltech CS).",
        icon: <FileText className="w-5 h-5" />,
        tags: ["Applications"],
      },
      {
        title: "Teacher/Mentor Recommendation Letters",
        description:
          "Ask teachers in May/June. Choose teachers who know you well AND can speak to your intellectual curiosity.",
        icon: <GraduationCap className="w-5 h-5" />,
        tags: ["Letters of Rec"],
      },
    ],
  },
  "12th": {
    label: "12th Grade",
    subtitle: "Execute & Ship Applications",
    color: "amber",
    academics: [
      {
        title: "Maintain Your GPA",
        description:
          "Senioritis is real but mid-year reports matter. Continue with rigorous courses. Don't drop the ball.",
        icon: <BookOpen className="w-5 h-5" />,
        tags: ["GPA", "Consistency"],
      },
      {
        title: "Additional APs (if applicable)",
        description:
          "AP Chemistry, AP Biology, or more college math. Show continued growth. 8-12 APs total is typical for top admits.",
        icon: <Star className="w-5 h-5" />,
        tags: ["AP Exams"],
      },
    ],
    competitions: [
      {
        title: "Final USACO Contests",
        description:
          "December and January contests. If you're already Platinum, a strong performance is icing on the cake.",
        icon: <Trophy className="w-5 h-5" />,
        tags: ["USACO", "Final Shot"],
      },
      {
        title: "ISEF Finals (if qualified)",
        description:
          "Happens in May. Even if apps are submitted, awards still matter for waitlist decisions and scholarship applications.",
        icon: <Trophy className="w-5 h-5" />,
        tags: ["ISEF"],
      },
    ],
    projects: [
      {
        title: "Polish Your Portfolio",
        description:
          "Update GitHub, personal website, and any public-facing work. Admissions officers do look at links you provide.",
        icon: <FileText className="w-5 h-5" />,
        tags: ["Portfolio"],
      },
    ],
    summer: [
      {
        title: "Early Decision / Early Action (Nov 1)",
        description:
          "Apply EA to MIT and Caltech (both non-binding). Apply ED to CMU SCS if it's your top choice. Stanford REA if Stanford is #1.",
        icon: <Target className="w-5 h-5" />,
        tags: ["Applications", "Critical"],
      },
      {
        title: "Regular Decision (Jan 1-5)",
        description:
          "Apply broadly to reach and match schools. Include UC Berkeley EECS, Georgia Tech, UIUC CS, and others.",
        icon: <FileText className="w-5 h-5" />,
        tags: ["Applications"],
      },
      {
        title: "Essays That Tell YOUR Story",
        description:
          "Your essays should connect the dots: why CS, what you've built, what you want to build next. Be specific and authentic.",
        icon: <Lightbulb className="w-5 h-5" />,
        tags: ["Essays", "Critical"],
      },
    ],
  },
};

const KEY_INSIGHTS = [
  {
    icon: <Trophy className="w-6 h-6 text-amber-500" />,
    title: "USACO is the #1 CS Signal",
    description:
      "MIT, CMU, and Caltech admissions officers know exactly what USACO Platinum means. Start grinding in 9th grade. Progression Bronze to Platinum takes most serious students 2-3 years.",
    resources: ["usaco.guide", "CSES Problem Set", "Codeforces"],
  },
  {
    icon: <FlaskConical className="w-6 h-6 text-violet-500" />,
    title: "Research > Internships",
    description:
      "A summer at a professor's lab producing a paper (even unpublished) beats a summer as a tech company intern. Cold-emailing professors works. Send 20 emails, expect 1-2 responses.",
    resources: [],
  },
  {
    icon: <Target className="w-6 h-6 text-blue-500" />,
    title: 'The "Spike" Philosophy',
    description:
      'Admissions officers at top schools look for a "spike" \u2014 one thing you do at a genuinely elite level \u2014 rather than a well-rounded student who did 12 decent extracurriculars. Build the spike, let everything else support it.',
    resources: [],
  },
  {
    icon: <Star className="w-6 h-6 text-emerald-500" />,
    title: "RSI is Worth the Effort",
    description:
      "The Research Science Institute (run at MIT each summer) is perhaps the single most powerful summer program for STEM admits. Apply in November of 10th or 11th grade. ~4% acceptance rate, but the application itself is valuable.",
    resources: [],
  },
  {
    icon: <GraduationCap className="w-6 h-6 text-rose-500" />,
    title: "CMU: Apply Direct to SCS",
    description:
      'Apply to the School of Computer Science directly, not "undecided." They want to see you\'ve thought carefully about which program (CS, AI, HCI, etc.) and why. Research specific professors.',
    resources: [],
  },
];

const AP_COURSE_TIMELINE = [
  { grade: "9th", courses: ["AP Computer Science A"] },
  {
    grade: "10th",
    courses: ["AP Calculus BC", "AP Physics C: Mechanics", "AP CS Principles or AP Statistics"],
  },
  {
    grade: "11th",
    courses: [
      "AP Physics C: E&M",
      "AP English Language",
      "AP US History",
      "Multivariable Calculus / Linear Algebra (dual enrollment)",
    ],
  },
  {
    grade: "12th",
    courses: ["AP Chemistry or AP Biology", "Additional APs as available"],
  },
];

export default function CounselingPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<GradeTab>("big-picture");

  const tabs: { id: GradeTab; label: string; color: string }[] = [
    { id: "big-picture", label: "The Big Picture", color: "slate" },
    { id: "9th", label: "9th Grade", color: "emerald" },
    { id: "10th", label: "10th Grade", color: "blue" },
    { id: "11th", label: "11th Grade", color: "violet" },
    { id: "12th", label: "12th Grade", color: "amber" },
  ];

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

  function renderSection(
    title: string,
    items: TimelineItem[],
    color: string,
    sectionIcon: React.ReactNode
  ) {
    const c = colorMap[color];
    return (
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className={`p-1.5 rounded-lg ${c.bg}`}>{sectionIcon}</div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            {title}
          </h3>
        </div>
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-xl border ${c.border} ${c.bg} transition-all hover:shadow-md`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${c.text}`}>{item.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">
                      {item.title}
                    </h4>
                    {item.tags?.map((tag) => (
                      <span
                        key={tag}
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${c.badge}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {item.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderGradeContent(grade: Exclude<GradeTab, "big-picture">) {
    const data = GRADE_DATA[grade];
    const color = data.color;

    return (
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {data.label}
          </h2>
          <p className={`text-lg font-medium ${colorMap[color].text} mt-1`}>
            {data.subtitle}
          </p>
        </div>

        {renderSection(
          "Academics & AP Courses",
          data.academics,
          color,
          <BookOpen className={`w-5 h-5 ${colorMap[color].text}`} />
        )}
        {renderSection(
          "Competitions & Awards",
          data.competitions,
          color,
          <Trophy className={`w-5 h-5 ${colorMap[color].text}`} />
        )}
        {renderSection(
          "Projects & Research",
          data.projects,
          color,
          <Code className={`w-5 h-5 ${colorMap[color].text}`} />
        )}
        {renderSection(
          "Summer Plan",
          data.summer,
          color,
          <Sparkles className={`w-5 h-5 ${colorMap[color].text}`} />
        )}
      </div>
    );
  }

  function renderBigPicture() {
    return (
      <div>
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            The Big Picture
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-2 text-base">
            A strategic roadmap for high school students targeting admission to the
            top CS programs: MIT, Stanford, CMU, and Caltech. Start in 9th grade
            for the best outcome.
          </p>
        </div>

        {/* Key Insights */}
        <div className="mb-10">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-500" />
            Key Insights
          </h3>
          <div className="space-y-4">
            {KEY_INSIGHTS.map((insight, idx) => (
              <div
                key={idx}
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 flex-shrink-0">{insight.icon}</div>
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-base">
                      {insight.title}
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                      {insight.description}
                    </p>
                    {insight.resources.length > 0 && (
                      <div className="flex gap-2 mt-2">
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
            {/* Timeline line */}
            <div className="absolute left-[18px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-emerald-400 via-blue-400 via-violet-400 to-amber-400" />
            <div className="space-y-6">
              {AP_COURSE_TIMELINE.map((item, idx) => {
                const colors = ["emerald", "blue", "violet", "amber"];
                const c = colorMap[colors[idx]];
                return (
                  <div key={item.grade} className="flex gap-4">
                    <div
                      className={`w-9 h-9 rounded-full ${c.light} flex items-center justify-center flex-shrink-0 z-10 shadow-sm`}
                    >
                      <span className="text-white text-xs font-bold">
                        {item.grade.replace("th", "")}
                      </span>
                    </div>
                    <div className="flex-1 pb-2">
                      <h4 className={`font-semibold ${c.text} mb-2`}>
                        {item.grade}
                      </h4>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                title: "USACO Progression",
                steps: ["Bronze (start of 9th)", "Silver (end of 9th)", "Gold (10th)", "Platinum (10th-11th)"],
                color: "amber",
              },
              {
                title: "Math Competitions",
                steps: ["AMC 10 (9th)", "AIME Qualification (10th)", "AMC 12 (11th)", "USAMO (stretch goal)"],
                color: "blue",
              },
              {
                title: "Science Fair Track",
                steps: ["Choose topic (10th fall)", "Regional fair (10th-11th)", "State fair", "ISEF (11th spring)"],
                color: "violet",
              },
              {
                title: "Research Timeline",
                steps: ["Cold email professors (9th summer)", "Lab work (10th summer)", "Paper draft (11th)", "Publication (11th-12th)"],
                color: "emerald",
              },
            ].map((track) => {
              const c = colorMap[track.color];
              return (
                <div
                  key={track.title}
                  className={`p-4 rounded-xl border ${c.border} ${c.bg}`}
                >
                  <h4 className={`font-semibold ${c.text} mb-3`}>
                    {track.title}
                  </h4>
                  <div className="space-y-2">
                    {track.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <ChevronRight className={`w-4 h-4 ${c.text} flex-shrink-0`} />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {step}
                        </span>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                school: "MIT",
                program: "EECS (6-3) or CS (6-4)",
                strategy: "EA (non-binding). Values USACO, research, and genuine passion. Essays should show builder mentality.",
                deadline: "Nov 1 EA",
              },
              {
                school: "Stanford",
                program: "Computer Science (BS)",
                strategy: "REA (non-binding). Wants intellectual vitality. Essays should show breadth + depth. Humanities matter here.",
                deadline: "Nov 1 REA",
              },
              {
                school: "CMU",
                program: "School of Computer Science",
                strategy: "Apply directly to SCS. Research specific programs (CS, AI, HCI). ED is binding but shows commitment.",
                deadline: "Nov 1 ED / Jan 5 RD",
              },
              {
                school: "Caltech",
                program: "Computer Science",
                strategy: "EA (non-binding). Smallest class, most STEM-focused. Strong math and physics scores critical. Research valued highly.",
                deadline: "Nov 1 EA",
              },
            ].map((school) => (
              <div
                key={school.school}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                    {school.school}
                  </h4>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400">
                    {school.deadline}
                  </span>
                </div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">
                  {school.program}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {school.strategy}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 text-white">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {t("CS Admissions Counseling")}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t("Strategic roadmap for top CS program admissions")}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-8 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-fit px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
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
      <div className="mt-12 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
            This plan is ambitious — that&apos;s intentional. You don&apos;t have to hit every
            item, but students who get into MIT and Stanford typically hit most of
            them. Starting in 9th grade is exactly the right time.
          </p>
        </div>
      </div>
    </div>
  );
}
