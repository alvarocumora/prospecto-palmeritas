import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";
import { CATASTRO_STYLE, type CatastroOrigen } from "@/components/map/overlays";
import type { MiningConcession } from "@/hooks/useMiningConcessions";
import {
  drawFooter,
  drawHeader,
  editorialTable,
  ensureBrandFonts,
  fill,
  fitTableRows,
  font,
  ink,
  stroke,
} from "./brand/kit";
import { GC_COLOR, type RGB } from "./brand/tokens";

type CatastroFeatureProps = {
  ORIGEN?: CatastroOrigen;
  NOMBRE?: string;
  NUMERO_ROL?: string | number;
  DV_ROL?: string;
  HECTAREAS?: number;
  TITULAR_DIVISION?: string;
  COMUNA?: string;
  SITUACION_CONCESION?: string;
  FECHA_VENCIMIENTO?: number;
};

export type CatastroPdfInput = {
  mapElement: HTMLElement;
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  zoom: number;
  catastroFeatures: Array<{ properties: CatastroFeatureProps }>;
  projectConcessions: MiningConcession[];
  projectName?: string;
};

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export async function exportCatastroMapPdf(input: CatastroPdfInput): Promise<void> {
  const { mapElement, bbox, zoom, catastroFeatures, projectConcessions, projectName } = input;

  // Capture the map element (Leaflet renders in DOM/canvas tiles).
  const canvas = await html2canvas(mapElement, {
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    scale: 2,
    logging: false,
  });
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

  // Estructura de marca institucional (brand/kit), igual que propertyAnalysisPdf.ts.
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  await ensureBrandFonts(doc);
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const m = 36;
  const cw = w - m * 2;
  const issued = new Date().toLocaleDateString("es-CL");
  const footerLeft = "Fuente: SERNAGEOMIN — Catastro Minero (ArcGIS REST · WGS84_Concesion)";
  const start = () => {
    drawHeader(doc, { w, m, left: "Catastro minero — Reporte de mapa", right: issued });
  };
  const ensure = (y: number, need: number) => {
    if (y + need < h - 40) return y;
    doc.addPage();
    start();
    return 64;
  };
  start();
  let y = 60;
  font(doc, "body", "normal", 9);
  ink(doc, GC_COLOR.slate);
  doc.text([projectName ?? "Proyecto", `Zoom: ${zoom}`].join("  ·  "), m, y);
  y += 12;

  // Map image
  const imgMaxH = 230;
  const imgMaxW = cw;
  const ratio = canvas.width / canvas.height;
  let imgW = imgMaxW;
  let imgH = imgW / ratio;
  if (imgH > imgMaxH) {
    imgH = imgMaxH;
    imgW = imgH * ratio;
  }
  doc.addImage(dataUrl, "JPEG", m + (imgMaxW - imgW) / 2, y, imgW, imgH);
  y += imgH + 10;

  font(doc, "body", "normal", 7.6);
  ink(doc, GC_COLOR.slate);
  doc.text(
    `BBOX (lng,lat): ${bbox.minLng.toFixed(5)}, ${bbox.minLat.toFixed(5)}  →  ${bbox.maxLng.toFixed(5)}, ${bbox.maxLat.toFixed(5)}`,
    m,
    y,
  );
  y += 14;

  // Legend
  font(doc, "body", "bold", 8.4);
  ink(doc, GC_COLOR.ink);
  doc.text("Leyenda", m, y);
  y += 10;
  let lx = m;
  font(doc, "body", "normal", 7.6);
  (
    Object.entries(CATASTRO_STYLE) as Array<
      [CatastroOrigen, (typeof CATASTRO_STYLE)[CatastroOrigen]]
    >
  ).forEach(([, s]) => {
    const c = hexToRgb(s.fillColor);
    fill(doc, c);
    stroke(doc, c);
    doc.rect(lx, y - 7, 7, 7, "FD");
    ink(doc, GC_COLOR.inkSoft);
    doc.text(s.label, lx + 10, y - 1);
    lx += doc.getTextWidth(s.label) + 24;
  });
  fill(doc, [255, 210, 74]);
  stroke(doc, [200, 160, 30]);
  doc.rect(lx, y - 7, 7, 7, "FD");
  ink(doc, GC_COLOR.inkSoft);
  doc.text("Mis concesiones", lx + 10, y - 1);
  y += 16;

  // Project concessions table (if any)
  if (projectConcessions.length > 0) {
    y = ensure(y, 60);
    font(doc, "body", "bold", 9.4);
    ink(doc, GC_COLOR.ink);
    doc.text(`Concesiones del proyecto (${projectConcessions.length})`, m, y);
    y += 10;
    const head = ["Código", "Nombre", "Tipo", "Estado", "Titular", "Área (ha)", "Vence"];
    const rows = projectConcessions.map((c) => [
      c.code,
      c.name,
      c.concession_type,
      c.status,
      c.holder ?? "—",
      c.area_ha != null ? String(c.area_ha) : "—",
      c.expires_at ?? "—",
    ]);
    y += editorialTable(doc, { x: m, y, w: cw, head, rows, size: 7.6 }) + 10;
  }

  // SERNAGEOMIN features table (truncate to fit)
  if (catastroFeatures.length > 0) {
    y = ensure(y, 60);
    font(doc, "body", "bold", 9.4);
    ink(doc, GC_COLOR.ink);
    doc.text(`Pertenencias SERNAGEOMIN en vista (${catastroFeatures.length})`, m, y);
    y += 10;
    const head = ["Nombre", "ROL", "Tipo", "Situación", "Titular", "Comuna", "Ha", "Vence"];
    const rows = catastroFeatures.slice(0, 200).map((f) => {
      const p = f.properties ?? {};
      const rol = p.NUMERO_ROL ? `${p.NUMERO_ROL}${p.DV_ROL ? `-${p.DV_ROL}` : ""}` : "—";
      const venc = p.FECHA_VENCIMIENTO
        ? new Date(Number(p.FECHA_VENCIMIENTO)).toLocaleDateString("es-CL")
        : "—";
      const tipo = p.ORIGEN ? (CATASTRO_STYLE[p.ORIGEN]?.label ?? p.ORIGEN) : "—";
      return [
        p.NOMBRE ?? "—",
        rol,
        tipo,
        p.SITUACION_CONCESION ?? "—",
        p.TITULAR_DIVISION ?? "—",
        p.COMUNA ?? "—",
        p.HECTAREAS != null ? Number(p.HECTAREAS).toFixed(1) : "—",
        venc,
      ];
    });
    let rest = rows;
    while (rest.length) {
      font(doc, "body", "normal", 6.8);
      const fit = fitTableRows(doc, { head, rows: rest, w: cw, size: 6.8 }, h - 40 - y);
      if (!fit) {
        y = ensure(y, h - 40 - y + 1);
        continue;
      }
      y += editorialTable(doc, { x: m, y, w: cw, head, rows: rest.slice(0, fit), size: 6.8 });
      rest = rest.slice(fit);
      if (rest.length) y = ensure(y, 9999);
    }
    if (catastroFeatures.length > 200) {
      font(doc, "body", "italic", 7.4);
      ink(doc, GC_COLOR.slate);
      doc.text(
        `Mostrando 200 de ${catastroFeatures.length}. Refina la vista del mapa para reducir el universo.`,
        m,
        y + 10,
      );
      y += 14;
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(doc, { w, h, m, left: footerLeft, page: i, total: pageCount });
  }

  const fname = `catastro-${(projectName ?? "proyecto").toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fname);
}
