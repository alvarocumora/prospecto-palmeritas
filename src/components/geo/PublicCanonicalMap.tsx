import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type Map as MapLibreMap, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { PublicGeoLayerControls } from "./PublicGeoLayerControls";
import {
  isCertificationEvidence,
  publicBundleLayerIds,
  type PublicGeoBundle,
} from "@/lib/geospatial/publicGeoContract";
import type { CanonicalGeoLayerId, GeoLayerDomain } from "@/lib/geospatial/layerRegistry";
import { ANOMALY_INTENSITY_COLOR_STOPS } from "@/lib/geoscience/anomalySurface";

const INTENSITY_SURFACE_LAYER_ID: CanonicalGeoLayerId = "remote_sensing.anomaly_intensity";

/** Expresión MapLibre `interpolate/linear` sobre la misma rampa que usa la leyenda. */
const INTENSITY_FILL_COLOR = [
  "interpolate",
  ["linear"],
  ["coalesce", ["get", "normalized"], 0],
  ...ANOMALY_INTENSITY_COLOR_STOPS.flatMap(([stop, color]) => [stop, color]),
] as unknown as maplibregl.ExpressionSpecification;

const BASE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "© Esri World Imagery",
    },
  },
  layers: [{ id: "esri", type: "raster", source: "esri" }],
};

const DOMAIN_COLOR: Record<GeoLayerDomain, string> = {
  basemap: "#94a3b8",
  territory: "#eab308",
  remote_sensing: "#f97316",
  geology: "#22c55e",
  geophysics: "#38bdf8",
  geochemistry: "#14b8a6",
  sampling: "#a855f7",
  targets: "#ef4444",
  drilling: "#f59e0b",
  models: "#64748b",
};

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function geometryKinds(collection: GeoJSON.FeatureCollection): {
  polygon: boolean;
  line: boolean;
  point: boolean;
} {
  let polygon = false;
  let line = false;
  let point = false;
  for (const feature of collection.features) {
    const type = feature.geometry?.type;
    if (type === "Polygon" || type === "MultiPolygon") polygon = true;
    if (type === "LineString" || type === "MultiLineString") line = true;
    if (type === "Point" || type === "MultiPoint") point = true;
  }
  return { polygon, line, point };
}

type Selected = {
  layerId: CanonicalGeoLayerId;
  properties: Record<string, unknown>;
};

function propertyPreview(properties: Record<string, unknown>): Array<[string, string]> {
  return Object.entries(properties)
    .filter(([, value]) => value != null && typeof value !== "object")
    .slice(0, 7)
    .map(([key, value]) => [key, String(value)]);
}

