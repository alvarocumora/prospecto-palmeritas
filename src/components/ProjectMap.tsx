import { useCallback, useEffect, useRef, useState } from "react";
import type { Layer } from "leaflet";
import "leaflet/dist/leaflet.css";

import aoiData from "@/data/geo/aoi.geojson?url";
import veinsData from "@/data/geo/veins.geojson?url";
import palmsData from "@/data/geo/palm_clusters.geojson?url";
import workingsData from "@/data/geo/workings.geojson?url";
import drillsData from "@/data/geo/drill_collars.geojson?url";

import { CENTER, type AnyFC } from "./map/types";
import { buildBasemaps } from "./map/basemaps";
import {
  buildGeologyOverlays,
  fetchMacrostratUnit,
  macrostratPopupHtml,
} from "./map/overlays";
import { addProjectFeatures } from "./map/featureLayers";
import {
  bboxAround,
  loadCatastroLayer,
  wireMacrostratClickPopup,
} from "./map/catastroLayer";

/**
 * Interactive Leaflet map for Prospecto Palmeras (TRK-ALH-001).
 * - Project features (AOI, vetas, palmeras, labores, collares) from local GeoJSON.
 * - Macrostrat geological raster overlay + click-to-query popup.
 * - SERNAGEOMIN Catastro Minero (pertenencias + concesiones) via ArcGIS REST.
 *
 * Client-only: dynamically imports Leaflet to avoid SSR breakage in the Worker.
 */
export function ProjectMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);
  const [counts, setCounts] = useState<{ explotacion: number | null; exploracion: number | null }>({
    explotacion: null,
    exploracion: null,
  });

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;
      if (mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: CENTER,
        zoom: 16,
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
      });
      mapRef.current = map;

      const basemaps = buildBasemaps(L);
      basemaps["CARTO Dark"].addTo(map);
      const geoOverlays = buildGeologyOverlays(L);

      // --- Load project GeoJSON in parallel ---
      const [aoiFC, veinsFC, palmsFC, workingsFC, drillsFC] = (await Promise.all(
        [aoiData, veinsData, palmsData, workingsData, drillsData].map((u) =>
          fetch(u).then((r) => r.json())
        )
      )) as AnyFC[];
      if (cancelled) return;

      addProjectFeatures(L, map, {
        aoi: aoiFC,
        veins: veinsFC,
        palms: palmsFC,
        workings: workingsFC,
        drills: drillsFC,
      });

      // --- Load Catastro Minero around AOI (~8 km half-size) ---
      const bbox = bboxAround(CENTER, 8);
      const overlays: Record<string, Layer> = { ...geoOverlays };

      const [explotRes, exploRes] = await Promise.allSettled([
        loadCatastroLayer(L, "explotacion", bbox),
        loadCatastroLayer(L, "exploracion", bbox),
      ]);
      if (cancelled) return;

      let explotCount: number | null = null;
      let exploCount: number | null = null;
      if (explotRes.status === "fulfilled") {
        overlays[`Catastro · Pertenencias (${explotRes.value.count})`] = explotRes.value.layer;
        explotCount = explotRes.value.count;
      } else {
        console.warn("Catastro explotación falló:", explotRes.reason);
      }
      if (exploRes.status === "fulfilled") {
        overlays[`Catastro · Concesiones (${exploRes.value.count})`] = exploRes.value.layer;
        exploCount = exploRes.value.count;
      } else {
        console.warn("Catastro exploración falló:", exploRes.reason);
      }
      setCounts({ explotacion: explotCount, exploracion: exploCount });

      L.control
        .layers(basemaps, overlays, { position: "topright", collapsed: true })
        .addTo(map);

      // --- Macrostrat click-to-query popup ---
      wireMacrostratClickPopup(L, map, fetchMacrostratUnit, macrostratPopupHtml);

      cleanup = () => {
        map.remove();
        mapRef.current = null;
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="h-72 md:h-96 w-full rounded border border-border overflow-hidden bg-bg-secondary"
        style={{ zIndex: 0 }}
      />
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
        <span className="text-muted-foreground/70">Catastro 8 km AOI:</span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-gold/40 bg-gold/10 text-gold">
          <span className="w-2 h-2 rounded-sm bg-gold" />
          Pertenencias: <strong>{counts.explotacion ?? "…"}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-info/40 bg-info/10 text-info">
          <span className="w-2 h-2 rounded-sm bg-info" />
          Concesiones: <strong>{counts.exploracion ?? "…"}</strong>
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] font-mono text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-gold border border-background" /> Centroide
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-gold-light" /> Veta Au–Cu
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border-2 border-teal" /> Cluster palmeras
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-copper inline-block" style={{ transform: "rotate(45deg)" }} /> Labor antigua
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border-2 border-info" /> Collar DDH propuesto
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3" style={{ background: "rgba(200,146,42,0.18)", border: "1px solid #C8922A" }} /> Pertenencia
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3" style={{ background: "rgba(93,163,221,0.12)", border: "1px dashed #5DA3DD" }} /> Concesión
        </span>
        <span className="text-muted-foreground/70">· click en el mapa → Macrostrat</span>
      </div>
    </div>
  );
}
