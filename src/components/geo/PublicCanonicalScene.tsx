import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { PathLayer, PolygonLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import "maplibre-gl/dist/maplibre-gl.css";

import { PublicGeoLayerControls } from "./PublicGeoLayerControls";
import {
  isCertificationEvidence,
  publicBundleLayerIds,
  type PublicGeoBundle,
  type PublicGeoFeatureCollection,
} from "@/lib/geospatial/publicGeoContract";
import type { CanonicalGeoLayerId, GeoLayerDomain } from "@/lib/geospatial/layerRegistry";

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    basemap: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "© Esri World Imagery",
      maxzoom: 19,
    },
    terrainDEM: {
      type: "raster-dem",
      tiles: ["/api/terrain/{z}/{x}/{y}"],
      tileSize: 256,
      encoding: "terrarium",
      maxzoom: 15,
      attribution: "© AWS Terrain Tiles",
    },
  },
  layers: [{ id: "basemap", type: "raster", source: "basemap" }],
  sky: {
    "sky-color": "#0a1224",
    "sky-horizon-blend": 0.5,
    "horizon-color": "#1a2a4a",
    "horizon-fog-blend": 0.5,
    "fog-color": "#0a1224",
    "fog-ground-blend": 0.1,
  },
};

const DOMAIN_RGB: Record<GeoLayerDomain, [number, number, number]> = {
  basemap: [148, 163, 184],
  territory: [234, 179, 8],
  remote_sensing: [249, 115, 22],
  geology: [34, 197, 94],
  geophysics: [56, 189, 248],
  geochemistry: [20, 184, 166],
  sampling: [168, 85, 247],
  targets: [239, 68, 68],
  drilling: [245, 158, 11],
  models: [100, 116, 139],
};

type PointDatum = {
  position: [number, number];
  properties: Record<string, unknown>;
};

type PolygonDatum = {
  polygon: [number, number][];
  properties: Record<string, unknown>;
};

type PathDatum = {
  path: [number, number][];
  properties: Record<string, unknown>;
};

function asLngLat(coord: unknown): [number, number] | null {
  if (!Array.isArray(coord) || coord.length < 2) return null;
  const lng = Number(coord[0]);
  const lat = Number(coord[1]);
  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
}

function pointsFrom(collection: PublicGeoFeatureCollection): PointDatum[] {
  const output: PointDatum[] = [];
  for (const feature of collection.features) {
    if (feature.geometry?.type === "Point") {
      const position = asLngLat(feature.geometry.coordinates);
      if (position) output.push({ position, properties: feature.properties });
    } else if (feature.geometry?.type === "MultiPoint") {
      for (const coord of feature.geometry.coordinates) {
        const position = asLngLat(coord);
        if (position) output.push({ position, properties: feature.properties });
      }
    }
  }
  return output;
}

function polygonsFrom(collection: PublicGeoFeatureCollection): PolygonDatum[] {
  const output: PolygonDatum[] = [];
  for (const feature of collection.features) {
    if (feature.geometry?.type === "Polygon") {
      const ring = feature.geometry.coordinates[0]
        ?.map(asLngLat)
        .filter((coord): coord is [number, number] => Boolean(coord));
      if (ring && ring.length >= 3) output.push({ polygon: ring, properties: feature.properties });
    } else if (feature.geometry?.type === "MultiPolygon") {
      for (const polygon of feature.geometry.coordinates) {
        const ring = polygon[0]
          ?.map(asLngLat)
          .filter((coord): coord is [number, number] => Boolean(coord));
        if (ring && ring.length >= 3)
          output.push({ polygon: ring, properties: feature.properties });
      }
    }
  }
  return output;
}

function pathsFrom(collection: PublicGeoFeatureCollection): PathDatum[] {
  const output: PathDatum[] = [];
  const push = (coords: unknown[], properties: Record<string, unknown>) => {
    const path = coords.map(asLngLat).filter((coord): coord is [number, number] => Boolean(coord));
    if (path.length >= 2) output.push({ path, properties });
  };

  for (const feature of collection.features) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    if (geometry.type === "LineString") push(geometry.coordinates, feature.properties);
    if (geometry.type === "MultiLineString") {
      for (const line of geometry.coordinates) push(line, feature.properties);
    }
    if (geometry.type === "Polygon") push(geometry.coordinates[0] ?? [], feature.properties);
    if (geometry.type === "MultiPolygon") {
      for (const polygon of geometry.coordinates) push(polygon[0] ?? [], feature.properties);
    }
  }
  return output;
}

