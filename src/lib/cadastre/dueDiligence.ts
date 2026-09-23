import type { ReconciliationBundle } from "./reconciliationBundle";

export type DueDiligenceFinding = {
  severity: "INFO" | "REVIEW" | "HIGH";
  code: string;
  message: string;
};

export function buildCadastreDueDiligence(bundle: ReconciliationBundle) {
  const findings: DueDiligenceFinding[] = [];
  if (bundle.summary.UNMATCHED > 0) findings.push({ severity:"HIGH", code:"UNMATCHED_PROJECT_GEOMETRY", message:`${bundle.summary.UNMATCHED} geometría(s) documentales sin match oficial por identidad o intersección.` });
  if (bundle.summary.INTERSECTS > 0) findings.push({ severity:"REVIEW", code:"SPATIAL_INTERSECTION", message:`${bundle.summary.INTERSECTS} relación(es) presentan intersección espacial y requieren revisión de roles/límites.` });
  if (bundle.summary.NEIGHBOR > 0) findings.push({ severity:"INFO", code:"NEIGHBORING_CONCESSIONS", message:`${bundle.summary.NEIGHBOR} concesión(es) vecinas detectadas dentro del buffer configurado.` });
  if (bundle.summary.EXACT_MATCH > 0) findings.push({ severity:"INFO", code:"IDENTITY_MATCH", message:`${bundle.summary.EXACT_MATCH} coincidencia(s) por rol o nombre normalizado detectadas.` });
  return {
    generatedAt: bundle.generatedAt,
    source: bundle.source,
    summary: bundle.summary,
    findings,
    disclaimer: "Análisis automatizado de apoyo. No constituye estudio de títulos, certificación de dominio ni opinión jurídica.",
  };
}
