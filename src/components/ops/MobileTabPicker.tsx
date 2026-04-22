import { useState } from "react";
import { ChevronDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type MobileTab<T extends string> = {
  id: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
};

export function MobileTabPicker<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: ReadonlyArray<MobileTab<T>>;
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = tabs.find((t) => t.id === value) ?? tabs[0];
  const Icon = current?.icon;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "md:hidden inline-flex items-center justify-between w-full gap-2 px-3 h-10 rounded border border-border bg-bg-secondary text-sm font-mono uppercase tracking-wider active:scale-[0.98] transition-transform",
          className,
        )}
      >
        <span className="inline-flex items-center gap-2 text-signal-cyan">
          {Icon && <Icon className="w-4 h-4" />}
          {current?.label}
        </span>
        <ChevronDown className="w-4 h-4 text-text-dim" />
      </button>

      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end" role="dialog">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            className="relative w-full bg-bg-panel border-t border-border rounded-t-lg animate-fade-up max-h-[70vh] overflow-y-auto"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="sticky top-0 bg-bg-panel flex items-center justify-between px-4 h-11 border-b border-border">
              <span className="font-mono text-[11px] uppercase tracking-wider text-text-dim">Sección</span>
              <button type="button" onClick={() => setOpen(false)} className="p-1 text-text-dim">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="py-1">
              {tabs.map((t) => {
                const TIcon = t.icon;
                const active = t.id === value;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onChange(t.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 h-12 text-left text-sm font-mono uppercase tracking-wider active:bg-bg-elevated",
                      active ? "text-signal-cyan" : "text-text-mono",
                    )}
                  >
                    {TIcon && <TIcon className="w-4 h-4" />}
                    <span className="flex-1">{t.label}</span>
                    {active && <Check className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
