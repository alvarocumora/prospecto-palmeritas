/**
 * Memorándum ejecutivo del programa de colateral (A4, formato estudio legal / consultora).
 * Sobrio: membrete, bloque PARA/DE/MATERIA, term sheet tabular con hairlines,
 * mecánica numerada, cartera con estado registral y sello de verificación con QR.
 * Client-only; jsPDF se importa dinámicamente.
 */
import type jsPDF from "jspdf";
import { GC_BRAND, GC_COLOR, GC_PAGE } from "@/lib/pdf/brand/tokens";
import { brandQr, ensureBrandFonts, fill, font, ink, stroke } from "@/lib/pdf/brand/kit";
import { letterhead } from "@/lib/pdf/brand/institutional";
import {
  COLLATERAL_DISCLAIMERS,
  COLLATERAL_DOC_VERSION,
  COLLATERAL_PROJECTS,
  COLLATERAL_STEPS,
  COLLATERAL_TERMS,
  fmtClp,
  monthlyInterestClp,
} from "./collateralProgram";

const { w: W, h: H } = GC_PAGE.a4;
const M = 56;
const CW = W - M * 2;
const REF = "MEM-GC-COL-01";

type RGB = readonly [number, number, number];
const NAVY: RGB = [13, 43, 62];
const GOLD: RGB = [185, 138, 47];
const RULE: RGB = [199, 208, 216];

function rule(doc: jsPDF, y: number, c: RGB = RULE, w = 0.5, x1 = M, x2 = W - M) {
  stroke(doc, c as never);
  doc.setLineWidth(w);
  doc.line(x1, y, x2, y);
}

function section(doc: jsPDF, y: number, num: string, label: string): number {
  font(doc, "body", "bold", 7.4);
  ink(doc, GOLD as never);
  doc.text(num, M, y);
  ink(doc, NAVY as never);
  doc.text(label.toUpperCase(), M + 22, y, { charSpace: 0.6 });
  rule(doc, y + 5, NAVY, 0.8);
  return y + 18;
}

/** Fila etiqueta / valor con hairline inferior. Devuelve el nuevo y. */
function kvRow(doc: jsPDF, y: number, k: string, v: string, labelW = 150): number {
  font(doc, "body", "normal", 8.4);
  const lines = doc.splitTextToSize(v, CW - labelW - 8) as string[];
  font(doc, "body", "bold", 7.6);
  ink(doc, GC_COLOR.slate);
  doc.text(k, M, y);
  font(doc, "body", "normal", 8.4);
  ink(doc, GC_COLOR.ink);
  doc.text(lines, M + labelW, y);
  const h = Math.max(1, lines.length) * 11;
  rule(doc, y + h - 4);
  return y + h + 6;
}

function chrome(doc: jsPDF, page: number, total: number, issued: string) {
  letterhead(doc, { w: W, h: H, m: M }, {
    unit: "Estructuración de Capital",
    ref: REF,
    version: COLLATERAL_DOC_VERSION,
    page,
    total,
    issued,
  });
}

