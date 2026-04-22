import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { ProjectMap } from "@/components/ProjectMap";
import { useProjects } from "@/hooks/useProjects";
import { exportNI43101 } from "@/lib/export-ni43101-pdf";
import { FileText, Download, Loader2, Map as MapIcon, Layers, Database, BookOpen, Mountain } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/ni43101")({
  head: () => ({
    meta: [
      { title: "Informe NI 43-101 — Trackmin GeoIntel" },
      {
        name: "description",
        content:
          "Generación de informe NI 43-101 en PDF para el Prospecto Palmeras: catastro SERNAGEOMIN, pertenencias internas, mapa, zonificación geológica y vista satelital.",
      },
    ],
  }),
  component: NI43101Module,
});

const SECTIONS: { n: string; title: string; sub: string }[] = [
  { n: "1", title: "Introducción", sub: "Objeto y alcance del informe" },
  { n: "2", title: "Confianza en otros expertos", sub: "Reliance on other experts" },
  { n: "3", title: "Localización y propiedad", sub: "AOI, accesos, derechos mineros, catastro SERNAGEOMIN" },
  { n: "3.bis", title: "Zonificación y satelital", sub: "Capas geo-espaciales activas y vista satelital" },
  { n: "4", title: "Clima e infraestructura", sub: "Geomorfología y servicios" },
  { n: "5", title: "Historia del distrito", sub: "Alhué — minería prehispánica a moderna" },
  { n: "6", title: "Marco geológico", sub: "Regional + local" },
  { n: "7", title: "Tipo de depósito", sub: "Modelo epitermal–mesotermal Au–Cu" },
  { n: "8", title: "Exploración", sub: "Geofísica, geoquímica, UAV" },
  { n: "9", title: "Sondajes (DDH)", sub: "Plan de perforación" },
  { n: "10", title: "QA/QC", sub: "Estándares, blancos y duplicados" },
  { n: "11", title: "Verificación de datos", sub: "Independent verification" },
  { n: "12", title: "Presupuesto", sub: "Programa 12 meses" },
  { n: "13", title: "Conclusiones", sub: "Hallazgos y recomendaciones" },
  { n: "14", title: "Referencias", sub: "Bibliografía geológica" },
  { n: "A", title: "Anexo A — Catastro completo", sub: "SERNAGEOMIN + pertenencias internas" },
  { n: "B", title: "Anexo B — Estaciones geofísicas", sub: "Magnetometría, IP" },
];

