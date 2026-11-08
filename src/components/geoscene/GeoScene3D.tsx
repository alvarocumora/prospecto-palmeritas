import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { SPECTRAL_LAYER_IDS, legendClasses } from "./spectralStyle";
import { BrandButton } from "@/components/brand";
import {
  Loader2,
  Sparkles,
  Crosshair,
  X,
  Layers3,
  PanelRight,
  Box,
  Maximize,
  Minimize,
} from "lucide-react";
import { ModeTabs } from "./controls/ModeTabs";
import { ViewTabs } from "./controls/ViewTabs";
import { SceneCopilot } from "./SceneCopilot";
import { MODE_LABELS, type GeoSceneMode, type GeoSceneProps } from "./types";
import { ANCHOR_LABEL, SCENE_FOCUS_EVENT, type SceneFocusDetail } from "./anchors";
import { SceneLayerPanel } from "./controls/SceneLayerPanel";
import { SceneInspectorPanel } from "./controls/SceneInspectorPanel";
import { MiningEvidenceInspector } from "@/components/geo/MiningEvidenceInspector";
import { initialGeoSceneLayerIds } from "./layerPolicy";
import type { CanonicalGeoLayerId } from "@/lib/geospatial/layerRegistry";
import { resolveProjectLayers } from "./projectLayers";
import { PRIORITIES, normalizePriority, type ExplorationPriority } from "./priority";
import type { FeatureCollection } from "geojson";
import { useSentinelRasterPreview } from "@/hooks/useSentinelRasterPreview";
import { useProjects } from "@/hooks/useProjects";
import { useIsMobile } from "@/hooks/use-mobile";
import { indexRange, type ProcessedIndex } from "./processedSceneStyle";
import { gradeLegendCounts, type GradeCommodity } from "./sampleGradeStyle";

const GeoSceneCanvas = lazy(() =>
  import("./canvas/GeoSceneCanvas").then((m) => ({ default: m.GeoSceneCanvas })),
);

/**
 * GeoScene3D — visor 3D canónico unificado de Geocapitals.
 *
 * Tres modos conmutables:
 * - surface:    DEM + Sentinel + anomalías superficie + targets
 * - subsurface: vetas + pórfidos + sondajes + anomalías mag extruidas
 * - resource:   bloques + pit shells + leyes
 *
 * Motor único: MapLibre + deck.gl. Los visores three.js heredados fueron retirados.
 */
