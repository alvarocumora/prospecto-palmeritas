/** Published Cholqui evidence on real terrain; surface signals never become subsurface bodies. */
import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as THREE from "three";
import { Loader2, Maximize } from "lucide-react";
import { getDemTile, type DemTile } from "@/engine3d/terrain/dem.functions";
import {
  projectTerrainPoint,
  proposedTraceEnd,
  terrainFootprintPaths,
} from "@/lib/geospatial/terrainCoordinates";
import { useGeoLayerPreferences } from "@/hooks/useGeoLayerPreferences";
import { PublicGeoLayerControls } from "@/components/geo/PublicGeoLayerControls";
import type {
  PublicGeoFeature,
  PublicGeoLayerManifestEntry,
} from "@/lib/geospatial/publicGeoContract";
import { buildCholquiPublicGeoBundle } from "../cholquiPublicGeo";
import { CHOLQUI, CHOLQUI_POINTS, LAS_MINITAS } from "../data/cholqui";
import {
  CHOLQUI_COORDINATE_NOTICE,
  CHOLQUI_INTERPOLATION_NOTICE,
  CHOLQUI_SPECTRAL_COLORS,
} from "../cholquiGeoPolicy";

const PROJECT_ID = "e5360f13-1647-4e44-bb13-c0614e6f39fe";
const EXTENT_M = 20000;
const DEM_SIZE = 257;
const SCALE = 0.02;
type ScenePoint = [number, number, number];
type Hover = { position: ScenePoint; title: string; lines: string[] } | null;

function scenePoint(point: ScenePoint, lift = 2): ScenePoint {
  return [point[0] * SCALE, (point[1] + lift) * SCALE, point[2] * SCALE];
}

