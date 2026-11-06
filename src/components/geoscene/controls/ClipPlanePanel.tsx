import type { ClipAxis } from "../clipPlane";
import { CLIP_THICKNESS_MAX_M, CLIP_THICKNESS_MIN_M, CLIP_THICKNESS_STEP_M } from "../clipPlane";

const AXIS_LABEL: Record<ClipAxis, string> = {
  ns: "N-S",
  ew: "E-O",
  strike: "Rumbo",
};

/**
 * Control del corte 3D: no recorta la malla del terreno (Los Verdes no tiene
 * relieve CAD, solo el DEM nativo de MapLibre, que deck.gl no puede cortar por
 * shader) sino que oculta las capas de evidencia (muestras, targets,
 * estructuras, anomalías) fuera de una franja perpendicular al eje elegido.
 */
export function ClipPlanePanel({
  axis,
  onAxis,
  strikeAzimuth,
  thicknessM,
  onThickness,
  hasCenter,
  onClearCenter,
  onClose,
}: {
  axis: ClipAxis;
  onAxis: (axis: ClipAxis) => void;
  strikeAzimuth: number;
  thicknessM: number;
  onThickness: (m: number) => void;
  hasCenter: boolean;
  onClearCenter: () => void;
  onClose: () => void;
}) {
  return (
    <div
      data-theme="im-light"
      className="pointer-events-auto absolute bottom-16 left-1/2 z-30 w-[19rem] -translate-x-1/2 rounded border border-hairline bg-surface/95 p-2.5 font-mono text-[10px] text-content shadow-lg backdrop-blur"
      aria-label="Corte 3D"
    >
      <div className="mb-1.5 flex items-center justify-between uppercase tracking-wider text-muted-foreground">
        <span>Corte 3D</span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-content"
        >
          Cerrar
        </button>
      </div>
      {!hasCenter ? (
        <p className="text-muted-foreground">Toca el mapa para fijar el centro del corte.</p>
      ) : (
        <>
          <div className="mb-1.5 flex items-center gap-1">
            {(Object.keys(AXIS_LABEL) as ClipAxis[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => onAxis(a)}
                className={`rounded px-1.5 py-0.5 ${
                  axis === a
                    ? "bg-gold/80 text-background"
                    : "border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {AXIS_LABEL[a]}
              </button>
            ))}
            {axis === "strike" && (
              <span className="ml-1 text-muted-foreground">{strikeAzimuth.toFixed(0)}°</span>
            )}
          </div>
          <label className="mb-1.5 flex items-center gap-2 text-muted-foreground">
            Espesor
            <input
              type="range"
              min={CLIP_THICKNESS_MIN_M}
              max={CLIP_THICKNESS_MAX_M}
              step={CLIP_THICKNESS_STEP_M}
              value={thicknessM}
              onChange={(e) => onThickness(Number(e.target.value))}
              className="flex-1"
            />
            <span className="w-10 shrink-0 text-right text-foreground">{thicknessM} m</span>
          </label>
          <button
            type="button"
            onClick={onClearCenter}
            className="w-full rounded border border-border px-1.5 py-1 text-center text-muted-foreground hover:text-foreground"
          >
            Reubicar centro
          </button>
        </>
      )}
      <p className="mt-1.5 text-[9px] leading-snug text-muted-foreground">
        Oculta muestras, targets, estructuras y anomalías fuera de la franja. No recorta el relieve
        (Los Verdes no tiene malla de terreno propia, solo el DEM base).
      </p>
    </div>
  );
}
