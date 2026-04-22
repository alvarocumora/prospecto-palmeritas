import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function CollapsibleSection({
  title,
  defaultOpen = false,
  count,
  children,
  className,
  mobileOnly = false,
}: {
  title: string;
  defaultOpen?: boolean;
  count?: number;
  children: ReactNode;
  className?: string;
  /** When true, behaves as collapsible only on mobile; always open on md+. */
  mobileOnly?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (mobileOnly) {
    return (
      <div className={className}>
        {/* Mobile: collapsible */}
        <div className="md:hidden">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 border border-border rounded bg-bg-secondary/40 active:bg-bg-elevated"
          >
            <span className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">
              {title}
              {typeof count === "number" && <span className="ml-1.5 text-text-dim">({count})</span>}
            </span>
            <ChevronDown className={cn("w-4 h-4 text-text-dim transition-transform", open && "rotate-180")} />
          </button>
          {open && <div className="mt-2">{children}</div>}
        </div>
        {/* Desktop: always shown */}
        <div className="hidden md:block">{children}</div>
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 border border-border rounded bg-bg-secondary/40 active:bg-bg-elevated"
      >
        <span className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">
          {title}
          {typeof count === "number" && <span className="ml-1.5 text-text-dim">({count})</span>}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-text-dim transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
