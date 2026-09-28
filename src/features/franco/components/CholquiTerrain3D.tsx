/**
 * Cubo de evidencia 3D de Cholqui.
 *
 * Terreno real (Copernicus DEM GLO-30) con las capas del proyecto encima,
 * cada una con su procedencia explícita:
 *   MEDIDO      → ensayes certificados de superficie
 *   DERIVADO    → anomalías espectrales Sentinel-2
 *   CONCEPTUAL  → collares y trazas de sondaje propuestos
 *
 * No se dibujan cuerpos mineralizados ni volúmenes de recursos: no existen.
 */
import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Environment, Html, Lightformer, OrbitControls } from "@react-three/drei";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as THREE from "three";
import { Loader2 } from "lucide-react";
import { getDemTile, type DemTile } from "@/engine3d/terrain/dem.functions";
import { getCholquiSatelliteTargets } from "@/lib/cholqui/satelliteTargets.functions";
import { CHOLQUI, CHOLQUI_POINTS, LAS_MINITAS } from "@/features/franco/data/cholqui";
import { indexLabel } from "@/lib/cholqui/drillGrid";

const PROJECT_ID = "e5360f13-1647-4e44-bb13-c0614e6f39fe";
const CENTER = CHOLQUI.center;
const EXTENT_M = 14000;
const DEM_SIZE = 129;
/** 1 m real = SCALE unidades de escena. */
const SCALE = 0.02;
const METERS_PER_DEG_LAT = 111_320;

const INDEX_COLOR: Record<string, string> = {
  CLAY_MINERALS: "#22b8cf",
  HYDROTHERMAL_ALTERATION: "#d6336c",
  IRON_OXIDE: "#f59f00",
  STRUCTURAL_LINEAMENTS: "#c9a227",
};

function colorFor(code: string): string {
  const hit = Object.keys(INDEX_COLOR).find((k) => code.includes(k));
  return hit ? INDEX_COLOR[hit] : "#8c8c8c";
}

/** Metros locales (este, norte) respecto al centro del distrito. */
function toLocalM(lat: number, lng: number): [number, number] {
  const north = (lat - CENTER.lat) * METERS_PER_DEG_LAT;
  const east = (lng - CENTER.lng) * METERS_PER_DEG_LAT * Math.cos((CENTER.lat * Math.PI) / 180);
  return [east, north];
}

type Hover = { title: string; lines: string[]; x: number; y: number; z: number } | null;

function sampleHeight(tile: DemTile, east: number, north: number): number {
  const half = tile.extentMeters / 2;
  const u = (east + half) / tile.extentMeters;
  const v = (half - north) / tile.extentMeters;
  if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
  const i = Math.min(tile.size - 1, Math.max(0, Math.round(u * (tile.size - 1))));
  const j = Math.min(tile.size - 1, Math.max(0, Math.round(v * (tile.size - 1))));
  return tile.heights[j * tile.size + i] ?? 0;
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
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [tile]);

  return (
    <mesh geometry={geometry} rotation-x={-Math.PI / 2} receiveShadow>
      <meshStandardMaterial
        vertexColors
        roughness={0.95}
        metalness={0.02}
        transparent
        opacity={0.9}
      />

    </mesh>
  );
}

function Marker({
  position,
  color,
  radius,
  onHover,
  hoverData,
}: {
  position: [number, number, number];
  color: string;
  radius: number;
  onHover: (h: Hover) => void;
  hoverData: { title: string; lines: string[] };
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 1.6) * 0.06;
      ref.current.scale.setScalar(s);
    }
  });
  const enter = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover({ ...hoverData, x: position[0], y: position[1], z: position[2] });
  };
  return (
    <mesh
      ref={ref}
      position={position}
      onPointerOver={enter}
      onPointerOut={() => onHover(null)}
      castShadow
    >
      <sphereGeometry args={[radius, 20, 20]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
    </mesh>
  );
}

