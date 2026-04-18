import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

import aoiData from "@/data/geo/aoi.geojson?url";
import veinsData from "@/data/geo/veins.geojson?url";
import palmsData from "@/data/geo/palm_clusters.geojson?url";
import workingsData from "@/data/geo/workings.geojson?url";
import drillsData from "@/data/geo/drill_collars.geojson?url";

/**
 * Interactive Leaflet map for Prospecto Palmeras (TRK-ALH-001).
 * Features (AOI centroid, vein traces, palm clusters, historic workings,
 * proposed DDH collars) are loaded from GeoJSON files in src/data/geo,
 * each carrying a `source` property surfaced in popups.
 *
 * Client-only: dynamically imports Leaflet to avoid SSR breakage in the Worker runtime.
 */

const CENTER: [number, number] = [-33.898438, -71.115471];

type AnyFC = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>;

function sourceLine(src: unknown): string {
  if (!src) return "";
  return `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #3a322c;color:#A89080;font-size:10px;">📎 ${String(src)}</div>`;
}

export function ProjectMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);

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

      // --- Basemaps ---
      const cartoDark = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 19,
        }
      );
      const esriImagery = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution:
            "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
          maxZoom: 19,
        }
      );
      const esriTopo = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
          maxZoom: 19,
        }
      );
      const openTopo = L.tileLayer(
        "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        {
          attribution:
            'Map data: &copy; <a href="https://openstreetmap.org">OSM</a>, SRTM | &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
          subdomains: "abc",
          maxZoom: 17,
        }
      );

      cartoDark.addTo(map);

      // --- Geological overlays ---
      // Macrostrat: global geological map (raster tiles), funciona internacionalmente.
      const macrostratGeology = L.tileLayer(
        "https://tiles.macrostrat.org/carto/{z}/{x}/{y}.png",
        {
          attribution:
            'Geología &copy; <a href="https://macrostrat.org">Macrostrat</a> (UW–Madison)',
          opacity: 0.75,
          maxZoom: 16,
          className: "macrostrat-overlay",
        }
      );

      // OneGeology Portal — geología de Chile (SERNAGEOMIN servida vía WMS internacional).
      const oneGeologyChile = L.tileLayer.wms(
        "https://mrdata.usgs.gov/services/onegeology/chile",
        {
          layers: "GSC_Chile_BedrockGeology",
          format: "image/png",
          transparent: true,
          opacity: 0.6,
          attribution:
            'Geología &copy; SERNAGEOMIN vía <a href="https://onegeology.org">OneGeology Portal</a>',
          version: "1.3.0",
          uppercase: true,
        }
      );

      // SERNAGEOMIN WMS oficial — fallback (puede no responder fuera de Chile).
      const sernageominGeology = L.tileLayer.wms(
        "https://catastro.sernageomin.cl/arcgis/services/PUBLICO/Mapa_Geologico_Chile_1M/MapServer/WMSServer",
        {
          layers: "0",
          format: "image/png",
          transparent: true,
          opacity: 0.55,
          attribution: "Geología &copy; SERNAGEOMIN",
          version: "1.3.0",
        }
      );

      L.control
        .layers(
          {
            "CARTO Dark": cartoDark,
            "Esri Imagery": esriImagery,
            "Esri Topo": esriTopo,
            "OpenTopoMap": openTopo,
          },
          {
            "Geología Macrostrat (global)": macrostratGeology,
            "Geología OneGeology · Chile": oneGeologyChile,
            "Geología SERNAGEOMIN 1:1M (CL)": sernageominGeology,
          },
          { position: "topright", collapsed: true }
        )
        .addTo(map);

      // --- Load all GeoJSON in parallel ---
      const [aoiFC, veinsFC, palmsFC, workingsFC, drillsFC] = (await Promise.all(
        [aoiData, veinsData, palmsData, workingsData, drillsData].map((u) =>
          fetch(u).then((r) => r.json())
        )
      )) as AnyFC[];

      if (cancelled) return;

      // --- AOI centroid ---
      const centroidIcon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:var(--gold);box-shadow:0 0 0 4px color-mix(in oklab, var(--gold) 30%, transparent);border:2px solid var(--background);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.geoJSON(aoiFC, {
        pointToLayer: (_f, latlng) => L.marker(latlng, { icon: centroidIcon }),
        onEachFeature: (f, layer) => {
          const p = f.properties ?? {};
          layer.bindPopup(
            `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;">
              <strong style="color:#C8922A;">${p.name ?? "AOI"}</strong><br/>
              ${p.code ?? ""}<br/>
              ${CENTER[0].toFixed(6)}, ${CENTER[1].toFixed(6)}
              ${sourceLine(p.source)}
            </div>`
          );
        },
      }).addTo(map);

      // --- Vein traces ---
      L.geoJSON(veinsFC, {
        style: { color: "#F0C96B", weight: 4, opacity: 0.9 },
        onEachFeature: (f, layer) => {
          const p = f.properties ?? {};
          layer.bindPopup(
            `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;">
              <strong style="color:#C8922A;">${p.name}</strong><br/>
              Rumbo: ${p.strike} · ${p.dip ?? ""}
              ${sourceLine(p.source)}
            </div>`
          );
        },
      }).addTo(map);

      // --- Palm clusters ---
      L.geoJSON(palmsFC, {
        pointToLayer: (f, latlng) => {
          const count = (f.properties?.count as number) ?? 0;
          const icon = L.divIcon({
            className: "",
            html: `<div style="width:20px;height:20px;border-radius:50%;background:color-mix(in oklab, #1D9E75 35%, transparent);border:2px solid #1D9E75;display:flex;align-items:center;justify-content:center;color:#F5F0EB;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;">${count}</div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });
          return L.marker(latlng, { icon });
        },
        onEachFeature: (f, layer) => {
          const p = f.properties ?? {};
          layer.bindPopup(
            `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;">
              <strong style="color:#1D9E75;">${p.name}</strong><br/>
              ${p.count}× ${p.species ?? "Jubaea chilensis"}<br/>
              <em style="color:#A89080;">Proxy estructural</em>
              ${sourceLine(p.source)}
            </div>`
          );
        },
      }).addTo(map);

      // --- Historic workings ---
      L.geoJSON(workingsFC, {
        pointToLayer: (_f, latlng) => {
          const icon = L.divIcon({
            className: "",
            html: `<div style="width:12px;height:12px;background:#CD7F32;border:1.5px solid #F5F0EB;transform:rotate(45deg);"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          });
          return L.marker(latlng, { icon });
        },
        onEachFeature: (f, layer) => {
          const p = f.properties ?? {};
          layer.bindPopup(
            `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;">
              <strong style="color:#CD7F32;">${p.name}</strong><br/>
              ${p.type}
              ${sourceLine(p.source)}
            </div>`
          );
        },
      }).addTo(map);

      // --- Drill collars ---
      L.geoJSON(drillsFC, {
        pointToLayer: (_f, latlng) => {
          const icon = L.divIcon({
            className: "",
            html: `<div style="width:18px;height:18px;border-radius:3px;background:color-mix(in oklab, #185FA5 50%, transparent);border:2px solid #185FA5;display:flex;align-items:center;justify-content:center;color:#F5F0EB;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;">D</div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });
          return L.marker(latlng, { icon });
        },
        onEachFeature: (f, layer) => {
          const p = f.properties ?? {};
          layer.bindPopup(
            `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.6;">
              <strong style="color:#5DA3DD;">${p.id}</strong><br/>
              Az ${p.azimuth} · Incl ${p.inclination}<br/>
              Prof: ${p.depth}<br/>
              <em style="color:#A89080;">${p.target}</em>
              ${sourceLine(p.source)}
            </div>`
          );
        },
      }).addTo(map);

      // Fit to all features
      const collect: [number, number][] = [];
      [veinsFC, palmsFC, workingsFC, drillsFC].forEach((fc) => {
        fc.features.forEach((f) => {
          if (f.geometry.type === "Point") {
            const [lng, lat] = f.geometry.coordinates as [number, number];
            collect.push([lat, lng]);
          } else if (f.geometry.type === "LineString") {
            (f.geometry.coordinates as [number, number][]).forEach(([lng, lat]) =>
              collect.push([lat, lng])
            );
          }
        });
      });
      if (collect.length) {
        map.fitBounds(L.latLngBounds(collect), { padding: [30, 30] });
      }

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
      <div className="flex flex-wrap gap-3 text-[11px] font-mono text-muted-foreground">
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
      </div>
    </div>
  );
}
