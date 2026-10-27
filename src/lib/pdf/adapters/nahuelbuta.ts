/** Adaptador: Nahuelbuta REE → modelo de documento global. Cifras solo desde la fuente única. */
import { publicUrl } from "@/lib/publicUrl";
import { NAHUELBUTA, PANOS_ARCILLAS } from "@/features/nahuelbuta/data/nahuelbuta";
import panosRaw from "@/data/geo/losalamos_panos_arcillas.geojson?raw";
import type { ProjectDoc } from "../model";

export const NAHUELBUTA_DOC_VERSION = "v1.1";

/** Mesetas derivadas del DEM: prioridad de reconocimiento, NO mineralización. */
export function nahuelbutaMesetas(): Array<{ pano: string; pct: number }> {
  const data = JSON.parse(panosRaw) as {
    features?: Array<{ properties?: { pano?: string; meseta_pct?: number } }>;
  };
  return (data.features ?? [])
    .map((feature) => ({
      pano: feature.properties?.pano ?? "",
      pct: feature.properties?.meseta_pct ?? NaN,
    }))
    .filter((row) => row.pano.startsWith("Arcillas ") && Number.isFinite(row.pct))
    .sort((a, b) => b.pct - a.pct);
}
const n = (x: number) => x.toLocaleString("es-CL");

