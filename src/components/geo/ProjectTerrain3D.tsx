import { featureEvidence, primaryFeatureEvidence } from "@/lib/geospatial/featureEvidence";
import { geoColors } from "@/lib/geospatial/visualTokens";
/** Shared project terrain engine. Original footprints and documentary provenance are preserved. */
import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as THREE from "three";
import { Loader2, Maximize } from "lucide-react";
import { useProjectGeophysicsData } from "@/hooks/useProjectGeophysicsData";
import { cholquiFieldGeophysics, stationsForCampaign } from "@/lib/cholqui/geophysicsTerrain";
import { buildFieldGeophysicsSurface } from "@/lib/geoscience/geophysicsSurface";
import type { GeophysicsSurfaceMetric } from "@/lib/geoscience/geophysicsSurface";
import { CholquiGeophysicsTerrainLayer } from "@/features/franco/components/CholquiGeophysicsTerrainLayer";
import type { ReactNode } from "react";
import type { FeatureCollection } from "geojson";
import { buildPublicGeoManifest, type PublicGeoBundle } from "@/lib/geospatial/publicGeoContract";
import { geophysicsSurfaceColor } from "@/components/map/geophysicsLayers";
import { getDemTile } from "@/engine3d/terrain/dem.functions";
import { getSentinelRgbDrape } from "@/lib/sentinelProcessing.functions";
import { loadSentinelDrapeTexture } from "@/engine3d/terrain/sentinelDrape";
import type { DemTile } from "@/engine3d/terrain/dem.functions";
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
const SPECTRAL_COLORS: Record<string, string> = {
  CLAY_MINERALS: geoColors.clay,
  HYDROTHERMAL_ALTERATION: geoColors.hydrothermal,
  IRON_OXIDE: geoColors.ironOxide,
  STRUCTURAL_LINEAMENTS: geoColors.lineament,
};
export type ProjectTerrain3DProps = {
  slug: string;
  projectId?: string;
  selectedFeatureId?: string;
  center: { lat: number; lng: number };
  extentMeters?: number;
  demSize?: 129 | 257;
  concessions?: FeatureCollection | null;
  anomalies?: FeatureCollection | null;
  drillGrid?: FeatureCollection | null;
  height?: number;
  notice?: string;
  evidenceBundle?: PublicGeoBundle;
  observationPoints?: Array<{ code: string; name: string; lat: number; lng: number }>;
  neighbourDeposit?: { name: string; lat: number; lng: number };
  coordinateNotice?: string;
  interpolationNotice?: string;
  documentMenu?: ReactNode;
};

function projectBundle(props: ProjectTerrain3DProps): PublicGeoBundle {
  const collections = {
    "territory.cadastre": props.concessions,
    "remote_sensing.sentinel2_alteration": props.anomalies,
    "drilling.proposed": props.drillGrid,
  } as const;
  const ids = Object.keys(collections).filter(
    (key) => collections[key as keyof typeof collections]?.features.length,
  ) as Array<keyof typeof collections>;
  return {
    manifest: buildPublicGeoManifest(
      {
        id: props.projectId ?? "00000000-0000-0000-0000-000000000000",
        name: props.slug,
        center_lat: props.center.lat,
        center_lng: props.center.lng,
      },
      ids,
    ),
    center: [props.center.lng, props.center.lat],
    bbox: null,
    layers: Object.fromEntries(
      ids.map((id) => [
        id,
        {
          type: "FeatureCollection",
          features: collections[id]!.features.map((feature) => ({
            ...feature,
            properties: feature.properties ?? {},
          })),
        },
      ]),
    ),
  };
}

const METRICS: Array<{ id: GeophysicsSurfaceMetric; layer: string; label: string }> = [
  { id: "mag_residual_nt", layer: "geophysics.mag_idw", label: "TMI menos mediana · nT" },
  {
    id: "ip_chargeability_mvv",
    layer: "geophysics.ip_chargeability_idw",
    label: "Cargabilidad · mV/V",
  },
  {
    id: "ip_resistivity_ohmm",
    layer: "geophysics.ip_resistivity_idw",
    label: "Resistividad · Ω·m",
  },
];
const SCALE = 0.02;
type ScenePoint = [number, number, number];
type Hover = { position: ScenePoint; title: string; lines: string[] } | null;