function numericProperty(properties: Record<string, unknown>, key: string): number {
  const value = Number(properties[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function PublicCanonicalScene({
  bundle,
  height = 640,
}: {
  bundle: PublicGeoBundle;
  height?: number;
}) {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [ready, setReady] = useState(false);
  const [certificationMode, setCertificationMode] = useState(false);
  const [visible, setVisible] = useState<Set<CanonicalGeoLayerId>>(
    () => new Set(publicBundleLayerIds(bundle)),
  );

  const available = useMemo(() => new Set(publicBundleLayerIds(bundle)), [bundle]);

  useEffect(() => {
    setVisible(new Set(publicBundleLayerIds(bundle)));
  }, [bundle.manifest.project.id]);

  useEffect(() => {
    if (!mapDiv.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapDiv.current,
      style: MAP_STYLE,
      center: bundle.center,
      zoom: 11.5,
      pitch: 60,
      bearing: -20,
      maxPitch: 80,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-left");
    map.on("load", () => {
      const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
      map.addControl(overlay as unknown as maplibregl.IControl);
      overlayRef.current = overlay;
      setReady(true);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    if (bundle.bbox) {
      mapRef.current.fitBounds(
        [
          [bundle.bbox[0], bundle.bbox[1]],
          [bundle.bbox[2], bundle.bbox[3]],
        ],
        { padding: 50, maxZoom: 13, duration: 800 },
      );
      mapRef.current.setPitch(60);
    } else {
      mapRef.current.flyTo({ center: bundle.center, zoom: 11.5, pitch: 60, duration: 800 });
    }
  }, [bundle.bbox, bundle.center, ready]);

  const activeIds = useMemo(() => {
    const ids = new Set<CanonicalGeoLayerId>();
    for (const meta of bundle.manifest.layers) {
      if (!available.has(meta.id) || !visible.has(meta.id)) continue;
      if (certificationMode && !isCertificationEvidence(meta.evidence)) continue;
      ids.add(meta.id);
    }
    return ids;
  }, [available, bundle.manifest.layers, certificationMode, visible]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    try {
      mapRef.current.setTerrain(
        activeIds.has("territory.dem") ? { source: "terrainDEM", exaggeration: 1.5 } : null,
      );
    } catch {
      try {
        mapRef.current.setTerrain(null);
      } catch {
        // Keep the pitched basemap available if terrain is unsupported.
      }
    }
  }, [activeIds, ready]);

  const deckLayers = useMemo(() => {
    const layers: Layer[] = [];

    for (const meta of bundle.manifest.layers) {
      if (!activeIds.has(meta.id)) continue;
      const collection = bundle.layers[meta.id];
      if (!collection) continue;
      const rgb = DOMAIN_RGB[meta.domain];

      const polygons = polygonsFrom(collection);
      if (polygons.length) {
        layers.push(
          new PolygonLayer({
            id: `public-3d:${meta.id}:polygons`,
            data: polygons,
            pickable: true,
            extruded: meta.domain === "remote_sensing",
            wireframe: false,
            getPolygon: (datum: PolygonDatum) => datum.polygon,
            getElevation: (datum: PolygonDatum) =>
              meta.domain === "remote_sensing"
                ? 40 + numericProperty(datum.properties, "score") * 160
                : 5,
            getFillColor: [...rgb, meta.domain === "territory" ? 60 : 130],
            getLineColor: [...rgb, 230],
            lineWidthUnits: "pixels",
            getLineWidth: 1.5,
          }),
        );
      }

      const paths = pathsFrom(collection);
      if (paths.length) {
        layers.push(
          new PathLayer({
            id: `public-3d:${meta.id}:paths`,
            data: paths,
            pickable: true,
            widthUnits: "pixels",
            getPath: (datum: PathDatum) => datum.path,
            getColor: [...rgb, 235],
            getWidth: meta.domain === "geology" ? 4 : 2.5,
          }),
        );
      }

      const points = pointsFrom(collection);
      if (points.length) {
        layers.push(
          new ScatterplotLayer({
            id: `public-3d:${meta.id}:points`,
            data: points,
            pickable: true,
            stroked: true,
            filled: meta.domain !== "geophysics",
            radiusUnits: "meters",
            getPosition: (datum: PointDatum) => datum.position,
            getRadius: (datum: PointDatum) => {
              if (meta.domain === "targets") {
                return 130 + numericProperty(datum.properties, "score") * 3;
              }
              if (meta.domain === "geophysics") {
                return Math.max(160, numericProperty(datum.properties, "radius_m"));
              }
              return 75;
            },
            getFillColor: [...rgb, 190],
            getLineColor: [...rgb, 240],
            getLineWidth: 2,
            lineWidthUnits: "pixels",
          }),
        );
      }
    }

    return layers;
  }, [activeIds, bundle.layers, bundle.manifest.layers]);

  useEffect(() => {
    if (!ready || !overlayRef.current) return;
    overlayRef.current.setProps({ layers: deckLayers });
  }, [deckLayers, ready]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-border bg-bg-panel"
      style={{ height }}
      data-public-geo-viewer="canonical-3d"
      data-public-geo-project={bundle.manifest.project.id}
      data-public-geo-layers={Array.from(activeIds).sort().join(",")}
    >
      <div ref={mapDiv} className="absolute inset-0" />
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
          compact
        />
      </div>
      <div className="absolute bottom-3 right-3 z-20 rounded border border-border bg-background/90 px-2 py-1 font-mono text-[9px] text-muted-foreground backdrop-blur">
        canonical public · deck.gl · {deckLayers.length} capas
      </div>
    </div>
  );
}
