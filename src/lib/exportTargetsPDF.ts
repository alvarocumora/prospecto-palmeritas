import html2canvas from "html2canvas";
import jsPDF from "jspdf";

async function snapshot(el: HTMLElement): Promise<HTMLCanvasElement> {
  return await html2canvas(el, {
    backgroundColor: "#0a0a0a",
    scale: 2,
    useCORS: true,
    logging: false,
    allowTaint: true,
  });
}

function addImagePage(pdf: jsPDF, canvas: HTMLCanvasElement, title: string, subtitle?: string) {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 36;
  const headerH = 56;

  // Header
  pdf.setFillColor(10, 10, 10);
  pdf.rect(0, 0, pageW, headerH, "F");
  pdf.setTextColor(212, 175, 55);
  pdf.setFontSize(14);
  pdf.text(title, margin, 30);
  if (subtitle) {
    pdf.setTextColor(180, 180, 180);
    pdf.setFontSize(9);
    pdf.text(subtitle, margin, 46);
  }

  // Image scaled to fit
  const maxW = pageW - margin * 2;
  const maxH = pageH - headerH - margin;
  const ratio = canvas.width / canvas.height;
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }
  const x = (pageW - w) / 2;
  const y = headerH + (maxH - h) / 2 + 8;
  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  pdf.addImage(imgData, "JPEG", x, y, w, h, undefined, "FAST");

  // Footer
  pdf.setTextColor(120, 120, 120);
  pdf.setFontSize(8);
  pdf.text("Geocapitals · Reporte generado automáticamente", margin, pageH - 16);
  pdf.text(new Date().toLocaleString(), pageW - margin, pageH - 16, { align: "right" });
}

export async function exportTargetsPDF(opts: {
  mapEl: HTMLElement | null;
  rankingEl: HTMLElement | null;
  projectName: string;
  projectCode: string;
  targetsCount: number;
}) {
  const { mapEl, rankingEl, projectName, projectCode, targetsCount } = opts;
  if (!mapEl && !rankingEl) throw new Error("Sin contenido para exportar");

  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const subtitle = `Proyecto ${projectCode} · ${projectName} · ${targetsCount} targets`;
  let first = true;

  if (mapEl) {
    const canvas = await snapshot(mapEl);
    addImagePage(pdf, canvas, "Mapa de Targets", subtitle);
    first = false;
  }

  if (rankingEl) {
    if (!first) pdf.addPage();
    const canvas = await snapshot(rankingEl);
    addImagePage(pdf, canvas, "Ranking Ejecutivo", subtitle);
  }

  const fname = `targets-${projectCode}-${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(fname);
}
