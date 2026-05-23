import { lazy, Suspense, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { ModeTabs } from "./controls/ModeTabs";
import { MODE_LABELS, type GeoSceneMode, type GeoSceneProps } from "./types";

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
}: GeoSceneProps) {
  const [internalMode, setInternalMode] = useState<GeoSceneMode>(modeProp ?? "surface");
  const mode = modeProp ?? internalMode;
  const meta = MODE_LABELS[mode];

  return (
    <div className={`relative h-full w-full bg-bg-panel ${className}`}>
      {/* Top bar */}
      {showModeTabs && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono uppercase text-muted-foreground bg-bg-secondary/95 backdrop-blur border border-border rounded px-2 py-1">
            <Sparkles className="w-3 h-3 text-gold" />
            GeoScene3D · {meta.sub}
          </div>
          <ModeTabs mode={mode} onChange={setInternalMode} />
        </div>
      )}

      {/* Scene */}
      <div className="absolute inset-0">
        <Suspense fallback={<SceneLoading />}>
          {mode === "surface" && <Geology3DViewer className="h-full w-full" />}
          {mode === "subsurface" && variant !== "mag" && <SatToSubsurface3DViewer />}
          {mode === "subsurface" && variant === "mag" && <MagAnomaly3DPro />}
          {mode === "resource" && <ResourceModeStub />}
        </Suspense>
      </div>
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
