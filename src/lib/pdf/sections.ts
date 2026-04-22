import autoTable from "jspdf-autotable";
import {
  COLORS,
  PAGE,
  PdfState,
  bullet,
  calloutBox,
  ensureSpace,
  figure,
  h1,
  h2,
  newPage,
  nextTableN,
  p,
  setRGB,
  tableCaption,
  warningBox,
} from "./primitives";
import { drawCrossSection, drawGantt, drawPieChart } from "./figures";
import type { GeologyData } from "@/hooks/useGeologyData";
import type { GeophysicsData } from "@/hooks/useGeophysicsData";

/* ============================================================
   VALIDATION CONTEXT
   Carries data-availability flags so sections can render
   warning callouts when content is missing/pending.
   ============================================================ */

export type Ni43101Validations = {
  assaysStatus: "available" | "pending" | "partial";
  assaysCount: number;
  catastroAvailable: boolean;
  catastroCount: number;
  satelliteAvailable: boolean;
  mapAvailable: boolean;
  geologyAvailable: boolean;
};

export const DEFAULT_VALIDATIONS: Ni43101Validations = {
  assaysStatus: "pending",
  assaysCount: 0,
  catastroAvailable: false,
  catastroCount: 0,
  satelliteAvailable: false,
  mapAvailable: false,
  geologyAvailable: false,
};

/* ============================================================
   PROJECT CONSTANTS (mirror of /routes/index.tsx)
   Kept here so the PDF has zero React dependency.
   ============================================================ */

export const PROJECT = {
  name: "Prospecto Palmeras",
  ref: "TRK-ALH-001",
  operator: "Inversiones Bioenergy SpA",
  coords: { lat: -33.898438, lng: -71.115471 },
  location: "Comuna de Alhué, Provincia Melipilla, Región Metropolitana, Chile",
  status: "Exploración Activa",
  created: "Abril 2026",
  qp: "Geól. Responsable — pendiente designación QP",
};

const PHASES = [
  { n: 1, range: "Meses 1–2", title: "Muestreo superficial", desc: "chip + canal + grab" },
  { n: 2, range: "Meses 3–4", title: "Geofísica IP / Mag", desc: "lineamientos + targets drill" },
  { n: 3, range: "Meses 5–8", title: "Sondajes DDH", desc: "4 perforaciones · 1,030 m" },
  { n: 4, range: "Meses 9–12", title: "Análisis + reporte", desc: "estimación recursos NI 43-101" },
];

const BUDGET = [
  { item: "Sondaje DDH", detail: "1,030 m × USD 120/m", amount: 123600 },
  { item: "Geólogo terreno", detail: "60 días × USD 350/día", amount: 21000 },
  { item: "Muestreo + análisis", detail: "~400 muestras × USD 65", amount: 26000 },
  { item: "Geofísica IP", detail: "15 km × USD 1,200/km", amount: 18000 },
  { item: "Cartografía UAV", detail: "1 vuelo", amount: 3500 },
  { item: "Imprevistos 10%", detail: "Buffer", amount: 19210 },
];
const BUDGET_TOTAL = 211310;

const DDH = [
  { id: "ALH-DDH-001", az: "090°", inc: "-60°", depth: 250, target: "Veta aflorante → sulfuros" },
  { id: "ALH-DDH-002", az: "270°", inc: "-55°", depth: 300, target: "Extensión lateral NW" },
  { id: "ALH-DDH-003", az: "045°", inc: "-70°", depth: 200, target: "Intersección fallas" },
  { id: "ALH-DDH-004", az: "135°", inc: "-65°", depth: 280, target: "Mesotermal profunda" },
];

/* ============================================================
   COVER + TOC
   ============================================================ */

export function renderCover(s: PdfState, locationFigure: string | null) {
  s.chromeEnabled = false;
  const { doc } = s;

  setRGB(doc, "fill", COLORS.paper);
  doc.rect(0, 0, PAGE.width, PAGE.height, "F");

  // Side accent bar
  setRGB(doc, "fill", COLORS.gold);
  doc.rect(12, 12, 3, PAGE.height - 24, "F");

  setRGB(doc, "text", COLORS.gold);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TRACKMIN GeoIntel", 22, 24);
  setRGB(doc, "text", COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Informe Técnico de Exploración · Estilo NI 43-101", 22, 30);

  setRGB(doc, "text", COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("PROSPECTO PALMERAS", 22, 56);
  setRGB(doc, "text", COLORS.goldDark);
  doc.setFontSize(13);
  doc.text("Exploración Au–Cu Epitermal–Mesotermal", 22, 65);

  setRGB(doc, "draw", COLORS.gold);
  doc.setLineWidth(0.6);
  doc.line(22, 70, PAGE.width - 22, 70);

  // Location figure (optional)
  let metaY = 78;
  if (locationFigure) {
    const w = PAGE.width - 44;
    const h = w * 0.5;
    doc.addImage(locationFigure, "JPEG", 22, 78, w, h, undefined, "FAST");
    setRGB(doc, "text", COLORS.muted);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text("Figura portada. Mapa de ubicación AOI · Prospecto Palmeras (WGS84).", 22, 78 + h + 4);
    metaY = 78 + h + 12;
  }

  // Metadata table
  const meta: [string, string][] = [
    ["Código de proyecto", PROJECT.ref],
    ["Operador", PROJECT.operator],
    ["Ubicación", PROJECT.location],
    ["Coordenadas (WGS84)", `${PROJECT.coords.lat.toFixed(5)}, ${PROJECT.coords.lng.toFixed(5)}`],
    ["Tipo de depósito", "Epitermal–Mesotermal Au–Cu (vetas)"],
    ["Estado", PROJECT.status],
    ["Programa", "12 meses · 4 fases · USD 211,310"],
    ["Sondajes propuestos", "4 DDH · 1,030 m totales"],
    ["Persona Calificada (QP)", PROJECT.qp],
    ["Fecha de emisión", new Date().toLocaleDateString("es-CL")],
  ];
  autoTable(doc, {
    startY: metaY,
    body: meta,
    theme: "plain",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 1.6, textColor: COLORS.text },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 55, textColor: COLORS.muted },
      1: { cellWidth: PAGE.width - 44 - 55, textColor: COLORS.text },
    },
    margin: { left: 22, right: 22 },
  });

  // Footer block
  setRGB(doc, "draw", COLORS.rule);
  doc.setLineWidth(0.3);
  doc.line(22, PAGE.height - 30, PAGE.width - 22, PAGE.height - 30);
  setRGB(doc, "text", COLORS.gold);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("CONFIDENCIAL · USO INTERNO", 22, PAGE.height - 24);
  setRGB(doc, "text", COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    "Este informe contiene información geológica propietaria. Reproducción prohibida sin autorización escrita del operador.",
    22,
    PAGE.height - 19,
  );
  doc.text(
    `© ${new Date().getFullYear()} ${PROJECT.operator} · Generado por TRACKMIN GeoIntel`,
    22,
    PAGE.height - 14,
  );

  s.chromeEnabled = true;
}

