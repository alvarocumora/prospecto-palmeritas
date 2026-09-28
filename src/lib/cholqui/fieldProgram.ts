/**
 * Programa de validación en terreno de Cholqui (Fase 0, previa a perforar).
 *
 * Módulo puro y determinista: toma la corrida satelital real (anomalías
 * Sentinel-2 + malla conceptual de sondajes) y deriva el trabajo de terreno
 * mínimo que permite convertir un indicio DERIVADO en evidencia MEDIDA.
 *
 * Reglas:
 *  - No inventa leyes, recursos, reservas ni cifras financieras.
 *  - Sólo programa trabajo sobre anomalías dentro de la tenencia conocida.
 *  - Toda cantidad sale de la geometría de las anomalías o de una regla
 *    declarada explícitamente en este archivo (ver CONSTANTES).
 */
import { indexLabel, type ProposedCollar } from "./drillGrid";
import type { CholquiAnomaly, CholquiSatelliteTargets } from "./satelliteTargets.functions";

// ── CONSTANTES DE DISEÑO DEL PROGRAMA (declaradas, no estimadas) ─────────────

/** Escala de mapeo geológico-estructural de detalle. */
export const MAPPING_SCALE = "1:2.000";
/** Radio de trabajo alrededor del centroide de cada anomalía, en metros. */
export const TARGET_BUFFER_M = 250;
/** Hectáreas cubiertas por jornada de mapeo a escala 1:2.000. */
const HA_PER_MAPPING_DAY = 25;
/** Estaciones estructurales por hectárea mapeada. */
const STATIONS_PER_HA = 0.2;
/** Longitud estándar de cada tramo de canaleta, en metros. */
export const CHANNEL_SAMPLE_LENGTH_M = 1.5;
/** Largo de canaleta por sitio, en metros (perpendicular a la estructura). */
export const CHANNEL_SITE_LENGTH_M = 12;
/** Tasa de inserción de cada tipo de control QA/QC. */
export const QAQC_RATE = 0.05;
/** Separación entre líneas de magnetometría terrestre, en metros. */
export const MAG_LINE_SPACING_M = 50;
/** Kilómetros de línea magnética cubiertos por jornada. */
const MAG_KM_PER_DAY = 6;
/** Largo de cada línea de polarización inducida, en metros. */
export const IP_LINE_LENGTH_M = 1200;
/** Dipolo del arreglo IP, en metros. */
export const IP_DIPOLE_M = 50;
/** Jornadas por línea de IP dipolo-dipolo. */
const IP_DAYS_PER_LINE = 2;
/** Máximo de líneas de IP en la fase 0. */
const IP_MAX_LINES = 3;

// ── TIPOS ────────────────────────────────────────────────────────────────────

export type FieldTarget = {
  label: string;
  concession: string | null;
  lat: number;
  lng: number;
  indexCode: string;
  indexName: string;
  score: number | null;
  areaHa: number | null;
  priority: "Alta" | "Media" | "Baja";
  channelSites: number;
  actions: string[];
};

export type FieldTask = {
  id: string;
  phase: "Habilitación" | "Geología" | "Geoquímica" | "Geofísica" | "Cierre";
  title: string;
  objective: string;
  method: string;
  deliverable: string;
  days: number;
};

export type FieldProgram = {
  targets: FieldTarget[];
  mapping: {
    scale: string;
    areaHa: number;
    stations: number;
    days: number;
  };
  channel: {
    sites: number;
    sampleLengthM: number;
    samples: number;
    blanks: number;
    duplicates: number;
    crm: number;
    controlTotal: number;
    submittedTotal: number;
    days: number;
  };
  geophysics: {
    magLineKm: number;
    magSpacingM: number;
    magDays: number;
    ipLines: number;
    ipLineKm: number;
    ipArray: string;
    ipDays: number;
  };
  tasks: FieldTask[];
  schedule: Array<{ week: string; activity: string }>;
  permits: Array<{ item: string; responsible: string; status: string }>;
  totals: {
    days: number;
    weeks: number;
    samples: number;
    controlSamples: number;
    collarsToStakeOut: number;
  };
};

// ── DERIVACIÓN ───────────────────────────────────────────────────────────────

function round(value: number, digits = 0): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

function priorityOf(score: number | null): "Alta" | "Media" | "Baja" {
  if (score == null) return "Baja";
  if (score >= 0.8) return "Alta";
  if (score >= 0.65) return "Media";
  return "Baja";
}

