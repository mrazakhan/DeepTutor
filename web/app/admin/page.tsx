"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Activity,
  BarChart3,
  Trash2,
  KeyRound,
  Loader2,
  Shield,
  Copy,
  Check,
  ToggleLeft,
  ToggleRight,
  Zap,
  TrendingUp,
  BookOpen,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  role: string;
  enabled: boolean;
  created_at: string | null;
  last_login_at: string | null;
  total_questions: number;
  correct_answers: number;
  topics_assessed: number;
  favorites_count: number;
  llm_calls: number;
  llm_tokens: number;
  llm_cost: number;
}

interface SessionRow {
  username: string;
  display_name: string;
  role: string;
  expires_in_hours: number;
}

interface Stats {
  total_users: number;
  students: number;
  admins: number;
  active_sessions: number;
  total_assessments: number;
  total_questions: number;
  total_correct: number;
}

interface DailyRow {
  date: string;
  llm_calls: number;
  tokens: number;
  cost: number;
  answers: number;
  exams: number;
}

interface PendingCourse {
  id: string;
  name: string;
  code: string;
  subject_area: string;
  description: string;
  unit_count: number;
  topic_count: number;
  created_by_username: string;
  created_at: string;
}

interface CourseRow {
  id: string;
  name: string;
  code: string;
  subject_area: string;
  unit_count: number;
  topic_count: number;
  status: string;
  is_custom: boolean;
}

