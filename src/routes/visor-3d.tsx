import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import {
  Box as BoxIcon,
  ArrowLeft,
  ArrowRight,
  MapPin,
  AlertTriangle,
  Activity,
  MousePointer2,
  RotateCw,
  ZoomIn,
  Satellite,
} from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/features/marketing/MarketingShell";
import { Eyebrow, SectionHeading, VerificationBadge } from "@/components/brand";
import { projectVerification } from "@/lib/verification";
import { getPublicSatellite, type PublicSatProject } from "@/lib/publicSatellite.functions";
import { getDemTile, type DemTile } from "@/engine3d/terrain/dem.functions";

type Visor3DSearch = {
  project?: string;
  anomaly?: string;
  insar?: string;
};

export const Route = createFileRoute("/visor-3d")({
  validateSearch: (search: Record<string, unknown>): Visor3DSearch => ({
    project: typeof search.project === "string" ? search.project : undefined,
    anomaly: typeof search.anomaly === "string" ? search.anomaly : undefined,
    insar: typeof search.insar === "string" ? search.insar : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Visor 3D minero — Geocapitals" },
      {
        name: "description",
        content:
          "Visor 3D interactivo con terreno, sondajes reales y anomalías satelitales georreferenciadas sobre los proyectos mineros de Geocapitals. Zoom, rotación y selección directa.",
      },
      { property: "og:title", content: "Visor 3D minero — Geocapitals" },
      {
        property: "og:description",
        content:
          "Escena 3D con anomalías satelitales y sondajes reales de proyectos mineros chilenos.",
      },
      { property: "og:url", content: "https://geocapitals.com/visor-3d" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://geocapitals.com/visor-3d" }],
  }),
  component: Visor3DPage,
  errorComponent: Visor3DError,
  notFoundComponent: () => <p className="p-10 text-center">Escena no disponible.</p>,
});

function Visor3DError({ error: rawError }: { error: unknown }) {
  const error = rawError as Error;
  return (
    <main className="min-h-screen bg-surface">
      <MarketingHeader />
      <div className="max-w-3xl mx-auto px-5 py-24 text-center">
        <h1 className="brand-display text-2xl mb-3">No pudimos cargar el visor 3D</h1>
        <p className="text-content-subtle text-sm mb-6">{error.message}</p>
        <Link to="/" className="text-accent-brand hover:underline">
          ← Volver al inicio
        </Link>
      </div>
      <MarketingFooter />
    </main>
  );
}

// ---- Geometría de escena ----------------------------------------------------

const SCENE_HALF = 900; // metros equivalentes en la escena
const METERS_PER_DEG_LAT = 111_320;
const GEO_SCALE = 0.08; // 1 m real = 0.08 unidades de escena (horizontal)
const VERT_SCALE = GEO_SCALE; // vertical 1:1 con la horizontal (DEM real Copernicus)
const MAX_R = 260; // radio máximo de la nube alrededor del marcador
const DEM_EXTENT_M = 6500; // lado del tile DEM por sitio
const DEM_SIZE = 129; // grid 2^n + 1

type SiteData = {
  project: PublicSatProject;
  position: [number, number, number];
  anomalies: Array<{
    id: string;
    offset: [number, number, number];
    score: number;
    severity: string;
    color: string;
    notes: string | null;
    detected_at: string | null;
    georeferenced: boolean;
  }>;
  holes: Array<{
    id: string;
    hole_id: string;
    offset: [number, number]; // x, z en unidades de escena
    depth: number; // unidades de escena
    depth_m: number; // metros reales
    azimuth: number; // grados
    dip: number; // grados (negativo = bajo la horizontal)
    status: string;
    intervals: PublicSatProject["drillholes"][number]["intervals"];
  }>;
  criticalCount: number;
  avgVelocity: number;
};

const SEV_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#10b981",
};