/** Render TOC (one page reserved). Page numbers patched in second pass. */
export function renderTocPlaceholder(s: PdfState) {
  newPage(s);
  const { doc } = s;
  setRGB(doc, "text", COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("ÍNDICE DE CONTENIDOS", PAGE.margin, s.cursorY + 4);
  s.cursorY += 12;
  setRGB(doc, "draw", COLORS.gold);
  doc.line(PAGE.margin, s.cursorY, PAGE.margin + 40, s.cursorY);
  s.cursorY += 6;
  // Placeholder; real TOC is drawn after all sections are emitted.
}

/** Draw the actual TOC entries on a dedicated page (called after content). */
export function fillToc(s: PdfState, tocPageNum: number, totalPages: number) {
  const { doc } = s;
  doc.setPage(tocPageNum);
  // Erase previous content area
  setRGB(doc, "fill", COLORS.paper);
  doc.rect(0, 18, PAGE.width, 260, "F");

  let y = PAGE.contentTop;
  setRGB(doc, "text", COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("ÍNDICE DE CONTENIDOS", PAGE.margin, y + 4);
  y += 12;
  setRGB(doc, "draw", COLORS.gold);
  doc.setLineWidth(0.6);
  doc.line(PAGE.margin, y, PAGE.margin + 40, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  for (const entry of s.toc) {
    if (y > 275) break;
    const indent = entry.level === 2 ? 8 : 0;
    setRGB(doc, "text", entry.level === 1 ? COLORS.text : COLORS.muted);
    doc.setFont("helvetica", entry.level === 1 ? "bold" : "normal");
    doc.text(entry.label, PAGE.margin + indent, y);
    // Dot leaders
    const labelW = doc.getTextWidth(entry.label);
    const pageStr = String(entry.page);
    const pageW = doc.getTextWidth(pageStr);
    const startX = PAGE.margin + indent + labelW + 2;
    const endX = PAGE.width - PAGE.margin - pageW - 2;
    setRGB(doc, "text", COLORS.hint);
    let x = startX;
    while (x < endX) {
      doc.text(".", x, y);
      x += 1.6;
    }
    setRGB(doc, "text", COLORS.text);
    doc.text(pageStr, PAGE.width - PAGE.margin, y, { align: "right" });
    y += entry.level === 1 ? 6 : 5;
  }

  // Re-stamp footer with page count for entire doc
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    if (pg === 1) continue; // skip cover
    setRGB(doc, "fill", COLORS.paper);
    doc.rect(PAGE.margin + 60, 287, 60, 6, "F"); // clear the prev "Pág X" area
    setRGB(doc, "text", COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`Pág. ${pg} de ${totalPages}`, PAGE.width - PAGE.margin, 290, { align: "right" });
  }
}

/* ============================================================
   EXECUTIVE SUMMARY (no number)
   ============================================================ */

export function renderExecSummary(s: PdfState) {
  newPage(s);
  const { doc } = s;
  setRGB(doc, "fill", COLORS.gold);
  doc.rect(PAGE.margin, s.cursorY - 4, 2, 8, "F");
  setRGB(doc, "text", COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("RESUMEN EJECUTIVO", PAGE.margin + 5, s.cursorY + 2);
  s.cursorY += 7;
  setRGB(doc, "draw", COLORS.gold);
  doc.line(PAGE.margin, s.cursorY, PAGE.margin + 40, s.cursorY);
  s.cursorY += 6;
  s.toc.push({ label: "Resumen Ejecutivo", level: 1, page: s.pageNum });

  p(
    s,
    `El Prospecto Palmeras (${PROJECT.ref}) es un proyecto de exploración Au–Cu epitermal–mesotermal ` +
      `localizado en la comuna de Alhué (Región Metropolitana, Chile), operado por ${PROJECT.operator}. ` +
      `El proyecto abarca un área de interés (AOI) de ~1.5 × 1.2 km centrada en ${PROJECT.coords.lat.toFixed(5)}, ${PROJECT.coords.lng.toFixed(5)} ` +
      `(WGS84), dentro del cinturón aurífero del Distrito Alhué (Fm. Lo Valle, Cretácico Superior). ` +
      `La presencia de palmas chilenas (Jubaea chilensis) como marcador biogeoquímico, asociado a labores antiguas ` +
      `(piques y socavones) y vetas aflorantes con sulfuros, sostiene el modelo de mineralización epitermal de baja-intermedia sulfuración ` +
      `con potencial transición a mesotermal en profundidad.`,
  );

  p(
    s,
    `Este informe describe el contexto geológico regional y local, el modelo de depósito propuesto, los trabajos de exploración ` +
      `planificados (geofísica magnetométrica + IP-CSAMT, geoquímica de superficie, sondajes diamantinos), y un programa de 12 meses ` +
      `dividido en 4 fases con un presupuesto total de USD ${BUDGET_TOTAL.toLocaleString("en-US")}. ` +
      `Se proponen 4 sondajes DDH (1,030 m totales) para test de las principales estructuras mineralizadas identificadas en superficie.`,
  );

  calloutBox(
    s,
    "Recomendaciones principales",
    "1) Validación inmediata de pertenencias mineras vigentes (SERNAGEOMIN). " +
      "2) Notificación CMN por labores prehispánicas dentro del AOI. " +
      "3) Designación formal de Persona Calificada (QP) bajo NI 43-101 antes del inicio de Fase 3 (sondajes). " +
      "4) Levantamiento topográfico UAV + geofísica antes de definir collars finales.",
  );
}

/* ============================================================
   SECTIONS §1 – §14
   ============================================================ */

export function renderSection1_Intro(s: PdfState) {
  h1(s, "Introducción");
  p(
    s,
    `El presente documento corresponde a un Informe Técnico de Exploración estructurado bajo los lineamientos del ` +
      `estándar canadiense NI 43-101 (National Instrument 43-101 Standards of Disclosure for Mineral Projects). ` +
      `Su propósito es presentar el estado geológico y exploratorio actual del Prospecto Palmeras, los trabajos planificados ` +
      `para los próximos 12 meses, y los costos asociados al programa de exploración.`,
  );
  p(
    s,
    `El informe se basa en información geológica regional pública (SERNAGEOMIN, Macrostrat, NOAA EMAG2, BGI WGM2012), ` +
      `inspecciones de campo preliminares realizadas por el equipo Trackmin durante el primer trimestre de 2026, ` +
      `revisión bibliográfica de depósitos análogos en el Distrito Alhué, y modelado conceptual del sistema epitermal–mesotermal.`,
  );
  h2(s, "Términos de referencia");
  bullet(s, [
    "Operador del proyecto: " + PROJECT.operator + ".",
    "Identificador interno: " + PROJECT.ref + ".",
    "Período cubierto: enero 2026 – diciembre 2026 (Fase 1 a Fase 4).",
    "Unidades: SI (m, kg, g/t Au, % Cu); coordenadas en WGS84 lat/lng decimales.",
    "Moneda: USD (referenciado al BCCh de la fecha de emisión).",
  ]);
  h2(s, "Unidades y abreviaturas");
  bullet(s, [
    "Au g/t — gramos de oro por tonelada métrica.",
    "Cu % — porcentaje de cobre en peso.",
    "DDH — Diamond Drill Hole (sondaje diamantino).",
    "IP — Inducción Polarizada (geofísica eléctrica).",
    "CSAMT — Controlled-Source Audio-frequency Magnetotellurics.",
    "AOI — Area of Interest (área de interés del prospecto).",
  ]);
}

export function renderSection2_Reliance(s: PdfState) {
  h1(s, "Confianza en otros expertos");
  p(
    s,
    `El equipo Trackmin se basa en información de fuentes externas calificadas para los aspectos no-geológicos del proyecto: ` +
      `(i) datos de pertenencias mineras y propiedad legal proporcionados por SERNAGEOMIN (Catastro Minero, FeatureServer público); ` +
      `(ii) datos topográficos derivados de SRTM-30m vía servicios Esri; (iii) anomalía magnética total desde NOAA NCEI EMAG2 v3; ` +
      `(iv) gravimetría Bouguer desde Bureau Gravimétrique International (BGI) WGM2012; ` +
      `(v) marco litoestratigráfico regional desde Macrostrat (Universidad de Wisconsin-Madison) y publicaciones de SERNAGEOMIN.`,
  );
  p(
    s,
    `Trackmin no ha verificado independientemente los datos de propiedad legal ni los límites catastrales más allá de la consulta automatizada ` +
      `al servicio público de SERNAGEOMIN. Se recomienda contratar abogado especialista en derecho minero para validación final ` +
      `previo al inicio de actividades de Fase 3 (sondajes).`,
  );
}

export function renderSection3_Property(
  s: PdfState,
  locationFig: string | null,
  catastroRows: { tipo: string; rol: string; nombre: string; titular: string; ha: string; venc: string; intersects: boolean }[],
  validations: Ni43101Validations = DEFAULT_VALIDATIONS,
) {
  h1(s, "Localización y descripción de la propiedad");
  if (!validations.mapAvailable && !locationFig) {
    warningBox(
      s,
      "Mapa no disponible",
      "No se pudo capturar el mapa principal en esta ejecución. La sección continúa con la descripción textual; reintenta con el mapa visible para incluir la figura.",
    );
  }
  h2(s, "Ubicación y accesos");
  p(
    s,
    `El Prospecto Palmeras se localiza en la ${PROJECT.location}, aproximadamente 110 km al SW de Santiago. ` +
      `El acceso principal se realiza por la Ruta G-60 hasta la comuna de Alhué, continuando por caminos vecinales rurales ` +
      `(huellas mineras históricas) hasta el AOI. Las coordenadas del centroide del proyecto son ` +
      `${PROJECT.coords.lat.toFixed(5)}° S, ${PROJECT.coords.lng.toFixed(5)}° W (WGS84).`,
  );

  if (locationFig) {
    figure(s, locationFig, "Mapa de ubicación del Prospecto Palmeras y AOI sobre Macrostrat (geología regional). Fuente: Trackmin GeoIntel.", {
      height: 100,
    });
  }

  h2(s, "Descripción de la propiedad");
  p(
    s,
    `El AOI definido para el proyecto es un polígono de ~1.5 × 1.2 km (≈180 ha) orientado N20°W, encerrando las principales ` +
      `manifestaciones superficiales: vetas aflorantes con sulfuros, labores antiguas (3+ piques y socavones), ` +
      `y un cluster de palmas chilenas (Jubaea chilensis) que se interpreta como indicador biogeoquímico del sistema hidrotermal subyacente.`,
  );

  h2(s, "Tipos de derechos mineros");
  p(
    s,
    `La superposición del AOI con el Catastro Minero de SERNAGEOMIN identifica concesiones de exploración y explotación vigentes. ` +
      `Se distinguen cuatro tipos de origen: Concesiones de Explotación 1983 y 1932, Concesiones de Exploración 1983, y Estacamentos. ` +
      `La verificación de la titularidad y los pagos de patentes vigentes es responsabilidad del operador previo al inicio de trabajos invasivos.`,
  );

  if (!validations.catastroAvailable || catastroRows.length === 0) {
    warningBox(
      s,
      "Catastro no disponible",
      "No se obtuvieron pertenencias del servicio SERNAGEOMIN para el bbox del proyecto en esta ejecución. " +
        "Posibles causas: servicio temporalmente fuera de línea, bbox sin registros, o problema de red. " +
        "El listado de derechos mineros queda incompleto y debe verificarse manualmente antes de la firma del QP.",
    );
  }

  if (catastroRows.length > 0) {
    h2(s, "Pertenencias intersectando el AOI");
    const intersecting = catastroRows.filter((r) => r.intersects);
    if (intersecting.length === 0) {
      p(s, "No se identificaron pertenencias mineras vigentes intersectando el polígono AOI en la consulta más reciente al servicio SERNAGEOMIN.");
    } else {
      p(
        s,
        `Se identificaron ${intersecting.length} pertenencias vigentes que intersectan el polígono AOI. ` +
          `El detalle se presenta a continuación; el listado completo del bbox de consulta se incluye en el Anexo A.`,
      );
      tableCaption(s, "Pertenencias mineras vigentes que intersectan el AOI (SERNAGEOMIN).");
      autoTable(s.doc, {
        startY: s.cursorY,
        head: [["Tipo", "ROL", "Nombre", "Titular", "Ha", "Vencimiento"]],
        body: intersecting.slice(0, 20).map((r) => [r.tipo, r.rol, r.nombre, r.titular, r.ha, r.venc]),
        styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.8, textColor: COLORS.text, overflow: "linebreak" },
        headStyles: { fillColor: COLORS.gold, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
        alternateRowStyles: { fillColor: COLORS.panel },
        margin: { left: PAGE.margin, right: PAGE.margin },
        didDrawPage: (data) => {
          s.cursorY = data.cursor?.y ?? s.cursorY;
        },
      });
      // @ts-expect-error autotable adds lastAutoTable
      s.cursorY = (s.doc.lastAutoTable?.finalY ?? s.cursorY) + 6;
    }
  }
}

export function renderSection4_Climate(s: PdfState) {
  h1(s, "Clima, infraestructura y geomorfología");
  p(
    s,
    `Clima mediterráneo semiárido con precipitaciones invernales (mayo–agosto, ~400 mm/año) y veranos secos. ` +
      `El relieve es de cordillera de la Costa, con cotas entre 400 y 900 m s.n.m. en el AOI. ` +
      `La cobertura vegetal incluye bosque esclerófilo nativo, matorral espinoso, y cluster de palma chilena.`,
  );
  p(
    s,
    `Infraestructura local: red eléctrica trifásica disponible a 6 km del AOI (subestación Alhué); ` +
      `agua para consumo industrial requiere derechos DGA (en evaluación); accesos viales aptos para camiones de perforación con habilitación de huellas existentes; ` +
      `telefonía móvil con cobertura parcial. Mano de obra calificada disponible en el área Melipilla–Talagante.`,
  );
}

export function renderSection5_History(s: PdfState) {
  h1(s, "Historia del distrito minero");
  p(
    s,
    `El Distrito Alhué tiene una historia de minería del oro que se remonta a la época prehispánica y colonial (siglo XVIII), ` +
      `con explotaciones artesanales documentadas hasta mediados del siglo XX. La principal operación moderna del distrito es ` +
      `Mina Florida (operada por Yamana Gold / Equinox Gold), un yacimiento epitermal de baja sulfuración Au–Ag con producción ` +
      `histórica >2 Moz Au.`,
  );
  p(
    s,
    `Dentro del AOI del Prospecto Palmeras se identifican al menos 3 labores antiguas (piques verticales y socavones cortos) ` +
      `que evidencian la explotación histórica de las vetas aflorantes. La presencia de palma chilena (Jubaea chilensis) ` +
      `agrupada en proximidad a las labores se interpreta como indicador biogeoquímico de anomalías metálicas en suelo, ` +
      `coincidente con el patrón observado en otros sectores mineralizados del distrito.`,
  );
}

export function renderSection6_Geology(s: PdfState, geo: GeologyData | null) {
  h1(s, "Marco geológico");
  h2(s, "Geología regional");
  p(
    s,
    `El proyecto se emplaza en la Cordillera de la Costa de Chile Central, dominada por rocas volcano-sedimentarias del ` +
      `Cretácico Superior (Formación Lo Valle: tobas riolíticas a dacíticas, ignimbritas, lavas andesíticas) intruidas por stocks ` +
      `granodioríticos del Cretácico tardío–Paleógeno. La geología del distrito está controlada por el sistema de fallas ` +
      `regionales NW–SE y NE–SW que canalizan los fluidos hidrotermales y hospedan la mineralización epitermal del Distrito Alhué.`,
  );
  h2(s, "Geología local");
  p(
    s,
    `Dentro del AOI predominan tobas y lavas andesíticas de la Fm. Lo Valle, con alteración hidrotermal pervasiva ` +
      `(silicificación + sericita ± pirita) en las cercanías de las estructuras mineralizadas. ` +
      `Las vetas mineralizadas tienen orientación dominante N20°W con buzamiento subvertical, espesores entre 0.3 y 1.5 m, ` +
      `y rellenos de cuarzo-sulfuros con texturas de bandeamiento característico epitermal.`,
  );

  if (geo && geo.litho.length > 0) {
    tableCaption(s, "Unidades litológicas reconocidas en el AOI.");
    autoTable(s.doc, {
      startY: s.cursorY,
      head: [["Código", "Unidad", "Edad", "Formación", "Tipo de roca"]],
      body: geo.litho.map((u) => [u.unit_code, u.name, u.age ?? "—", u.formation ?? "—", u.rock_type ?? "—"]),
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2, textColor: COLORS.text, overflow: "linebreak" },
      headStyles: { fillColor: COLORS.gold, textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: COLORS.panel },
      margin: { left: PAGE.margin, right: PAGE.margin },
    });
    // @ts-expect-error autotable adds lastAutoTable
    s.cursorY = (s.doc.lastAutoTable?.finalY ?? s.cursorY) + 6;
  }

  if (geo && geo.alteration.length > 0) {
    tableCaption(s, "Zonas de alteración hidrotermal identificadas.");
    autoTable(s.doc, {
      startY: s.cursorY,
      head: [["Código", "Zona", "Asociación mineral", "Intensidad"]],
      body: geo.alteration.map((a) => [a.zone_code, a.name, a.assemblage ?? "—", a.intensity ?? "—"]),
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2, textColor: COLORS.text, overflow: "linebreak" },
      headStyles: { fillColor: COLORS.gold, textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: COLORS.panel },
      margin: { left: PAGE.margin, right: PAGE.margin },
    });
    // @ts-expect-error autotable adds lastAutoTable
    s.cursorY = (s.doc.lastAutoTable?.finalY ?? s.cursorY) + 6;
  }
}

export function renderSection7_DepositType(s: PdfState, geo: GeologyData | null) {
  h1(s, "Tipo de depósito");
  p(
    s,
    `El modelo de depósito propuesto para el Prospecto Palmeras corresponde a un sistema epitermal de baja a intermedia ` +
      `sulfuración Au–Ag con potencial transición a mesotermal Au–Cu en profundidad (>500 m). ` +
      `Este modelo es coherente con el contexto del Distrito Alhué (referencia análoga: Mina Florida) y con las características ` +
      `texturales y mineralógicas observadas en superficie.`,
  );
  h2(s, "Mineralización");
  p(
    s,
    `Las vetas aflorantes presentan rellenos de cuarzo gris con bandeamiento crustiforme y coloforme (textura epitermal típica), ` +
      `sulfuros diseminados (pirita, calcopirita, esfalerita, galena), y oro libre asociado a pirita-marcasita en estructuras frágiles. ` +
      `Se anticipa zonación vertical: oxidados en superficie (~0–30 m), sulfuros primarios entre 30 y 400 m, ` +
      `y posible mineralización mesotermal Cu±Au asociada a stockwork de cuarzo-sulfuros en profundidad.`,
  );

  if (geo && geo.minerals.length > 0) {
    tableCaption(s, "Mineralogía reconocida (paragenesis).");
    autoTable(s.doc, {
      startY: s.cursorY,
      head: [["Mineral", "Fórmula", "Categoría", "Estadio", "Abundancia"]],
      body: geo.minerals.map((m) => [m.mineral, m.formula ?? "—", m.category ?? "—", m.paragenetic_stage ?? "—", m.abundance ?? "—"]),
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2, textColor: COLORS.text, overflow: "linebreak" },
      headStyles: { fillColor: COLORS.gold, textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: COLORS.panel },
      margin: { left: PAGE.margin, right: PAGE.margin },
    });
    // @ts-expect-error autotable adds lastAutoTable
    s.cursorY = (s.doc.lastAutoTable?.finalY ?? s.cursorY) + 6;
  }

  h2(s, "Alteración hidrotermal");
  p(
    s,
    `La asociación de alteración observada en superficie (silicificación + sericita + pirita ± clorita) sugiere temperaturas ` +
      `de formación entre 200 y 300 °C, consistente con la zona productiva de un sistema epitermal de baja-intermedia sulfuración. ` +
      `La potencial transición a mesotermal en profundidad estaría caracterizada por aumento de calcopirita-pirrotina, ` +
      `alteración propilítica más intensa, y stockwork de cuarzo.`,
  );

  h2(s, "Modelo conceptual");
  p(
    s,
    `La sección esquemática siguiente ilustra la geometría inferida del sistema en una traza NW–SE: vetas subverticales ` +
      `hospedadas en volcánicas de la Fm. Lo Valle, halo de alteración silícea–sericítica envolvente, labores antiguas en superficie, ` +
      `y trayectorias de los sondajes diamantinos propuestos para test de continuidad en profundidad.`,
  );
  drawCrossSection(
    s,
    "Sección esquemática NW–SE del sistema epitermal–mesotermal Au–Cu del Prospecto Palmeras. " +
      "Profundidades hasta 500 m. No a escala. Fuente: modelo conceptual Trackmin GeoIntel.",
  );
}

