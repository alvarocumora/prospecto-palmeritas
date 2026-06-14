// QA/QC Panel — Sprint 4
// Lista issues por severidad con filtros y resumen. Botón de exportar JSON.
import { useMemo, useState } from "react";
import { X, AlertOctagon, AlertTriangle, Info, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QAQCResult, IssueSeverity, IssueDataset } from "@/engine3d/qaqc/qaqc.worker";

type Props = {
  result: QAQCResult | null;
  busy: boolean;
  onClose: () => void;
};

const SEV_META: Record<IssueSeverity, { color: string; bg: string; icon: typeof AlertOctagon }> = {
  critical: { color: "text-red-300", bg: "bg-red-500/15 border-red-500/30", icon: AlertOctagon },
  warning: {
    color: "text-amber-300",
    bg: "bg-amber-500/15 border-amber-500/30",
    icon: AlertTriangle,
  },
  info: { color: "text-sky-300", bg: "bg-sky-500/15 border-sky-500/30", icon: Info },
};

export function QAQCPanel({ result, busy, onClose }: Props) {
  const [sev, setSev] = useState<IssueSeverity | "all">("all");
  const [ds, setDs] = useState<IssueDataset | "all">("all");

  const issues = useMemo(() => {
    if (!result) return [];
    return result.issues.filter(
      (i) => (sev === "all" || i.severity === sev) && (ds === "all" || i.dataset === ds),
    );
  }, [result, sev, ds]);

  function downloadJson() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qaqc-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="absolute inset-2 z-30 bg-black/95 backdrop-blur rounded-lg border border-border flex flex-col font-mono text-[11px]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 text-amber-300 uppercase tracking-wider text-[10px]">
          <AlertTriangle className="w-3.5 h-3.5" /> QA/QC · validación de sondajes
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px]"
            onClick={downloadJson}
            disabled={!result}
          >
            <Download className="w-3 h-3 mr-1" /> JSON
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-border grid grid-cols-3 gap-2 text-[10px]">
        <Stat label="Critical" value={result?.summary.critical ?? 0} cls="text-red-300" />
        <Stat label="Warnings" value={result?.summary.warning ?? 0} cls="text-amber-300" />
        <Stat label="Info" value={result?.summary.info ?? 0} cls="text-sky-300" />
        <Stat label="Holes" value={result?.summary.totalHoles ?? 0} cls="text-muted-foreground" />
        <Stat label="Assays" value={result?.summary.totalAssays ?? 0} cls="text-muted-foreground" />
        <Stat label="Hash" value={result?.summary.hash ?? "—"} cls="text-emerald-300" />
      </div>

      <div className="px-3 py-2 border-b border-border flex flex-wrap gap-1">
        {(["all", "critical", "warning", "info"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={sev === s ? "default" : "outline"}
            className="h-6 text-[10px] px-2"
            onClick={() => setSev(s)}
          >
            {s}
          </Button>
        ))}
        <span className="mx-1 text-muted-foreground">·</span>
        {(["all", "collar", "survey", "assay", "lithology", "global"] as const).map((d) => (
          <Button
            key={d}
            size="sm"
            variant={ds === d ? "default" : "outline"}
            className="h-6 text-[10px] px-2"
            onClick={() => setDs(d)}
          >
            {d}
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {busy && <div className="text-amber-300">Validando…</div>}
        {!busy && !result && (
          <div className="text-muted-foreground">
            Importa un bundle CSV de sondajes (Block Model → Import CSV holes) para correr QA/QC.
          </div>
        )}
        {!busy && result && issues.length === 0 && (
          <div className="text-emerald-300">Sin issues con los filtros actuales ✓</div>
        )}
        {issues.map((iss) => {
          const meta = SEV_META[iss.severity];
          const Icon = meta.icon;
          return (
            <div key={iss.id} className={`rounded border px-2 py-1.5 ${meta.bg}`}>
              <div className={`flex items-center gap-1.5 ${meta.color} text-[10px] uppercase`}>
                <Icon className="w-3 h-3" /> {iss.severity} · {iss.dataset}
                {iss.holeId && <span className="text-foreground/80">· {iss.holeId}</span>}
                {iss.interval && (
                  <span className="text-foreground/80">
                    · {iss.interval.from.toFixed(1)}–{iss.interval.to.toFixed(1)} m
                  </span>
                )}
              </div>
              <div className="text-foreground/90 mt-0.5">{iss.message}</div>
              {iss.suggestedFix && (
                <div className="text-muted-foreground italic mt-0.5">→ {iss.suggestedFix}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: number | string; cls: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground uppercase text-[9px]">{label}</span>
      <span className={`text-[12px] font-bold ${cls}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
    </div>
  );
}
