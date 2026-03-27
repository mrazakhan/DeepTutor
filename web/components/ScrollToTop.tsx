"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Scrolls the main content area to top on every route change.
 * Place inside the layout near <main>.
 */
export default function ScrollToTop() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Scroll the main element (overflow-y-auto) to top
    const main = document.querySelector("main");
    if (main) main.scrollTop = 0;
    // Also window scroll for pages that use body scroll
    window.scrollTo(0, 0);
  }, [pathname, searchParams]);

  return null;
}
