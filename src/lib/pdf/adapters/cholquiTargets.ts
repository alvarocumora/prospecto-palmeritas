/**
 * Adaptador: anomalías satelitales de Cholqui + malla de sondajes propuesta
 * → modelo de documento global de Geocapitals.
 *
 * Todo lo que entra aquí viene de la corrida satelital almacenada y del
 * cálculo determinista de `lib/cholqui/drillGrid`. No se inventan cifras y
 * cada capa conserva su etiqueta de procedencia.
 */
import { publicUrl } from "@/lib/publicUrl";
import {
  CHOLQUI,
  CHOLQUI_ASSAYS,
  CHOLQUI_POINTS,
  LAS_MINITAS,
} from "@/features/franco/data/cholqui";
import { indexLabel, type ProposedCollar } from "@/lib/cholqui/drillGrid";
import type { CholquiSatelliteTargets } from "@/lib/cholqui/satelliteTargets.functions";
import { CHOLQUI_STRUCTURES_GEOJSON } from "@/features/franco/data/cholquiStructures";
import type { ProjectDoc } from "../model";
import type { MapPolygon } from "../brand/kit";
import catastroRaw from "@/data/geo/cholqui_catastro_sngm.geojson?raw";

/** Concesiones de la tenencia analizada (catastro oficial SERNAGEOMIN). */
const TENURE_MATCH = [/^TOKI 2 /, /^PALLOCABE 8 /, /^DOS MARIAS/];

type CatFeature = {
  properties: { nombre: string; rol: string; situacion: string };
  geometry: { type: string; coordinates: number[][][] };
};

export function cholquiTenurePolygons(): Array<MapPolygon & { rol: string; situacion: string }> {
  try {
    const fc = JSON.parse(catastroRaw) as { features: CatFeature[] };
    return fc.features
      .filter(
        (f) =>
          f.geometry?.type === "Polygon" && TENURE_MATCH.some((r) => r.test(f.properties.nombre)),
      )
      .map((f) => ({
        label: f.properties.nombre.replace(/ DEL 1 AL \d+| \d+\/\d+/g, ""),
        ring: f.geometry.coordinates[0].map((c) => [c[0], c[1]] as [number, number]),
        emphasis: true,
        rol: f.properties.rol,
        situacion: f.properties.situacion,
      }));
  } catch {
    return [];
  }
}

