import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

export type ExportSection = { id: string; label: string };

/**
 * Capture an element and append it across one or more PDF pages (A4 landscape).
 */
async function appendElementToPdf(
  pdf: jsPDF,
  el: HTMLElement,
  title: string,
  isFirstPage: boolean,
) {
  // Wait a frame so any tab transition / chart animation has time to settle.
  await new Promise((r) => setTimeout(r, 350));

  const canvas = await html2canvas(el, {
    backgroundColor: "#0F0B08",
    scale: 1.5,
    useCORS: true,
    logging: false,
    windowWidth: el.scrollWidth,
  });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const headerH = 12;
  const usableW = pageW - margin * 2;
  const usableH = pageH - margin * 2 - headerH;

  const imgW = usableW;
  const imgH = (canvas.height * imgW) / canvas.width;

  const drawHeader = () => {
    pdf.setFillColor(15, 11, 8);
    pdf.rect(0, 0, pageW, margin + headerH, "F");
    pdf.setTextColor(200, 146, 42);
    pdf.setFont("courier", "bold");
    pdf.setFontSize(11);
    pdf.text("TRACKMIN", margin, margin + 4);
    pdf.setTextColor(168, 144, 128);
    pdf.setFont("courier", "normal");
    pdf.setFontSize(7);
    pdf.text("GEOINTEL · TRK-ALH-001 · PROSPECTO PALMERAS", margin + 22, margin + 4);
    pdf.setTextColor(245, 240, 235);
    pdf.setFontSize(9);
    pdf.text(title.toUpperCase(), margin, margin + 10);
    pdf.setDrawColor(58, 46, 40);
    pdf.line(margin, margin + headerH, pageW - margin, margin + headerH);
  };

  const drawFooter = (pageNum: number) => {
    pdf.setTextColor(107, 92, 82);
    pdf.setFont("courier", "normal");
    pdf.setFontSize(7);
    pdf.text(
      `CONFIDENCIAL · INVERSIONES BIOENERGY SPA · © 2026`,
      margin,
      pageH - 4,
    );
    pdf.text(`PG ${pageNum}`, pageW - margin - 12, pageH - 4);
  };

  if (imgH <= usableH) {
    if (!isFirstPage) pdf.addPage();
    drawHeader();
    pdf.addImage(
      canvas.toDataURL("image/jpeg", 0.92),
      "JPEG",
      margin,
      margin + headerH + 2,
      imgW,
      imgH,
    );
    drawFooter(pdf.getNumberOfPages());
    return;
  }

  // Slice tall canvases into multiple pages.
  const sliceHpx = (usableH * canvas.width) / imgW;
  const slices = Math.ceil(canvas.height / sliceHpx);
  for (let i = 0; i < slices; i++) {
    if (!(isFirstPage && i === 0)) pdf.addPage();
    drawHeader();
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = Math.min(sliceHpx, canvas.height - i * sliceHpx);
    const ctx = sliceCanvas.getContext("2d")!;
    ctx.fillStyle = "#0F0B08";
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    ctx.drawImage(
      canvas,
      0,
      i * sliceHpx,
      canvas.width,
      sliceCanvas.height,
      0,
      0,
      canvas.width,
      sliceCanvas.height,
    );
    const sliceImgH = (sliceCanvas.height * imgW) / sliceCanvas.width;
    pdf.addImage(
      sliceCanvas.toDataURL("image/jpeg", 0.92),
      "JPEG",
      margin,
      margin + headerH + 2,
      imgW,
      sliceImgH,
    );
    drawFooter(pdf.getNumberOfPages());
  }
}

function buildCoverPage(pdf: jsPDF) {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  pdf.setFillColor(15, 11, 8);
  pdf.rect(0, 0, pageW, pageH, "F");

  // Gold accent bar
  pdf.setFillColor(200, 146, 42);
  pdf.rect(15, 15, 3, pageH - 30, "F");

  pdf.setTextColor(200, 146, 42);
  pdf.setFont("courier", "bold");
  pdf.setFontSize(28);
  pdf.text("TRACKMIN", 30, 40);

  pdf.setTextColor(168, 144, 128);
  pdf.setFontSize(11);
  pdf.text("GEOINTEL · INTELLIGENCE REPORT", 30, 48);

  pdf.setDrawColor(58, 46, 40);
  pdf.line(30, 60, pageW - 20, 60);

  pdf.setTextColor(245, 240, 235);
  pdf.setFont("courier", "bold");
  pdf.setFontSize(22);
  pdf.text("PROSPECTO PALMERAS", 30, 80);

  pdf.setFont("courier", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(168, 144, 128);
  pdf.text("TRK-ALH-001 · Exploración Au–Cu Epitermal–Mesotermal", 30, 88);

  const lines = [
    ["Operador", "Inversiones Bioenergy SpA"],
    ["Ubicación", "Comuna de Alhué, Provincia Melipilla, Región Metropolitana"],
    ["Coordenadas", "-33.898438, -71.115471 (WGS84)"],
    ["Estado", "Exploración activa"],
    ["Programa", "12 meses · 4 fases · USD 211,310"],
    ["Sondajes", "4 DDH propuestos · 1,030 m"],
    ["Generado", new Date().toLocaleString("es-CL")],
  ];

  let y = 110;
  lines.forEach(([k, v]) => {
    pdf.setTextColor(107, 92, 82);
    pdf.text(k.toUpperCase(), 30, y);
    pdf.setTextColor(245, 240, 235);
    pdf.text(v, 80, y);
    y += 8;
  });

  pdf.setTextColor(163, 45, 45);
  pdf.setFontSize(8);
  pdf.text("CONFIDENCIAL · USO INTERNO", 30, pageH - 25);
  pdf.setTextColor(107, 92, 82);
  pdf.text(
    "Este documento contiene información geológica propietaria. No reproducir sin autorización.",
    30,
    pageH - 18,
  );
}

/**
 * Render every module to PDF by switching tabs sequentially.
 */
export async function exportFullReport(opts: {
  sections: ExportSection[];
  setActive: (id: string) => void;
  getCurrent: () => string;
  captureSelector?: string;
}) {
  const { sections, setActive, captureSelector = "[data-export-root]" } = opts;
  const original = opts.getCurrent();

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  buildCoverPage(pdf);

  for (const section of sections) {
    setActive(section.id);
    // Wait for React to commit + content to mount + map tiles to load.
    await new Promise((r) => setTimeout(r, 700));
    const root = document.querySelector<HTMLElement>(captureSelector);
    if (!root) continue;
    await appendElementToPdf(pdf, root, section.label, false);
  }

  setActive(original);

  pdf.save(`TRK-ALH-001_Trackmin_GeoIntel_${new Date().toISOString().slice(0, 10)}.pdf`);
}
