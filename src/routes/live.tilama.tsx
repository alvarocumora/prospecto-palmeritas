// Live view público del Distrito Cuprífero Los Verdes – Tilama.
// Combina visor 3D MapLibre (anomalías sat extruidas, catastro, targets),
// paneles de stats / catastro / anomalías / targets, y export PDF NI 43-101.
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, lazy, Suspense } from "react";
import { FileDown, Loader2, MapPin, Layers, Target, Satellite } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { getTilamaReport } from "@/lib/tilama.functions";
import { generateTilamaPdf } from "@/lib/tilama-pdf";

const TilamaScene3D = lazy(() =>
  import("@/components/live/TilamaScene3D").then((m) => ({ default: m.TilamaScene3D })),
);

export const Route = createFileRoute("/live/tilama")({
  head: () => ({
    meta: [
      { title: "Live · Distrito Cuprífero Los Verdes – Tilama · Geocapitals" },
      {
        name: "description",
        content:
          "Informe geológico interactivo del Distrito Cuprífero Los Verdes – Tilama (Coquimbo, Chile): anomalías satelitales 3D, catastro minero y portafolio de targets de exploración. Cu-Au-Ag · skarn + vetiformes.",
      },
      { property: "og:title", content: "Live · Distrito Los Verdes – Tilama" },
      {
        property: "og:description",
        content: "Visor 3D con anomalías multiespectrales, estructura y catastro minero.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LiveTilamaPage,
});

function priorityColor(p: string | null) {
  switch ((p ?? "").toLowerCase()) {
    case "critical": return "bg-red-500/20 text-red-300 border-red-500/40";
    case "high": return "bg-amber-500/20 text-amber-300 border-amber-500/40";
    case "medium": return "bg-blue-500/20 text-blue-300 border-blue-500/40";
    default: return "bg-slate-500/20 text-slate-300 border-slate-500/40";
  }
}
function severityColor(s: string | null) {
  switch ((s ?? "").toLowerCase()) {
    case "high": return "bg-red-500/20 text-red-300 border-red-500/40";
    case "medium": return "bg-amber-500/20 text-amber-300 border-amber-500/40";
    default: return "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
  }
}

function LiveTilamaPage() {
  const fetchReport = useServerFn(getTilamaReport);
  const { data, isLoading, error } = useQuery({
    queryKey: ["tilama-live-report"],
    queryFn: () => fetchReport(),
    staleTime: 60_000,
  });
  const [pdfBusy, setPdfBusy] = useState(false);

  const handlePdf = async () => {
    if (!data) return;
    setPdfBusy(true);
    try {
      const doc = generateTilamaPdf(data);
      doc.save(`Geocapitals-Tilama-${data.project.code}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Informe PDF generado");
    } catch (e) {
      console.error(e);
      toast.error("Error generando PDF");
    } finally {
      setPdfBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando informe Tilama…
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p className="text-sm text-red-400">Error cargando datos del proyecto Tilama.</p>
      </div>
    );
  }

  const { project, stats, satAnomalies, concessions, targets } = data;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Live banner */}
      <div className="bg-gold/10 border-b border-gold/30 px-6 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-gold">
          <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
          Live · Geocapitals · {project.code}
        </div>
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          Confidencial — uso interno / due diligence
        </div>
      </div>

      {/* Hero */}
      <header className="border-b border-border px-6 py-6 md:py-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-gold mb-2">
              Informe geológico · Pre-NI 43-101
            </div>
            <h1 className="text-2xl md:text-3xl font-bold leading-tight">
              Distrito Cuprífero Los Verdes – Tilama
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              {project.commodity ?? "Cu-Au-Ag"} · Skarn + vetiformes con enriquecimiento supergénico ·{" "}
              {project.region ?? "Coquimbo"}, {project.country ?? "Chile"}
            </p>
          </div>
          <Button onClick={handlePdf} disabled={pdfBusy} className="bg-gold hover:bg-gold/90 text-background">
            {pdfBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
            Descargar informe PDF
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI icon={<Layers className="w-4 h-4" />} label="Concesiones" value={stats.concessionsTotal} sub={`${stats.concessionsHa.toFixed(0)} ha`} />
          <KPI icon={<Satellite className="w-4 h-4" />} label="Anom. satelitales" value={stats.satTotal} sub={`${stats.satHigh} alta · ${stats.satMedium} media`} />
          <KPI icon={<Target className="w-4 h-4" />} label="Targets" value={stats.targetsTotal} sub={`${stats.targetsCritical} críticos · ${stats.targetsHigh} alta`} />
          <KPI icon={<MapPin className="w-4 h-4" />} label="Coordenadas" value={`${project.center_lat.toFixed(3)}°`} sub={`${project.center_lng.toFixed(3)}°`} />
        </div>

        {/* 3D scene */}
        <section>
          <SectionTitle>Estructura 3D · Anomalías + Catastro</SectionTitle>
          <Suspense fallback={<div className="h-[560px] rounded-lg border border-border bg-bg-secondary flex items-center justify-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando visor 3D…</div>}>
            <TilamaScene3D
              centerLat={project.center_lat}
              centerLng={project.center_lng}
              satAnomalies={satAnomalies}
              concessions={concessions}
              targets={targets}
            />
          </Suspense>
          <p className="text-[11px] text-muted-foreground mt-2 font-mono">
            DEM Mapzen Terrarium · Esri World Imagery · Anomalías extruidas por score · Pitch/drag para navegar.
          </p>
        </section>

        {/* Contexto geológico */}
        <section>
          <SectionTitle>Contexto geológico</SectionTitle>
          <Card className="p-5 text-sm leading-relaxed text-foreground/90 bg-bg-secondary border-border">
            {project.description}
          </Card>
        </section>

        {/* Tres paneles */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title="Catastro minero" count={concessions.length}>
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {concessions.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-2 text-xs border-b border-border/40 pb-1.5">
                  <div className="min-w-0">
                    <div className="font-mono text-gold truncate">{c.code}</div>
                    <div className="text-foreground/90 truncate">{c.name}</div>
                    <div className="text-muted-foreground truncate">{c.holder ?? "—"}</div>
                  </div>
                  <div className="text-right whitespace-nowrap text-muted-foreground">
                    {c.area_ha ? `${Number(c.area_ha).toFixed(0)} ha` : "—"}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Anomalías satelitales" count={satAnomalies.length}>
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {satAnomalies.slice(0, 30).map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 text-xs border-b border-border/40 pb-1.5">
                  <div className="min-w-0">
                    <div className="font-mono text-foreground/90 truncate">{a.index_code}</div>
                    <div className="text-muted-foreground">{a.area_ha ? `${Number(a.area_ha).toFixed(1)} ha` : "—"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[9px] ${severityColor(a.severity)}`}>{a.severity ?? "—"}</Badge>
                    <span className="font-mono text-foreground/80 text-[11px]">{Number(a.score ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Targets de exploración" count={targets.length}>
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {targets.slice(0, 30).map((t) => (
                <div key={t.id} className="flex items-start justify-between gap-2 text-xs border-b border-border/40 pb-1.5">
                  <div className="min-w-0">
                    <div className="font-mono text-gold">{t.code}</div>
                    <div className="text-foreground/90 truncate">{t.name}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className={`text-[9px] ${priorityColor(t.priority)}`}>{t.priority ?? "—"}</Badge>
                    <span className="font-mono text-foreground/80 text-[11px]">{Number(t.score ?? 0).toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <footer className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider text-center py-6 border-t border-border">
          Geocapitals · Informe pre-NI 43-101 · Las leyes y tonelajes son estimaciones conceptuales y no constituyen recursos minerales informados.
        </footer>
      </main>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-mono uppercase tracking-wider text-gold mb-3 flex items-center gap-2">
      <span className="h-px flex-1 bg-gold/30 max-w-[40px]" />
      {children}
    </h2>
  );
}

function KPI({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card className="p-4 bg-bg-secondary border-border">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[10px] font-mono uppercase tracking-wider">{label}</span>
        <span className="text-gold">{icon}</span>
      </div>
      <div className="text-2xl font-bold mt-1 text-foreground">{value}</div>
      {sub && <div className="text-[10px] font-mono text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}

function Panel({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <Card className="p-4 bg-bg-secondary border-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-mono uppercase tracking-wider text-foreground/90">{title}</h3>
        <Badge variant="outline" className="text-[10px] font-mono">{count}</Badge>
      </div>
      {children}
    </Card>
  );
}
