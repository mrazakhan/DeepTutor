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
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  role: string;
  created_at: string | null;
  last_login_at: string | null;
  total_questions: number;
  correct_answers: number;
  topics_assessed: number;
  favorites_count: number;
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

type Tab = "users" | "sessions" | "overview";

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

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetResult, setResetResult] = useState<{ username: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Redirect non-admins
  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/");
    }
  }, [user, router]);

  const headers = useCallback(() => {
    const token = localStorage.getItem("deeptutor_token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, sessionsRes, statsRes] = await Promise.all([
        fetch(apiUrl("/api/v1/admin/users"), { headers: headers() }),
        fetch(apiUrl("/api/v1/admin/sessions"), { headers: headers() }),
        fetch(apiUrl("/api/v1/admin/stats"), { headers: headers() }),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (sessionsRes.ok) setSessions(await sessionsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (err) {
      console.error("Failed to load admin data:", err);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (user?.role === "admin") loadData();
  }, [user, loadData]);

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
    } catch { /* skip */ }
  }

  async function handleResetPassword(userId: string) {
    try {
      const res = await fetch(apiUrl(`/api/v1/admin/users/${userId}/reset-password`), {
        method: "POST",
        headers: headers(),
      });
      if (res.ok) {
        const data = await res.json();
        setResetResult({ username: data.username, password: data.temp_password });
        setCopied(false);
      }
    } catch { /* skip */ }
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
    { id: "sessions", label: "Sessions", icon: Activity },
    { id: "overview", label: "Overview", icon: BarChart3 },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-500" />
          Admin Dashboard
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Manage users, monitor sessions, and view platform stats
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
                  New password for <span className="font-medium text-slate-700 dark:text-slate-300">{resetResult.username}</span>:
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
                  Share this password securely. The user&apos;s existing sessions have been invalidated.
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

          {/* Users Tab */}
          {tab === "users" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                    <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400">User</th>
                    <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400">Role</th>
                    <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400">Joined</th>
                    <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400">Last Login</th>
                    <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400 text-right">Questions</th>
                    <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400 text-right">Accuracy</th>
                    <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{u.display_name}</div>
                        <div className="text-xs text-slate-400">@{u.username}</div>
                      </td>
                      <td className="py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          u.role === "admin"
                            ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 text-slate-500 dark:text-slate-400 text-xs">{formatDate(u.created_at)}</td>
                      <td className="py-3 text-slate-500 dark:text-slate-400 text-xs">{formatDate(u.last_login_at)}</td>
                      <td className="py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {u.total_questions > 0 ? u.total_questions : "—"}
                      </td>
                      <td className="py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {u.total_questions > 0
                          ? `${Math.round((u.correct_answers / u.total_questions) * 100)}%`
                          : "—"}
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
                          {u.role !== "admin" && (
                            confirmDelete === u.id ? (
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
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <div className="text-center py-12 text-slate-400">No users found</div>
              )}
            </div>
          )}

          {/* Sessions Tab */}
          {tab === "sessions" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                    <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400">User</th>
                    <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400">Role</th>
                    <th className="pb-3 font-semibold text-slate-500 dark:text-slate-400">Expires In</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s, i) => (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{s.display_name}</div>
                        <div className="text-xs text-slate-400">@{s.username}</div>
                      </td>
                      <td className="py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          s.role === "admin"
                            ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        }`}>
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
                <div className="text-center py-12 text-slate-400">No active sessions</div>
              )}
            </div>
          )}

          {/* Overview Tab */}
          {tab === "overview" && stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Users", value: stats.total_users, sub: `${stats.students} students, ${stats.admins} admins` },
                { label: "Active Sessions", value: stats.active_sessions },
                { label: "Questions Answered", value: stats.total_questions },
                { label: "Overall Accuracy", value: stats.total_questions > 0 ? `${Math.round((stats.total_correct / stats.total_questions) * 100)}%` : "—" },
              ].map((card) => (
                <div
                  key={card.label}
                  className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                    {card.value}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">{card.label}</div>
                  {card.sub && (
                    <div className="text-xs text-slate-400 mt-1">{card.sub}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