function NI43101Module() {
  const { active } = useProjects();
  const projectId = active?.id ?? null;

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includeSatellite, setIncludeSatellite] = useState(true);
  const [includeInternal, setIncludeInternal] = useState(true);
  const [includeZoning, setIncludeZoning] = useState(true);

  const mapRef = useRef<LeafletMap | null>(null);
  const onMapReady = useCallback((map: LeafletMap) => {
    mapRef.current = map;
  }, []);

  const handleGenerate = async () => {
    setBusy(true);
    setError(null);
    setProgress("Iniciando…");
    try {
      await exportNI43101({
        basemap: includeSatellite ? "satellite" : "topo",
        includeInternalConcessions: includeInternal,
        includeZoning,
        projectId,
        onProgress: (s) => setProgress(s),
      });
      toast.success("Informe NI 43-101 generado");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error generando informe";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1200px] mx-auto">
      {/* Header */}
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-mono font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-gold" /> Informe NI 43-101
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            Prospecto Palmeras · TRK-ALH-001 · Catastro SERNAGEOMIN + pertenencias internas + zonificación
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-gold/40 text-gold font-mono text-[11px] uppercase tracking-wider">
          PDF
        </span>
      </header>

      {/* Controls */}
      <section className="rounded border border-border bg-bg-secondary p-4 md:p-5 space-y-4">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-text-secondary">
          <Layers className="w-3.5 h-3.5" /> Capas a incluir
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex items-start gap-2 p-3 rounded border border-border bg-bg-primary cursor-pointer hover:border-gold/40">
            <input
              type="checkbox"
              checked={includeSatellite}
              onChange={(e) => setIncludeSatellite(e.target.checked)}
              className="mt-0.5"
            />
            <div>
              <div className="text-xs font-mono">Vista satelital</div>
              <div className="text-[10px] text-text-secondary">Esri World Imagery como basemap del snapshot</div>
            </div>
          </label>
          <label className="flex items-start gap-2 p-3 rounded border border-border bg-bg-primary cursor-pointer hover:border-gold/40">
            <input
              type="checkbox"
              checked={includeInternal}
              onChange={(e) => setIncludeInternal(e.target.checked)}
              className="mt-0.5"
            />
            <div>
              <div className="text-xs font-mono">Pertenencias internas</div>
              <div className="text-[10px] text-text-secondary">Combinar mining_concessions con catastro SERNAGEOMIN</div>
            </div>
          </label>
          <label className="flex items-start gap-2 p-3 rounded border border-border bg-bg-primary cursor-pointer hover:border-gold/40">
            <input
              type="checkbox"
              checked={includeZoning}
              onChange={(e) => setIncludeZoning(e.target.checked)}
              className="mt-0.5"
            />
            <div>
              <div className="text-xs font-mono">Zonificación geológica</div>
              <div className="text-[10px] text-text-secondary">Sección 3.bis con litología y capas activas</div>
            </div>
          </label>
        </div>

        <button
          onClick={handleGenerate}
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded bg-gold text-bg-secondary font-mono text-sm hover:bg-gold/90 disabled:opacity-50 active:scale-[0.99] transition"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {busy ? progress ?? "Generando…" : "Generar PDF NI 43-101"}
        </button>

        {error && <div className="text-xs text-destructive font-mono">{error}</div>}
        {!projectId && (
          <div className="text-xs text-muted-foreground font-mono">
            Sin proyecto activo: el informe usará los datos del Prospecto Palmeras y omitirá las pertenencias internas.
          </div>
        )}
      </section>

      {/* Section preview */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-text-secondary">
          <BookOpen className="w-3.5 h-3.5" /> Estructura del informe
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {SECTIONS.map((sec) => (
            <div
              key={sec.n}
              className="rounded border border-border bg-bg-secondary p-3 flex gap-3"
            >
              <div className="font-mono text-gold text-xs shrink-0 w-10">{sec.n}</div>
              <div className="min-w-0">
                <div className="text-xs font-mono">{sec.title}</div>
                <div className="text-[10px] text-text-secondary mt-0.5">{sec.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Sources */}
      <section className="rounded border border-border bg-bg-secondary p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-text-secondary">
          <Database className="w-3.5 h-3.5" /> Fuentes de datos
        </div>
        <ul className="text-[11px] text-text-secondary font-mono space-y-1">
          <li>• Catastro Minero SERNAGEOMIN (Geomin WMS) — bbox 16 km en torno al centroide AOI</li>
          <li>• Tabla <code className="text-foreground">mining_concessions</code> del proyecto activo</li>
          <li>• Geología: <code className="text-foreground">lithology_units</code>, <code className="text-foreground">alteration_zones</code>, <code className="text-foreground">mineralogy</code>, <code className="text-foreground">geological_features</code></li>
          <li>• Geofísica: <code className="text-foreground">geophysics_surveys / lines / stations</code></li>
          <li>• Capas de mapa: Macrostrat, SERNAGEOMIN 1:1M, Esri World Imagery</li>
        </ul>
      </section>

      {/* Hidden map for capture */}
      <section className="rounded border border-border bg-bg-secondary p-3">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-text-secondary mb-2">
          <MapIcon className="w-3.5 h-3.5" /> Vista de captura (mapa)
          <span className="ml-auto inline-flex items-center gap-1 text-[10px]">
            <Mountain className="w-3 h-3 text-gold" /> Se captura al generar el PDF
          </span>
        </div>
        <ProjectMap onMapReady={onMapReady} />
      </section>
    </div>
  );
}
