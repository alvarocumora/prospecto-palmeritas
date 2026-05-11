import type { ReactNode } from "react";
import type { PalmerasCardAccent } from "../../types";

type CardProps = {
  children: ReactNode;
  className?: string;
  accent?: PalmerasCardAccent;
  delay?: number;
};

export function Card({ children, className = "", accent, delay = 0 }: CardProps) {
  const accentClass =
    accent === "gold"
      ? "accent-bar-gold"
      : accent === "copper"
        ? "accent-bar-copper"
        : accent === "muted"
          ? "accent-bar-muted"
          : "";

  return (
    <div
      className={`bg-card border border-border rounded-lg card-hover animate-fade-up ${accentClass} ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
