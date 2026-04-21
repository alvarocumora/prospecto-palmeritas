import { useState, type ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function HudPanel({
  title,
  children,
  collapsible = false,
  defaultOpen = true,
  onClose,
  className,
  accent = "cyan",
}: {
  title?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  onClose?: () => void;
  className?: string;
  accent?: "cyan" | "amber" | "red" | "green" | "violet" | "none";
}) {
  const [open, setOpen] = useState(defaultOpen);
  const accentClass =
    accent === "amber" ? "before:bg-signal-amber"
    : accent === "red" ? "before:bg-signal-red"
    : accent === "green" ? "before:bg-signal-green"
    : accent === "violet" ? "before:bg-signal-violet"
    : accent === "none" ? "before:bg-transparent"
    : "before:bg-signal-cyan";
  return (
    <div
      className={cn(
        "ops-hud relative rounded-[2px] overflow-hidden",
        "before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px]",
        accentClass,
        className,
      )}
    >
      {(title || onClose || collapsible) && (
        <div className="flex items-center justify-between gap-2 px-2.5 h-7 border-b border-border bg-bg-panel/60">
          {title && (
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-mono truncate">
              {title}
            </div>
          )}
          <div className="flex items-center gap-1">
            {collapsible && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="p-0.5 text-text-dim hover:text-foreground transition-colors"
                aria-label={open ? "Colapsar" : "Expandir"}
              >
                <ChevronDown className={cn("w-3 h-3 transition-transform", !open && "-rotate-90")} />
              </button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-0.5 text-text-dim hover:text-signal-red transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}
      {open && <div className="p-2.5">{children}</div>}
    </div>
  );
}
