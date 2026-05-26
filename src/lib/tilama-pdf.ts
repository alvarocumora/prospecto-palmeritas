// Generador de informe PDF del Distrito Cuprífero Los Verdes – Tilama.
// Resumen estilo NI 43-101 (pre-feasibility / informe geológico exploratorio):
// portada, contexto geológico, catastro, anomalías satelitales, targets, disclaimer.
import { jsPDF } from "jspdf";
import type { TilamaReport } from "@/lib/tilama.functions";

function fmtNum(v: number | null | undefined, dec = 1): string {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("es-CL", { maximumFractionDigits: dec });
}

export function generateTilamaPdf(report: TilamaReport): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const MARGIN = 56;
  let y = MARGIN;

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
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 180, "F");
  doc.setTextColor(217, 119, 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("GEOCAPITALS · INFORME GEOLÓGICO PRE-NI 43-101", MARGIN, 60);
  doc.setTextColor(248, 250, 252);
  doc.setFontSize(22);
  doc.text("Distrito Cuprífero", MARGIN, 100);
  doc.text("Los Verdes – Tilama", MARGIN, 128);
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `${report.project.commodity ?? "Cu-Au-Ag"} · ${report.project.region ?? "Coquimbo"} · ${report.project.country ?? "Chile"}`,
    MARGIN, 152,
  );
  doc.text(`Código: ${report.project.code} · Emisión: ${new Date().toLocaleDateString("es-CL")}`, MARGIN, 166);
  y = 210;

  // Resumen ejecutivo
  h1("1. Resumen Ejecutivo");
  para(
    "El presente informe geológico-exploratorio consolida el estado del Distrito Cuprífero Los Verdes – Tilama (sector Tilama, comuna de Los Vilos, Región de Coquimbo), integrando catastro minero vigente, anomalías multiespectrales satelitales, estructura 3D del depósito y portafolio de targets de perforación. El distrito presenta mineralización tipo skarn de Cu acompañada de vetiformes Cu-Au-Ag con enriquecimiento supergénico, hospedada en una secuencia volcano-sedimentaria con controles estructurales N-S, NNE-SSW, NE-SW y NNW-SSE tipo Riedel dextral.",
  );

  h2("Indicadores clave");
  kv("Coordenadas centro:", `${report.project.center_lat.toFixed(4)}°, ${report.project.center_lng.toFixed(4)}°`);
  kv("Concesiones activas:", `${report.stats.concessionsTotal} (${fmtNum(report.stats.concessionsHa, 0)} ha total)`);
  kv("Anomalías satelitales detectadas:", `${report.stats.satTotal} (${report.stats.satHigh} alta · ${report.stats.satMedium} media)`);
  kv("Targets de exploración:", `${report.stats.targetsTotal} (${report.stats.targetsCritical} críticos · ${report.stats.targetsHigh} alta prioridad)`);
  kv("Mineralogía dominante:", "Calcopirita · bornita · covelina · calcosina · crisocola · atacamita");

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
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Código", MARGIN, y);
    doc.text("Nombre", MARGIN + 90, y);
    doc.text("Titular", MARGIN + 290, y);
    doc.text("Ha", MARGIN + 440, y);
    y += 12;
    doc.setLineWidth(0.4);
    doc.setDrawColor(203, 213, 225);
    doc.line(MARGIN, y - 4, pageW - MARGIN, y - 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    for (const c of concSample) {
      ensure(13);
      doc.text(String(c.code ?? "—").slice(0, 18), MARGIN, y);
      doc.text(String(c.name ?? "—").slice(0, 36), MARGIN + 90, y);
      doc.text(String(c.holder ?? "—").slice(0, 28), MARGIN + 290, y);
      doc.text(fmtNum(c.area_ha, 1), MARGIN + 440, y);
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

  // Targets
  h1("5. Portafolio de Targets de Exploración");
  para(
    `Se han generado ${report.stats.targetsTotal} targets georreferenciados (${report.stats.targetsCritical} críticos, ${report.stats.targetsHigh} de alta prioridad), priorizados por fusión multi-criterio (estructural + alteración + geoquímica + anomalía satelital).`,
  );
  const tgtTop = report.targets.slice(0, 15);
  if (tgtTop.length) {
    h2("Top 15 targets por score de fusión");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Código", MARGIN, y);
    doc.text("Nombre", MARGIN + 70, y);
    doc.text("Prioridad", MARGIN + 290, y);
    doc.text("Score", MARGIN + 370, y);
    doc.text("Conf.%", MARGIN + 430, y);
    y += 12;
    doc.line(MARGIN, y - 4, pageW - MARGIN, y - 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    for (const t of tgtTop) {
      ensure(13);
      doc.text(String(t.code ?? "—").slice(0, 14), MARGIN, y);
      doc.text(String(t.name ?? "—").slice(0, 42), MARGIN + 70, y);
      doc.text(String(t.priority ?? "—"), MARGIN + 290, y);
      doc.text(fmtNum(t.score, 1), MARGIN + 370, y);
      doc.text(fmtNum(t.confidence_pct, 0), MARGIN + 430, y);
      y += 12;
    }
    y += 6;
  }

  // Estructura 3D
  h1("6. Estructura 3D del Depósito");
  para(
    "El modelo 3D activo en /live/tilama integra: (i) DEM Copernicus 30 m para el relieve, (ii) drape de imagen satelital Esri World Imagery, (iii) anomalías multiespectrales extruidas en altura proporcional al score (100–700 m visuales), (iv) polígonos catastrales superpuestos y (v) targets puntuales por prioridad. La extrusión es visual/analítica — no representa profundidad geológica real del cuerpo mineralizado.",
  );
  para(
    "Sistemas estructurales mapeados: N-S (regional, eje principal), NNE-SSW (control vetiforme Cu-Au), NE-SW (riedel sintético) y NNW-SSE (riedel antitético). La intersección N-S × NE-SW define los nodos de mayor densidad de mineralización supergénica.",
  );

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
      MARGIN, pageH - 24,
    );
    doc.text(`Página ${i} de ${pageCount}`, pageW - MARGIN, pageH - 24, { align: "right" });
  }

  return doc;
}