function actionsFor(a: CholquiAnomaly, priority: FieldTarget["priority"]): string[] {
  const base = [
    `Mapeo estructural ${MAPPING_SCALE} en un radio de ${TARGET_BUFFER_M} m del centroide, midiendo rumbo y manteo de vetas, fallas y contactos.`,
    "Verificación visual de la firma espectral: registrar si existe alteración, óxidos o estructura, o dejar constancia de que la anomalía no tiene expresión en terreno.",
  ];
  if (a.indexCode.includes("IRON") || a.indexCode.includes("OXIDE")) {
    base.push(
      "Registro de óxidos de hierro y su relación con la estructura; fotografía georreferenciada del afloramiento.",
    );
  }
  if (a.indexCode.includes("CLAY") || a.indexCode.includes("ALTERATION")) {
    base.push(
      "Registro de alteración argílica/sericítica y su zonación lateral; muestra de mano para revisión petrográfica.",
    );
  }
  if (a.indexCode.includes("LINEAMENT") || a.indexCode.includes("STRUCTURAL")) {
    base.push(
      "Trazado del lineamiento en terreno y verificación de si corresponde a una estructura o a un rasgo topográfico.",
    );
  }
  base.push(
    priority === "Alta"
      ? "Canaleta continua perpendicular a la estructura y envío a laboratorio acreditado con protocolo QA/QC."
      : "Muestreo selectivo de control; la canaleta continua queda condicionada al resultado del mapeo.",
  );
  return base;
}

