import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { ProjectMap } from "@/components/ProjectMap";
import { CampaignSelector } from "@/components/map/CampaignSelector";
import { FeatureInspectorPanel, type InspectedFeature } from "@/components/map/FeatureInspectorPanel";
import { SectionBuilderTool } from "@/components/map/SectionBuilderTool";
import { AU_LEGEND } from "@/components/map/sampleColors";
import { useProjects } from "@/hooks/useProjects";
import { useExplorationCampaigns } from "@/hooks/useExplorationCampaigns";
import { useSamplingResults } from "@/hooks/useSamplingResults";
import { useDrillHoles } from "@/hooks/useDrilling";
import { useProjectCoreLogs } from "@/hooks/useProjectCoreLogs";
import type { LeafletNS } from "@/components/map/types";
import { Layers, FlaskConical, Camera, Loader2 } from "lucide-react";
import { captureMapSnapshot, downloadDataUrl } from "@/lib/map/snapshot";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/map")({
  head: () => ({
    meta: [
      { title: "Centro de Operaciones — Geocapitals" },
      { name: "description", content: "Mapa maestro: catastro, geofísica, sondajes y muestreo en una sola vista." },
    ],
  }),
  component: OperationalMap,
});

function OperationalMap() {
  const { active } = useProjects();
  const { data: campaigns } = useExplorationCampaigns(active?.id ?? null);
  const { data: samples } = useSamplingResults(active?.id ?? null);
  const { data: holes } = useDrillHoles(active?.id ?? null);
  const { byHole: logsByHole } = useProjectCoreLogs(active?.id ?? null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [highGradeOnly, setHighGradeOnly] = useState(false);
  const [inspected, setInspected] = useState<InspectedFeature | null>(null);
  const [mapInst, setMapInst] = useState<{ map: LeafletMap; L: LeafletNS } | null>(null);

  const filteredSamples = useMemo(() => {
    let list = samples;
    if (campaignId) {
      list = list.filter((s) => (s as unknown as { campaign_id?: string | null }).campaign_id === campaignId);
    }
    if (highGradeOnly) list = list.filter((s) => (s.au_gpt ?? 0) >= 1.0);
    return list;
  }, [samples, campaignId, highGradeOnly]);

  useEffect(() => {
    (window as unknown as { __selectMapFeature?: (f: InspectedFeature) => void }).__selectMapFeature = setInspected;
    return () => {
      delete (window as unknown as { __selectMapFeature?: unknown }).__selectMapFeature;
    };
  }, []);

  return (
    <div className="fixed inset-0 md:left-56 top-12 md:top-0 bottom-14 md:bottom-0 flex flex-col bg-background">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 md:py-0 md:h-12 border-b border-border bg-bg-secondary shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Layers className="w-4 h-4 text-gold shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase text-muted-foreground leading-none hidden sm:block">Centro de Operaciones</div>
            <div className="text-xs md:text-sm font-mono font-semibold truncate">{active?.name ?? "Sin proyecto"}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <CampaignSelector campaigns={campaigns} value={campaignId} onChange={setCampaignId} />
          <label className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={highGradeOnly}
              onChange={(e) => setHighGradeOnly(e.target.checked)}
              className="accent-gold"
            />
            <span className="hidden sm:inline">High-grade ≥1 g/t Au</span>
            <span className="sm:hidden">≥1 g/t</span>
          </label>
          <span className="text-[11px] font-mono text-muted-foreground hidden lg:inline whitespace-nowrap">
            <FlaskConical className="w-3 h-3 inline mr-1" /> {filteredSamples.length} muestras
          </span>
        </div>
      </header>

      <div className="relative flex-1 min-h-0">
        <ProjectMap
          samples={filteredSamples}
          onInspect={setInspected}
          fillHeight
          onMapReady={(map, L) => setMapInst({ map, L })}
        />
        <SectionBuilderTool
          map={mapInst?.map ?? null}
          L={mapInst?.L ?? null}
          holes={holes}
          logsByHole={logsByHole}
        />
        <FeatureInspectorPanel feature={inspected} onClose={() => setInspected(null)} />
        <CollapsibleAuLegend />
      </div>
    </div>
  );
}

function CollapsibleAuLegend() {
  const [open, setOpen] = useState(true);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-12 left-3 z-[500] w-8 h-8 inline-flex items-center justify-center rounded border border-border bg-bg-secondary/95 backdrop-blur text-foreground hover:bg-accent shadow-md"
        title="Mostrar leyenda Au"
      >
        <FlaskConical className="w-3.5 h-3.5 text-gold" />
      </button>
    );
  }
  return (
    <div className="absolute bottom-12 left-3 z-[500] bg-bg-secondary/95 border border-border rounded p-2 backdrop-blur shadow-md">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="text-[9px] font-mono uppercase text-muted-foreground">Au g/t</div>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground text-[10px] leading-none" title="Colapsar">‹</button>
      </div>
      <div className="flex flex-col gap-1">
        {AU_LEGEND.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5 text-[10px] font-mono">
            <span className="w-3 h-3 rounded-full border border-white/40" style={{ background: l.color }} />
            <span className="text-foreground">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