export function renderSection8_Exploration(s: PdfState, geophys: GeophysicsData | null) {
  h1(s, "Exploración");
  h2(s, "Levantamiento topográfico (AOI)");
  p(
    s,
    `Se planifica un vuelo UAV de fotogrametría sobre el AOI completo en Fase 1, con resolución espacial objetivo de 5 cm/píxel ` +
      `y generación de modelo digital de superficie (DSM) y ortofotomosaico. Productos esperados: curvas de nivel cada 0.5 m, ` +
      `mapa litológico y estructural a escala 1:2,000, ubicación precisa de labores antiguas y vetas aflorantes.`,
  );

  h2(s, "Geofísica");
  p(
    s,
    `Se contemplan tres campañas geofísicas complementarias para definir la arquitectura subsuperficial del sistema y refinar los ` +
      `targets de perforación:`,
  );

  if (geophys && geophys.surveys.length > 0) {
    tableCaption(s, "Campañas geofísicas planificadas.");
    autoTable(s.doc, {
      startY: s.cursorY,
      head: [["Nombre", "Método", "km plan.", "Espaciado (m)", "Profundidad (m)", "Costo (USD)", "Estado"]],
      body: geophys.surveys.map((c) => [
        c.name,
        c.method,
        c.planned_km != null ? c.planned_km.toFixed(1) : "—",
        c.station_spacing_m != null ? String(c.station_spacing_m) : "—",
        c.expected_depth_m != null ? String(c.expected_depth_m) : "—",
        c.cost_usd != null ? c.cost_usd.toLocaleString("en-US") : "—",
        c.status,
      ]),
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2, textColor: COLORS.text, overflow: "linebreak" },
      headStyles: { fillColor: COLORS.gold, textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: COLORS.panel },
      margin: { left: PAGE.margin, right: PAGE.margin },
    });
    // @ts-expect-error autotable adds lastAutoTable
    s.cursorY = (s.doc.lastAutoTable?.finalY ?? s.cursorY) + 6;
  }

  p(
    s,
    `Las firmas geofísicas esperadas para el modelo epitermal–mesotermal son: anomalías magnéticas locales asociadas a ` +
      `zonas de alteración con destrucción de magnetita (lows magnéticos sobre el sistema), anomalías de cargabilidad IP ` +
      `>15 mV/V sobre cuerpos diseminados de sulfuros, y resistividades elevadas (>500 Ω·m) en las vetas silicificadas con ` +
      `contraste claro respecto a la matriz alterada (50–200 Ω·m).`,
  );

  h2(s, "Geoquímica / Muestreo");
  p(
    s,
    `Programa de muestreo superficial de Fase 1 incluye: (i) chip sampling sistemático de vetas aflorantes (espaciamiento 1–2 m); ` +
      `(ii) canal sampling perpendicular a las estructuras en labores antiguas accesibles; (iii) grab sampling de zonas alteradas; ` +
      `(iv) geoquímica de suelos en grilla 50×50 m sobre el AOI completo (~400 muestras totales). ` +
      `Análisis: Au por fire assay 30 g + AAS, multi-elemento ICP-MS 48 elementos en laboratorio certificado ISO 17025 (ALS o Bureau Veritas).`,
  );
}

