import { lazy, Suspense, useEffect, useState } from "react";
import { Loader2, Sparkles, Crosshair, X, Layers, Box, Layers3 } from "lucide-react";
import { ModeTabs } from "./controls/ModeTabs";
import { SceneCopilot } from "./SceneCopilot";
import { MODE_LABELS, type GeoSceneEngine, type GeoSceneMode, type GeoSceneProps } from "./types";
import { ANCHOR_LABEL, SCENE_FOCUS_EVENT, type SceneFocusDetail } from "./anchors";
import { SceneLayerPanel } from "./controls/SceneLayerPanel";
import { initialGeoSceneLayerIds } from "./layerPolicy";
import type { CanonicalGeoLayerId } from "@/lib/geospatial/layerRegistry";

const GeoSceneCanvas = lazy(() =>
  import("./canvas/GeoSceneCanvas").then((m) => ({ default: m.GeoSceneCanvas })),
);

// Lazy-load de visores legacy: cada modo solo carga su engine cuando se activa.
// Sprint 3+: estos se reescriben como capas deck.gl sobre un canvas único.
const Geology3DViewer = lazy(() =>
  import("@/components/Geology3DViewer").then((m) => ({ default: m.Geology3DViewer })),
);
const SatToSubsurface3DViewer = lazy(() =>
  import("@/components/geology3d/SatToSubsurface3DViewer").then((m) => ({
    default: m.SatToSubsurface3DViewer,
  })),
);
const MagAnomaly3DPro = lazy(() =>
  import("@/features/mag3d/MagAnomaly3DPro").then((m) => ({ default: m.MagAnomaly3DPro })),
);

/**
 * GeoScene3D — visor 3D canónico unificado de Geocapitals.
 *
 * Tres modos conmutables:
 * - surface:    DEM + Sentinel + anomalías superficie + targets
 * - subsurface: vetas + pórfidos + sondajes + anomalías mag extruidas
 * - resource:   bloques + pit shells + leyes
 *
 * Sprint 2: shell unificado que delega a visores existentes.
 * Sprint 3+: consolidación interna en capas deck.gl sobre MapLibre.
 */
export function GeoScene3D({
  mode: modeProp,
  variant = "default",
  showModeTabs = true,
  className = "",
  engine: engineProp,
  initialPreset = "official_3d",
  showLegacyEngineSwitch = false,
  filters,
}: GeoSceneProps) {
  const [internalMode, setInternalMode] = useState<GeoSceneMode>(modeProp ?? "surface");
  const [internalEngine, setInternalEngine] = useState<GeoSceneEngine>(engineProp ?? "deckgl");
  const mode = modeProp ?? internalMode;
  const engine = engineProp ?? internalEngine;
  const meta = MODE_LABELS[mode];
  const [focus, setFocus] = useState<SceneFocusDetail | null>(null);
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const [enabledLayerIds, setEnabledLayerIds] = useState<Set<CanonicalGeoLayerId>>(() =>
    initialGeoSceneLayerIds(initialPreset),
  );

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
      {showModeTabs && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono uppercase text-muted-foreground bg-bg-secondary/95 backdrop-blur border border-border rounded px-2 py-1">
            <Sparkles className="w-3 h-3 text-gold" />
            GeoScene3D · {meta.sub}
          </div>
          {engine === "deckgl" && (
            <button
              type="button"
              onClick={() => setLayerPanelOpen((value) => !value)}
              className="inline-flex items-center gap-1 rounded border border-border bg-bg-secondary/95 px-2 py-1 font-mono text-[10px] uppercase text-foreground backdrop-blur hover:bg-accent"
              title="Capas 3D canónicas"
            >
              <Layers3 className="h-3 w-3" /> capas
            </button>
          )}
          {!engineProp && showLegacyEngineSwitch && (
            <div className="flex items-center rounded border border-border bg-bg-secondary/95 backdrop-blur overflow-hidden text-[10px] font-mono uppercase">
              <button
                type="button"
                onClick={() => setInternalEngine("deckgl")}
                className={`inline-flex items-center gap-1 px-2 py-1 ${
                  engine === "deckgl"
                    ? "bg-gold text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Motor unificado MapLibre + deck.gl con terreno real"
              >
                <Layers className="w-3 h-3" /> deck.gl
              </button>
              <button
                type="button"
                onClick={() => setInternalEngine("legacy")}
                className={`inline-flex items-center gap-1 px-2 py-1 border-l border-border ${
                  engine === "legacy"
                    ? "bg-gold text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Motor heredado (three.js)"
              >
                <Box className="w-3 h-3" /> legacy
              </button>
            </div>
          )}
          <ModeTabs mode={mode} onChange={setInternalMode} />
        </div>
      )}

      {/* Scene */}
      <div className="absolute inset-0">
        <Suspense fallback={<SceneLoading />}>
          {engine === "deckgl" && mode !== "resource" && (
            <GeoSceneCanvas mode={mode} visibleLayerIds={enabledLayerIds} filters={filters} />
          )}
          {engine === "legacy" && mode === "surface" && (
            <Geology3DViewer className="h-full w-full" />
          )}
          {engine === "legacy" && mode === "subsurface" && variant !== "mag" && (
            <SatToSubsurface3DViewer />
          )}
          {engine === "legacy" && mode === "subsurface" && variant === "mag" && <MagAnomaly3DPro />}
          {mode === "resource" && <ResourceModeStub />}
        </Suspense>
      </div>

      {engine === "deckgl" && (
        <SceneLayerPanel
          mode={mode}
          enabled={enabledLayerIds}
          open={layerPanelOpen}
          onClose={() => setLayerPanelOpen(false)}
          onToggle={toggleCanonicalLayer}
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
      <SceneCopilot mode={mode} variant={variant} />
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
