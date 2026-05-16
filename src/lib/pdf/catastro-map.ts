import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas-pro";
import { CATASTRO_STYLE, type CatastroOrigen } from "@/components/map/overlays";
import type { MiningConcession } from "@/hooks/useMiningConcessions";

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

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 26, 22);
  doc.text("Catastro Minero — Reporte de mapa", margin, margin + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 100, 92);
  const subtitle = [
    projectName ?? "Proyecto",
    `Generado: ${new Date().toLocaleString("es-CL")}`,
    `Zoom: ${zoom}`,
  ].join("  ·  ");
  doc.text(subtitle, margin, margin + 9);

  // Map image
  const imgY = margin + 13;
  const imgMaxH = 110;
  const imgMaxW = pageW - margin * 2;
  const ratio = canvas.width / canvas.height;
  let imgW = imgMaxW;
  let imgH = imgW / ratio;
  if (imgH > imgMaxH) {
    imgH = imgMaxH;
    imgW = imgH * ratio;
  }
  doc.addImage(dataUrl, "JPEG", margin + (imgMaxW - imgW) / 2, imgY, imgW, imgH);

  // Bbox line
  let cursorY = imgY + imgH + 5;
  doc.setFontSize(8);
  doc.setTextColor(110, 100, 92);
  doc.text(
    `BBOX (lng,lat): ${bbox.minLng.toFixed(5)}, ${bbox.minLat.toFixed(5)}  →  ${bbox.maxLng.toFixed(5)}, ${bbox.maxLat.toFixed(5)}`,
    margin,
    cursorY,
  );
  cursorY += 5;

  // Legend
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 26, 22);
  doc.text("Leyenda", margin, cursorY);
  cursorY += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let lx = margin;
  const legendY = cursorY;
  (
    Object.entries(CATASTRO_STYLE) as Array<
      [CatastroOrigen, (typeof CATASTRO_STYLE)[CatastroOrigen]]
    >
  ).forEach(([, s]) => {
    const hex = s.fillColor.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    doc.setFillColor(r, g, b);
    doc.setDrawColor(r, g, b);
    doc.rect(lx, legendY - 2.5, 3, 3, "FD");
    doc.setTextColor(60, 50, 40);
    doc.text(s.label, lx + 4, legendY);
    lx += doc.getTextWidth(s.label) + 12;
  });
  // Mis concesiones
  doc.setFillColor(255, 210, 74);
  doc.setDrawColor(200, 160, 30);
  doc.rect(lx, legendY - 2.5, 3, 3, "FD");
  doc.setTextColor(60, 50, 40);
  doc.text("Mis concesiones", lx + 4, legendY);
  cursorY += 6;

  // Project concessions table (if any)
  if (projectConcessions.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 26, 22);
    doc.text(`Concesiones del proyecto (${projectConcessions.length})`, margin, cursorY);
    cursorY += 2;
    autoTable(doc, {
      startY: cursorY,
      head: [["Código", "Nombre", "Tipo", "Estado", "Titular", "Área (ha)", "Vence"]],
      body: projectConcessions.map((c) => [
        c.code,
        c.name,
        c.concession_type,
        c.status,
        c.holder ?? "—",
        c.area_ha != null ? String(c.area_ha) : "—",
        c.expires_at ?? "—",
      ]),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [240, 200, 100], textColor: [40, 30, 10] },
      margin: { left: margin, right: margin },
    });
    // @ts-expect-error — autoTable mutates doc.lastAutoTable
    cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 6;
  }

  // SERNAGEOMIN features table (truncate to fit)
  if (catastroFeatures.length > 0) {
    if (cursorY > pageH - 40) {
      doc.addPage();
      cursorY = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 26, 22);
    doc.text(`Pertenencias SERNAGEOMIN en vista (${catastroFeatures.length})`, margin, cursorY);
    cursorY += 2;
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
    autoTable(doc, {
      startY: cursorY,
      head: [["Nombre", "ROL", "Tipo", "Situación", "Titular", "Comuna", "Ha", "Vence"]],
      body: rows,
      styles: { fontSize: 6.5, cellPadding: 1.2, overflow: "linebreak" },
      headStyles: { fillColor: [80, 105, 140], textColor: 255 },
      margin: { left: margin, right: margin },
      columnStyles: { 0: { cellWidth: 40 }, 4: { cellWidth: 50 } },
    });
    if (catastroFeatures.length > 200) {
      // @ts-expect-error — autoTable mutates doc.lastAutoTable
      const y = (doc.lastAutoTable?.finalY ?? cursorY) + 4;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(140, 130, 120);
      doc.text(
        `Mostrando 200 de ${catastroFeatures.length}. Refina la vista del mapa para reducir el universo.`,
        margin,
        y,
      );
    }
  }

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150, 138, 128);
    doc.text(
      "Fuente: SERNAGEOMIN — Catastro Minero (ArcGIS REST · WGS84_Concesion)",
      margin,
      pageH - 5,
    );
    doc.text(`${i} / ${pageCount}`, pageW - margin, pageH - 5, { align: "right" });
  }

  const fname = `catastro-${(projectName ?? "proyecto").toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fname);
}