export function renderSection9_Drilling(s: PdfState) {
  h1(s, "Programa de perforación");
  p(
    s,
    `Se proponen 4 sondajes diamantinos (DDH) totalizando 1,030 m, distribuidos para test de las principales estructuras ` +
      `mineralizadas identificadas en superficie y de los targets geofísicos definidos en Fase 2. ` +
      `Diámetro de perforación HQ (63.5 mm) en sobrecarga y zona oxidada, con reducción a NQ (47.6 mm) en sulfuros si las condiciones de roca lo permiten.`,
  );
  tableCaption(s, "Sondajes diamantinos propuestos (collars y especificaciones).");
  autoTable(s.doc, {
    startY: s.cursorY,
    head: [["Hole ID", "Azimut", "Inclinación", "Profundidad (m)", "Target"]],
    body: DDH.map((h) => [h.id, h.az, h.inc, String(h.depth), h.target]),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.5, textColor: COLORS.text },
    headStyles: { fillColor: COLORS.gold, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: COLORS.panel },
    margin: { left: PAGE.margin, right: PAGE.margin },
  });
  // @ts-expect-error autotable adds lastAutoTable
  s.cursorY = (s.doc.lastAutoTable?.finalY ?? s.cursorY) + 6;
  p(
    s,
    `Recuperación objetivo >85%, RQD medido cada corrida. Logueo geológico y geotécnico in-situ. ` +
      `Muestreo del core: ½ core para análisis (1 m intervalos en zona mineralizada, 2 m en estéril), ` +
      `½ core preservado en sample storage securo para verificación independiente.`,
  );
}