function projectsToSites(projects: PublicSatProject[]): SiteData[] {
  if (!projects.length) return [];
  const latValues = projects.map((p) => p.center_lat ?? 0);
  const lngValues = projects.map((p) => p.center_lng ?? 0);
  const minLat = Math.min(...latValues);
  const maxLat = Math.max(...latValues);
  const minLng = Math.min(...lngValues);
  const maxLng = Math.max(...lngValues);
  const spanLat = Math.max(maxLat - minLat, 0.01);
  const spanLng = Math.max(maxLng - minLng, 0.01);

  return projects.map((project) => {
    const nx = ((project.center_lng ?? 0) - minLng) / spanLng;
    const ny = ((project.center_lat ?? 0) - minLat) / spanLat;
    const x = (nx - 0.5) * SCENE_HALF * 1.2;
    const z = -(ny - 0.5) * SCENE_HALF * 1.2;
    // Cada sitio se ancla a y=0: su parche DEM se desplaza para que el centro
    // del tile quede a esa altura.
    const y = 0;

    const cLat = project.center_lat;
    const cLng = project.center_lng;
    const cosLat = Math.cos(((cLat ?? -30) * Math.PI) / 180);

    const anomalies = project.anomalies.slice(0, 40).map((a, idx) => {
      const sev = (a.severity ?? "low").toLowerCase();
      let ox: number;
      let oz: number;

      if (a.lat != null && a.lng != null && cLat != null && cLng != null) {
        // Posición real relativa al centro del proyecto
        ox = (a.lng - cLng) * METERS_PER_DEG_LAT * cosLat * GEO_SCALE;
        oz = -(a.lat - cLat) * METERS_PER_DEG_LAT * GEO_SCALE;
        const r = Math.hypot(ox, oz);
        if (r > MAX_R) {
          ox = (ox / r) * MAX_R;
          oz = (oz / r) * MAX_R;
        }
      } else {
        // Fallback decorativo cuando la anomalía no tiene geometría
        const angle = (idx / Math.max(project.anomalies.length, 1)) * Math.PI * 2;
        const radius = 40 + ((a.score ?? 0.3) * 90 + (idx % 5) * 12);
        ox = Math.cos(angle) * radius;
        oz = Math.sin(angle) * radius;
      }

      return {
        id: a.id,
        offset: [ox, 25 + (a.score ?? 0.3) * 90, oz] as [number, number, number],
        score: a.score ?? 0,
        severity: sev,
        color: SEV_COLOR[sev] ?? "#94a3b8",
        notes: a.notes,
        detected_at: a.detected_at,
        georeferenced: a.lat != null && a.lng != null,
      };
    });

    // Sondajes reales: offsets desde el collar medio (UTM ya está en metros)
    const withCoords = project.drillholes.filter((h) => h.easting != null && h.northing != null);
    const meanE = withCoords.length
      ? withCoords.reduce((s, h) => s + (h.easting ?? 0), 0) / withCoords.length
      : 0;
    const meanN = withCoords.length
      ? withCoords.reduce((s, h) => s + (h.northing ?? 0), 0) / withCoords.length
      : 0;
    const DEPTH_SCALE = 0.5; // 1 m de sondaje = 0.5 unidades de escena

    const holes = withCoords.map((h) => {
      let hx = ((h.easting ?? 0) - meanE) * GEO_SCALE;
      let hz = -((h.northing ?? 0) - meanN) * GEO_SCALE;
      const r = Math.hypot(hx, hz);
      if (r > MAX_R) {
        hx = (hx / r) * MAX_R;
        hz = (hz / r) * MAX_R;
      }
      const depth_m = h.depth ?? 150;
      return {
        id: h.id,
        hole_id: h.hole_id,
        offset: [hx, hz] as [number, number],
        depth: Math.max(20, depth_m * DEPTH_SCALE),
        depth_m,
        azimuth: h.azimuth ?? 0,
        dip: h.dip ?? -90,
        status: h.status,
        intervals: h.intervals,
      };
    });

    const criticalCount = project.anomalies.filter(
      (a) => (a.severity ?? "").toLowerCase() === "critical",
    ).length;

    const avgVelocity =
      project.insar.length > 0
        ? project.insar.reduce((s, i) => s + (Number(i.velocity_mm_year) || 0), 0) /
          project.insar.length
        : 0;

    return {
      project,
      position: [x, y, z],
      anomalies,
      holes,
      criticalCount,
      avgVelocity,
    };
  });
}

// ---- Componentes 3D ---------------------------------------------------------

/** Plano base oscuro bajo los parches DEM. */
function GroundPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
      <planeGeometry args={[SCENE_HALF * 3, SCENE_HALF * 3]} />
      <meshStandardMaterial color="#14100c" roughness={1} metalness={0} />
    </mesh>
  );
}