export async function downloadCollateralMemo(liveUrl: string): Promise<void> {
  const { default: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  await ensureBrandFonts(doc);
  const qr = await brandQr(liveUrl, 360);
  const issued = new Date().toLocaleDateString("es-CL", { dateStyle: "long" });
  const t = COLLATERAL_TERMS;
  const TOTAL = 2;

  /* ------------------------------ Página 1 ------------------------------ */
  chrome(doc, 1, TOTAL, issued);
  let y = 92;
  font(doc, "body", "bold", 7.4);
  ink(doc, GOLD as never);
  doc.text("MEMORÁNDUM EJECUTIVO", M, y, { charSpace: 0.8 });
  y += 22;
  font(doc, "display", "normal", 21);
  ink(doc, NAVY as never);
  doc.text("Programa de mutuo con garantía inmobiliaria", M, y);
  y += 16;
  font(doc, "display", "italic", 11.5);
  ink(doc, GC_COLOR.inkSoft);
  doc.text(
    "Financiamiento del portafolio minero Geocapitals respaldado por parcelas en el Maule",
    M,
    y,
  );
  y += 20;

  // Bloque PARA / DE / MATERIA
  rule(doc, y, NAVY, 0.8);
  y += 15;
  const meta: Array<[string, string]> = [
    ["PARA", "Inversionistas privados y family offices"],
    ["DE", `${GC_BRAND.name} · Estructuración de Capital`],
    ["FECHA", `Santiago de Chile, ${issued}`],
    [
      "MATERIA",
      "Mutuo reajustable en UF con garantía sobre parcela individual (Hualañé y Licantén)",
    ],
  ];
  for (const [k, v] of meta) {
    font(doc, "body", "bold", 7.4);
    ink(doc, GC_COLOR.slate);
    doc.text(k, M, y);
    font(doc, "body", "normal", 8.6);
    ink(doc, GC_COLOR.ink);
    doc.text(v, M + 70, y);
    y += 14;
  }
  rule(doc, y - 4, NAVY, 0.8);
  y += 18;

  // 1. Resumen
  y = section(doc, y, "01", "Resumen");
  font(doc, "body", "normal", 8.8);
  ink(doc, GC_COLOR.ink);
  const summary =
    `Geocapitals ofrece a inversionistas privados un contrato bilateral de mutuo reajustable en UF, ` +
    `con tasa de UF + ${t.annualRatePct} % anual e intereses pagaderos mensualmente. Cada operación queda ` +
    `respaldada por una parcela específica de la ${t.collateralRegion}, singularizada en el contrato con su ` +
    `rol individual y tasación. La rentabilidad emana del contrato y no depende de resultados futuros de los proyectos mineros.`;
  const sl = doc.splitTextToSize(summary, CW) as string[];
  doc.text(sl, M, y, { lineHeightFactor: 1.45 });
  y += sl.length * 12.8 + 16;

  // 2. Term sheet
  y = section(doc, y, "02", "Términos indicativos");
  const ex = monthlyInterestClp(t.minTicketClp);
  const terms: Array<[string, string]> = [
    ["Instrumento", "Contrato privado de mutuo de dinero reajustable en UF (Ley N 18.010)."],
    ["Monto mínimo", `${fmtClp(t.minTicketClp)} por operación.`],
    ["Tasa", `UF + ${t.annualRatePct},00 % anual sobre capital reajustado.`],
    [
      "Pago de intereses",
      `${t.interestPayment}, mes vencido. Ejemplo: ${fmtClp(ex)} por mes sobre ${fmtClp(t.minTicketClp)}, más reajuste UF.`,
    ],
    [
      "Plazo",
      `${t.reinvestEveryMonths} meses, renovable de común acuerdo o con restitución del capital.`,
    ],
    [
      "Garantía",
      `Parcela de ${t.collateralSizes.join(" o ")} con ${t.collateralRol.replace(/^Rol/, "rol")}; gravamen inscrito en el Conservador de Bienes Raíces competente.`,
    ],
    [
      "Forma del gravamen",
      "Hipoteca y prohibición de enajenar, sujeta a confirmación del asesor legal en el contrato definitivo.",
    ],
    ["Destino de fondos", "Proyectos de pequeña y mediana minería del portafolio Geocapitals."],
    ["Alzamiento", "Al restituirse íntegramente capital e intereses."],
  ];
  for (const [k, v] of terms) y = kvRow(doc, y, k, v, 118);
  y += 12;

  // 3. Mecánica
  y = section(doc, y, "03", "Mecánica de la operación");
  const colW = (CW - 18) / 2;
  COLLATERAL_STEPS.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * (colW + 18);
    const yy = y + row * 50;
    font(doc, "display", "normal", 15);
    ink(doc, GOLD as never);
    doc.text(String(i + 1).padStart(2, "0"), x, yy + 4);
    font(doc, "body", "bold", 8.2);
    ink(doc, NAVY as never);
    doc.text(s.title.replace(/^\d+\.\s*/, ""), x + 24, yy);
    font(doc, "body", "normal", 7.6);
    ink(doc, GC_COLOR.inkSoft);
    doc.text((doc.splitTextToSize(s.body, colW - 24) as string[]).slice(0, 3), x + 24, yy + 11);
  });

  /* ------------------------------ Página 2 ------------------------------ */
  doc.addPage("a4", "portrait");
  chrome(doc, 2, TOTAL, issued);
  y = 92;
  y = section(doc, y, "04", "Cartera de respaldo y estado registral");

  // Tabla editorial
  const head = ["Proyecto", "Comuna", "Sup.", "Parcelas", "Antecedente registral", "Estado"];
  const widths = [0.2, 0.11, 0.1, 0.09, 0.3, 0.2].map((f) => f * CW);
  fill(doc, [241, 244, 246] as never);
  doc.rect(M, y - 9, CW, 16, "F");
  font(doc, "body", "bold", 7);
  ink(doc, NAVY as never);
  let x = M + 4;
  head.forEach((h, i) => {
    doc.text(h.toUpperCase(), x, y + 2);
    x += widths[i];
  });
  y += 16;
  font(doc, "body", "normal", 7.8);
  for (const p of COLLATERAL_PROJECTS) {
    const cells = [
      p.name,
      p.commune,
      `${p.areaHa.toLocaleString("es-CL")} ha`,
      String(p.lots),
      p.registry,
      p.status,
    ];
    const wrapped = cells.map((c, i) => doc.splitTextToSize(c, widths[i] - 8) as string[]);
    const h = Math.max(...wrapped.map((l) => l.length)) * 10 + 8;
    x = M + 4;
    ink(doc, GC_COLOR.ink);
    wrapped.forEach((l, i) => {
      doc.text(l, x, y + 4);
      x += widths[i];
    });
    y += h;
    rule(doc, y - 4);
  }
  font(doc, "body", "italic", 7.2);
  ink(doc, GC_COLOR.slate);
  doc.text(
    doc.splitTextToSize(
      "Titular: Forestal Valle Escondido SpA. Superficies y número de parcelas según planos comerciales; no constituyen tasación. La parcela asignada, su rol individual y su tasación se fijan en cada contrato.",
      CW,
    ) as string[],
    M,
    y + 8,
  );
  y += 38;

  // 5. Clasificación de evidencia
  y = section(doc, y, "05", "Clasificación de la información");
  const ev: Array<[string, string]> = [
    [
      "DOCUMENTAL",
      "Inscripción Fs. 243 N 133 (2012) y Plano N 192 (2023), CBR Licantén; rol matriz SII 168-921.",
    ],
    ["DECLARADO", "Precios de lista y disponibilidad de parcelas informados por la titular."],
    [
      "CONTRACTUAL",
      `Tasa UF + ${t.annualRatePct} % anual y periodicidad de pago, fijadas en el mutuo.`,
    ],
    [
      "PENDIENTE DD",
      "Rol individual, certificado de dominio vigente, gravámenes y tasación de cada parcela asignada.",
    ],
  ];
  for (const [k, v] of ev) y = kvRow(doc, y, k, v, 96);
  y += 12;

  // 6. Verificación (sello con QR)
  y = section(doc, y, "06", "Sala de datos y verificación");
  const boxH = 92;
  stroke(doc, NAVY as never);
  doc.setLineWidth(0.6);
  doc.rect(M, y, CW, boxH);
  doc.addImage(qr, "PNG", M + 12, y + 12, 68, 68, undefined, "FAST");
  font(doc, "body", "bold", 8.4);
  ink(doc, NAVY as never);
  doc.text("Verificación del documento y antecedentes", M + 96, y + 24);
  font(doc, "body", "normal", 7.8);
  ink(doc, GC_COLOR.inkSoft);
  doc.text(
    doc.splitTextToSize(
      "Escanee el código para acceder al simulador contractual, a la cartera de respaldo y solicitar acceso a la sala privada de documentos legales (dominio, gravámenes, planos y tasaciones), habilitada tras validación KYC.",
      CW - 110,
    ) as string[],
    M + 96,
    y + 38,
  );
  font(doc, "body", "normal", 7);
  ink(doc, GC_COLOR.slate);
  doc.text(`${liveUrl.replace(/^https?:\/\//, "")}  ·  Ref. ${REF}`, M + 96, y + 80);
  y += boxH + 22;

  // 7. Advertencias
  y = section(doc, y, "07", "Advertencias legales");
  font(doc, "body", "normal", 7.2);
  ink(doc, GC_COLOR.inkSoft);
  const discl = [
    ...COLLATERAL_DISCLAIMERS,
    "Contrato bilateral privado; no constituye oferta pública de valores en los términos de la Ley N 18.045. Estructura sujeta a revisión del asesor legal de cada parte.",
  ];
  discl.forEach((d, i) => {
    const l = doc.splitTextToSize(d, CW - 16) as string[];
    doc.text(`${i + 1}.`, M, y);
    doc.text(l, M + 14, y);
    y += l.length * 9 + 3;
  });

  // Firma
  y = Math.max(y + 18, H - 112);
  rule(doc, y, GC_COLOR.ink as never, 0.5, M, M + 180);
  font(doc, "body", "bold", 7.6);
  ink(doc, NAVY as never);
  doc.text(`${GC_BRAND.name} · Estructuración de Capital`, M, y + 12);
  font(doc, "body", "normal", 7.2);
  ink(doc, GC_COLOR.slate);
  doc.text(`${GC_BRAND.email} · WhatsApp ${GC_BRAND.whatsapp}`, M, y + 23);

  doc.setProperties({ title: "Geocapitals - Memorándum ejecutivo de inversión con colateral" });
  doc.save(`Geocapitals_Memorandum_Colateral_${COLLATERAL_DOC_VERSION}.pdf`);
}