export function renderSection10_QAQC(s: PdfState) {
  h1(s, "Preparación, análisis y seguridad de muestras");
  p(
    s,
    `Cadena de custodia documentada desde el sitio hasta el laboratorio. Las muestras de chip y canal sampling se etiquetan ` +
      `con código único (formato TRK-ALH-NNNN), se sellan en bolsas plásticas individuales y se transportan en sample bags ` +
      `numerados con tag duplicado (uno en muestra, uno en sample sheet).`,
  );
  p(
    s,
    `Programa QA/QC: inserción sistemática de blanks (1 cada 20 muestras), estándares certificados CRM (1 cada 20 muestras, ` +
      `con valores cubriendo el rango Au 0.5–10 g/t), y duplicados de campo (1 cada 25 muestras). ` +
      `Re-análisis del 5% de las muestras en laboratorio secundario independiente (umpire lab) para validación cruzada.`,
  );
  p(
    s,
    `Análisis primario: Au por fire assay 30 g con finish AAS (límite de detección 0.005 g/t); ` +
      `multi-elemento por ICP-MS 48 elementos con digestión 4-ácidos; Cu por AAS específico cuando >1%. ` +
      `Laboratorios objetivo: ALS Chemex o Bureau Veritas (Santiago), ambos certificados ISO 17025.`,
  );
}

