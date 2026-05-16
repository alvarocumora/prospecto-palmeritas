import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Boxes, Loader2, Mountain, Sparkles, Trash2 } from "lucide-react";
import { useStockpileVolumes, type StockpileVolume } from "@/hooks/useStockpileVolumes";
import { seedStockpileVolume, explainStockpileChanges } from "@/lib/satelliteIntel.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  projectId: string;
  defaultCenter?: [number, number] | null;
};

const MATERIAL_LABEL: Record<string, string> = {
  mineral: "Mineral",
  esteril: "Estéril",
  lixiviable: "Lixiviable",
  concentrado: "Concentrado",
  ROM: "ROM",
};

const DENSITY: Record<string, number> = {
  mineral: 2.0,
  esteril: 1.8,
  lixiviable: 1.7,
  concentrado: 2.4,
  ROM: 1.9,
};

function fmtN(n: number | null | undefined, digits = 0) {
  if (n == null) return "—";
  return n.toLocaleString("es-CL", { maximumFractionDigits: digits });
}

export function StockpileVolumesPanel({ projectId, defaultCenter }: Props) {
  const { items, loading, refresh } = useStockpileVolumes(projectId);
  const seedFn = useServerFn(seedStockpileVolume);
  const explainFn = useServerFn(explainStockpileChanges);

  const [name, setName] = useState("Acopio mineral 1");
  const [material, setMaterial] = useState<keyof typeof MATERIAL_LABEL>("mineral");
  const [lat, setLat] = useState(defaultCenter?.[0] ?? -27.4083);
  const [lng, setLng] = useState(defaultCenter?.[1] ?? -70.0667);
  const [radius, setRadius] = useState(40);
  const [recentSource, setRecentSource] = useState<"Drone" | "WorldView-3" | "Pleiades">("Drone");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState("");
  const [actions, setActions] = useState<string[]>([]);
  const [explainerLoading, setExplainerLoading] = useState(false);

  const totals = useMemo(() => {
    let vol = 0;
    let area = 0;
    let tons = 0;
    for (const s of items) {
      vol += s.volume_m3 ?? 0;
      area += s.area_m2 ?? 0;
      tons += (s.volume_m3 ?? 0) * (DENSITY[s.material ?? "mineral"] ?? 2.0);
    }
    return { vol, area, tons };
  }, [items]);

  // Time-series por nombre (para mostrar progresión multitemporal)
  const series = useMemo(() => {
    const byName = new Map<string, StockpileVolume[]>();
    for (const s of items) {
      const k = s.name;
      if (!byName.has(k)) byName.set(k, []);
      byName.get(k)!.push(s);
    }
    for (const arr of byName.values()) {
      arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    return byName;
  }, [items]);

  async function runMeasure() {
    setError(null);
    setRunning(true);
    try {
      const { ok, error } = await seedFn({
        data: {
          projectId,
          name,
          material,
          lat,
          lng,
          radiusM: radius,
          recentSource,
          baselineSource: "GLO-30",
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
    if (!confirm("¿Eliminar todas las mediciones de stockpiles del proyecto?")) return;
    await supabase.from("stockpile_volumes").delete().eq("project_id", projectId);
    setExplanation("");
    setActions([]);
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-text-secondary">
          <Boxes className="w-4 h-4 text-signal-cyan" />
          Stockpiles · DEM-diff multitemporal
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runExplainer}
            disabled={explainerLoading || items.length === 0}
            className="inline-flex items-center gap-1.5 text-xs font-mono uppercase px-3 py-1.5 rounded border border-signal-cyan text-signal-cyan hover:bg-signal-cyan/10 disabled:opacity-50"
          >
            {explainerLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            Análisis IA
          </button>
          {items.length > 0 && (
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded border border-border text-text-dim hover:bg-accent"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Volumen total" value={`${fmtN(totals.vol)} m³`} />
        <Stat label="Tonelaje aprox" value={`${fmtN(totals.tons / 1000, 1)} kt`} />
        <Stat label="Área total" value={`${fmtN(totals.area / 10000, 2)} ha`} />
      </div>

      {/* Form de medición */}
      <div className="rounded border border-border p-3 space-y-2">
        <div className="text-[11px] font-mono uppercase tracking-wider text-text-secondary">
          Nueva medición DEM-diff
        </div>
        <div className="grid grid-cols-12 gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="col-span-4 text-xs bg-bg-panel border border-border rounded px-2 py-1 font-mono"
            placeholder="Nombre acopio"
          />
          <select
            value={material}
            onChange={(e) => setMaterial(e.target.value as keyof typeof MATERIAL_LABEL)}
            className="col-span-2 text-xs bg-bg-panel border border-border rounded px-2 py-1 font-mono"
          >
            {Object.entries(MATERIAL_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.0001"
            value={lat}
            onChange={(e) => setLat(Number(e.target.value))}
            className="col-span-2 text-xs bg-bg-panel border border-border rounded px-2 py-1 font-mono tabular-nums"
            placeholder="lat"
          />
          <input
            type="number"
            step="0.0001"
            value={lng}
            onChange={(e) => setLng(Number(e.target.value))}
            className="col-span-2 text-xs bg-bg-panel border border-border rounded px-2 py-1 font-mono tabular-nums"
            placeholder="lng"
          />
          <input
            type="number"
            min={5}
            max={500}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="col-span-2 text-xs bg-bg-panel border border-border rounded px-2 py-1 font-mono tabular-nums"
            placeholder="radio m"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={recentSource}
            onChange={(e) =>
              setRecentSource(e.target.value as "Drone" | "WorldView-3" | "Pleiades")
            }
            className="text-xs bg-bg-panel border border-border rounded px-2 py-1 font-mono"
          >
            <option value="Drone">DEM Drone · 0.1 m</option>
            <option value="WorldView-3">WorldView-3 · 1 m</option>
            <option value="Pleiades">Pléiades · 1 m</option>
          </select>
          <span className="text-[10px] font-mono text-text-dim">
            vs baseline GLO-30 (Copernicus)
          </span>
          <button
            onClick={runMeasure}
            disabled={running}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-mono uppercase px-3 py-1.5 rounded bg-signal-cyan text-background hover:opacity-90 disabled:opacity-50"
          >
            {running ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Mountain className="w-3.5 h-3.5" />
            )}
            Calcular volumen
          </button>
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
            <Sparkles className="w-3.5 h-3.5" /> Análisis IA · Reconciliación stockpiles
          </div>
          {explanation && (
            <p className="text-xs leading-relaxed text-foreground whitespace-pre-line">
              {explanation}
            </p>
          )}
          {actions.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase text-text-secondary mb-1">
                Acciones
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

      {/* Lista de stockpiles + progresión */}
      <div className="rounded border border-border overflow-hidden">
        <div className="px-3 py-2 bg-bg-secondary/40 border-b border-border flex items-center justify-between">
          <div className="text-[11px] font-mono uppercase tracking-wider text-text-secondary">
            Mediciones · {items.length}
          </div>
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-text-dim" />}
        </div>
        {items.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-dim font-mono">
            Sin mediciones aún. Usa el formulario para registrar el primer DEM-diff.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {Array.from(series.entries()).map(([groupName, arr]) => (
              <StockpileRow key={groupName} name={groupName} items={arr} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-bg-panel px-3 py-2 font-mono">
      <div className="text-[10px] uppercase tracking-wider text-text-dim">{label}</div>
      <div className="text-base text-foreground tabular-nums">{value}</div>
    </div>
  );
}

function StockpileRow({ name, items }: { name: string; items: StockpileVolume[] }) {
  const last = items[items.length - 1];
  const first = items[0];
  const delta =
    items.length > 1 && first.volume_m3 != null && last.volume_m3 != null
      ? last.volume_m3 - first.volume_m3
      : 0;
  const dens = DENSITY[last.material ?? "mineral"] ?? 2.0;
  const vals = items.map((i) => i.volume_m3 ?? 0);
  const min = Math.min(...vals, 0);
  const max = Math.max(...vals, 1);
  const range = max - min || 1;

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-mono text-foreground">
          {name}{" "}
          <span className="text-text-dim">
            · {MATERIAL_LABEL[last.material ?? "mineral"]} · {items.length} medición
            {items.length > 1 ? "es" : ""}
          </span>
        </div>
        {items.length > 1 && (
          <span
            className={cn(
              "text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded border",
              delta > 0
                ? "border-signal-cyan/40 text-signal-cyan bg-signal-cyan/10"
                : delta < 0
                  ? "border-signal-amber/40 text-signal-amber bg-signal-amber/10"
                  : "border-border text-text-dim",
            )}
          >
            Δ {delta > 0 ? "+" : ""}
            {fmtN(delta)} m³
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2 text-[11px] tabular-nums font-mono">
        <Cell label="V" value={`${fmtN(last.volume_m3)} m³`} />
        <Cell label="t aprox" value={`${fmtN(((last.volume_m3 ?? 0) * dens) / 1000, 1)} kt`} />
        <Cell label="h med" value={`${fmtN(last.mean_height_m, 1)} m`} />
        <Cell label="área" value={`${fmtN((last.area_m2 ?? 0) / 10000, 2)} ha`} />
      </div>
      {items.length > 1 && (
        <svg
          viewBox="0 0 100 24"
          preserveAspectRatio="none"
          className="mt-1.5 w-full h-6 text-signal-cyan"
        >
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            points={vals
              .map(
                (v, i) => `${(i / (vals.length - 1)) * 100},${24 - ((v - min) / range) * 22 - 1}`,
              )
              .join(" ")}
          />
        </svg>
      )}
      <div className="text-[10px] font-mono text-text-dim mt-1">
        {last.base_method} · {String(last.created_at).slice(0, 10)} ·{" "}
        {last.cells_analyzed?.toLocaleString("es-CL") ?? "?"} celdas
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase text-text-dim">{label}</div>
      <div className="text-foreground">{value}</div>
    </div>
  );
}
