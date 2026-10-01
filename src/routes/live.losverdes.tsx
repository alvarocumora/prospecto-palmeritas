import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import {
  MapPin,
  FileDown,
  Loader2,
  Layers,
  Target,
  Satellite,
  Pickaxe,
  Sparkles,
  AlertTriangle,
  Box,
  Copy,
  CheckCircle2,
  TestTube2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PublicCanonicalMap } from "@/components/geo/PublicCanonicalMap";
const PublicCanonicalScene = lazy(() =>
  import("@/components/geo/PublicCanonicalScene").then((module) => ({
    default: module.PublicCanonicalScene,
  })),
);
import { MinePlanPanel } from "@/components/live/MinePlanPanel";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { TargetExplainerDialog } from "@/components/live/TargetExplainerDialog";
import { getLosVerdesAnomalies, getLosVerdesPublicLayers } from "@/lib/livemap-public.functions";
import { getLosVerdesMapData } from "@/lib/losverdes-map.functions";
import { buildLosVerdesPublicGeoBundle } from "@/lib/geospatial/losVerdesPublicGeoAdapter";
import { getLosVerdesMining } from "@/lib/losverdes-veins.functions";
import { getTilamaReport } from "@/lib/tilama.functions";
import { generateTilamaPdf } from "@/lib/tilama-pdf";
import { ProjectDocsMenu } from "@/components/documents/ProjectDocsMenu";
import { buildLosVerdesDoc } from "@/lib/pdf/adapters/losVerdes";

import { syncLosVerdes5Catastro } from "@/lib/losverdes5-catastro.functions";
import { generateConceptualModelFn } from "@/lib/conceptualModel.functions";
import { onLosVerdesFocus } from "@/lib/losverdes-focus";
import { publicUrl } from "@/lib/publicUrl";
import losVerdesImage from "@/assets/project-losverdes.jpg.asset.json";

export const Route = createFileRoute("/live/losverdes")({
  head: () => ({
    meta: [
      { title: "Live · Distrito Cuprífero Los Verdes – Tilama · Geocapitals" },
      {
        name: "description",
        content:
          "Ficha pública del Distrito Los Verdes–Tilama con catastro, 190 muestras geoquímicas, targets, anomalías y PDF técnico descargable.",
      },
      { property: "og:title", content: "Los Verdes–Tilama · Live Map — Geocapitals" },
      {
        property: "og:description",
        content:
          "Mapa interactivo, muestreo geoquímico y reporte técnico descargable del proyecto Los Verdes–Tilama.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "theme-color", content: "#f5f1e8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
    links: [{ rel: "manifest", href: "/manifest.losverdes.json" }],
  }),
  component: LiveLosVerdesPage,
  pendingComponent: () => (
    <div
      data-theme="im-light"
      className="min-h-screen bg-background flex items-center justify-center"
    >
      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        Cargando Los Verdes…
      </div>
    </div>
  ),
  errorComponent: ({ error, reset }) => (
    <div
      data-theme="im-light"
      className="min-h-screen bg-background flex items-center justify-center p-6"
    >
      <div className="max-w-md text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
        <h1 className="text-lg font-semibold text-foreground">
          No pudimos cargar el visor Los Verdes
        </h1>
        <p className="text-xs font-mono text-muted-foreground break-words">
          {error instanceof Error ? error.message : String(error)}
        </p>
        <Button
          size="sm"
          onClick={reset}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Reintentar
        </Button>
      </div>
    </div>
  ),
});

/** ErrorBoundary local para aislar el visor 3D del resto de la página. */
class EngineErrorBoundary extends Component<
  { children: ReactNode; onReset?: () => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[LosVerdes] Engine3D crashed:", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="w-full h-[640px] rounded-lg border border-amber-500/40 bg-bg-secondary flex items-center justify-center p-6">
          <div className="max-w-sm text-center space-y-2">
            <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto" />
            <div className="text-sm text-foreground">Visor 3D no disponible</div>
            <div className="text-[10px] font-mono text-muted-foreground break-words">
              {this.state.error.message}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                this.setState({ error: null });
                this.props.onReset?.();
              }}
            >
              Reintentar
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function fmtUsd(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}
function fmtT(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)} Mt`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)} kt`;
  return `${v.toFixed(0)} t`;
}