export function renderSection11_DataVerification(s: PdfState) {
  h1(s, "Verificación de datos");
  p(
    s,
    `A la fecha de emisión de este informe el proyecto se encuentra en etapa pre-Fase 1, sin datos analíticos primarios ` +
      `disponibles. La verificación de datos se desarrollará en paralelo con la ejecución del programa: ` +
      `(i) revisión sistemática de certificados de laboratorio por la Persona Calificada (QP); ` +
      `(ii) chequeo cruzado con QA/QC interno (blancos, estándares, duplicados); ` +
      `(iii) verificación independiente vía umpire lab (5% de las muestras); ` +
      `(iv) auditoría externa al cierre de Fase 3 previo a estimación de recursos.`,
  );
}

export function renderSection12_Budget(s: PdfState) {
  h1(s, "Presupuesto y cronograma");
  p(
    s,
    `El programa de exploración de 12 meses tiene un presupuesto total de USD ${BUDGET_TOTAL.toLocaleString("en-US")}, ` +
      `desglosado en 4 fases secuenciales. La Fase 3 (sondajes diamantinos) concentra el 58% del presupuesto.`,
  );
  tableCaption(s, "Desglose de presupuesto por ítem (USD).");
  autoTable(s.doc, {
    startY: s.cursorY,
    head: [["Ítem", "Detalle", "Monto (USD)"]],
    body: [
      ...BUDGET.map((b) => [b.item, b.detail, b.amount.toLocaleString("en-US")]),
      [{ content: "TOTAL", styles: { fontStyle: "bold" } }, "", { content: BUDGET_TOTAL.toLocaleString("en-US"), styles: { fontStyle: "bold" } }],
    ],
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.5, textColor: COLORS.text },
    headStyles: { fillColor: COLORS.gold, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: COLORS.panel },
    columnStyles: { 2: { halign: "right" } },
    margin: { left: PAGE.margin, right: PAGE.margin },
  });
  // @ts-expect-error autotable adds lastAutoTable
  s.cursorY = (s.doc.lastAutoTable?.finalY ?? s.cursorY) + 6;

  // Pie chart of budget composition (vector)
  drawPieChart(
    s,
    BUDGET.map((b, i) => ({
      label: b.item,
      amount: b.amount,
      color: ([
        [200, 146, 42],   // gold
        [180, 110, 60],   // copper
        [60, 140, 130],   // teal
        [70, 110, 180],   // info blue
        [150, 138, 128],  // muted
        [110, 100, 92],   // hint
      ] as [number, number, number][])[i % 6],
    })),
    `USD ${BUDGET_TOTAL.toLocaleString("en-US")}`,
    "Distribución del presupuesto por ítem (donut chart). Sondaje DDH concentra el 58 % del programa.",
  );

  h2(s, "Cronograma por fases");
  tableCaption(s, "Cronograma del programa de exploración.");
  autoTable(s.doc, {
    startY: s.cursorY,
    head: [["Fase", "Período", "Actividad principal", "Descripción"]],
    body: PHASES.map((ph) => [`Fase ${ph.n}`, ph.range, ph.title, ph.desc]),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.5, textColor: COLORS.text },
    headStyles: { fillColor: COLORS.gold, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: COLORS.panel },
    margin: { left: PAGE.margin, right: PAGE.margin },
  });
  // @ts-expect-error autotable adds lastAutoTable
  s.cursorY = (s.doc.lastAutoTable?.finalY ?? s.cursorY) + 6;

  // Gantt chart (vector)
  drawGantt(
    s,
    [
      { phase: "F1", title: "Muestreo superficial", start: 0, span: 2, color: [200, 146, 42] },
      { phase: "F2", title: "Geofísica IP / Mag", start: 2, span: 2, color: [70, 110, 180] },
      { phase: "F3", title: "Sondajes DDH", start: 4, span: 4, color: [180, 110, 60] },
      { phase: "F4", title: "Análisis + reporte", start: 8, span: 4, color: [60, 140, 130] },
    ],
    12,
    "Cronograma Gantt del programa de exploración (12 meses, 4 fases secuenciales).",
  );
}

