"use client";

import { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";

/**
 * Floating "scroll to top" button that appears when the user scrolls down.
 * Targets the <main> element (overflow container).
 */
export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;

    const handleScroll = () => {
      setVisible(main.scrollTop > 400);
    };

    main.addEventListener("scroll", handleScroll, { passive: true });
    return () => main.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => {
        const main = document.querySelector("main");
        if (main) main.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className="fixed bottom-6 right-6 z-40 w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg flex items-center justify-center text-slate-500 hover:text-blue-500 hover:border-blue-300 transition-all hover:scale-110"
      title="Scroll to top"
    >
      <ChevronUp className="w-5 h-5" />
    </button>
  );
}
