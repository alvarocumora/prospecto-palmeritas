import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";

/**
 * Scroll-reveal wrapper. Adds `.reveal-in` when the element first enters the
 * viewport, driving the CSS transition defined in `.brand-light .reveal`.
 *
 * Respects `prefers-reduced-motion` automatically: the CSS guard reveals the
 * content immediately, and we also skip the observer to avoid layout churn.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
  once = true,
}: {
  children: ReactNode;
  /** Stagger delay in milliseconds. */
  delay?: number;
  className?: string;
  once?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setVisible(false);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [once]);

  return (
    <div
      ref={ref}
      className={`reveal${visible ? " reveal-in" : ""} ${className}`.trim()}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
