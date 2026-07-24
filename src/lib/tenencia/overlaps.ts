// Tenencia · lógica pura de traslapes. Tipa y resume la salida del RPC
// tenencia_overlaps (ver migración 20260724040000). Sin dependencias de red:
// testeable en CI.

export type OverlapSeverity = "blocking" | "warning" | "info";

/** Una concesión que intersecta el polígono consultado (AOI). */
export type TenureOverlap = {
  concessionId: string;
  projectId: string | null;
  code: string | null;
  name: string | null;
  holder: string | null;
  concessionType: string | null;
  status: string | null;
  areaHa: number | null;
  commune: string | null;
  region: string | null;
  expiresAt: string | null;
  overlapHa: number;
  /** % del AOI cubierto por esta concesión. */
  pctOfAoi: number;
  /** % de la concesión cubierto por el AOI. */
  pctOfConcession: number;
  severity: OverlapSeverity;
};

export type OverlapSummary = {
  total: number;
  blocking: number;
  warning: number;
  info: number;
  /** Suma de hectáreas traslapadas (puede sobrecontar si las concesiones se pisan entre sí). */
  totalOverlapHa: number;
  /** Mayor % del AOI cubierto por una sola concesión. */
  maxPctOfAoi: number;
  /** Titulares distintos en conflicto. */
  uniqueHolders: number;
  worstSeverity: OverlapSeverity | "none";
};

const SEVERITY_RANK: Record<OverlapSeverity, number> = { blocking: 3, warning: 2, info: 1 };

/** Fila cruda del RPC (snake_case) → TenureOverlap. */
export function mapOverlapRow(r: Record<string, unknown>): TenureOverlap {
  const num = (v: unknown) => (v == null ? 0 : Number(v));
  const sev = String(r.severity ?? "info");
  return {
    concessionId: String(r.concession_id),
    projectId: (r.project_id ?? null) as string | null,
    code: (r.code ?? null) as string | null,
    name: (r.name ?? null) as string | null,
    holder: (r.holder ?? null) as string | null,
    concessionType: (r.concession_type ?? null) as string | null,
    status: (r.status ?? null) as string | null,
    areaHa: r.area_ha == null ? null : Number(r.area_ha),
    commune: (r.commune ?? null) as string | null,
    region: (r.region ?? null) as string | null,
    expiresAt: (r.expires_at ?? null) as string | null,
    overlapHa: num(r.overlap_ha),
    pctOfAoi: num(r.pct_of_aoi),
    pctOfConcession: num(r.pct_of_concession),
    severity: (sev === "blocking" || sev === "warning" ? sev : "info") as OverlapSeverity,
  };
}

/** Resume una lista de traslapes para el semáforo del Informe de Tenencia. */
export function summarizeOverlaps(rows: TenureOverlap[]): OverlapSummary {
  const holders = new Set<string>();
  let blocking = 0;
  let warning = 0;
  let info = 0;
  let totalOverlapHa = 0;
  let maxPctOfAoi = 0;
  let worstRank = 0;

  for (const r of rows) {
    if (r.severity === "blocking") blocking += 1;
    else if (r.severity === "warning") warning += 1;
    else info += 1;
    totalOverlapHa += r.overlapHa;
    if (r.pctOfAoi > maxPctOfAoi) maxPctOfAoi = r.pctOfAoi;
    if (r.holder && r.holder.trim()) holders.add(r.holder.trim().toLowerCase());
    worstRank = Math.max(worstRank, SEVERITY_RANK[r.severity]);
  }

  const worstSeverity: OverlapSummary["worstSeverity"] =
    worstRank === 3 ? "blocking" : worstRank === 2 ? "warning" : worstRank === 1 ? "info" : "none";

  return {
    total: rows.length,
    blocking,
    warning,
    info,
    totalOverlapHa: Math.round(totalOverlapHa * 100) / 100,
    maxPctOfAoi,
    uniqueHolders: holders.size,
    worstSeverity,
  };
}

/** Color de semáforo para la dimensión "tenencia" del informe. */
export function tenureSemaphore(summary: OverlapSummary): "rojo" | "amarillo" | "verde" {
  if (summary.blocking > 0) return "rojo";
  if (summary.warning > 0) return "amarillo";
  return "verde";
}