function Terrain({ tile, opacity }: { tile: DemTile; opacity: number }) {
  const geometry = useMemo(() => {
    const side = tile.extentMeters * SCALE;
    const geo = new THREE.PlaneGeometry(side, side, tile.size - 1, tile.size - 1);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const low = new THREE.Color("#52634b"),
      high = new THREE.Color("#d5c4a5");
    const range = Math.max(1, tile.maxH - tile.minH);
    const color = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const h = tile.heights[i];
      pos.setZ(i, h * SCALE);
      color.copy(low).lerp(high, (h - tile.minH) / range);
      color.toArray(colors, i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [tile]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} rotation-x={-Math.PI / 2}>
      <meshStandardMaterial vertexColors roughness={0.95} transparent opacity={opacity} />
    </mesh>
  );
}

function featureColor(meta: PublicGeoLayerManifestEntry, p: Record<string, unknown>): string {
  if (meta.domain === "remote_sensing")
    return CHOLQUI_SPECTRAL_COLORS[String(p.index_code)] ?? "#f97316";
  if (meta.id === "territory.cadastre") return "#eab308";
  if (meta.id === "territory.pending_pedimentos") return "#a78bfa";
  if (meta.id === "territory.proposed_pedimentos") return "#fb923c";
  if (meta.domain === "sampling") return "#22c55e";
  if (meta.domain === "drilling") return "#4d7cff";
  if (meta.domain === "geology") return "#38bdf8";
  return "#cbd5e1";
}

function details(
  meta: PublicGeoLayerManifestEntry,
  feature: PublicGeoFeature,
): { title: string; lines: string[] } {
  const p = feature.properties;
  const fields: Array<[string, string]> = [
    ["index_code", "Índice"],
    ["z_score", "z-score (adimensional)"],
    ["score", "Score (0–1)"],
    ["cu_total_pct", "Cu total (%)"],
    ["cu_soluble_pct", "Cu soluble (%)"],
    ["au_gpt", "Au (g/t)"],
    ["ag_gpt", "Ag (g/t)"],
    ["lab", "Laboratorio"],
    ["report_id", "Informe"],
    ["report_date", "Fecha del informe"],
    ["azimuth_deg", "Azimut (°)"],
    ["dip_deg", "Inclinación (°)"],
    ["depth_m", "Profundidad propuesta (m)"],
    ["strikeDeg", "Rumbo (°)"],
    ["dipText", "Manteo"],
    ["titular", "Titular"],
    ["situacion", "Situación"],
  ];
  return {
    title: String(p.code ?? p.nombre ?? p.name ?? feature.id ?? meta.label),
    lines: [
      meta.label + " · " + meta.evidence,
      ...fields.flatMap(([key, label]) => (p[key] != null ? [label + ": " + String(p[key])] : [])),
      ...(p.dentro_concesion != null
        ? [p.dentro_concesion ? "Dentro de tenencia reportada" : "Fuera de tenencia reportada"]
        : []),
      ...(meta.domain === "remote_sensing"
        ? ["Indicio superficial; requiere verificación de terreno."]
        : []),
      ...(meta.domain === "drilling" ? ["Propuesta conceptual; no perforado."] : []),
      ...(meta.domain === "sampling"
        ? ["Certificación del ensaye; posición histórica pendiente de QA espacial."]
        : []),
      ...(meta.caution ? [meta.caution] : []),
    ],
  };
}

function EvidenceFeature({
  feature,
  meta,
  tile,
  opacity,
  onHover,
}: {
  feature: PublicGeoFeature;
  meta: PublicGeoLayerManifestEntry;
  tile: DemTile;
  opacity: number;
  onHover: (hover: Hover) => void;
}) {
  const paths = useMemo(
    () =>
      terrainFootprintPaths(feature.geometry, tile).map((path) =>
        path.map((point) => scenePoint(point)),
      ),
    [feature.geometry, tile],
  );
  const color = featureColor(meta, feature.properties);
  const info = details(meta, feature);
  const enter = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onHover({ ...info, position: [event.point.x, event.point.y, event.point.z] });
  };
  const geometry = feature.geometry;
  if (!geometry) return null;
  if (geometry.type === "Point") {
    const point = projectTerrainPoint(tile, geometry.coordinates[0], geometry.coordinates[1]);
    if (!point) return null;
    const p = feature.properties;
    // Only an explicit planned drill trajectory receives a depth.
    const hasPlan = ["azimuth_deg", "dip_deg", "depth_m"].every(
      (key) => typeof p[key] === "number" && Number.isFinite(p[key]),
    );
    const end =
      meta.id === "drilling.proposed" && hasPlan
        ? proposedTraceEnd(point, p.azimuth_deg as number, p.dip_deg as number, p.depth_m as number)
        : null;
    const position = scenePoint(point, 3);
    return (
      <group onPointerOver={enter} onPointerOut={() => onHover(null)}>
        {end && (
          <Line
            points={[scenePoint(point, 0), scenePoint(end, 0)]}
            color={color}
            lineWidth={2}
            transparent
            opacity={opacity}
            depthTest={false}
          />
        )}
        <mesh position={position}>
          <sphereGeometry args={[meta.domain === "drilling" ? 1.1 : 0.8, 12, 12]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} />
        </mesh>
      </group>
    );
  }
  return (
    <group onPointerOver={enter} onPointerOut={() => onHover(null)}>
      {paths.map((points, index) => (
        <Line
          key={index}
          points={points}
          color={color}
          lineWidth={meta.domain === "remote_sensing" ? 2.5 : 1.5}
          transparent
          opacity={opacity}
        />
      ))}
    </group>
  );
}

function CameraView({ view, reset }: { view: "perspective" | "plan"; reset: number }) {
  const { camera } = useThree();
  useEffect(() => {
    const side = EXTENT_M * SCALE;
    if (view === "plan") camera.position.set(0, side * 1.25, 0.1);
    else camera.position.set(side * 0.7, side * 0.6, side * 0.75);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, reset, view]);
  return null;
}

