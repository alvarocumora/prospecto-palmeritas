import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as turf from "@turf/turf";
import { CATASTRO_STYLE, type CatastroOrigen } from "./overlays";
import type { AnyFC } from "./types";
import type { AoiPolygon } from "./aoiPolygon";

const ORIGEN_ORDER: CatastroOrigen[] = [
  "EXPLOTA_1983",
  "EXPLOTA_1932",
  "EXPLORA_1983",
  "ESTACAMENTO",
];

function fmtRol(p: Record<string, unknown>): string {
  const num = p.NUMERO_ROL;
  const dv = p.DV_ROL;
  if (num == null) return "—";
  return `${num}${dv ? `-${dv}` : ""}`;
}

function fmtVenc(p: Record<string, unknown>): string {
  const v = p.FECHA_VENCIMIENTO;
  if (v == null) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Date(n).toLocaleDateString("es-CL");
}

function fmtHa(p: Record<string, unknown>): string {
  const h = p.HECTAREAS;
  if (h == null) return "—";
  const n = Number(h);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(1);
}

type EnrichedRow = {
  rol: string;
  nombre: string;
  titular: string;
  ha: string;
  venc: string;
  comuna: string;
  situacion: string;
  distKm: number;
  intersects: boolean;
  origen: CatastroOrigen;
};

function enrichRows(
  featuresByOrigen: Record<CatastroOrigen, AnyFC["features"]>,
  aoi: AoiPolygon | null,
  centerLngLat: [number, number]
): EnrichedRow[] {
  const aoiCentroidPt = aoi
    ? turf.centroid(aoi)
    : turf.point([centerLngLat[0], centerLngLat[1]]);

  const rows: EnrichedRow[] = [];
  for (const origen of ORIGEN_ORDER) {
    for (const f of featuresByOrigen[origen] ?? []) {
      const p = (f.properties ?? {}) as Record<string, unknown>;
      let dist = Number.NaN;
      let intersects = false;
      try {
        const ft = f as turf.Feature<turf.Geometry>;
        const c = turf.centroid(ft);
        dist = turf.distance(aoiCentroidPt, c, { units: "kilometers" });
        if (aoi && (ft.geometry.type === "Polygon" || ft.geometry.type === "MultiPolygon")) {
          intersects = turf.booleanIntersects(aoi, ft);
        }
      } catch {
        // ignore geometry errors
      }
      rows.push({
        rol: fmtRol(p),
        nombre: (p.NOMBRE as string) ?? "—",
        titular: (p.TITULAR_DIVISION as string) ?? "—",
        ha: fmtHa(p),
        venc: fmtVenc(p),
        comuna: (p.COMUNA as string) ?? "—",
        situacion: (p.SITUACION_CONCESION as string) ?? "—",
        distKm: dist,
        intersects,
        origen,
      });
    }
  }
  return rows;
}

