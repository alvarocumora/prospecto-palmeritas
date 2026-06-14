// Export PDF cliente: usa jspdf + html2canvas para capturar el shell del informe.
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

export async function exportReportToPDF(opts: {
  rootElementId: string;
  filename: string;
  projectName: string;
}) {
  const root = document.getElementById(opts.rootElementId);
  if (!root) throw new Error("Informe no encontrado en el DOM");

  const sections = root.querySelectorAll<HTMLElement>("section[id^='sec-']");
  if (sections.length === 0) throw new Error("No hay secciones para exportar");

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 12;

  // Portada
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, pageW, pageH, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.text("INFORME TÉCNICO PRE-NI 43-101 / JORC", margin, 30);
  pdf.setFontSize(24);
  pdf.text(opts.projectName, margin, 60, { maxWidth: pageW - 2 * margin });
  pdf.setFontSize(11);
  pdf.setTextColor(180, 200, 230);
  pdf.text(
    `Generado el ${new Date().toLocaleDateString("es-CL", { year: "numeric", month: "long", day: "numeric" })}`,
    margin,
    80,
  );
  pdf.text("Geocapitals — Mining Intelligence Platform", margin, pageH - 20);
  pdf.setFontSize(8);
  pdf.setTextColor(255, 180, 180);
  pdf.text(
    "Documento confidencial. Modelo preliminar — requiere validación por Qualified Person (QP).",
    margin,
    pageH - 12,
    { maxWidth: pageW - 2 * margin },
  );

  // Secciones
  for (const sec of Array.from(sections)) {
    pdf.addPage();
    const canvas = await html2canvas(sec, {
      backgroundColor: "#ffffff",
      scale: 2,
      logging: false,
      useCORS: true,
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const imgW = pageW - 2 * margin;
    const imgH = (canvas.height * imgW) / canvas.width;

    if (imgH <= pageH - 2 * margin) {
      pdf.addImage(imgData, "JPEG", margin, margin, imgW, imgH);
    } else {
      // Sección larga: paginar verticalmente
      let position = 0;
      const sliceH = pageH - 2 * margin;
      const pxPerMm = canvas.width / imgW;
      while (position < canvas.height) {
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.min(sliceH * pxPerMm, canvas.height - position);
        const ctx = sliceCanvas.getContext("2d")!;
        ctx.drawImage(canvas, 0, -position);
        const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.92);
        const sliceMm = sliceCanvas.height / pxPerMm;
        if (position > 0) pdf.addPage();
        pdf.addImage(sliceData, "JPEG", margin, margin, imgW, sliceMm);
        position += sliceCanvas.height;
      }
    }

    // Footer
    pdf.setFontSize(7);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`Geocapitals · ${opts.projectName} · Pre-NI 43-101`, margin, pageH - 6);
    pdf.text(`${pdf.getNumberOfPages() - 1}`, pageW - margin, pageH - 6, { align: "right" });
  }

  pdf.save(opts.filename);
}
