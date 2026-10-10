import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Satellite, Sparkles, Telescope, Trash2 } from "lucide-react";
import {
  useHyperspectralProducts,
  type HyperspectralProduct,
} from "@/hooks/useHyperspectralProducts";
import {
  searchStac,
  seedHyperspectralFromScene,
  explainHyperspectralProducts,
} from "@/lib/satelliteIntel.functions";
import { supabase } from "@/integrations/supabase/client";
import { satelliteEvidence, validSatelliteBbox } from "@/lib/satellite/evidence";
import { cn } from "@/lib/utils";

type Props = {
  projectId: string;
  defaultBbox?: [number, number, number, number] | null;
};

const ASSEMBLAGE_LABEL: Record<string, string> = {
  argillic: "Argílica",
  advanced_argillic: "Argílica avanzada",
  phyllic: "Fílica (sericita)",
  propylitic: "Propilítica",
  iron_oxide_gossan: "Óxidos Fe / Gossan",
  potassic: "Potásica",
};

export function HyperspectralPanel({ projectId, defaultBbox }: Props) {
  const { products, loading, error: loadError, refresh } = useHyperspectralProducts(projectId);
  const searchFn = useServerFn(searchStac);
  const seedFn = useServerFn(seedHyperspectralFromScene);
  const explainFn = useServerFn(explainHyperspectralProducts);

  const [running, setRunning] = useState(false);
  const [source, setSource] = useState<"ASTER" | "EMIT">("ASTER");
  const [explainerLoading, setExplainerLoading] = useState(false);
  const [explanation, setExplanation] = useState<string>("");
  const [targets, setTargets] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, HyperspectralProduct[]>();
    for (const p of products) {
      const k = p.assemblage ?? "other";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return map;
  }, [products]);

  async function runAnalysis() {
    setError(null);
    setRunning(true);
    try {
      if (!validSatelliteBbox(defaultBbox))
        throw new Error("Define un AOI válido para este proyecto antes de consultar escenas.");
      const bbox = defaultBbox;
      const today = new Date();
      const dateTo = today.toISOString().slice(0, 10);
      const dateFrom = new Date(today.getTime() - 365 * 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);

      const collection = source === "ASTER" ? "aster" : "emit";
      const { items, error: searchErr } = await searchFn({
        data: { projectId, collection, bbox, dateFrom, dateTo, cloudCoverMax: 30, limit: 5 },
      });
      if (searchErr) throw new Error(`STAC: ${searchErr}`);

      const scene = items[0];
      if (!scene?.id || !scene.acquisitionDate)
        throw new Error(
          "No hay escenas disponibles para el AOI y periodo consultados. No se generaron productos.",
        );
      const acquisition = scene.acquisitionDate;
      const { ok, error: seedErr } = await seedFn({
        data: {
          projectId,
          source,
          acquisitionDate: acquisition,
          bbox,
          sceneId: scene?.id,
          stacHref: scene?.stacHref ?? undefined,
        },
      });
      if (!ok) throw new Error(`Seed: ${seedErr}`);
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
    setTargets([]);
    try {
      const ids = products.slice(0, 12).map((p) => p.id);
      if (ids.length === 0) throw new Error("Sin productos para interpretar");
      const res = await explainFn({ data: { projectId, productIds: ids } });
      if (!res.ok) {
        const msg =
          res.error === "rate_limit"
            ? "Límite de IA alcanzado, reintenta en unos minutos."
            : res.error === "credits_exhausted"
              ? "Créditos de Lovable AI agotados. Añade créditos en Settings → Workspace."
              : `IA: ${res.error}`;
        throw new Error(msg);
      }
      setExplanation(res.explanation);
      setTargets(res.targets);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExplainerLoading(false);
    }
  }

  async function clearProducts() {
    if (!confirm("¿Eliminar todos los productos hiperespectrales del proyecto?")) return;
    await supabase.from("hyperspectral_products").delete().eq("project_id", projectId);
    setExplanation("");
    setTargets([]);
    await refresh();
  }

  return (
    <div className="space-y-4">
      <p className="rounded border border-hairline bg-surface p-3 text-xs text-content">
        El flujo actual consulta escenas y genera productos conceptuales de demostración. No ejecuta
        procesamiento espectral ni acredita minerales detectados.{" "}
        {!validSatelliteBbox(defaultBbox) && "Falta un AOI válido del proyecto."}
      </p>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-text-secondary">
          <Satellite className="w-4 h-4 text-signal-cyan" />
          Mapeo mineral hiperespectral
        </div>
        <div className="flex items-center gap-2">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as "ASTER" | "EMIT")}
            className="text-xs font-mono bg-bg-panel border border-border rounded px-2 py-1"
          >
            <option value="ASTER">ASTER · 30 m</option>
            <option value="EMIT">EMIT · 60 m (285 bandas)</option>
          </select>
          <button
            onClick={runAnalysis}
            disabled={running || !validSatelliteBbox(defaultBbox)}
            className="inline-flex items-center gap-1.5 text-xs font-mono uppercase px-3 py-1.5 rounded bg-signal-cyan text-background hover:opacity-90 disabled:opacity-50"
          >
            {running ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Telescope className="w-3.5 h-3.5" />
            )}
            Crear demostración desde escena
          </button>
          <button
            onClick={runExplainer}
            disabled={explainerLoading || products.length === 0}
            className="inline-flex items-center gap-1.5 text-xs font-mono uppercase px-3 py-1.5 rounded border border-signal-cyan text-signal-cyan hover:bg-signal-cyan/10 disabled:opacity-50"
          >
            {explainerLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            Interpretar con IA
          </button>
          {products.length > 0 && (
            <button
              onClick={clearProducts}
              className="inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded border border-border text-text-dim hover:bg-accent"
              title="Limpiar productos"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {(error || loadError) && (
        <div className="rounded border border-signal-amber bg-signal-amber/10 px-3 py-2 text-xs font-mono text-signal-amber">
          {error || loadError}
        </div>
      )}

      {(explanation || targets.length > 0) && (
        <div className="rounded border border-signal-cyan/40 bg-signal-cyan/5 p-3 space-y-3">
          <div className="text-[11px] font-mono uppercase tracking-wider text-signal-cyan flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Interpretación IA · Geólogo de exploración
          </div>
          {explanation && (
            <p className="text-xs leading-relaxed text-foreground whitespace-pre-line">
              {explanation}
            </p>
          )}
          {targets.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase text-text-secondary mb-1">
                Targets sugeridos
              </div>
              <ul className="space-y-1">
                {targets.map((t, i) => (
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

      <div className="rounded border border-border overflow-hidden">
        <div className="px-3 py-2 bg-bg-secondary/40 border-b border-border flex items-center justify-between">
          <div className="text-[11px] font-mono uppercase tracking-wider text-text-secondary">
            Productos minerales · {products.length}
          </div>
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-text-dim" />}
        </div>
        {products.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-dim font-mono">
            No hay productos disponibles. Puedes consultar una escena para crear una demostración
            conceptual.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {Array.from(grouped.entries()).map(([assemblage, items]) => (
              <div key={assemblage} className="p-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-signal-cyan mb-2">
                  {ASSEMBLAGE_LABEL[assemblage] ?? assemblage} · {items.length}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {items.map((p) => (
                    <div
                      key={p.id}
                      className="rounded border border-border bg-bg-panel/40 px-2.5 py-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono uppercase text-foreground">{p.mineral}</span>
                        <span className="text-[10px] font-mono text-text-dim">
                          {p.source} · {p.acquisition_date.slice(0, 10)}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] font-mono text-content-subtle">
                        {satelliteEvidence(p.metadata)}
                      </p>
                      <div className="mt-1.5 grid grid-cols-3 gap-2 text-[11px] tabular-nums">
                        <Metric label="score medio" value={p.mean_score?.toFixed(2) ?? "—"} />
                        <Metric label="max" value={p.max_score?.toFixed(2) ?? "—"} />
                        <Metric label="área ha" value={p.area_ha?.toFixed(1) ?? "—"} />
                      </div>
                      {p.mean_score != null && (
                        <div className="mt-1.5 h-1 rounded bg-bg-secondary overflow-hidden">
                          <div
                            className={cn(
                              "h-full",
                              (p.mean_score ?? 0) > 0.6 ? "bg-signal-amber" : "bg-signal-cyan",
                            )}
                            style={{ width: `${Math.min(100, (p.mean_score ?? 0) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-mono uppercase text-text-dim">{label}</div>
      <div className="font-mono text-foreground">{value}</div>
    </div>
  );
}