export function exportCatastroPdf(
  featuresByOrigen: Record<CatastroOrigen, AnyFC["features"]>,
  meta: { center: [number, number]; halfKm: number; aoi: AoiPolygon | null }
) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const now = new Date().toLocaleString("es-CL");

  // CENTER is [lat, lng] — but turf needs [lng, lat]
  const allRows = enrichRows(featuresByOrigen, meta.aoi, [meta.center[1], meta.center[0]]);

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Prospecto Palmeras — Pertenencias mineras (SERNAGEOMIN)", 40, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(
    `Centroide AOI: ${meta.center[0].toFixed(5)}, ${meta.center[1].toFixed(5)} · Radio bbox: ${meta.halfKm} km · Generado: ${now}`,
    40,
    56
  );
  doc.text(
    "Fuente: SERNAGEOMIN Catastro Minero (FeatureServer WGS84_Concesion, ID_SITUACION_CONCESION in 1,3). Distancias y intersección AOI calculadas con turf.js.",
    40,
    70
  );

  let cursorY = 90;

  // ---- Sección destacada: pertenencias que intersectan AOI ----
  const intersecting = allRows.filter((r) => r.intersects).sort((a, b) => a.distKm - b.distKm);
  if (intersecting.length > 0) {
    doc.setFillColor("#F0C96B");
    doc.rect(40, cursorY - 9, 10, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text(`⚑ Pertenencias que intersectan AOI (${intersecting.length})`, 56, cursorY);
    cursorY += 6;
    autoTable(doc, {
      startY: cursorY,
      head: [["Tipo", "ROL", "Nombre", "Titular", "Ha", "Vencimiento", "Dist (km)"]],
      body: intersecting.map((r) => [
        CATASTRO_STYLE[r.origen].label,
        r.rol,
        r.nombre,
        r.titular,
        r.ha,
        r.venc,
        Number.isFinite(r.distKm) ? r.distKm.toFixed(2) : "—",
      ]),
      styles: { font: "helvetica", fontSize: 8, cellPadding: 3, overflow: "linebreak" },
      headStyles: { fillColor: "#C8922A", textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 245, 230] },
      margin: { left: 40, right: 40 },
    });
    // @ts-expect-error - autotable adds lastAutoTable
    cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 24;
    if (cursorY > pageH - 80) {
      doc.addPage();
      cursorY = 60;
    }
  }

  // ---- Secciones por ORIGEN (todas las del bbox) ----
  for (const origen of ORIGEN_ORDER) {
    const feats = featuresByOrigen[origen] ?? [];
    if (feats.length === 0) continue;
    const style = CATASTRO_STYLE[origen];

    doc.setFillColor(style.color);
    doc.rect(40, cursorY - 9, 10, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(`${style.label} (${feats.length})`, 56, cursorY);
    cursorY += 6;

    const rows = allRows
      .filter((r) => r.origen === origen)
      .sort((a, b) => a.distKm - b.distKm);

    autoTable(doc, {
      startY: cursorY,
      head: [["ROL", "Nombre", "Titular", "Ha", "Vencimiento", "Comuna", "Dist km", "AOI"]],
      body: rows.map((r) => [
        r.rol,
        r.nombre,
        r.titular,
        r.ha,
        r.venc,
        r.comuna,
        Number.isFinite(r.distKm) ? r.distKm.toFixed(2) : "—",
        r.intersects ? "✓" : "",
      ]),
      styles: { font: "helvetica", fontSize: 8, cellPadding: 3, overflow: "linebreak" },
      headStyles: { fillColor: style.color, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 248, 250] },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 130 },
        2: { cellWidth: 180 },
        3: { cellWidth: 35, halign: "right" },
        4: { cellWidth: 70 },
        5: { cellWidth: 80 },
        6: { cellWidth: 45, halign: "right" },
        7: { cellWidth: 30, halign: "center" },
      },
      margin: { left: 40, right: 40 },
      didDrawPage: () => {
        const page = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(140);
        doc.text(
          `Prospecto Palmeras · pertenencias · pág. ${page}`,
          pageW - 40,
          pageH - 16,
          { align: "right" }
        );
      },
    });

    // @ts-expect-error - autotable adds lastAutoTable
    cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 24;
    if (cursorY > pageH - 80) {
      doc.addPage();
      cursorY = 60;
    }
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`palmeras-pertenencias-${stamp}.pdf`);
}

/** Returns set of feature IDs (keyed by NUMERO_ROL-DV) that intersect AOI, used to highlight on the map. */
export function computeAoiIntersections(
  featuresByOrigen: Record<CatastroOrigen, AnyFC["features"]>,
  aoi: AoiPolygon | null
): Set<string> {
  if (!aoi) return new Set();
  const out = new Set<string>();
  for (const origen of ORIGEN_ORDER) {
    for (const f of featuresByOrigen[origen] ?? []) {
      try {
        const ft = f as turf.Feature<turf.Geometry>;
        if (ft.geometry.type !== "Polygon" && ft.geometry.type !== "MultiPolygon") continue;
        if (turf.booleanIntersects(aoi, ft)) {
          const p = (f.properties ?? {}) as Record<string, unknown>;
          const id = `${p.NUMERO_ROL ?? ""}-${p.DV_ROL ?? ""}-${p.NOMBRE ?? ""}`;
          out.add(id);
        }
      } catch {
        // ignore
      }
    }
  }
  return out;
}
