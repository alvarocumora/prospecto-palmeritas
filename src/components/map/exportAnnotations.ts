// Export map annotations to CSV or PDF.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ANNOTATION_COLORS, type MapAnnotation } from "@/hooks/useMapAnnotations";

function colorLabel(c: string): string {
  return ANNOTATION_COLORS.find((x) => x.value === c)?.label ?? c;
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportAnnotationsCsv(
  annotations: MapAnnotation[],
  meta: { projectName: string; targetMap?: Map<string, { code: string }>; campaignMap?: Map<string, { name: string }> },
) {
  const headers = [
    "id", "lat", "lng", "color", "color_label", "text", "resolved",
    "target_code", "campaign_name", "phase", "created_at", "updated_at",
  ];
  const rows = annotations.map((a) => [
    a.id,
    Number(a.lat).toFixed(6),
    Number(a.lng).toFixed(6),
    a.color,
    colorLabel(a.color),
    a.text,
    a.resolved ? "true" : "false",
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

  const stamp = new Date().toISOString().slice(0, 10);
  const safe = meta.projectName.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase();
  doc.save(`anotaciones-${safe}-${stamp}.pdf`);
}
