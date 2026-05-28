// Tabs dock — Sprint 4
// Barra superior derecha que activa los paneles overlay.
import { Eye, Scissors, Boxes, AlertTriangle, FileText, History, Settings, Brain, Crosshair, FileBarChart } from "lucide-react";

export type EngineTab =
  | "viewer"
  | "section"
  | "resource"
  | "qaqc"
  | "ni43101"
  | "audit"
  | "estimation"
  | "ai"
  | "targets"
  | "reports";

const TABS: { id: EngineTab; label: string; icon: typeof Eye; cls: string }[] = [
  { id: "viewer", label: "Viewer", icon: Eye, cls: "text-orange-300" },
  { id: "section", label: "Section", icon: Scissors, cls: "text-cyan-300" },
  { id: "resource", label: "Resource", icon: Boxes, cls: "text-amber-300" },
  { id: "estimation", label: "Estim.", icon: Settings, cls: "text-emerald-300" },
  { id: "qaqc", label: "QA/QC", icon: AlertTriangle, cls: "text-amber-300" },
  { id: "ai", label: "AI Geologist", icon: Brain, cls: "text-violet-300" },
  { id: "targets", label: "Targets", icon: Crosshair, cls: "text-cyan-300" },
  { id: "reports", label: "Reports", icon: FileBarChart, cls: "text-amber-300" },
  { id: "ni43101", label: "NI 43-101", icon: FileText, cls: "text-gold" },
  { id: "audit", label: "Audit", icon: History, cls: "text-violet-300" },
];

type Props = {
  active: EngineTab;
  onChange: (t: EngineTab) => void;
  badges?: Partial<Record<EngineTab, number | string>>;
};

export function EngineTabsDock({ active, onChange, badges = {} }: Props) {
  return (
    <div className="absolute top-2 right-2 z-20 flex flex-col gap-1 bg-black/70 backdrop-blur rounded-md border border-border p-1">
      {TABS.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.id;
        const badge = badges[t.id];
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`relative flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
              isActive
                ? "bg-white/10 text-foreground border border-border"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            <Icon className={`w-3 h-3 ${isActive ? t.cls : ""}`} />
            <span>{t.label}</span>
            {badge !== undefined && badge !== 0 && badge !== "" && (
              <span className="ml-auto text-[9px] bg-red-500/80 text-white rounded px-1 leading-none py-0.5">
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
