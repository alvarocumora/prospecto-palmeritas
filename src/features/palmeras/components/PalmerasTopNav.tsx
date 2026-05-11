import { Download } from "lucide-react";
import { PALMERAS_PROJECT } from "../data/project";
import { PALMERAS_TABS } from "../data/tabs";
import type { PalmerasTabId } from "../types";
import { SignalDot } from "./primitives/SignalDot";

type PalmerasTopNavProps = {
  active: PalmerasTabId;
  setActive: (tab: PalmerasTabId) => void;
  onExport: () => void;
  exporting: boolean;
};

export function PalmerasTopNav({ active, setActive, onExport, exporting }: PalmerasTopNavProps) {
  return (
    <header className="sticky top-0 z-40 bg-bg-secondary/95 backdrop-blur border-b border-border">
      <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-8">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xl font-bold text-gold tracking-tight">TRACKMIN</span>
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">GeoIntel</span>
        </div>

        <nav className="flex items-center gap-1 flex-1 overflow-x-auto">
          {PALMERAS_TABS.map((tab) => {
            const isActive = active === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActive(tab.id)}
                className={`px-3 py-2 font-mono text-xs uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${
                  isActive
                    ? "text-gold border-gold"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-card">
            <span className="font-mono text-xs text-gold">{PALMERAS_PROJECT.ref}</span>
            <span className="w-px h-4 bg-border" />
            <SignalDot tone="teal" />
            <span className="font-mono text-[11px] uppercase text-muted-foreground tracking-wider">
              {PALMERAS_PROJECT.status}
            </span>
          </div>

          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10 font-mono text-xs uppercase tracking-wider transition-colors disabled:opacity-60 disabled:cursor-wait"
          >
            <Download className={`w-3.5 h-3.5 ${exporting ? "animate-pulse" : ""}`} />
            {exporting ? "Generando…" : "Exportar PDF"}
          </button>
        </div>
      </div>
    </header>
  );
}
