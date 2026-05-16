import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function snapshotElement(el: HTMLElement): Promise<HTMLCanvasElement> {
  return await html2canvas(el, {
    backgroundColor: "#0a0a0a",
    scale: 2,
    useCORS: true,
    logging: false,
    allowTaint: true,
  });
}

function addPage(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  title: string,
  subtitle: string,
  isFirst: boolean,
) {
  if (!isFirst) pdf.addPage();
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 36;
  const headerH = 56;

  pdf.setFillColor(10, 10, 10);
  pdf.rect(0, 0, pageW, headerH, "F");
  pdf.setTextColor(212, 175, 55);
  pdf.setFontSize(14);
  pdf.text(title, margin, 30);
  pdf.setTextColor(180, 180, 180);
  pdf.setFontSize(9);
  pdf.text(subtitle, margin, 46);

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
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", x, y, w, h, undefined, "FAST");

  pdf.setTextColor(120, 120, 120);
  pdf.setFontSize(8);
  pdf.text("Geocapitals · Reporte generado automáticamente", margin, pageH - 16);
  pdf.text(new Date().toLocaleString(), pageW - margin, pageH - 16, { align: "right" });
}

export function buildTargetsPDF(opts: {
  mapCanvas: HTMLCanvasElement | null;
  rankingCanvas: HTMLCanvasElement | null;
  projectName: string;
  projectCode: string;
  targetsCount: number;
  layersSummary?: {
    concessionsCount: number;
    holdersCount: number;
    concessionsAreaHa: number;
    anomalyCounts: Record<string, number>;
  };
}) {
  const { mapCanvas, rankingCanvas, projectName, projectCode, targetsCount, layersSummary } = opts;
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const subtitle = `Proyecto ${projectCode} · ${projectName} · ${targetsCount} targets`;
  let first = true;
  if (mapCanvas) {
    addPage(pdf, mapCanvas, "Mapa de Targets", subtitle, first);
    first = false;
  }
  if (rankingCanvas) {
    addPage(pdf, rankingCanvas, "Ranking Ejecutivo", subtitle, first);
    first = false;
  }
  if (layersSummary) {
    if (!first) pdf.addPage();
    const pageW = pdf.internal.pageSize.getWidth();
    const margin = 36;
    pdf.setFillColor(10, 10, 10);
    pdf.rect(0, 0, pageW, 56, "F");
    pdf.setTextColor(212, 175, 55);
    pdf.setFontSize(14);
    pdf.text("Capas activas", margin, 30);
    pdf.setTextColor(180, 180, 180);
    pdf.setFontSize(9);
    pdf.text(subtitle, margin, 46);
    pdf.setTextColor(30, 30, 30);
    pdf.setFontSize(11);
    let y = 90;
    const line = (k: string, v: string) => {
      pdf.setFont("helvetica", "bold");
      pdf.text(`${k}:`, margin, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(v, margin + 180, y);
      y += 18;
    };
    line("Targets", String(targetsCount));
    line("Catastro · concesiones", String(layersSummary.concessionsCount));
    line("Catastro · titulares únicos", String(layersSummary.holdersCount));
    line(
      "Catastro · área total",
      `${layersSummary.concessionsAreaHa.toLocaleString(undefined, { maximumFractionDigits: 1 })} ha`,
    );
    y += 6;
    pdf.setFont("helvetica", "bold");
    pdf.text("Anomalías satelitales", margin, y);
    y += 18;
    pdf.setFont("helvetica", "normal");
    Object.entries(layersSummary.anomalyCounts).forEach(([k, v]) => {
      pdf.text(`• ${k}: ${v}`, margin + 12, y);
      y += 16;
    });
  }
  const fname = `targets-${projectCode}-${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(fname);
}
