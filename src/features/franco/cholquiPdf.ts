/**
 * PDF de inversión del Proyecto Cholqui — Geocapitals.
 * Client-only: jsPDF / autotable / qrcode se importan dinámicamente.
 * Toda la data viene de `./data/cholqui` (fuente única). Nada se infiere.
 */
import { publicUrl } from "@/lib/publicUrl";
import {
  CHOLQUI,
  CHOLQUI_ARIDOS,
  CHOLQUI_ASSAYS,
  CHOLQUI_ASSAY_REPORT,
  CHOLQUI_ASSUMPTIONS,
  CHOLQUI_BASE_CASE,
  CHOLQUI_CAVEATS,
  CHOLQUI_CONCEPTUAL,
  CHOLQUI_ENAMI,
  CHOLQUI_FACTS,
  CHOLQUI_GAPS,
  CHOLQUI_GEOLOGY,
  CHOLQUI_GUARANTEES,
  CHOLQUI_GUARANTEE_TOTALS,
  CHOLQUI_HIGHLIGHTS,
  CHOLQUI_PLAN_TONNES,
  CHOLQUI_POINTS,
  CHOLQUI_ROUND,
  CHOLQUI_SCENARIOS,
  LAS_MINITAS,
  fmtClp,
  fmtClpM,
  fmtUsd,
  solubleRatioPct,
} from "./data/cholqui";

const INK: [number, number, number] = [18, 22, 26];
const PAPER: [number, number, number] = [245, 242, 236];
const COBALT: [number, number, number] = [36, 71, 214];
const SLATE: [number, number, number] = [110, 118, 126];
const HAIR: [number, number, number] = [227, 224, 216];
const COPPER: [number, number, number] = [192, 112, 58];

export const CHOLQUI_LIVE_URL = publicUrl(CHOLQUI.liveUrl);

/** Versión del documento: cambia con el contenido, se imprime en el pie. */
export const CHOLQUI_DOC_VERSION = "v1.0";

