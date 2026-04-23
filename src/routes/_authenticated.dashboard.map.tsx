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
import { Layers, FlaskConical, Camera, Loader2, Settings2, Wrench } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { AnnotationsLayer } from "@/components/map/AnnotationsLayer";
import type { MapView } from "@/hooks/useMapViews";
import { useExplorationTargets } from "@/hooks/useExplorationTargets";
import { TimeSlider } from "@/components/map/TimeSlider";
import { LiveCollabLayer } from "@/components/map/LiveCollabLayer";
import { MobileMapInspector } from "@/components/map/MobileMapInspector";
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
  const isMobile = useIsMobile();
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [mobileCtrlOpen, setMobileCtrlOpen] = useState(false);

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
    <div className="flex flex-col bg-background h-[calc(100dvh-3rem-3.5rem)] md:h-[100dvh] w-full overflow-hidden">
      <header className="flex items-center gap-x-3 gap-y-1 px-3 h-10 md:h-11 border-b border-border bg-bg-secondary shrink-0">
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <Layers className="w-4 h-4 text-gold shrink-0" />
          <div className="min-w-0 leading-tight">
            <div className="text-[9px] font-mono uppercase text-muted-foreground hidden lg:block">Centro de Operaciones</div>
            <div className="text-xs font-mono font-semibold truncate max-w-[180px]">{active?.name ?? "Sin proyecto"}</div>
          </div>
        </div>

        {/* Desktop controls */}
        <div className="hidden md:flex items-center gap-2 flex-1 justify-end overflow-x-auto">
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
            <span>High-grade ≥1 g/t Au</span>
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
              Snapshot
            </button>
          )}
        </div>

        {/* Mobile single button → opens controls sheet */}
        <div className="md:hidden flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
            {filteredSamples.length} m
          </span>
          <Sheet open={mobileCtrlOpen} onOpenChange={setMobileCtrlOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border bg-background text-foreground text-[11px] font-mono"
                title="Controles del mapa"
              >
                <Settings2 className="w-3.5 h-3.5 text-gold" />
                Ctrl
              </button>
            </SheetTrigger>
            <SheetContent side="top" className="max-h-[80dvh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Controles del mapa</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Vista</div>
                  <ViewModeToggle mode={viewMode} onChange={setViewMode} />
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Campaña</div>
                  <CampaignSelector campaigns={campaigns} value={campaignId} onChange={setCampaignId} />
                </div>
                <label className="flex items-center gap-2 text-xs font-mono cursor-pointer">
                  <input
                    type="checkbox"
                    checked={highGradeOnly}
                    onChange={(e) => setHighGradeOnly(e.target.checked)}
                    className="accent-gold"
                  />
                  <span>High-grade ≥1 g/t Au</span>
                </label>
                {viewMode === "2d" && (
                  <button
                    type="button"
                    onClick={() => { setMobileCtrlOpen(false); handleSnapshot(); }}
                    disabled={snapshotting || !mapInst}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded border border-border bg-background text-foreground hover:bg-accent disabled:opacity-50 text-xs font-mono"
                  >
                    {snapshotting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5 text-gold" />}
                    Snapshot PNG
                  </button>
                )}
                <div className="pt-2 border-t border-border">
                  <MapCommandPalette
                    map={mapInst?.map ?? null}
                    holes={holes}
                    targets={targets}
                    rasters={rasters}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    onSnapshot={handleSnapshot}
                  />
                </div>
              </div>
            </SheetContent>
          </Sheet>
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
            <FeatureInspectorPanel feature={inspected} onClose={() => setInspected(null)} />

            {/* Always-on lightweight overlays */}
            <LiveCollabLayer projectId={active?.id ?? null} map={mapInst?.map ?? null} L={mapInst?.L ?? null} />
            <AnnotationsLayer projectId={active?.id ?? null} projectName={active?.name ?? null} map={mapInst?.map ?? null} L={mapInst?.L ?? null} />
            <CollapsibleAuLegend />

            {/* Desktop: all panels visible */}
            {!isMobile && (
              <>
                <SectionBuilderTool
                  map={mapInst?.map ?? null}
                  L={mapInst?.L ?? null}
                  holes={filteredHoles}
                  logsByHole={logsByHole}
                  projectName={active?.name}
                />
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
              </>
            )}

            {/* Mobile: single FAB → drawer with all tools */}
            {isMobile && (
              <>
                <MobileMapInspector
                  map={mapInst?.map ?? null}
                  rasters={rasters}
                  rasterSettings={visibleRasterSettings}
                  onRasterChange={updateRasterSetting}
                  onSnapshot={handleSnapshot}
                  snapshotting={snapshotting}
                />
                <button
                  type="button"
                  onClick={() => setMobileToolsOpen(true)}
                  className="absolute bottom-3 right-3 z-[600] w-12 h-12 rounded-full bg-gold text-background shadow-lg inline-flex items-center justify-center"
                  title="Herramientas"
                >
                  <Wrench className="w-5 h-5" />
                </button>
                <Sheet open={mobileToolsOpen} onOpenChange={setMobileToolsOpen}>
                  <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Herramientas del mapa</SheetTitle>
                    </SheetHeader>
                    <div className="space-y-3 mt-4 pb-4">
                      <GeoIntelBriefButton map={mapInst?.map ?? null} />
                      <ProspectivityButton
                        map={mapInst?.map ?? null}
                        onRunChange={(cells, run) => { setProspCells(cells); setProspRun(run); }}
                      />
                      <SectionBuilderTool
                        map={mapInst?.map ?? null}
                        L={mapInst?.L ?? null}
                        holes={filteredHoles}
                        logsByHole={logsByHole}
                        projectName={active?.name}
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
                    </div>
                  </SheetContent>
                </Sheet>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CollapsibleAuLegend() {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-3 left-16 z-[500] w-8 h-8 inline-flex items-center justify-center rounded border border-border bg-bg-secondary/95 backdrop-blur text-foreground hover:bg-accent shadow-md"
        title="Mostrar leyenda Au"
      >
        <FlaskConical className="w-3.5 h-3.5 text-gold" />
      </button>
    );
  }
  return (
    <div className="absolute bottom-3 left-16 z-[500] bg-bg-secondary/95 border border-border rounded p-2 backdrop-blur shadow-md">
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
