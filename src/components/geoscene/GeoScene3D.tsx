import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { SPECTRAL_LAYER_IDS, legendClasses } from "./spectralStyle";
import { BrandButton } from "@/components/brand";
import { Loader2, Sparkles, Crosshair, X, Layers3 } from "lucide-react";
import { ModeTabs } from "./controls/ModeTabs";
import { SceneCopilot } from "./SceneCopilot";
import { MODE_LABELS, type GeoSceneMode, type GeoSceneProps } from "./types";
import { ANCHOR_LABEL, SCENE_FOCUS_EVENT, type SceneFocusDetail } from "./anchors";
import { SceneLayerPanel } from "./controls/SceneLayerPanel";
import { initialGeoSceneLayerIds } from "./layerPolicy";
import type { CanonicalGeoLayerId } from "@/lib/geospatial/layerRegistry";
import { useSentinelRasterPreview } from "@/hooks/useSentinelRasterPreview";
import { useProjects } from "@/hooks/useProjects";
import { PROCESSED_INDICES, RAMP_CSS, indexRange, type ProcessedIndex } from "./processedSceneStyle";

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
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
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
    setEnabledLayerIds(
      (current) =>
        new Set([
          ...current,
          ...added.filter((layer) => layer.defaultVisible !== false).map((layer) => layer.id),
        ]),
    );
  }, [projectLayers]);

  const [layerOpacity, setLayerOpacity] = useState<Record<string, number>>({});
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
    <div className={`relative h-full w-full bg-bg-panel ${className}`}>
      {/* Top bar */}
      {
        <div className="absolute top-3 right-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-wrap justify-end items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono uppercase text-muted-foreground bg-bg-secondary/95 backdrop-blur border border-border rounded px-2 py-1">
            <Sparkles className="w-3 h-3 text-gold" />
            GeoScene3D · {meta.sub}
          </div>
          {
            <BrandButton
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setLayerPanelOpen((value) => !value)}
              className="inline-flex items-center gap-1 rounded border border-border bg-bg-secondary/95 px-2 py-1 font-mono text-[10px] uppercase text-foreground backdrop-blur hover:bg-accent"
              title="Capas 3D canónicas"
              aria-label="Capas del proyecto"
              aria-expanded={layerPanelOpen}
            >
              <Layers3 className="h-3 w-3" /> capas
            </BrandButton>
          }
          {showModeTabs && <ModeTabs mode={mode} onChange={setInternalMode} />}
        </div>
      }

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
            />
          )}
          {mode === "resource" && <ResourceModeStub />}
        </Suspense>
      </div>

      {
        <SceneLayerPanel
          mode={mode}
          enabled={enabledLayerIds}
          open={layerPanelOpen}
          onClose={() => setLayerPanelOpen(false)}
          onToggle={toggleCanonicalLayer}
          extraLayerIds={projectLayers?.map((layer) => layer.id)}
          opacity={layerOpacity}
          onOpacity={(id, value) => setLayerOpacity((current) => ({ ...current, [id]: value }))}
        />
      }

      {spectralLegend.length > 0 && (
        <div
          className="absolute bottom-10 right-3 z-20 max-w-[16rem] rounded border border-border bg-bg-secondary/95 p-2.5 font-mono text-[10px] shadow-lg backdrop-blur"
          aria-label="Leyenda espectral"
        >
          <div className="mb-1.5 uppercase tracking-wider text-muted-foreground">
            Firmas espectrales · modeladas
          </div>
          <ul className="space-y-1">
            {spectralLegend.map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-foreground">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: `rgb(${item.color.join(",")})` }}
                />
                {item.label}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[9px] leading-snug text-muted-foreground">
            Intensidad = opacidad del polígono. Hipótesis de priorización, no ensayes ni recursos.
          </p>
        </div>
      )}

      {processedData && processedData.features.length > 0 && mode !== "resource" && (
        <div
          className="absolute bottom-10 left-14 z-20 w-[15rem] rounded border border-border bg-bg-secondary/95 p-2.5 font-mono text-[10px] shadow-lg backdrop-blur"
          aria-label="Escena Sentinel-2 procesada"
        >
          <label className="flex items-center gap-2 uppercase tracking-wider text-foreground">
            <input
              type="checkbox"
              checked={processedOn}
              onChange={(e) => setProcessedOn(e.target.checked)}
            />
            Sentinel-2 L2A procesada
          </label>
          {processedOn && (
            <div className="mt-2 space-y-2">
              <select
                value={processedIndex}
                onChange={(e) => setProcessedIndex(e.target.value as ProcessedIndex)}
                className="w-full rounded border border-border bg-background px-1.5 py-1 text-[10px] text-foreground"
                aria-label="Índice espectral"
              >
                {PROCESSED_INDICES.map((i) => (
                  <option key={i.key} value={i.key}>
                    {i.label}
                  </option>
                ))}
              </select>
              <div>
                <div className="h-2 w-full rounded-sm" style={{ background: RAMP_CSS }} />
                <div className="mt-0.5 flex justify-between text-muted-foreground">
                  <span>{processedRange[0].toFixed(3)}</span>
                  <span>{processedRange[1].toFixed(3)}</span>
                </div>
              </div>
              <label className="flex items-center gap-2 text-muted-foreground">
                Opacidad
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={processedOpacity}
                  onChange={(e) => setProcessedOpacity(Number(e.target.value))}
                  className="flex-1"
                />
              </label>
            </div>
          )}
          <p className="mt-1.5 text-[9px] leading-snug text-muted-foreground">
            MODELADO · índice derivado de reflectancia real. No identifica minerales ni reemplaza
            ensayes.
          </p>
        </div>
      )}

      {/* Focus banner: chip clicado en el copilot */}
      {focus && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-bg-secondary/95 backdrop-blur border border-gold/60 rounded px-2.5 py-1.5 shadow-lg">
          <Crosshair className="w-3.5 h-3.5 text-gold animate-pulse" />
          <div className="text-[11px] font-mono">
            <span className="text-muted-foreground uppercase mr-1">{ANCHOR_LABEL[focus.kind]}</span>
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

      {/* Contextual AI copilot */}
      {showCopilot && <SceneCopilot mode={mode} variant={variant} />}
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
      <div className="max-w-sm text-center space-y-2">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Resource mode
        </div>
        <div className="text-sm text-foreground">
          Selecciona un modelo de recursos desde Estimación para visualizar bloques, leyes y pit
          shells aquí.
        </div>
        <a
          href="/dashboard/estimation"
          className="inline-block mt-2 text-xs font-mono text-gold hover:underline"
        >
          Abrir Estimación →
        </a>
      </div>
    </div>
  );
}
