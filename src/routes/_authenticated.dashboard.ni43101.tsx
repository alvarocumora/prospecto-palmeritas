import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { PortfolioLayers } from "@/components/geo/WorkspaceProjectLayers";
import { useProjects } from "@/hooks/useProjects";
import { useQualifiedPersons } from "@/hooks/useQualifiedPersons";
import {
  ALL_SECTIONS,
  exportNI43101,
  type Ni43101Result,
  type Ni43101SectionId,
  type Ni43101TocEntry,
  type Ni43101Validations,
} from "@/lib/export-ni43101-pdf";
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
  Settings2,
  ListChecks,
  History,
  Cloud,
  Pickaxe,
  FlaskConical,
  Microscope,
  Wallet,
  ScrollText,
  Library,
  Files,
  Satellite,
  Compass,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Ni43101DraftPanel } from "@/components/satellite/Ni43101DraftPanel";

export const Route = createFileRoute("/_authenticated/dashboard/ni43101")({
  head: () => ({
    meta: [
      { title: "Informe NI 43-101 — Geocapitals" },
      {
        name: "description",
        content:
          "Hub de generación del informe NI 43-101: configura cada sección (catastro, geología, geofísica, sondajes, QA/QC, anexos) y previsualiza antes de exportar.",
      },
    ],
  }),
  component: NI43101Module,
});

/* ============================================================
   Section catalogue — drives the configurable cards
   ============================================================ */

type SectionMeta = {
  id: Ni43101SectionId;
  number: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  group: "front" | "body" | "annex";
  /** Validation flag(s) the section depends on. */
  requires?: (v: Ni43101Validations) => "ok" | "warn" | "err";
};

