"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function ScrollToTopInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const main = document.querySelector("main");
    if (main) main.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [pathname, searchParams]);

  return null;
}

/**
 * Scrolls the main content area to top on every route change.
 * Wrapped in Suspense to support static page generation.
 */
export default function ScrollToTop() {
  return (
    <Suspense fallback={null}>
      <ScrollToTopInner />
    </Suspense>
  );
}