export function buildNahuelbutaDoc(): ProjectDoc {
  const mesetas = nahuelbutaMesetas();
  const byCourt = new Map<string, number>();
  for (const p of PANOS_ARCILLAS) byCourt.set(p.tribunal, (byCourt.get(p.tribunal) ?? 0) + 1);
  return {
    reportProfile: "technical",
    code: NAHUELBUTA.code,
    name: NAHUELBUTA.name,
    subtitle: `${NAHUELBUTA.commodity} · ${NAHUELBUTA.stage}`,
    commodity: NAHUELBUTA.commodity,
    stage: NAHUELBUTA.stage,
    location: `${NAHUELBUTA.region}, ${NAHUELBUTA.country}`,
    liveUrl: publicUrl(NAHUELBUTA.liveUrl),
    docVersion: NAHUELBUTA_DOC_VERSION,
    tags: [
      NAHUELBUTA.commodity,
      `${n(NAHUELBUTA.haPanos)} ha en solicitud`,
      `${NAHUELBUTA.panos} paños`,
      "Biobío / Araucanía",
    ],
    kpis: [
      {
        label: "Paños Arcillas",
        value: `${NAHUELBUTA.panos}`,
        note: `${NAHUELBUTA.haPorPano} ha c/u · en trámite`,
      },
      {
        label: "Superficie solicitada",
        value: `${n(NAHUELBUTA.haPanos)} ha`,
        note: NAHUELBUTA.datumEscrito,
      },
      {
        label: "Teledetección óptica",
        value: "No concluyente",
        note: "0,53% histórico en AOI rectangular; requiere recorte por paño",
      },
      {
        label: "Fase 1 recomendada",
        value: `US$ ${n(NAHUELBUTA.fase1.budgetUsd)}`,
        note: `${NAHUELBUTA.fase1.months} meses`,
      },
    ],
    thesis: [...NAHUELBUTA.geology],
    allocation: {
      title: "Paños por tribunal competente",
      centerTop: `${NAHUELBUTA.panos}`,
      centerSub: "paños",
      slices: [...byCourt].map(([label, c]) => ({
        label,
        pct: Math.round((c / NAHUELBUTA.panos) * 100),
      })),
    },
    dataQuality: [
      {
        status: "DECLARED",
        provenance: "DOCUMENTARY",
        label: "Tenencia",
        detail: "Paños y pedimentos en solicitud; no constituidos.",
        confidence: "medium",
      },
      {
        status: "DERIVED",
        provenance: "INTERPRETED",
        label: "Señales CMI históricas",
        detail: "Interpretación Landsat-9 declarada; sin polígonos validados ni ley REE.",
        confidence: "low",
      },
      {
        status: "DERIVED",
        provenance: "INTERPRETED",
        label: "Mesetas DEM por paño",
        detail: "Porcentajes geomorfológicos derivados del GeoJSON; no miden mineralización.",
        source: "losalamos_panos_arcillas.geojson · Copernicus DEM 30 m",
        confidence: "medium",
      },
      {
        status: "DERIVED",
        provenance: "INTERPRETED",
        label: "Cobertura óptica histórica",
        detail: "0,53% sobre AOI rectangular (~23.500 ha), NO en los 10.200 ha de paños; requiere reproceso.",
        source: "docs/protocolo-analisis-satelital-distritos.md",
        confidence: "low",
      },
      {
        status: "PENDING_DD",
        provenance: "PENDING_DD",
        label: "Geoquímica",
        detail: "Sin muestras de laboratorio.",
        confidence: "low",
      },
    ],
    milestones: [...NAHUELBUTA.milestones],
    sections: [
      {
        eyebrow: "Teledetección y calidad",
        title: "Observabilidad óptica: limitación del dosel forestal",
        lead: "El análisis histórico Sentinel-2 NO permite inferir mineralización de tierras raras.",
        blocks: [
          {
            kind: "finding",
            title: "Medir cobertura dentro de cada polígono",
            body: "El protocolo anterior informa 0,53% interpretable sobre un rectángulo de ~23.500 ha, mientras los 34 paños originales comprenden 10.200 ha nominales. No utilizar esa cifra como cobertura medida de los paños. El reproceso debe publicar denominador, escenas, NDVI y configuración.",
            provenance: "INTERPRETED",
            source: "docs/protocolo-analisis-satelital-distritos.md",
            confidence: "low",
          },
          {
            kind: "recommendation",
            title: "No generar targets espectrales sin cobertura suficiente",
            body: "Aplicar umbral de observabilidad óptica del 15% dentro de los polígonos. Si no se alcanza, no publicar anomalías Al-OH/caolinita ni una grilla de sondajes derivada de ellas. Priorizar DEM, radiometría Th/U y geoquímica del regolito.",
            priority: "high",
          },
          {
            kind: "finding",
            title: "Limitación mineralógica",
            body: "KI, Al-OH, BSI y CMI son razones de bandas anchas: no identifican kaolinita ni miden TREO. La hipótesis de arcillas de adsorción iónica requiere verificación mineralógica y geoquímica.",
            provenance: "INTERPRETED",
            source: "geocapitals-remote/src/gc_remote/indices.py",
            confidence: "medium",
          },
        ],
      },
      {
        eyebrow: "Priorización geomorfológica",
        title: "Mesetas DEM: paños para reconocimiento, no reservas",
        lead: "Ranking de los paños según la fracción cartografiada como meseta en el GeoJSON existente; no es una puntuación geoquímica.",
        blocks: [
          {
            kind: "table",
            head: ["Paño", "Meseta DEM", "Interpretación"],
            widths: [0.3, 0.25, 0.45],
            rows: mesetas.slice(0, 10).map((p) => [
              p.pano,
              `${p.pct.toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`,
              "Reconocimiento condicionado",
            ]),
          },
          {
            kind: "recommendation",
            title: "Validación previa a decisiones de inversión",
            body: "Confirmar perfiles de meteorización, litología, espesores y mineralogía; muestrear REE totales e intercambiables. Verificar acceso, tenencia, restricciones ambientales y consulta territorial aplicable.",
            priority: "high",
          },
        ],
      },
      {
        eyebrow: "Tenencia",
        title: "Paños Arcillas 1 a 34: puntos medios y competencia",
        blocks: [
          {
            kind: "appendixTable",
            title: "Puntos medios (PSAD56 UTM 18S)",
            head: ["Paño", "PM Norte", "PM Este", "Comuna", "Tribunal"],
            widths: [18, 20, 18, 24, 60],
            provenance: "DOCUMENTARY",
            source: "Propuesta preliminar Arcillas 1-34",
            rows: PANOS_ARCILLAS.map((p) => [
              `Arcillas ${p.n}`,
              n(p.pmNorte),
              n(p.pmEste),
              p.comuna,
              p.tribunal,
            ]),
          },
        ],
      },
      {
        eyebrow: "Programa",
        title: "Fase 1 recomendada por el informe técnico",
        blocks: [
          { kind: "bullets", items: [...NAHUELBUTA.fase1.items] },
          {
            kind: "kv",
            items: [
              ["Presupuesto", `US$ ${n(NAHUELBUTA.fase1.budgetUsd)}`],
              ["Duración", `${NAHUELBUTA.fase1.months} meses`],
              ["Inicio previsto", NAHUELBUTA.fase1.start],
              ["Persona calificada", NAHUELBUTA.qp.name],
            ],
          },
        ],
      },
      {
        eyebrow: "Brechas",
        title: "Materias pendientes antes de comprometer capital",
        blocks: NAHUELBUTA.gaps.map((g, i) => ({
          kind: "gap" as const,
          title: `Brecha ${i + 1}`,
          body: g,
        })),
      },
    ],
    disclaimers: [
      ...NAHUELBUTA.caveats,
      "La cobertura óptica histórica de 0,53% corresponde a un AOI rectangular; no es un cálculo recortado a los 34 paños. El análisis corregido requiere resultado reproducible.",
      "Los indicadores DEM son geomorfología derivada, no demuestran mineralización. No existen ensayes propios REE/TREO publicados.",
      "El deal GEO-2026-004 contiene siete polígonos (49.000 ha según sus vértices) con discordancias de ubicación; no mezclarlos con los 34 paños Arcillas sin conciliación geodésica y legal.",
    ],
    contact: { name: NAHUELBUTA.qp.name, email: NAHUELBUTA.qp.email, phone: NAHUELBUTA.qp.phone },
  };
}