const SECTIONS: SectionMeta[] = [
  {
    id: "execSummary",
    number: "RES",
    title: "Resumen ejecutivo",
    desc: "Síntesis del proyecto, hallazgos clave y recomendaciones.",
    icon: ScrollText,
    group: "front",
  },
  {
    id: "intro",
    number: "1",
    title: "Introducción",
    desc: "Alcance, propósito del informe y términos de referencia.",
    icon: BookOpen,
    group: "body",
  },
  {
    id: "reliance",
    number: "2",
    title: "Confianza en otros expertos",
    desc: "Declaración de fuentes legales, fiscales y de titulación.",
    icon: ClipboardCheck,
    group: "body",
  },
  {
    id: "property",
    number: "3",
    title: "Descripción y ubicación",
    desc: "Mapa del AOI, coordenadas, accesos y catastro SERNAGEOMIN.",
    icon: MapIcon,
    group: "body",
    requires: (v) =>
      v.mapAvailable && v.catastroAvailable ? "ok" : v.mapAvailable ? "warn" : "err",
  },
  {
    id: "zoning",
    number: "3.bis",
    title: "Zonificación geológica",
    desc: "Capas activas, vista satelital y litología del AOI.",
    icon: Satellite,
    group: "body",
    requires: (v) => (v.satelliteAvailable ? (v.geologyAvailable ? "ok" : "warn") : "warn"),
  },
  {
    id: "climate",
    number: "4",
    title: "Clima, fisiografía e infraestructura",
    desc: "Condiciones operativas, accesos viales y servicios.",
    icon: Cloud,
    group: "body",
  },
  {
    id: "history",
    number: "5",
    title: "Historia",
    desc: "Trabajos previos, propietarios anteriores y producción histórica.",
    icon: History,
    group: "body",
  },
  {
    id: "geology",
    number: "6",
    title: "Geología local y regional",
    desc: "Litología, alteración, mineralogía y rasgos estructurales.",
    icon: Mountain,
    group: "body",
    requires: (v) => (v.geologyAvailable ? "ok" : "warn"),
  },
  {
    id: "depositType",
    number: "7",
    title: "Tipo de depósito",
    desc: "Modelo conceptual epitermal–mesotermal Au–Cu.",
    icon: Compass,
    group: "body",
  },
  {
    id: "exploration",
    number: "8",
    title: "Exploración",
    desc: "Geofísica IP/Mag, geoquímica y muestreo superficial.",
    icon: FlaskConical,
    group: "body",
  },
  {
    id: "drilling",
    number: "9",
    title: "Sondajes",
    desc: "Programa DDH propuesto: 4 perforaciones, 1.030 m.",
    icon: Pickaxe,
    group: "body",
  },
  {
    id: "qaqc",
    number: "10",
    title: "Preparación, análisis y QA/QC",
    desc: "Protocolos de muestreo, blanks, duplicados y estándares.",
    icon: Microscope,
    group: "body",
    requires: (v) =>
      v.assaysStatus === "available" ? "ok" : v.assaysStatus === "partial" ? "warn" : "err",
  },
  {
    id: "dataVerification",
    number: "11",
    title: "Verificación de datos",
    desc: "Auditoría QP de assays y consistencia de la base de datos.",
    icon: ClipboardCheck,
    group: "body",
    requires: (v) => (v.assaysStatus === "available" ? "ok" : "err"),
  },
  {
    id: "budget",
    number: "12",
    title: "Presupuesto recomendado",
    desc: "Programa 12 meses · USD 211.310 · 4 fases.",
    icon: Wallet,
    group: "body",
  },
  {
    id: "conclusions",
    number: "13",
    title: "Conclusiones y recomendaciones",
    desc: "Síntesis técnica y próximos pasos para el QP.",
    icon: ListChecks,
    group: "body",
  },
  {
    id: "resourceEstimates",
    number: "14",
    title: "Estimación de recursos",
    desc: "Modelos de bloques IDW/NN, tonelaje, ley media y metal contenido.",
    icon: Mountain,
    group: "body",
  },
  {
    id: "references",
    number: "14b",
    title: "Referencias bibliográficas",
    desc: "Citas geológicas y fuentes consultadas.",
    icon: Library,
    group: "body",
  },
  {
    id: "annexA",
    number: "A",
    title: "Anexo A · Catastro",
    desc: "Tablas SERNAGEOMIN y pertenencias internas del proyecto.",
    icon: Files,
    group: "annex",
    requires: (v) => (v.catastroAvailable ? "ok" : "err"),
  },
  {
    id: "annexB",
    number: "B",
    title: "Anexo B · Geofísica",
    desc: "Encuestas, líneas y estaciones IP/Mag.",
    icon: Layers,
    group: "annex",
  },
];

const DEFAULT_ENABLED = new Set<Ni43101SectionId>(ALL_SECTIONS);

type ProgressInfo = { label: string; current: number; total: number; phase?: string };

