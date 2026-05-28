import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MapPin, FileDown, Loader2, Layers, Target, Satellite, Pickaxe, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FieldMapPublic } from "@/components/field/FieldMapPublic";
import { LosVerdesScene3D } from "@/components/live/LosVerdesScene3D";
import { MinePlanPanel } from "@/components/live/MinePlanPanel";
import { TargetExplainerDialog } from "@/components/live/TargetExplainerDialog";
import { getLosVerdesPublicLayers, getLosVerdesAnomalies } from "@/lib/livemap-public.functions";
import { getLosVerdesMining } from "@/lib/losverdes-veins.functions";
import { getLosVerdesDrillholes } from "@/lib/losverdes-ai.functions";
import { getTilamaReport } from "@/lib/tilama.functions";
import { generateTilamaPdf } from "@/lib/tilama-pdf";
import { syncLosVerdes5Catastro } from "@/lib/losverdes5-catastro.functions";
import { onLosVerdesFocus } from "@/lib/losverdes-focus";

export const Route = createFileRoute("/live/losverdes")({
  head: () => ({
    meta: [
      { title: "Live · Distrito Cuprífero Los Verdes – Tilama · Geocapitals" },
      {
        name: "description",
        content:
          "Visor 3D del Distrito Los Verdes – Tilama: catastro, anomalías satelitales extruidas, vetas Cu-Au-Ag y plan de explotación conceptual con cubicación y NPV.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { name: "theme-color", content: "#0b0a09" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
    links: [{ rel: "manifest", href: "/manifest.losverdes.json" }],
  }),
  component: LiveLosVerdesPage,
});

const DEFAULT_CENTER = { lat: -31.95, lng: -71.18 };

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
  const fetchAnoms = useServerFn(getLosVerdesAnomalies);
  const fetchMining = useServerFn(getLosVerdesMining);
  const fetchReport = useServerFn(getTilamaReport);
  const fetchDrillholes = useServerFn(getLosVerdesDrillholes);

  const layersQ = useQuery({
    queryKey: ["losverdes", "public-layers"],
    queryFn: () => fetchLayers(),
    staleTime: 5 * 60_000,
  });
  const anomsQ = useQuery({
    queryKey: ["losverdes", "anomalies"],
    queryFn: () => fetchAnoms(),
    staleTime: 5 * 60_000,
  });
  const miningQ = useQuery({
    queryKey: ["losverdes", "mining"],
    queryFn: () => fetchMining(),
    staleTime: 5 * 60_000,
  });
  const reportQ = useQuery({
    queryKey: ["losverdes", "report"],
    queryFn: () => fetchReport(),
    staleTime: 60_000,
  });
  const drillsQ = useQuery({
    queryKey: ["losverdes", "drillholes"],
    queryFn: () => fetchDrillholes(),
    staleTime: 10 * 60_000,
  });

  const [pdfBusy, setPdfBusy] = useState(false);
  const [catBusy, setCatBusy] = useState(false);
  const [aiTarget, setAiTarget] = useState<{ code: string; name: string } | null>(null);
  const syncCatastro = useServerFn(syncLosVerdes5Catastro);

  useEffect(() => {
    return onLosVerdesFocus((evt) => {
      if (evt.kind === "target" && evt.source === "scene3d" && evt.id) {
        setAiTarget({ code: String(evt.id), name: String(evt.label ?? evt.id) });
      }
    });
  }, []);

  const centerLat = layersQ.data?.project.center_lat ?? DEFAULT_CENTER.lat;
  const centerLng = layersQ.data?.project.center_lng ?? DEFAULT_CENTER.lng;

  const handlePdf = async () => {
    if (!reportQ.data) return;
    setPdfBusy(true);
    try {
      const doc = generateTilamaPdf(reportQ.data, miningQ.data ?? undefined);
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
      reportQ.refetch();
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`, { id: tid });
    } finally {
      setCatBusy(false);
    }
  };

  const stats = reportQ.data?.stats;
  const totals = miningQ.data?.totals;

  return (
    <div className="bg-bg-app min-h-screen">
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
          <Button
            size="sm"
            onClick={handlePdf}
            disabled={pdfBusy || !reportQ.data}
            className="bg-gold hover:bg-gold/90 text-background h-7 text-[11px]"
          >
            {pdfBusy ? (
              <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
            ) : (
              <FileDown className="w-3 h-3 mr-1.5" />
            )}
            Informe PDF
          </Button>
        </div>
      </div>

      <div className="p-3 md:p-4 space-y-4 max-w-[1600px] mx-auto">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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

        {/* 3D Scene */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-gold">
              Visor 3D · Esri + DEM · Anomalías · Vetas · Plan
            </h2>
            {(layersQ.isLoading || anomsQ.isLoading || miningQ.isLoading) && (
              <span className="font-mono text-[10px] text-muted-foreground">cargando datos…</span>
            )}
          </div>
          {anomsQ.data && layersQ.data ? (
            <LosVerdesScene3D
              centerLat={centerLat}
              centerLng={centerLng}
              satAnomalies={anomsQ.data.satAnomalies}
              magTargets={anomsQ.data.magTargets}
              lineaments={anomsQ.data.lineaments}
              targets={layersQ.data.targets}
              veins={miningQ.data?.veins ?? []}
              phases={miningQ.data?.phases ?? []}
              drillholes={drillsQ.data?.holes ?? []}
            />
          ) : (
            <div className="w-full h-[640px] rounded-lg border border-border bg-bg-secondary flex items-center justify-center font-mono text-[11px] text-muted-foreground">
              Cargando escena 3D…
            </div>
          )}
        </section>

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

        {/* Mapa de campo */}
        <section>
          <h2 className="font-mono text-[11px] uppercase tracking-wider text-gold mb-2">
            Mapa de campo · GPS + Catastro + Capas
          </h2>
          <FieldMapPublic />
        </section>

        <footer className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider text-center py-4 border-t border-border">
          Geocapitals · Informe pre-NI 43-101 · Estimaciones conceptuales, no recursos informados.
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