export function CholquiTerrain3D() {
  const demFn = useServerFn(getDemTile);
  const bundle = useMemo(() => buildCholquiPublicGeoBundle(), []);
  const initial = useMemo(
    () =>
      Object.fromEntries(
        bundle.manifest.layers.map((meta) => [
          meta.id,
          !["territory.mojones", "geology.metallogenic_belts"].includes(meta.id),
        ]),
      ),
    [bundle],
  );
  const { visible, setVisible, opacity, setOpacity } = useGeoLayerPreferences("cholqui", initial);
  const [hover, setHover] = useState<Hover>(null);
  const [primaryOnly, setPrimaryOnly] = useState(false);
  const [view, setView] = useState<"perspective" | "plan">("perspective");
  const [reset, setReset] = useState(0);
  const [terrainOpacity, setTerrainOpacity] = useState(0.9);
  const available = useMemo(() => new Set(bundle.manifest.layers.map((meta) => meta.id)), [bundle]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        bundle.manifest.layers.map((meta) => [
          meta.id,
          bundle.layers[meta.id]?.features.length ?? 0,
        ]),
      ),
    [bundle],
  );
  const active = bundle.manifest.layers.filter(
    (meta) =>
      visible[meta.id] &&
      (!primaryOnly || ["OFICIAL", "CERTIFICADO", "MEDIDO"].includes(meta.evidence)),
  );
  const certifiedCodes = useMemo(
    () => new Set(bundle.layers["sampling.assays"]?.features.map((f) => String(f.id))),
    [bundle],
  );
  const observations = CHOLQUI_POINTS.filter((p) => !certifiedCodes.has(p.code));
  const dem = useQuery({
    queryKey: ["cholqui-dem-mosaic-v2", DEM_SIZE, EXTENT_M, CHOLQUI.center.lat, CHOLQUI.center.lng],
    queryFn: () =>
      demFn({
        data: {
          projectId: PROJECT_ID,
          size: DEM_SIZE,
          extentMeters: EXTENT_M,
          centerLat: CHOLQUI.center.lat,
          centerLng: CHOLQUI.center.lng,
        },
      }),
    staleTime: Infinity,
  });
  const tile = dem.data?.source === "copernicus" ? dem.data : null;
  const certifiedVisible = visible["sampling.assays"];
  const neighbour = tile ? projectTerrainPoint(tile, LAS_MINITAS.lng, LAS_MINITAS.lat) : null;
  useEffect(() => {
    setHover(null);
  }, [visible, opacity, primaryOnly]);
  const terrainFailure = dem.isError || (!dem.isPending && !tile);

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-content">Cholqui · terreno y evidencia 3D</div>
          <div className="text-[11px] text-content-subtle">
            Huellas originales, catastro, estructuras y sondajes propuestos · {EXTENT_M / 1000} ×{" "}
            {EXTENT_M / 1000} km
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          {(["perspective", "plan"] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => setView(key)}
              className={`rounded border border-hairline px-2 py-1 ${view === key ? "bg-accent-brand text-white" : "hover:bg-surface-2"}`}
            >
              {key === "plan" ? "Planta" : "Perspectiva"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setReset((value) => value + 1)}
            className="inline-flex items-center gap-1 rounded border border-hairline px-2 py-1 hover:bg-surface-2"
          >
            <Maximize className="h-3 w-3" /> Reencuadrar
          </button>
        </div>
      </div>
      <div className="relative h-[620px] bg-[#11151c]">
        {dem.isPending && (
          <div
            role="status"
            className="grid h-full place-content-center justify-items-center gap-3 text-white/70"
          >
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-xs">Cargando mosaico de terreno real</span>
          </div>
        )}
        {terrainFailure && (
          <div
            role="alert"
            className="grid h-full place-content-center justify-items-center gap-3 px-8 text-center text-white/80"
          >
            <p>No se pudo obtener el terreno real completo de Cholqui.</p>
            <p className="max-w-md text-xs text-white/60">
              La vista 2D mantiene la evidencia disponible. El relieve requiere todos los archivos
              DEM del área.
            </p>
            <button
              type="button"
              onClick={() => void dem.refetch()}
              className="rounded border border-white/30 px-3 py-2 text-xs"
            >
              Reintentar terreno
            </button>
          </div>
        )}
        {tile && (
          <Canvas camera={{ position: [280, 240, 300], fov: 48 }} dpr={[1, 1.5]}>
            <color attach="background" args={["#11151c"]} />
            <ambientLight intensity={0.7} />
            <directionalLight position={[120, 180, 100]} intensity={1.4} />
            <Suspense fallback={null}>
              <Terrain tile={tile} opacity={terrainOpacity} />
              {active.map((meta) =>
                (bundle.layers[meta.id]?.features ?? []).map((feature, index) => (
                  <EvidenceFeature
                    key={meta.id + ":" + (feature.id ?? index)}
                    feature={feature}
                    meta={meta}
                    tile={tile}
                    opacity={opacity[meta.id] ?? 1}
                    onHover={setHover}
                  />
                )),
              )}
              {certifiedVisible &&
                !primaryOnly &&
                observations.map((p) => {
                  const projected = projectTerrainPoint(tile, p.lng, p.lat);
                  if (!projected) return null;
                  const position = scenePoint(projected, 3);
                  return (
                    <mesh
                      key={p.code}
                      position={position}
                      onPointerOver={(event) => {
                        event.stopPropagation();
                        setHover({
                          position,
                          title: p.code,
                          lines: [
                            p.name,
                            "Observación documental · sin ensaye certificado vinculado",
                          ],
                        });
                      }}
                      onPointerOut={() => setHover(null)}
                    >
                      <sphereGeometry args={[0.7, 12, 12]} />
                      <meshBasicMaterial
                        color="#94a3b8"
                        transparent
                        opacity={opacity["sampling.assays"] ?? 1}
                      />
                    </mesh>
                  );
                })}
              {visible["geology.known_deposits"] && !primaryOnly && neighbour && (
                <mesh
                  position={scenePoint(neighbour, 3)}
                  onPointerOver={(event) => {
                    event.stopPropagation();
                    setHover({
                      position: scenePoint(neighbour, 3),
                      title: LAS_MINITAS.name,
                      lines: ["Faena vecina de un tercero; no es producción de Cholqui."],
                    });
                  }}
                  onPointerOut={() => setHover(null)}
                >
                  <sphereGeometry args={[1, 12, 12]} />
                  <meshBasicMaterial color="#ef4444" />
                </mesh>
              )}
              {hover && (
                <Html
                  position={[hover.position[0], hover.position[1] + 3, hover.position[2]]}
                  center
                >
                  <div className="pointer-events-none max-h-60 w-64 overflow-auto rounded border border-hairline bg-surface/95 p-3 text-[11px] shadow-lg">
                    <div className="mb-1 font-semibold text-content">{hover.title}</div>
                    {hover.lines.map((line, index) => (
                      <p key={index} className="text-content-subtle">
                        {line}
                      </p>
                    ))}
                  </div>
                </Html>
              )}
              <CameraView view={view} reset={reset} />
              <OrbitControls
                makeDefault
                target={[0, 0, 0]}
                minDistance={20}
                maxDistance={1200}
                maxPolarAngle={Math.PI / 1.7}
              />
            </Suspense>
          </Canvas>
        )}
        {tile && (
          <div className="absolute left-3 top-3 z-20">
            <PublicGeoLayerControls
              manifest={bundle.manifest}
              available={available}
              visible={new Set(Object.keys(visible).filter((id) => visible[id]))}
              certificationMode={primaryOnly}
              onToggleCertification={() => setPrimaryOnly((value) => !value)}
              onToggleLayer={(id) => setVisible((state) => ({ ...state, [id]: !state[id] }))}
              opacity={opacity}
              onOpacity={(id, value) => setOpacity((state) => ({ ...state, [id]: value }))}
              counts={counts}
              compact
            />
          </div>
        )}
        {tile && (
          <div className="absolute bottom-3 right-3 max-w-[calc(100%_-_1.5rem)] rounded border border-white/15 bg-black/70 px-3 py-2 text-[10px] text-white/80">
            {visible["remote_sensing.sentinel2_alteration"] && !primaryOnly && (
              <div className="mb-1">Huellas espectrales · DERIVADO</div>
            )}
            {visible["remote_sensing.sentinel2_alteration"] &&
              !primaryOnly &&
              Object.entries(CHOLQUI_SPECTRAL_COLORS)
                .filter(([code]) => code !== "STRUCTURAL_LINEAMENTS")
                .map(([code, color]) => (
                  <span key={code} className="mr-3 inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                    {code === "CLAY_MINERALS"
                      ? "Al-OH / arcillas"
                      : code === "IRON_OXIDE"
                        ? "Óxidos de hierro"
                        : "Alteración hidrotermal"}
                  </span>
                ))}
            <label className="mt-2 flex items-center gap-2">
              Opacidad del terreno
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={terrainOpacity}
                onChange={(event) => setTerrainOpacity(Number(event.target.value))}
                className="w-20"
              />
            </label>
          </div>
        )}
      </div>
      <div className="space-y-1 border-t border-hairline px-4 py-3 text-[11px] text-content-subtle">
        <p>
          Fuente: Copernicus DEM GLO-30 (~30 m). Grilla visual:{" "}
          {(EXTENT_M / (DEM_SIZE - 1)).toFixed(1)} m. Cotas relativas al centro; exageración
          vertical 1×. Capas recortadas al área del DEM.
        </p>
        <p>
          {CHOLQUI_COORDINATE_NOTICE} Se conservan {observations.length} observaciones sin ensaye
          certificado vinculado, en gris.
        </p>
        <p>{CHOLQUI_INTERPOLATION_NOTICE}</p>
        <p>
          Los marcadores son símbolos. Las trazas son propuestas conceptuales; no representan
          sondajes ejecutados ni volúmenes de recursos.
        </p>
      </div>
    </div>
  );
}