export async function downloadCholquiInvestmentPdf(): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const QR = await import("qrcode");

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 48;
  const CW = W - M * 2;
  const issued = new Date().toLocaleDateString("es-CL", { dateStyle: "long" });

  const qr = await QR.toDataURL(CHOLQUI_LIVE_URL, {
    margin: 1,
    width: 420,
    color: { dark: "#12161A", light: "#FFFFFF" },
  });

  let y = 0;
  let page = 0;

  const paperBg = () => {
    pdf.setFillColor(...PAPER);
    pdf.rect(0, 0, W, H, "F");
  };

  const footer = () => {
    page += 1;
    pdf.setDrawColor(...HAIR);
    pdf.setLineWidth(0.6);
    pdf.line(M, H - 44, W - M, H - 44);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.8);
    pdf.setTextColor(...SLATE);
    pdf.text(
      `Geocapitals · ${CHOLQUI.name} (${CHOLQUI.code}) · ${CHOLQUI_DOC_VERSION} · ${issued}`,
      M,
      H - 30,
    );
    pdf.text(`geocapitals.com${CHOLQUI.liveUrl}  ·  pág. ${page}`, W - M, H - 30, {
      align: "right",
    });
  };

  const newPage = () => {
    footer();
    pdf.addPage();
    paperBg();
    y = M + 8;
  };

  const ensure = (need: number) => {
    if (y + need > H - 70) newPage();
  };

  const h1 = (kicker: string, title: string) => {
    ensure(64);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...COBALT);
    pdf.text(kicker.toUpperCase(), M, y);
    y += 16;
    pdf.setFont("times", "bold");
    pdf.setFontSize(19);
    pdf.setTextColor(...INK);
    pdf.text(title, M, y);
    y += 10;
    pdf.setDrawColor(...COBALT);
    pdf.setLineWidth(1.4);
    pdf.line(M, y, M + 54, y);
    y += 18;
  };

  const para = (t: string, color = INK, size = 9.4) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(t, CW) as string[];
    for (const line of lines) {
      ensure(14);
      pdf.text(line, M, y);
      y += 13;
    }
    y += 6;
  };

  const bullets = (items: string[]) => {
    for (const it of items) {
      const lines = pdf.splitTextToSize(it, CW - 16) as string[];
      ensure(lines.length * 13 + 4);
      pdf.setFillColor(...COPPER);
      pdf.rect(M, y - 5, 4, 4, "F");
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.4);
      pdf.setTextColor(...INK);
      lines.forEach((line, i) => {
        pdf.text(line, M + 14, y + i * 13);
      });
      y += lines.length * 13 + 6;
    }
    y += 4;
  };

  const table = (head: string[], body: (string | number)[][]) => {
    autoTable(pdf, {
      startY: y,
      head: [head],
      body: body as never,
      margin: { left: M, right: M },
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8.4, cellPadding: 5, textColor: INK, lineColor: HAIR },
      headStyles: { fillColor: INK, textColor: PAPER, fontSize: 7.6, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 248, 244] },
      didDrawPage: () => {},
    });
    const fin = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    y = fin + 18;
  };

  const disclaimer = (t: string) => {
    const lines = pdf.splitTextToSize(t, CW - 20) as string[];
    ensure(lines.length * 10 + 18);
    pdf.setFillColor(238, 234, 226);
    pdf.rect(M, y - 8, CW, lines.length * 10 + 16, "F");
    pdf.setDrawColor(...COPPER);
    pdf.setLineWidth(1.6);
    pdf.line(M, y - 8, M, y + lines.length * 10 + 8);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(7.4);
    pdf.setTextColor(...SLATE);
    lines.forEach((line, i) => pdf.text(line, M + 12, y + 4 + i * 10));
    y += lines.length * 10 + 26;
  };

  // ── Portada ───────────────────────────────────────────────────────────────
  paperBg();
  pdf.setFillColor(...INK);
  pdf.rect(0, 0, W, 300, "F");
  pdf.setFillColor(...COBALT);
  pdf.rect(0, 300, W * 0.34, 4, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(...PAPER);
  pdf.text("GEOCAPITALS · INVESTMENT BRIEF", M, 62);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.2);
  pdf.setTextColor(150, 158, 168);
  pdf.text("Mining assets intelligence · geocapitals.com", M, 76);

  pdf.setFont("times", "bold");
  pdf.setFontSize(34);
  pdf.setTextColor(...PAPER);
  pdf.text(CHOLQUI.name, M, 150);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(178, 190, 240);
  pdf.text(`${CHOLQUI.commodity} · ${CHOLQUI.region} · ${CHOLQUI.country}`, M, 174);
  pdf.setTextColor(150, 158, 168);
  pdf.setFontSize(8.6);
  pdf.text(
    `Código ${CHOLQUI.code} · Etapa: ${CHOLQUI.stage} · Titular: ${CHOLQUI.operator}`,
    M,
    192,
  );
  pdf.text(`Emisión: ${issued} · Documento ${CHOLQUI_DOC_VERSION}`, M, 208);

  pdf.addImage(qr, "PNG", W - M - 78, 128, 78, 78);
  pdf.setFontSize(6.4);
  pdf.setTextColor(150, 158, 168);
  pdf.text("VER LIVE MAP", W - M - 78, 218);

  // Banda KPI sobre la portada
  const kpis: Array<[string, string]> = [
    ["SUPERFICIE", `~${CHOLQUI.areaHa.toLocaleString("es-CL")} ha`],
    ["PROPIEDAD", `${CHOLQUI.pedimentos} pedimentos · ${CHOLQUI.pertenencias} pertenencias`],
    ["VECINO EN PRODUCCIÓN", `${LAS_MINITAS.name} ~${LAS_MINITAS.throughputTMonth.toLocaleString("es-CL")} t/mes`],
    ["RONDA", `${fmtUsd(CHOLQUI_ROUND.roundSizeUsd)} · ${CHOLQUI_ROUND.equityOfferedPct}% equity`],
  ];
  let ky = 244;
  kpis.forEach(([k, v], i) => {
    const x = M + (CW / 2) * (i % 2);
    if (i === 2) ky = 274;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.4);
    pdf.setTextColor(150, 158, 168);
    pdf.text(k, x, ky - 10);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...PAPER);
    pdf.text(v, x, ky + 2, { maxWidth: CW / 2 - 24 });
  });

  y = 340;
  h1("01 · Resumen ejecutivo", "Qué es el Proyecto Cholqui");
  para(
    `${CHOLQUI.name} es un proyecto de exploración avanzada de cobre, oro y plata en ${CHOLQUI.location}. Controla aproximadamente ${CHOLQUI.areaHa.toLocaleString("es-CL")} hectáreas mediante ${CHOLQUI.pedimentos} pedimentos y ${CHOLQUI.pertenencias} pertenencias, que rodean a ${LAS_MINITAS.name}, una faena de un tercero en producción sobre la misma estructura geológica. Acceso: ${CHOLQUI.access}.`,
  );
  bullets([...CHOLQUI_HIGHLIGHTS]);
  disclaimer(
    "El proyecto NO cuenta con estimación de recursos ni reservas bajo un estándar reconocido. Toda cifra económica de este documento corresponde a escenarios ilustrativos de sensibilidad.",
  );

  // ── Ubicación y propiedad ────────────────────────────────────────────────
  newPage();
  h1("02 · Ubicación y propiedad", "Qué controla actualmente la compañía");
  table(
    ["Campo", "Valor"],
    [
      ["Ubicación", CHOLQUI.location],
      ["Centroide (WGS84)", `${CHOLQUI.center.lat}, ${CHOLQUI.center.lng}`],
      ["Sistema de referencia", CHOLQUI.crs],
      ["Superficie", `~${CHOLQUI.areaHa.toLocaleString("es-CL")} ha`],
      ["Estructura de propiedad", `${CHOLQUI.pedimentos} pedimentos + ${CHOLQUI.pertenencias} pertenencias`],
      ["Titular", `${CHOLQUI.operator} (dominio a verificar contra acreditación)`],
      ["Acceso", CHOLQUI.access],
      ["Vecindad", `${LAS_MINITAS.name} (${LAS_MINITAS.holder}) · ~${LAS_MINITAS.areaHa} ha · pertenencias colindantes de Yamana Gold`],
    ],
  );
  para(
    "El plano de pertenencias del titular debe digitalizarse y reproyectarse desde PSAD'56 19H a WGS84 para su cruce definitivo con el catastro minero. Geocapitals mantiene el cruce automatizado del polígono contra concesiones vigentes en el live map del proyecto.",
    SLATE,
    8.6,
  );

  // ── Evidencia geológica ──────────────────────────────────────────────────
  h1("03 · Evidencia", "Evidencia de mineralización");
  table(
    ["Dimensión", "Antecedente"],
    [
      ["Litología", CHOLQUI_GEOLOGY.litologia],
      ["Estilo de mineralización", CHOLQUI_GEOLOGY.estilo],
      ["Mineralogía observada", CHOLQUI_GEOLOGY.mineralogia],
      ["Observaciones de terreno", `${CHOLQUI_GEOLOGY.observaciones} puntos`],
      ["Cuerpos mineralizados descritos", `${CHOLQUI_GEOLOGY.cuerpos}`],
      ["Muestras a laboratorio certificado", `${CHOLQUI_GEOLOGY.muestrasLab}`],
      ["Autores", CHOLQUI_GEOLOGY.autores],
    ],
  );
  disclaimer(
    "Las observaciones mineralógicas de terreno no equivalen a leyes químicas y no permiten inferir tonelaje, continuidad ni ley promedio. El muestreo es de superficie: no hay sondaje propio.",
  );

  // ── Puntos de muestreo ───────────────────────────────────────────────────
  newPage();
  h1("04 · Puntos de terreno", "Observación y muestreo georreferenciado");
  table(
    ["Punto", "Sector", "Este (PSAD'56 19H)", "Norte", "Lat (WGS84)", "Lng (WGS84)"],
    CHOLQUI_POINTS.map((p) => [
      p.code,
      p.name,
      p.utmE.toLocaleString("es-CL"),
      p.utmN.toLocaleString("es-CL"),
      p.lat.toFixed(5),
      p.lng.toFixed(5),
    ]),
  );

  // ── Economía preliminar ──────────────────────────────────────────────────
  newPage();
  h1("05 · Economía preliminar", "Sensibilidad a la ley de cobre soluble");
  para(
    `El modelo entregado considera la venta de mineral oxidado a ENAMI sobre un plan de ${CHOLQUI_PLAN_TONNES.toLocaleString("es-CL")} t en ${CHOLQUI_BASE_CASE.months} meses (${CHOLQUI_BASE_CASE.ramp}). Los escenarios comparten plan minero y costos: sólo cambia la tarifa por ley de cobre soluble según la ${CHOLQUI_ENAMI.circular}. El caso efectivamente modelado es 1,5 % Cu soluble.`,
  );
  table(
    ["Escenario", "Tarifa (CLP/tms)", "Ingresos brutos", "Costos operac.", "Superávit", "Equilibrio"],
    CHOLQUI_SCENARIOS.map((s) => [
      s.label,
      s.tariffClpTms.toLocaleString("es-CL"),
      fmtClpM(s.revenueClp),
      fmtClpM(s.costClp),
      fmtClpM(s.marginClp),
      s.paybackMonth ? `Mes ${s.paybackMonth}` : "No modelado",
    ]),
  );

  // Barras de superávit (dibujadas, sin imágenes externas)
  const maxMargin = Math.max(...CHOLQUI_SCENARIOS.map((s) => s.marginClp));
  ensure(120);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.2);
  pdf.setTextColor(...COBALT);
  pdf.text("SUPERAVIT OPERACIONAL NO DESCONTADO POR ESCENARIO", M, y);
  y += 14;
  const barH = 16;
  CHOLQUI_SCENARIOS.forEach((s) => {
    const w = Math.max(0, ((CW - 170) * s.marginClp) / maxMargin);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.2);
    pdf.setTextColor(...INK);
    pdf.text(s.label, M, y + 11);
    pdf.setFillColor(...COBALT);
    pdf.rect(M + 66, y, w, barH, "F");
    pdf.setTextColor(...SLATE);
    pdf.setFontSize(7.8);
    pdf.text(fmtClpM(s.marginClp), M + 72 + w, y + 11);
    y += barH + 8;
  });
  y += 8;

  h1("06 · Supuestos", "Supuestos comunes a los escenarios");
  table(["Supuesto", "Valor"], CHOLQUI_ASSUMPTIONS.map(([k, v]) => [k, v]));
  disclaimer(
    "Escenarios ilustrativos, sujetos a validación geológica, metalúrgica, de ingeniería y económica. Las leyes de 1,5 % a 3,0 % Cu soluble son hipótesis de sensibilidad tarifaria y NO corresponden a leyes promedio comprobadas ni a recursos minerales. El modelo no incorpora impuestos, financiamiento, cierre de faena, seguros ni permisos, y no contiene VAN ni TIR.",
  );

  // ── Brechas materiales del modelo ────────────────────────────────────────
  newPage();
  h1("06b · Brechas", "Qué falta validar antes de comprometer capital");
  CHOLQUI_GAPS.forEach((g) => para(`— ${g}`, SLATE, 8.6));
  table(
    ["Garantía documentada", "Titular", "Avalúo fiscal", "Estado"],
    CHOLQUI_GUARANTEES.map((g) => [
      g.asset,
      g.holder,
      g.appraisalClp ? fmtClp(g.appraisalClp) : "Sin tasación",
      g.status,
    ]),
  );
  para(
    `Total documentado ${fmtClp(CHOLQUI_GUARANTEE_TOTALS.documentedClp)} · libre de embargo ${fmtClp(CHOLQUI_GUARANTEE_TOTALS.freeOfLiensClp)}. Contrato de áridos: ${CHOLQUI_ARIDOS.minVolumeM3Month.toLocaleString("es-CL")} m³/mes a ${fmtClp(CHOLQUI_ARIDOS.priceClpM3)}/m³ + IVA. ${CHOLQUI_ARIDOS.caveat}`,
    SLATE,
    8.4,
  );
  disclaimer(
    "Los avalúos fiscales no equivalen a tasación comercial ni a valor de realización. El Lote 2 (Rol 16-33) mantiene embargo vigente a favor de la Tesorería General de la República.",
  );

  // ── Estructura de inversión ──────────────────────────────────────────────
  newPage();
  h1("07 · Estructura de inversión", "Qué obtiene el inversionista");
  table(
    ["Término", "Valor referencial"],
    [
      ["Valorización del activo", `${fmtUsd(CHOLQUI_ROUND.valuationLowUsd)} – ${fmtUsd(CHOLQUI_ROUND.valuationHighUsd)} (${CHOLQUI_ROUND.valuationMethod})`],
      ["Ronda", fmtUsd(CHOLQUI_ROUND.roundSizeUsd)],
      ["Ticket mínimo", fmtUsd(CHOLQUI_ROUND.minTicketUsd)],
      ["Instrumento", CHOLQUI_ROUND.instrument],
      ["% ofrecido", `${CHOLQUI_ROUND.equityOfferedPct} %`],
      ["Horizonte", `${CHOLQUI_ROUND.horizonYears} años`],
    ],
  );
  table(
    ["Uso de fondos", "%"],
    CHOLQUI_ROUND.useOfFunds.map((u) => [u.label, `${u.pct} %`]),
  );
  table(
    ["Hito", "Trabajo"],
    CHOLQUI_ROUND.milestones.map((m) => [m.when, m.what]),
  );
  disclaimer(
    "Términos referenciales definidos por Geocapitals como base de conversación. No constituyen oferta pública de valores y están sujetos a due diligence, NDA y acuerdo definitivo.",
  );

  // ── Procedencia y riesgos ────────────────────────────────────────────────
  newPage();
  h1("08 · Procedencia del dato", "Hecho, declarado y por verificar");
  table(
    ["Sección", "Dato", "Valor", "Procedencia", "Fuente"],
    CHOLQUI_FACTS.map((f) => [f.section, f.label, f.value, f.provenance, f.source]),
  );

  h1("09 · Riesgos", "Riesgos principales y plan de de-risking");
  bullets(CHOLQUI_CAVEATS);
  para(
    "Plan de mitigación: gamma-espectrometría 1:10.000 y mapeo de detalle, zanjas en Cuesta Ancha, campaña de sondaje de confirmación, modelo geológico 3D, estimación de recursos por persona calificada y estudios metalúrgicos. Cada etapa reduce incertidumbre y habilita la siguiente valorización.",
  );

  // ── Contacto + verificación ──────────────────────────────────────────────
  ensure(150);
  pdf.setFillColor(...INK);
  pdf.rect(M, y, CW, 118, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.2);
  pdf.setTextColor(178, 190, 240);
  pdf.text("CONTACTO Y VERIFICACIÓN", M + 18, y + 26);
  pdf.setFont("times", "bold");
  pdf.setFontSize(15);
  pdf.setTextColor(...PAPER);
  pdf.text("Geocapitals · Mesa de inversión minera", M + 18, y + 50);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.6);
  pdf.setTextColor(190, 196, 204);
  pdf.text(`Correo: contacto@geocapitals.com · WhatsApp: +56 9 6218 4071`, M + 18, y + 70);
  pdf.text(
    `Titular del proyecto: ${CHOLQUI.contact.name} · ${CHOLQUI.contact.email} · ${CHOLQUI.contact.phone}`,
    M + 18,
    y + 86,
  );
  pdf.text(`Live map verificable: ${CHOLQUI_LIVE_URL}`, M + 18, y + 102);
  pdf.addImage(qr, "PNG", W - M - 88, y + 22, 74, 74);
  y += 134;

  footer();
  pdf.save(`Geocapitals_${CHOLQUI.code}_Investment_Brief_${CHOLQUI_DOC_VERSION}.pdf`);
}