function inRing(lng: number, lat: number, ring: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Todas las concesiones del catastro oficial cargado (no sólo la tenencia analizada). */
function allCatastroPolygons(): Array<{
  label: string;
  rol: string;
  ring: Array<[number, number]>;
}> {
  try {
    const fc = JSON.parse(catastroRaw) as { features: CatFeature[] };
    return fc.features
      .filter((f) => f.geometry?.type === "Polygon")
      .map((f) => ({
        label: f.properties.nombre,
        rol: f.properties.rol,
        ring: f.geometry.coordinates[0].map((c) => [c[0], c[1]] as [number, number]),
      }));
  } catch {
    return [];
  }
}

/**
 * Concesión que contiene el punto, según el catastro SERNAGEOMIN cargado.
 * Devuelve nombre y rol para que el documento sea verificable contra el registro.
 */
export function concessionAt(lat: number, lng: number): string | null {
  const hit = allCatastroPolygons().find((p) => inRing(lng, lat, p.ring));
  if (!hit) return null;
  return hit.rol ? `${hit.label} (rol ${hit.rol})` : hit.label;
}

/**
 * Titularidad del punto respecto de la tenencia analizada del proyecto.
 * `own` sólo es verdadero dentro de TOKI 2 / PALLOCABE 8 / DOS MARIAS.
 * Cualquier otra concesión del catastro se declara de tercero.
 */
export function tenureAt(
  lat: number,
  lng: number,
): { concession: string | null; own: boolean; label: string } {
  const own = cholquiTenurePolygons().find((p) => inRing(lng, lat, p.ring));
  if (own) return { concession: own.label, own: true, label: "Tenencia analizada" };
  const other = allCatastroPolygons().find((p) => inRing(lng, lat, p.ring));
  if (other) {
    return {
      concession: other.rol ? `${other.label} (rol ${other.rol})` : other.label,
      own: false,
      label: "Concesión de tercero",
    };
  }
  return { concession: null, own: false, label: "Sin concesión en el catastro cargado" };
}

export type AgentNote = { label: string; note: string };

export const CHOLQUI_TARGETS_DOC_VERSION = "v1.1";

function num(value: number, digits = 0): string {
  return value.toLocaleString("es-CL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function nearestSample(lat: number, lng: number): { code: string; km: number } | null {
  let best: { code: string; km: number } | null = null;
  for (const p of CHOLQUI_POINTS) {
    const dLat = (p.lat - lat) * 111.32;
    const dLng = (p.lng - lng) * 111.32 * Math.cos((lat * Math.PI) / 180);
    const km = Math.sqrt(dLat * dLat + dLng * dLng);
    if (!best || km < best.km) best = { code: p.code, km };
  }
  return best;
}

function collarRows(collars: ProposedCollar[]): string[][] {
  return collars.map((c) => [
    c.code,
    `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`,
    `${c.azimuthDeg}°`,
    `${c.dipDeg}°`,
    `${num(c.depthM)} m`,
    c.priority,
  ]);
}

export function buildCholquiTargetsDoc(
  data: CholquiSatelliteTargets,
  agentNotes: AgentNote[] = [],
): ProjectDoc {
  const { anomalies, collars, summary } = data;
  const tenure = cholquiTenurePolygons();
  const top = anomalies.slice(0, 12);

  return {
    reportProfile: "targeting",
    code: `${CHOLQUI.code}-SAT`,
    name: `${CHOLQUI.name} — Targets satelitales`,
    subtitle: "Anomalías espectrales y malla de sondajes propuesta",
    commodity: CHOLQUI.commodity,
    stage: "Exploración · screening satelital Nivel 0",
    location: CHOLQUI.location,
    liveUrl: publicUrl(CHOLQUI.liveUrl),
    docVersion: CHOLQUI_TARGETS_DOC_VERSION,
    tags: [
      CHOLQUI.commodity,
      `${summary.anomalies} anomalías`,
      `${summary.collars} plataformas propuestas`,
      `${num(summary.totalMeters)} m`,
    ],
    kpis: [
      {
        label: "Anomalías detectadas",
        value: String(summary.anomalies),
        note: `${summary.indexes.length} índices espectrales`,
      },
      {
        label: "Dentro de la tenencia",
        value: `${summary.withinTenure} de ${summary.anomalies}`,
        note: "Sólo estas generan plataforma propuesta",
      },
      {
        label: "Plataformas propuestas",
        value: String(summary.collars),
        note: `Fase 1 conceptual, ${num(summary.totalMeters)} m`,
      },
      {
        label: "Superficie interpretable",
        value:
          data.coverage.typicalPct != null
            ? `${data.coverage.typicalPct.toFixed(1).replace(".", ",")} %`
            : "s/d",
        note:
          data.coverage.bestCasePct != null
            ? `Mejor caso ${data.coverage.bestCasePct.toFixed(1).replace(".", ",")} % del AOI`
            : "Cobertura sin vegetación del AOI",
      },
      {
        label: "Puntaje máximo",
        value: summary.maxScore != null ? summary.maxScore.toFixed(2).replace(".", ",") : "s/d",
        note: "Realce relativo al fondo del AOI",
      },
      {
        label: "Metraje propuesto",
        value: `${num(summary.totalMeters)} m`,
        note: "Sondaje diamantino, inclinación -60°",
      },
    ],
    thesis: [
      `Se detectaron ${summary.anomalies} anomalías espectrales reales sobre el AOI de Cholqui (${data.coverage.sensor}), agrupadas en ${summary.indexes.length} índices de alteración (arcillas Al-OH y alteración hidrotermal combinada).`,
      `${summary.withinTenure} caen dentro de las concesiones conocidas y se traducen en ${summary.collars} plataformas propuestas por ${num(summary.totalMeters)} m de sondaje diamantino; las ${summary.outsideTenure} restantes son contexto regional y requieren verificar tenencia antes de considerar perforación.`,
      `Superficie interpretable sin cubierta vegetal: ${data.coverage.typicalPct != null ? `${data.coverage.typicalPct.toFixed(1).replace(".", ",")} %` : "s/d"} típico y ${data.coverage.bestCasePct != null ? `${data.coverage.bestCasePct.toFixed(1).replace(".", ",")} %` : "s/d"} en el mejor escenario del AOI.`,
      "El azimut de perforación es perpendicular al rumbo dominante N20E documentado en La Maza, para cortar la estructura en ángulo y medir potencia real.",
      "Una anomalía espectral es un indicio, no mineralización: ningún target sustituye mapeo, canaleta ni ensaye de laboratorio.",
    ],
    chart: {
      title: "Puntaje de las anomalías principales",
      labelA: "Puntaje (0–1)",
      unit: "puntaje relativo",
      data: top.map((a, i) => ({
        label: `A-${String(i + 1).padStart(2, "0")}`,
        a: a.score ?? 0,
      })),
      caption:
        "Puntaje de realce relativo al fondo del área de interés. No es ley, no es concentración y no es identificación mineral: Sentinel-2 usa bandas anchas y sólo permite afirmar anomalía en la razón de absorción.",
    },
    map: {
      title: "Anomalías y plataformas de sondaje propuestas",
      caption: `${anomalies.length} centroides de anomalía y ${collars.length} collares propuestos sobre el AOI. El tamaño del círculo representa el puntaje de la anomalía.`,
      valueUnit: "puntaje",
      captureSelector: '[data-report-map="cholqui"]',
      source: "Geocapitals · corrida satelital almacenada",
      crs: "WGS84",
      imagery: "Sentinel-2 L2A",
      polygons: tenure,
      points: [
        ...anomalies.map((a, i) => ({
          label: `A-${String(i + 1).padStart(2, "0")}`,
          lat: a.lat,
          lng: a.lng,
          value: a.score ?? undefined,
        })),
        ...collars.map((c) => ({
          label: c.code.replace("CHQ-DDH-", "DDH"),
          lat: c.lat,
          lng: c.lng,
          highlight: true,
        })),
        { label: LAS_MINITAS.name, lat: LAS_MINITAS.lat, lng: LAS_MINITAS.lng, highlight: true },
      ],
    },
    dataQuality: [
      {
        status: "DERIVED",
        provenance: "DERIVED",
        label: "Anomalías espectrales",
        detail: `Derivadas de razones de banda ${data.coverage.sensor}${data.coverage.scenesUsed ? ` sobre ${data.coverage.scenesUsed} escenas` : ""}. Indicio de alteración, sin verificación de terreno.`,
      },
      {
        status: "PENDING_DD",
        provenance: "PENDING_DD",
        label: "Tenencia de las anomalías fuera del set conocido",
        detail: `${summary.outsideTenure} anomalías caen fuera de las pertenencias conocidas: contexto regional, sin plataforma propuesta hasta verificar tenencia.`,
      },
      {
        status: "CONCEPTUAL",
        provenance: "PROPOSED",
        label: "Malla de sondajes",
        detail:
          "Propuesta de exploración calculada sobre las anomalías. No es un programa comprometido ni una estimación de recursos.",
      },
      {
        status: "VERIFIED",
        provenance: "CERTIFIED",
        label: "Ensayes de superficie",
        detail: `${CHOLQUI_ASSAYS.length} muestras puntuales con informe de laboratorio firmado.`,
      },
      {
        status: "PENDING_DD",
        provenance: "PENDING_DD",
        label: "Topografía y permisos",
        detail:
          "Las coordenadas de collar son preliminares: requieren topografía, acceso, servidumbres y permisos sectoriales.",
      },
    ],
    sections: [
      ...(agentNotes.length
        ? [
            {
              eyebrow: "Interpretación IA",
              title: "Notas del agente geológico-geofísico",
              lead: "Notas redactadas por un agente de IA a partir de los datos de este informe. Son interpretación, no hechos verificados: requieren revisión de un geólogo y verificación de terreno.",
              blocks: [
                {
                  kind: "table" as const,
                  head: ["Objetivo", "Nota del agente (IA)"],
                  rows: agentNotes.map((n) => [n.label, n.note]),
                  widths: [0.18, 0.82],
                },
              ],
            },
          ]
        : []),
      ...(tenure.length
        ? [
            {
              eyebrow: "Tenencia",
              title: "Concesiones analizadas",
              blocks: [
                {
                  kind: "table" as const,
                  head: ["Concesión", "Rol", "Situación"],
                  rows: tenure.map((t) => [t.label, t.rol, t.situacion]),
                },
              ],
            },
          ]
        : []),
      {
        eyebrow: "Datos de entrada",
        title: "Datasets, procedencia y cobertura",
        blocks: [
          {
            kind: "kv",
            items: [
              ["Sensor", data.coverage.sensor],
              ["Fecha de corrida", data.runDate || "s/d"],
              [
                "Escenas utilizadas",
                data.coverage.scenesUsed != null ? String(data.coverage.scenesUsed) : "s/d",
              ],
              ["CRS de salida", "WGS84 / EPSG:4326"],
              ["Fuente", "Corrida satelital almacenada en GeoCapitals"],
              ["Procedencia", "DERIVED / INTERPRETED — no verificado en terreno"],
            ],
          },
        ],
      },
      {
        eyebrow: "Calidad de datos",
        title: "Cobertura y límites de interpretación",
        blocks: [
          {
            kind: "kv",
            items: [
              [
                "Superficie interpretable típica",
                data.coverage.typicalPct != null
                  ? `${data.coverage.typicalPct.toFixed(1).replace(".", ",")} %`
                  : "s/d",
              ],
              [
                "Mejor caso",
                data.coverage.bestCasePct != null
                  ? `${data.coverage.bestCasePct.toFixed(1).replace(".", ",")} %`
                  : "s/d",
              ],
              ["Conclusivo", data.coverage.conclusive ? "Sí" : "No"],
              [
                "Tenencia",
                data.coverage.tenureNote || "Requiere verificación contra catastro vigente",
              ],
            ],
          },
          {
            kind: "text",
            body:
              data.coverage.headline ||
              "La cobertura espectral debe interpretarse como screening regional y no como identificación mineral.",
          },
        ],
      },
      {
        eyebrow: "Metodología",
        title: "Cómo se generan y priorizan las anomalías",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Screening Sentinel-2 L2A mediante razones de banda y realces relativos al fondo del área de interés.",
              "Ranking determinista por puntaje de anomalía; el puntaje no representa ley ni concentración.",
              "Cruce espacial con la tenencia conocida: sólo anomalías dentro de la tenencia pueden originar una plataforma conceptual.",
              "La propuesta de collar es una salida de planificación y permanece PROPOSED hasta completar ground truth y revisión técnica.",
            ],
          },
        ],
      },
      {
        eyebrow: "Detección",
        title: "Anomalías espectrales sobre el AOI",
        deck: true,
        lead: "Cada anomalía se lista con su índice, severidad, puntaje y superficie. El orden es por puntaje descendente.",
        blocks: [
          {
            kind: "table",
            head: ["ID", "Índice", "Severidad", "Puntaje", "Tenencia", "Muestra más cercana"],
            widths: [0.09, 0.32, 0.13, 0.12, 0.16, 0.18],
            rows: top.map((a, i) => {
              const near = nearestSample(a.lat, a.lng);
              return [
                `A-${String(i + 1).padStart(2, "0")}`,
                indexLabel(a.indexCode),
                a.severity,
                a.score != null ? a.score.toFixed(2).replace(".", ",") : "s/d",
                a.withinTenure ? "Dentro" : "Verificar",
                near ? `${near.code} a ${num(near.km, 1)} km` : "s/d",
              ];
            }),
          },
          {
            kind: "text",
            body: "Honestidad espectral: Sentinel-2 no identifica minerales. Lo defendible es anomalía en la razón de absorción compatible con óxidos de hierro o minerales de Al-OH. La identificación mineral exige sensores hiperespectrales y verificación de terreno.",
          },
          {
            kind: "text",
            body: data.coverage.tenureNote
              ? `Tenencia: ${data.coverage.tenureNote}`
              : "Tenencia: la bandera dentro/fuera se calculó contra el catastro SERNAGEOMIN vigente del titular. Las anomalías marcadas como \u0022Verificar\u0022 quedan como contexto regional y no generan plataforma propuesta hasta confirmar la tenencia.",
          },
        ],
      },
      {
        eyebrow: "Antes de perforar",
        title: "Trabajos previos obligatorios",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Topografía de detalle y replanteo en terreno de cada collar propuesto.",
              "Mapeo geológico-estructural y canaletas sobre las anomalías de mayor puntaje.",
              "Verificación de servidumbres, accesos y permisos sectoriales de cada plataforma.",
              "Protocolo QA/QC definido y laboratorio acreditado contratado antes del primer metro.",
              "Revisión de la malla por persona competente una vez incorporado el mapeo de terreno.",
            ],
          },
        ],
      },

      {
        eyebrow: "Propuesta",
        title: "Malla de sondajes de fase 1",
        deck: true,
        lead: `${collars.length} plataformas por ${num(summary.totalMeters)} m de sondaje diamantino, según los azimuts, inclinaciones y profundidades de la propuesta publicada.`,
        blocks: [
          {
            kind: "table",
            head: [
              "Sondaje",
              "Collar (lat, lon)",
              "Azimut",
              "Inclinación",
              "Profundidad",
              "Prioridad",
            ],
            widths: [0.15, 0.28, 0.12, 0.15, 0.16, 0.14],
            rows: collarRows(collars),
          },
          {
            kind: "kv",
            items: [
              ["Método propuesto", "Sondaje diamantino con recuperación de testigo"],
              ["Inclinación", "-60° desde la horizontal"],
              ["Azimut", "110° / 290° según posición respecto al eje del distrito"],
              ["Espaciamiento", "Secciones transversales al rumbo N20E"],
              ["Metraje total", `${num(summary.totalMeters)} m`],
              ["Estándar de control", "Protocolo QA/QC con blancos, estándares y duplicados"],
            ],
          },
        ],
      },
      {
        eyebrow: "Objetivos",
        title: "Qué busca cada plataforma",
        blocks: [
          {
            kind: "table",
            head: ["Sondaje", "Índice que la origina", "Objetivo geológico"],
            widths: [0.15, 0.33, 0.52],
            rows: collars.map((c) => [c.code, indexLabel(c.indexCode), c.objective]),
          },
        ],
      },
      {
        eyebrow: "Contexto estructural",
        title: "Vetas con rumbo/manteo de terreno",
        lead: "El azimut de perforación (290°/110°) es perpendicular al rumbo dominante N20E de estas vetas — no una hipótesis derivada de la anomalía satelital.",
        blocks: [
          {
            kind: "table",
            head: ["Punto", "Descripción", "Rumbo", "Manteo", "Potencia"],
            widths: [0.1, 0.5, 0.13, 0.13, 0.14],
            rows: CHOLQUI_STRUCTURES_GEOJSON.features.map((f) => {
              const p = f.properties as {
                code: string;
                name: string;
                strikeDeg: number;
                dipText: string | null;
                potenciaM: string | null;
              };
              return [
                p.code,
                p.name,
                `N${p.strikeDeg}°`,
                p.dipText ?? "s/d",
                p.potenciaM ? `${p.potenciaM} m` : "s/d",
              ];
            }),
          },
          {
            kind: "text",
            body: "Rumbo/manteo de terreno del prospecto original (Arcos/Leman), no interpretación satelital. Procedencia MEDIDO.",
          },
        ],
      },
    ],
    disclaimers: [
      "Screening satelital Nivel 0 (Sentinel-2). No constituye recurso, reserva ni identificación mineral.",
      "Las anomalías espectrales son indicios que requieren verificación de terreno (mapeo y ensaye). No reemplazan estudios de detalle.",
      "La malla de sondajes es una propuesta conceptual derivada de las anomalías: no es un programa comprometido ni fue revisada por persona competente.",
      "No existe estimación de recursos ni reservas bajo un estándar reconocido (CH 20235 / NI 43-101 / JORC / S-K 1300) para el Proyecto Cholqui.",
      "Las coordenadas de collar son preliminares y están sujetas a topografía, acceso y permisos.",
      "Documento informativo: no constituye oferta pública de valores ni recomendación de inversión.",
    ],
    contact: {
      name: CHOLQUI.contact.name,
      email: CHOLQUI.contact.email,
      phone: CHOLQUI.contact.phone,
    },
  };
}
