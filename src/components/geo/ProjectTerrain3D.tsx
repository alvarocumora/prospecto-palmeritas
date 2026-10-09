/**
 * Relieve 3D común para cualquier proyecto.
 *
 * Terreno real Copernicus GLO-30 + capas del visor 2D apoyadas sobre el relieve:
 *   DECLARADO → contornos de tenencia del proyecto (dorado) y catastro vecino (gris)
 *   DERIVADO  → centroides de anomalías espectrales
 *   CONCEPTUAL→ collares de sondaje propuestos
 * Si el DEM real no responde, no se dibuja relieve procedural como si fuera medido.
 */
import { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as THREE from "three";
import type { Feature, FeatureCollection, Position } from "geojson";
import { Loader2 } from "lucide-react";
import { getDemTile, type DemTile } from "@/engine3d/terrain/dem.functions";

const NIL_PROJECT = "00000000-0000-0000-0000-000000000000";
const DEM_SIZE = 129;
const SCALE = 0.02;
const M_PER_DEG = 111_320;

type LatLng = { lat: number; lng: number };

export type ProjectTerrain3DProps = {
  slug: string;
  center: LatLng;
  extentMeters?: number;
  concessions?: FeatureCollection | null;
  anomalies?: FeatureCollection | null;
  drillGrid?: FeatureCollection | null;
  height?: number;
};

function ringsOf(f: Feature): Position[][] {
  const g = f.geometry;
  if (!g) return [];
  if (g.type === "Polygon") return g.coordinates;
  if (g.type === "MultiPolygon") return g.coordinates.flat();
  if (g.type === "LineString") return [g.coordinates];
  return [];
}

function centroid(f: Feature): Position | null {
  const g = f.geometry;
  if (!g) return null;
  if (g.type === "Point") return g.coordinates;
  const pts = ringsOf(f).flat();
  if (!pts.length) return null;
  const s = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
  return [s[0] / pts.length, s[1] / pts.length];
}

function useProjector(center: LatLng, tile: DemTile | undefined) {
  return useMemo(() => {
    const cos = Math.cos((center.lat * Math.PI) / 180);
    return (lng: number, lat: number, lift = 0): THREE.Vector3 | null => {
      if (!tile) return null;
      const east = (lng - center.lng) * M_PER_DEG * cos;
      const north = (lat - center.lat) * M_PER_DEG;
      const half = tile.extentMeters / 2;
      const u = (east + half) / tile.extentMeters;
      const v = (half - north) / tile.extentMeters;
      if (u < 0 || u > 1 || v < 0 || v > 1) return null;
      const i = Math.round(u * (tile.size - 1));
      const j = Math.round(v * (tile.size - 1));
      const h = tile.heights[j * tile.size + i] ?? 0;
      return new THREE.Vector3(east * SCALE, (h + lift) * SCALE, -north * SCALE);
    };
  }, [center, tile]);
}

function Terrain({ tile }: { tile: DemTile }) {
  const geometry = useMemo(() => {
    const side = tile.extentMeters * SCALE;
    const geo = new THREE.PlaneGeometry(side, side, tile.size - 1, tile.size - 1);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const low = new THREE.Color("#5b6a52");
    const mid = new THREE.Color("#a3906b");
    const high = new THREE.Color("#e7e2d6");
    const range = Math.max(1, tile.maxH - tile.minH);
    for (let i = 0; i < pos.count; i++) {
      const h = tile.heights[i] ?? 0;
      pos.setZ(i, h * SCALE);
      const t = (h - tile.minH) / range;
      const c = t < 0.5 ? low.clone().lerp(mid, t * 2) : mid.clone().lerp(high, (t - 0.5) * 2);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [tile]);
  return (
    <mesh geometry={geometry} rotation-x={-Math.PI / 2}>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0.02} />
    </mesh>
  );
}

function Outline({
  points,
  color,
  width,
}: {
  points: THREE.Vector3[];
  color: string;
  width: number;
}) {
  const line = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color, linewidth: width });
    return new THREE.Line(geo, mat);
  }, [points, color, width]);
  return <primitive object={line} />;
}

