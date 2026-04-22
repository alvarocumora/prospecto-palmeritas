import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { ProjectMap } from "@/components/ProjectMap";
import { useProjects } from "@/hooks/useProjects";
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

export const Route = createFileRoute("/_authenticated/dashboard/ni43101")({
  head: () => ({
    meta: [
      { title: "Informe NI 43-101 — Trackmin GeoIntel" },
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
    id: "execSummary", number: "RES", title: "Resumen ejecutivo",
    desc: "Síntesis del proyecto, hallazgos clave y recomendaciones.",
    icon: ScrollText, group: "front",
  },
  {
    id: "intro", number: "1", title: "Introducción",
    desc: "Alcance, propósito del informe y términos de referencia.",
    icon: BookOpen, group: "body",
  },
  {
    id: "reliance", number: "2", title: "Confianza en otros expertos",
    desc: "Declaración de fuentes legales, fiscales y de titulación.",
    icon: ClipboardCheck, group: "body",
  },
  {
    id: "property", number: "3", title: "Descripción y ubicación",
    desc: "Mapa del AOI, coordenadas, accesos y catastro SERNAGEOMIN.",
    icon: MapIcon, group: "body",
    requires: (v) => v.mapAvailable && v.catastroAvailable ? "ok" : v.mapAvailable ? "warn" : "err",
  },
  {
    id: "zoning", number: "3.bis", title: "Zonificación geológica",
    desc: "Capas activas, vista satelital y litología del AOI.",
    icon: Satellite, group: "body",
    requires: (v) => v.satelliteAvailable ? (v.geologyAvailable ? "ok" : "warn") : "warn",
  },
  {
    id: "climate", number: "4", title: "Clima, fisiografía e infraestructura",
    desc: "Condiciones operativas, accesos viales y servicios.",
    icon: Cloud, group: "body",
  },
  {
    id: "history", number: "5", title: "Historia",
    desc: "Trabajos previos, propietarios anteriores y producción histórica.",
    icon: History, group: "body",
  },
  {
    id: "geology", number: "6", title: "Geología local y regional",
    desc: "Litología, alteración, mineralogía y rasgos estructurales.",
    icon: Mountain, group: "body",
    requires: (v) => v.geologyAvailable ? "ok" : "warn",
  },
  {
    id: "depositType", number: "7", title: "Tipo de depósito",
    desc: "Modelo conceptual epitermal–mesotermal Au–Cu.",
    icon: Compass, group: "body",
  },
  {
    id: "exploration", number: "8", title: "Exploración",
    desc: "Geofísica IP/Mag, geoquímica y muestreo superficial.",
    icon: FlaskConical, group: "body",
  },
  {
    id: "drilling", number: "9", title: "Sondajes",
    desc: "Programa DDH propuesto: 4 perforaciones, 1.030 m.",
    icon: Pickaxe, group: "body",
  },
  {
    id: "qaqc", number: "10", title: "Preparación, análisis y QA/QC",
    desc: "Protocolos de muestreo, blanks, duplicados y estándares.",
    icon: Microscope, group: "body",
    requires: (v) => v.assaysStatus === "available" ? "ok" : v.assaysStatus === "partial" ? "warn" : "err",
  },
  {
    id: "dataVerification", number: "11", title: "Verificación de datos",
    desc: "Auditoría QP de assays y consistencia de la base de datos.",
    icon: ClipboardCheck, group: "body",
    requires: (v) => v.assaysStatus === "available" ? "ok" : "err",
  },
  {
    id: "budget", number: "12", title: "Presupuesto recomendado",
    desc: "Programa 12 meses · USD 211.310 · 4 fases.",
    icon: Wallet, group: "body",
  },
  {
    id: "conclusions", number: "13", title: "Conclusiones y recomendaciones",
    desc: "Síntesis técnica y próximos pasos para el QP.",
    icon: ListChecks, group: "body",
  },
  {
    id: "references", number: "14", title: "Referencias bibliográficas",
    desc: "Citas geológicas y fuentes consultadas.",
    icon: Library, group: "body",
  },
  {
    id: "annexA", number: "A", title: "Anexo A · Catastro",
    desc: "Tablas SERNAGEOMIN y pertenencias internas del proyecto.",
    icon: Files, group: "annex",
    requires: (v) => v.catastroAvailable ? "ok" : "err",
  },
  {
    id: "annexB", number: "B", title: "Anexo B · Geofísica",
    desc: "Encuestas, líneas y estaciones IP/Mag.",
    icon: Layers, group: "annex",
  },
];

const DEFAULT_ENABLED = new Set<Ni43101SectionId>(ALL_SECTIONS);

function NI43101Module() {
  const { active } = useProjects();
  const projectId = active?.id ?? null;

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includeSatellite, setIncludeSatellite] = useState(true);
  const [includeInternal, setIncludeInternal] = useState(true);

  const [enabled, setEnabled] = useState<Set<Ni43101SectionId>>(new Set(DEFAULT_ENABLED));
  const enabledArray = useMemo(() => Array.from(enabled), [enabled]);
  const includeZoning = enabled.has("zoning");

  const [preview, setPreview] = useState<Ni43101Result | null>(null);
  const [activePage, setActivePage] = useState<number>(1);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

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
    setEnabled(new Set<Ni43101SectionId>([
      "execSummary","property","geology","exploration","drilling",
      "qaqc","dataVerification","budget","conclusions","annexA",
    ]));

  const buildPreview = async () => {
    if (enabled.size === 0) {
      toast.error("Selecciona al menos una sección");
      return;
    }
    setBusy(true);
    setError(null);
    setProgress("Iniciando…");
    try {
      if (preview?.url) URL.revokeObjectURL(preview.url);
      const result = await exportNI43101({
        basemap: includeSatellite ? "satellite" : "topo",
        includeInternalConcessions: includeInternal,
        includeZoning,
        projectId,
        preview: true,
        sections: enabledArray,
        setBasemap,
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
        sections: enabledArray,
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
      iframeRef.current.src = `${preview.url}#page=${page}&view=FitH`;
    }
  };

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
            {active?.name ?? "Prospecto Palmeras"} · {enabled.size}/{ALL_SECTIONS.length} secciones activas
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-gold/40 text-gold font-mono text-[11px] uppercase tracking-wider">
          PDF · NI 43-101
        </span>
      </header>

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
              <div className="text-[10px] text-text-secondary">Usar Esri World Imagery en el snapshot principal</div>
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
              <div className="text-[10px] text-text-secondary">Combinar con catastro SERNAGEOMIN en el Anexo A</div>
            </div>
          </label>
        </div>

        {/* Quick presets */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mr-1">Presets:</span>
          <button onClick={enableAll} className="text-[11px] font-mono px-2 py-1 rounded border border-border hover:border-gold/40">Todas</button>
          <button onClick={enableEssentials} className="text-[11px] font-mono px-2 py-1 rounded border border-border hover:border-gold/40">Esenciales</button>
          <button onClick={enableNone} className="text-[11px] font-mono px-2 py-1 rounded border border-border hover:border-destructive/40 hover:text-destructive">Ninguna</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={buildPreview}
            disabled={busy || enabled.size === 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded bg-gold text-bg-secondary font-mono text-sm hover:bg-gold/90 disabled:opacity-50 active:scale-[0.99] transition"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : preview ? <RefreshCw className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {busy ? progress ?? "Generando…" : preview ? "Regenerar vista previa" : "Generar vista previa"}
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

        {error && <div className="text-xs text-destructive font-mono">{error}</div>}
        {!projectId && (
          <div className="text-xs text-muted-foreground font-mono">
            Sin proyecto activo: el informe usa los datos del Prospecto Palmeras y omite las pertenencias internas.
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
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{g.label}</div>
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
        <section className="rounded border border-dashed border-border bg-bg-secondary/40 p-6 text-center">
          <Eye className="w-8 h-8 text-gold/60 mx-auto mb-2" />
          <div className="text-sm font-mono">Aún no hay vista previa</div>
          <div className="text-[11px] text-text-secondary mt-1">
            Configura las secciones que quieras incluir y genera la vista previa para revisar el informe antes de descargar.
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
        <div className={`shrink-0 w-8 h-8 rounded flex items-center justify-center border ${
          active ? "border-gold/50 text-gold bg-gold/10" : "border-border text-muted-foreground"
        }`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
              active ? "border-gold/40 text-gold" : "border-border text-muted-foreground"
            }`}>
              §{meta.number}
            </span>
            <div className="text-xs font-mono font-semibold truncate">{meta.title}</div>
          </div>
          <div className="text-[10px] text-text-secondary mt-1 line-clamp-2">{meta.desc}</div>
        </div>
        <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition ${
          active ? "bg-gold border-gold" : "border-border"
        }`}>
          {active && <CheckCircle2 className="w-3 h-3 text-bg-secondary" />}
        </div>
      </div>

      {valState && (
        <div className={`flex items-center gap-1.5 text-[10px] font-mono pt-1 border-t ${
          valState === "ok" ? "border-emerald-500/20 text-emerald-500"
          : valState === "warn" ? "border-amber-500/30 text-amber-500"
          : "border-destructive/30 text-destructive"
        }`}>
          {valState === "ok" ? <CheckCircle2 className="w-3 h-3" />
            : valState === "warn" ? <AlertTriangle className="w-3 h-3" />
            : <XCircle className="w-3 h-3" />}
          <span>
            {valState === "ok" ? "Datos disponibles"
              : valState === "warn" ? "Datos parciales"
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
            <span className="text-emerald-600 dark:text-emerald-400">Todas las validaciones OK</span>
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
