import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import { Eyebrow, SectionHeading } from "@/components/brand";
import { getPublicSatellite, type PublicSatProject } from "@/lib/publicSatellite.functions";

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
          "Visor 3D interactivo con terreno, sondajes y anomalías satelitales reales sobre proyectos mineros demo en Chile. Zoom, rotación y selección directa.",
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

function Visor3DError({ error }: { error: Error }) {
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
    const y = terrainHeight(x, z);

    const anomalies = project.anomalies.slice(0, 40).map((a, idx) => {
      const angle = (idx / Math.max(project.anomalies.length, 1)) * Math.PI * 2;
      const radius = 40 + ((a.score ?? 0.3) * 90 + (idx % 5) * 12);
      const ox = Math.cos(angle) * radius;
      const oz = Math.sin(angle) * radius;
      const sev = (a.severity ?? "low").toLowerCase();
      return {
        id: a.id,
        offset: [ox, 25 + (a.score ?? 0.3) * 90, oz] as [number, number, number],
        score: a.score ?? 0,
        severity: sev,
        color: SEV_COLOR[sev] ?? "#94a3b8",
        notes: a.notes,
        detected_at: a.detected_at,
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
      criticalCount,
      avgVelocity,
    };
  });
}

function terrainHeight(x: number, z: number) {
  return (
    Math.sin(x / 220) * 55 +
    Math.cos(z / 260) * 65 +
    Math.sin((x + z) / 180) * 30
  );
}

// ---- Componentes 3D ---------------------------------------------------------

function Terrain() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(SCENE_HALF * 2.4, SCENE_HALF * 2.4, 80, 80);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setZ(i, terrainHeight(x, y));
    }
    g.computeVertexNormals();
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial
        color="#3a2f24"
        roughness={0.95}
        metalness={0.05}
        wireframe={false}
      />
    </mesh>
  );
}

function DrillHole({ position }: { position: [number, number, number] }) {
  const depth = 250;
  return (
    <group position={position}>
      <mesh position={[0, -depth / 2 + 4, 0]}>
        <cylinderGeometry args={[3, 3, depth, 12]} />
        <meshStandardMaterial color="#c1a266" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, 12, 0]}>
        <coneGeometry args={[10, 24, 16]} />
        <meshStandardMaterial color="#f6c453" emissive="#3a2a10" />
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
}: {
  site: SiteData;
  selected: boolean;
  onSelectSite: () => void;
  onSelectAnomaly: (id: string) => void;
  selectedAnomalyId: string | null;
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
      <Html
        position={[0, 140, 0]}
        center
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div className="whitespace-nowrap rounded-full border border-white/20 bg-black/70 px-3 py-1 text-[11px] font-medium text-white backdrop-blur">
          {site.project.name}
        </div>
      </Html>

      {/* Synthetic drill holes around the site */}
      <DrillHole position={[45, 0, 30]} />
      <DrillHole position={[-40, 0, 50]} />
      <DrillHole position={[10, 0, -55]} />

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

// ---- Página -----------------------------------------------------------------

function Visor3DPage() {
  const fetchSat = useServerFn(getPublicSatellite);
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-satellite"],
    queryFn: () => fetchSat(),
    staleTime: 60_000,
  });

  const projects: PublicSatProject[] = data ?? [];
  const sites = useMemo(() => projectsToSites(projects), [projects]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null);

  const selectedSite = sites.find((s) => s.project.id === selectedSiteId) ?? sites[0];
  const selectedAnomaly = selectedSite?.anomalies.find((a) => a.id === selectedAnomalyId) ?? null;

  const totalAnomalies = projects.reduce((s, p) => s + p.anomalies.length, 0);
  const criticalCount = projects.reduce(
    (s, p) => s + p.anomalies.filter((a) => (a.severity ?? "").toLowerCase() === "critical").length,
    0,
  );

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
            Escena interactiva con terreno, sondajes y anomalías satelitales reales de tres
            proyectos demo en Chile. Zoom con la rueda, rotación con clic izquierdo, panorámica
            con clic derecho y selección directa sobre cualquier elemento.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8 max-w-3xl">
            <StatBox icon={MapPin} label="Sitios" value={sites.length} />
            <StatBox icon={AlertTriangle} label="Anomalías" value={totalAnomalies} />
            <StatBox icon={AlertTriangle} label="Críticas" value={criticalCount} tone="danger" />
            <StatBox icon={Activity} label="Sondajes demo" value={sites.length * 3} />
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-5 py-10">
        <SectionHeading
          eyebrow="Escena 3D"
          title="Terreno, sondajes y anomalías en un solo canvas"
          description="Los sitios y sus anomalías provienen de la base de datos productiva de Geocapitals. La geometría de terreno y sondajes es demostrativa."
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
                }}
              >
                <color attach="background" args={["#0b0e12"]} />
                <fog attach="fog" args={["#0b0e12", 900, 3500]} />
                <ambientLight intensity={0.55} />
                <directionalLight position={[600, 900, 400]} intensity={1.1} castShadow />
                <hemisphereLight args={["#3a4a6a", "#1a1410", 0.35]} />

                <Suspense fallback={null}>
                  <Terrain />
                  {sites.map((site) => (
                    <Site
                      key={site.project.id}
                      site={site}
                      selected={selectedSite?.project.id === site.project.id}
                      selectedAnomalyId={
                        selectedSite?.project.id === site.project.id ? selectedAnomalyId : null
                      }
                      onSelectSite={() => {
                        setSelectedSiteId(site.project.id);
                        setSelectedAnomalyId(null);
                      }}
                      onSelectAnomaly={(id) => {
                        setSelectedSiteId(site.project.id);
                        setSelectedAnomalyId(id);
                      }}
                    />
                  ))}
                </Suspense>

                <gridHelper args={[SCENE_HALF * 2.4, 24, "#233046", "#151b26"]} />

                <OrbitControls
                  enableDamping
                  dampingFactor={0.08}
                  minDistance={120}
                  maxDistance={2400}
                  maxPolarAngle={Math.PI / 2.05}
                />
              </Canvas>
            )}

            <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-2 text-[11px] text-white/80">
              <ControlHint icon={ZoomIn} label="Rueda: zoom" />
              <ControlHint icon={RotateCw} label="Clic + arrastrar: rotar" />
              <ControlHint icon={MousePointer2} label="Clic en marcador o esfera: seleccionar" />
            </div>
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
                  <div className="text-xs text-content-subtle mt-1">
                    {selectedSite.project.region ?? "—"} · {selectedSite.project.country ?? "—"}
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
                  <MiniStat
                    label="Commodity"
                    value={selectedSite.project.commodity ?? "—"}
                  />
                  <MiniStat
                    label="Anomalías"
                    value={selectedSite.project.anomalies.length}
                  />
                  <MiniStat label="Críticas" value={selectedSite.criticalCount} />
                  <MiniStat
                    label="Velocidad InSAR"
                    value={
                      selectedSite.avgVelocity
                        ? `${selectedSite.avgVelocity.toFixed(1)} mm/a`
                        : "—"
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
              </>
            )}

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

function ControlHint({
  icon: Icon,
  label,
}: {
  icon: typeof MapPin;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 border border-white/10 px-2.5 py-1 backdrop-blur">
      <Icon className="w-3 h-3" strokeWidth={2} /> {label}
    </span>
  );
}