export function ProjectTerrain3D({
  slug,
  center,
  extentMeters = 10000,
  concessions,
  anomalies,
  drillGrid,
  height = 620,
}: ProjectTerrain3DProps) {
  const demFn = useServerFn(getDemTile);
  const [layers, setLayers] = useState({ tenencia: true, anomalias: true, sondajes: true });
  const [hover, setHover] = useState<{ p: THREE.Vector3; text: string } | null>(null);

  const dem = useQuery({
    queryKey: ["project-dem", slug, DEM_SIZE, extentMeters],
    queryFn: () =>
      demFn({
        data: {
          projectId: NIL_PROJECT,
          size: DEM_SIZE,
          extentMeters,
          centerLat: center.lat,
          centerLng: center.lng,
        },
      }),
    staleTime: Infinity,
  });
  const tile = dem.data?.source === "copernicus" ? dem.data : undefined;
  const project = useProjector(center, tile);

  const outlines = useMemo(() => {
    if (!tile || !concessions) return [];
    return concessions.features
      .flatMap((f) => {
        const own = Boolean(f.properties?.es_tenencia_proyecto);
        return ringsOf(f).map((ring) => ({
          own,
          pts: ring
            .map((p) => project(p[0], p[1], own ? 25 : 8))
            .filter((v): v is THREE.Vector3 => v !== null),
        }));
      })
      .filter((o) => o.pts.length > 1);
  }, [tile, concessions, project]);

  const markers = (fc: FeatureCollection | null | undefined, lift: number) =>
    (fc?.features ?? [])
      .map((f) => {
        const c = centroid(f);
        const p = c ? project(c[0], c[1], lift) : null;
        const props = (f.properties ?? {}) as Record<string, unknown>;
        const text = String(props.name ?? props.nombre ?? props.index_code ?? props.id ?? "");
        return p ? { p, text } : null;
      })
      .filter((m): m is { p: THREE.Vector3; text: string } => m !== null);

  const anomalyPts = useMemo(() => markers(anomalies, 60), [anomalies, project]); // eslint-disable-line react-hooks/exhaustive-deps
  const drillPts = useMemo(() => markers(drillGrid, 40), [drillGrid, project]); // eslint-disable-line react-hooks/exhaustive-deps

  const camDist = extentMeters * SCALE * 0.75;

  return (
    <div
      className="rounded-2xl border border-hairline bg-surface-inverse overflow-hidden relative"
      style={{ height }}
    >
      {dem.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-white/70 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando relieve Copernicus…
        </div>
      )}
      {!dem.isLoading && !tile && (
        <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-white/80">
          El relieve real (Copernicus GLO-30) no está disponible en este momento. No se muestra un
          terreno aproximado para no presentarlo como medido. Usa la vista planimétrica.
        </div>
      )}
      {tile && (
        <Canvas camera={{ position: [camDist * 0.6, camDist * 0.7, camDist], fov: 45, far: 5000 }}>
          <color attach="background" args={["#14110d"]} />
          <ambientLight intensity={0.55} />
          <directionalLight position={[80, 160, 60]} intensity={1.1} />
          <Suspense fallback={null}>
            <Terrain tile={tile} />
            {layers.tenencia &&
              outlines.map((o, i) => (
                <Outline
                  key={i}
                  points={o.pts}
                  color={o.own ? "#f59e0b" : "#94a3b8"}
                  width={o.own ? 3 : 1}
                />
              ))}
            {layers.anomalias &&
              anomalyPts.map((m, i) => (
                <mesh
                  key={`a${i}`}
                  position={m.p}
                  onPointerOver={() => setHover(m)}
                  onPointerOut={() => setHover(null)}
                >
                  <sphereGeometry args={[1.6, 16, 16]} />
                  <meshStandardMaterial
                    color="#22b8cf"
                    emissive="#22b8cf"
                    emissiveIntensity={0.4}
                  />
                </mesh>
              ))}
            {layers.sondajes &&
              drillPts.map((m, i) => (
                <mesh
                  key={`d${i}`}
                  position={m.p}
                  onPointerOver={() => setHover(m)}
                  onPointerOut={() => setHover(null)}
                >
                  <cylinderGeometry args={[0.5, 0.5, 4, 8]} />
                  <meshStandardMaterial color="#e5e7eb" />
                </mesh>
              ))}
            {hover && hover.text && (
              <Html position={hover.p} center>
                <div className="whitespace-nowrap rounded bg-surface-inverse/90 px-2 py-1 text-[10px] font-mono text-white">
                  {hover.text}
                </div>
              </Html>
            )}
          </Suspense>
          <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.1} />
        </Canvas>
      )}
      {tile && (
        <div className="absolute top-3 left-3 rounded-md bg-surface-inverse/85 p-3 text-[10px] font-mono text-white/85 space-y-1.5">
          {(
            [
              ["tenencia", "Tenencia · declarado", "#f59e0b"],
              ["anomalias", "Anomalías · derivado", "#22b8cf"],
              ["sondajes", "Sondajes · conceptual", "#e5e7eb"],
            ] as const
          ).map(([k, label, color]) => (
            <label key={k} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={layers[k]}
                onChange={() => setLayers((s) => ({ ...s, [k]: !s[k] }))}
              />
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: color }}
              />
              {label}
            </label>
          ))}
          <p className="pt-1 text-white/55">Relieve: Copernicus GLO-30 · exageración 1×</p>
        </div>
      )}
    </div>
  );
}
