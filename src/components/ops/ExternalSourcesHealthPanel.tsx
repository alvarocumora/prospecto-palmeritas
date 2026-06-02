import { HudPanel } from "@/components/ops/HudPanel";
import { useExternalSourcesHealth } from "@/hooks/useExternalSourcesHealth";
import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";

const OVERALL_STYLES = {
  healthy: { label: "OPERATIVO", cls: "text-signal-green border-signal-green/40 bg-signal-green/10" },
  degraded: { label: "DEGRADADO", cls: "text-signal-amber border-signal-amber/40 bg-signal-amber/10" },
  down: { label: "CAÍDO", cls: "text-destructive border-destructive/40 bg-destructive/10" },
} as const;

export function ExternalSourcesHealthPanel() {
  const { data, isLoading, error, refetch, isFetching } = useExternalSourcesHealth();

  return (
    <HudPanel title="Estado de fuentes externas" accent="cyan" className="bg-bg-panel/40">
      <div className="flex items-center justify-between mb-3">
        {data && (
          <span
            className={`px-2 py-0.5 border rounded-[2px] text-[10px] font-mono uppercase tracking-wider ${OVERALL_STYLES[data.overall].cls}`}
          >
            {OVERALL_STYLES[data.overall].label}
          </span>
        )}
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-[10px] font-mono uppercase text-text-dim hover:text-foreground disabled:opacity-50"
        >
          {isFetching ? "Probing…" : "Re-probar"}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-[11px] font-mono text-text-dim">
          <Loader2 className="w-3 h-3 animate-spin" /> Consultando endpoints…
        </div>
      ) : error ? (
        <div className="text-[11px] font-mono text-destructive">
          No se pudo obtener el estado: {(error as Error).message}
        </div>
      ) : (
        <div className="border border-border rounded-[2px] divide-y divide-border">
          {data?.sources.map((s) => {
            const Icon = s.ok ? CheckCircle2 : s.kind === "fallback" ? AlertTriangle : XCircle;
            const color = s.ok
              ? "text-signal-green"
              : s.kind === "fallback"
                ? "text-signal-amber"
                : "text-destructive";
            return (
              <div key={s.id} className="px-2.5 py-2 flex items-center gap-2">
                <Icon className={`w-3.5 h-3.5 shrink-0 ${color}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-mono truncate">{s.label}</div>
                  <div className="text-[10px] text-text-dim font-mono">
                    {s.latencyMs} ms
                    {s.status ? ` · HTTP ${s.status}` : ""}
                    {s.total != null ? ` · ${s.total.toLocaleString("es-CL")} features` : ""}
                    {s.error ? ` · ${s.error.slice(0, 80)}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {data && (
        <div className="mt-2 text-[10px] font-mono text-text-dim">
          Último chequeo: {new Date(data.checked_at).toLocaleString("es-CL")}
        </div>
      )}
    </HudPanel>
  );
}