export function buildFieldProgram(data: CholquiSatelliteTargets): FieldProgram {
  const inTenure = data.anomalies
    .filter((a) => a.withinTenure && a.indexCode !== "NDVI")
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const targets: FieldTarget[] = inTenure.map((a, i) => {
    const priority = priorityOf(a.score);
    const channelSites = priority === "Alta" ? 2 : priority === "Media" ? 1 : 0;
    return {
      label: `T-${String(i + 1).padStart(2, "0")}`,
      concession: null,
      lat: a.lat,
      lng: a.lng,
      indexCode: a.indexCode,
      indexName: indexLabel(a.indexCode),
      score: a.score,
      areaHa: a.areaHa,
      priority,
      channelSites,
      actions: actionsFor(a, priority),
    };
  });

  // Superficie a mapear: buffer circular por target, sin doble conteo grosero.
  const bufferHa = (Math.PI * TARGET_BUFFER_M ** 2) / 10_000;
  const areaHa = Math.max(round(targets.length * bufferHa), 0);
  const stations = Math.ceil(areaHa * STATIONS_PER_HA);
  const mappingDays = Math.max(targets.length ? Math.ceil(areaHa / HA_PER_MAPPING_DAY) : 0, 0);

  const sites = targets.reduce((s, t) => s + t.channelSites, 0);
  const samplesPerSite = Math.ceil(CHANNEL_SITE_LENGTH_M / CHANNEL_SAMPLE_LENGTH_M);
  const samples = sites * samplesPerSite;
  const blanks = Math.ceil(samples * QAQC_RATE);
  const duplicates = Math.ceil(samples * QAQC_RATE);
  const crm = Math.ceil(samples * QAQC_RATE);
  const controlTotal = blanks + duplicates + crm;
  const channelDays = sites ? Math.ceil(sites / 2) : 0;

  // Magnetometría terrestre: grilla de líneas sobre la superficie mapeada.
  const magLineKm = areaHa ? round((areaHa * 10_000) / MAG_LINE_SPACING_M / 1000, 1) : 0;
  const magDays = magLineKm ? Math.ceil(magLineKm / MAG_KM_PER_DAY) : 0;

  const ipLines = Math.min(IP_MAX_LINES, data.collars.length);
  const ipLineKm = round((ipLines * IP_LINE_LENGTH_M) / 1000, 1);
  const ipDays = ipLines * IP_DAYS_PER_LINE;

  const tasks: FieldTask[] = [
    {
      id: "F0-01",
      phase: "Habilitación",
      title: "Verificación de tenencia, accesos y servidumbres",
      objective:
        "Confirmar que cada target está dentro de una concesión vigente del titular y que existe acceso legal al punto de trabajo.",
      method:
        "Cotejo con catastro SERNAGEOMIN vigente, revisión de roles y situación, e inspección de caminos y huellas de acceso.",
      deliverable: "Ficha de tenencia y acceso por target, con rol y situación de la concesión.",
      days: 2,
    },
    {
      id: "F0-02",
      phase: "Habilitación",
      title: "Control topográfico y replanteo",
      objective:
        "Amarrar los targets y los collares propuestos a un marco topográfico único y verificable.",
      method:
        "GNSS diferencial sobre puntos de control; todas las coordenadas se registran en UTM 19S con datum declarado.",
      deliverable: "Listado de puntos de control y collares replanteados con precisión declarada.",
      days: 2,
    },
    {
      id: "F0-03",
      phase: "Geología",
      title: `Mapeo geológico-estructural ${MAPPING_SCALE}`,
      objective:
        "Levantar litología, alteración y estructuras para saber si las anomalías espectrales tienen expresión geológica real.",
      method: `Recorrido sistemático de ${round(areaHa)} ha con ${stations} estaciones estructurales; medición de rumbo y manteo de vetas, fallas y contactos.`,
      deliverable: "Mapa geológico-estructural digital y base de datos de estaciones.",
      days: mappingDays,
    },
    {
      id: "F0-04",
      phase: "Geoquímica",
      title: "Muestreo de canaleta con protocolo QA/QC",
      objective:
        "Obtener la primera evidencia medida de contenido metálico sobre las estructuras de mayor prioridad.",
      method: `${sites} sitios de canaleta continua de ${CHANNEL_SITE_LENGTH_M} m, seccionada cada ${CHANNEL_SAMPLE_LENGTH_M} m, perpendicular al rumbo de la estructura.`,
      deliverable: `${samples} muestras primarias más ${controlTotal} muestras de control enviadas a laboratorio acreditado.`,
      days: channelDays,
    },
    {
      id: "F0-05",
      phase: "Geofísica",
      title: "Magnetometría terrestre de detalle",
      objective:
        "Definir continuidad estructural bajo cubierta y separar rasgos topográficos de estructuras reales.",
      method: `${magLineKm} km de línea con separación de ${MAG_LINE_SPACING_M} m, estación base para corrección diurna y amarre topográfico.`,
      deliverable:
        "Grilla de campo magnético reducido al polo y mapa de primera derivada vertical.",
      days: magDays,
    },
    {
      id: "F0-06",
      phase: "Geofísica",
      title: "Polarización inducida y resistividad",
      objective:
        "Detectar zonas de cargabilidad y resistividad compatibles con sulfuros o alteración en profundidad antes de fijar los collares.",
      method: `${ipLines} líneas dipolo-dipolo de ${IP_LINE_LENGTH_M} m, dipolo ${IP_DIPOLE_M} m, niveles n=1 a n=6, transversales al rumbo N20E.`,
      deliverable: "Pseudosecciones e inversión 2D de cargabilidad y resistividad por línea.",
      days: ipDays,
    },
    {
      id: "F0-07",
      phase: "Cierre",
      title: "Integración, reinterpretación y ajuste de la malla",
      objective:
        "Reemplazar el target derivado del satélite por un target sustentado en geología, geoquímica y geofísica de terreno.",
      method:
        "Integración de mapeo, ensayes y geofísica en el modelo 3D del proyecto; revisión por persona competente.",
      deliverable:
        "Malla de sondajes revisada, con collares confirmados, descartados o reubicados y su justificación.",
      days: 5,
    },
  ];

  const totalDays = tasks.reduce((s, t) => s + t.days, 0);
  const weeks = Math.ceil(totalDays / 5);

  const schedule: Array<{ week: string; activity: string }> = [
    { week: "Semana 1", activity: "Tenencia, accesos, servidumbres y control topográfico." },
    {
      week: "Semanas 2-3",
      activity: `Mapeo geológico-estructural ${MAPPING_SCALE} de los targets.`,
    },
    { week: "Semanas 3-4", activity: "Canaletas, QA/QC y despacho a laboratorio acreditado." },
    { week: "Semanas 4-5", activity: "Magnetometría terrestre y líneas de polarización inducida." },
    {
      week: "Semana 6",
      activity: "Integración, reinterpretación y ajuste de la malla de sondajes.",
    },
  ];

  const permits: Array<{ item: string; responsible: string; status: string }> = [
    {
      item: "Concesiones vigentes sobre cada target",
      responsible: "Titular / abogado de minería",
      status: "Por confirmar contra catastro vigente",
    },
    {
      item: "Permiso de acceso y servidumbre con el superficiario",
      responsible: "Titular",
      status: "Por confirmar",
    },
    {
      item: "Aviso de inicio de labores de exploración",
      responsible: "Titular ante SERNAGEOMIN",
      status: "Por confirmar",
    },
    {
      item: "Laboratorio acreditado y protocolo QA/QC firmado",
      responsible: "Geólogo a cargo",
      status: "Por contratar antes de la primera canaleta",
    },
    {
      item: "Plan de seguridad, rescate y comunicaciones en terreno",
      responsible: "Prevención de riesgos",
      status: "Por elaborar",
    },
  ];

  return {
    targets,
    mapping: { scale: MAPPING_SCALE, areaHa: round(areaHa), stations, days: mappingDays },
    channel: {
      sites,
      sampleLengthM: CHANNEL_SAMPLE_LENGTH_M,
      samples,
      blanks,
      duplicates,
      crm,
      controlTotal,
      submittedTotal: samples + controlTotal,
      days: channelDays,
    },
    geophysics: {
      magLineKm,
      magSpacingM: MAG_LINE_SPACING_M,
      magDays,
      ipLines,
      ipLineKm,
      ipArray: `Dipolo-dipolo a=${IP_DIPOLE_M} m, n=1 a 6`,
      ipDays,
    },
    tasks,
    schedule,
    permits,
    totals: {
      days: totalDays,
      weeks,
      samples,
      controlSamples: controlTotal,
      collarsToStakeOut: data.collars.length,
    },
  };
}

/** Etiqueta corta de un collar para la minuta. */
export function collarLine(c: ProposedCollar): string {
  return `${c.code} · az ${c.azimuthDeg}° / ${c.dipDeg}° · ${c.depthM} m · prioridad ${c.priority}`;
}
