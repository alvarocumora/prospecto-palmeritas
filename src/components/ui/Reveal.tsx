import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/**
 * Scroll-reveal wrapper. Adds `.reveal-in` when the element first enters the
 * viewport, driving the CSS transition defined in `.brand-light .reveal`.
 *
 * Respects `prefers-reduced-motion` automatically: the CSS guard reveals the
 * content immediately, and we also skip the observer to avoid layout churn.
 */
export function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  className = "",
  once = true,
}: {
  children: ReactNode;
  as?: ElementType;
  /** Stagger delay in milliseconds. */
  delay?: number;
  className?: string;
  once?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);
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
    <Tag
      ref={ref}
      className={`reveal${visible ? " reveal-in" : ""} ${className}`.trim()}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
