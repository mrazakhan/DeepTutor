"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Home,
  Settings,
  Github,
  Globe,
  ChevronsLeft,
  ChevronsRight,
  Check,
  X,
  Library,
  Map,
  Shield,
  KeyRound,
  Loader2,
  LucideIcon,
  BarChart3,
} from "lucide-react";
import { useGlobal } from "@/context/GlobalContext";
import { useAuth } from "@/lib/auth";
import { apiUrl } from "@/lib/api";

const SIDEBAR_EXPANDED_WIDTH = 256;
const SIDEBAR_COLLAPSED_WIDTH = 64;

// Navigation item type
interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

// All available navigation items (static reference)
const ALL_NAV_ITEMS: Record<string, { icon: LucideIcon; nameKey: string; color: string }> = {
  "/": { icon: Home, nameKey: "Home", color: "text-blue-500 dark:text-blue-400" },
  "/courses": { icon: Library, nameKey: "AP Courses", color: "text-violet-500 dark:text-violet-400" },
  "/progress": { icon: BarChart3, nameKey: "My Progress", color: "text-emerald-500 dark:text-emerald-400" },
  "/counseling": { icon: Map, nameKey: "Counseling", color: "text-amber-500 dark:text-amber-400" },
};

export default function Sidebar() {
  const pathname = usePathname();
  const {
    sidebarCollapsed,
    toggleSidebar,
    sidebarDescription,
    setSidebarDescription,
    sidebarNavOrder,
    setSidebarNavOrder,
  } = useGlobal();
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  // Change password state
  const [showChangePw, setShowChangePw] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  async function handleChangePassword() {
    setPwError("");
    if (newPw.length < 6) { setPwError("Password must be at least 6 characters"); return; }
    if (newPw !== confirmPw) { setPwError("Passwords do not match"); return; }
    setPwLoading(true);
    try {
      const token = localStorage.getItem("deeptutor_token");
      const res = await fetch(apiUrl("/api/v1/auth/change-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPwError(data.detail || "Failed to change password");
      } else {
        setPwSuccess(true);
        setTimeout(() => { setShowChangePw(false); setPwSuccess(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }, 1500);
      }
    } catch { setPwError("Connection error"); }
    finally { setPwLoading(false); }
  }

  // Editable description state
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editingDescriptionValue, setEditingDescriptionValue] =
    useState(sidebarDescription);
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  // Build navigation items from saved order, plus admin if applicable
  const navItems = useMemo(() => {
    const items = sidebarNavOrder.start
      .filter((href) => ALL_NAV_ITEMS[href])
      .map((href) => ({
        name: t(ALL_NAV_ITEMS[href].nameKey),
        href,
        icon: ALL_NAV_ITEMS[href].icon,
      }));
    // Add admin dashboard for admin users
    if (user?.role === "admin") {
      items.push({ name: t("Admin"), href: "/admin", icon: Shield });
    }
    return items;
  }, [sidebarNavOrder, t, user]);

  // Handle description edit
  const handleDescriptionEdit = () => {
    setEditingDescriptionValue(sidebarDescription);
    setIsEditingDescription(true);
  };

  const handleDescriptionSave = () => {
    setSidebarDescription(
      editingDescriptionValue.trim() || t("✨ Your description here"),
    );
    setIsEditingDescription(false);
  };

  const handleDescriptionCancel = () => {
    setEditingDescriptionValue(sidebarDescription);
    setIsEditingDescription(false);
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleDescriptionSave();
    } else if (e.key === "Escape") {
      handleDescriptionCancel();
    }
  };

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingDescription && descriptionInputRef.current) {
      descriptionInputRef.current.focus();
      descriptionInputRef.current.select();
    }
  }, [isEditingDescription]);

  const currentWidth = sidebarCollapsed
    ? SIDEBAR_COLLAPSED_WIDTH
    : SIDEBAR_EXPANDED_WIDTH;

  return (
    <div
      className="relative flex-shrink-0 bg-slate-50/80 dark:bg-slate-800/80 h-full border-r border-slate-200 dark:border-slate-700 flex flex-col transition-all duration-300 ease-in-out overflow-hidden"
      style={{ width: currentWidth }}
    >
      {/* Header */}
      <div
        className={`border-b border-slate-100 dark:border-slate-700 transition-all duration-300 ${
          sidebarCollapsed ? "px-2 py-3" : "px-4 py-3"
        }`}
      >
        <div className="flex flex-col gap-2">
          <div
            className={`flex items-center ${sidebarCollapsed ? "justify-center" : "justify-between"}`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                <Image
                  src="/logo.svg"
                  alt={t("DeepTutor Logo")}
                  width={32}
                  height={32}
                  className="object-contain"
                  priority
                />
              </div>
              <h1
                className={`font-bold text-slate-900 dark:text-slate-100 tracking-tight text-base whitespace-nowrap transition-all duration-300 ${
                  sidebarCollapsed
                    ? "opacity-0 w-0 overflow-hidden"
                    : "opacity-100"
                }`}
              >
                DeepTutor++
              </h1>
            </div>
            <div
              className={`flex items-center gap-0.5 transition-all duration-300 ${
                sidebarCollapsed
                  ? "opacity-0 w-0 overflow-hidden"
                  : "opacity-100"
              }`}
            >
              {/* Collapse button */}
              <button
                onClick={toggleSidebar}
                className="text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                title={t("Collapse sidebar")}
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <a
                href="https://hkuds.github.io/DeepTutor/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                title={t("Visit DeepTutor Homepage")}
              >
                <Globe className="w-4 h-4" />
              </a>
              <a
                href="https://github.com/HKUDS/DeepTutor"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                title={t("View on GitHub")}
              >
                <Github className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Editable Description - only show when expanded */}
          <div
            className={`transition-all duration-300 ${
              sidebarCollapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"
            }`}
          >
            {isEditingDescription ? (
              <div className="flex items-center gap-1">
                <input
                  ref={descriptionInputRef}
                  type="text"
                  value={editingDescriptionValue}
                  onChange={(e) => setEditingDescriptionValue(e.target.value)}
                  onKeyDown={handleDescriptionKeyDown}
                  className="flex-1 text-[10px] font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-600 px-2 py-1.5 rounded-md border border-blue-300 dark:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder={t("Enter your description...")}
                />
                <button
                  onClick={handleDescriptionSave}
                  className="p-1 text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300"
                  title={t("Save")}
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleDescriptionCancel}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  title={t("Cancel")}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                onClick={handleDescriptionEdit}
                className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-700/50 px-2 py-1.5 rounded-md border border-slate-100 dark:border-slate-600 truncate cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-200 dark:hover:border-slate-500 transition-colors group"
                title={t("Click to edit")}
              >
                <span className="group-hover:hidden">{sidebarDescription}</span>
                <span className="hidden group-hover:inline text-blue-500 dark:text-blue-400">
                  ✏️ {t("Click to edit")}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav
        className={`flex-1 overflow-y-auto py-2 transition-all duration-300 px-2`}
      >
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <div key={item.href} className="group relative">
                <Link
                  href={item.href}
                  title={sidebarCollapsed ? item.name : undefined}
                  className={`flex items-center rounded-md border transition-all duration-200 ${
                    sidebarCollapsed
                      ? "justify-center p-2"
                      : "gap-2.5 pl-2 pr-1.5 py-2"
                  } ${
                    isActive
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm border-slate-100 dark:border-slate-600"
                      : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 hover:shadow-sm border-transparent hover:border-slate-100 dark:hover:border-slate-600"
                  }`}
                  onMouseEnter={() =>
                    sidebarCollapsed && setShowTooltip(item.href)
                  }
                  onMouseLeave={() => setShowTooltip(null)}
                >
                  <item.icon
                    className={`w-5 h-5 flex-shrink-0 transition-colors ${
                      isActive
                        ? (ALL_NAV_ITEMS[item.href]?.color || "text-blue-500 dark:text-blue-400")
                        : (ALL_NAV_ITEMS[item.href]?.color || "text-slate-400 dark:text-slate-500") + " opacity-60 group-hover:opacity-100"
                    }`}
                  />
                  <span
                    className={`font-medium text-sm whitespace-nowrap flex-1 transition-all duration-300 ${
                      sidebarCollapsed
                        ? "opacity-0 w-0 overflow-hidden"
                        : "opacity-100"
                    }`}
                  >
                    {item.name}
                  </span>
                </Link>
                {/* Tooltip for collapsed state */}
                {sidebarCollapsed && showTooltip === item.href && (
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1.5 bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
                    {item.name}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900 dark:border-r-slate-700" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div
        className={`border-t border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30 transition-all duration-300 ${
          sidebarCollapsed ? "px-2 py-2" : "px-2 py-2"
        }`}
      >
        <div className="relative">
          <Link
            href="/settings"
            className={`flex items-center rounded-md text-sm transition-all duration-200 ${
              sidebarCollapsed
                ? "justify-center p-2"
                : "gap-2.5 pl-2 pr-1.5 py-2"
            } ${
              pathname === "/settings"
                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-100 dark:border-slate-600"
                : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
            onMouseEnter={() => sidebarCollapsed && setShowTooltip("/settings")}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <Settings
              className={`w-5 h-5 flex-shrink-0 transition-colors ${
                pathname === "/settings"
                  ? "text-blue-500 dark:text-blue-400"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            />
            <span
              className={`whitespace-nowrap flex-1 transition-all duration-300 ${
                sidebarCollapsed
                  ? "opacity-0 w-0 overflow-hidden"
                  : "opacity-100"
              }`}
            >
              {t("Settings")}
            </span>
          </Link>
          {/* Tooltip for collapsed state */}
          {sidebarCollapsed && showTooltip === "/settings" && (
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1.5 bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
              {t("Settings")}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900 dark:border-r-slate-700" />
            </div>
          )}
        </div>

        {/* User info */}
        {user ? (
          <>
          <div
            className={`flex items-center rounded-md text-slate-500 dark:text-slate-400 ${
              sidebarCollapsed ? "justify-center p-2" : "gap-2.5 px-2 py-2"
            }`}
          >
            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-blue-600 dark:text-blue-400">
              {user.display_name[0]}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                  {user.display_name}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowChangePw(true)}
                    className="text-[10px] text-slate-400 hover:text-blue-500 transition-colors"
                  >
                    {t("Change password")}
                  </button>
                  <span className="text-[10px] text-slate-300 dark:text-slate-600">·</span>
                  <button
                    onClick={logout}
                    className="text-[10px] text-slate-400 hover:text-red-500 transition-colors"
                  >
                    {t("Sign out")}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Change Password Modal */}
          {showChangePw && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-slate-800 rounded-xl p-5 max-w-sm w-full mx-4 shadow-xl">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-blue-500" />
                  {t("Change Password")}
                </h3>
                <div className="space-y-3">
                  <input
                    type="password"
                    placeholder={t("Current password")}
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <input
                    type="password"
                    placeholder={t("New password (min 6 chars)")}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <input
                    type="password"
                    placeholder={t("Confirm new password")}
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  {pwError && <p className="text-xs text-red-500">{pwError}</p>}
                  {pwSuccess && <p className="text-xs text-green-500">✓ Password changed!</p>}
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleChangePassword}
                    disabled={pwLoading || !currentPw || !newPw || !confirmPw}
                    className="flex-1 px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {pwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Change Password")}
                  </button>
                  <button
                    onClick={() => { setShowChangePw(false); setPwError(""); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }}
                    className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    {t("Cancel")}
                  </button>
                </div>
              </div>
            </div>
          )}
          </>
        ) : (
          <Link
            href="/login"
            className={`flex items-center rounded-md text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:text-blue-500 transition-all duration-200 ${
              sidebarCollapsed ? "justify-center p-2" : "gap-2.5 px-2 py-2"
            }`}
          >
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-xs">
              👤
            </div>
            {!sidebarCollapsed && (
              <span className="text-sm">{t("Sign in")}</span>
            )}
          </Link>
        )}

        {/* Expand/Collapse button at bottom */}
        <button
          onClick={toggleSidebar}
          className={`w-full mt-2 flex items-center rounded-md text-slate-400 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-700 hover:text-blue-500 dark:hover:text-blue-400 hover:shadow-sm border border-transparent hover:border-slate-100 dark:hover:border-slate-600 transition-all duration-200 ${
            sidebarCollapsed ? "justify-center p-2" : "gap-2.5 pl-2 pr-1.5 py-2"
          }`}
          title={sidebarCollapsed ? t("Expand sidebar") : t("Collapse sidebar")}
        >
          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            {sidebarCollapsed ? (
              <ChevronsRight className="w-4 h-4" />
            ) : (
              <ChevronsLeft className="w-4 h-4" />
            )}
          </div>
          <span
            className={`text-sm whitespace-nowrap flex-1 transition-all duration-300 ${
              sidebarCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
            }`}
          >
            {t("Collapse sidebar")}
          </span>
        </button>
      </div>
    </div>
  );
}
