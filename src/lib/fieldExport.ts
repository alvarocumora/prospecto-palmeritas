// Export GPX/KML para puntos de terreno: POIs + targets + anomalías satelitales.
// Cliente puro — los datos ya están en memoria via hooks.
import type { FieldPoi } from "@/hooks/useFieldPois";
import type { ExplorationTarget } from "@/hooks/useExplorationTargets";
import type { AnomalyRow, SatIndexCode } from "@/hooks/useProjectSatelliteAnomalies";

const xmlEscape = (s: string) =>
  s.replace(/[<>&"']/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === '"' ? "&quot;" : "&apos;",
  );

const INDEX_KML_COLOR: Record<SatIndexCode, string> = {
  // KML usa AABBGGRR (alpha+BGR)
  IRON_OXIDE: "9928 5a dc".replace(/\s/g, ""), // naranja
  CLAY_MINERALS: "9950c8dc",
  HYDROTHERMAL_ALTERATION: "99c83cc8",
  STRUCTURAL_LINEAMENTS: "99e6c850",
};

export function buildGpx(opts: {
  projectName: string;
  pois: FieldPoi[];
  targets: ExplorationTarget[];
}): string {
  const { projectName, pois, targets } = opts;
  const now = new Date().toISOString();
  const wpts: string[] = [];

  for (const p of pois) {
    if (p.lat == null || p.lng == null) continue;
    wpts.push(
      `  <wpt lat="${p.lat}" lon="${p.lng}">
    ${p.elevation_m != null ? `<ele>${p.elevation_m}</ele>` : ""}
    <name>${xmlEscape(p.title ?? "POI")}</name>
    <desc>${xmlEscape(p.note ?? "")}</desc>
    <sym>Flag, Blue</sym>
    <type>field-poi</type>
  </wpt>`,
    );
  }

  for (const t of targets) {
    if (t.lat == null || t.lng == null) continue;
    wpts.push(
      `  <wpt lat="${t.lat}" lon="${t.lng}">
    ${t.elevation_m != null ? `<ele>${t.elevation_m}</ele>` : ""}
    <name>${xmlEscape(`${t.code} · ${t.name}`)}</name>
    <desc>${xmlEscape(`Prioridad ${t.priority} · Score ${t.score ?? "—"} · ${t.target_type}`)}</desc>
    <sym>Flag, Red</sym>
    <type>exploration-target</type>
  </wpt>`,
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Geocapitals" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${xmlEscape(projectName)} — terreno</name>
    <time>${now}</time>
  </metadata>
${wpts.join("\n")}
</gpx>`;
}

export function buildKml(opts: {
  projectName: string;
  pois: FieldPoi[];
  targets: ExplorationTarget[];
  anomalies?: AnomalyRow[];
}): string {
  const { projectName, pois, targets, anomalies = [] } = opts;

  const poiPlacemarks = pois
    .filter((p) => p.lat != null && p.lng != null)
    .map(
      (p) => `    <Placemark>
      <name>${xmlEscape(p.title ?? "POI")}</name>
      <description>${xmlEscape(p.note ?? "")}</description>
      <styleUrl>#poi</styleUrl>
      <Point><coordinates>${p.lng},${p.lat},${p.elevation_m ?? 0}</coordinates></Point>
    </Placemark>`,
    )
    .join("\n");

  const targetPlacemarks = targets
    .filter((t) => t.lat != null && t.lng != null)
    .map(
      (t) => `    <Placemark>
      <name>${xmlEscape(`${t.code} · ${t.name}`)}</name>
      <description>${xmlEscape(`Prioridad ${t.priority} · Score ${t.score ?? "—"}`)}</description>
      <styleUrl>#target</styleUrl>
      <Point><coordinates>${t.lng},${t.lat},${t.elevation_m ?? 0}</coordinates></Point>
    </Placemark>`,
    )
    .join("\n");

  const anomalyPlacemarks = anomalies
    .filter((a) => a.geometry)
    .map((a) => {
      const color = INDEX_KML_COLOR[a.index_code] ?? "99ffffff";
      const geom = a.geometry as GeoJSON.Geometry;
      let kmlGeom = "";
      try {
        if (geom.type === "Polygon") {
          const ring = geom.coordinates[0].map((c) => `${c[0]},${c[1]},0`).join(" ");
          kmlGeom = `<Polygon><outerBoundaryIs><LinearRing><coordinates>${ring}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
        } else if (geom.type === "LineString") {
          const coords = geom.coordinates.map((c) => `${c[0]},${c[1]},0`).join(" ");
          kmlGeom = `<LineString><coordinates>${coords}</coordinates></LineString>`;
        } else if (geom.type === "Point") {
          const c = geom.coordinates;
          kmlGeom = `<Point><coordinates>${c[0]},${c[1]},0</coordinates></Point>`;
        }
      } catch {
        return "";
      }
      if (!kmlGeom) return "";
      return `    <Placemark>
      <name>${xmlEscape(`${a.index_code} · ${a.severity}`)}</name>
      <description>${xmlEscape(a.notes ?? `Score ${a.score}`)}</description>
      <Style><LineStyle><color>${color}</color><width>2</width></LineStyle><PolyStyle><color>${color}</color></PolyStyle></Style>
      ${kmlGeom}
    </Placemark>`;
    })
    .filter(Boolean)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${xmlEscape(projectName)} — terreno</name>
    <Style id="poi"><IconStyle><color>ffff3b8b</color><scale>1.1</scale></IconStyle></Style>
    <Style id="target"><IconStyle><color>ff3b3bdc</color><scale>1.2</scale></IconStyle></Style>
${poiPlacemarks}
${targetPlacemarks}
${anomalyPlacemarks}
  </Document>
</kml>`;
}

export function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