type Tab = "users" | "sessions" | "overview" | "usage" | "courses";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetResult, setResetResult] = useState<{
    username: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pendingCourses, setPendingCourses] = useState<PendingCourse[]>([]);
  const [allCourses, setAllCourses] = useState<CourseRow[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesLoaded, setCoursesLoaded] = useState(false);

  useEffect(() => {
    if (user && user.role !== "admin") router.push("/");
  }, [user, router]);

  const headers = useCallback(() => {
    const token = localStorage.getItem("deeptutor_token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, sessionsRes, statsRes, dailyRes] = await Promise.all([
        fetch(apiUrl("/api/v1/admin/users"), { headers: headers() }),
        fetch(apiUrl("/api/v1/admin/sessions"), { headers: headers() }),
        fetch(apiUrl("/api/v1/admin/stats"), { headers: headers() }),
        fetch(apiUrl("/api/v1/admin/usage/daily?days=30"), { headers: headers() }),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (sessionsRes.ok) setSessions(await sessionsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (dailyRes.ok) setDaily(await dailyRes.json());
    } catch (err) {
      console.error("Failed to load admin data:", err);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (user?.role === "admin") loadData();
  }, [user, loadData]);

  async function handleToggleEnabled(userId: string) {
    try {
      const res = await fetch(
        apiUrl(`/api/v1/admin/users/${userId}/toggle-enabled`),
        { method: "PATCH", headers: headers() }
      );
      if (res.ok) {
        const data = await res.json();
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, enabled: data.enabled } : u
          )
        );
      }
    } catch {
      /* skip */
    }
  }

  async function handleDelete(userId: string) {
    try {
      const res = await fetch(apiUrl(`/api/v1/admin/users/${userId}`), {
        method: "DELETE",
        headers: headers(),
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        setConfirmDelete(null);
      }
    } catch {
      /* skip */
    }
  }

  async function handleResetPassword(userId: string) {
    try {
      const res = await fetch(
        apiUrl(`/api/v1/admin/users/${userId}/reset-password`),
        { method: "POST", headers: headers() }
      );
      if (res.ok) {
        const data = await res.json();
        setResetResult({
          username: data.username,
          password: data.temp_password,
        });
        setCopied(false);
      }
    } catch {
      /* skip */
    }
  }

  const loadCourses = useCallback(async () => {
    setCoursesLoading(true);
    try {
      const [pendingRes, allRes] = await Promise.all([
        fetch(apiUrl("/api/v1/admin/courses/pending"), { headers: headers() }),
        fetch(apiUrl("/api/v1/courses/list"), { headers: headers() }),
      ]);
      if (pendingRes.ok) setPendingCourses(await pendingRes.json());
      if (allRes.ok) setAllCourses(await allRes.json());
      setCoursesLoaded(true);
    } catch (err) {
      console.error("Failed to load courses:", err);
    } finally {
      setCoursesLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (tab === "courses" && user?.role === "admin" && !coursesLoaded) {
      loadCourses();
    }
  }, [tab, user, coursesLoaded, loadCourses]);

  async function handleApproveCourse(courseId: string) {
    try {
      const res = await fetch(
        apiUrl(`/api/v1/admin/courses/${courseId}/approve`),
        { method: "PATCH", headers: headers() }
      );
      if (res.ok) loadCourses();
    } catch {
      /* skip */
    }
  }

  async function handleRejectCourse(courseId: string) {
    try {
      const res = await fetch(
        apiUrl(`/api/v1/admin/courses/${courseId}/reject`),
        { method: "PATCH", headers: headers() }
      );
      if (res.ok) loadCourses();
    } catch {
      /* skip */
    }
  }

  function copyPassword() {
    if (resetResult) {
      navigator.clipboard.writeText(resetResult.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-screen text-slate-400">
        <Shield className="w-8 h-8 mr-2" /> Admin access required
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "users", label: "Users", icon: Users },
    { id: "usage", label: "Usage", icon: TrendingUp },
    { id: "sessions", label: "Sessions", icon: Activity },
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "courses", label: "Courses", icon: BookOpen },
  ];

  // Daily chart helpers
  const maxLLM = Math.max(1, ...daily.map((d) => d.llm_calls));
  const maxAnswers = Math.max(1, ...daily.map((d) => d.answers));

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-500" />
          Admin Dashboard
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Manage users, monitor usage, and view platform stats
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-700 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading...
        </div>
      ) : (
        <>
          {/* Password Reset Modal */}
          {resetResult && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Password Reset
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  New password for{" "}
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {resetResult.username}
                  </span>
                  :
                </p>
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 p-3 rounded-lg mb-4">
                  <code className="flex-1 text-sm font-mono text-slate-900 dark:text-slate-100">
                    {resetResult.password}
                  </code>
                  <button
                    onClick={copyPassword}
                    className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
                  Share this password securely. The user&apos;s existing
                  sessions have been invalidated.
                </p>
                <button
                  onClick={() => setResetResult(null)}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* ═══════════ Users Tab ═══════════ */}
          {tab === "users" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                    <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400">
                      User
                    </th>
                    <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400">
                      Status
                    </th>
                    <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400">
                      Last Login
                    </th>
                    <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400 text-right">
                      Questions
                    </th>
                    <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400 text-right">
                      LLM Calls
                    </th>
                    <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400 text-right">
                      Tokens
                    </th>
                    <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className={`border-b border-slate-100 dark:border-slate-800 ${
                        !u.enabled ? "opacity-50" : ""
                      }`}
                    >
                      <td className="py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {u.display_name}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1">
                          @{u.username}{u.email && <span className="ml-1 text-slate-300 dark:text-slate-500">· {u.email}</span>}
                          <span
                            className={`ml-1 text-[10px] font-medium px-1.5 py-0 rounded-full ${
                              u.role === "admin"
                                ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                            }`}
                          >
                            {u.role}
                          </span>
                        </div>
                      </td>
                      <td className="py-3">
                        {u.role !== "admin" ? (
                          <button
                            onClick={() => handleToggleEnabled(u.id)}
                            className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                              u.enabled
                                ? "text-green-600 hover:text-green-700"
                                : "text-red-500 hover:text-red-600"
                            }`}
                            title={
                              u.enabled
                                ? "Click to disable"
                                : "Click to enable"
                            }
                          >
                            {u.enabled ? (
                              <ToggleRight className="w-5 h-5" />
                            ) : (
                              <ToggleLeft className="w-5 h-5" />
                            )}
                            {u.enabled ? "Active" : "Disabled"}
                          </button>
                        ) : (
                          <span className="text-xs text-purple-500 font-medium">
                            Admin
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-slate-500 dark:text-slate-400 text-xs">
                        {formatDate(u.last_login_at)}
                      </td>
                      <td className="py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {u.total_questions > 0 ? (
                          <span>
                            {u.total_questions}{" "}
                            <span className="text-xs text-slate-400">
                              (
                              {Math.round(
                                (u.correct_answers / u.total_questions) * 100
                              )}
                              %)
                            </span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {u.llm_calls > 0 ? (
                          <span className="flex items-center justify-end gap-1">
                            <Zap className="w-3 h-3 text-amber-500" />
                            {u.llm_calls}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 text-right tabular-nums text-slate-700 dark:text-slate-300 text-xs">
                        {u.llm_tokens > 0 ? (
                          <span>
                            {formatNum(u.llm_tokens)}
                            {u.llm_cost > 0 && (
                              <span className="text-slate-400 ml-1">
                                ${u.llm_cost.toFixed(2)}
                              </span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleResetPassword(u.id)}
                            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-amber-500 transition-colors"
                            title="Reset password"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          {u.role !== "admin" &&
                            (confirmDelete === u.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(u.id)}
                                  className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(null)}
                                  className="px-2 py-1 text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDelete(u.id)}
                                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500 transition-colors"
                                title="Delete user"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  No users found
                </div>
              )}
            </div>
          )}

          {/* ═══════════ Usage Tab ═══════════ */}
          {tab === "usage" && (
            <div>
              {/* Daily activity chart */}
              <div className="mb-8 p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                  Daily Activity (Last 30 Days)
                </h3>
                {daily.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">
                    No usage data yet
                  </p>
                ) : (
                  <div className="space-y-1">
                    {/* Chart header */}
                    <div className="flex items-center gap-4 text-xs text-slate-400 mb-2">
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded bg-blue-500" /> LLM
                        Calls
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded bg-green-500" />{" "}
                        Questions
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded bg-purple-500" />{" "}
                        Exams
                      </span>
                    </div>
                    {/* Bar chart rows */}
                    <div className="space-y-0.5 max-h-80 overflow-y-auto">
                      {daily.map((d) => (
                        <div key={d.date} className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 w-16 flex-shrink-0 text-right tabular-nums">
                            {new Date(d.date + "T00:00").toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric" }
                            )}
                          </span>
                          <div className="flex-1 flex gap-0.5 h-4">
                            {d.llm_calls > 0 && (
                              <div
                                className="bg-blue-500 rounded-sm min-w-[2px]"
                                style={{
                                  width: `${(d.llm_calls / maxLLM) * 50}%`,
                                }}
                                title={`${d.llm_calls} LLM calls`}
                              />
                            )}
                            {d.answers > 0 && (
                              <div
                                className="bg-green-500 rounded-sm min-w-[2px]"
                                style={{
                                  width: `${(d.answers / maxAnswers) * 40}%`,
                                }}
                                title={`${d.answers} questions`}
                              />
                            )}
                            {d.exams > 0 && (
                              <div
                                className="bg-purple-500 rounded-sm min-w-[4px]"
                                style={{ width: `${d.exams * 3}%` }}
                                title={`${d.exams} exams`}
                              />
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 w-20 flex-shrink-0 tabular-nums">
                            {d.llm_calls > 0 && `${d.llm_calls} calls`}
                            {d.cost > 0 && ` · $${d.cost.toFixed(2)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Top users by LLM usage */}
              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                  Top Users by LLM Usage
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                      <th className="pb-2 font-semibold text-slate-500 dark:text-slate-400">
                        User
                      </th>
                      <th className="pb-2 font-semibold text-slate-500 dark:text-slate-400 text-right">
                        Calls
                      </th>
                      <th className="pb-2 font-semibold text-slate-500 dark:text-slate-400 text-right">
                        Tokens
                      </th>
                      <th className="pb-2 font-semibold text-slate-500 dark:text-slate-400 text-right">
                        Cost
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users
                      .filter((u) => u.llm_calls > 0)
                      .sort((a, b) => b.llm_calls - a.llm_calls)
                      .slice(0, 10)
                      .map((u) => (
                        <tr
                          key={u.id}
                          className="border-b border-slate-100 dark:border-slate-800"
                        >
                          <td className="py-2">
                            <span className="font-medium text-slate-700 dark:text-slate-200">
                              {u.display_name}
                            </span>
                            <span className="text-xs text-slate-400 ml-1">
                              @{u.username}
                            </span>
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {u.llm_calls}
                          </td>
                          <td className="py-2 text-right tabular-nums text-xs">
                            {formatNum(u.llm_tokens)}
                          </td>
                          <td className="py-2 text-right tabular-nums text-xs">
                            ${u.llm_cost.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {users.filter((u) => u.llm_calls > 0).length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-8">
                    No LLM usage recorded yet
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ═══════════ Sessions Tab ═══════════ */}
          {tab === "sessions" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                    <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400">
                      User
                    </th>
                    <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400">
                      Role
                    </th>
                    <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400">
                      Expires In
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-100 dark:border-slate-800"
                    >
                      <td className="py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {s.display_name}
                        </div>
                        <div className="text-xs text-slate-400">
                          @{s.username}
                        </div>
                      </td>
                      <td className="py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            s.role === "admin"
                              ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {s.role}
                        </span>
                      </td>
                      <td className="py-3 text-slate-500 dark:text-slate-400">
                        {s.expires_in_hours.toFixed(1)} hours
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sessions.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  No active sessions
                </div>
              )}
            </div>
          )}

          {/* ═══════════ Overview Tab ═══════════ */}
          {tab === "overview" && stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: "Total Users",
                  value: stats.total_users,
                  sub: `${stats.students} students, ${stats.admins} admins`,
                },
                { label: "Active Sessions", value: stats.active_sessions },
                { label: "Questions Answered", value: stats.total_questions },
                {
                  label: "Overall Accuracy",
                  value:
                    stats.total_questions > 0
                      ? `${Math.round((stats.total_correct / stats.total_questions) * 100)}%`
                      : "—",
                },
                {
                  label: "LLM Calls Today",
                  value:
                    daily.length > 0
                      ? daily[daily.length - 1].llm_calls
                      : 0,
                },
                {
                  label: "Tokens Today",
                  value:
                    daily.length > 0
                      ? formatNum(daily[daily.length - 1].tokens)
                      : "0",
                },
                {
                  label: "Cost Today",
                  value:
                    daily.length > 0
                      ? `$${daily[daily.length - 1].cost.toFixed(2)}`
                      : "$0",
                },
                {
                  label: "Exams Taken",
                  value: daily.reduce((s, d) => s + d.exams, 0),
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                    {card.value}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {card.label}
                  </div>
                  {card.sub && (
                    <div className="text-xs text-slate-400 mt-1">
                      {card.sub}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ═══════════ Courses Tab ═══════════ */}
          {tab === "courses" && (
            <div>
              {coursesLoading ? (
                <div className="text-center py-20 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading courses...
                </div>
              ) : (
                <>
                  {/* Pending Approval Section */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-amber-500" />
                      Pending Approval
                    </h3>
                    {pendingCourses.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                        No courses pending approval
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {pendingCourses.map((course) => (
                          <div
                            key={course.id}
                            className="p-5 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                                  {course.name}
                                </h4>
                                {course.code && (
                                  <span className="text-xs text-slate-400">
                                    {course.code}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                                {course.subject_area}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">
                              {course.description || "No description"}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-slate-400 mb-4">
                              <span>{course.unit_count} units</span>
                              <span>·</span>
                              <span>{course.topic_count} topics</span>
                              <span>·</span>
                              <span>by @{course.created_by_username}</span>
                              <span>·</span>
                              <span>{formatDate(course.created_at)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleApproveCourse(course.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectCourse(course.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                              >
                                <XCircle className="w-4 h-4" />
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* All Courses Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-blue-500" />
                      All Courses
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                            <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400">
                              Course
                            </th>
                            <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400">
                              Subject Area
                            </th>
                            <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400 text-right">
                              Units
                            </th>
                            <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400 text-right">
                              Topics
                            </th>
                            <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {allCourses.map((course) => (
                            <tr
                              key={course.id}
                              className="border-b border-slate-100 dark:border-slate-800"
                            >
                              <td className="py-3">
                                <div className="font-medium text-slate-900 dark:text-slate-100">
                                  {course.name}
                                </div>
                                {course.code && (
                                  <div className="text-xs text-slate-400">
                                    {course.code}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 text-slate-500 dark:text-slate-400">
                                {course.subject_area}
                              </td>
                              <td className="py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                                {course.unit_count}
                              </td>
                              <td className="py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                                {course.topic_count}
                              </td>
                              <td className="py-3">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                      course.status === "approved"
                                        ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                                        : course.status === "pending"
                                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                    }`}
                                  >
                                    {course.status}
                                  </span>
                                  {course.is_custom && (
                                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                      Custom
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {allCourses.length === 0 && (
                        <div className="text-center py-12 text-slate-400">
                          No courses found
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
