import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, Loader2, Plus, Radar, Sparkles, Trash2 } from "lucide-react";
import { useInsarDisplacement, type InsarPoint } from "@/hooks/useInsarDisplacement";
import { seedInsarMonitoring, explainInsarPattern } from "@/lib/satelliteIntel.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Asset = {
  id: string;
  name: string;
  type: "tailings_dam" | "open_pit" | "waste_dump" | "leach_pad" | "infrastructure";
  lat: number;
  lng: number;
};

type Props = {
  projectId: string;
  defaultCenter?: [number, number] | null; // [lat, lng]
};

const SEVERITY_STYLES: Record<string, string> = {
  info: "bg-text-dim/20 text-text-secondary border-text-dim/30",
  watch: "bg-signal-cyan/20 text-signal-cyan border-signal-cyan/40",
  warning: "bg-signal-amber/20 text-signal-amber border-signal-amber/40",
  critical: "bg-red-500/20 text-red-400 border-red-500/40",
};

const SEVERITY_LABEL: Record<string, string> = {
  info: "Estable",
  watch: "Vigilancia",
  warning: "Alerta",
  critical: "Crítico",
};

const ASSET_TYPE_LABEL: Record<Asset["type"], string> = {
  tailings_dam: "Relave",
  open_pit: "Rajo",
  waste_dump: "Botadero",
  leach_pad: "Pila lixiviación",
  infrastructure: "Infraestructura",
};

