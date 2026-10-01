import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPinned, Mountain, TriangleAlert } from "lucide-react";
import type { FeatureCollection, Polygon } from "geojson";
import { getDemTile } from "@/engine3d/terrain/dem.functions";
import {
  analyzeToki2Terrain,
  buildToki2ControlPoints,
  pointInPolygon,
  TERRAIN_CLASS_LABELS,
  type LonLat,
} from "@/lib/cholqui/toki2Terrain";
import catastroRaw from "@/data/geo/cholqui_catastro_sngm.geojson?raw";
import anomaliesRaw from "@/data/geo/cholqui_satellite_candidates.geojson?raw";
import { CanonicalProjectViewer } from "@/components/geo/CanonicalProjectViewer";

const PROJECT_ID = "e5360f13-1647-4e44-bb13-c0614e6f39fe";
const DEM_SIZE = 65;
const DEM_EXTENT_M = 1600;

type JsonFeatureCollection = FeatureCollection & { metadata?: Record<string, unknown> };

function parse(raw: string): JsonFeatureCollection | null {
  try {
    return JSON.parse(raw) as JsonFeatureCollection;
  } catch {
    return null;
  }
}

function centroid(geometry: unknown): LonLat | null {
  const coords: LonLat[] = [];
  const walk = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      coords.push([value[0], value[1]]);
      return;
    }
    value.forEach(walk);
  };
  walk((geometry as { coordinates?: unknown } | null)?.coordinates);
  if (!coords.length) return null;
  return [
    coords.reduce((sum, point) => sum + point[0], 0) / coords.length,
    coords.reduce((sum, point) => sum + point[1], 0) / coords.length,
  ];
}