function NI43101Module() {
  const { active } = useProjects();
  const projectId = active?.id ?? null;
  const { reports } = useQualifiedPersons();
  const [reportId, setReportId] = useState<string | null>(null);
  if (!reportId && reports.length > 0) setReportId(reports[0].id);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const handleProgress = useCallback((step: string | ProgressInfo) => {
    if (typeof step === "string") {
      setProgress((prev) => ({
        label: step,
        current: prev?.current ?? 0,
        total: prev?.total ?? 0,
        phase: "setup",
      }));
    } else {
      setProgress(step);
    }
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [includeSatellite, setIncludeSatellite] = useState(true);
  const [includeInternal, setIncludeInternal] = useState(true);

  const [enabled, setEnabled] = useState<Set<Ni43101SectionId>>(new Set(DEFAULT_ENABLED));
  const enabledArray = useMemo(() => Array.from(enabled), [enabled]);
  const includeZoning = enabled.has("zoning");

  const [preview, setPreview] = useState<Ni43101Result | null>(null);
  const [activePage, setActivePage] = useState<number>(1);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const tocListRef = useRef<HTMLUListElement | null>(null);
  const tocItemRefs = useRef<Map<number, HTMLLIElement>>(new Map());

  // Poll the iframe hash to detect in-PDF page navigation (browser native viewer)
  useEffect(() => {
    if (!preview) return;
    const id = window.setInterval(() => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      try {
        const hash = iframe.contentWindow?.location?.hash ?? "";
        const m = hash.match(/page=(\d+)/);
        if (m) {
          const p = Number(m[1]);
          if (Number.isFinite(p) && p !== activePage) setActivePage(p);
        }
      } catch {
        // cross-origin or not ready — ignore
      }
    }, 700);
    return () => window.clearInterval(id);
  }, [preview, activePage]);

  // Autoscroll the active TOC entry into view
  useEffect(() => {
    if (!preview) return;
    // Find the toc entry whose page is the largest <= activePage
    const candidates = preview.toc.map((e, i) => ({ ...e, i })).filter((e) => e.page <= activePage);
    const target = candidates.length
      ? candidates[candidates.length - 1]
      : preview.toc[0]
        ? { ...preview.toc[0], i: 0 }
        : null;
    if (!target) return;
    const el = tocItemRefs.current.get(target.i);
    if (el && tocListRef.current) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activePage, preview]);

  // Basemap conmutado para captura del PDF (null = lo elige el usuario)
  const [captureBasemap, setCaptureBasemap] = useState<"satellite" | "topo" | null>(null);

  const mapRef = useRef<LeafletMap | null>(null);
  const onMapReady = useCallback((map: LeafletMap) => {
    mapRef.current = map;
  }, []);

  // Callback used by the PDF exporter to flip basemap before snapshot.
  // Returns a promise that resolves once React has flushed and tiles likely loaded.
  const setBasemap = useCallback(async (b: "satellite" | "topo") => {
    setCaptureBasemap(b);
    // Wait two animation frames + a short delay so Leaflet swaps tiles
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    await new Promise((r) => setTimeout(r, 250));
  }, []);

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview?.url]);

  const toggleSection = (id: Ni43101SectionId) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enableAll = () => setEnabled(new Set(ALL_SECTIONS));
  const enableNone = () => setEnabled(new Set());
  const enableEssentials = () =>
    setEnabled(
      new Set<Ni43101SectionId>([
        "execSummary",
        "property",
        "geology",
        "exploration",
        "drilling",
        "qaqc",
        "dataVerification",
        "budget",
        "conclusions",
        "annexA",
      ]),
    );

  const buildPreview = async () => {
    if (enabled.size === 0) {
      toast.error("Selecciona al menos una sección");
      return;
    }
    setBusy(true);
    setError(null);
    setProgress({ label: "Iniciando…", current: 0, total: 0, phase: "setup" });
    try {
      if (preview?.url) URL.revokeObjectURL(preview.url);
      const result = await exportNI43101({
        basemap: includeSatellite ? "satellite" : "topo",
        includeInternalConcessions: includeInternal,
        includeZoning,
        projectId,
        reportId,
        preview: true,
        sections: enabledArray,
        setBasemap,
        onProgress: handleProgress,
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
      const a = document.createElement("a");
      a.href = preview.url;
      a.download = preview.filename;
      a.click();
      return;
    }
    setBusy(true);
    setError(null);
    setProgress({ label: "Generando PDF…", current: 0, total: 0, phase: "setup" });
    try {
      await exportNI43101({
        basemap: includeSatellite ? "satellite" : "topo",
        includeInternalConcessions: includeInternal,
        includeZoning,
        projectId,
        reportId,
        sections: enabledArray,
        setBasemap,
        onProgress: handleProgress,
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

  const goToPage = useCallback(
    (page: number) => {
      setActivePage(page);
      if (preview && iframeRef.current) {
        iframeRef.current.src = `${preview.url}#page=${page}&view=FitH`;
      }
    },
    [preview],
  );

  // Section nav: jump to previous/next level-1 (or level-0) TOC entry.
  const goToSectionDelta = useCallback(
    (delta: 1 | -1) => {
      if (!preview) return;
      const sectionEntries = preview.toc
        .map((e, i) => ({ ...e, i }))
        .filter((e) => e.level === 1 || e.level === 0);
      if (sectionEntries.length === 0) return;
      // Find index of current section (largest section page <= activePage)
      let curr = 0;
      for (let i = 0; i < sectionEntries.length; i++) {
        if (sectionEntries[i].page <= activePage) curr = i;
      }
      const next = Math.max(0, Math.min(sectionEntries.length - 1, curr + delta));
      goToPage(sectionEntries[next].page);
    },
    [preview, activePage, goToPage],
  );

  // Global keyboard shortcuts when preview is loaded (skip if user is typing).
  useEffect(() => {
    if (!preview) return;
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      const isEditable =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable;
      if (isEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "j" || e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        goToSectionDelta(1);
      } else if (e.key === "k" || e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goToSectionDelta(-1);
      } else if (e.key === "Home") {
        e.preventDefault();
        goToPage(1);
      } else if (e.key === "End" && preview.totalPages) {
        e.preventDefault();
        goToPage(preview.totalPages);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [preview, goToSectionDelta, goToPage]);

  const groups: { key: SectionMeta["group"]; label: string }[] = [
    { key: "front", label: "Frontal" },
    { key: "body", label: "Cuerpo del informe" },
    { key: "annex", label: "Anexos" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-mono font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-gold" /> Hub Informe NI 43-101
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            {active?.name ?? "Prospecto Palmeras"} · {enabled.size}/{ALL_SECTIONS.length} secciones
            activas
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-gold/40 text-gold font-mono text-[11px] uppercase tracking-wider">
          PDF · NI 43-101
        </span>
      </header>

      {/* Borrador automático a partir de los productos satelitales/geológicos cargados */}
      <Ni43101DraftPanel projectId={projectId} />

      {/* Global options + actions */}
      <section className="rounded border border-border bg-bg-secondary p-4 md:p-5 space-y-4">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-text-secondary">
          <Settings2 className="w-3.5 h-3.5" /> Opciones globales
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-start gap-2 p-3 rounded border border-border bg-bg-primary cursor-pointer hover:border-gold/40">
            <input
              type="checkbox"
              checked={includeSatellite}
              onChange={(e) => setIncludeSatellite(e.target.checked)}
              className="mt-0.5"
            />
            <div>
              <div className="text-xs font-mono">Basemap satelital</div>
              <div className="text-[10px] text-text-secondary">
                Usar Esri World Imagery en el snapshot principal
              </div>
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
              <div className="text-[10px] text-text-secondary">
                Combinar con catastro SERNAGEOMIN en el Anexo A
              </div>
            </div>
          </label>
        </div>

        {/* Quick presets */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mr-1">
            Presets:
          </span>
          <button
            onClick={enableAll}
            className="text-[11px] font-mono px-2 py-1 rounded border border-border hover:border-gold/40"
          >
            Todas
          </button>
          <button
            onClick={enableEssentials}
            className="text-[11px] font-mono px-2 py-1 rounded border border-border hover:border-gold/40"
          >
            Esenciales
          </button>
          <button
            onClick={enableNone}
            className="text-[11px] font-mono px-2 py-1 rounded border border-border hover:border-destructive/40 hover:text-destructive"
          >
            Ninguna
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={buildPreview}
            disabled={busy || enabled.size === 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded bg-gold text-bg-secondary font-mono text-sm hover:bg-gold/90 disabled:opacity-50 active:scale-[0.99] transition"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : preview ? (
              <RefreshCw className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            {busy
              ? (progress?.label ?? "Generando…")
              : preview
                ? "Regenerar vista previa"
                : "Generar vista previa"}
          </button>
          <button
            onClick={downloadDirect}
            disabled={busy || enabled.size === 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded border border-gold/50 text-gold font-mono text-sm hover:bg-gold/10 disabled:opacity-50 active:scale-[0.99] transition"
          >
            <Download className="w-4 h-4" />
            {preview ? "Descargar PDF" : "Generar y descargar"}
          </button>
        </div>

        {busy && progress && (
          <div className="space-y-1.5 p-3 rounded border border-gold/30 bg-gold/5">
            <div className="flex items-center justify-between gap-3 text-[11px] font-mono">
              <div className="flex items-center gap-2 min-w-0">
                <Loader2 className="w-3.5 h-3.5 text-gold animate-spin shrink-0" />
                <span className="truncate text-foreground">{progress.label}</span>
              </div>
              <span className="text-muted-foreground tabular-nums shrink-0">
                {progress.total > 0 ? `${progress.current}/${progress.total}` : "…"}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-bg-primary overflow-hidden">
              <div
                className="h-full bg-gold transition-all duration-300"
                style={{
                  width:
                    progress.total > 0
                      ? `${Math.min(100, Math.round((progress.current / progress.total) * 100))}%`
                      : "8%",
                }}
              />
            </div>
            <div className="text-[10px] font-mono text-muted-foreground">
              {progress.phase === "render"
                ? "Renderizando secciones del PDF…"
                : progress.phase === "finalize"
                  ? "Aplicando encabezados, índice y compilación final…"
                  : "Preparando datos y snapshots del mapa…"}
            </div>
          </div>
        )}
        {error && <div className="text-xs text-destructive font-mono">{error}</div>}
        {!projectId && (
          <div className="text-xs text-muted-foreground font-mono">
            Sin proyecto activo: el informe usa los datos del Prospecto Palmeras y omite las
            pertenencias internas.
          </div>
        )}
      </section>

      {/* Section cards grid */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-text-secondary">
          <Layers className="w-3.5 h-3.5" /> Secciones del informe
        </div>
        {groups.map((g) => {
          const items = SECTIONS.filter((s) => s.group === g.key);
          if (items.length === 0) return null;
          return (
            <div key={g.key} className="space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {g.label}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((meta) => (
                  <SectionCard
                    key={meta.id}
                    meta={meta}
                    active={enabled.has(meta.id)}
                    onToggle={() => toggleSection(meta.id)}
                    validations={preview?.validations ?? null}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* Validations panel */}
      {preview && <ValidationsPanel v={preview.validations} />}

      {/* Preview viewer */}
      {preview ? (
        <section className="rounded border border-border bg-bg-secondary overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-bg-primary/60 flex-wrap">
            <Eye className="w-3.5 h-3.5 text-gold" />
            <div className="text-xs font-mono uppercase tracking-wider text-text-secondary">
              Vista previa · {preview.totalPages} páginas
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => goToSectionDelta(-1)}
                aria-label="Sección anterior (K / flecha arriba)"
                title="Sección anterior · K / ↑"
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-[10px] font-mono hover:border-gold/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-1 focus-visible:ring-offset-bg-secondary"
              >
                <ChevronRight className="w-3 h-3 rotate-180" />
                Anterior
              </button>
              <button
                type="button"
                onClick={() => goToSectionDelta(1)}
                aria-label="Sección siguiente (J / flecha abajo)"
                title="Sección siguiente · J / ↓"
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-[10px] font-mono hover:border-gold/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-1 focus-visible:ring-offset-bg-secondary"
              >
                Siguiente
                <ChevronRight className="w-3 h-3" />
              </button>
              <span className="hidden md:inline text-[10px] font-mono text-muted-foreground ml-1.5">
                Atajos: <kbd className="px-1 rounded border border-border">J</kbd>/
                <kbd className="px-1 rounded border border-border">K</kbd> ·{" "}
                <kbd className="px-1 rounded border border-border">↑</kbd>/
                <kbd className="px-1 rounded border border-border">↓</kbd> · pág. {activePage}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] min-h-[70vh]">
            <aside
              className="border-b md:border-b-0 md:border-r border-border bg-bg-primary/30 max-h-[40vh] md:max-h-[80vh] overflow-y-auto flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold"
              tabIndex={0}
              aria-label="Tabla de contenidos del informe"
            >
              <ul
                ref={tocListRef}
                role="listbox"
                aria-label="Secciones"
                className="py-1 flex-1"
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    goToSectionDelta(e.key === "ArrowDown" ? 1 : -1);
                  } else if (e.key === "Home") {
                    e.preventDefault();
                    goToPage(1);
                  } else if (e.key === "End") {
                    e.preventDefault();
                    goToPage(preview.totalPages);
                  }
                }}
              >
                {preview.toc.map((entry, i) => {
                  const activeIdx = preview.toc.reduce(
                    (acc, e, idx) => (e.page <= activePage ? idx : acc),
                    0,
                  );
                  return (
                    <TocItem
                      key={`${entry.page}-${i}`}
                      entry={entry}
                      isActive={i === activeIdx}
                      isExact={entry.page === activePage}
                      onClick={() => goToPage(entry.page)}
                      registerRef={(el) => {
                        if (el) tocItemRefs.current.set(i, el);
                        else tocItemRefs.current.delete(i);
                      }}
                    />
                  );
                })}
              </ul>
              <ActiveSectionDescription toc={preview.toc} activePage={activePage} />
            </aside>
            <div
              tabIndex={0}
              role="region"
              aria-label="Visor del PDF — use J/K o flechas para cambiar de sección"
              className="bg-black/30 min-h-[60vh] md:min-h-[80vh] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold"
            >
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
        <section className="rounded border border-dashed border-border bg-bg-secondary/40 p-6 text-center">
          <Eye className="w-8 h-8 text-gold/60 mx-auto mb-2" />
          <div className="text-sm font-mono">Aún no hay vista previa</div>
          <div className="text-[11px] text-text-secondary mt-1">
            Configura las secciones que quieras incluir y genera la vista previa para revisar el
            informe antes de descargar.
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
          <li>
            • Tabla <code className="text-foreground">mining_concessions</code> del proyecto activo
          </li>
          <li>
            • Geología: <code className="text-foreground">lithology_units</code>,{" "}
            <code className="text-foreground">alteration_zones</code>,{" "}
            <code className="text-foreground">mineralogy</code>,{" "}
            <code className="text-foreground">geological_features</code>
          </li>
          <li>
            • Geofísica:{" "}
            <code className="text-foreground">geophysics_surveys / lines / stations</code>
          </li>
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
        {active && (
          <PortfolioLayers
            project={active}
            view="2d"
            onMapReady={onMapReady}
            basemapOverride={captureBasemap}
          />
        )}
        {captureBasemap && (
          <div className="mt-2 text-[10px] font-mono text-amber-500 flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Basemap conmutado a <span className="uppercase">{captureBasemap}</span> para captura del
            informe…
          </div>
        )}
      </section>
    </div>
  );
}

/* ============================================================
   Section card
   ============================================================ */

function SectionCard({
  meta,
  active,
  onToggle,
  validations,
}: {
  meta: SectionMeta;
  active: boolean;
  onToggle: () => void;
  validations: Ni43101Validations | null;
}) {
  const Icon = meta.icon;
  const valState = validations && meta.requires ? meta.requires(validations) : null;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`group text-left rounded border transition p-3 flex flex-col gap-2 ${
        active
          ? "border-gold/60 bg-gold/5 hover:border-gold"
          : "border-border bg-bg-secondary hover:border-border/80 opacity-70 hover:opacity-100"
      }`}
    >
      <div className="flex items-start gap-2">
        <div
          className={`shrink-0 w-8 h-8 rounded flex items-center justify-center border ${
            active ? "border-gold/50 text-gold bg-gold/10" : "border-border text-muted-foreground"
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                active ? "border-gold/40 text-gold" : "border-border text-muted-foreground"
              }`}
            >
              §{meta.number}
            </span>
            <div className="text-xs font-mono font-semibold truncate">{meta.title}</div>
          </div>
          <div className="text-[10px] text-text-secondary mt-1 line-clamp-2">{meta.desc}</div>
        </div>
        <div
          className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition ${
            active ? "bg-gold border-gold" : "border-border"
          }`}
        >
          {active && <CheckCircle2 className="w-3 h-3 text-bg-secondary" />}
        </div>
      </div>

      {valState && (
        <div
          className={`flex items-center gap-1.5 text-[10px] font-mono pt-1 border-t ${
            valState === "ok"
              ? "border-emerald-500/20 text-emerald-500"
              : valState === "warn"
                ? "border-amber-500/30 text-amber-500"
                : "border-destructive/30 text-destructive"
          }`}
        >
          {valState === "ok" ? (
            <CheckCircle2 className="w-3 h-3" />
          ) : valState === "warn" ? (
            <AlertTriangle className="w-3 h-3" />
          ) : (
            <XCircle className="w-3 h-3" />
          )}
          <span>
            {valState === "ok"
              ? "Datos disponibles"
              : valState === "warn"
                ? "Datos parciales"
                : "Datos faltantes — revisar"}
          </span>
        </div>
      )}
    </button>
  );
}

/* ============================================================
   TOC + Validations
   ============================================================ */

function TocItem({
  entry,
  isActive,
  isExact,
  onClick,
  registerRef,
}: {
  entry: Ni43101TocEntry;
  isActive: boolean;
  isExact: boolean;
  onClick: () => void;
  registerRef: (el: HTMLLIElement | null) => void;
}) {
  return (
    <li ref={registerRef} className="relative">
      {isActive && (
        <span aria-hidden className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-gold" />
      )}
      <button
        onClick={onClick}
        aria-current={isExact ? "page" : isActive ? "true" : undefined}
        className={`w-full text-left flex items-center gap-2 px-3 py-2 text-[11px] font-mono transition border-l-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold ${
          isActive
            ? "bg-gold/10 border-gold text-foreground"
            : "border-transparent hover:bg-bg-secondary text-text-secondary hover:text-foreground"
        } ${entry.level === 2 ? "pl-6" : ""}`}
        style={{ paddingLeft: entry.level === 2 ? 24 : undefined }}
      >
        <ChevronRight className={`w-3 h-3 shrink-0 ${isActive ? "text-gold" : "opacity-40"}`} />
        <span className="flex-1 truncate">{entry.label}</span>
        {isExact && (
          <span className="text-[9px] font-mono px-1 rounded bg-gold/20 text-gold uppercase">
            ahora
          </span>
        )}
        <span className="text-[10px] text-muted-foreground tabular-nums">{entry.page}</span>
      </button>
    </li>
  );
}

function ValidationsPanel({ v }: { v: Ni43101Validations }) {
  const items: { label: string; status: "ok" | "warn" | "err"; detail: string }[] = [
    {
      label: "Assays",
      status: v.assaysStatus === "available" ? "ok" : v.assaysStatus === "partial" ? "warn" : "err",
      detail:
        v.assaysStatus === "available"
          ? `${v.assaysCount} resultados`
          : v.assaysStatus === "partial"
            ? `Parcial (${v.assaysCount})`
            : "PENDING — sin datos",
    },
    {
      label: "Catastro SERNAGEOMIN",
      status: v.catastroAvailable ? "ok" : "err",
      detail: v.catastroAvailable ? `${v.catastroCount} pertenencias` : "No disponible",
    },
    {
      label: "Vista satelital",
      status: v.satelliteAvailable ? "ok" : "warn",
      detail: v.satelliteAvailable ? "Snapshot capturado" : "No capturada",
    },
    {
      label: "Mapa principal",
      status: v.mapAvailable ? "ok" : "err",
      detail: v.mapAvailable ? "Snapshot capturado" : "No capturado",
    },
    {
      label: "Geología",
      status: v.geologyAvailable ? "ok" : "warn",
      detail: v.geologyAvailable ? "Litología cargada" : "Sin unidades litológicas",
    },
  ];
  const hasIssue = items.some((i) => i.status !== "ok");
  return (
    <section
      className={`rounded border p-3 space-y-2 ${
        hasIssue ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/30 bg-emerald-500/5"
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider">
        {hasIssue ? (
          <>
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-amber-600 dark:text-amber-400">Validaciones con avisos</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-emerald-600 dark:text-emerald-400">
              Todas las validaciones OK
            </span>
          </>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground normal-case tracking-normal">
          Los avisos también se incluyen en el PDF
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {items.map((it) => (
          <div
            key={it.label}
            className={`rounded border px-2 py-1.5 text-[10px] font-mono flex items-start gap-1.5 ${
              it.status === "ok"
                ? "border-emerald-500/30 bg-emerald-500/5"
                : it.status === "warn"
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-destructive/40 bg-destructive/5"
            }`}
          >
            {it.status === "ok" ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
            ) : it.status === "warn" ? (
              <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <div className="truncate">{it.label}</div>
              <div className="text-muted-foreground truncate">{it.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   Active section description (under TOC)
   ============================================================ */

function findSectionForToc(label: string): SectionMeta | null {
  // TOC labels start with "<number>. <title>" or "<number>.<sub>  <title>"
  // SECTIONS[].number is e.g. "RES", "1", "3", "3.bis", "A", "B".
  const trimmed = label.trim();
  // Try exact prefix match against any SECTIONS entry's "<number>. " or "<number>  ".
  for (const s of SECTIONS) {
    const prefixes = [`${s.number}. `, `${s.number}.  `, `${s.number} `];
    if (prefixes.some((p) => trimmed.startsWith(p))) return s;
    // Sub-section like "3.1  ..." should still resolve to section 3.
  }
  // Fallback: leading numeric token before "." matches a SECTIONS.number.
  const m = trimmed.match(/^([A-Z]|\d+(?:\.[a-z]+)?)/);
  if (m) {
    const head = m[1];
    const hit = SECTIONS.find((s) => s.number === head);
    if (hit) return hit;
  }
  return null;
}

function ActiveSectionDescription({
  toc,
  activePage,
}: {
  toc: Ni43101TocEntry[];
  activePage: number;
}) {
  // Find the deepest TOC entry whose page <= activePage; resolve to its parent section meta.
  const candidates = toc.filter((e) => e.page <= activePage);
  const current = candidates.length ? candidates[candidates.length - 1] : toc[0];
  if (!current) return null;
  // Walk back from current to find a level-1 (section) entry for context.
  let sectionEntry = current;
  for (let i = toc.indexOf(current); i >= 0; i--) {
    if (toc[i].level === 1 || toc[i].level === 0) {
      sectionEntry = toc[i];
      break;
    }
  }
  const meta = findSectionForToc(sectionEntry.label);
  return (
    <div className="border-t border-border bg-bg-secondary/60 p-3 space-y-1.5 sticky bottom-0">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <FileText className="w-3 h-3 text-gold" />
        Sección activa · pág. {activePage}
      </div>
      {meta ? (
        <>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-gold/40 text-gold">
              §{meta.number}
            </span>
            <div className="text-xs font-mono font-semibold truncate">{meta.title}</div>
          </div>
          <p className="text-[11px] text-text-secondary leading-relaxed">{meta.desc}</p>
        </>
      ) : (
        <>
          <div className="text-xs font-mono font-semibold truncate">{sectionEntry.label}</div>
          <p className="text-[11px] text-text-secondary leading-relaxed">
            Contenido frontal del informe (portada, índice o resumen).
          </p>
        </>
      )}
    </div>
  );
}
