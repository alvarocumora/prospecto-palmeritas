import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  format?: "int" | "compact";
  className?: string;
};

/* Count-up animado, arranca cuando entra al viewport. */
export function AnimatedCounter({
  value,
  duration = 1400,
  prefix = "",
  suffix = "",
  format = "int",
  className = "",
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(value);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !started.current) {
            started.current = true;
            const start = performance.now();
            const tick = (now: number) => {
              const p = Math.min(1, (now - start) / duration);
              // easeOutCubic
              const eased = 1 - Math.pow(1 - p, 3);
              setDisplay(Math.round(value * eased));
              if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
            io.disconnect();
          }
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);

  const formatted =
    format === "compact"
      ? new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(
          display,
        )
      : display.toLocaleString();

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
