import { useEffect, useState } from "react";

/**
 * Tracks the user's `prefers-reduced-motion` setting and reacts to changes.
 * Returns `true` when the user has requested reduced motion, so callers can
 * skip non-essential animations (auto-advancing carousels, timers, etc.).
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
