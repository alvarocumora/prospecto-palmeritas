import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export interface PdfModuleSection {
  id: string;
  title: string;
  element: HTMLElement | null;
}

export interface ExportOptions {
  projectName: string;
  sections: PdfModuleSection[];
  annexes?: Array<{ title: string; rows: Array<[string, string]> }>;
}

const PAGE_W = 210; // A4 mm
const PAGE_H = 297;
const MARGIN = 12;

export async function exportSatelliteIntelPdf(opts: ExportOptions): Promise<Blob> {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const now = new Date();

  // Cover
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text("Informe de Inteligencia Satelital", MARGIN, 40);
  pdf.setFontSize(13);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Proyecto: ${opts.projectName}`, MARGIN, 52);
  pdf.text(`Generado: ${now.toLocaleString()}`, MARGIN, 60);
  pdf.setFontSize(10);
  pdf.setTextColor(120);
  pdf.text(
    "Documento autogenerado a partir del dashboard. Incluye capturas y anexos por módulo:",
    MARGIN,
    78,
  );
  let y = 86;
  opts.sections.forEach((s, i) => {
    pdf.text(`${i + 1}. ${s.title}`, MARGIN + 4, y);
    y += 6;
  });
  pdf.setTextColor(0);

  for (const section of opts.sections) {
    if (!section.element) continue;
    pdf.addPage();
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text(section.title, MARGIN, MARGIN + 4);

    try {
      const canvas = await html2canvas(section.element, {
        backgroundColor: "#0a0a0a",
        scale: 1.4,
        useCORS: true,
        logging: false,
        windowWidth: section.element.scrollWidth,
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.85);
      const availW = PAGE_W - MARGIN * 2;
      const availH = PAGE_H - MARGIN * 2 - 10;
      const ratio = canvas.width / canvas.height;
      let drawW = availW;
      let drawH = drawW / ratio;
      if (drawH > availH) {
        drawH = availH;
        drawW = drawH * ratio;
      }
      const x = (PAGE_W - drawW) / 2;
      pdf.addImage(imgData, "JPEG", x, MARGIN + 8, drawW, drawH);
    } catch (e) {
      pdf.setFontSize(10);
      pdf.setTextColor(180, 0, 0);
      pdf.text(`No se pudo capturar este módulo: ${(e as Error).message}`, MARGIN, MARGIN + 20);
      pdf.setTextColor(0);
    }
  }

  if (opts.annexes && opts.annexes.length) {
    for (const annex of opts.annexes) {
      pdf.addPage();
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text(`Anexo · ${annex.title}`, MARGIN, MARGIN + 4);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      let ay = MARGIN + 14;
      annex.rows.forEach(([k, v]) => {
        if (ay > PAGE_H - MARGIN) {
          pdf.addPage();
          ay = MARGIN + 4;
        }
        pdf.setFont("helvetica", "bold");
        pdf.text(`${k}:`, MARGIN, ay);
        pdf.setFont("helvetica", "normal");
        const wrapped = pdf.splitTextToSize(String(v ?? "—"), PAGE_W - MARGIN * 2 - 50);
        pdf.text(wrapped, MARGIN + 50, ay);
        ay += Math.max(6, wrapped.length * 5);
      });
    }
  }

  // Footer page numbers
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(140);
    pdf.text(`Página ${i} de ${total}`, PAGE_W - MARGIN, PAGE_H - 6, { align: "right" });
    pdf.text("Inteligencia Satelital · Geocapitals", MARGIN, PAGE_H - 6);
  }

  return pdf.output("blob");
}
