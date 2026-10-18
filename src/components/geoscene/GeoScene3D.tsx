import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { BrandButton } from "@/components/brand";
import { Loader2, Sparkles, Crosshair, X, Layers3 } from "lucide-react";
import { ModeTabs } from "./controls/ModeTabs";
import { SceneCopilot } from "./SceneCopilot";
import { MODE_LABELS, type GeoSceneMode, type GeoSceneProps } from "./types";
import { ANCHOR_LABEL, SCENE_FOCUS_EVENT, type SceneFocusDetail } from "./anchors";
import { SceneLayerPanel } from "./controls/SceneLayerPanel";
import { initialGeoSceneLayerIds } from "./layerPolicy";
import type { CanonicalGeoLayerId } from "@/lib/geospatial/layerRegistry";

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
  const [enabledLayerIds, setEnabledLayerIds] = useState<Set<CanonicalGeoLayerId>>(
    () => {
      const ids = initialGeoSceneLayerIds(initialPreset);
      for (const layer of projectLayers ?? []) {
        if (layer.defaultVisible === false) ids.delete(layer.id);
        else ids.add(layer.id);
      }
      return ids;
    },
  );
  const seenProjectLayers = useRef(new Set(projectLayers?.map((layer) => layer.id)));
  useEffect(() => {
    const added = (projectLayers ?? []).filter((layer) => !seenProjectLayers.current.has(layer.id));
    if (!added.length) return;
    for (const layer of added) seenProjectLayers.current.add(layer.id);
    setEnabledLayerIds((current) => new Set([...current, ...added.filter((layer) => layer.defaultVisible !== false).map((layer) => layer.id)]));
  }, [projectLayers]);

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
      {(
        <div className="absolute top-3 right-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-wrap justify-end items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono uppercase text-muted-foreground bg-bg-secondary/95 backdrop-blur border border-border rounded px-2 py-1">
            <Sparkles className="w-3 h-3 text-gold" />
            GeoScene3D · {meta.sub}
          </div>
          {(
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
          )}
          {showModeTabs && <ModeTabs mode={mode} onChange={setInternalMode} />}
        </div>
      )}

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
            />
          )}
          {mode === "resource" && <ResourceModeStub />}
        </Suspense>
      </div>

      {(
        <SceneLayerPanel
          mode={mode}
          enabled={enabledLayerIds}
          open={layerPanelOpen}
          onClose={() => setLayerPanelOpen(false)}
          onToggle={toggleCanonicalLayer}
          extraLayerIds={projectLayers?.map((layer) => layer.id)}
        />
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