export function PublicCanonicalMap({
  bundle,
  height = 620,
}: {
  bundle: PublicGeoBundle;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const renderedLayerIdsRef = useRef<string[]>([]);
  const renderedSourceIdsRef = useRef<string[]>([]);
  const layerLookupRef = useRef(new Map<string, CanonicalGeoLayerId>());
  const [ready, setReady] = useState(false);
  const [certificationMode, setCertificationMode] = useState(false);
  const [visible, setVisible] = useState<Set<CanonicalGeoLayerId>>(
    () => new Set(publicBundleLayerIds(bundle)),
  );
  const [selected, setSelected] = useState<Selected | null>(null);

  const available = useMemo(
    () =>
      new Set(
        bundle.manifest.layers.map((layer) => layer.id).filter((id) => Boolean(bundle.layers[id])),
      ),
    [bundle],
  );

  useEffect(() => {
    setVisible(new Set(publicBundleLayerIds(bundle)));
    setSelected(null);
  }, [bundle.manifest.project.id]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_STYLE,
      center: bundle.center,
      zoom: 11,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", () => setReady(true));
    map.on("click", (event) => {
      const ids = renderedLayerIdsRef.current.filter((id) => map.getLayer(id));
      if (!ids.length) return;
      const feature = map.queryRenderedFeatures(event.point, { layers: ids })[0];
      if (!feature) {
        setSelected(null);
        return;
      }
      const canonicalId = layerLookupRef.current.get(feature.layer.id);
      if (!canonicalId) return;
      setSelected({
        layerId: canonicalId,
        properties: (feature.properties ?? {}) as Record<string, unknown>,
      });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) mapRef.current?.resize();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [ready]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    if (bundle.bbox) {
      map.fitBounds(
        [
          [bundle.bbox[0], bundle.bbox[1]],
          [bundle.bbox[2], bundle.bbox[3]],
        ],
        { padding: 40, maxZoom: 14, duration: 700 },
      );
    } else {
      map.flyTo({ center: bundle.center, zoom: 11.5, duration: 700 });
    }
  }, [bundle.bbox, bundle.center, ready]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;

    for (const layerId of renderedLayerIdsRef.current) {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    }
    for (const sourceId of renderedSourceIdsRef.current) {
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }
    renderedLayerIdsRef.current = [];
    renderedSourceIdsRef.current = [];
    layerLookupRef.current = new Map();

    for (const meta of bundle.manifest.layers) {
      const data = bundle.layers[meta.id];
      if (!data || !visible.has(meta.id)) continue;
      if (certificationMode && !isCertificationEvidence(meta.evidence)) continue;

      const sourceId = `public-src-${safeId(meta.id)}`;
      map.addSource(sourceId, { type: "geojson", data: data as GeoJSON.FeatureCollection });
      renderedSourceIdsRef.current.push(sourceId);
      const color = DOMAIN_COLOR[meta.domain];
      const kinds = geometryKinds(data as GeoJSON.FeatureCollection);

      // Superficie IDW (celdas de grilla con `normalized` en vez de un color
      // de dominio fijo): mismo lenguaje visual azul→magenta que ya usaba
      // ProjectMasterViewer. Sin stroke — son celdas contiguas, una línea por
      // celda se vería como una grilla, no como una superficie continua.
      if (meta.id === INTENSITY_SURFACE_LAYER_ID) {
        const id = `${sourceId}:fill`;
        map.addLayer({
          id,
          type: "fill",
          source: sourceId,
          paint: { "fill-color": INTENSITY_FILL_COLOR, "fill-opacity": 0.45 },
        });
        renderedLayerIdsRef.current.push(id);
        layerLookupRef.current.set(id, meta.id);
        continue;
      }

      if (kinds.polygon) {
        const id = `${sourceId}:fill`;
        map.addLayer({
          id,
          type: "fill",
          source: sourceId,
          paint: { "fill-color": color, "fill-opacity": 0.18 },
        });
        renderedLayerIdsRef.current.push(id);
        layerLookupRef.current.set(id, meta.id);
      }

      if (kinds.line || kinds.polygon) {
        const id = `${sourceId}:line`;
        map.addLayer({
          id,
          type: "line",
          source: sourceId,
          paint: { "line-color": color, "line-width": 2, "line-opacity": 0.9 },
        });
        renderedLayerIdsRef.current.push(id);
        layerLookupRef.current.set(id, meta.id);
      }

      if (kinds.point) {
        const id = `${sourceId}:circle`;
        map.addLayer({
          id,
          type: "circle",
          source: sourceId,
          paint: {
            "circle-radius": meta.domain === "targets" ? 8 : 6,
            "circle-color": color,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.2,
            "circle-opacity": 0.9,
          },
        });
        renderedLayerIdsRef.current.push(id);
        layerLookupRef.current.set(id, meta.id);
      }
    }

    return () => {
      for (const layerId of renderedLayerIdsRef.current) {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      }
      for (const sourceId of renderedSourceIdsRef.current) {
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      }
      renderedLayerIdsRef.current = [];
      renderedSourceIdsRef.current = [];
      layerLookupRef.current = new Map();
    };
  }, [bundle, certificationMode, ready, visible]);

  const selectedMeta = selected
    ? (bundle.manifest.layers.find((layer) => layer.id === selected.layerId) ?? null)
    : null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-border bg-background"
      style={{ height }}
      data-public-geo-viewer="canonical-2d"
      data-public-geo-project={bundle.manifest.project.id}
      data-public-geo-layers={Array.from(visible).sort().join(",")}
    >
      <div ref={containerRef} className="absolute inset-0" />

      <div className="absolute left-3 top-3 z-20">
        <PublicGeoLayerControls
          manifest={bundle.manifest}
          available={available}
          visible={visible}
          certificationMode={certificationMode}
          onToggleCertification={() => setCertificationMode((value) => !value)}
          onToggleLayer={(id) =>
            setVisible((current) => {
              const next = new Set(current);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
        />
      </div>

      {visible.has(INTENSITY_SURFACE_LAYER_ID) && available.has(INTENSITY_SURFACE_LAYER_ID) && (
        <div className="pointer-events-none absolute right-3 top-3 z-20 w-[11rem] rounded border border-border bg-background/95 p-2.5 shadow-lg backdrop-blur">
          <div className="font-mono text-[9px] uppercase tracking-wider text-foreground">
            Intensidad · IDW
          </div>
          <div
            className="mt-1.5 h-2.5 w-full rounded-full"
            style={{
              background: `linear-gradient(to right, ${ANOMALY_INTENSITY_COLOR_STOPS.map(
                ([stop, color]) => `${color} ${stop * 100}%`,
              ).join(", ")})`,
            }}
          />
          <div className="mt-1 flex justify-between font-mono text-[8px] text-muted-foreground">
            <span>bajo</span>
            <span>alto</span>
          </div>
        </div>
      )}

      {selected && selectedMeta && (
        <div className="absolute bottom-3 right-3 z-20 w-[20rem] rounded border border-border bg-background/95 p-3 shadow-xl backdrop-blur">
          <div className="text-[10px] font-mono uppercase tracking-wider text-gold">
            {selectedMeta.label}
          </div>
          <div className="mt-1 text-[9px] font-mono text-muted-foreground">
            {selectedMeta.sourceSystem} · {selectedMeta.scaleLabel}
          </div>
          <div className="mt-2 space-y-1">
            {propertyPreview(selected.properties).map(([key, value]) => (
              <div key={key} className="grid grid-cols-[7rem_1fr] gap-2 text-[10px]">
                <span className="font-mono text-muted-foreground">{key}</span>
                <span className="break-words text-foreground">{value}</span>
              </div>
            ))}
          </div>
          {selectedMeta.caution && (
            <div className="mt-2 border-t border-border pt-2 text-[9px] leading-snug text-amber-600">
              {selectedMeta.caution}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