function scenePoint(point: ScenePoint, lift = 2): ScenePoint {
  return [point[0] * SCALE, (point[1] + lift) * SCALE, point[2] * SCALE];
}

function Terrain({
  tile,
  opacity,
  texture,
  drape,
}: {
  tile: DemTile;
  opacity: number;
  texture: THREE.Texture | null;
  drape: boolean;
}) {
  const geometry = useMemo(() => {
    const side = tile.extentMeters * SCALE;
    const geo = new THREE.PlaneGeometry(side, side, tile.size - 1, tile.size - 1);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const low = new THREE.Color(geoColors.terrainEvidenceLow),
      high = new THREE.Color(geoColors.terrainEvidenceHigh);
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
      <meshStandardMaterial
        map={drape ? texture : null}
        vertexColors={!drape}
        roughness={0.95}
        metalness={0}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}

function featureColor(meta: PublicGeoLayerManifestEntry, p: Record<string, unknown>): string {
  if (meta.domain === "remote_sensing")
    return SPECTRAL_COLORS[String(p.index_code)] ?? geoColors.ironOxide;
  if (meta.id === "territory.cadastre")
    return p.es_tenencia_proyecto !== true
      ? geoColors.tenureNeighbor
      : p.fase === "arranque"
        ? geoColors.tenureOwn
        : geoColors.tenureAnnex;
  if (meta.id === "territory.pending_pedimentos") return geoColors.pendingEvidence;
  if (meta.id === "territory.proposed_pedimentos") return geoColors.proposedEvidence;
  if (meta.domain === "sampling") return geoColors.sample;
  if (meta.domain === "drilling") return geoColors.drillEvidence;
  if (meta.domain === "geology") return geoColors.geology;
  return geoColors.fallback;
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
    ["ndvi", "NDVI · adimensional"],
    ["ndmi", "NDMI · adimensional"],
    ["ironOxideRatio", "B04/B02 · razón adimensional"],
    ["swirContrast", "B11/B12 · razón adimensional"],
    ["cu_total_pct", "Cu total (%)"],
    ["cu_soluble_pct", "Cu soluble (%)"],
    ["au_gpt", "Au (g/t)"],
    ["ag_gpt", "Ag (g/t)"],
    ["lab", "Laboratorio"],
    ["certificate", "Certificado"],
    ["record_status", "Estado de revisión"],
    ["mag_nt", "Magnetometría (nT)"],
    ["source", "Fuente"],
    ["report_id", "Informe"],
    ["report_date", "Fecha del informe"],
    ["azimuth_deg", "Azimut (°)"],
    ["dip_deg", "Inclinación (°)"],
    ["depth_m", "Profundidad propuesta (m)"],
    ["strikeDeg", "Rumbo (°)"],
    ["dipText", "Manteo"],
    ["titular", "Titular"],
    ["situacion", "Situación"],
    ["rol", "Rol SERNAGEOMIN"],
    ["fase", "Fase de integración"],
    ["grupo", "Grupo catastral"],
    ["hectareas", "Superficie (ha)"],
    ["tenencia_procedencia", "Procedencia de la asociación"],
    ["tenencia_asociacion", "Criterio de asociación"],
    ["contrato_verificado", "Contrato verificado"],
  ];
  return {
    title: String(
      (meta.id === "territory.cadastre" ? (p.nombre ?? p.name) : undefined) ??
        p.code ??
        p.sample_code ??
        p.nombre ??
        p.name ??
        feature.id ??
        meta.label,
    ),
    lines: [
      meta.label + " · " + featureEvidence(meta, p),
      ...fields.flatMap(([key, label]) => (p[key] != null ? [label + ": " + String(p[key])] : [])),
      ...(p.dentro_concesion != null
        ? [p.dentro_concesion ? "Dentro de tenencia reportada" : "Fuera de tenencia reportada"]
        : []),
      ...(meta.domain === "remote_sensing"
        ? ["Indicio superficial; requiere verificación de terreno."]
        : []),
      ...(meta.id === "drilling.proposed" ? ["Propuesta conceptual; no perforado."] : []),
      ...(meta.domain === "sampling"
        ? [
            meta.evidence === "CERTIFICADO"
              ? "Certificación del ensaye; posición histórica pendiente de QA espacial."
              : "Resultado documental; verificar laboratorio, certificado y estado de revisión.",
          ]
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
  selected = false,
}: {
  selected?: boolean;
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
  const color = selected ? geoColors.tenureOwn : featureColor(meta, feature.properties);
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

function CameraView({
  view,
  reset,
  extentMeters,
}: {
  view: "perspective" | "plan";
  reset: number;
  extentMeters: number;
}) {
  const { camera, invalidate } = useThree();
  useEffect(() => {
    const side = extentMeters * SCALE;
    if (view === "plan") camera.position.set(0, side * 1.25, 0.1);
    else camera.position.set(side * 0.7, side * 0.6, side * 0.75);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate, reset, view, extentMeters]);
  return null;
}

export function ProjectTerrain3D(props: ProjectTerrain3DProps) {
  const {
    slug,
    center,
    extentMeters = 10000,
    demSize = 129,
    height = 620,
    notice,
    observationPoints = [],
    neighbourDeposit,
    coordinateNotice,
    interpolationNotice,
    documentMenu,
    selectedFeatureId,
  } = props;
  const projectId = props.projectId ?? "00000000-0000-0000-0000-000000000000";
  const demFn = useServerFn(getDemTile);
  const sentinelDrapeFn = useServerFn(getSentinelRgbDrape);
  const geophysicsQuery = useProjectGeophysicsData(projectId);
  const field = useMemo(
    () => cholquiFieldGeophysics(geophysicsQuery.data, projectId),
    [geophysicsQuery.data, projectId],
  );
  const [campaignKey, setCampaignKey] = useState("");
  const [metric, setMetric] = useState<GeophysicsSurfaceMetric>("mag_residual_nt");
  const metricSpec = METRICS.find((item) => item.id === metric)!;
  const campaigns = useMemo(
    () =>
      [
        ...new Set([
          ...field.stations.map((station) => station.survey_id),
          ...field.lines.map((line) => line.survey_id),
        ]),
      ].map((id) => ({
        id,
        key: id ?? "__unassigned__",
        label: field.surveys.find((survey) => survey.id === id)?.name ?? "Sin campaña informada",
      })),
    [field],
  );
  const campaign = campaigns.find((item) => item.key === campaignKey) ?? campaigns[0];
  const stations = useMemo(
    () => (campaign ? stationsForCampaign(field, campaign.id) : []),
    [campaign, field],
  );
  const surveyLines = useMemo(
    () => (campaign ? field.lines.filter((line) => line.survey_id === campaign.id) : []),
    [campaign, field.lines],
  );
  const fieldSurface = useMemo(
    () => buildFieldGeophysicsSurface(stations, metric),
    [stations, metric],
  );
  const bundle = useMemo(() => props.evidenceBundle ?? projectBundle(props), [props]);
  const initial = useMemo(
    (): Record<string, boolean> => ({
      "territory.dem": true,
      "geophysics.project_stations": true,
      "geophysics.mag_idw": false,
      "geophysics.ip_chargeability_idw": false,
      "geophysics.ip_resistivity_idw": false,
      ...Object.fromEntries(
        bundle.manifest.layers.map((meta) => [
          meta.id,
          !["territory.mojones", "geology.metallogenic_belts"].includes(meta.id),
        ]),
      ),
    }),
    [bundle],
  );
  const { visible, setVisible, opacity, setOpacity } = useGeoLayerPreferences(slug, initial);
  const [hover, setHover] = useState<Hover>(null);
  const [primaryOnly, setPrimaryOnly] = useState(false);
  const [view, setView] = useState<"perspective" | "plan">("perspective");
  const [reset, setReset] = useState(0);
  const [terrainDrape, setTerrainDrape] = useState<"elevation" | "sentinel">("elevation");
  const [sentinelTexture, setSentinelTexture] = useState<THREE.Texture | null>(null);
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
  const displayManifest = useMemo(
    () => ({
      ...bundle.manifest,
      layers: bundle.manifest.layers.map((meta) => {
        const evidence = new Set(
          (bundle.layers[meta.id]?.features ?? []).map((feature) =>
            featureEvidence(meta, feature.properties),
          ),
        );
        const label =
          evidence.size === 1
            ? [...evidence][0]
            : evidence.size
              ? "MIXTO · procedencia por entidad"
              : meta.evidence;
        return evidence.size === 1 && label === meta.evidence
          ? meta
          : { ...meta, label: meta.label + " · " + label, evidence: "CONTEXTO" as const };
      }),
    }),
    [bundle],
  );
  const active = bundle.manifest.layers.filter((meta) => visible[meta.id]);
  const certifiedCodes = useMemo(
    () => new Set(bundle.layers["sampling.assays"]?.features.map((f) => String(f.id))),
    [bundle],
  );
  const observations = observationPoints.filter((p) => !certifiedCodes.has(p.code));
  const dem = useQuery({
    queryKey: ["project-terrain-dem-v3", projectId, demSize, extentMeters, center.lat, center.lng],
    queryFn: () =>
      demFn({
        data: {
          projectId: projectId,
          size: demSize,
          extentMeters: extentMeters,
          centerLat: center.lat,
          centerLng: center.lng,
        },
      }),
    staleTime: Infinity,
  });
  const tile = dem.data?.source === "copernicus" ? dem.data : null;
  const terrainBbox = useMemo(() => {
    const cosine = Math.cos((center.lat * Math.PI) / 180);
    const half = extentMeters / 2;
    const dLng = half / (111_320 * cosine);
    const dLat = half / 111_320;
    return [center.lng - dLng, center.lat - dLat, center.lng + dLng, center.lat + dLat] as [
      number,
      number,
      number,
      number,
    ];
  }, [center.lat, center.lng, extentMeters]);
  const sentinelDrape = useQuery({
    queryKey: ["sentinel-terrain-drape", projectId, terrainBbox],
    queryFn: () => sentinelDrapeFn({ data: { projectId, bbox: terrainBbox } }),
    enabled: Boolean(tile) && projectId !== "00000000-0000-0000-0000-000000000000",
    retry: false,
    staleTime: 240_000,
  });
  useEffect(() => {
    let cancelled = false;
    setSentinelTexture(null);
    if (!tile || !sentinelDrape.data?.url) return;
    void loadSentinelDrapeTexture(sentinelDrape.data.url, tile)
      .then((texture) => {
        if (cancelled) texture.dispose();
        else setSentinelTexture(texture);
      })
      .catch(() => setTerrainDrape("elevation"));
    return () => {
      cancelled = true;
    };
  }, [sentinelDrape.data?.url, tile]);
  useEffect(() => () => sentinelTexture?.dispose(), [sentinelTexture]);
  const certifiedVisible = visible["sampling.assays"];
  const neighbour =
    tile && neighbourDeposit
      ? projectTerrainPoint(tile, neighbourDeposit.lng, neighbourDeposit.lat)
      : null;
  useEffect(() => {
    setHover(null);
  }, [visible, opacity, primaryOnly, metric, campaignKey]);
  const terrainFailure = dem.isError || (!dem.isPending && !tile);
  const geophysicsControls = (
    <div className="space-y-3 text-[10px] text-content-subtle">
      <label className="grid gap-1">
        Campaña
        <select
          aria-label="Campaña geofísica"
          value={campaign?.key ?? ""}
          disabled={!campaigns.length}
          onChange={(event) => setCampaignKey(event.target.value)}
          className="rounded border border-hairline bg-surface px-2 py-1"
        >
          {!campaigns.length && <option value="">Sin estaciones disponibles</option>}
          {campaigns.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        Variable
        <select
          aria-label="Variable geofísica"
          value={metric}
          onChange={(event) => setMetric(event.target.value as GeophysicsSurfaceMetric)}
          className="rounded border border-hairline bg-surface px-2 py-1"
        >
          {METRICS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={Boolean(visible["geophysics.project_stations"])}
          onChange={(event) =>
            setVisible((state) => ({
              ...state,
              "geophysics.project_stations": event.target.checked,
            }))
          }
        />
        Estaciones y líneas medidas
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={Boolean(visible[metricSpec.layer])}
          disabled={!fieldSurface || primaryOnly}
          onChange={(event) =>
            setVisible((state) => ({ ...state, [metricSpec.layer]: event.target.checked }))
          }
        />
        Superficie IDW
      </label>
      <label className="flex items-center gap-2">
        Opacidad IDW
        <input
          aria-label="Opacidad geofísica"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity[metricSpec.layer] ?? 1}
          onChange={(event) =>
            setOpacity((state) => ({ ...state, [metricSpec.layer]: Number(event.target.value) }))
          }
          className="w-20"
        />
      </label>
      {geophysicsQuery.loading && <p role="status">Consultando estaciones del proyecto…</p>}
      {geophysicsQuery.error && (
        <p role="alert">No fue posible consultar la geofísica del proyecto.</p>
      )}
      {!geophysicsQuery.loading && !geophysicsQuery.error && !field.stations.length && (
        <p>No hay estaciones de campo disponibles con este acceso; el DEM no genera geofísica.</p>
      )}
      {fieldSurface && (
        <>
          <div className="flex items-center gap-2" aria-label="Escala de color geofísica">
            <span>{fieldSurface.min.toFixed(2)}</span>
            <span
              className="h-2 min-w-0 flex-1 rounded"
              style={{
                background:
                  "linear-gradient(to right, " +
                  [0, 0.5, 1]
                    .map((fraction) =>
                      geophysicsSurfaceColor(
                        fieldSurface,
                        fraction,
                        fieldSurface.min + fraction * (fieldSurface.max - fieldSurface.min),
                      ),
                    )
                    .join(", ") +
                  ")",
              }}
            />
            <span>
              {fieldSurface.max.toFixed(2)} {fieldSurface.unit}
            </span>
          </div>
          <p>
            Rango IDW: {fieldSurface.min.toFixed(2)}–{fieldSurface.max.toFixed(2)}{" "}
            {fieldSurface.unit} · {fieldSurface.sourceCount} estaciones de {campaign?.label}.
            {fieldSurface.baseline != null &&
              ` Mediana TMI: ${fieldSurface.baseline.toFixed(2)} nT.`}
          </p>
        </>
      )}
      {!fieldSurface && stations.length > 0 && (
        <p>
          Sin superficie: se requieren al menos cuatro posiciones únicas con datos y extensión en
          dos direcciones.
        </p>
      )}
      <p>
        El color expresa la variable; la altura proviene del DEM. IDW es interpolación, no
        inversión. Restar la mediana no acredita corrección diurna ni IGRF; las campañas no se
        mezclan.
      </p>
      {primaryOnly && <p>Modo evidencia primaria: la superficie derivada está oculta.</p>}
    </div>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-content">{slug} · terreno y evidencia 3D</div>
          <div className="text-[11px] text-content-subtle">
            Huellas originales, catastro, estructuras y sondajes propuestos · {extentMeters / 1000}{" "}
            × {extentMeters / 1000} km
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          <button
            type="button"
            aria-pressed={terrainDrape === "elevation"}
            onClick={() => setTerrainDrape("elevation")}
            className={`rounded border border-hairline px-2 py-1 ${
              terrainDrape === "elevation"
                ? "bg-accent-brand text-accent-brand-contrast"
                : "hover:bg-surface-2"
            }`}
          >
            Topografía
          </button>
          <button
            type="button"
            aria-pressed={terrainDrape === "sentinel"}
            disabled={!sentinelTexture}
            onClick={() => setTerrainDrape("sentinel")}
            title={
              sentinelDrape.isError
                ? "Sin acceso a un raster Sentinel-2 compatible"
                : sentinelDrape.isPending
                  ? "Buscando una escena procesada que cubra el terreno"
                  : "Procesa una escena Sentinel-2 que cubra todo el DEM para habilitar el drape"
            }
            className={`rounded border border-hairline px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40 ${
              terrainDrape === "sentinel"
                ? "bg-accent-brand text-accent-brand-contrast"
                : "hover:bg-surface-2"
            }`}
          >
            Sentinel RGB
          </button>
          {(["perspective", "plan"] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => setView(key)}
              className={`rounded border border-hairline px-2 py-1 ${
                view === key ? "bg-accent-brand text-accent-brand-contrast" : "hover:bg-surface-2"
              }`}
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
      <div className="relative bg-surface" style={{ height }}>
        {dem.isPending && (
          <div
            role="status"
            className="grid h-full place-content-center justify-items-center gap-3 text-content"
          >
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-xs">Cargando mosaico de terreno real</span>
          </div>
        )}
        {terrainFailure && (
          <div
            role="alert"
            className="grid h-full place-content-center justify-items-center gap-3 px-8 text-center text-content"
          >
            <p>No se pudo obtener el terreno real completo del proyecto.</p>
            <p className="max-w-md text-xs text-content">
              La vista 2D mantiene la evidencia disponible. El relieve requiere todos los archivos
              DEM del área.
            </p>
            <button
              type="button"
              onClick={() => void dem.refetch()}
              className="rounded border border-hairline px-3 py-2 text-xs"
            >
              Reintentar terreno
            </button>
          </div>
        )}
        {tile && (
          <Canvas frameloop="demand" camera={{ position: [280, 240, 300], fov: 48 }} dpr={[1, 1.5]}>
            <color attach="background" args={[geoColors.sceneBackground]} />
            <ambientLight intensity={0.7} />
            <directionalLight position={[120, 180, 100]} intensity={1.4} />
            <Suspense fallback={null}>
              {visible["territory.dem"] && (
                <Terrain
                  tile={tile}
                  opacity={opacity["territory.dem"] ?? 0.9}
                  texture={sentinelTexture}
                  drape={terrainDrape === "sentinel" && Boolean(sentinelTexture)}
                />
              )}
              <CholquiGeophysicsTerrainLayer
                tile={tile}
                stations={stations}
                lines={surveyLines}
                surface={!primaryOnly && visible[metricSpec.layer] ? fieldSurface : null}
                showStations={Boolean(visible["geophysics.project_stations"])}
                stationOpacity={opacity["geophysics.project_stations"] ?? 1}
                opacity={opacity[metricSpec.layer] ?? 1}
                onHover={setHover}
              />
              {active.map((meta) =>
                (bundle.layers[meta.id]?.features ?? [])
                  .filter(
                    (feature) => !primaryOnly || primaryFeatureEvidence(meta, feature.properties),
                  )
                  .map((feature, index) => (
                    <EvidenceFeature
                      key={meta.id + ":" + (feature.id ?? index)}
                      feature={feature}
                      meta={meta}
                      tile={tile}
                      selected={
                        selectedFeatureId != null &&
                        String(feature.id ?? feature.properties.id) === selectedFeatureId
                      }
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
                        color={geoColors.tenureNeighbor}
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
                      title: neighbourDeposit?.name ?? "Faena vecina",
                      lines: ["Faena vecina de un tercero; no es producción del proyecto."],
                    });
                  }}
                  onPointerOut={() => setHover(null)}
                >
                  <sphereGeometry args={[1, 12, 12]} />
                  <meshBasicMaterial color={geoColors.neighbourDeposit} />
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
              <CameraView view={view} reset={reset} extentMeters={extentMeters} />
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
        {terrainDrape === "sentinel" && sentinelDrape.data && (
          <div className="pointer-events-none absolute bottom-3 left-3 max-w-[80%] rounded border border-hairline bg-surface/90 px-2 py-1 font-mono text-[10px] text-content">
            Sentinel-2 L2A · RGB B04/B03/B02 ·{" "}
            {sentinelDrape.data.acquisitionDate?.slice(0, 10) ?? "fecha no informada"} · máscara SCL
            · reflectancia derivada
          </div>
        )}
        {tile && (
          <div className="absolute left-3 top-3 z-20">
            <PublicGeoLayerControls
              manifest={displayManifest}
              available={available}
              visible={new Set(Object.keys(visible).filter((id) => visible[id]))}
              certificationMode={primaryOnly}
              onToggleCertification={() => setPrimaryOnly((value) => !value)}
              onToggleLayer={(id) => setVisible((state) => ({ ...state, [id]: !state[id] }))}
              opacity={opacity}
              onOpacity={(id, value) => setOpacity((state) => ({ ...state, [id]: value }))}
              counts={counts}
              compact
              tree
              terrain={{
                visible: Boolean(visible["territory.dem"]),
                opacity: opacity["territory.dem"] ?? 0.9,
                onToggle: () =>
                  setVisible((state) => ({ ...state, "territory.dem": !state["territory.dem"] })),
                onOpacity: (value) => setOpacity((state) => ({ ...state, "territory.dem": value })),
              }}
              sections={[
                {
                  id: "geophysics-field",
                  label: `Geofísica MAG/IP · ${field.stations.length} estaciones disponibles`,
                  children: geophysicsControls,
                },
              ]}
            />
          </div>
        )}
        {tile && (
          <div className="absolute bottom-3 right-3 max-w-[calc(100%_-_1.5rem)] rounded border border-hairline bg-surface/95 px-3 py-2 text-[10px] text-content">
            {visible["remote_sensing.sentinel2_alteration"] && !primaryOnly && (
              <div className="mb-1">Huellas espectrales · DERIVADO</div>
            )}
            {visible["remote_sensing.sentinel2_alteration"] &&
              !primaryOnly &&
              Object.entries(SPECTRAL_COLORS)
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
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-4 border-t border-hairline px-4 py-2 text-[11px] font-mono text-content-subtle">
        <span>
          <span
            className="mr-1 inline-block h-2 w-2"
            style={{ background: "var(--geo-tenureOwn)" }}
          />
          Arranque · cartera declarada
        </span>
        <span>
          <span
            className="mr-1 inline-block h-2 w-2"
            style={{ background: "var(--geo-tenureAnnex)" }}
          />
          Anexos · cartera declarada
        </span>
        <span>
          <span
            className="mr-1 inline-block h-2 w-2"
            style={{ background: "var(--geo-tenureNeighbor)" }}
          />
          Vecinos · contexto catastral
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-4 py-3">
        <p className="max-w-2xl text-xs text-content-subtle">
          Estimación mineral: pendiente de sondajes ejecutados, dominios, densidad y QA/QC. DEM y
          ensayes puntuales sustentan planificación, no tonelaje mineralizado.
        </p>
        {documentMenu}
      </div>
      {notice && (
        <p className="border-t border-hairline px-4 py-3 text-xs text-content-subtle">{notice}</p>
      )}
      <div className="space-y-1 border-t border-hairline px-4 py-3 text-[11px] text-content-subtle">
        <p>
          Fuente: Copernicus DEM GLO-30 (~30 m). Grilla visual:{" "}
          {(extentMeters / (demSize - 1)).toFixed(1)} m. Cotas relativas al centro; exageración
          vertical 1×. Capas recortadas al área del DEM.
        </p>
        <p>
          {coordinateNotice} Se conservan {observations.length} observaciones sin ensaye certificado
          vinculado, en gris.
        </p>
        <p>{interpolationNotice}</p>
        <p>
          Los marcadores son símbolos. Las trazas son propuestas conceptuales; no representan
          sondajes ejecutados ni volúmenes de recursos.
        </p>
      </div>
    </div>
  );
}
