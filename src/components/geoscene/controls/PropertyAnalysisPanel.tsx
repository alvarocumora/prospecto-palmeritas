import { useMemo, useState } from "react";
import type { FeatureCollection } from "geojson";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listProperties,
  summarizeProperty,
  featureBbox,
  type PropertySummary,
} from "../propertyAnalysis";
import {
  estimatePropertyProspectivity,
  type PropertyEstimate,
} from "@/lib/geoscene/propertyEstimate.functions";

const btn =
  "min-h-9 rounded border border-hairline bg-surface px-2.5 font-mono text-[10px] uppercase tracking-wider text-content hover:border-content/30 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand";

/** Selector de pertenencia + resumen de evidencia + estimación IA + ficha PDF con la vista actual. */
export function PropertyAnalysisPanel({
  projectName,
  layers,
  onFocus,
  captureView,
  viewNote,
  onClose,
}: {
  projectName: string;
  layers: ReadonlyArray<{ id: string; data?: FeatureCollection }>;
  onFocus: (bbox: [number, number, number, number]) => void;
  captureView: () => Promise<string | null>;
  viewNote: string;
  onClose: () => void;
}) {
  // Official cadastre plus requested/pending pedimentos (status kept per feature).
  const cadastre = useMemo<FeatureCollection | undefined>(() => {
    const status: Record<string, string> = {
      "territory.cadastre": "",
      "territory.proposed_pedimentos": "Solicitud",
      "territory.pending_pedimentos": "Pendiente",
    };
    const features = layers.flatMap((l) =>
      l.id in status && l.data
        ? l.data.features.map((f) =>
            status[l.id]
              ? { ...f, properties: { ...f.properties, estado_tenencia: status[l.id] } }
              : f,
          )
        : [],
    );
    return features.length ? { type: "FeatureCollection", features } : undefined;
  }, [layers]);
  const options = useMemo(() => listProperties(cadastre), [cadastre]);
  const [key, setKey] = useState("");
  const [query, setQuery] = useState("");
  const [estimate, setEstimate] = useState<PropertyEstimate | null>(null);
  const [busy, setBusy] = useState<"ai" | "pdf" | null>(null);
  const estimateFn = useServerFn(estimatePropertyProspectivity);
  const chosen = options.find((o) => o.key === key) ?? null;
  const summary: PropertySummary | null = useMemo(
    () => (chosen ? summarizeProperty(chosen.feature, layers) : null),
    [chosen, layers],
  );
  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const select = (k: string) => {
    setKey(k);
    setEstimate(null);
    const o = options.find((x) => x.key === k);
    const b = o && featureBbox(o.feature);
    if (b) onFocus(b);
  };

  const runAi = async () => {
    if (!summary) return;
    setBusy("ai");
    try {
      const r = await estimateFn({ data: { projectName, summary: JSON.stringify(summary) } });
      if (r.error) toast.error(r.error);
      setEstimate(r.estimate);
    } catch {
      toast.error("Inicia sesión para usar la estimación por IA.");
    } finally {
      setBusy(null);
    }
  };

  const exportPdf = async () => {
    if (!summary) return;
    setBusy("pdf");
    try {
      const image = await captureView();
      if (!image) toast.message("No se pudo capturar la vista; la ficha sale sin imagen.");
      const { buildPropertyAnalysisPdf } = await import("@/lib/pdf/propertyAnalysisPdf");
      const blob = await buildPropertyAnalysisPdf({
        projectName,
        summary,
        image,
        viewNote,
        estimate,
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Ficha-${summary.property.label.replace(/[^\w-]+/g, "_")}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) {
      toast.error("Error al generar la ficha: " + (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <aside
      data-theme="im-light"
      aria-label="Análisis de pertenencia"
      className="absolute right-3 top-14 z-30 flex max-h-[calc(100%-7rem)] w-[min(22rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded border border-hairline bg-surface/97 text-content shadow-lg"
    >
      <header className="flex items-center justify-between border-b border-hairline px-3 py-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Análisis de pertenencia
        </p>
        <button
          type="button"
          onClick={onClose}
          className="min-h-9 min-w-9 font-mono text-xs"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </header>
      <div className="space-y-2 overflow-auto p-3 text-xs">
        {!options.length ? (
          <p className="text-muted-foreground">
            Enciende la capa «Catastro SERNAGEOMIN» para elegir una pertenencia.
          </p>
        ) : (
          <>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Buscar entre ${options.length} pertenencias`}
              aria-label="Buscar pertenencia"
              className="min-h-9 w-full rounded border border-hairline bg-surface px-2"
            />
            <select
              value={key}
              onChange={(e) => select(e.target.value)}
              aria-label="Pertenencia"
              className="min-h-9 w-full rounded border border-hairline bg-surface px-2"
            >
              <option value="">Elige una pertenencia…</option>
              {filtered.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </>
        )}
        {summary && (
          <>
            <dl className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[10px]">
              <dt className="text-muted-foreground">Titular</dt>
              <dd className="truncate">{summary.property.titular ?? "—"}</dd>
              <dt className="text-muted-foreground">Superficie</dt>
              <dd>
                {summary.property.hectareas != null ? `${summary.property.hectareas} ha` : "—"}
              </dd>
              <dt className="text-muted-foreground">Firmas satelitales</dt>
              <dd>{summary.spectral.total} · MODELADO</dd>
              <dt className="text-muted-foreground">Estructuras</dt>
              <dd>{summary.structures.measured} · MEDIDO</dd>
              <dt className="text-muted-foreground">Lineamientos</dt>
              <dd>{summary.lineaments} · INTERP.</dd>
              <dt className="text-muted-foreground">Carta geológica</dt>
              <dd>
                {summary.officialUnits.length} unid. · {summary.officialFaults} fallas
              </dd>
              <dt className="text-muted-foreground">Geofísica</dt>
              <dd>{summary.geophysicsAnomalies}</dd>
              <dt className="text-muted-foreground">Sondajes</dt>
              <dd>{summary.drillholes}</dd>
            </dl>
            {summary.spectral.byMineral.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {summary.spectral.byMineral
                  .slice(0, 4)
                  .map((b) => `${b.label} ${b.count}`)
                  .join(" · ")}
              </p>
            )}
            {summary.gaps.length > 0 && (
              <ul className="list-disc pl-4 text-[10px] text-muted-foreground">
                {summary.gaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={btn} disabled={busy !== null} onClick={runAi}>
                {busy === "ai" ? "Analizando…" : "Estimación IA"}
              </button>
              <button type="button" className={btn} disabled={busy !== null} onClick={exportPdf}>
                {busy === "pdf" ? "Generando…" : "Ficha PDF + vista"}
              </button>
            </div>
            {estimate && (
              <section className="space-y-1 border-t border-hairline pt-2">
                <p className="font-mono text-[10px] uppercase">
                  Prospectividad {estimate.prospectivity} · confianza {estimate.confidence} ·
                  INTERPRETADO
                </p>
                {estimate.synthesis.map((t, i) => (
                  <p key={i}>{t}</p>
                ))}
                {estimate.nextSteps.length > 0 && (
                  <ul className="list-disc pl-4">
                    {estimate.nextSteps.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
              </section>
            )}
            <p className="text-[9px] text-muted-foreground">
              Las firmas satelitales y la estimación por IA son hipótesis para priorizar terreno; no
              declaran recursos.
            </p>
          </>
        )}
      </div>
    </aside>
  );
}