/** Halo espectral: disco translúcido apoyado sobre el relieve. */
function Halo({
  position,
  color,
  radius,
  withinTenure,
}: {
  position: [number, number, number];
  color: string;
  radius: number;
  withinTenure: boolean;
}) {
  return (
    <group position={position}>
      {[1, 1.7, 2.4].map((k, i) => (
        <mesh key={k} rotation-x={-Math.PI / 2} position-y={0.02 * (i + 1)}>
          <circleGeometry args={[radius * k, 40]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={(withinTenure ? 0.2 : 0.09) / (i + 1)}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Traza de sondaje propuesto: línea desde el collar hacia la profundidad. */
function DrillTrace({
  collar,
  azimuthDeg,
  dipDeg,
  depthM,
  onHover,
  hoverData,
}: {
  collar: [number, number, number];
  azimuthDeg: number;
  dipDeg: number;
  depthM: number;
  onHover: (h: Hover) => void;
  hoverData: { title: string; lines: string[] };
}) {
  const end = useMemo(() => {
    const az = (azimuthDeg * Math.PI) / 180;
    const dip = (Math.abs(dipDeg) * Math.PI) / 180;
    const horiz = depthM * Math.cos(dip) * SCALE;
    const vert = depthM * Math.sin(dip) * SCALE;
    return new THREE.Vector3(
      collar[0] + Math.sin(az) * horiz,
      collar[1] - vert,
      collar[2] - Math.cos(az) * horiz,
    );
  }, [collar, azimuthDeg, dipDeg, depthM]);

  const start = useMemo(() => new THREE.Vector3(...collar), [collar]);
  const mid = useMemo(() => start.clone().lerp(end, 0.5), [start, end]);
  const length = start.distanceTo(end);
  const quaternion = useMemo(() => {
    const dir = end.clone().sub(start).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  }, [start, end]);

  return (
    <group
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onHover({ ...hoverData, x: collar[0], y: collar[1], z: collar[2] });
      }}
      onPointerOut={() => onHover(null)}
    >
      <mesh position={mid} quaternion={quaternion}>
        <cylinderGeometry args={[0.5, 0.5, length, 12]} />
        <meshStandardMaterial
          color="#4d7cff"
          emissive="#4d7cff"
          emissiveIntensity={0.6}
          depthTest={false}
        />
      </mesh>
      <mesh position={start}>
        <sphereGeometry args={[1.1, 20, 20]} />
        <meshStandardMaterial
          color="#4d7cff"
          emissive="#4d7cff"
          emissiveIntensity={0.5}
          depthTest={false}
        />
      </mesh>
      <mesh position={end}>
        <coneGeometry args={[0.9, 2.2, 14]} />
        <meshStandardMaterial color="#4d7cff" depthTest={false} />
      </mesh>

    </group>
  );
}

function Scene({
  tile,
  anomalies,
  collars,
  layers,
  onHover,
}: {
  tile: DemTile;
  anomalies: Array<{
    id: string;
    lat: number;
    lng: number;
    indexCode: string;
    score: number | null;
    areaHa: number | null;
    withinTenure?: boolean;
  }>;
  collars: Array<{
    code: string;
    lat: number;
    lng: number;
    azimuthDeg: number;
    dipDeg: number;
    depthM: number;
    priority: string;
    objective: string;
  }>;
  layers: { assays: boolean; anomalies: boolean; collars: boolean; neighbour: boolean };
  onHover: (h: Hover) => void;
}) {
  const place = (lat: number, lng: number, lift = 0): [number, number, number] => {
    const [east, north] = toLocalM(lat, lng);
    const h = sampleHeight(tile, east, north);
    return [east * SCALE, h * SCALE + lift, -north * SCALE];
  };

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[120, 160, 90]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <Environment>
        <Lightformer intensity={1.4} position={[0, 60, 0]} scale={[60, 60, 1]} />
        <Lightformer
          intensity={0.7}
          color="#bcd2e0"
          position={[-60, 12, -20]}
          rotation-y={Math.PI / 2}
          scale={[80, 12, 1]}
        />
      </Environment>

      <Terrain tile={tile} />

      {layers.anomalies &&
        anomalies.map((a) => {
          const pos = place(a.lat, a.lng, 0.4);
          const color = colorFor(a.indexCode);
          const radius = Math.max(1.6, Math.sqrt((a.areaHa ?? 2) * 10_000 / Math.PI) * SCALE);
          return (
            <group key={a.id}>
              <Halo
                position={[pos[0], pos[1] - 0.3, pos[2]]}
                color={color}
                radius={radius}
                withinTenure={a.withinTenure === true}
              />
              <Marker
                position={pos}
                color={color}
                radius={0.7}
                onHover={onHover}
                hoverData={{
                  title: a.id,
                  lines: [
                    `${indexLabel(a.indexCode)} · DERIVADO`,
                    `Puntaje ${a.score != null ? a.score.toFixed(2).replace(".", ",") : "s/d"}`,
                    a.withinTenure ? "Dentro de concesión conocida" : "Requiere verificar tenencia",
                    "Indicio satelital, no verificado en terreno",
                  ],
                }}
              />
            </group>
          );
        })}

      {layers.assays &&
        CHOLQUI_POINTS.map((p) => {
          const pos = place(p.lat, p.lng, 0.6);
          return (
            <Marker
              key={p.code}
              position={pos}
              color="#2f9e44"
              radius={0.6}
              onHover={onHover}
              hoverData={{
                title: p.code,
                lines: [p.name, "MEDIDO · punto de observación y muestreo", "UTM PSAD'56 19H"],
              }}
            />
          );
        })}

      {layers.collars &&
        collars.map((c) => {
          const pos = place(c.lat, c.lng, 0.2);
          return (
            <DrillTrace
              key={c.code}
              collar={pos}
              azimuthDeg={c.azimuthDeg}
              dipDeg={c.dipDeg}
              depthM={c.depthM}
              onHover={onHover}
              hoverData={{
                title: c.code,
                lines: [
                  "CONCEPTUAL · plataforma propuesta",
                  `Azimut ${c.azimuthDeg}° · inclinación ${c.dipDeg}°`,
                  `Profundidad ${c.depthM} m · prioridad ${c.priority}`,
                  c.objective,
                ],
              }}
            />
          );
        })}

      {layers.neighbour && (
        <Marker
          position={place(LAS_MINITAS.lat, LAS_MINITAS.lng, 0.8)}
          color="#e03131"
          radius={0.9}
          onHover={onHover}
          hoverData={{
            title: LAS_MINITAS.name,
            lines: [
              "Faena vecina de un tercero, en producción",
              "Referencia de continuidad estructural",
              "No es producción del proyecto",
            ],
          }}
        />
      )}

      <OrbitControls
        enablePan
        maxPolarAngle={Math.PI / 2.1}
        minDistance={20}
        maxDistance={700}
        target={[0, 0, 0]}
      />
    </>
  );
}

function HoverCard({ hover }: { hover: Hover }) {
  if (!hover) return null;
  return (
    <Html position={[hover.x, hover.y + 3, hover.z]} center distanceFactor={140}>
      <div className="pointer-events-none rounded-md border border-hairline bg-surface/95 px-3 py-2 shadow-lg min-w-[190px]">
        <div className="font-mono text-[11px] uppercase tracking-wider text-accent-brand">
          {hover.title}
        </div>
        {hover.lines.map((l) => (
          <div key={l} className="text-[11px] leading-snug text-content-subtle">
            {l}
          </div>
        ))}
      </div>
    </Html>
  );
}

const LEGEND: Array<[string, string, string]> = [
  ["#2f9e44", "Ensayes y observaciones", "MEDIDO"],
  ["#22b8cf", "Arcillas Al-OH", "DERIVADO"],
  ["#d6336c", "Alteración hidrotermal", "DERIVADO"],
  ["#f59f00", "Óxidos de hierro", "DERIVADO"],
  ["#4d7cff", "Sondajes propuestos", "CONCEPTUAL"],
];

export function CholquiTerrain3D() {
  const demFn = useServerFn(getDemTile);
  const targetsFn = useServerFn(getCholquiSatelliteTargets);
  const [hover, setHover] = useState<Hover>(null);
  const [layers, setLayers] = useState({
    assays: true,
    anomalies: true,
    collars: true,
    neighbour: true,
  });

  const dem = useQuery({
    queryKey: ["cholqui-dem", DEM_SIZE, EXTENT_M],
    queryFn: () =>
      demFn({ data: { projectId: PROJECT_ID, size: DEM_SIZE, extentMeters: EXTENT_M } }),
    staleTime: Infinity,
  });
  const targets = useQuery({
    queryKey: ["cholqui-satellite-targets"],
    queryFn: () => targetsFn(),
    staleTime: 5 * 60_000,
  });

  const loading = dem.isLoading || targets.isLoading;

  return (
    <div className="relative rounded-2xl border border-hairline bg-white overflow-hidden">
      <div className="h-[620px] bg-[#11151c]">
        {loading && (
          <div className="h-full grid place-items-center gap-3 text-white/70">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-[11px] font-mono uppercase tracking-wider">
              Cargando terreno Copernicus 30 m
            </span>
          </div>
        )}
        {!loading && dem.data && (
          <Canvas shadows camera={{ position: [110, 95, 150], fov: 48 }} dpr={[1, 2]}>
            <color attach="background" args={["#11151c"]} />
            <fog attach="fog" args={["#11151c", 500, 1200]} />
            <Suspense fallback={null}>
              <Scene
                tile={dem.data}
                anomalies={targets.data?.anomalies ?? []}
                collars={targets.data?.collars ?? []}
                layers={layers}
                onHover={setHover}
              />
              <HoverCard hover={hover} />
            </Suspense>
          </Canvas>
        )}
      </div>

      {/* Control de capas */}
      <div className="absolute top-4 left-4 rounded-lg border border-white/15 bg-black/60 backdrop-blur px-3 py-2.5 text-white">
        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/60 mb-2">
          Capas del cubo
        </div>
        {(
          [
            ["assays", "Ensayes y observaciones"],
            ["anomalies", "Halos espectrales"],
            ["collars", "Sondajes propuestos"],
            ["neighbour", "Faena vecina"],
          ] as Array<[keyof typeof layers, string]>
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-[12px] py-0.5 cursor-pointer">
            <input
              type="checkbox"
              checked={layers[key]}
              onChange={(e) => setLayers((s) => ({ ...s, [key]: e.target.checked }))}
              className="accent-white"
            />
            {label}
          </label>
        ))}
      </div>

      {/* Leyenda de procedencia */}
      <div className="absolute bottom-16 left-4 rounded-lg border border-white/15 bg-black/60 backdrop-blur px-3 py-2.5 text-white">
        {LEGEND.map(([color, label, tag]) => (
          <div key={label} className="flex items-center gap-2 text-[11px] py-0.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span>{label}</span>
            <span className="font-mono text-[9px] uppercase tracking-wider text-white/50">
              {tag}
            </span>
          </div>
        ))}
      </div>

      <div className="px-5 py-3 border-t border-hairline text-[11px] text-content-subtle">
        Terreno: Copernicus DEM GLO-30 (~30 m){" "}
        {dem.data?.source === "synthetic" && "— tile remoto no disponible, relieve de referencia"}.
        Los halos espectrales son indicios derivados de Sentinel-2, no mineralización. Las trazas de
        sondaje son propuestas conceptuales: no existen sondajes ejecutados ni volúmenes de recursos
        en esta escena.
      </div>
    </div>
  );
}
