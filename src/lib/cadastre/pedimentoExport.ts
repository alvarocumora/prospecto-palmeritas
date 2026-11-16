// Exporta el pedimento trazado a GeoJSON y KML (Google Earth / QGIS / celular).
import type { PedimentoResult } from "@/lib/pedimentoGeometry";

export function pedimentoGeoJson(p: PedimentoResult, name = "Pedimento GeoCapitals") {
  return JSON.stringify({
    type: "FeatureCollection",
    features: [{ ...p.rectangleWgs84, properties: { name, area_ha: p.areaHa, huso: p.huso, datum: p.datum, fuente: "Vacancia indicativa SERNAGEOMIN" } }],
  }, null, 2);
}

export function pedimentoKml(p: PedimentoResult, name = "Pedimento GeoCapitals") {
  const ring = p.rectangleWgs84.geometry.coordinates[0].map(([x, y]) => `${x},${y},0`).join(" ");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(name)}</name>
<Style id="p"><LineStyle><color>ff0c41c2</color><width>3</width></LineStyle><PolyStyle><color>380c41c2</color></PolyStyle></Style>
<Placemark><name>${esc(name)}</name><description>${p.areaHa} ha · Huso ${p.huso}S · ${esc(p.datum)} · vacancia indicativa</description><styleUrl>#p</styleUrl>
<Polygon><outerBoundaryIs><LinearRing><coordinates>${ring}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
</Document></kml>`;
}

export function downloadText(text: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
