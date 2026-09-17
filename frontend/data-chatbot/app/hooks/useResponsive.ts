"use client";

import { useState, useEffect } from "react";

export interface UseResponsiveReturn {
  isMobile: boolean;
  viewportWidth: number;
}

const MOBILE_BREAKPOINT = 768;

export function useResponsive(): UseResponsiveReturn {
  const [isMobile, setIsMobile] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    const handleMediaChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };

    // Set initial value
    handleMediaChange(mql);
    setViewportWidth(window.innerWidth);

    // Listen for breakpoint changes
    mql.addEventListener("change", handleMediaChange);

    // Track viewport width on resize
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      mql.removeEventListener("change", handleMediaChange);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return { isMobile, viewportWidth };
}