function num(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "s/d";
  return value.toLocaleString("es-CL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

const catastro = parse(catastroRaw);
const anomalies = parse(anomaliesRaw);
const toki2 = catastro?.features.find((feature) =>
  String(feature.properties?.nombre ?? "")
    .toUpperCase()
    .includes("TOKI 2"),
);
const toki2Ring =
  toki2?.geometry?.type === "Polygon"
    ? ((toki2.geometry as Polygon).coordinates[0] as LonLat[])
    : null;
const toki2AreaHa = Number(toki2?.properties?.hectareas ?? 100) || 100;
const toki2Points = toki2Ring ? buildToki2ControlPoints(toki2Ring) : [];
const toki2Center = toki2Points.find((point) => point.code === "TK2-09") ?? null;

function anomalyCountInside(ring: LonLat[] | null): number {
  if (!ring || !anomalies) return 0;
  return anomalies.features.reduce((count, feature) => {
    const c = centroid(feature.geometry);
    return c && pointInPolygon(c[0], c[1], ring) ? count + 1 : count;
  }, 0);
}

export function Toki2DemPanel({ authenticated = false }: { authenticated?: boolean }) {
  const demFn = useServerFn(getDemTile);
  const satelliteInside = useMemo(() => anomalyCountInside(toki2Ring), []);

  const dem = useQuery({
    queryKey: ["toki2-dem", DEM_SIZE, DEM_EXTENT_M, toki2Center?.lat, toki2Center?.lng],
    queryFn: () => {
      if (!toki2Center) throw new Error("Geometría Toki 2 no disponible");
      return demFn({
        data: {
          projectId: PROJECT_ID,
          size: DEM_SIZE,
          extentMeters: DEM_EXTENT_M,
          centerLat: toki2Center.lat,
          centerLng: toki2Center.lng,
        },
      });
    },
    enabled: Boolean(toki2Center),
    staleTime: 30 * 60_000,
  });

  const analysis = useMemo(
    () => (dem.data && toki2Ring ? analyzeToki2Terrain(dem.data, toki2Ring, toki2AreaHa) : null),
    [dem.data],
  );

  return (
    <div className="space-y-4">
      {authenticated && (
        <CanonicalProjectViewer profileKey="toki2" heightClassName="h-[460px]" compactHeader />
      )}
      <section className="overflow-hidden rounded-brand-lg border border-hairline bg-surface-3">
        <header className="flex flex-col gap-3 border-b border-hairline px-5 py-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-accent-brand">
              <Mountain className="h-3.5 w-3.5" />
              Toki 2 · DEM operativo
            </div>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-content">
              Terreno y puntos de levantamiento geológico
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-content-muted">
              Análisis de pendiente sobre la concesión TOKI 2 DEL 1 AL 20 para preparar accesos,
              estaciones de mapeo y sectores de trabajo. El DEM describe geometría superficial; no
              demuestra mineralización ni permite declarar recursos.
            </p>
          </div>
          <div className="text-right font-mono text-[10px] text-content-subtle">
            <div>Rol {String(toki2?.properties?.rol ?? "s/d")}</div>
            <div>{num(toki2AreaHa)} ha · ~1 km × 1 km</div>
          </div>
        </header>

        {dem.isLoading && (
          <div className="flex items-center gap-2 px-5 py-10 text-sm text-content-subtle">
            <Loader2 className="h-4 w-4 animate-spin" />
            Leyendo Copernicus DEM GLO-30 sobre Toki 2…
          </div>
        )}

        {dem.error && (
          <div className="px-5 py-8 text-sm text-content-subtle">
            No se pudo cargar el DEM de Toki 2. El módulo no genera una clasificación operacional
            sin una superficie disponible.
          </div>
        )}

        {analysis && (
          <>
            {analysis.source === "synthetic" && (
              <div className="flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/5 px-5 py-3 text-xs text-amber-700">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                Copernicus no respondió y se activó el relieve sintético de respaldo. No usar esta
                corrida para decisiones de terreno; repetir cuando la fuente GLO-30 esté disponible.
              </div>
            )}

            <div className="grid grid-cols-2 border-b border-hairline bg-surface-2 md:grid-cols-5">
              {[
                [
                  "Fuente",
                  analysis.source === "copernicus" ? "Copernicus GLO-30" : "Fallback sintético",
                ],
                [
                  "Rango de cota",
                  analysis.minElevationM != null
                    ? `${num(analysis.minElevationM)}–${num(analysis.maxElevationM)} m`
                    : "relativo",
                ],
                ["Relieve", `${num(analysis.reliefM)} m`],
                ["Pendiente media", `${num(analysis.meanSlopeDeg, 1)}°`],
                ["Anomalías sat. dentro", String(satelliteInside)],
              ].map(([key, value], index) => (
                <div key={key} className={`px-4 py-4 ${index ? "border-l border-hairline" : ""}`}>
                  <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-content-subtle">
                    {key}
                  </div>
                  <div className="mt-1 text-sm font-medium text-content">{value}</div>
                </div>
              ))}
            </div>

            <div className="grid border-b border-hairline md:grid-cols-4">
              {analysis.classes.map((item) => (
                <div
                  key={item.workClass}
                  className="border-b border-hairline px-5 py-4 md:border-b-0 md:border-r"
                >
                  <div className="font-mono text-[10px] uppercase tracking-wider text-content-subtle">
                    Clase {item.workClass}
                  </div>
                  <div className="mt-1 text-xl font-semibold text-content">{num(item.pct, 1)}%</div>
                  <div className="text-xs text-content-muted">~{num(item.areaHa, 1)} ha</div>
                  <div className="mt-2 text-[11px] leading-snug text-content-subtle">
                    {TERRAIN_CLASS_LABELS[item.workClass]}
                    <br />
                    {item.maxSlopeDeg == null
                      ? `>${item.minSlopeDeg}°`
                      : `${item.minSlopeDeg}–${item.maxSlopeDeg}°`}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-b border-hairline px-5 py-5">
              <div className="mb-3 flex items-center gap-2">
                <MapPinned className="h-4 w-4 text-accent-brand" />
                <div className="font-mono text-[10px] uppercase tracking-wider text-content-subtle">
                  9 puntos base para levantamiento geológico
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-hairline text-left text-content-subtle">
                      <th className="py-2 pr-3 font-mono font-normal">Punto</th>
                      <th className="py-2 pr-3 font-mono font-normal">Objetivo</th>
                      <th className="py-2 pr-3 font-mono font-normal">Lat</th>
                      <th className="py-2 pr-3 font-mono font-normal">Lng</th>
                      <th className="py-2 pr-3 font-mono font-normal text-right">Cota</th>
                      <th className="py-2 pr-3 font-mono font-normal text-right">Pendiente</th>
                      <th className="py-2 font-mono font-normal">Clase</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.controlPoints.map((point) => (
                      <tr key={point.code} className="border-b border-hairline/60">
                        <td className="py-2 pr-3 font-mono text-content">{point.code}</td>
                        <td className="py-2 pr-3 text-content-muted">{point.purpose}</td>
                        <td className="py-2 pr-3 font-mono text-content-subtle">
                          {point.lat.toFixed(6)}
                        </td>
                        <td className="py-2 pr-3 font-mono text-content-subtle">
                          {point.lng.toFixed(6)}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-content">
                          {point.elevationM != null ? `${num(point.elevationM)} m` : "s/d"}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-content">
                          {point.slopeDeg != null ? `${num(point.slopeDeg, 1)}°` : "s/d"}
                        </td>
                        <td className="py-2">
                          {point.workClass ? (
                            <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-content-muted">
                              {point.workClass}
                            </span>
                          ) : (
                            "s/d"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid md:grid-cols-2">
              <div className="border-b border-hairline px-5 py-5 md:border-b-0 md:border-r">
                <div className="font-mono text-[10px] uppercase tracking-wider text-content-subtle">
                  Lectura satelital
                </div>
                <p className="mt-2 text-xs leading-relaxed text-content-muted">
                  El pase Sentinel-2 actualmente cargado contiene {satelliteInside} anomalías cuyo
                  centroide cae dentro de Toki 2. Un valor cero no descarta mineralización:
                  vegetación, sombra topográfica, cobertura y resolución espectral pueden ocultar
                  una expresión superficial. El levantamiento de terreno sigue siendo obligatorio.
                </p>
              </div>
              <div className="px-5 py-5">
                <div className="font-mono text-[10px] uppercase tracking-wider text-content-subtle">
                  Estimación de material
                </div>
                <p className="mt-2 text-xs leading-relaxed text-content-muted">
                  Estado: <b className="text-content">NO HABILITADA</b>. El DEM permite medir
                  superficie, pendiente y relieve, pero para estimar volumen o tonelaje se requiere
                  delimitar un cuerpo geológico en terreno, medir potencia y continuidad, y aplicar
                  una densidad sustentada. Cualquier cálculo previo sería solo un escenario
                  geométrico conceptual, no un recurso mineral.
                </p>
              </div>
            </div>

            <div className="border-t border-hairline px-5 py-3 text-[10px] text-content-subtle">
              GLO-30 tiene resolución nativa aproximada de 30 m. El grid de análisis se remuestrea a
              ~{num(analysis.cellSizeM, 0)} m para cálculo numérico, sin crear detalle topográfico
              nuevo. Las clases A–D son un screening operacional preliminar y no sustituyen
              geotecnia, topografía de precisión ni diseño de caminos/plataformas.
            </div>
          </>
        )}
      </section>
    </div>
  );
}