export function renderSection13_Conclusions(s: PdfState) {
  h1(s, "Conclusiones y recomendaciones");
  p(
    s,
    `El Prospecto Palmeras presenta indicios geológicos y geomorfológicos consistentes con un sistema epitermal–mesotermal ` +
      `Au–Cu de tamaño y leyes potencialmente económicas, hospedado en rocas volcánicas cretácicas del Distrito Alhué. ` +
      `Los principales argumentos para avanzar en exploración son:`,
  );
  bullet(s, [
    "Vetas aflorantes con sulfuros y texturas epitermales características.",
    "Labores históricas que validan la presencia de mineralización económica.",
    "Indicador biogeoquímico (cluster de palma chilena) coincidente con anomalías inferidas.",
    "Distrito con depósitos análogos de clase mundial (Mina Florida, >2 Moz Au).",
    "Ubicación favorable: infraestructura, accesos, proximidad a Santiago.",
  ]);
  h2(s, "Recomendaciones");
  bullet(s, [
    "Validar pertenencias mineras vigentes con SERNAGEOMIN antes de iniciar Fase 1.",
    "Notificar al Consejo de Monumentos Nacionales (CMN) por labores prehispánicas.",
    "Designar formalmente Persona Calificada (QP) bajo NI 43-101.",
    "Ejecutar Fase 1 (UAV + muestreo superficial) en los próximos 60 días.",
    "Planificar Fase 2 (geofísica) en función de los resultados geoquímicos.",
    "Reservar la decisión de Fase 3 (sondajes) a la conclusión exitosa de Fase 2.",
  ]);
}

export function renderSection14_References(s: PdfState, refs: { citation_key: string; title: string; authors: string | null; year: number | null; publisher: string | null }[]) {
  h1(s, "Referencias bibliográficas");
  if (refs.length === 0) {
    bullet(s, [
      "Hedenquist, J.W., Arribas, A. (2017). Epithermal Ore Deposits: First-Order Features Relevant to Exploration and Assessment. Proceedings 14th SGA Biennial Meeting.",
      "Sillitoe, R.H. (2010). Porphyry Copper Systems. Economic Geology, 105(1), 3–41.",
      "Corbett, G.J., Leach, T.M. (1998). Southwest Pacific Rim Gold-Copper Systems: Structure, Alteration, and Mineralization. SEG Special Publication 6.",
      "SERNAGEOMIN (2003). Mapa Geológico de Chile, escala 1:1,000,000.",
      "Gómez-Gajardo, F. et al. (2024). Geología económica del Distrito Alhué — revisión y actualización del modelo.",
    ]);
    return;
  }
  bullet(
    s,
    refs.map(
      (r) =>
        `${r.authors ?? "—"}${r.year ? ` (${r.year})` : ""}. ${r.title}${r.publisher ? `. ${r.publisher}` : ""}.`,
    ),
  );
}

