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
import { GeoIntelBriefButton } from "@/components/GeoIntelBriefButton";
import { ProspectivityButton } from "@/components/ProspectivityButton";
import { buildProspectivityLayer } from "@/components/map/prospectivityLayer";
import type { ProspectivityCell, ProspectivityRun } from "@/hooks/useProspectivity";
import { useDroneFlights } from "@/hooks/useDroneFlights";
import { RasterControlPanel, type RasterSettings } from "@/components/drones/RasterControlPanel";
import { buildRasterOverlayLayer, fitToRaster } from "@/components/drones/rasterOverlayLayer";
import { RasterSwipePanel } from "@/components/drones/RasterSwipePanel";
import { Map3DView } from "@/components/map/Map3DView";
import { ViewModeToggle, type ViewMode } from "@/components/map/ViewModeToggle";
import { MapCommandPalette } from "@/components/map/MapCommandPalette";
import { SavedViewsPanel } from "@/components/map/SavedViewsPanel";
import type { MapView } from "@/hooks/useMapViews";
import { useExplorationTargets } from "@/hooks/useExplorationTargets";
import { TimeSlider } from "@/components/map/TimeSlider";
import { LiveCollabLayer } from "@/components/map/LiveCollabLayer";
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
  const [snapshotting, setSnapshotting] = useState(false);
  const [prospCells, setProspCells] = useState<ProspectivityCell[]>([]);
  const [, setProspRun] = useState<ProspectivityRun | null>(null);
  const { rasters, flights } = useDroneFlights(active?.id ?? null);
  const [rasterSettings, setRasterSettings] = useState<RasterSettings>({});
  const [viewMode, setViewMode] = useState<ViewMode>("2d");
  const { targets } = useExplorationTargets(active?.id ?? null);
  const [timeActive, setTimeActive] = useState(false);
  const [timeCursor, setTimeCursor] = useState<number | null>(null);

  // Sprint 6.4 — time-filtered raster visibility
  const visibleRasterSettings = useMemo(() => {
    if (!timeActive || timeCursor == null) return rasterSettings;
    const next: RasterSettings = { ...rasterSettings };
    for (const r of rasters) {
      if (!r.captured_at) continue;
      const t = Date.parse(r.captured_at);
      if (!isNaN(t) && t > timeCursor && next[r.id]?.visible) {
        next[r.id] = { ...next[r.id], visible: false };
      }
    }
    return next;
  }, [rasterSettings, rasters, timeActive, timeCursor]);

  // Render prospectivity cells as a Leaflet layer that auto-updates
  useEffect(() => {
    if (!mapInst) return;
    const layer = buildProspectivityLayer(mapInst.L, prospCells);
    layer.addTo(mapInst.map);
    return () => { layer.remove(); };
  }, [mapInst, prospCells]);

  // Render drone raster overlays (uses time-filtered settings)
  useEffect(() => {
    if (!mapInst) return;
    let cancelled = false;
    let layer: L.LayerGroup | null = null;
    buildRasterOverlayLayer(mapInst.L, rasters, visibleRasterSettings).then((l) => {
      if (cancelled) return;
      layer = l;
      l.addTo(mapInst.map);
    });
    return () => {
      cancelled = true;
      layer?.remove();
    };
  }, [mapInst, rasters, visibleRasterSettings]);

  const updateRasterSetting = (id: string, patch: Partial<RasterSettings[string]>) => {
    setRasterSettings((prev) => {
      const current = prev[id] ?? { visible: false, opacity: 0.75, colormap: "none" as const };
      return { ...prev, [id]: { ...current, ...patch } };
    });
  };

  const campaignName = useMemo(
    () => (campaignId ? campaigns.find((c) => c.id === campaignId)?.name ?? null : null),
    [campaignId, campaigns],
  );

  const handleSnapshot = async () => {
    if (snapshotting) return;
    setSnapshotting(true);
    try {
      const subtitle = [
        campaignName ? `Campaña: ${campaignName}` : "Todas las campañas",
        `${filteredSamples.length} muestras${highGradeOnly ? " (≥1 g/t)" : ""}`,
      ].join(" · ");
      const dataUrl = await captureMapSnapshot("[data-export-map]", {
        title: active?.name ?? "Centro de Operaciones",
        subtitle,
        legend: AU_LEGEND.map((l) => ({ color: l.color, label: `Au ${l.label}` })),
        scale: 2,
      });
      if (!dataUrl) {
        toast.error("No se pudo capturar el mapa");
        return;
      }
      const slug = (active?.code ?? active?.name ?? "mapa").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const ts = new Date().toISOString().slice(0, 10);
      downloadDataUrl(dataUrl, `snapshot-${slug}-${ts}.png`);
      toast.success("Snapshot descargado");
    } catch (err) {
      console.error(err);
      toast.error("Error al generar snapshot");
    } finally {
      setSnapshotting(false);
    }
  };

  const filteredSamples = useMemo(() => {
    let list = samples;
    if (campaignId) {
      list = list.filter((s) => (s as unknown as { campaign_id?: string | null }).campaign_id === campaignId);
    }
    if (highGradeOnly) list = list.filter((s) => (s.au_gpt ?? 0) >= 1.0);
    return list;
  }, [samples, campaignId, highGradeOnly]);

  // Sprint 6.4 — Time filter applied to holes & rasters
  const filteredHoles = useMemo(() => {
    if (!timeActive || timeCursor == null) return holes;
    return holes.filter((h) => {
      if (!h.started_at) return false;
      const t = Date.parse(h.started_at);
      return !isNaN(t) && t <= timeCursor;
    });
  }, [holes, timeActive, timeCursor]);

  const timeItemsHoles = useMemo(() => holes.map((h) => ({ date: h.started_at })), [holes]);
  const timeItemsFlights = useMemo(() => flights.map((f) => ({ date: f.flown_at })), [flights]);

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
          <MapCommandPalette
            map={mapInst?.map ?? null}
            holes={holes}
            targets={targets}
            rasters={rasters}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onSnapshot={handleSnapshot}
          />
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
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
          {viewMode === "2d" && (
            <button
              type="button"
              onClick={handleSnapshot}
              disabled={snapshotting || !mapInst}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-background text-foreground hover:bg-accent disabled:opacity-50 text-[11px] font-mono whitespace-nowrap transition-colors"
              title="Exportar snapshot PNG con leyenda y escala"
            >
              {snapshotting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5 text-gold" />}
              <span className="hidden sm:inline">Snapshot</span>
            </button>
          )}
        </div>
      </header>

      <div className="relative flex-1 min-h-0">
        {viewMode === "3d" ? (
          <Map3DView
            centerLat={active?.center_lat ?? -33.898438}
            centerLng={active?.center_lng ?? -71.115471}
            holes={filteredHoles}
            logsByHole={logsByHole}
            targets={targets}
          />
        ) : (
          <>
            <ProjectMap
              samples={filteredSamples}
              onInspect={setInspected}
              fillHeight
              onMapReady={(map, L) => setMapInst({ map, L })}
            />
            <SectionBuilderTool
              map={mapInst?.map ?? null}
              L={mapInst?.L ?? null}
              holes={filteredHoles}
              logsByHole={logsByHole}
              projectName={active?.name}
            />
            <FeatureInspectorPanel feature={inspected} onClose={() => setInspected(null)} />
            <GeoIntelBriefButton map={mapInst?.map ?? null} />
            <ProspectivityButton
              map={mapInst?.map ?? null}
              onRunChange={(cells, run) => { setProspCells(cells); setProspRun(run); }}
            />
            <RasterControlPanel
              rasters={rasters}
              settings={visibleRasterSettings}
              onChange={updateRasterSetting}
              onZoomTo={(r) => mapInst && fitToRaster(mapInst.L, mapInst.map, r)}
            />
            <SavedViewsPanel
              projectId={active?.id ?? null}
              map={mapInst?.map ?? null}
              layerState={{ campaignId, highGradeOnly, rasterSettings, viewMode }}
              onRestore={(v: MapView) => {
                if (mapInst && v.center_lat != null && v.center_lng != null && v.zoom != null) {
                  mapInst.map.setView([v.center_lat, v.center_lng], v.zoom);
                }
                const ls = v.layer_state ?? {};
                if (typeof ls.campaignId !== "undefined") setCampaignId(ls.campaignId ?? null);
                if (typeof ls.highGradeOnly === "boolean") setHighGradeOnly(ls.highGradeOnly);
                if (ls.rasterSettings) setRasterSettings(ls.rasterSettings as RasterSettings);
                if (ls.viewMode === "2d" || ls.viewMode === "3d") setViewMode(ls.viewMode);
                toast.success(`Vista «${v.name}» restaurada`);
              }}
            />
            <TimeSlider
              holes={timeItemsHoles}
              flights={timeItemsFlights}
              onChange={setTimeCursor}
              active={timeActive}
              onToggle={setTimeActive}
            />
            <RasterSwipePanel rasters={rasters} mapInst={mapInst} />
            <LiveCollabLayer projectId={active?.id ?? null} map={mapInst?.map ?? null} L={mapInst?.L ?? null} />
            <CollapsibleAuLegend />
          </>
        )}
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