/** Parche de terreno DEM centrado en un sitio (alturas relativas al centro). */
function TerrainPatch({ dem, position }: { dem: DemTile; position: [number, number] }) {
  const geo = useMemo(() => {
    const size = dem.size;
    const w = dem.extentMeters * GEO_SCALE;
    const g = new THREE.PlaneGeometry(w, w, size - 1, size - 1);
    const centerH = dem.heights[Math.floor(size / 2) * size + Math.floor(size / 2)] ?? 0;
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let idx = 0; idx < size * size; idx++) {
      pos.setZ(idx, (dem.heights[idx] - centerH) * VERT_SCALE);
    }
    g.computeVertexNormals();
    g.rotateX(-Math.PI / 2);
    return g;
  }, [dem]);

  return (
    <mesh geometry={geo} position={[position[0], 0, position[1]]} receiveShadow>
      <meshStandardMaterial color="#3a2f24" roughness={0.95} metalness={0.05} />
    </mesh>
  );
}

// Paleta determinística de litologías (hash del nombre → color estable)
const LITHO_PALETTE = [
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#f43f5e",
  "#eab308",
  "#3b82f6",
  "#f97316",
  "#14b8a6",
];

function lithoColor(name: string | null): string {
  if (!name) return "#c1a266";
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return LITHO_PALETTE[Math.abs(h) % LITHO_PALETTE.length];
}

const HOLE_STATUS_COLOR: Record<string, string> = {
  completed: "#c1a266",
  in_progress: "#60a5fa",
  planned: "#64748b",
};

type HoleIntervals = PublicSatProject["drillholes"][number]["intervals"];

function DrillHole({
  position,
  depth = 250,
  depthM = 250,
  azimuth = 0,
  dip = -90,
  status = "completed",
  intervals = [],
  selected = false,
  auCutoff = null,
  onClick,
}: {
  position: [number, number, number];
  depth?: number;
  depthM?: number;
  azimuth?: number;
  dip?: number;
  status?: string;
  intervals?: HoleIntervals;
  selected?: boolean;
  auCutoff?: number | null;
  onClick?: () => void;
}) {
  // Dirección del pozo: azimuth (grados desde el norte, horario) + dip
  // (negativo = bajo la horizontal). Norte = -Z en la escena.
  const quat = useMemo(() => {
    const azRad = (azimuth * Math.PI) / 180;
    const dipRad = (Math.min(Math.abs(dip), 90) * Math.PI) / 180;
    const dir = new THREE.Vector3(
      Math.sin(azRad) * Math.cos(dipRad),
      -Math.sin(dipRad),
      -Math.cos(azRad) * Math.cos(dipRad),
    ).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  }, [azimuth, dip]);

  const color = HOLE_STATUS_COLOR[status] ?? HOLE_STATUS_COLOR.completed;
  // Escala: unidades de escena por metro de pozo
  const mScale = depth / Math.max(depthM, 1);

  const handlers = onClick
    ? {
        onClick: (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          onClick();
        },
        onPointerOver: (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        },
        onPointerOut: () => {
          document.body.style.cursor = "default";
        },
      }
    : {};

  return (
    <group position={position}>
      {/* Traza inclinada: cuelga desde el collar según azimuth/dip */}
      <group quaternion={quat}>
        {intervals.length > 0 ? (
          intervals.map((iv, k) => {
            const segLen = Math.max((iv.to - iv.from) * mScale, 1.5);
            const segCenter = -(iv.from + (iv.to - iv.from) / 2) * mScale;
            // Ley de corte: los tramos bajo el cutoff se atenúan
            const belowCutoff = auCutoff != null && (iv.au_gpt ?? 0) < auCutoff;
            const aboveCutoff = auCutoff != null && (iv.au_gpt ?? 0) >= auCutoff;
            return (
              <mesh key={k} position={[0, segCenter, 0]} {...handlers}>
                <cylinderGeometry
                  args={[aboveCutoff ? 4.5 : 3.2, aboveCutoff ? 4.5 : 3.2, segLen, 10]}
                />
                <meshStandardMaterial
                  color={belowCutoff ? "#3a3a3a" : lithoColor(iv.lithology)}
                  emissive={
                    aboveCutoff ? "#f6c453" : selected ? lithoColor(iv.lithology) : "#000000"
                  }
                  emissiveIntensity={aboveCutoff ? 0.6 : selected ? 0.35 : 0}
                  metalness={0.3}
                  roughness={0.5}
                  transparent={belowCutoff}
                  opacity={belowCutoff ? 0.18 : 1}
                />
              </mesh>
            );
          })
        ) : (
          <mesh position={[0, -depth / 2, 0]} {...handlers}>
            <cylinderGeometry args={[3, 3, depth, 12]} />
            <meshStandardMaterial
              color={color}
              emissive={selected ? color : "#000000"}
              emissiveIntensity={selected ? 0.5 : 0}
              metalness={0.4}
              roughness={0.4}
            />
          </mesh>
        )}
      </group>
      {/* Collar en superficie */}
      <mesh position={[0, 12, 0]} {...handlers}>
        <coneGeometry args={[10, 24, 16]} />
        <meshStandardMaterial
          color={selected ? "#fbbf24" : "#f6c453"}
          emissive={selected ? "#f59e0b" : "#3a2a10"}
          emissiveIntensity={selected ? 0.8 : 1}
        />
      </mesh>
    </group>
  );
}

