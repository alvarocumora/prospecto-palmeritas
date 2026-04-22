import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MobileFAB({
  onClick,
  icon,
  label,
  className,
}: {
  onClick: () => void;
  icon: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "md:hidden fixed right-4 z-40 inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 active:scale-95 transition-transform",
        className,
      )}
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 4rem)" }}
    >
      {icon}
    </button>
  );
}
