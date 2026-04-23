// Export map annotations to CSV or PDF.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ANNOTATION_COLORS, ANNOTATION_PRIORITIES, type MapAnnotation } from "@/hooks/useMapAnnotations";

function colorLabel(c: string): string {
  return ANNOTATION_COLORS.find((x) => x.value === c)?.label ?? c;
}

function priorityLabel(p: string | null | undefined): string {
  return ANNOTATION_PRIORITIES.find((x) => x.value === p)?.label ?? (p ?? "—");
}

export type UserNameMap = Map<string, string>;

interface ExportMeta {
  projectName: string;
  targetMap?: Map<string, { code: string }>;
  campaignMap?: Map<string, { name: string }>;
  userMap?: UserNameMap;
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportAnnotationsCsv(
  annotations: MapAnnotation[],
  meta: ExportMeta,
) {
  const headers = [
    "id", "lat", "lng",
    "color", "color_label", "color_original",
    "priority", "priority_label",
    "text", "resolved", "resolved_reason", "resolved_by", "resolved_at",
    "created_by", "created_by_name",
    "target_code", "campaign_name", "phase", "created_at", "updated_at",
  ];
  const rows = annotations.map((a) => [
    a.id,
    Number(a.lat).toFixed(6),
    Number(a.lng).toFixed(6),
    a.color,
    colorLabel(a.color),
    a.color, // color_original (alias explícito para auditoría)
    a.priority ?? "medium",
    priorityLabel(a.priority),
    a.text,
    a.resolved ? "true" : "false",
    a.resolved_reason ?? "",
    a.resolved_by ? meta.userMap?.get(a.resolved_by) ?? a.resolved_by : "",
    a.resolved_at ?? "",
    a.created_by,
    meta.userMap?.get(a.created_by) ?? "",
    a.target_id ? meta.targetMap?.get(a.target_id)?.code ?? "" : "",
    a.campaign_id ? meta.campaignMap?.get(a.campaign_id)?.name ?? "" : "",
    a.phase ?? "",
    a.created_at,
    a.updated_at,
  ]);
  const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  const safe = meta.projectName.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase();
  a.download = `anotaciones-${safe}-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAnnotationsPdf(
  annotations: MapAnnotation[],
  meta: { projectName: string; targetMap?: Map<string, { code: string }>; campaignMap?: Map<string, { name: string }> },
) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const now = new Date().toLocaleString("es-CL");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`Anotaciones del mapa — ${meta.projectName}`, 40, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(
    `Total: ${annotations.length} · Resueltas: ${annotations.filter((a) => a.resolved).length} · Generado: ${now}`,
    40,
    56,
  );

  autoTable(doc, {
    startY: 76,
    head: [["#", "Lat", "Lng", "Color", "Texto", "Resuelta", "Target", "Campaña", "Fase", "Creada"]],
    body: annotations.map((a, i) => [
      String(i + 1),
      Number(a.lat).toFixed(5),
      Number(a.lng).toFixed(5),
      colorLabel(a.color),
      a.text,
      a.resolved ? "✓" : "",
      a.target_id ? meta.targetMap?.get(a.target_id)?.code ?? "—" : "",
      a.campaign_id ? (meta.campaignMap?.get(a.campaign_id)?.name ?? "").slice(0, 24) : "",
      a.phase ?? "",
      new Date(a.created_at).toLocaleDateString("es-CL"),
    ]),
    styles: { font: "helvetica", fontSize: 8, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: "#C8922A", textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 248, 250] },
    columnStyles: {
      0: { cellWidth: 24, halign: "right" },
      1: { cellWidth: 55, halign: "right" },
      2: { cellWidth: 55, halign: "right" },
      3: { cellWidth: 70 },
      4: { cellWidth: 260 },
      5: { cellWidth: 45, halign: "center" },
      6: { cellWidth: 60 },
      7: { cellWidth: 95 },
      8: { cellWidth: 55 },
      9: { cellWidth: 60 },
    },
    margin: { left: 40, right: 40 },
    didDrawPage: () => {
      const page = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(140);
      doc.text(`Anotaciones · ${meta.projectName} · pág. ${page}`, pageW - 40, pageH - 16, { align: "right" });
    },
  });

  // ── Page 2: totales por target + heatmap básico de densidad lat/lng ─────────
  doc.addPage("a4", "landscape");
  const pageW2 = doc.internal.pageSize.getWidth();
  const pageH2 = doc.internal.pageSize.getHeight();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(0);
  doc.text("Resumen por target y densidad espacial", 40, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`${meta.projectName} · ${now}`, 40, 54);

  // Totales por target (incluye "Sin target")
  type Bucket = { code: string; total: number; resolved: number; pending: number };
  const buckets = new Map<string, Bucket>();
  for (const a of annotations) {
    const code = a.target_id
      ? meta.targetMap?.get(a.target_id)?.code ?? "—"
      : "Sin target";
    const b = buckets.get(code) ?? { code, total: 0, resolved: 0, pending: 0 };
    b.total += 1;
    if (a.resolved) b.resolved += 1;
    else b.pending += 1;
    buckets.set(code, b);
  }
  const targetRows = Array.from(buckets.values()).sort((a, b) => b.total - a.total);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(`Totales por target (${targetRows.length})`, 40, 78);

  autoTable(doc, {
    startY: 86,
    head: [["Target", "Total", "Pendientes", "Resueltas", "% resueltas"]],
    body: targetRows.map((r) => [
      r.code,
      String(r.total),
      String(r.pending),
      String(r.resolved),
      r.total ? `${((r.resolved / r.total) * 100).toFixed(0)}%` : "—",
    ]),
    styles: { font: "helvetica", fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: "#C8922A", textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 248, 250] },
    columnStyles: {
      0: { cellWidth: 140 },
      1: { cellWidth: 50, halign: "right" },
      2: { cellWidth: 70, halign: "right" },
      3: { cellWidth: 70, halign: "right" },
      4: { cellWidth: 70, halign: "right" },
    },
    margin: { left: 40 },
    tableWidth: 400,
  });

  // Heatmap de densidad — grilla 12×8 sobre el bbox de las anotaciones
  const heatX = 460;
  const heatY = 86;
  const heatW = pageW2 - heatX - 40;
  const heatH = 280;
  const cols = 12;
  const rows = 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text("Heatmap de densidad (lat/lng)", heatX, 78);

  if (annotations.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(140);
    doc.text("Sin datos para graficar.", heatX, heatY + 20);
  } else {
    const lats = annotations.map((a) => Number(a.lat));
    const lngs = annotations.map((a) => Number(a.lng));
    let minLat = Math.min(...lats);
    let maxLat = Math.max(...lats);
    let minLng = Math.min(...lngs);
    let maxLng = Math.max(...lngs);
    // Padding contra bbox degenerado
    if (maxLat - minLat < 1e-6) { maxLat += 0.0005; minLat -= 0.0005; }
    if (maxLng - minLng < 1e-6) { maxLng += 0.0005; minLng -= 0.0005; }

    const grid: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
    for (const a of annotations) {
      const lat = Number(a.lat);
      const lng = Number(a.lng);
      const cx = Math.min(cols - 1, Math.floor(((lng - minLng) / (maxLng - minLng)) * cols));
      // Invertir Y: filas superiores = lat altas
      const cy = Math.min(rows - 1, Math.floor(((maxLat - lat) / (maxLat - minLat)) * rows));
      grid[cy][cx] += 1;
    }
    let maxCount = 0;
    for (const row of grid) for (const v of row) if (v > maxCount) maxCount = v;

    const cellW = heatW / cols;
    const cellH = heatH / rows;

    // Marco
    doc.setDrawColor(180);
    doc.setLineWidth(0.5);
    doc.rect(heatX, heatY, heatW, heatH, "S");

    // Celdas (gradiente blanco → dorado → rojo)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const v = grid[y][x];
        if (v === 0) continue;
        const t = maxCount > 0 ? v / maxCount : 0;
        // Interpolar: 0 → (245,245,235), 0.5 → (200,146,42 gold), 1 → (200,40,40)
        let r: number, g: number, b: number;
        if (t < 0.5) {
          const k = t / 0.5;
          r = Math.round(245 + (200 - 245) * k);
          g = Math.round(245 + (146 - 245) * k);
          b = Math.round(235 + (42 - 235) * k);
        } else {
          const k = (t - 0.5) / 0.5;
          r = Math.round(200 + (200 - 200) * k);
          g = Math.round(146 + (40 - 146) * k);
          b = Math.round(42 + (40 - 42) * k);
        }
        doc.setFillColor(r, g, b);
        doc.rect(heatX + x * cellW, heatY + y * cellH, cellW, cellH, "F");
        if (v > 0 && cellW > 22 && cellH > 14) {
          doc.setFontSize(7);
          doc.setTextColor(t > 0.55 ? 255 : 30);
          doc.text(String(v), heatX + x * cellW + cellW / 2, heatY + y * cellH + cellH / 2 + 2, { align: "center" });
        }
      }
    }
    // Re-marco encima
    doc.setDrawColor(120);
    doc.rect(heatX, heatY, heatW, heatH, "S");

    // Etiquetas de bbox
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(110);
    doc.text(`lat ${maxLat.toFixed(4)}`, heatX - 4, heatY + 6, { align: "right" });
    doc.text(`lat ${minLat.toFixed(4)}`, heatX - 4, heatY + heatH, { align: "right" });
    doc.text(`lng ${minLng.toFixed(4)}`, heatX, heatY + heatH + 10);
    doc.text(`lng ${maxLng.toFixed(4)}`, heatX + heatW, heatY + heatH + 10, { align: "right" });

    // Leyenda
    const legY = heatY + heatH + 22;
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text(`Máx por celda: ${maxCount} · grilla ${cols}×${rows}`, heatX, legY);
    const lw = 120;
    const lh = 8;
    const lx = heatX + heatW - lw;
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      let r: number, g: number, b: number;
      if (t < 0.5) {
        const k = t / 0.5;
        r = Math.round(245 + (200 - 245) * k);
        g = Math.round(245 + (146 - 245) * k);
        b = Math.round(235 + (42 - 235) * k);
      } else {
        const k = (t - 0.5) / 0.5;
        r = Math.round(200 + (200 - 200) * k);
        g = Math.round(146 + (40 - 146) * k);
        b = Math.round(42 + (40 - 42) * k);
      }
      doc.setFillColor(r, g, b);
      doc.rect(lx + (i * lw) / steps, legY - 6, lw / steps + 0.5, lh, "F");
    }
    doc.setDrawColor(150);
    doc.rect(lx, legY - 6, lw, lh, "S");
    doc.setTextColor(110);
    doc.text("0", lx, legY + 10);
    doc.text(String(maxCount), lx + lw, legY + 10, { align: "right" });
  }

  // Footer pág. 2
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(
    `Anotaciones · ${meta.projectName} · pág. ${doc.getNumberOfPages()}`,
    pageW2 - 40, pageH2 - 16, { align: "right" },
  );

  const stamp = new Date().toISOString().slice(0, 10);
  const safe = meta.projectName.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase();
  doc.save(`anotaciones-${safe}-${stamp}.pdf`);
}
