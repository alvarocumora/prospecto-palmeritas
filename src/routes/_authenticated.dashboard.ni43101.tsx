import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { ProjectMap } from "@/components/ProjectMap";
import { useProjects } from "@/hooks/useProjects";
import { exportNI43101, type Ni43101Result, type Ni43101TocEntry } from "@/lib/export-ni43101-pdf";
import {
  FileText,
  Download,
  Loader2,
  Map as MapIcon,
  Layers,
  Database,
  BookOpen,
  Mountain,
  Eye,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/ni43101")({
  head: () => ({
    meta: [
      { title: "Informe NI 43-101 — Trackmin GeoIntel" },
      {
        name: "description",
        content:
          "Vista previa y generación del informe NI 43-101 en PDF para el Prospecto Palmeras: catastro SERNAGEOMIN, pertenencias internas, mapa, zonificación geológica y vista satelital.",
      },
    ],
  }),
  component: NI43101Module,
});

function NI43101Module() {
  const { active } = useProjects();
  const projectId = active?.id ?? null;

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includeSatellite, setIncludeSatellite] = useState(true);
  const [includeInternal, setIncludeInternal] = useState(true);
  const [includeZoning, setIncludeZoning] = useState(true);

  const [preview, setPreview] = useState<Ni43101Result | null>(null);
  const [activePage, setActivePage] = useState<number>(1);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const mapRef = useRef<LeafletMap | null>(null);
  const onMapReady = useCallback((map: LeafletMap) => {
    mapRef.current = map;
  }, []);

  // Cleanup blob URL on unmount / regeneration
  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview?.url]);

  const buildPreview = async () => {
    setBusy(true);
    setError(null);
    setProgress("Iniciando…");
    try {
      // Revoke previous blob first
      if (preview?.url) URL.revokeObjectURL(preview.url);
      const result = await exportNI43101({
        basemap: includeSatellite ? "satellite" : "topo",
        includeInternalConcessions: includeInternal,
        includeZoning,
        projectId,
        preview: true,
        onProgress: (s) => setProgress(s),
      });
      if (result) {
        setPreview(result);
        setActivePage(1);
        toast.success("Vista previa lista");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error generando vista previa";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const downloadDirect = async () => {
    if (preview) {
      // Use existing blob
      const a = document.createElement("a");
      a.href = preview.url;
      a.download = preview.filename;
      a.click();
      return;
    }
    setBusy(true);
    setError(null);
    setProgress("Generando PDF…");
    try {
      await exportNI43101({
        basemap: includeSatellite ? "satellite" : "topo",
        includeInternalConcessions: includeInternal,
        includeZoning,
        projectId,
        onProgress: (s) => setProgress(s),
      });
      toast.success("Informe NI 43-101 descargado");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error generando informe";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const goToPage = (page: number) => {
    setActivePage(page);
    if (preview && iframeRef.current) {
      // Re-set src with #page=N to force the embedded viewer to jump
      iframeRef.current.src = `${preview.url}#page=${page}&view=FitH`;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-mono font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-gold" /> Informe NI 43-101
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            Prospecto Palmeras · TRK-ALH-001 · Vista previa por sección antes de exportar
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={buildPreview}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded bg-gold text-bg-secondary font-mono text-sm hover:bg-gold/90 disabled:opacity-50 active:scale-[0.99] transition"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : preview ? <RefreshCw className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {busy ? progress ?? "Generando…" : preview ? "Regenerar vista previa" : "Generar vista previa"}
          </button>
          <button
            onClick={downloadDirect}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded border border-gold/50 text-gold font-mono text-sm hover:bg-gold/10 disabled:opacity-50 active:scale-[0.99] transition"
          >
            <Download className="w-4 h-4" />
            {preview ? "Descargar PDF" : "Generar y descargar"}
          </button>
        </div>

        {error && <div className="text-xs text-destructive font-mono">{error}</div>}
        {!projectId && (
          <div className="text-xs text-muted-foreground font-mono">
            Sin proyecto activo: el informe usará los datos del Prospecto Palmeras y omitirá las pertenencias internas.
          </div>
        )}
      </section>

      {/* Preview viewer */}
      {preview ? (
        <section className="rounded border border-border bg-bg-secondary overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-bg-primary/60">
            <Eye className="w-3.5 h-3.5 text-gold" />
            <div className="text-xs font-mono uppercase tracking-wider text-text-secondary">
              Vista previa · {preview.totalPages} páginas
            </div>
            <div className="ml-auto text-[10px] font-mono text-muted-foreground">
              Sección actual · pág. {activePage}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] min-h-[70vh]">
            {/* Section list (TOC) */}
            <aside className="border-b md:border-b-0 md:border-r border-border bg-bg-primary/30 max-h-[40vh] md:max-h-[80vh] overflow-y-auto">
              <ul className="py-1">
                {preview.toc.map((entry, i) => (
                  <TocItem
                    key={`${entry.page}-${i}`}
                    entry={entry}
                    isActive={entry.page === activePage}
                    onClick={() => goToPage(entry.page)}
                  />
                ))}
              </ul>
            </aside>
            {/* PDF iframe */}
            <div className="bg-black/30 min-h-[60vh] md:min-h-[80vh]">
              <iframe
                ref={iframeRef}
                title="Vista previa NI 43-101"
                src={`${preview.url}#page=${activePage}&view=FitH`}
                className="w-full h-[60vh] md:h-[80vh] border-0 bg-white"
              />
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-text-secondary">
            <BookOpen className="w-3.5 h-3.5" /> Estructura del informe
          </div>
          <div className="rounded border border-dashed border-border bg-bg-secondary/40 p-6 text-center">
            <Eye className="w-8 h-8 text-gold/60 mx-auto mb-2" />
            <div className="text-sm font-mono">Aún no hay vista previa</div>
            <div className="text-[11px] text-text-secondary mt-1">
              Genera la vista previa para revisar mapa, catastro, geología, zonificación y anexos página por página antes de descargar.
            </div>
          </div>
        </section>
      )}

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
            <Mountain className="w-3 h-3 text-gold" /> Se captura al generar la vista previa
          </span>
        </div>
        <ProjectMap onMapReady={onMapReady} />
      </section>
    </div>
  );
}

function TocItem({
  entry,
  isActive,
  onClick,
}: {
  entry: Ni43101TocEntry;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full text-left flex items-center gap-2 px-3 py-2 text-[11px] font-mono transition border-l-2 ${
          isActive
            ? "bg-gold/10 border-gold text-foreground"
            : "border-transparent hover:bg-bg-secondary text-text-secondary hover:text-foreground"
        } ${entry.level === 2 ? "pl-6" : ""}`}
        style={{ paddingLeft: entry.level === 2 ? 24 : undefined }}
      >
        <ChevronRight
          className={`w-3 h-3 shrink-0 ${isActive ? "text-gold" : "opacity-40"}`}
        />
        <span className="flex-1 truncate">{entry.label}</span>
        <span className="text-[10px] text-muted-foreground tabular-nums">{entry.page}</span>
      </button>
    </li>
  );
}