export function renderSection3bis_Zoning(
  s: PdfState,
  satelliteFig: string | null,
  geo: GeologyData | null,
  internalCount: number,
) {
  h1(s, "Zonificación geológica y cobertura satelital");
  p(
    s,
    `Esta sección complementa la descripción de la propiedad con un panorama de la cobertura geo-espacial empleada ` +
      `durante la fase actual: imagen satelital de alta resolución, capas de zonificación geológica oficiales y catastro ` +
      `minero combinado (SERNAGEOMIN + registros internos del operador).`,
  );

  if (satelliteFig) {
    figure(
      s,
      satelliteFig,
      "Vista satelital del AOI con superposición de polígonos catastrales y trazas de vetas conocidas. Basemap: Esri World Imagery.",
      { height: 95 },
    );
  } else {
    p(s, "No fue posible capturar la vista satelital en esta ejecución (mapa no montado).");
  }

  h2(s, "Capas geo-espaciales utilizadas");
  tableCaption(s, "Inventario de capas geo-espaciales activas para el informe.");
  autoTable(s.doc, {
    startY: s.cursorY,
    head: [["Capa", "Fuente", "Escala / Resolución", "Uso"]],
    body: [
      ["Esri World Imagery", "Esri / Maxar", "≤0.3 m/px", "Basemap satelital"],
      ["SERNAGEOMIN Geología 1:1M", "SERNAGEOMIN WMS", "1:1.000.000", "Zonificación litológica regional"],
      ["Macrostrat Lithology", "Macrostrat.org", "Variable", "Geología de contexto"],
      ["Catastro Minero", "SERNAGEOMIN Geomin", "Vector", "Pertenencias vigentes"],
      ["AOI Trackmin", "Trackmin GeoIntel", "Vector interno", "Polígono operativo"],
    ],
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.8, textColor: COLORS.text, overflow: "linebreak" },
    headStyles: { fillColor: COLORS.gold, textColor: 255, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: COLORS.panel },
    margin: { left: PAGE.margin, right: PAGE.margin },
  });
  // @ts-expect-error autotable adds lastAutoTable
  s.cursorY = (s.doc.lastAutoTable?.finalY ?? s.cursorY) + 6;

  if (geo && geo.litho.length > 0) {
    h2(s, "Unidades litológicas reconocidas en el AOI");
    autoTable(s.doc, {
      startY: s.cursorY,
      head: [["Código", "Nombre", "Edad", "Descripción"]],
      body: geo.litho.slice(0, 10).map((u) => [
        u.unit_code ?? "—",
        u.name ?? "—",
        u.age ?? "—",
        (u.description ?? "—").slice(0, 110),
      ]),
      styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.5, textColor: COLORS.text, overflow: "linebreak" },
      headStyles: { fillColor: COLORS.gold, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: COLORS.panel },
      margin: { left: PAGE.margin, right: PAGE.margin },
    });
    // @ts-expect-error autotable adds lastAutoTable
    s.cursorY = (s.doc.lastAutoTable?.finalY ?? s.cursorY) + 6;
  }

  if (internalCount > 0) {
    p(
      s,
      `Se incorporan al Anexo A ${internalCount} pertenencias registradas internamente por el operador (no presentes en la ` +
        `consulta SERNAGEOMIN del bbox), marcadas con la fuente "Interno".`,
    );
  }
}

export function renderAnnexA(
  s: PdfState,
  rows: { tipo: string; rol: string; nombre: string; titular: string; ha: string; venc: string }[],
  internal: { code: string; name: string; holder: string; type: string; status: string; area_ha: string; expires: string }[] = [],
) {
  h1(s, "Anexo A — Listado completo de pertenencias en bbox de consulta");
  if (rows.length === 0 && internal.length === 0) {
    p(s, "Sin pertenencias registradas en la consulta del bbox del proyecto ni en registros internos.");
    return;
  }
  if (rows.length > 0) {
    h2(s, "Pertenencias SERNAGEOMIN");
    autoTable(s.doc, {
      startY: s.cursorY,
      head: [["Fuente", "Tipo", "ROL", "Nombre", "Titular", "Ha", "Vencimiento"]],
      body: rows.map((r) => ["SERNAGEOMIN", r.tipo, r.rol, r.nombre, r.titular, r.ha, r.venc]),
      styles: { font: "helvetica", fontSize: 7, cellPadding: 1.5, textColor: COLORS.text, overflow: "linebreak" },
      headStyles: { fillColor: COLORS.gold, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: COLORS.panel },
      margin: { left: PAGE.margin, right: PAGE.margin },
    });
    // @ts-expect-error autotable adds lastAutoTable
    s.cursorY = (s.doc.lastAutoTable?.finalY ?? s.cursorY) + 6;
  }
  if (internal.length > 0) {
    h2(s, "Pertenencias registradas internamente (operador)");
    autoTable(s.doc, {
      startY: s.cursorY,
      head: [["Fuente", "Código", "Nombre", "Titular", "Tipo", "Estado", "Ha", "Vence"]],
      body: internal.map((r) => ["Interno", r.code, r.name, r.holder, r.type, r.status, r.area_ha, r.expires]),
      styles: { font: "helvetica", fontSize: 7, cellPadding: 1.5, textColor: COLORS.text, overflow: "linebreak" },
      headStyles: { fillColor: COLORS.goldDark, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: COLORS.panel },
      margin: { left: PAGE.margin, right: PAGE.margin },
    });
    // @ts-expect-error autotable adds lastAutoTable
    s.cursorY = (s.doc.lastAutoTable?.finalY ?? s.cursorY) + 6;
  }
}

export function renderAnnexB(s: PdfState, geophys: GeophysicsData | null) {
  h1(s, "Anexo B — Estaciones geofísicas (sintéticas)");
  p(
    s,
    `Las estaciones presentadas a continuación son simulaciones plausibles generadas para visualizar la firma esperada del ` +
      `modelo epitermal–mesotermal en el AOI. Marcadas con flag is_synthetic=true en la base de datos. ` +
      `No reemplazan datos reales de adquisición.`,
  );
  if (!geophys || geophys.stations.length === 0) {
    p(s, "Sin estaciones cargadas en el sistema.");
    return;
  }
  autoTable(s.doc, {
    startY: s.cursorY,
    head: [["Estación", "Lat", "Lng", "Mag (nT)", "IP charg. (mV/V)", "IP res. (Ω·m)"]],
    body: geophys.stations.slice(0, 60).map((st) => [
      st.station_id,
      st.lat.toFixed(5),
      st.lng.toFixed(5),
      st.mag_nt != null ? st.mag_nt.toFixed(0) : "—",
      st.ip_chargeability_mvv != null ? st.ip_chargeability_mvv.toFixed(1) : "—",
      st.ip_resistivity_ohmm != null ? st.ip_resistivity_ohmm.toFixed(0) : "—",
    ]),
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.5, textColor: COLORS.text },
    headStyles: { fillColor: COLORS.gold, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: COLORS.panel },
    margin: { left: PAGE.margin, right: PAGE.margin },
  });
  // @ts-expect-error autotable adds lastAutoTable
  s.cursorY = (s.doc.lastAutoTable?.finalY ?? s.cursorY) + 6;
}
