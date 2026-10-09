/** Adaptador: Nahuelbuta REE → modelo de documento global. Cifras solo desde la fuente única. */
import { publicUrl } from "@/lib/publicUrl";
import { NAHUELBUTA, PANOS_ARCILLAS } from "@/features/nahuelbuta/data/nahuelbuta";
import type { ProjectDoc } from "../model";

export const NAHUELBUTA_DOC_VERSION = "v1.0";
const n = (x: number) => x.toLocaleString("es-CL");

export function buildNahuelbutaDoc(): ProjectDoc {
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
    tags: [NAHUELBUTA.commodity, `${n(NAHUELBUTA.haPanos)} ha en solicitud`, `${NAHUELBUTA.panos} paños`, "Biobío / Araucanía"],
    kpis: [
      { label: "Paños Arcillas", value: `${NAHUELBUTA.panos}`, note: `${NAHUELBUTA.haPorPano} ha c/u · en trámite` },
      { label: "Superficie solicitada", value: `${n(NAHUELBUTA.haPanos)} ha`, note: NAHUELBUTA.datumEscrito },
      { label: "Pedimentos informe NI", value: "5.000 ha", note: "P-01 Malleco + P-02 Arauco" },
      { label: "Fase 1 recomendada", value: `US$ ${n(NAHUELBUTA.fase1.budgetUsd)}`, note: `${NAHUELBUTA.fase1.months} meses` },
    ],
    thesis: [...NAHUELBUTA.geology],
    allocation: {
      title: "Paños por tribunal competente",
      centerTop: `${NAHUELBUTA.panos}`,
      centerSub: "paños",
      slices: [...byCourt].map(([label, c]) => ({ label, pct: Math.round((c / NAHUELBUTA.panos) * 100) })),
    },
    dataQuality: [
      { status: "DECLARED", provenance: "DOCUMENTARY", label: "Tenencia", detail: "Paños y pedimentos en solicitud; no constituidos.", confidence: "medium" },
      { status: "DERIVED", provenance: "INTERPRETED", label: "Anomalías CMI", detail: "Índice de arcillas Landsat-9; no mide tierras raras.", confidence: "low" },
      { status: "PENDING_DD", provenance: "PENDING_DD", label: "Geoquímica", detail: "Sin muestras de laboratorio.", confidence: "low" },
    ],
    milestones: [...NAHUELBUTA.milestones],
    sections: [
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
            rows: PANOS_ARCILLAS.map((p) => [`Arcillas ${p.n}`, n(p.pmNorte), n(p.pmEste), p.comuna, p.tribunal]),
          },
        ],
      },
      {
        eyebrow: "Programa",
        title: "Fase 1 recomendada por el informe técnico",
        blocks: [
          { kind: "bullets", items: [...NAHUELBUTA.fase1.items] },
          { kind: "kv", items: [["Presupuesto", `US$ ${n(NAHUELBUTA.fase1.budgetUsd)}`], ["Duración", `${NAHUELBUTA.fase1.months} meses`], ["Inicio previsto", NAHUELBUTA.fase1.start], ["Persona calificada", NAHUELBUTA.qp.name]] },
        ],
      },
      {
        eyebrow: "Brechas",
        title: "Materias pendientes antes de comprometer capital",
        blocks: NAHUELBUTA.gaps.map((g, i) => ({ kind: "gap" as const, title: `Brecha ${i + 1}`, body: g })),
      },
    ],
    disclaimers: [...NAHUELBUTA.caveats],
    contact: { name: NAHUELBUTA.qp.name, email: NAHUELBUTA.qp.email, phone: NAHUELBUTA.qp.phone },
  };
}
