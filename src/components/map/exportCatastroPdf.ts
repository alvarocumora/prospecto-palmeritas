import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CATASTRO_STYLE, type CatastroOrigen } from "./overlays";
import type { AnyFC } from "./types";

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

export function exportCatastroPdf(
  featuresByOrigen: Record<CatastroOrigen, AnyFC["features"]>,
  meta: { center: [number, number]; halfKm: number }
) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const now = new Date().toLocaleString("es-CL");

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
    "Fuente: SERNAGEOMIN Catastro Minero (FeatureServer WGS84_Concesion, ID_SITUACION_CONCESION in 1,3).",
    40,
    70
  );

  let cursorY = 90;

  for (const origen of ORIGEN_ORDER) {
    const feats = featuresByOrigen[origen] ?? [];
    if (feats.length === 0) continue;
    const style = CATASTRO_STYLE[origen];

    // Section title with color swatch
    doc.setFillColor(style.color);
    doc.rect(40, cursorY - 9, 10, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(`${style.label} (${feats.length})`, 56, cursorY);
    cursorY += 6;

    const rows = feats
      .map((f) => {
        const p = (f.properties ?? {}) as Record<string, unknown>;
        return {
          rol: fmtRol(p),
          nombre: (p.NOMBRE as string) ?? "—",
          titular: (p.TITULAR_DIVISION as string) ?? "—",
          ha: fmtHa(p),
          venc: fmtVenc(p),
          comuna: (p.COMUNA as string) ?? "—",
          situacion: (p.SITUACION_CONCESION as string) ?? "—",
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    autoTable(doc, {
      startY: cursorY,
      head: [["ROL", "Nombre", "Titular", "Ha", "Vencimiento", "Comuna", "Situación"]],
      body: rows.map((r) => [r.rol, r.nombre, r.titular, r.ha, r.venc, r.comuna, r.situacion]),
      styles: { font: "helvetica", fontSize: 8, cellPadding: 3, overflow: "linebreak" },
      headStyles: { fillColor: style.color, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 248, 250] },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 150 },
        2: { cellWidth: 200 },
        3: { cellWidth: 40, halign: "right" },
        4: { cellWidth: 75 },
        5: { cellWidth: 90 },
        6: { cellWidth: "auto" },
      },
      margin: { left: 40, right: 40 },
      didDrawPage: () => {
        const page = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(140);
        doc.text(
          `Prospecto Palmeras · pertenencias · pág. ${page}`,
          pageW - 40,
          doc.internal.pageSize.getHeight() - 16,
          { align: "right" }
        );
      },
    });

    // @ts-expect-error - autotable adds lastAutoTable to the doc
    cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 24;
    if (cursorY > doc.internal.pageSize.getHeight() - 80) {
      doc.addPage();
      cursorY = 60;
    }
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`palmeras-pertenencias-${stamp}.pdf`);
}