export function InsarMonitoringPanel({ projectId, defaultCenter }: Props) {
  const { points, loading, refresh } = useInsarDisplacement(projectId);
  const seedFn = useServerFn(seedInsarMonitoring);
  const explainFn = useServerFn(explainInsarPattern);

  const [assets, setAssets] = useState<Asset[]>(() =>
    defaultCenter
      ? [
          {
            id: crypto.randomUUID(),
            name: "Relave principal",
            type: "tailings_dam",
            lat: defaultCenter[0],
            lng: defaultCenter[1],
          },
        ]
      : [
          {
            id: crypto.randomUUID(),
            name: "Relave Paipote",
            type: "tailings_dam",
            lat: -27.4083,
            lng: -70.0667,
          },
        ],
  );
  const [running, setRunning] = useState(false);
  const [explainerLoading, setExplainerLoading] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [actions, setActions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const m = new Map<string, InsarPoint[]>();
    for (const p of points) {
      const k = p.asset_name ?? "Sin nombre";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return m;
  }, [points]);

  const summary = useMemo(() => {
    const counts: Record<string, number> = { info: 0, watch: 0, warning: 0, critical: 0 };
    let worst = 0;
    for (const p of points) {
      const sev = (p.alert_severity ?? "info") as keyof typeof counts;
      if (counts[sev] != null) counts[sev]++;
      if (Math.abs(p.velocity_mm_year) > Math.abs(worst)) worst = p.velocity_mm_year;
    }
    return { counts, worst };
  }, [points]);

  async function runMonitoring() {
    if (assets.length === 0) {
      setError("Añade al menos un activo a monitorear");
      return;
    }
    setError(null);
    setRunning(true);
    try {
      const { ok, error } = await seedFn({
        data: {
          projectId,
          assets: assets.map((a) => ({ name: a.name, type: a.type, lat: a.lat, lng: a.lng })),
          monthsBack: 12,
        },
      });
      if (!ok) throw new Error(error ?? "fallo desconocido");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function runExplainer() {
    setError(null);
    setExplainerLoading(true);
    setExplanation("");
    setActions([]);
    try {
      const res = await explainFn({ data: { projectId } });
      if (!res.ok) {
        const msg =
          res.error === "rate_limit"
            ? "Límite IA alcanzado, reintenta."
            : res.error === "credits_exhausted"
              ? "Créditos Lovable AI agotados."
              : `IA: ${res.error}`;
        throw new Error(msg);
      }
      setExplanation(res.explanation);
      setActions(res.actions);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExplainerLoading(false);
    }
  }

  async function clearAll() {
    if (!confirm("¿Eliminar todos los puntos InSAR del proyecto?")) return;
    await supabase.from("insar_displacement").delete().eq("project_id", projectId);
    setExplanation("");
    setActions([]);
    await refresh();
  }

  function addAsset() {
    setAssets((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: `Activo ${prev.length + 1}`,
        type: "tailings_dam",
        lat: defaultCenter?.[0] ?? -33.45,
        lng: defaultCenter?.[1] ?? -70.66,
      },
    ]);
  }

  function updateAsset(id: string, patch: Partial<Asset>) {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function removeAsset(id: string) {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-text-secondary">
          <Radar className="w-4 h-4 text-signal-cyan" />
          Monitoreo InSAR (Sentinel-1 / OPERA DISP-S1)
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runMonitoring}
            disabled={running || assets.length === 0}
            className="inline-flex items-center gap-1.5 text-xs font-mono uppercase px-3 py-1.5 rounded bg-signal-cyan text-background hover:opacity-90 disabled:opacity-50"
          >
            {running ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Activity className="w-3.5 h-3.5" />
            )}
            Procesar 12 meses
          </button>
          <button
            onClick={runExplainer}
            disabled={explainerLoading || points.length === 0}
            className="inline-flex items-center gap-1.5 text-xs font-mono uppercase px-3 py-1.5 rounded border border-signal-cyan text-signal-cyan hover:bg-signal-cyan/10 disabled:opacity-50"
          >
            {explainerLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            Diagnóstico IA
          </button>
          {points.length > 0 && (
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded border border-border text-text-dim hover:bg-accent"
              title="Limpiar puntos"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Resumen severidades */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {(["info", "watch", "warning", "critical"] as const).map((sev) => (
          <div
            key={sev}
            className={cn("rounded border px-3 py-2 text-xs font-mono", SEVERITY_STYLES[sev])}
          >
            <div className="text-[10px] uppercase tracking-wider opacity-80">
              {SEVERITY_LABEL[sev]}
            </div>
            <div className="text-lg tabular-nums">{summary.counts[sev]}</div>
          </div>
        ))}
        <div className="rounded border border-border bg-bg-panel px-3 py-2 text-xs font-mono">
          <div className="text-[10px] uppercase tracking-wider text-text-dim">Peor v</div>
          <div className="text-lg tabular-nums text-foreground">
            {summary.worst.toFixed(1)} <span className="text-[10px] text-text-dim">mm/yr</span>
          </div>
        </div>
      </div>

      {/* Configurar activos */}
      <div className="rounded border border-border">
        <div className="px-3 py-2 bg-bg-secondary/40 border-b border-border flex items-center justify-between">
          <div className="text-[11px] font-mono uppercase tracking-wider text-text-secondary">
            Activos a monitorear · {assets.length}
          </div>
          <button
            onClick={addAsset}
            className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded border border-border hover:bg-accent"
          >
            <Plus className="w-3 h-3" /> añadir
          </button>
        </div>
        <div className="divide-y divide-border">
          {assets.map((a) => (
            <div key={a.id} className="p-2 grid grid-cols-12 gap-2 items-center">
              <input
                value={a.name}
                onChange={(e) => updateAsset(a.id, { name: e.target.value })}
                className="col-span-4 text-xs bg-bg-panel border border-border rounded px-2 py-1 font-mono"
                placeholder="Nombre"
              />
              <select
                value={a.type}
                onChange={(e) => updateAsset(a.id, { type: e.target.value as Asset["type"] })}
                className="col-span-3 text-xs bg-bg-panel border border-border rounded px-2 py-1 font-mono"
              >
                {Object.entries(ASSET_TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.0001"
                value={a.lat}
                onChange={(e) => updateAsset(a.id, { lat: Number(e.target.value) })}
                className="col-span-2 text-xs bg-bg-panel border border-border rounded px-2 py-1 font-mono tabular-nums"
                placeholder="lat"
              />
              <input
                type="number"
                step="0.0001"
                value={a.lng}
                onChange={(e) => updateAsset(a.id, { lng: Number(e.target.value) })}
                className="col-span-2 text-xs bg-bg-panel border border-border rounded px-2 py-1 font-mono tabular-nums"
                placeholder="lng"
              />
              <button
                onClick={() => removeAsset(a.id)}
                className="col-span-1 inline-flex justify-center text-text-dim hover:text-red-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded border border-signal-amber bg-signal-amber/10 px-3 py-2 text-xs font-mono text-signal-amber">
          {error}
        </div>
      )}

      {(explanation || actions.length > 0) && (
        <div className="rounded border border-signal-cyan/40 bg-signal-cyan/5 p-3 space-y-3">
          <div className="text-[11px] font-mono uppercase tracking-wider text-signal-cyan flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Diagnóstico IA · Geotécnico InSAR
          </div>
          {explanation && (
            <p className="text-xs leading-relaxed text-foreground whitespace-pre-line">
              {explanation}
            </p>
          )}
          {actions.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase text-text-secondary mb-1">
                Acciones recomendadas
              </div>
              <ul className="space-y-1">
                {actions.map((t, i) => (
                  <li
                    key={i}
                    className="text-xs text-foreground border-l-2 border-signal-cyan pl-2"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Lista de puntos por activo */}
      <div className="rounded border border-border overflow-hidden">
        <div className="px-3 py-2 bg-bg-secondary/40 border-b border-border flex items-center justify-between">
          <div className="text-[11px] font-mono uppercase tracking-wider text-text-secondary">
            Puntos de medición · {points.length}
          </div>
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-text-dim" />}
        </div>
        {points.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-dim font-mono">
            Sin puntos InSAR. Configura activos y procesa 12 meses para generar el time-series.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {Array.from(grouped.entries()).map(([assetName, items]) => {
              const worst = items.reduce(
                (acc, p) =>
                  Math.abs(p.velocity_mm_year) > Math.abs(acc) ? p.velocity_mm_year : acc,
                0,
              );
              return (
                <div key={assetName} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-foreground">
                      {assetName} <span className="text-text-dim">· {items.length} pts</span>
                    </div>
                    <div
                      className={cn(
                        "text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded border",
                        Math.abs(worst) >= 40
                          ? SEVERITY_STYLES.critical
                          : Math.abs(worst) >= 15
                            ? SEVERITY_STYLES.warning
                            : Math.abs(worst) >= 5
                              ? SEVERITY_STYLES.watch
                              : SEVERITY_STYLES.info,
                      )}
                    >
                      {worst.toFixed(1)} mm/yr
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {items.map((p) => (
                      <PointRow key={p.id} p={p} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PointRow({ p }: { p: InsarPoint }) {
  const ts = (p.time_series ?? []) as Array<[string, number]>;
  const vals = ts.map((t) => t[1]);
  const min = Math.min(...vals, 0);
  const max = Math.max(...vals, 0);
  const range = max - min || 1;
  const sev = (p.alert_severity ?? "info") as string;
  const label = (p.metadata as any)?.sample_label ?? "punto";
  return (
    <div className="rounded border border-border bg-bg-panel/40 px-2.5 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-foreground">{label}</span>
        <span
          className={cn(
            "text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded border",
            SEVERITY_STYLES[sev],
          )}
        >
          {p.velocity_mm_year.toFixed(1)} mm/yr
        </span>
      </div>
      <div className="mt-1 grid grid-cols-3 gap-2 text-[10px] tabular-nums text-text-dim font-mono">
        <span>cum {p.cumulative_displacement_mm?.toFixed(1) ?? "—"} mm</span>
        <span>coh {p.coherence?.toFixed(2) ?? "—"}</span>
        <span>{p.ascending ? "ASC" : "DESC"}</span>
      </div>
      {ts.length > 1 && (
        <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="mt-1.5 w-full h-6">
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            className={cn(
              Math.abs(p.velocity_mm_year) >= 40
                ? "text-red-400"
                : Math.abs(p.velocity_mm_year) >= 15
                  ? "text-signal-amber"
                  : "text-signal-cyan",
            )}
            points={ts
              .map(
                (t, i) => `${(i / (ts.length - 1)) * 100},${24 - ((t[1] - min) / range) * 22 - 1}`,
              )
              .join(" ")}
          />
        </svg>
      )}
      {sev === "critical" && (
        <div className="mt-1 text-[10px] font-mono text-red-400 inline-flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> requiere intervención inmediata
        </div>
      )}
    </div>
  );
}