function AnomalyPoint({
  offset,
  color,
  score,
  onClick,
  selected,
}: {
  offset: [number, number, number];
  color: string;
  score: number;
  onClick: () => void;
  selected: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = offset[1] + Math.sin(t * 1.5 + offset[0]) * 3;
  });
  const size = 6 + score * 14;
  return (
    <mesh
      ref={ref}
      position={offset}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
    >
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={selected ? 1.4 : 0.55}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

function Site({
  site,
  selected,
  onSelectSite,
  onSelectAnomaly,
  selectedAnomalyId,
  onSelectHole,
  selectedHoleId,
  auCutoff,
}: {
  site: SiteData;
  selected: boolean;
  onSelectSite: () => void;
  onSelectAnomaly: (id: string) => void;
  selectedAnomalyId: string | null;
  onSelectHole: (id: string) => void;
  selectedHoleId: string | null;
  auCutoff: number | null;
}) {
  const [x, y, z] = site.position;

  return (
    <group position={[x, y, z]}>
      {/* Base marker */}
      <mesh
        position={[0, 6, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectSite();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "default";
        }}
      >
        <cylinderGeometry args={[22, 30, 12, 24]} />
        <meshStandardMaterial
          color={selected ? "#fbbf24" : "#eab308"}
          emissive={selected ? "#f59e0b" : "#000000"}
          emissiveIntensity={selected ? 0.6 : 0}
        />
      </mesh>

      {/* Label */}
      <Html position={[0, 140, 0]} center style={{ pointerEvents: "none", userSelect: "none" }}>
        <div className="whitespace-nowrap rounded-full border border-white/20 bg-black/70 px-3 py-1 text-[11px] font-medium text-white backdrop-blur">
          {site.project.name}
        </div>
      </Html>

      {/* Sondajes: reales si el proyecto tiene collares; demo si no */}
      {site.holes.length > 0 ? (
        site.holes.map((h) => (
          <DrillHole
            key={h.id}
            position={[h.offset[0], 0, h.offset[1]]}
            depth={h.depth}
            depthM={h.depth_m}
            azimuth={h.azimuth}
            dip={h.dip}
            status={h.status}
            intervals={h.intervals}
            selected={selectedHoleId === h.id}
            auCutoff={auCutoff}
            onClick={() => onSelectHole(h.id)}
          />
        ))
      ) : (
        <>
          <DrillHole position={[45, 0, 30]} />
          <DrillHole position={[-40, 0, 50]} />
          <DrillHole position={[10, 0, -55]} />
        </>
      )}

      {/* Anomaly cloud */}
      {site.anomalies.map((a) => (
        <AnomalyPoint
          key={a.id}
          offset={a.offset}
          color={a.color}
          score={a.score}
          selected={selectedAnomalyId === a.id}
          onClick={() => onSelectAnomaly(a.id)}
        />
      ))}
    </group>
  );
}

function CameraFocus({ target, zoom }: { target: [number, number, number] | null; zoom: number }) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const desiredTarget = useRef(new THREE.Vector3());
  const desiredPos = useRef(new THREE.Vector3());
  const hasTarget = useRef(false);

  useEffect(() => {
    if (!target) {
      hasTarget.current = false;
      return;
    }
    desiredTarget.current.set(target[0], target[1], target[2]);
    // Camera offset relative to target: elevated & pulled back
    desiredPos.current.set(target[0] + zoom * 0.9, target[1] + zoom * 0.7, target[2] + zoom);
    hasTarget.current = true;
  }, [target, zoom]);

  useFrame(() => {
    if (!hasTarget.current || !controlsRef.current) return;
    controlsRef.current.target.lerp(desiredTarget.current, 0.08);
    camera.position.lerp(desiredPos.current, 0.08);
    controlsRef.current.update();
    if (
      controlsRef.current.target.distanceTo(desiredTarget.current) < 0.5 &&
      camera.position.distanceTo(desiredPos.current) < 0.5
    ) {
      hasTarget.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      minDistance={120}
      maxDistance={2400}
      maxPolarAngle={Math.PI / 2.05}
    />
  );
}

// ---- Página -----------------------------------------------------------------

function Visor3DPage() {
  const search = Route.useSearch();
  const fetchSat = useServerFn(getPublicSatellite);
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-satellite"],
    queryFn: () => fetchSat(),
    staleTime: 60_000,
  });

  const projects = useMemo<PublicSatProject[]>(() => data ?? [], [data]);
  const sites = useMemo(() => projectsToSites(projects), [projects]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null);
  const [selectedInsarId, setSelectedInsarId] = useState<string | null>(null);
  const [selectedHoleId, setSelectedHoleId] = useState<string | null>(null);
  const [auCutoff, setAuCutoff] = useState<number | null>(null);

  // Terreno DEM por sitio (pipeline por proyecto, cache indefinido)
  const fetchDem = useServerFn(getDemTile);
  const demQueries = useQueries({
    queries: projects.map((p) => ({
      queryKey: ["dem-tile", p.id],
      queryFn: () =>
        fetchDem({ data: { projectId: p.id, size: DEM_SIZE, extentMeters: DEM_EXTENT_M } }),
      staleTime: Infinity,
    })),
  });
  const demById = useMemo(() => {
    const m = new Map<string, DemTile>();
    projects.forEach((p, i) => {
      const d = demQueries[i]?.data;
      if (d) m.set(p.id, d);
    });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, ...demQueries.map((q) => q.data)]);

  // Sync from URL search params once data arrives (or when params change)
  useEffect(() => {
    if (!sites.length) return;
    if (search.project) setSelectedSiteId(search.project);
    if (search.anomaly) setSelectedAnomalyId(search.anomaly);
    if (search.insar) setSelectedInsarId(search.insar);
  }, [search.project, search.anomaly, search.insar, sites.length]);

  const selectedSite = sites.find((s) => s.project.id === selectedSiteId) ?? sites[0];
  const selectedAnomaly = selectedSite?.anomalies.find((a) => a.id === selectedAnomalyId) ?? null;
  const selectedInsar = selectedSite?.project.insar.find((i) => i.id === selectedInsarId) ?? null;
  const selectedHole = selectedSite?.holes.find((h) => h.id === selectedHoleId) ?? null;

  const totalAnomalies = projects.reduce((s, p) => s + p.anomalies.length, 0);
  const criticalCount = projects.reduce(
    (s, p) => s + p.anomalies.filter((a) => (a.severity ?? "").toLowerCase() === "critical").length,
    0,
  );
  const totalHoles = sites.reduce((s, site) => s + site.holes.length, 0);

  return (
    <main className="min-h-screen bg-surface">
      <MarketingHeader />

      <section className="border-b border-hairline bg-accent-brand-subtle">
        <div className="max-w-7xl mx-auto px-5 py-14">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-content-subtle hover:text-content mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Volver
          </Link>
          <Eyebrow className="mb-3 inline-flex items-center gap-1.5">
            <BoxIcon className="w-3.5 h-3.5" /> Visor 3D
          </Eyebrow>
          <h1 className="brand-display text-4xl md:text-5xl text-content mt-3 mb-4 max-w-3xl leading-tight">
            Explora el subsuelo minero en 3D
          </h1>
          <p className="text-content-subtle text-lg max-w-2xl">
            Escena interactiva con terreno, sondajes reales y anomalías satelitales de los proyectos
            monitoreados en la plataforma. Zoom con la rueda, rotación con clic izquierdo,
            panorámica con clic derecho y selección directa sobre cualquier elemento.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8 max-w-3xl">
            <StatBox icon={MapPin} label="Sitios" value={sites.length} />
            <StatBox icon={AlertTriangle} label="Anomalías" value={totalAnomalies} />
            <StatBox icon={AlertTriangle} label="Críticas" value={criticalCount} tone="danger" />
            <StatBox
              icon={Activity}
              label={totalHoles > 0 ? "Sondajes" : "Sondajes demo"}
              value={totalHoles > 0 ? totalHoles : sites.length * 3}
            />
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-5 py-10">
        <SectionHeading
          eyebrow="Escena 3D"
          title="Terreno, sondajes y anomalías en un solo canvas"
          description="Sitios, anomalías, sondajes e intervalos de litología provienen de la base de datos productiva de Geocapitals; los collares se posicionan por coordenadas UTM reales con trazas inclinadas por azimuth/dip y coloreadas por litología. El terreno usa el pipeline DEM por proyecto (relieve demostrativo hasta conectar Copernicus)."
          className="mb-6"
        />

        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
          <div className="relative rounded-xl border border-hairline bg-black overflow-hidden h-[70vh] min-h-[520px]">
            {isLoading && (
              <div className="absolute inset-0 z-10 grid place-items-center text-xs text-white/70">
                Cargando escena…
              </div>
            )}
            {error && (
              <div className="absolute inset-0 z-10 grid place-items-center text-xs text-red-400 p-6 text-center">
                {(error as Error).message}
              </div>
            )}
            {!isLoading && !error && sites.length > 0 && (
              <Canvas
                shadows
                camera={{ position: [600, 500, 700], fov: 45, near: 1, far: 8000 }}
                onPointerMissed={() => {
                  setSelectedSiteId(null);
                  setSelectedAnomalyId(null);
                  setSelectedInsarId(null);
                  setSelectedHoleId(null);
                }}
              >
                <color attach="background" args={["#0b0e12"]} />
                <fog attach="fog" args={["#0b0e12", 900, 3500]} />
                <ambientLight intensity={0.55} />
                <directionalLight position={[600, 900, 400]} intensity={1.1} castShadow />
                <hemisphereLight args={["#3a4a6a", "#1a1410", 0.35]} />

                <Suspense fallback={null}>
                  <GroundPlane />
                  {sites.map((site) => {
                    const dem = demById.get(site.project.id);
                    return dem ? (
                      <TerrainPatch
                        key={`dem-${site.project.id}`}
                        dem={dem}
                        position={[site.position[0], site.position[2]]}
                      />
                    ) : null;
                  })}
                  {sites.map((site) => (
                    <Site
                      key={site.project.id}
                      site={site}
                      selected={selectedSite?.project.id === site.project.id}
                      selectedAnomalyId={
                        selectedSite?.project.id === site.project.id ? selectedAnomalyId : null
                      }
                      selectedHoleId={
                        selectedSite?.project.id === site.project.id ? selectedHoleId : null
                      }
                      onSelectSite={() => {
                        setSelectedSiteId(site.project.id);
                        setSelectedAnomalyId(null);
                        setSelectedInsarId(null);
                        setSelectedHoleId(null);
                      }}
                      onSelectAnomaly={(id) => {
                        setSelectedSiteId(site.project.id);
                        setSelectedAnomalyId(id);
                        setSelectedInsarId(null);
                        setSelectedHoleId(null);
                      }}
                      onSelectHole={(id) => {
                        setSelectedSiteId(site.project.id);
                        setSelectedHoleId(id);
                        setSelectedAnomalyId(null);
                        setSelectedInsarId(null);
                      }}
                      auCutoff={auCutoff}
                    />
                  ))}
                </Suspense>

                <gridHelper args={[SCENE_HALF * 2.4, 24, "#233046", "#151b26"]} />

                <CameraFocus
                  target={
                    selectedAnomaly && selectedSite
                      ? [
                          selectedSite.position[0] + selectedAnomaly.offset[0],
                          selectedSite.position[1] + selectedAnomaly.offset[1],
                          selectedSite.position[2] + selectedAnomaly.offset[2],
                        ]
                      : selectedHole && selectedSite
                        ? [
                            selectedSite.position[0] + selectedHole.offset[0],
                            selectedSite.position[1] - selectedHole.depth / 2,
                            selectedSite.position[2] + selectedHole.offset[1],
                          ]
                        : selectedSite
                          ? selectedSite.position
                          : null
                  }
                  zoom={selectedAnomaly ? 260 : selectedHole ? 220 : 700}
                />
              </Canvas>
            )}

            <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-2 text-[11px] text-white/80">
              <ControlHint icon={ZoomIn} label="Rueda: zoom" />
              <ControlHint icon={RotateCw} label="Clic + arrastrar: rotar" />
              <ControlHint icon={MousePointer2} label="Clic en marcador o esfera: seleccionar" />
            </div>

            {selectedSite && demById.get(selectedSite.project.id) && (
              <div className="absolute top-3 right-3 z-10">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-mono backdrop-blur ${
                    demById.get(selectedSite.project.id)!.source === "copernicus"
                      ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-300"
                      : "bg-black/60 border-white/10 text-white/60"
                  }`}
                >
                  <Satellite className="w-3 h-3" />
                  {demById.get(selectedSite.project.id)!.source === "copernicus"
                    ? "Terreno real · Copernicus GLO-30 · escala 1:1"
                    : "Terreno demostrativo"}
                </span>
              </div>
            )}
          </div>

          <aside className="rounded-xl border border-hairline bg-surface p-5 space-y-4 h-fit">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-content-subtle mb-1">
                Sitio seleccionado
              </div>
              {selectedSite ? (
                <>
                  <div className="brand-display text-lg text-content leading-tight">
                    {selectedSite.project.name}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-xs text-content-subtle">
                      {selectedSite.project.region ?? "—"} · {selectedSite.project.country ?? "—"}
                    </span>
                    <VerificationBadge
                      level={projectVerification(selectedSite.project.id)}
                      compact
                    />
                  </div>
                </>
              ) : (
                <div className="text-sm text-content-subtle">
                  Haz clic en un marcador amarillo para seleccionar un sitio.
                </div>
              )}
            </div>

            {selectedSite && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label="Commodity" value={selectedSite.project.commodity ?? "—"} />
                  <MiniStat label="Anomalías" value={selectedSite.project.anomalies.length} />
                  <MiniStat label="Críticas" value={selectedSite.criticalCount} />
                  <MiniStat
                    label="Sondajes"
                    value={selectedSite.holes.length > 0 ? selectedSite.holes.length : "demo"}
                  />
                  <MiniStat
                    label="Velocidad InSAR"
                    value={
                      selectedSite.avgVelocity ? `${selectedSite.avgVelocity.toFixed(1)} mm/a` : "—"
                    }
                  />
                </div>

                <div>
                  <div className="text-[11px] uppercase tracking-wide text-content-subtle mb-2">
                    Anomalía seleccionada
                  </div>
                  {selectedAnomaly ? (
                    <div className="rounded-lg border border-hairline p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border"
                          style={{
                            color: selectedAnomaly.color,
                            borderColor: selectedAnomaly.color,
                          }}
                        >
                          {selectedAnomaly.severity}
                        </span>
                        <span className="text-[11px] text-content-subtle font-mono">
                          score {selectedAnomaly.score.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-content-subtle">
                        {selectedAnomaly.georeferenced
                          ? "📍 Posición georreferenciada"
                          : "Posición ilustrativa (sin geometría)"}
                      </div>
                      {selectedAnomaly.detected_at && (
                        <div className="text-[11px] text-content-subtle">
                          Detectada {new Date(selectedAnomaly.detected_at).toLocaleDateString()}
                        </div>
                      )}
                      {selectedAnomaly.notes && (
                        <div className="text-xs text-content">{selectedAnomaly.notes}</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-content-subtle">
                      Haz clic en una esfera de color para inspeccionarla.
                    </div>
                  )}
                </div>

                {selectedHole && (
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-content-subtle mb-2">
                      Sondaje seleccionado
                    </div>
                    <div className="rounded-lg border border-hairline p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-semibold text-content">
                          {selectedHole.hole_id}
                        </span>
                        <span className="text-[10px] font-mono text-content-subtle">
                          {selectedHole.depth_m.toFixed(0)} m · az {selectedHole.azimuth}° · dip{" "}
                          {selectedHole.dip}°
                        </span>
                      </div>
                      {selectedHole.intervals.length > 0 ? (
                        <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                          {selectedHole.intervals.map((iv, k) => (
                            <div key={k} className="flex items-center gap-2 text-[11px] font-mono">
                              <span
                                className="w-2.5 h-2.5 rounded-sm shrink-0"
                                style={{ background: lithoColor(iv.lithology) }}
                              />
                              <span className="text-content-subtle w-20 shrink-0">
                                {iv.from.toFixed(0)}–{iv.to.toFixed(0)} m
                              </span>
                              <span className="text-content truncate flex-1">
                                {iv.lithology ?? "s/litología"}
                              </span>
                              {iv.au_gpt != null && (
                                <span className="text-amber-600 shrink-0">
                                  {iv.au_gpt.toFixed(2)} g/t Au
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-content-subtle">
                          Sin intervalos logueados para este pozo.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedInsar && (
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-content-subtle mb-2">
                      InSAR seleccionado
                    </div>
                    <div className="rounded-lg border border-accent-brand/60 bg-accent-brand-subtle/40 p-3 space-y-1">
                      <div className="text-xs font-medium text-content">
                        {selectedInsar.asset_name ?? "Adquisición InSAR"}
                      </div>
                      <div className="text-[11px] text-content-subtle">
                        {selectedInsar.source ?? "—"} ·{" "}
                        {selectedInsar.velocity_mm_year != null
                          ? `${Number(selectedInsar.velocity_mm_year).toFixed(1)} mm/a`
                          : "—"}
                      </div>
                      {selectedInsar.cumulative_displacement_mm != null && (
                        <div className="text-[11px] text-content-subtle">
                          Desp. acumulado{" "}
                          {Number(selectedInsar.cumulative_displacement_mm).toFixed(1)} mm
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <Link
                    to="/satelital"
                    search={{ project: selectedSite.project.id }}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-accent-brand hover:underline"
                  >
                    <Satellite className="w-3 h-3" /> Ver datos satelitales del sitio
                  </Link>
                  {selectedSite.project.listing_id && (
                    <Link
                      to="/proyectos/$listingId"
                      params={{ listingId: selectedSite.project.listing_id }}
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-accent-brand hover:underline"
                    >
                      <ArrowRight className="w-3 h-3" /> Ficha de inversión del proyecto
                    </Link>
                  )}
                </div>
              </>
            )}

            <div className="pt-4 border-t border-hairline">
              <div className="text-[11px] uppercase tracking-wide text-content-subtle mb-2">
                Ley de corte Au (resalta tramos)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "Todos", v: null },
                  { label: "≥0.5 g/t", v: 0.5 },
                  { label: "≥1.0 g/t", v: 1.0 },
                  { label: "≥2.0 g/t", v: 2.0 },
                ].map(({ label, v }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setAuCutoff(v)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-mono border transition ${
                      auCutoff === v
                        ? "bg-accent-brand text-white border-accent-brand"
                        : "border-hairline text-content-subtle hover:border-accent-brand hover:text-accent-brand"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-hairline">
              <div className="text-[11px] uppercase tracking-wide text-content-subtle mb-2">
                Otros sitios
              </div>
              <div className="space-y-1.5">
                {sites.map((s) => (
                  <button
                    key={s.project.id}
                    onClick={() => {
                      setSelectedSiteId(s.project.id);
                      setSelectedAnomalyId(null);
                    }}
                    className={`w-full text-left text-xs px-2.5 py-2 rounded-md border transition ${
                      selectedSite?.project.id === s.project.id
                        ? "border-accent-brand bg-accent-brand-subtle text-content"
                        : "border-hairline hover:bg-accent-brand-subtle/50 text-content-subtle"
                    }`}
                  >
                    <div className="font-medium text-content truncate">{s.project.name}</div>
                    <div className="text-[10px] text-content-subtle">
                      {s.project.anomalies.length} anomalías · {s.criticalCount} críticas
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="border-t border-hairline bg-accent-brand-subtle">
        <div className="max-w-4xl mx-auto px-5 py-14 text-center">
          <h2 className="brand-display text-3xl text-content mb-3">
            Este visor sobre tus datos reales
          </h2>
          <p className="text-content-subtle mb-6 max-w-2xl mx-auto">
            Sube tus sondajes, modelos de bloques y capas Sentinel y actívalo con tu equipo en
            minutos.
          </p>
          <Link
            to="/contacto"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent-brand text-white text-sm font-medium hover:opacity-90"
          >
            Solicitar acceso <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof MapPin;
  label: string;
  value: number;
  tone?: "danger";
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <Icon
        className={`w-4 h-4 mb-2 ${tone === "danger" ? "text-red-500" : "text-accent-brand"}`}
        strokeWidth={1.75}
      />
      <div className="font-display text-2xl text-content">{value}</div>
      <div className="text-xs text-content-subtle mt-0.5">{label}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-hairline p-2">
      <div className="text-[10px] uppercase tracking-wide text-content-subtle">{label}</div>
      <div className="text-sm font-medium text-content mt-0.5">{value}</div>
    </div>
  );
}

function ControlHint({ icon: Icon, label }: { icon: typeof MapPin; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 border border-white/10 px-2.5 py-1 backdrop-blur">
      <Icon className="w-3 h-3" strokeWidth={2} /> {label}
    </span>
  );
}
