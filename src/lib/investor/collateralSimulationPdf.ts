/**
 * Simulación personalizada del programa con colateral (A4).
 * Misma estructura institucional que el memorándum y el resto de documentos.
 */
import { GC_BRAND, GC_COLOR, GC_PAGE } from "@/lib/pdf/brand/tokens";
import { brandQr, ensureBrandFonts, fill, font, ink } from "@/lib/pdf/brand/kit";
import {
  IM_NAVY,
  kvRow,
  letterhead,
  rule,
  section,
  verificationSeal,
  type Frame,
} from "@/lib/pdf/brand/institutional";
import {
  COLLATERAL_DISCLAIMERS,
  COLLATERAL_DOC_VERSION,
  COLLATERAL_TERMS,
  fmtClp,
  monthlyInterestClp,
} from "./collateralProgram";

const F: Frame = { w: GC_PAGE.a4.w, h: GC_PAGE.a4.h, m: 56 };
const CW = F.w - F.m * 2;

export async function downloadCollateralSimulation(
  amount: number,
  months: number,
  liveUrl: string,
): Promise<void> {
  const { default: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  await ensureBrandFonts(doc);
  const qr = await brandQr(liveUrl, 360);
  const now = new Date();
  const issued = now.toLocaleDateString("es-CL", { dateStyle: "long" });
  const ref = `SIM-GC-COL-${now.toISOString().slice(0, 10).replace(/-/g, "")}`;
  const t = COLLATERAL_TERMS;
  const monthly = monthlyInterestClp(amount);
  const TOTAL = 2;
  const head = {
    unit: "Estructuración de Capital",
    ref,
    version: COLLATERAL_DOC_VERSION,
    total: TOTAL,
    issued,
  };

  letterhead(doc, F, { ...head, page: 1 });
  let y = 92;
  font(doc, "body", "bold", 7.4);
  ink(doc, [185, 138, 47]);
  doc.text("SIMULACIÓN PERSONALIZADA", F.m, y, { charSpace: 0.8 });
  y += 22;
  font(doc, "display", "normal", 21);
  ink(doc, IM_NAVY);
  doc.text("Mutuo reajustable en UF con garantía inmobiliaria", F.m, y);
  y += 16;
  font(doc, "display", "italic", 11);
  ink(doc, GC_COLOR.inkSoft);
  doc.text(
    `Monto ${fmtClp(amount)} · plazo ${months} meses · UF + ${t.annualRatePct} % anual`,
    F.m,
    y,
  );
  y += 26;

  // Cifras clave
  const kpis: Array<[string, string]> = [
    ["Interés mensual", fmtClp(monthly)],
    [`Intereses en ${months} meses`, fmtClp(monthly * months)],
    ["Capital al vencimiento", `${fmtClp(amount)} + UF`],
  ];
  const kw = CW / 3;
  rule(doc, F, y, IM_NAVY, 1.2);
  kpis.forEach(([k, v], i) => {
    const x = F.m + i * kw;
    if (i > 0) doc.line(x, y + 10, x, y + 54);
    font(doc, "body", "bold", 6.6);
    ink(doc, GC_COLOR.slate);
    doc.text(k.toUpperCase(), x + (i ? 12 : 0), y + 18, { charSpace: 0.5 });
    font(doc, "display", "normal", 19);
    ink(doc, IM_NAVY);
    doc.text(v, x + (i ? 12 : 0), y + 44);
  });
  rule(doc, F, y + 62);
  y += 76;

  y = section(doc, F, y, "01", "Parámetros de la simulación");
  for (const [k, v] of [
    ["Monto", fmtClp(amount)],
    ["Plazo", `${months} meses (renovación cada ${t.reinvestEveryMonths} meses)`],
    ["Tasa", `UF + ${t.annualRatePct},00 % anual, cálculo nominal ${t.annualRatePct} % / 12`],
    ["Pago", `${t.interestPayment}, mes vencido`],
    [
      "Garantía",
      `Parcela de ${t.collateralSizes.join(" o ")} en la ${t.collateralRegion}, con rol individual SII`,
    ],
    ["Forma del gravamen", "Hipoteca y prohibición de enajenar, sujeta a confirmación legal"],
  ] as Array<[string, string]>)
    y = kvRow(doc, F, y, k, v, 118);
  for (const m of [12, 24, 36])
    y = kvRow(
      doc,
      F,
      y,
      `Comparativo ${m} meses`,
      `Intereses ${fmtClp(monthly * m)} · total recibido ${fmtClp(amount + monthly * m)} + UF`,
      118,
    );
  y += 12;

  y = section(doc, F, y, "02", "Calendario de intereses (nominal, sin reajuste UF)");
  const cols = ["Mes", "Interés", "Acumulado"];
  const cw = [0.2, 0.4, 0.4].map((p) => p * CW);
  const drawHead = () => {
    fill(doc, [241, 244, 246]);
    doc.rect(F.m, y - 9, CW, 16, "F");
    font(doc, "body", "bold", 7);
    ink(doc, IM_NAVY);
    let x = F.m + 4;
    cols.forEach((c, i) => {
      doc.text(c.toUpperCase(), x, y + 2);
      x += cw[i];
    });
    y += 16;
  };
  drawHead();
  let page = 1;
  for (let m = 1; m <= months; m++) {
    if (y > F.h - 70) {
      doc.addPage("a4", "portrait");
      page += 1;
      letterhead(doc, F, { ...head, page });
      y = 92;
      drawHead();
    }
    font(doc, "body", "normal", 7.8);
    ink(doc, GC_COLOR.ink);
    doc.text(String(m).padStart(2, "0"), F.m + 4, y);
    doc.text(fmtClp(monthly), F.m + 4 + cw[0], y);
    doc.text(fmtClp(monthly * m), F.m + 4 + cw[0] + cw[1], y);
    rule(doc, F, y + 4);
    y += 13;
  }

  if (page < 2) {
    doc.addPage("a4", "portrait");
    page = 2;
    letterhead(doc, F, { ...head, page });
    y = 92;
  } else y += 16;

  y = section(doc, F, y, "03", "Verificación");
  y = verificationSeal(doc, F, y, {
    qr,
    title: "Verificación de la simulación",
    body: "Escanee el código para repetir esta simulación, revisar la cartera de garantía y solicitar acceso a la sala privada de documentos legales tras validación KYC.",
    url: liveUrl,
    ref,
  });

  y = section(doc, F, y, "04", "Advertencias legales");
  font(doc, "body", "normal", 7.2);
  ink(doc, GC_COLOR.inkSoft);
  [
    "Simulación referencial con el cálculo nominal de la tasa pactada; no incluye reajuste UF ni impuestos.",
    ...COLLATERAL_DISCLAIMERS,
    "Contrato bilateral privado; no constituye oferta pública de valores (Ley N 18.045).",
  ].forEach((d, i) => {
    const l = doc.splitTextToSize(d, CW - 16) as string[];
    doc.text(`${i + 1}.`, F.m, y);
    doc.text(l, F.m + 14, y);
    y += l.length * 9 + 3;
  });

  // Corregir total de páginas si el calendario usó más de 2
  const total = doc.getNumberOfPages();
  if (total !== TOTAL) {
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      fill(doc, GC_COLOR.white);
      doc.rect(F.w - F.m - 90, F.h - 40, 90, 14, "F");
      font(doc, "body", "normal", 6.6);
      ink(doc, GC_COLOR.slate);
      doc.text(`Página ${p} de ${total}`, F.w - F.m, F.h - 31, { align: "right" });
    }
  }

  doc.setProperties({ title: `${GC_BRAND.name} - Simulación de inversión con colateral` });
  doc.save(`Geocapitals_Simulacion_Colateral_${Math.round(amount / 1e6)}MM_${months}m.pdf`);
}