export function GeoScene3D({
  view = "3d",
  onViewChange,
  showCopilot = true,
  mode: modeProp,
  variant = "default",
  showModeTabs = true,
  className = "",
  initialPreset = "official_3d",
  filters,
  project,
  projectLayers,
}: GeoSceneProps) {
  const [internalMode, setInternalMode] = useState<GeoSceneMode>(modeProp ?? "surface");
  const mode = modeProp ?? internalMode;
  const meta = MODE_LABELS[mode];
  const [focus, setFocus] = useState<SceneFocusDetail | null>(null);
  const isMobile = useIsMobile();
  const [layerPanelOpen, setLayerPanelOpen] = useState(true);
  // El panel de capas (izquierda) y la cabecera (derecha) comparten la misma
  // franja superior; en mobile el panel, casi tan ancho como la pantalla,
  // termina tapando los botones Planta/Perspectiva/Capas. Se cierra por
  // defecto solo ahí, el usuario lo reabre con el botón "Capas".
  useEffect(() => {
    if (isMobile) setLayerPanelOpen(false);
  }, [isMobile]);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  useEffect(() => {
    if (isMobile) setInspectorOpen(false);
  }, [isMobile]);
  const rootRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const handler = () => setIsFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen();
  };
  const [enabledLayerIds, setEnabledLayerIds] = useState<Set<CanonicalGeoLayerId>>(() => {
    const ids = initialGeoSceneLayerIds(initialPreset);
    for (const layer of projectLayers ?? []) {
      if (layer.defaultVisible === false) ids.delete(layer.id);
      else ids.add(layer.id);
    }
    return ids;
  });
  const seenProjectLayers = useRef(new Set(projectLayers?.map((layer) => layer.id)));
  useEffect(() => {
    const added = (projectLayers ?? []).filter((layer) => !seenProjectLayers.current.has(layer.id));
    if (!added.length) return;
    for (const layer of added) seenProjectLayers.current.add(layer.id);
    setEnabledLayerIds((current) => {
      const next = new Set(current);
      // Una capa que recién llega con datos (p.ej. sondajes propuestos, que
      // dependen de una query separada de veta/mining) puede corresponder a
      // un id ya habilitado por el preset inicial aunque aún no tuviera
      // features. defaultVisible:false debe apagarla igual, no solo evitar
      // agregarla.
      for (const layer of added) {
        if (layer.defaultVisible === false) next.delete(layer.id);
        else next.add(layer.id);
      }
      return next;
    });
  }, [projectLayers]);

  const [layerOpacity, setLayerOpacity] = useState<Record<string, number>>({});
  const [activePriorities, setActivePriorities] = useState<ReadonlySet<ExplorationPriority>>(
    () => new Set(PRIORITIES),
  );
  const resolvedForPriority = useMemo(() => resolveProjectLayers(projectLayers), [projectLayers]);
  const prioritizedLayers = useMemo(
    () =>
      resolvedForPriority.filter(
        (l) =>
          enabledLayerIds.has(l.id) &&
          (l.data as FeatureCollection | undefined)?.features?.some((f) =>
            normalizePriority(f.properties as Record<string, unknown>),
          ),
      ),
    [resolvedForPriority, enabledLayerIds],
  );
  const [sampleCommodity, setSampleCommodity] = useState<GradeCommodity>("cu_pct");
  const [sampleCutoff, setSampleCutoff] = useState(0);
  const sampleLayer = projectLayers?.find((layer) => layer.id === "sampling.results");
  const sampleLegend = useMemo(
    () =>
      sampleLayer && enabledLayerIds.has("sampling.results")
        ? gradeLegendCounts(sampleLayer.data.features, sampleCommodity)
        : null,
    [sampleLayer, enabledLayerIds, sampleCommodity],
  );
  useEffect(() => {
    setSampleCutoff(0);
  }, [sampleCommodity]);
  const { active: activeProject } = useProjects();
  const processedQuery = useSentinelRasterPreview(project?.id ?? activeProject?.id);
  const processedData = processedQuery.data ?? null;
  const [processedOn, setProcessedOn] = useState(true);
  const [processedIndex, setProcessedIndex] = useState<ProcessedIndex>("ironOxideRatio");
  const [processedOpacity, setProcessedOpacity] = useState(0.7);
  const processedRange = useMemo(
    () => indexRange(processedData, processedIndex),
    [processedData, processedIndex],
  );
  const processedScene =
    processedData && processedOn && processedData.features.length
      ? { data: processedData, index: processedIndex, opacity: processedOpacity }
      : null;
  const spectralLegend = useMemo(() => {
    const seen = new Map<string, [number, number, number]>();
    for (const layer of projectLayers ?? []) {
      if (!SPECTRAL_LAYER_IDS.has(layer.id) || !enabledLayerIds.has(layer.id)) continue;
      for (const item of legendClasses(layer.data)) seen.set(item.label, item.color);
    }
    return [...seen].map(([label, color]) => ({ label, color }));
  }, [projectLayers, enabledLayerIds]);

  const toggleCanonicalLayer = (id: CanonicalGeoLayerId) => {
    setEnabledLayerIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<SceneFocusDetail>).detail;
      if (detail) setFocus(detail);
    };
    window.addEventListener(SCENE_FOCUS_EVENT, handler);
    return () => window.removeEventListener(SCENE_FOCUS_EVENT, handler);
  }, []);

  return (
    <div ref={rootRef} className={`flex h-full w-full bg-bg-panel ${className}`}>
      <SceneLayerPanel
        mode={mode}
        enabled={enabledLayerIds}
        open={layerPanelOpen}
        onClose={() => setLayerPanelOpen(false)}
        onToggle={toggleCanonicalLayer}
        extraLayerIds={projectLayers?.map((layer) => layer.id)}
        counts={Object.fromEntries(
          (projectLayers ?? []).map((l) => [l.id, l.data.features.length]),
        )}
        opacity={layerOpacity}
        onOpacity={(id, value) => setLayerOpacity((current) => ({ ...current, [id]: value }))}
        priorityLayers={prioritizedLayers}
        activePriorities={activePriorities}
        onPriorityChange={setActivePriorities}
        spectralLegend={spectralLegend}
      />

      <div className="relative min-w-0 flex-1">
        {/* Top bar */}
        <div className="absolute top-3 right-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-wrap justify-end items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono uppercase text-muted-foreground bg-bg-secondary/95 backdrop-blur border border-border rounded px-2 py-1">
            <Sparkles className="w-3 h-3 text-gold" />
            GeoScene3D · {meta.sub}
          </div>
          <BrandButton
            type="button"
            size="sm"
            variant="outline"
            data-theme="im-light"
            onClick={() => setLayerPanelOpen((value) => !value)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded border border-accent-brand/60 bg-surface px-3 py-1 font-mono text-[11px] uppercase text-foreground backdrop-blur hover:bg-accent"
            title="Capas 3D canónicas"
            aria-label="Capas del proyecto"
            aria-expanded={layerPanelOpen}
          >
            <Layers3 className="h-3.5 w-3.5" /> Capas · {enabledLayerIds.size}
          </BrandButton>
          {onViewChange && <ViewTabs view={view} onChange={onViewChange} />}
          {showModeTabs && <ModeTabs mode={mode} onChange={setInternalMode} />}
          <BrandButton
            type="button"
            size="sm"
            variant="outline"
            data-theme="im-light"
            onClick={toggleFullscreen}
            className="inline-flex min-h-9 items-center gap-1.5 rounded border border-accent-brand/60 bg-surface px-3 py-1 font-mono text-[11px] uppercase text-foreground backdrop-blur hover:bg-accent"
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? (
              <Minimize className="h-3.5 w-3.5" />
            ) : (
              <Maximize className="h-3.5 w-3.5" />
            )}
          </BrandButton>
          {!inspectorOpen &&
            (sampleLegend || (processedData && processedData.features.length > 0)) && (
              <BrandButton
                type="button"
                size="sm"
                variant="outline"
                data-theme="im-light"
                onClick={() => setInspectorOpen(true)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded border border-accent-brand/60 bg-surface px-3 py-1 font-mono text-[11px] uppercase text-foreground backdrop-blur hover:bg-accent"
                title="Inspector contextual"
                aria-label="Mostrar inspector"
                aria-expanded={inspectorOpen}
              >
                <PanelRight className="h-3.5 w-3.5" /> Inspector
              </BrandButton>
            )}
        </div>

        {/* Scene */}
        <div className="absolute inset-0">
          <Suspense fallback={<SceneLoading />}>
            {mode !== "resource" && (
              <GeoSceneCanvas
                view={view}
                mode={mode}
                visibleLayerIds={enabledLayerIds}
                filters={filters}
                project={project}
                projectLayers={projectLayers}
                layerOpacity={layerOpacity}
                processedScene={processedScene}
                sampleGradeFilter={
                  sampleLegend ? { commodity: sampleCommodity, cutoff: sampleCutoff } : null
                }
                commodity={sampleCommodity}
                activePriorities={activePriorities}
              />
            )}
            {mode === "resource" && <ResourceModeStub />}
          </Suspense>
        </div>

        {/* Focus banner: chip clicado en el copilot */}
        {focus && (
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-bg-secondary/95 backdrop-blur border border-gold/60 rounded px-2.5 py-1.5 shadow-lg">
            <Crosshair className="w-3.5 h-3.5 text-gold animate-pulse" />
            <div className="text-[11px] font-mono">
              <span className="text-muted-foreground uppercase mr-1">
                {ANCHOR_LABEL[focus.kind]}
              </span>
              <span className="text-gold font-semibold">{focus.code}</span>
            </div>
            <button
              type="button"
              onClick={() => setFocus(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Quitar foco"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <MiningEvidenceInspector layers={projectLayers ?? []} projectName={project?.name} />

        {/* Contextual AI copilot */}
        {showCopilot && <SceneCopilot mode={mode} variant={variant} />}
      </div>

      <SceneInspectorPanel
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        sentinel={
          processedData && processedData.features.length > 0 && mode !== "resource"
            ? {
                on: processedOn,
                onToggle: setProcessedOn,
                index: processedIndex,
                onIndex: setProcessedIndex,
                range: processedRange,
                opacity: processedOpacity,
                onOpacity: setProcessedOpacity,
              }
            : undefined
        }
        sampleGrade={
          sampleLegend
            ? {
                commodity: sampleCommodity,
                onCommodity: setSampleCommodity,
                cutoff: sampleCutoff,
                onCutoff: setSampleCutoff,
                legend: sampleLegend,
              }
            : undefined
        }
      />
    </div>
  );
}

function SceneLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-panel">
      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin text-gold" />
        Cargando escena 3D…
      </div>
    </div>
  );
}

function ResourceModeStub() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-panel p-6">
      <div className="max-w-sm text-center space-y-3">
        <Box className="mx-auto h-6 w-6 text-gold" />
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Modo recursos
        </div>
        <div className="text-sm text-foreground">
          Bloques, leyes y pit shells se trabajan en el módulo de Estimación, con sus propios
          visores 3D (modelo de bloques, pit shells, wireframes). No es un error: este modo te lleva
          directo a esa herramienta.
        </div>
        <a
          href="/dashboard/estimation"
          className="inline-block mt-2 rounded border border-gold/50 px-3 py-1.5 text-xs font-mono text-gold hover:bg-gold/10"
        >
          Abrir Estimación →
        </a>
      </div>
    </div>
  );
}
