// QA/QC validation worker — Sprint 4
// Valida bundles de sondajes (collar/survey/assay/lithology) fuera del main thread.
// Devuelve issues estructurados con severidad: critical | warning | info.

import type { CollarRow, SurveyRow, AssayRow, LithRow } from "@/engine3d/data/csvDrillholes";

export type IssueSeverity = "critical" | "warning" | "info";
export type IssueDataset = "collar" | "survey" | "assay" | "lithology" | "global";

export type QAQCIssue = {
  id: string;
  severity: IssueSeverity;
  dataset: IssueDataset;
  holeId?: string;
  interval?: { from: number; to: number };
  message: string;
  suggestedFix?: string;
};

export type QAQCInput = {
  collars: CollarRow[];
  surveys: SurveyRow[];
  assays: AssayRow[];
  lithology: LithRow[];
};

export type QAQCResult = {
  issues: QAQCIssue[];
  summary: {
    critical: number;
    warning: number;
    info: number;
    totalHoles: number;
    totalAssays: number;
    hash: string;
    elapsedMs: number;
  };
};

let nextId = 0;
const mkId = () => `iss_${++nextId}`;

function hashStr(s: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ("0000000" + (h >>> 0).toString(16)).slice(-8);
}

function validate(input: QAQCInput): QAQCResult {
  const t0 = performance.now();
  const issues: QAQCIssue[] = [];
  const { collars, surveys, assays, lithology } = input;

  // ─── COLLARS ───────────────────────────────────────────────
  const collarIds = new Map<string, number>();
  for (const c of collars) {
    if (!c.hole_id) {
      issues.push({
        id: mkId(), severity: "critical", dataset: "collar",
        message: "Collar sin hole_id",
        suggestedFix: "Asegúrate de que cada fila tenga columna hole_id",
      });
      continue;
    }
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || !Number.isFinite(c.z)) {
      issues.push({
        id: mkId(), severity: "critical", dataset: "collar", holeId: c.hole_id,
        message: `Collar ${c.hole_id} con coordenadas inválidas (x/y/z)`,
        suggestedFix: "Verifica columnas easting/northing/elevation",
      });
    }
    collarIds.set(c.hole_id, (collarIds.get(c.hole_id) ?? 0) + 1);
  }
  for (const [id, n] of collarIds) {
    if (n > 1) {
      issues.push({
        id: mkId(), severity: "critical", dataset: "collar", holeId: id,
        message: `Hole ID duplicado en collar: ${id} (${n} filas)`,
        suggestedFix: "Mantener un único collar por hole_id",
      });
    }
  }

  // Calcular profundidad máxima por hole (assay+lith+survey)
  const maxDepthByHole = new Map<string, number>();
  const bump = (id: string, d: number) => {
    if (!Number.isFinite(d)) return;
    const cur = maxDepthByHole.get(id) ?? 0;
    if (d > cur) maxDepthByHole.set(id, d);
  };
  surveys.forEach((s) => bump(s.hole_id, s.depth));
  assays.forEach((a) => bump(a.hole_id, a.to));
  lithology.forEach((l) => bump(l.hole_id, l.to));

  // ─── SURVEYS ───────────────────────────────────────────────
  const surveyByHole = new Map<string, SurveyRow[]>();
  for (const s of surveys) {
    if (!collarIds.has(s.hole_id)) {
      issues.push({
        id: mkId(), severity: "warning", dataset: "survey", holeId: s.hole_id,
        message: `Survey referencia hole_id sin collar: ${s.hole_id}`,
        suggestedFix: "Importa el collar correspondiente",
      });
    }
    if (s.depth < 0) {
      issues.push({
        id: mkId(), severity: "warning", dataset: "survey", holeId: s.hole_id,
        message: `Survey con depth negativo: ${s.depth} m`,
      });
    }
    if (s.azimuth < 0 || s.azimuth > 360) {
      issues.push({
        id: mkId(), severity: "warning", dataset: "survey", holeId: s.hole_id,
        message: `Azimuth fuera de rango [0-360]: ${s.azimuth}`,
        suggestedFix: "Normalizar a azimuth = (az + 360) % 360",
      });
    }
    if (s.dip < -90 || s.dip > 90) {
      issues.push({
        id: mkId(), severity: "warning", dataset: "survey", holeId: s.hole_id,
        message: `Dip fuera de rango [-90, 90]: ${s.dip}`,
      });
    }
    const list = surveyByHole.get(s.hole_id) ?? [];
    list.push(s);
    surveyByHole.set(s.hole_id, list);
  }
  for (const [id, list] of surveyByHole) {
    const sorted = [...list].sort((a, b) => a.depth - b.depth);
    if (sorted.length === 0) continue;
    if (sorted[0].depth > 5) {
      issues.push({
        id: mkId(), severity: "info", dataset: "survey", holeId: id,
        message: `Primer survey de ${id} a ${sorted[0].depth} m (>5 m de boca)`,
        suggestedFix: "Agregar survey de collar (depth=0)",
      });
    }
  }

  // ─── ASSAYS ────────────────────────────────────────────────
  const assayByHole = new Map<string, AssayRow[]>();
  for (const a of assays) {
    if (!collarIds.has(a.hole_id)) {
      issues.push({
        id: mkId(), severity: "warning", dataset: "assay", holeId: a.hole_id,
        interval: { from: a.from, to: a.to },
        message: `Assay referencia hole_id sin collar: ${a.hole_id}`,
      });
    }
    if (!Number.isFinite(a.from) || !Number.isFinite(a.to) || a.to <= a.from) {
      issues.push({
        id: mkId(), severity: "critical", dataset: "assay", holeId: a.hole_id,
        interval: { from: a.from, to: a.to },
        message: `Assay con intervalo inválido: from=${a.from} to=${a.to}`,
        suggestedFix: "Garantiza to > from y ambos finitos",
      });
      continue;
    }
    if (a.grade < 0) {
      issues.push({
        id: mkId(), severity: "critical", dataset: "assay", holeId: a.hole_id,
        interval: { from: a.from, to: a.to },
        message: `Grade negativo: ${a.grade}`,
        suggestedFix: "Reemplazar por 0 o NULL si es bajo límite de detección",
      });
    }
    const list = assayByHole.get(a.hole_id) ?? [];
    list.push(a);
    assayByHole.set(a.hole_id, list);
  }
  for (const [id, list] of assayByHole) {
    const sorted = [...list].sort((a, b) => a.from - b.from);
    // Overlaps
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (cur.from < prev.to - 1e-6) {
        issues.push({
          id: mkId(), severity: "critical", dataset: "assay", holeId: id,
          interval: { from: cur.from, to: cur.to },
          message: `Solape de intervalos: ${prev.from}-${prev.to} con ${cur.from}-${cur.to}`,
          suggestedFix: "Revisar duplicados o errores de digitación",
        });
      } else if (cur.from > prev.to + 0.01) {
        issues.push({
          id: mkId(), severity: "info", dataset: "assay", holeId: id,
          interval: { from: prev.to, to: cur.from },
          message: `Gap en assays: ${prev.to.toFixed(2)}-${cur.from.toFixed(2)} m (${(cur.from - prev.to).toFixed(2)} m sin muestreo)`,
        });
      }
    }
    const totalDepth = maxDepthByHole.get(id) ?? 0;
    if (sorted.length && sorted[sorted.length - 1].to > totalDepth + 1) {
      issues.push({
        id: mkId(), severity: "warning", dataset: "assay", holeId: id,
        message: `Assay excede profundidad de hole: ${sorted[sorted.length - 1].to} > ${totalDepth}`,
      });
    }
  }

  // ─── LITHOLOGY ─────────────────────────────────────────────
  for (const l of lithology) {
    if (!Number.isFinite(l.from) || !Number.isFinite(l.to) || l.to <= l.from) {
      issues.push({
        id: mkId(), severity: "warning", dataset: "lithology", holeId: l.hole_id,
        interval: { from: l.from, to: l.to },
        message: `Lithology con intervalo inválido: ${l.from}-${l.to}`,
      });
      continue;
    }
    const td = maxDepthByHole.get(l.hole_id) ?? 0;
    if (l.to > td + 1) {
      issues.push({
        id: mkId(), severity: "warning", dataset: "lithology", holeId: l.hole_id,
        interval: { from: l.from, to: l.to },
        message: `Lithology fuera de profundidad de hole (${l.to} > ${td})`,
      });
    }
  }

  // ─── GLOBAL ────────────────────────────────────────────────
  if (collars.length === 0) {
    issues.push({
      id: mkId(), severity: "critical", dataset: "global",
      message: "Sin collars cargados — no se puede georeferenciar",
    });
  }
  if (assays.length === 0) {
    issues.push({
      id: mkId(), severity: "warning", dataset: "global",
      message: "Sin assays cargados — estimación de recursos no disponible",
    });
  }

  // ─── SUMMARY ───────────────────────────────────────────────
  let crit = 0, warn = 0, info = 0;
  for (const i of issues) {
    if (i.severity === "critical") crit++;
    else if (i.severity === "warning") warn++;
    else info++;
  }
  const hash = hashStr(
    `${collars.length}|${surveys.length}|${assays.length}|${lithology.length}|${crit}|${warn}|${info}`,
  );
  return {
    issues,
    summary: {
      critical: crit,
      warning: warn,
      info,
      totalHoles: collarIds.size,
      totalAssays: assays.length,
      hash,
      elapsedMs: performance.now() - t0,
    },
  };
}

self.onmessage = (e: MessageEvent<{ type: "validate"; input: QAQCInput }>) => {
  if (e.data?.type !== "validate") return;
  try {
    const result = validate(e.data.input);
    (self as unknown as Worker).postMessage({ type: "result", result });
  } catch (err) {
    (self as unknown as Worker).postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
