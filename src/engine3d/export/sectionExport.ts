// Export utilities para SectionResult:
// - PNG (rasteriza el SVG)
// - CSV (segmentos isosurface + sondajes + muestras)
// - Stubs para DXF / PDF (estructura preparada)
import type { SectionResult } from "@/engine3d/sections/sectionEngine";

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

/** Serializa SVGElement → PNG y lo descarga. */
export async function exportSectionPNG(
  svg: SVGSVGElement,
  filename = "section.png",
  scale = 2,
): Promise<void> {
  const xml = new XMLSerializer().serializeToString(svg);
  const svg64 = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("svg load"));
    img.src = svg64;
  });
  const bbox = svg.getBoundingClientRect();
  const w = Math.max(1, Math.round(bbox.width * scale));
  const h = Math.max(1, Math.round(bbox.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas ctx");
  ctx.fillStyle = "#08090c";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  await new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) download(filename, blob);
      resolve();
    }, "image/png");
  });
}

function csvEscape(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportSectionCSV(
  result: SectionResult,
  filename = "section.csv",
): void {
  const lines: string[] = [];
  lines.push("# section export · generado por engine3d");
  lines.push(`# frame.kind=${result.frame.kind} width=${result.width}m`);
  lines.push(`# frame.normal=${result.frame.normal.x.toFixed(4)},${result.frame.normal.y.toFixed(4)},${result.frame.normal.z.toFixed(4)}`);
  lines.push(`# frame.origin=${result.frame.origin.x.toFixed(2)},${result.frame.origin.y.toFixed(2)},${result.frame.origin.z.toFixed(2)}`);
  lines.push("");
  lines.push("type,id,u_a,v_a,u_b,v_b,value,extra");
  for (const s of result.terrainProfile) {
    lines.push(`terrain,,${s.a.u.toFixed(2)},${s.a.v.toFixed(2)},${s.b.u.toFixed(2)},${s.b.v.toFixed(2)},,`);
  }
  for (const s of result.anomalySegments) {
    lines.push(`anomaly,,${s.a.u.toFixed(2)},${s.a.v.toFixed(2)},${s.b.u.toFixed(2)},${s.b.v.toFixed(2)},,`);
  }
  for (const h of result.drillholes) {
    const extra = `az=${h.azimuth.toFixed(0)};dip=${h.dip.toFixed(0)};depth=${h.depth.toFixed(0)};status=${csvEscape(h.status ?? "")};ai=${h.isAi ? 1 : 0}`;
    lines.push(`drillhole,${csvEscape(h.holeId)},${h.collar2D.u.toFixed(2)},${h.collar2D.v.toFixed(2)},${h.toe2D.u.toFixed(2)},${h.toe2D.v.toFixed(2)},,${csvEscape(extra)}`);
    if (h.intersect) {
      lines.push(`drillhole_intersect,${csvEscape(h.holeId)},${h.intersect.u.toFixed(2)},${h.intersect.v.toFixed(2)},,,,`);
    }
  }
  for (const p of result.samples) {
    lines.push(`sample,,${p.u.toFixed(2)},${p.v.toFixed(2)},,,${p.value.toFixed(4)},kind=${p.kind};dist=${p.distToPlane.toFixed(2)}`);
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  download(filename, blob);
}

/** Stub estructural — futura impl con three-dxf / dxf-writer. */
export function exportSectionDXF(_result: SectionResult, _filename = "section.dxf"): void {
  throw new Error("exportSectionDXF: not implemented yet");
}

/** Stub estructural — futura impl con pdf-lib o jsPDF. */
export function exportSectionPDF(_result: SectionResult, _filename = "section.pdf"): void {
  throw new Error("exportSectionPDF: not implemented yet");
}
