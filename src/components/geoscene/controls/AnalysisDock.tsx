import type { SpectralTop } from "../analysisTools";
import { pathLength, polygonArea, schmidtPole } from "../analysisTools";
import type { StructurePlane } from "../structuralPlanes";

type LngLat = [number, number];

const fmtM = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(0)} m`);

const btn = (on: boolean) =>
  `min-h-9 rounded border px-2.5 font-mono text-[10px] uppercase tracking-wider focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand ${
    on
      ? "border-accent-brand bg-accent-brand text-primary-foreground"
      : "border-hairline bg-surface text-content hover:border-content/30"
  }`;

/** Barra de análisis: filtro espectral, terreno, medición y red estereográfica. */
export function AnalysisDock({
  spectralTop,
  onSpectralTop,
  includeOxides,
  onIncludeOxides,
  hasSpectral,
  terrainOpacity,
  onTerrainOpacity,
  hasTerrain,
  measuring,
  onMeasuring,
  measurePts,
  elevations,
  stereoOpen,
  onStereo,
  planes,
  sectionOn,
  sectionLabel,
  onSection,
  propertyOn = false,
  onProperty,
}: {
  spectralTop: SpectralTop;
  onSpectralTop: (v: SpectralTop) => void;
  includeOxides: boolean;
  onIncludeOxides: (v: boolean) => void;
  hasSpectral: boolean;
  terrainOpacity: number;
  onTerrainOpacity: (v: number) => void;
  hasTerrain: boolean;
  measuring: boolean;
  onMeasuring: (v: boolean) => void;
  measurePts: LngLat[];
  elevations: (number | null)[];
  stereoOpen: boolean;
  onStereo: (v: boolean) => void;
  planes: StructurePlane[];
  sectionOn: boolean;
  sectionLabel: string;
  onSection: () => void;
  propertyOn?: boolean;
  onProperty?: () => void;
}) {
  const len = pathLength(measurePts);
  const area = polygonArea(measurePts);
  const z0 = elevations[0];
  const z1 = elevations[elevations.length - 1];
  return (
    <div
      data-theme="im-light"
      className="pointer-events-none absolute bottom-3 left-1/2 z-30 flex bg-transparent [&>*]:pointer-events-auto max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-col items-center gap-2"
    >
      {measuring && measurePts.length > 0 && (
        <div className="rounded border border-hairline bg-surface/95 px-3 py-1.5 font-mono text-[11px] text-content shadow">
          {measurePts.length} pto · {fmtM(len)}
          {z0 != null && z1 != null && measurePts.length > 1 && <> · Δz {(z1 - z0).toFixed(0)} m</>}
          {area > 0 && <> · {(area / 10_000).toFixed(2)} ha</>}
        </div>
      )}
      {stereoOpen && (
        <figure
          className="rounded border border-hairline bg-surface/95 p-2 shadow"
          aria-label="Red estereográfica"
        >
          <svg viewBox="-1.15 -1.15 2.3 2.3" className="h-44 w-44">
            <circle
              r={1}
              fill="none"
              stroke="currentColor"
              strokeWidth={0.01}
              className="text-content"
            />
            <line
              x1={-1}
              y1={0}
              x2={1}
              y2={0}
              stroke="currentColor"
              strokeWidth={0.004}
              className="text-muted-foreground"
            />
            <line
              x1={0}
              y1={-1}
              x2={0}
              y2={1}
              stroke="currentColor"
              strokeWidth={0.004}
              className="text-muted-foreground"
            />
            <text x={0} y={-1.05} fontSize={0.1} textAnchor="middle" className="fill-current">
              N
            </text>
            {planes.map((p) => {
              const { x, y } = schmidtPole(p);
              return (
                <g key={p.code}>
                  <circle cx={x} cy={-y} r={0.035} className="fill-accent-brand" />
                  <text x={x + 0.05} y={-y + 0.03} fontSize={0.07} className="fill-current">
                    {p.code}
                  </text>
                </g>
              );
            })}
          </svg>
          <figcaption className="max-w-44 text-center text-[9px] text-muted-foreground">
            Polos · Schmidt, hemisferio inferior · {planes.length} vetas con rumbo y manteo MEDIDOS
          </figcaption>
        </figure>
      )}
      <div className="flex flex-wrap items-center justify-center gap-1.5 rounded border border-hairline bg-surface/95 p-1.5 shadow-lg backdrop-blur">
        <button
          type="button"
          aria-pressed={sectionOn}
          onClick={onSection}
          className={btn(sectionOn)}
        >
          {sectionLabel}
        </button>
        {onProperty && (
          <button
            type="button"
            aria-pressed={propertyOn}
            onClick={onProperty}
            className={btn(propertyOn)}
          >
            Pertenencia
          </button>
        )}
        <button
          type="button"
          aria-pressed={measuring}
          onClick={() => onMeasuring(!measuring)}
          className={btn(measuring)}
        >
          Medir
        </button>
        <button
          type="button"
          aria-pressed={stereoOpen}
          disabled={!planes.length}
          title={planes.length ? undefined : "Sin vetas con rumbo y manteo medidos"}
          onClick={() => onStereo(!stereoOpen)}
          className={`${btn(stereoOpen)} disabled:opacity-40`}
        >
          Estereo
        </button>
        {hasSpectral && (
          <>
            <select
              aria-label="Filtro de intensidad espectral"
              value={spectralTop}
              onChange={(e) => onSpectralTop(e.target.value as SpectralTop)}
              className="min-h-9 rounded border border-hairline bg-surface px-2 font-mono text-[10px] text-content"
            >
              <option value="p95">Top 5 %</option>
              <option value="p90">Top 10 %</option>
              <option value="all">Todas</option>
            </select>
            <label className="flex min-h-9 items-center gap-1 px-1 font-mono text-[10px] text-content">
              <input
                type="checkbox"
                checked={includeOxides}
                onChange={(e) => onIncludeOxides(e.target.checked)}
              />
              Óxidos
            </label>
          </>
        )}
        {hasTerrain && (
          <label className="flex min-h-9 items-center gap-1.5 px-1 font-mono text-[10px] text-content">
            Terreno
            <input
              type="range"
              min={15}
              max={100}
              step={5}
              value={Math.round(terrainOpacity * 100)}
              onChange={(e) => onTerrainOpacity(Number(e.target.value) / 100)}
              aria-label="Opacidad del terreno"
              className="w-20"
            />
          </label>
        )}
      </div>
    </div>
  );
}