function severityColor(s: string | null) {
  switch ((s ?? "").toLowerCase()) {
    case "high":
      return "bg-red-500/20 text-red-300 border-red-500/40";
    case "medium":
      return "bg-amber-500/20 text-amber-300 border-amber-500/40";
    default:
      return "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
  }
}
function priorityColor(p: string | null) {
  switch ((p ?? "").toLowerCase()) {
    case "critical":
      return "bg-red-500/20 text-red-300 border-red-500/40";
    case "high":
      return "bg-amber-500/20 text-amber-300 border-amber-500/40";
    case "medium":
      return "bg-blue-500/20 text-blue-300 border-blue-500/40";
    default:
      return "bg-slate-500/20 text-slate-300 border-slate-500/40";
  }
}

function LiveLosVerdesPage() {
  const fetchLayers = useServerFn(getLosVerdesPublicLayers);
  const fetchAnomalies = useServerFn(getLosVerdesAnomalies);
  const fetchMining = useServerFn(getLosVerdesMining);
  const fetchMapData = useServerFn(getLosVerdesMapData);
  const fetchReport = useServerFn(getTilamaReport);

  const layersQ = useQuery({
    queryKey: ["losverdes", "public-layers"],
    queryFn: () => fetchLayers(),
    staleTime: 5 * 60_000,
  });
  const anomalyQ = useQuery({
    queryKey: ["losverdes", "public-anomalies"],
    queryFn: () => fetchAnomalies(),
    staleTime: 5 * 60_000,
  });
  const miningQ = useQuery({
    queryKey: ["losverdes", "mining"],
    queryFn: () => fetchMining(),
    staleTime: 5 * 60_000,
  });
  const mapDataQ = useQuery({
    queryKey: ["losverdes", "canonical-public-map"],
    queryFn: () => fetchMapData(),
    staleTime: 5 * 60_000,
  });
  const reportQ = useQuery({
    queryKey: ["losverdes", "report"],
    queryFn: () => fetchReport(),
    staleTime: 60_000,
  });

  const { isAdmin } = useIsSuperAdmin();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [catBusy, setCatBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [aiTarget, setAiTarget] = useState<{ code: string; name: string } | null>(null);
  const [mounted, setMounted] = useState(false);
  // Visor 3D canónico bajo demanda: aísla fallos gráficos del resto de la ficha pública.
  const [engineOn, setEngineOn] = useState(false);
  const [engineKey, setEngineKey] = useState(0);
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);
  const liveUrl = publicUrl("/live/losverdes");
  useEffect(() => {
    let active = true;
    void import("qrcode").then((mod) =>
      mod.toDataURL(liveUrl, { width: 320, margin: 1 }).then((value) => {
        if (active) setQr(value);
      }),
    );
    return () => {
      active = false;
    };
  }, [liveUrl]);
  const syncCatastro = useServerFn(syncLosVerdes5Catastro);
  const genConceptual = useServerFn(generateConceptualModelFn);

  const handleGenConceptual = async () => {
    setGenBusy(true);
    const tid = toast.loading("Generando sondajes + block model + pit shells conceptuales…");
    try {
      const r = await genConceptual({
        data: { projectId: "7a499b02-ecdf-447b-8956-b106fe4ec087" },
      });
      toast.success(
        `Modelo conceptual generado: ${r.drillholes} sondajes · ${r.assays} assays · ${r.blocks} bloques · ${r.pitShells} pit shells`,
        { id: tid, duration: 8000 },
      );
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`, { id: tid });
    } finally {
      setGenBusy(false);
    }
  };

  useEffect(() => {
    return onLosVerdesFocus((evt) => {
      if (evt.kind !== "target" || !evt.id) return;
      const id = String(evt.id);
      // Ignorar focos que no son exploration_targets (ej. fases del mine plan)
      if (id.startsWith("phase-")) return;
      setAiTarget({ code: id, name: String(evt.label ?? id) });
    });
  }, []);

  const handlePdf = async () => {
    if (!reportQ.data) return;
    setPdfBusy(true);
    try {
      const doc = await generateTilamaPdf(reportQ.data, miningQ.data ?? undefined);
      doc.save(
        `Geocapitals-LosVerdes-${reportQ.data.project.code}-${new Date()
          .toISOString()
          .slice(0, 10)}.pdf`,
      );
      toast.success("Informe PDF generado");
    } catch (e) {
      console.error(e);
      toast.error("Error generando PDF");
    } finally {
      setPdfBusy(false);
    }
  };

  const handleSyncCatastro = async () => {
    setCatBusy(true);
    const tid = toast.loading("Descargando catastro SERNAGEOMIN…");
    try {
      const r = await syncCatastro({ data: { radiusKm: 15 } });
      if (!r.ok) {
        toast.error(`Error: ${r.error ?? "sin detalle"}`, { id: tid });
        return;
      }
      toast.success(
        `Catastro sincronizado: ${r.matched}/${r.matched + r.unmatched} concesiones enlazadas · ${r.fetched} polígonos descargados`,
        { id: tid, duration: 6000 },
      );
      // Refresca capas y reporte
      layersQ.refetch();
      mapDataQ.refetch();
      reportQ.refetch();
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`, { id: tid });
    } finally {
      setCatBusy(false);
    }
  };

  const publicGeoBundle = useMemo(
    () =>
      layersQ.data && mapDataQ.data
        ? buildLosVerdesPublicGeoBundle(
            layersQ.data.canonical,
            mapDataQ.data,
            miningQ.data,
            anomalyQ.data,
          )
        : null,
    [anomalyQ.data, layersQ.data, mapDataQ.data, miningQ.data],
  );

  const stats = reportQ.data?.stats;
  const totals = miningQ.data?.totals;

  return (
    <div data-theme="im-light" className="bg-background text-foreground min-h-screen">
      <section className="relative min-h-[520px] overflow-hidden bg-foreground text-background">
        <img
          src={losVerdesImage.url}
          alt="Vista del Distrito Los Verdes–Tilama"
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-foreground/60" />
        <div className="relative mx-auto grid max-w-[1600px] gap-8 px-5 py-12 md:grid-cols-[minmax(0,1fr)_190px] md:px-10 md:py-16">
          <div className="self-end max-w-4xl">
            <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary-foreground/70">
              Geocapitals · Live map público · LV-TIL-001
            </div>
            <h1 className="mt-4 font-serif text-4xl leading-tight text-primary-foreground md:text-6xl">
              Distrito Cuprífero Los Verdes–Tilama
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-primary-foreground/75">
              Catastro, evidencia geoquímica, targets y análisis geoespacial en una ficha técnica
              trazable para evaluación minera.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ProjectDocsMenu
                className="h-10 px-5"
                disabled={!reportQ.data}
                build={() => (reportQ.data ? buildLosVerdesDoc(reportQ.data) : null)}
              />
              <Button
                onClick={handlePdf}
                disabled={pdfBusy || !reportQ.data}
                variant="outline"
                className="h-10 border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                {pdfBusy ? <Loader2 className="animate-spin" /> : <FileDown />} Informe extendido
              </Button>
              <Button
                variant="outline"
                className="h-10 border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(liveUrl)
                    .then(() => toast.success("Enlace copiado"))
                }
              >
                <Copy /> Copiar enlace público
              </Button>
            </div>
          </div>
          <aside className="self-end border border-primary-foreground/20 bg-foreground/50 p-3 backdrop-blur-sm">
            {qr ? (
              <img
                src={qr}
                alt="QR de la ficha pública Los Verdes–Tilama"
                className="aspect-square w-full bg-primary-foreground p-2"
              />
            ) : (
              <div className="grid aspect-square place-items-center">
                <Loader2 className="animate-spin text-primary-foreground" />
              </div>
            )}
            <div className="mt-3 font-mono text-[10px] uppercase text-primary-foreground/60">
              Enlace público verificable
            </div>
            <div className="mt-1 break-all text-xs text-primary-foreground">
              geocapitals.com/live/losverdes
            </div>
          </aside>
        </div>
        <div className="relative border-t border-primary-foreground/15 bg-foreground/70 px-5 py-4 backdrop-blur-sm md:px-10">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 text-xs text-primary-foreground/70">
            <span className="inline-flex items-center gap-2 font-medium text-primary-foreground">
              <CheckCircle2 className="h-4 w-4" /> Evidencia geológica consolidada
            </span>
            <span>
              {stats?.samplesTotal ?? "—"} muestras · {stats?.concessionsTotal ?? "—"} concesiones ·{" "}
              {stats?.targetsTotal ?? "—"} targets
            </span>
          </div>
        </div>
      </section>

      {/* Banner */}
      <div className="bg-gold/10 border-b border-gold/30 px-4 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
          <MapPin className="w-3 h-3 text-gold" />
          <div className="font-mono text-[11px] uppercase tracking-wider text-gold">
            Live · Los Verdes · Tilama
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Acciones de escritura solo para super-admin (no en la vista pública compartida). */}
          {isAdmin && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenConceptual}
                disabled={genBusy}
                className="h-7 text-[11px] border-orange-400/50 text-orange-300 hover:bg-orange-500/10"
                title="Genera sondajes virtuales, block model IDW y pit shells (etiquetado CONCEPTUAL)"
              >
                {genBusy ? (
                  <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3 mr-1.5" />
                )}
                Generar modelo conceptual
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSyncCatastro}
                disabled={catBusy}
                className="h-7 text-[11px] border-gold/40 text-gold hover:bg-gold/10"
              >
                {catBusy ? (
                  <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                ) : (
                  <Layers className="w-3 h-3 mr-1.5" />
                )}
                Sincronizar catastro SERNAGEOMIN
              </Button>
            </>
          )}
          <a
            href="/reports/losverdes/pre43101"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center h-7 px-3 rounded-md text-[11px] font-medium bg-gold hover:bg-gold/90 text-background transition-colors"
            title="Informe Técnico Pre-NI 43-101 / JORC con narrativa IA por sección + visor 3D"
          >
            <FileDown className="w-3 h-3 mr-1.5" />
            Pre-NI 43-101
          </a>
        </div>
      </div>

      <div className="p-3 md:p-4 space-y-4 max-w-[1600px] mx-auto">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPI
            icon={<TestTube2 className="w-4 h-4" />}
            label="Muestras"
            value={stats?.samplesTotal ?? "—"}
            sub={stats?.cuAvgPct != null ? `Cu prom. ${stats.cuAvgPct.toFixed(2)}%` : ""}
          />
          <KPI
            icon={<Layers className="w-4 h-4" />}
            label="Concesiones"
            value={stats?.concessionsTotal ?? "—"}
            sub={stats ? `${stats.concessionsHa.toFixed(0)} ha` : ""}
          />
          <KPI
            icon={<Satellite className="w-4 h-4" />}
            label="Anom. SAT"
            value={stats?.satTotal ?? "—"}
            sub={stats ? `${stats.satHigh} alta · ${stats.satMedium} media` : ""}
          />
          <KPI
            icon={<Target className="w-4 h-4" />}
            label="Targets"
            value={stats?.targetsTotal ?? "—"}
            sub={stats ? `${stats.targetsCritical} crit · ${stats.targetsHigh} alta` : ""}
          />
          <KPI
            icon={<Pickaxe className="w-4 h-4" />}
            label="Vetas"
            value={miningQ.data?.veins.length ?? "—"}
            sub={totals ? `${fmtT(totals.veinTonnes)} conceptual` : ""}
          />
          <KPI
            icon={<Pickaxe className="w-4 h-4" />}
            label="NPV plan @8%"
            value={totals ? fmtUsd(totals.npvUsdTotal) : "—"}
            sub={totals ? `CAPEX ${fmtUsd(totals.capexUsdTotal)}` : ""}
          />
        </div>

        {stats && (
          <section className="grid gap-px border border-border bg-border md:grid-cols-4">
            {[
              ["Cu promedio", `${stats.cuAvgPct?.toFixed(2) ?? "—"} %`],
              ["Cu máximo", `${stats.cuMaxPct?.toFixed(2) ?? "—"} %`],
              ["Au máximo", `${stats.auMaxGpt?.toFixed(3) ?? "—"} g/t`],
              ["Ag máximo", `${stats.agMaxGpt?.toFixed(1) ?? "—"} g/t`],
            ].map(([label, value]) => (
              <div key={label} className="bg-background px-5 py-4">
                <div className="font-mono text-[10px] uppercase text-muted-foreground">{label}</div>
                <div className="mt-1 font-serif text-2xl text-foreground">{value}</div>
              </div>
            ))}
          </section>
        )}

        {/* Visor estratégico 2D — exploración + certificación */}
        <section>
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-gold">
              Visor estratégico · Catastro · Muestreo · Targets · Anomalías
            </h2>
            <div className="flex items-center gap-2">
              {(layersQ.isLoading ||
                anomalyQ.isLoading ||
                miningQ.isLoading ||
                mapDataQ.isLoading) && (
                <span className="font-mono text-[10px] text-muted-foreground">cargando datos…</span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEngineOn((v) => !v)}
                disabled={!mounted}
                className="h-7 text-[11px]"
              >
                <Box className="w-3 h-3 mr-1" />
                {engineOn ? "Ocultar 3D" : "Ver 3D"}
              </Button>
            </div>
          </div>
          {publicGeoBundle ? (
            <PublicCanonicalMap bundle={publicGeoBundle} height={620} />
          ) : (
            <div className="grid h-[620px] place-items-center rounded-lg border border-border bg-bg-secondary font-mono text-[11px] text-muted-foreground">
              {mapDataQ.error
                ? "No fue posible cargar el contrato geoespacial público."
                : "Preparando capas públicas canónicas…"}
            </div>
          )}
        </section>

        {/* Visor 3D público canónico bajo demanda */}
        {engineOn && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-mono text-[11px] uppercase tracking-wider text-gold">
                Visor 3D público canónico · DEM · Evidencia trazable
              </h2>
            </div>
            <EngineErrorBoundary onReset={() => setEngineKey((k) => k + 1)}>
              <Suspense
                fallback={
                  <div className="w-full h-[640px] rounded-lg border border-border bg-bg-secondary flex items-center justify-center font-mono text-[11px] text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-gold mr-2" />
                    Cargando escena 3D…
                  </div>
                }
              >
                {publicGeoBundle ? (
                  <PublicCanonicalScene key={engineKey} bundle={publicGeoBundle} height={640} />
                ) : (
                  <div className="grid h-[640px] place-items-center font-mono text-[11px] text-muted-foreground">
                    Preparando escena pública canónica…
                  </div>
                )}
              </Suspense>
            </EngineErrorBoundary>
          </section>
        )}

        {/* Plan + contexto */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <MinePlanPanel phases={miningQ.data?.phases ?? []} />
          </div>
          <Card className="p-4 bg-bg-secondary border-border">
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-foreground/90 mb-2">
              Vetas mapeadas
            </h3>
            <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
              {(miningQ.data?.veins ?? []).map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-2 text-xs border-b border-border/40 pb-1.5"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-gold">{v.code}</div>
                    <div className="text-foreground/90 truncate">{v.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {v.commodity} · {v.strike_deg?.toFixed(0)}°/{v.dip_deg?.toFixed(0)}° ·{" "}
                      {v.thickness_m?.toFixed(1)} m
                    </div>
                  </div>
                  <div className="text-right font-mono text-[10px]">
                    <div className="text-foreground">
                      {v.cubication ? fmtT(v.cubication.tonnes) : "—"}
                    </div>
                    <div className="text-muted-foreground">
                      {v.cubication ? fmtUsd(v.cubication.revenueUsd) : ""}
                    </div>
                  </div>
                </div>
              ))}
              {!miningQ.data?.veins.length && (
                <div className="text-[11px] text-muted-foreground italic">Sin vetas cargadas.</div>
              )}
            </div>
          </Card>
        </div>

        {/* Catastro / anomalías / targets */}
        {reportQ.data && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Panel title="Catastro" count={reportQ.data.concessions.length}>
              <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                {reportQ.data.concessions.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start justify-between gap-2 text-xs border-b border-border/40 pb-1.5"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-gold truncate">{c.code}</div>
                      <div className="text-foreground/90 truncate">{c.name}</div>
                      <div className="text-muted-foreground truncate">{c.holder ?? "—"}</div>
                    </div>
                    <div className="text-right whitespace-nowrap text-muted-foreground font-mono text-[10px]">
                      {c.area_ha ? `${Number(c.area_ha).toFixed(0)} ha` : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Anomalías satelitales" count={reportQ.data.satAnomalies.length}>
              <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                {reportQ.data.satAnomalies.slice(0, 30).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-2 text-xs border-b border-border/40 pb-1.5"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-foreground/90 truncate">{a.index_code}</div>
                      <div className="text-muted-foreground text-[10px]">
                        {a.area_ha ? `${Number(a.area_ha).toFixed(1)} ha` : "—"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${severityColor(a.severity)}`}
                      >
                        {a.severity ?? "—"}
                      </Badge>
                      <span className="font-mono text-foreground/80 text-[10px]">
                        {Number(a.score ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Targets" count={reportQ.data.targets.length}>
              <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                {reportQ.data.targets.slice(0, 30).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-start justify-between gap-2 text-xs border-b border-border/40 pb-1.5"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-gold">{t.code}</div>
                      <div className="text-foreground/90 truncate">{t.name}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${priorityColor(t.priority)}`}
                      >
                        {t.priority ?? "—"}
                      </Badge>
                      <span className="font-mono text-foreground/80 text-[10px]">
                        {Number(t.score ?? 0).toFixed(0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        <footer className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider text-center py-4 border-t border-border">
          Geocapitals · Ficha técnica pública · Muestreo cargado en estado borrador · Sin recursos
          ni reservas certificados.
        </footer>
      </div>
      <TargetExplainerDialog
        open={aiTarget !== null}
        targetCode={aiTarget?.code ?? null}
        targetName={aiTarget?.name ?? null}
        onClose={() => setAiTarget(null)}
      />
    </div>
  );
}

function KPI({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <Card className="p-3 bg-bg-secondary border-border">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[10px] font-mono uppercase tracking-wider">{label}</span>
        <span className="text-gold">{icon}</span>
      </div>
      <div className="text-xl font-bold mt-1 text-foreground">{value}</div>
      {sub && <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

function Panel({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4 bg-bg-secondary border-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-mono uppercase tracking-wider text-foreground/90">
          {title}
        </h3>
        <Badge variant="outline" className="text-[10px] font-mono">
          {count}
        </Badge>
      </div>
      {children}
    </Card>
  );
}
