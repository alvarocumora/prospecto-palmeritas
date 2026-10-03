// Generador de informe PDF del Distrito Cuprífero Los Verdes – Tilama.
// Resumen estilo NI 43-101 (pre-feasibility / informe geológico exploratorio):
// portada, contexto geológico, catastro, anomalías satelitales, targets, disclaimer.
import { jsPDF } from "jspdf";
import type { TilamaReport } from "@/lib/tilama.functions";
import type { LosVerdesMining } from "@/lib/losverdes-veins.functions";
import { publicUrl } from "@/lib/publicUrl";

export const LOS_VERDES_PDF_VERSION = "v2.0";
export const LOS_VERDES_LIVE_URL = publicUrl("/terminal/losverdes");

function fmtNum(v: number | null | undefined, dec = 1): string {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("es-CL", { maximumFractionDigits: dec });
}

export async function generateTilamaPdf(
  report: TilamaReport,
  mining?: LosVerdesMining,
): Promise<jsPDF> {
  const QR = await import("qrcode");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const MARGIN = 56;
  let y = MARGIN;
  const qr = await QR.toDataURL(LOS_VERDES_LIVE_URL, { width: 360, margin: 1 });

  const ensure = (need: number) => {
    if (y + need > pageH - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };
  const h1 = (t: string) => {
    ensure(28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(t, MARGIN, y);
    y += 22;
    doc.setDrawColor(217, 119, 6);
    doc.setLineWidth(1.2);
    doc.line(MARGIN, y - 12, MARGIN + 60, y - 12);
  };
  const h2 = (t: string) => {
    ensure(22);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(t, MARGIN, y);
    y += 16;
  };
  const para = (t: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(t, pageW - MARGIN * 2);
    for (const line of lines) {
      ensure(14);
      doc.text(line, MARGIN, y);
      y += 13;
    }
    y += 4;
  };
  const kv = (k: string, v: string) => {
    ensure(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(k, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(v, MARGIN + 170, y);
    y += 14;
  };

  // Portada
  doc.setFillColor(18, 22, 26);
  doc.rect(0, 0, pageW, 250, "F");
  doc.setFillColor(36, 71, 214);
  doc.rect(0, 250, pageW * 0.34, 4, "F");
  doc.setTextColor(245, 242, 236);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("GEOCAPITALS · STANDARDIZED TECHNICAL REPORT", MARGIN, 54);
  doc.setTextColor(248, 250, 252);
  doc.setFont("times", "bold");
  doc.setFontSize(29);
  doc.text("Distrito Cuprífero", MARGIN, 108);
  doc.text("Los Verdes – Tilama", MARGIN, 142);
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `${report.project.commodity ?? "Cu-Au-Ag"} · ${report.project.region ?? "Coquimbo"} · ${report.project.country ?? "Chile"}`,
    MARGIN,
    174,
  );
  doc.text(`Código: ${report.project.code} · ${LOS_VERDES_PDF_VERSION}`, MARGIN, 194);
  doc.text(`Emisión: ${new Date().toLocaleDateString("es-CL")}`, MARGIN, 210);
  doc.addImage(qr, "PNG", pageW - MARGIN - 116, 70, 116, 116);
  doc.setFontSize(7);
  doc.text("ESCANEAR PARA VER LIVE MAP", pageW - MARGIN, 200, { align: "right" });
  doc.text("geocapitals.com/terminal/losverdes", pageW - MARGIN, 213, { align: "right" });
  y = 286;

  h1("Control documental");
  kv("Referencia:", `${report.project.code}-TR-${LOS_VERDES_PDF_VERSION.replace(".", "-")}`);
  kv("Fuente:", "Base técnica consolidada GeoCapitals");
  kv("Estado de muestreo:", "Borrador · pendiente validación documental / QA-QC");
  kv("Enlace verificable:", LOS_VERDES_LIVE_URL);

  // Resumen ejecutivo
  h1("1. Resumen Ejecutivo");
  para(
    "El presente informe geológico-exploratorio consolida el estado del Distrito Cuprífero Los Verdes – Tilama (sector Tilama, comuna de Los Vilos, Región de Coquimbo), integrando catastro minero vigente, anomalías multiespectrales satelitales, estructura 3D del depósito y portafolio de targets de perforación. El distrito presenta mineralización tipo skarn de Cu acompañada de vetiformes Cu-Au-Ag con enriquecimiento supergénico, hospedada en una secuencia volcano-sedimentaria con controles estructurales N-S, NNE-SSW, NE-SW y NNW-SSE tipo Riedel dextral.",
  );

  h2("Indicadores clave");
  kv(
    "Coordenadas centro:",
    `${report.project.center_lat.toFixed(4)}°, ${report.project.center_lng.toFixed(4)}°`,
  );
  kv(
    "Concesiones activas:",
    `${report.stats.concessionsTotal} (${fmtNum(report.stats.concessionsHa, 0)} ha total)`,
  );
  kv(
    "Anomalías satelitales detectadas:",
    `${report.stats.satTotal} (${report.stats.satHigh} alta · ${report.stats.satMedium} media)`,
  );
  kv(
    "Targets de exploración:",
    `${report.stats.targetsTotal} (${report.stats.targetsCritical} críticos · ${report.stats.targetsHigh} alta prioridad)`,
  );
  kv("Muestras geoquímicas:", `${report.stats.samplesTotal} puntos georreferenciados`);
  kv(
    "Cobre:",
    `Promedio ${fmtNum(report.stats.cuAvgPct, 2)} % · máximo ${fmtNum(report.stats.cuMaxPct, 2)} %`,
  );
  kv(
    "Mineralogía dominante:",
    "Calcopirita · bornita · covelina · calcosina · crisocola · atacamita",
  );

  // Contexto geológico
  h1("2. Contexto Geológico");
  para(
    report.project.description ??
      "Distrito minero Cu-Au-Ag con skarn de Cu y vetiformes con enriquecimiento supergénico.",
  );
  para(
    "Alteraciones reconocidas: potásica, propilítica, hematítica y skarn calcosilicatado. Dos zonas económicas conceptuales han sido definidas: La Guanaca (~3.24 Mt @ 3.5–4 % Cu visual) y Castellana (~506 kt @ 0.8–1 % Cu). Las leyes citadas son estimaciones visuales/conceptuales y NO constituyen recursos minerales bajo norma NI 43-101 / JORC.",
  );

  // Catastro
  h1("3. Catastro Minero");
  para(
    `Se contabilizan ${report.stats.concessionsTotal} concesiones de explotación vigentes en el polígono del proyecto, totalizando ${fmtNum(report.stats.concessionsHa, 0)} hectáreas catastrales.`,
  );
  const concSample = report.concessions.slice(0, 12);
  if (concSample.length) {
    h2("Concesiones representativas");
    // Columnas: Código 70 · Nombre 160 · Titular 200 · Ha 70  (total 500pt)
    const cX = { code: MARGIN, name: MARGIN + 70, holder: MARGIN + 230, ha: MARGIN + 430 };
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Código", cX.code, y);
    doc.text("Nombre", cX.name, y);
    doc.text("Titular", cX.holder, y);
    doc.text("Ha", cX.ha, y, { align: "left" });
    y += 12;
    doc.setLineWidth(0.4);
    doc.setDrawColor(203, 213, 225);
    doc.line(MARGIN, y - 4, pageW - MARGIN, y - 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const clip = (t: string, max: number) => (t.length > max ? t.slice(0, max - 1) + "…" : t);
    for (const c of concSample) {
      ensure(13);
      doc.text(clip(String(c.code ?? "—"), 14), cX.code, y);
      doc.text(clip(String(c.name ?? "—"), 30), cX.name, y);
      doc.text(clip(String(c.holder ?? "—"), 38), cX.holder, y);
      doc.text(fmtNum(c.area_ha, 1), cX.ha, y);
      y += 12;
    }
    y += 6;
  }

  // Anomalías satelitales
  h1("4. Anomalías Multiespectrales (Sentinel-2 / ASTER)");
  para(
    `Análisis de ${report.stats.satTotal} anomalías derivadas de índices espectrales (óxidos de Fe, alteración argílica, clay/sericita, vegetation stress). De ellas, ${report.stats.satHigh} clasifican como severidad alta y ${report.stats.satMedium} como media.`,
  );
  const satTop = report.satAnomalies.slice(0, 12);
  if (satTop.length) {
    h2("Top 12 anomalías por score");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Índice", MARGIN, y);
    doc.text("Severidad", MARGIN + 160, y);
    doc.text("Score", MARGIN + 260, y);
    doc.text("Área (ha)", MARGIN + 340, y);
    y += 12;
    doc.line(MARGIN, y - 4, pageW - MARGIN, y - 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    for (const a of satTop) {
      ensure(13);
      doc.text(String(a.index_code).slice(0, 28), MARGIN, y);
      doc.text(String(a.severity ?? "—"), MARGIN + 160, y);
      doc.text(fmtNum(a.score, 2), MARGIN + 260, y);
      doc.text(fmtNum(a.area_ha, 1), MARGIN + 340, y);
      y += 12;
    }
    y += 6;
  }

  h1("4b. Evidencia Geoquímica de Superficie");
  para(
    `La base consolidada contiene ${report.stats.samplesTotal} muestras georreferenciadas. El cobre promedia ${fmtNum(report.stats.cuAvgPct, 2)} % y alcanza un máximo de ${fmtNum(report.stats.cuMaxPct, 2)} %; los máximos registrados de oro y plata son ${fmtNum(report.stats.auMaxGpt, 3)} g/t Au y ${fmtNum(report.stats.agMaxGpt, 1)} g/t Ag. Estos resultados están cargados en estado borrador y deben validarse contra certificados, cadena de custodia y QA/QC antes de cualquier uso regulatorio.`,
  );
  const topSamples = [...report.samples]
    .sort((a, b) => Number(b.cu_pct ?? 0) - Number(a.cu_pct ?? 0))
    .slice(0, 8);
  if (topSamples.length) {
    h2("Muestras con mayor ley de cobre");
    const x = {
      code: MARGIN,
      cu: MARGIN + 105,
      au: MARGIN + 185,
      ag: MARGIN + 270,
      lab: MARGIN + 355,
    };
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Muestra", x.code, y);
    doc.text("Cu %", x.cu, y);
    doc.text("Au g/t", x.au, y);
    doc.text("Ag g/t", x.ag, y);
    doc.text("Laboratorio", x.lab, y);
    y += 12;
    doc.line(MARGIN, y - 4, pageW - MARGIN, y - 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    for (const sample of topSamples) {
      ensure(13);
      doc.text(sample.sample_code, x.code, y);
      doc.text(fmtNum(sample.cu_pct, 3), x.cu, y);
      doc.text(fmtNum(sample.au_gpt, 3), x.au, y);
      doc.text(fmtNum(sample.ag_gpt, 2), x.ag, y);
      doc.text(String(sample.lab ?? "—").slice(0, 24), x.lab, y);
      y += 12;
    }
    y += 8;
  }

  // Targets
  h1("5. Portafolio de Targets de Exploración");
  para(
    `Se han generado ${report.stats.targetsTotal} targets georreferenciados (${report.stats.targetsCritical} críticos, ${report.stats.targetsHigh} de alta prioridad), priorizados por fusión multi-criterio (estructural + alteración + geoquímica + anomalía satelital).`,
  );
  const tgtTop = report.targets.slice(0, 15);
  if (tgtTop.length) {
    h2("Top 15 targets por score de fusión");
    // Columnas: Código 100 · Nombre 210 · Prioridad 70 · Score 55 · Conf.% 55
    const tX = {
      code: MARGIN,
      name: MARGIN + 100,
      prio: MARGIN + 310,
      score: MARGIN + 380,
      conf: MARGIN + 440,
    };
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Código", tX.code, y);
    doc.text("Nombre", tX.name, y);
    doc.text("Prioridad", tX.prio, y);
    doc.text("Score", tX.score, y);
    doc.text("Conf.%", tX.conf, y);
    y += 12;
    doc.line(MARGIN, y - 4, pageW - MARGIN, y - 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const clip = (t: string, max: number) => (t.length > max ? t.slice(0, max - 1) + "…" : t);
    for (const t of tgtTop) {
      ensure(13);
      doc.text(clip(String(t.code ?? "—"), 20), tX.code, y);
      doc.text(clip(String(t.name ?? "—"), 40), tX.name, y);
      doc.text(String(t.priority ?? "—"), tX.prio, y);
      doc.text(fmtNum(t.score, 1), tX.score, y);
      doc.text(fmtNum(t.confidence_pct, 0), tX.conf, y);
      y += 12;
    }
    y += 6;
  }

  // Estructura 3D
  h1("6. Estructura 3D del Depósito");
  para(
    "El modelo 3D activo en /live/losverdes integra: (i) DEM Copernicus 30 m para el relieve, (ii) imagen satelital, (iii) anomalías multiespectrales extruidas con escala visual, (iv) polígonos catastrales y (v) targets por prioridad. La extrusión es visual/analítica y no representa profundidad geológica real del cuerpo mineralizado.",
  );
  para(
    "Sistemas estructurales mapeados: N-S (regional, eje principal), NNE-SSW (control vetiforme Cu-Au), NE-SW (riedel sintético) y NNW-SSE (riedel antitético). La intersección N-S × NE-SW define los nodos de mayor densidad de mineralización supergénica.",
  );

  // Vetas + plan minero (si hay datos)
  if (mining) {
    h1("6b. Vetas Cu-Au-Ag y Cubicación Conceptual");
    para(
      `Se han mapeado ${mining.veins.length} vetas con cubicación conceptual basada en geometría superficial × potencia × profundidad × densidad. Tonelaje total conceptual: ${fmtNum(mining.totals.veinTonnes / 1000, 0)} kt · valor in-situ: USD ${fmtNum(mining.totals.veinRevenueUsd / 1e6, 1)}M.`,
    );
    if (mining.veins.length) {
      h2("Vetas principales");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text("Código", MARGIN, y);
      doc.text("Nombre", MARGIN + 70, y);
      doc.text("Strk/Dip", MARGIN + 230, y);
      doc.text("Pot. m", MARGIN + 300, y);
      doc.text("Tonelaje", MARGIN + 360, y);
      doc.text("Valor USD", MARGIN + 440, y);
      y += 12;
      doc.line(MARGIN, y - 4, pageW - MARGIN, y - 4);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      for (const v of mining.veins) {
        ensure(13);
        doc.text(String(v.code).slice(0, 14), MARGIN, y);
        doc.text(String(v.name).slice(0, 32), MARGIN + 70, y);
        doc.text(
          `${(v.strike_deg ?? 0).toFixed(0)}/${(v.dip_deg ?? 0).toFixed(0)}`,
          MARGIN + 230,
          y,
        );
        doc.text(fmtNum(v.thickness_m, 1), MARGIN + 300, y);
        doc.text(
          v.cubication ? `${(v.cubication.tonnes / 1000).toFixed(0)} kt` : "—",
          MARGIN + 360,
          y,
        );
        doc.text(
          v.cubication ? `$${(v.cubication.revenueUsd / 1e6).toFixed(1)}M` : "—",
          MARGIN + 440,
          y,
        );
        y += 12;
      }
      y += 6;
    }

    h1("6c. Plan de Explotación Conceptual");
    para(
      `Plan en ${mining.phases.length} fases · tonelaje total ${fmtNum(mining.totals.phaseTonnes / 1e6, 2)} Mt · CAPEX agregado USD ${fmtNum(mining.totals.capexUsdTotal / 1e6, 0)}M · NPV @8% USD ${fmtNum(mining.totals.npvUsdTotal / 1e6, 1)}M.`,
    );
    for (const p of mining.phases) {
      const c = p.cubication;
      h2(`Fase ${p.phase_no} · ${p.name}`);
      kv("Método:", String(p.method ?? "—"));
      kv(
        "Ventana:",
        `Año ${p.start_year} a Año ${(p.start_year ?? 0) + (p.duration_years ?? 0)} (${p.duration_years} años)`,
      );
      kv(
        "Espesor medio / densidad:",
        `${fmtNum(p.avg_thickness_m, 0)} m · ${fmtNum(p.density_tm3, 2)} t/m³`,
      );
      kv("Recovery / OPEX:", `${fmtNum(p.recovery_pct, 0)}% · $${fmtNum(p.opex_usd_t, 1)}/t`);
      if (c) {
        kv("Tonelaje:", `${fmtNum(c.tonnes / 1e6, 2)} Mt`);
        kv("Revenue conceptual:", `USD ${fmtNum(c.revenueUsd / 1e6, 1)}M`);
        kv("CAPEX:", `USD ${fmtNum(c.capexUsd / 1e6, 0)}M`);
        kv("NPV @8%:", `USD ${fmtNum(c.npvUsd / 1e6, 1)}M`);
      }
    }
  }

  // Disclaimer
  h1("7. Disclaimer y Próximos Pasos");
  para(
    "Este documento es un informe pre-NI 43-101 preparado por Geocapitals con fines de exploración temprana y due diligence. Las leyes y tonelajes mencionados son estimaciones conceptuales y NO constituyen recursos minerales informados bajo NI 43-101 (CIM 2014) ni JORC 2012. La conversión a recursos requiere: (i) campaña de perforación diamantina sistemática, (ii) muestreo y aseguramiento QA/QC, (iii) modelamiento geológico 3D validado, (iv) estimación de bloques por Persona Calificada (QP).",
  );
  para(
    "Próximos pasos recomendados: 1) Mapeo geológico de detalle 1:2.000 sobre los 6 targets críticos. 2) Campaña geoquímica de canaletas en estructuras N-S × NE-SW. 3) Perforación diamantina escalonada (8–12 sondajes, 200–300 m). 4) Modelamiento de recursos por QP.",
  );

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Geocapitals · Distrito Los Verdes – Tilama · ${report.project.code}`,
      MARGIN,
      pageH - 24,
    );
    doc.text(`Página ${i} de ${pageCount}`, pageW - MARGIN, pageH - 24, { align: "right" });
    doc.text(LOS_VERDES_PDF_VERSION, pageW / 2, pageH - 24, { align: "center" });
  }

  return doc;
}
