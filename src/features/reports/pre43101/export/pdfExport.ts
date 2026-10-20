// Export PDF Pre-NI 43-101 con la estructura institucional común (pleca, membrete,
// control documental, responsabilidad técnica, folio). Las secciones del informe
// en pantalla se insertan como figuras dentro del marco institucional.
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { GC_COLOR, GC_PAGE } from "@/lib/pdf/brand/tokens";
import { editorialTable, ensureBrandFonts, paragraph, title } from "@/lib/pdf/brand/kit";
import { folio, letterhead, section } from "@/lib/pdf/brand/institutional";

export async function exportReportToPDF(opts: {
  rootElementId: string;
  filename: string;
  projectName: string;
}) {
  const root = document.getElementById(opts.rootElementId);
  if (!root) throw new Error("Informe no encontrado en el DOM");
  const sections = root.querySelectorAll<HTMLElement>("section[id^='sec-']");
  if (sections.length === 0) throw new Error("No hay secciones para exportar");

  const { w: W, h: H, m: M } = GC_PAGE.a4;
  const frame = { w: W, h: H, m: M };
  const CW = W - M * 2;
  const TOP = 74;
  const BOTTOM = H - 56;
  const issued = new Date().toLocaleDateString("es-CL", { dateStyle: "long" });
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  await ensureBrandFonts(pdf);
  const chrome = (page: number) =>
    letterhead(pdf, frame, {
      unit: "Informes de proyectos",
      ref: "PRE-43101",
      version: "v1",
      page,
      total: 0,
      issued,
      deferFooter: true,
    });

  let page = 1;
  chrome(page);
  let y = 110;
  y += title(pdf, M, y, "Informe técnico\npreliminar Pre-NI 43-101 / JORC", 28, CW) + 16;
  y += title(pdf, M, y, opts.projectName, 22, CW) + 14;
  y += editorialTable(pdf, {
    x: M,
    y,
    w: CW,
    head: ["CONTROL DOCUMENTAL", "ANTECEDENTE"],
    rows: [
      ["Proyecto", opts.projectName],
      ["Fecha de emisión", issued],
      ["Fecha efectiva de los datos", "Según cada fuente; no equivale a la fecha de emisión"],
      ["Preparación", "Geocapitals · compilación asistida (narrativa IA revisable)"],
      ["Estado", "Preliminar · pendiente de revisión por Qualified / Competent Person"],
    ],
    widths: [CW * 0.34, CW * 0.66],
  });
  y += 16;
  y += editorialTable(pdf, {
    x: M,
    y,
    w: CW,
    head: ["RESPONSABILIDAD TÉCNICA", "NOMBRE / ESTADO", "FIRMA"],
    rows: [
      ["Preparado por", "Geocapitals · equipo técnico", "Compilación"],
      ["Revisado por", "QP / CP · no designado", "Pendiente"],
      ["Aprobado para emisión", "No acreditado en esta exportación", "Pendiente"],
    ],
    widths: [CW * 0.3, CW * 0.48, CW * 0.22],
  });
  y += 20;
  paragraph(
    pdf,
    M,
    y,
    "Documento confidencial. No constituye una declaración de recursos o reservas bajo NI 43-101, JORC ni CH 20235, ni acredita cumplimiento normativo. Las narrativas generadas con IA son interpretación revisable, no hechos verificados. Invertir en minería implica riesgo de pérdida total y baja liquidez.",
    CW,
    8.4,
    GC_COLOR.slate,
  );

  let n = 0;
  for (const sec of Array.from(sections)) {
    n += 1;
    pdf.addPage("a4", "portrait");
    page += 1;
    chrome(page);
    y = TOP;
    const label = sec.querySelector("h2,h3")?.textContent?.trim() || `Sección ${n}`;
    y = section(pdf, frame, y, String(n).padStart(2, "0"), label.slice(0, 70));
    const canvas = await html2canvas(sec, {
      backgroundColor: "#ffffff",
      scale: 2,
      logging: false,
      useCORS: true,
    });
    const ptPerPx = CW / canvas.width;
    let pos = 0;
    while (pos < canvas.height) {
      const room = BOTTOM - y;
      const slicePx = Math.min(Math.floor(room / ptPerPx), canvas.height - pos);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = slicePx;
      slice.getContext("2d")!.drawImage(canvas, 0, -pos);
      pdf.addImage(slice.toDataURL("image/jpeg", 0.9), "JPEG", M, y, CW, slicePx * ptPerPx);
      pos += slicePx;
      if (pos < canvas.height) {
        pdf.addPage("a4", "portrait");
        page += 1;
        chrome(page);
        y = TOP;
      }
    }
  }

  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    folio(pdf, frame, { page: i, total, issued });
  }
  pdf.save(opts.filename);
}
