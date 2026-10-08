/**
 * Plantilla global C — Dossier Técnico (A4 vertical).
 * Formato editorial para revisión técnica y due diligence: portada sobria,
 * índice, secciones numeradas con figuras y tablas ligeras, y anexo de
 * advertencias. Sustituye el volcado de tablas por bloques legibles.
 */
import type jsPDF from "jspdf";
import { GC_COLOR, GC_PAGE } from "../brand/tokens";
import {
  barChart,
  brandQr,
  donutChart,
  donutLegend,
  editorialTable,
  eyebrow,
  fill,
  fitTableRows,
  font,
  ink,
  paragraph,
  scatterMap,
  stroke,
  title,
} from "../brand/kit";
import type { ProjectDoc } from "../model";
import { appendixTables, blockMetaLine, mainBlocks } from "../narrative";
import { letterhead, section as institutionalSection, verificationSeal } from "../brand/institutional";
import { reportSources, technicalStandard } from "../technicalStandard";

const { w: W, h: H, m: M } = GC_PAGE.a4;
const CW = W - M * 2;
const TOP = 74;
const BOTTOM = H - 56;

export async function renderTechnicalBrief(doc: jsPDF, model: ProjectDoc): Promise<void> {
  const qr = await brandQr(model.liveUrl, 420);
  const issued = new Date().toLocaleDateString("es-CL", { dateStyle: "long" });
  let page = 1;
  let y = TOP;

  const frame = { w: W, h: H, m: M };
  const framework = technicalStandard(model);
  const contents: Array<{ label: string; page: number }> = [];
  const chrome = () => letterhead(doc, frame, {
    unit: "Informes técnicos de proyectos", ref: model.code,
    version: model.docVersion, page, total: 0, issued,
  });
  const nextPage = () => {
    doc.addPage("a4", "portrait"); page += 1; chrome(); y = TOP;
  };
  const need = (space: number) => { if (y + space > BOTTOM) nextPage(); };
  const write = (text: string, size = 9, color = GC_COLOR.inkSoft) => {
    font(doc, "body", "normal", size);
    const lines = doc.splitTextToSize(text, CW) as string[];
    const lh = size * 1.45;
    for (const line of lines) {
      need(lh + 4); font(doc, "body", "normal", size); ink(doc, color);
      doc.text(line, M, y); y += lh;
    }
    y += 7;
  };
  const heading = (num: string, label: string) => {
    font(doc, "display", "bold", 16);
    const lines = doc.splitTextToSize(label, CW) as string[];
    need(42 + lines.length * 18);
    contents.push({ label: `${num} · ${label}`, page });
    y = institutionalSection(doc, frame, y, num, "Informe técnico");
    y += title(doc, M, y, label, 16, CW) + 10;
  };
  const pagedTable = (head: string[], rows: string[][], widths?: number[]): void => {
    let rest = rows;
    if (!rest.length) { write("Sin registros incorporados; información pendiente."); return; }
    while (rest.length) {
      font(doc, "body", "normal", 7.8);
      const fit = fitTableRows(doc, { head, rows: rest, widths, w: CW }, BOTTOM - y);
      if (!fit) {
        if (y === TOP) throw new Error("Una fila excede la página; divida su contenido antes de exportar.");
        nextPage(); continue;
      }
      y += editorialTable(doc, { x: M, y, w: CW, head, rows: rest.slice(0, fit), widths });
      rest = rest.slice(fit); if (rest.length) nextPage();
    }
  };

  /* Portada: identidad institucional y ficha de control, no tarjetas comerciales. */
  chrome();
  y = 110;
  y += title(doc, M, y, "Informe técnico\npreliminar", 30, CW) + 16;
  y += title(doc, M, y, model.name, 23, CW) + 10;
  write(model.subtitle, 10);
  write(`Marco de revisión: ${framework.name}`, 8, GC_COLOR.slate);
  y += 8;
  pagedTable(["CONTROL DOCUMENTAL", "ANTECEDENTE"], [
    ["Proyecto / referencia", `${model.name} · ${model.code}`],
    ["Ubicación", model.location], ["Etapa / mineral", `${model.stage} · ${model.commodity}`],
    ["Versión / fecha de emisión", `${model.docVersion} · ${issued}`],
    ["Preparación", "Geocapitals · compilación de antecedentes del proyecto"],
    ["Fecha efectiva de los datos", "Según cada fuente; no equivale a la fecha de emisión"],
    [framework.reviewerRole, "Revisión, credenciales y firma no acreditadas en esta exportación"],
    ["Estado", "Preliminar · pendiente de revisión técnica independiente"],
  ], [CW * 0.34, CW * 0.66]);
  y += 22;
  write(framework.positioning, 9);
  write("No constituye una declaración de recursos o reservas ni acredita cumplimiento normativo. Las propuestas, analogías y escenarios no son resultados medidos.", 9);
  need(120);
  y = verificationSeal(doc, frame, y, { qr, title: "Expediente del proyecto",
    body: "El QR enlaza a los antecedentes públicos. No certifica este documento, su contenido ni la aprobación de una persona competente.",
    url: model.liveUrl, ref: model.code });

  /* Dos páginas reservadas para un índice con folios reales. */
  nextPage(); const indexStart = page; nextPage(); nextPage();
  heading("01", "Resumen y alcance");
  write("Compilación de antecedentes para revisión técnica y diligencia. Se separan información documental, observaciones, resultados analíticos, interpretación y trabajo propuesto.");
  for (const item of model.thesis) write(item);
  heading("02", "Evidencia, procedencia y confianza");
  pagedTable(["Evidencia", "Clase", "Confianza", "Detalle / fuente"],
    model.dataQuality?.length ? model.dataQuality.map(item => [item.label,
      item.provenance ?? item.status, item.confidence ?? "No evaluada",
      [item.detail, item.source ? `Fuente: ${item.source}` : "Fuente específica pendiente"].join(" · ")
    ]) : [["Inventario pendiente", "PENDING_DD", "No evaluada", "No se incorporó una matriz de evidencia al modelo del proyecto."]],
    [CW * 0.19, CW * 0.17, CW * 0.13, CW * 0.51]);
  y += 18;
  write("OFFICIAL / CERTIFIED: fuente oficial o analítica acreditada. DOCUMENTARY / DECLARED: documento o declaración. OBSERVED: observación. DERIVED / INTERPRETED: cálculo o interpretación. PROPOSED / SCENARIO: propuesta o escenario, no evidencia medida. PENDING_DD: verificación pendiente.", 8, GC_COLOR.slate);

  if (model.map) {
    need(260);
    heading("03", "Propiedad, ubicación y sistemas de coordenadas");
    write(model.map.title, 9);
    if (model.map.imageDataUrl) {
      doc.addImage(model.map.imageDataUrl, "JPEG", M, y, CW, 220, undefined, "FAST");
      stroke(doc, GC_COLOR.hairline);
      doc.setLineWidth(0.7);
      doc.rect(M, y, CW, 220);
      y += 232;
      const source = [model.map.imagery, model.map.source, model.map.crs]
        .filter(Boolean)
        .join(" · ");
      y += paragraph(doc, M, y, source, CW, 6.8, GC_COLOR.slate) + 8;
      if (model.map.caption)
        y += paragraph(doc, M, y, model.map.caption, CW, 8, GC_COLOR.slate) + 12;
    } else {
      scatterMap(doc, {
        x: M,
        y,
        w: CW,
        h: 220,
        points: model.map.points,
        polygons: model.map.polygons,
        caption: model.map.caption,
        labelTop: 6,
      });
      const capLines = model.map.caption
        ? (doc.splitTextToSize(model.map.caption, CW) as string[]).length
        : 0;
      y += 220 + (capLines ? 6 + capLines * 9 + 14 : 14);
    }
  }

  if (model.chart) {
    need(260);
    heading("04", "Resultados analíticos disponibles");
    write(model.chart.title);
    barChart(doc, {
      x: M,
      y,
      w: CW,
      h: 200,
      data: model.chart.data,
      labelA: model.chart.labelA,
      labelB: model.chart.labelB,
      unit: model.chart.unit,
    });
    y += 212;
    if (model.chart.caption)
      y += paragraph(doc, M, y, model.chart.caption, CW, 8.2, GC_COLOR.slate) + 14;
  }

  if (!model.map) {
    heading("03", "Propiedad, ubicación y sistemas de coordenadas");
    write(model.location);
    write("Cartografía y metadatos de coordenadas no incorporados a esta exportación; pendientes de verificación.");
  }
  if (!model.chart) {
    heading("04", "Resultados analíticos disponibles");
    write("No se incorporó un gráfico analítico al documento. Consultar el inventario y anexos; no implica ausencia de resultados en la propiedad.");
  }
  let n = 5;
  const technicalProfile = model.reportProfile ?? "technical";
  for (const section of model.sections.filter(
    (item) => !item.profiles || item.profiles.includes(technicalProfile),
  )) {
    need(120);
    heading(String(n).padStart(2, "0"), section.title);
    if (section.lead) write(section.lead);
    for (const block of mainBlocks(section)) {
      if (block.kind === "narrative" || block.kind === "text") {
        need(50);
        write(block.body);
        const meta = blockMetaLine(block);
        if (meta) write(meta, 7, GC_COLOR.slate);
      }
      if (block.kind === "finding") {
        need(80);
        write(`Hallazgo · ${block.title}`, 9); write(block.body);
        const meta = blockMetaLine(block);
        if (meta) write(meta, 7, GC_COLOR.slate);
      }
      if (block.kind === "evidence") {
        need(80);
        write(`Evidencia · ${block.label} · ${block.provenance}`, 9); write(block.body);
        const meta = blockMetaLine(block);
        if (meta) write(meta, 7, GC_COLOR.slate);
      }
      if (block.kind === "gap") {
        need(80);
        const lines = block.action ? [block.body, `Acción: ${block.action}`] : [block.body];
        write(`Brecha · ${block.title}`, 9); for (const line of lines) write(line);
      }
      if (block.kind === "recommendation") {
        need(80);
        const heading = block.priority
          ? `Recomendación · ${block.priority.toUpperCase()} · ${block.title}`
          : `Recomendación · ${block.title}`;
        write(heading, 9); write(block.body);
      }
      if (block.kind === "figure" || block.kind === "map") {
        need(260);
        y += title(doc, M, y, block.title, 13, CW) + 8;
        const format = block.imageDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
        doc.addImage(block.imageDataUrl, format, M, y, CW, 210, undefined, "FAST");
        stroke(doc, GC_COLOR.hairline);
        doc.setLineWidth(0.7);
        doc.rect(M, y, CW, 210);
        y += 222;
        if (block.caption) y += paragraph(doc, M, y, block.caption, CW, 8, GC_COLOR.slate) + 6;
        const metaParts = [
          block.kind === "map" ? block.imagery : undefined,
          block.kind === "map" ? block.crs : undefined,
          blockMetaLine(block),
        ].filter(Boolean);
        if (metaParts.length) {
          y += paragraph(doc, M, y, metaParts.join(" · "), CW, 6.8, GC_COLOR.slate) + 8;
        }
      }
      if (block.kind === "bullets") {
        need(50);
        for (const item of block.items) write(`- ${item}`);
      }
      if (block.kind === "kv") {
        need(70);
        pagedTable(
          ["Concepto", "Detalle"],
          block.items.map(([k, v]) => [k, v]),
          [CW * 0.34, CW * 0.66],
        );
        y += 16;
      }
      if (block.kind === "table") {
        need(80);
        pagedTable(
          block.head,
          block.rows,
          block.widths?.map((p) => CW * p),
        );
        y += 16;
      }
    }
    n += 1;
  }

  if (model.allocation && model.reportProfile === "investment") {
    need(250);
    eyebrow(doc, M, y, `${String(n).padStart(2, "0")} · Estructura de la ronda`);
    y += 16;
    y += title(doc, M, y, model.allocation.title, 17, CW) + 14;
    donutChart(doc, {
      cx: M + 92,
      cy: y + 86,
      r: 78,
      slices: model.allocation.slices,
      centerTop: model.allocation.centerTop,
      centerSub: model.allocation.centerSub,
    });
    donutLegend(doc, M + 200, y + 34, CW - 200, model.allocation.slices);
    y += 190;
    if (model.allocation.caption)
      y += paragraph(doc, M, y, model.allocation.caption, CW, 8.2, GC_COLOR.slate) + 12;
    n += 1;
  }

  if (model.milestones?.length && model.reportProfile === "investment") {
    need(120);
    eyebrow(doc, M, y, `${String(n).padStart(2, "0")} · Hitos`);
    y += 16;
    y +=
      editorialTable(doc, {
        x: M,
        y,
        w: CW,
        head: ["Plazo", "Hito"],
        rows: model.milestones.map((ms) => [ms.when, ms.what]),
        widths: [CW * 0.22, CW * 0.78],
      }) + 18;
    n += 1;
  }

  heading(String(n++).padStart(2, "0"), "Cobertura del marco y asuntos pendientes");
  write(`Matriz de preparación para ${framework.name}. La existencia de una sección no acredita revisión ni conformidad. Los criterios siguientes requieren comprobación por ${framework.reviewerRole}.`);
  pagedTable(["Criterio", "Requisito de revisión"], framework.checklist.map(item =>
    [item.title, `${item.description} Estado: no acreditado en esta exportación.`]), [CW * 0.32, CW * 0.68]);
  y += 20;
  heading(String(n++).padStart(2, "0"), "Referencias y fuentes documentales");
  const sources = reportSources(model);
  if (sources.length) sources.forEach((source, i) => write(`[${i + 1}] ${source}`));
  else write("No se incorporaron referencias bibliográficas individualizadas. Completar autor, título, fecha y ubicación documental antes de la revisión.");
  heading(String(n++).padStart(2, "0"), "Limitaciones y responsabilidad técnica");
  for (const disclaimer of model.disclaimers) write(disclaimer);
  write("La geofísica predictiva, las analogías regionales y los cuerpos interpretados no acreditan mineralización. Los resultados de otra propiedad no se trasladan a este proyecto.");
  write(`Revisión por ${framework.reviewerRole}: pendiente de acreditar identidad, asociación profesional, experiencia pertinente, visita cuando corresponda, responsabilidades, consentimiento y firma. Esta exportación no genera un certificado de persona competente.`);
  const appendices = appendixTables(model);
  for (const [index, appendix] of appendices.entries()) {
    heading(`Anexo ${String.fromCharCode(65 + index)}`, appendix.block.title);
    const meta = blockMetaLine(appendix.block);
    if (meta) write(meta, 7, GC_COLOR.slate);
    pagedTable(appendix.block.head, appendix.block.rows, appendix.block.widths?.map(p => CW * p));
    y += 18;
  }
  const contact = [model.contact?.name, model.contact?.email, model.contact?.phone].filter(Boolean).join(" · ");
  if (contact) write(`Contacto del proyecto (no acredita rol QP/CP): ${contact}`, 8, GC_COLOR.slate);

  const total = doc.getNumberOfPages();
  const allContents = [{ label: "Control documental", page: 1 }, ...contents];
  let indexPage = indexStart;
  let iy = TOP;
  doc.setPage(indexPage);
  title(doc, M, iy, "Índice del informe", 22, CW); iy += 38;
  font(doc, "body", "normal", 8);
  for (const entry of allContents) {
    font(doc, "body", "normal", 8);
    const lines = doc.splitTextToSize(entry.label, CW - 40) as string[];
    const height = lines.length * 12 + 10;
    if (iy + height > BOTTOM) {
      indexPage += 1;
      if (indexPage > indexStart + 1) throw new Error("El índice excede dos páginas; reduzca las secciones del documento.");
      doc.setPage(indexPage); iy = TOP;
    }
    ink(doc, GC_COLOR.inkSoft); doc.text(lines, M, iy);
    doc.text(String(entry.page), W - M, iy, { align: "right" });
    doc.link(M, iy - 9, CW, height, { pageNumber: entry.page }); iy += height;
  }
  if (indexPage === indexStart) {
    doc.setPage(indexStart + 1);
    title(doc, M, TOP, "Guía de lectura técnica", 20, CW);
    paragraph(doc, M, TOP + 40, framework.positioning, CW, 10);
    paragraph(doc, M, TOP + 110, "Los anexos conservan el detalle de tablas y coordenadas. Cada clase de evidencia conserva su significado: una interpretación derivada de datos certificados no se convierte en evidencia certificada. El QR no valida la exactitud del contenido ni sustituye revisión profesional.", CW, 10);
  }
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    fill(doc, GC_COLOR.white); doc.rect(M, H - 42, CW, 28, "F");
    font(doc, "body", "normal", 6.6); ink(doc, GC_COLOR.slate);
    doc.text(`${model.code} · ${model.docVersion} · ${issued}`, M, H - 31);
    doc.text(`Página ${p} de ${total}`, W - M, H - 31, { align: "right" });
  }
  doc.setPage(total);
}
