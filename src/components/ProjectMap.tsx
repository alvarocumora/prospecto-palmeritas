import { useEffect, useRef } from "react";

/**
 * Interactive Leaflet map for Prospecto Palmeras (TRK-ALH-001).
 * Renders project centroid, vein traces (subvertical N20°W–N30°E),
 * Jubaea chilensis palm cluster markers, historic workings,
 * and proposed DDH drill collars.
 *
 * Client-only: dynamically imports Leaflet to avoid SSR breakage in the Worker runtime.
 */

const CENTER: [number, number] = [-33.898438, -71.115471];

// Synthetic but geologically consistent vector data anchored on the project centroid.
// Vein traces oriented N20°W to N30°E, ~400 m surface length.
const VEINS: { name: string; coords: [number, number][]; strike: string }[] = [
  {
    name: "Veta Aflorante — Corte Principal",
    strike: "N20°W",
    coords: [
      [-33.89665, -71.11595],
      [-33.89845, -71.11540],
      [-33.90020, -71.11488],
    ],
  },
  {
    name: "Veta Secundaria NE",
    strike: "N30°E",
    coords: [
      [-33.89760, -71.11710],
      [-33.89890, -71.11620],
      [-33.90020, -71.11530],
    ],
  },
];

const PALM_CLUSTERS: { name: string; pos: [number, number]; count: number }[] = [
  { name: "Cluster Ladera NW", pos: [-33.89720, -71.11680], count: 6 },
  { name: "Cluster Cumbre", pos: [-33.89820, -71.11540], count: 4 },
  { name: "Cluster Ladera SE", pos: [-33.89970, -71.11430], count: 3 },
];

const WORKINGS: { name: string; pos: [number, number]; type: string }[] = [
  { name: "Pique Prehispánico 1", pos: [-33.89800, -71.11580], type: "Pique manual" },
  { name: "Socavón Colonial", pos: [-33.89880, -71.11505], type: "Socavón ~25m" },
  { name: "Pique Republicano", pos: [-33.89930, -71.11470], type: "Pique 8m" },
];

const DRILL_COLLARS: {
  id: string;
  pos: [number, number];
  azimuth: string;
  inclination: string;
  depth: string;
  target: string;
}[] = [
  { id: "ALH-DDH-001", pos: [-33.89845, -71.11540], azimuth: "090°", inclination: "-60°", depth: "250 m", target: "Veta aflorante → sulfuros" },
  { id: "ALH-DDH-002", pos: [-33.89760, -71.11635], azimuth: "270°", inclination: "-55°", depth: "300 m", target: "Extensión lateral NW" },
  { id: "ALH-DDH-003", pos: [-33.89915, -71.11590], azimuth: "045°", inclination: "-70°", depth: "200 m", target: "Intersección fallas" },
  { id: "ALH-DDH-004", pos: [-33.89880, -71.11460], azimuth: "135°", inclination: "-65°", depth: "280 m", target: "Mesotermal profunda" },
];

export function ProjectMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      // Avoid double-init on HMR / Strict Mode
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

      // --- SERNAGEOMIN Geological WMS overlay ---
      // Mapa Geológico de Chile escala 1:1.000.000 (SERNAGEOMIN)
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
            "Geología SERNAGEOMIN 1:1M": sernageominGeology,
          },
          { position: "topright", collapsed: true }
        )
        .addTo(map);

      // --- Project centroid ---
      const centroidIcon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:var(--gold);box-shadow:0 0 0 4px color-mix(in oklab, var(--gold) 30%, transparent);border:2px solid var(--background);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker(CENTER, { icon: centroidIcon })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;">
            <strong style="color:#C8922A;">PROSPECTO PALMERAS</strong><br/>
            TRK-ALH-001<br/>
            ${CENTER[0].toFixed(6)}, ${CENTER[1].toFixed(6)}
          </div>`
        );

      // --- Vein traces ---
      VEINS.forEach((v) => {
        L.polyline(v.coords, {
          color: "#F0C96B",
          weight: 4,
          opacity: 0.9,
          dashArray: "1 0",
        })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;">
              <strong style="color:#C8922A;">${v.name}</strong><br/>
              Rumbo: ${v.strike} · subvertical
            </div>`
          );
      });

      // --- Palm clusters ---
      PALM_CLUSTERS.forEach((p) => {
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:20px;height:20px;border-radius:50%;background:color-mix(in oklab, #1D9E75 35%, transparent);border:2px solid #1D9E75;display:flex;align-items:center;justify-content:center;color:#F5F0EB;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;">${p.count}</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        L.marker(p.pos, { icon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;">
              <strong style="color:#1D9E75;">${p.name}</strong><br/>
              ${p.count}× Jubaea chilensis<br/>
              <em style="color:#A89080;">Proxy estructural</em>
            </div>`
          );
      });

      // --- Historic workings ---
      WORKINGS.forEach((w) => {
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:12px;height:12px;background:#CD7F32;border:1.5px solid #F5F0EB;transform:rotate(45deg);"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        L.marker(w.pos, { icon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;">
              <strong style="color:#CD7F32;">${w.name}</strong><br/>
              ${w.type}
            </div>`
          );
      });

      // --- Drill collars ---
      DRILL_COLLARS.forEach((d) => {
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:18px;height:18px;border-radius:3px;background:color-mix(in oklab, #185FA5 50%, transparent);border:2px solid #185FA5;display:flex;align-items:center;justify-content:center;color:#F5F0EB;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;">D</div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        L.marker(d.pos, { icon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.6;">
              <strong style="color:#5DA3DD;">${d.id}</strong><br/>
              Az ${d.azimuth} · Incl ${d.inclination}<br/>
              Prof: ${d.depth}<br/>
              <em style="color:#A89080;">${d.target}</em>
            </div>`
          );
      });

      // Fit to all features
      const bounds = L.latLngBounds([
        ...VEINS.flatMap((v) => v.coords),
        ...PALM_CLUSTERS.map((p) => p.pos),
        ...WORKINGS.map((w) => w.pos),
        ...DRILL_COLLARS.map((d) => d.pos),
      ]);
      map.fitBounds(bounds, { padding: [30, 30] });

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
