/**
 * Adaptador: minuta de acciones en terreno de Cholqui (Fase 0)
 * → modelo de documento global de Geocapitals.
 *
 * Es el documento defendible que se entrega al geólogo de terreno, al titular
 * y al comité: qué se va a hacer, sobre qué evidencia, con qué método y con
 * qué control de calidad. No contiene recursos, reservas, leyes esperadas ni
 * cifras financieras.
 */
import { publicUrl } from "@/lib/publicUrl";
import { CHOLQUI, CHOLQUI_ASSAYS } from "@/features/franco/data/cholqui";
import type { CholquiSatelliteTargets } from "@/lib/cholqui/satelliteTargets.functions";
import { buildFieldProgram } from "@/lib/cholqui/fieldProgram";
import type { FieldProgram } from "@/lib/cholqui/fieldProgram";
import { cholquiTenurePolygons, tenureAt } from "./cholquiTargets";
import type { ProjectDoc } from "../model";
import { cholquiGeoscienceSections } from "./cholquiGeoscience";

export const CHOLQUI_FIELD_MEMO_VERSION = "v1.1";

function num(value: number, digits = 0): string {
  return value.toLocaleString("es-CL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function buildCholquiFieldMemoDoc(
  data: CholquiSatelliteTargets,
  program?: FieldProgram,
): ProjectDoc {
  const p = program ?? buildFieldProgram(data);
  const tenure = cholquiTenurePolygons();
  const targets = p.targets.map((t) => {
    const tenure = tenureAt(t.lat, t.lng);
    return {
      ...t,
      concession: tenure.concession,
      tenureLabel: tenure.label,
      ownTenure: tenure.own,
    };
  });
  const ownCount = targets.filter((t) => t.ownTenure).length;

  return {
    reportProfile: "targeting",
    code: `${CHOLQUI.code}-FIELD`,
    name: `${CHOLQUI.name} — Minuta de acciones en terreno`,
    subtitle: "Programa de validación Fase 0, previo a perforación",
    commodity: CHOLQUI.commodity,
    stage: "Exploración · validación de targets en terreno",
    location: CHOLQUI.location,
    liveUrl: publicUrl(CHOLQUI.liveUrl),
    docVersion: CHOLQUI_FIELD_MEMO_VERSION,
    tags: [
      CHOLQUI.commodity,
      `${targets.length} targets en tenencia`,
      `${p.totals.days} jornadas`,
      `${num(p.totals.samples)} muestras`,
    ],
    kpis: [
      {
        label: "Targets a validar",
        value: String(targets.length),
        note: "Anomalías dentro de concesión registrada en catastro",
      },
      {
        label: "Superficie a mapear",
        value: `${num(p.mapping.areaHa)} ha`,
        note: `Escala ${p.mapping.scale} · ${p.mapping.stations} estaciones`,
      },
      {
        label: "Muestras de canaleta",
        value: num(p.channel.samples),
        note: `${p.channel.sites} sitios, tramos de ${String(p.channel.sampleLengthM).replace(
          ".",
          ",",
        )} m`,
      },
      {
        label: "Control QA/QC",
        value: num(p.channel.controlTotal),
        note: `${p.channel.blanks} blancos, ${p.channel.duplicates} duplicados, ${p.channel.crm} estándares`,
      },
      {
        label: "Geofísica terrestre",
        value: `${num(p.geophysics.magLineKm, 1)} km`,
        note: `Magnetometría cada ${p.geophysics.magSpacingM} m + ${p.geophysics.ipLines} líneas IP`,
      },
      {
        label: "Duración estimada",
        value: `${p.totals.days} jornadas`,
        note: `Aproximadamente ${p.totals.weeks} semanas de terreno`,
      },
    ],
    thesis: [
      `Hoy la evidencia de Cholqui se apoya en ${CHOLQUI_ASSAYS.length} ensayes certificados de superficie y en ${data.summary.anomalies} anomalías espectrales derivadas de ${data.coverage.sensor}. Las anomalías son indicios: no son mineralización ni evidencia de terreno.`,
      `Esta minuta ordena el trabajo necesario para convertir ${targets.length} indicios dentro de la tenencia en evidencia medida: mapeo estructural, canaleta con QA/QC y geofísica de detalle.`,
      "La secuencia es deliberada: primero se verifica que el target existe geológicamente, luego se mide su contenido metálico y sólo después se usa geofísica para proyectarlo en profundidad.",
      `Al cierre de la Fase 0 la malla de ${data.collars.length} plataformas se revisa: cada collar queda confirmado, reubicado o descartado con su justificación escrita.`,
      "Ningún resultado de esta fase constituye recurso ni reserva; su objetivo es sustentar o refutar la hipótesis de exploración con datos propios.",
    ],
    chart: {
      title: "Jornadas por actividad del programa",
      labelA: "Jornadas",
      unit: "jornadas de terreno",
      data: p.tasks.map((t) => ({ label: t.id, a: t.days })),
      caption:
        "Duración declarada por actividad según las reglas de productividad del programa. No incluye traslados extraordinarios ni detenciones por clima o permisos.",
    },
    map: {
      title: "Targets de validación en terreno",
      caption: `${targets.length} targets dentro de concesión registrada en el catastro cargado y ${data.collars.length} collares propuestos a replantear.`,
      valueUnit: "puntaje",
      captureSelector: '[data-report-map="cholqui"]',
      source: "Geocapitals · corrida satelital almacenada",
      crs: "WGS84",
      imagery: "Esri World Imagery al capturar el visor; candidatos derivados de Sentinel-2",
      polygons: tenure,
      points: [
        ...targets.map((t) => ({
          label: t.label,
          lat: t.lat,
          lng: t.lng,
          value: t.score ?? undefined,
        })),
        ...data.collars.map((c) => ({
          label: c.code,
          lat: c.lat,
          lng: c.lng,
          highlight: true,
        })),
      ],
    },
    dataQuality: [
      {
        status: "DERIVED",
        provenance: "DERIVED",
        label: "Origen de los targets",
        detail: `Anomalías espectrales ${data.coverage.sensor}. Son el punto de partida del programa, no su conclusión.`,
      },
      {
        status: "VERIFIED",
        provenance: "CERTIFIED",
        label: "Ensayes de superficie existentes",
        detail: `${CHOLQUI_ASSAYS.length} muestras con informe de laboratorio firmado, usadas como referencia de contexto.`,
      },
      {
        status: "CONCEPTUAL",
        provenance: "PROPOSED",
        label: "Programa de terreno",
        detail:
          "Las cantidades de este documento son de planificación: derivan de la geometría de los targets y de reglas de productividad declaradas.",
      },
      {
        status: "PENDING_DD",
        provenance: "PENDING_DD",
        label: "Permisos, accesos y laboratorio",
        detail:
          "La ejecución depende de tenencia vigente, servidumbres, aviso de inicio de labores y laboratorio acreditado contratado.",
      },
    ],
    milestones: p.schedule.map((s) => ({ when: s.week, what: s.activity })),
    sections: [
      ...cholquiGeoscienceSections(),
      {
        eyebrow: "Alcance",
        title: "Qué se valida y qué no",
        deck: true,
        lead:
          "La Fase 0 busca evidencia de terreno sobre indicios satelitales. No produce estimaciones de recursos ni resultados económicos.",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Se verifica si cada anomalía espectral tiene expresión geológica real en superficie.",
              "Se mide contenido metálico mediante canaleta continua con protocolo QA/QC en laboratorio acreditado.",
              "Se contrasta la hipótesis de continuidad con magnetometría/IP e inversión condicionada por topografía, adquisición y geología.",
              "Se confirma, reubica o descarta cada collar propuesto antes de comprometer metros de sondaje.",
              "No se estiman tonelajes, leyes medias, recursos ni reservas en ninguna etapa de esta fase.",
            ],
          },
        ],
      },
      {
        eyebrow: "Targets",
        title: "Prioridad, concesión y acciones por target",
        deck: true,
        lead:
          "Cada target se ubica contra el catastro SERNAGEOMIN cargado. Se distingue la tenencia analizada del proyecto de las concesiones de terceros: sobre estas últimas no se ejecuta trabajo sin verificación registral ni acuerdo escrito previo.",
        blocks: [
          {
            kind: "table",
            head: [
              "Target",
              "Concesión (catastro)",
              "Titularidad",
              "Firma espectral",
              "Puntaje",
              "Prioridad",
            ],
            widths: [0.09, 0.26, 0.17, 0.24, 0.11, 0.13],
            rows: targets.map((t) => [
              t.label,
              t.concession ?? "Sin concesión en el catastro cargado",
              t.tenureLabel,
              t.indexName,
              t.score != null ? t.score.toFixed(2).replace(".", ",") : "s/d",
              t.priority,
            ]),
          },
          {
            kind: "text",
            body:
              "El score conserva el valor publicado; campañas e índices distintos no se comparan como ranking geológico o económico. La prioridad es una regla de planificación pendiente de revisión de terreno.",
          },
          {
            kind: "text",
            body: `Titularidad verificada sobre el catastro cargado: ${ownCount} de ${
              targets.length
            } targets caen dentro de la tenencia analizada (TOKI 2 / PALLOCABE 8 / DOS MARÍAS) y ${
              targets.length - ownCount
            } caen en concesiones inscritas a terceros. Antes de cualquier trabajo en estas últimas se requiere verificar vigencia y titular en el registro, y obtener acuerdo escrito o servidumbre.`,
          },
        ],
      },

      {
        eyebrow: "Instrucción de terreno",
        title: "Acciones concretas por target de prioridad alta",
        blocks: [
          {
            kind: "table",
            head: ["Target", "Acciones en terreno"],
            widths: [0.14, 0.86],
            rows: targets
              .filter((t) => t.priority !== "Baja")
              .map((t) => [t.label, t.actions.join(" ")]),
          },
        ],
      },
      {
        eyebrow: "Programa",
        title: "Actividades, método y entregables",
        deck: true,
        blocks: [
          {
            kind: "table",
            head: ["ID", "Actividad", "Método", "Entregable", "Jornadas"],
            widths: [0.08, 0.24, 0.3, 0.28, 0.1],
            rows: p.tasks.map((t) => [t.id, t.title, t.method, t.deliverable, String(t.days)]),
          },
        ],
      },
      {
        eyebrow: "Geoquímica",
        title: "Protocolo de muestreo y control de calidad",
        blocks: [
          {
            kind: "kv",
            items: [
              ["Sitios de canaleta", String(p.channel.sites)],
              ["Largo de cada canaleta", `${num(12)} m, perpendicular al rumbo de la estructura`],
              [
                "Tramo de muestra",
                `${String(p.channel.sampleLengthM).replace(".", ",")} m continuos`,
              ],
              ["Muestras primarias", num(p.channel.samples)],
              ["Blancos analíticos", `${p.channel.blanks} (5 % de inserción)`],
              ["Duplicados de campo", `${p.channel.duplicates} (5 % de inserción)`],
              ["Estándares certificados", `${p.channel.crm} (5 % de inserción)`],
              ["Total a laboratorio", num(p.channel.submittedTotal)],
              ["Laboratorio", "Acreditado, con cadena de custodia firmada por muestra"],
            ],
          },
          {
            kind: "text",
            body:
              "Toda muestra se registra con coordenada UTM 19S, datum declarado, fotografía del sitio y ficha de terreno. Sin cadena de custodia completa la muestra no se incorpora a la base de datos del proyecto.",
          },
        ],
      },
      {
        eyebrow: "Geofísica",
        title: "Campaña de detalle para proyectar los targets en profundidad",
        deck: true,
        blocks: [
          {
            kind: "kv",
            items: [
              ["Magnetometría terrestre", `${num(p.geophysics.magLineKm, 1)} km de línea`],
              ["Separación entre líneas", `${p.geophysics.magSpacingM} m`],
              ["Control diurno", "Estación base fija y corrección por variación diurna"],
              [
                "Polarización inducida",
                `${p.geophysics.ipLines} líneas, ${num(p.geophysics.ipLineKm, 1)} km`,
              ],
              ["Arreglo IP", p.geophysics.ipArray],
              ["Orientación", "Transversal al rumbo estructural dominante N20E"],
              [
                "Producto propuesto",
                "Inversión IP 2D con topografía, electrodos y error de medida",
              ],
            ],
          },
          {
            kind: "text",
            body:
              "La geofísica regional disponible (EMAG2 y WGM2012) tiene resolución kilométrica y sirve sólo como contexto. Las decisiones de perforación requieren datos de terreno a escala de prospecto como los de esta campaña.",
          },
        ],
      },
      {
        eyebrow: "Habilitación",
        title: "Permisos, accesos y responsables",
        blocks: [
          {
            kind: "table",
            head: ["Requisito", "Responsable", "Estado"],
            widths: [0.46, 0.28, 0.26],
            rows: p.permits.map((x) => [x.item, x.responsible, x.status]),
          },
        ],
      },
      {
        eyebrow: "Cierre",
        title: "Criterios de decisión al terminar la Fase 0",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Target confirmado: existe estructura mapeada, alteración verificada y respuesta geofísica coherente. Se mantiene el collar y se ajusta su orientación con el manteo medido.",
              "Target parcial: hay estructura pero sin respuesta geofísica o sin continuidad. El collar se reubica o se reduce su profundidad.",
              "Target descartado: la anomalía no tiene expresión geológica en terreno. Se elimina el collar y se documenta el motivo.",
              "En todos los casos el resultado se incorpora al modelo 3D del proyecto y queda con fecha, autor y fuente.",
            ],
          },
        ],
      },
    ],
    disclaimers: [
      "Documento de planificación de exploración. No constituye recurso, reserva ni estimación económica bajo CH 20235 / NI 43-101 / JORC / S-K 1300.",
      "Los targets provienen de un screening satelital Nivel 0 y no han sido verificados en terreno a la fecha de este documento.",
      "Las cantidades de mapeo, muestreo y geofísica son de planificación: derivan de la geometría de los targets y de reglas de productividad declaradas en el programa.",
      "La ejecución está sujeta a tenencia vigente, servidumbres, permisos sectoriales y contratación de laboratorio acreditado.",
      `Titularidad: ${ownCount} de ${targets.length} targets caen dentro de la tenencia analizada del proyecto; el resto cae en concesiones inscritas a terceros según el catastro cargado. Sobre esas concesiones no se ejecuta trabajo sin verificación registral y acuerdo escrito.`,

      "La malla de sondajes referida es conceptual y debe ser revisada por persona competente antes de ejecutarse.",
      "Documento informativo: no constituye oferta pública de valores ni recomendación de inversión.",
    ],
    contact: {
      name: CHOLQUI.contact.name,
      email: CHOLQUI.contact.email,
      phone: CHOLQUI.contact.phone,
    },
  };
}
