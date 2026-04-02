"use client";

import { Menu } from "lucide-react";
import { useGlobal } from "@/context/GlobalContext";

export default function MobileMenuButton() {
  const { setMobileSidebarOpen } = useGlobal();

  return (
    <button
      className="md:hidden fixed top-3 left-3 z-30 p-2 rounded-lg bg-white dark:bg-slate-800 shadow border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
      onClick={() => setMobileSidebarOpen(true)}
      aria-label="Open menu"
    >
      <Menu className="w-5 h-5" />
    </button>
  );
}
