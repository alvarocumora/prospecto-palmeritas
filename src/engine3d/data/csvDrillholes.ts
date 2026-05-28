// CSV pipeline para sondajes en formato Datamine/Leapfrog:
// - collar.csv:  hole_id, x, y, z (o easting/northing/elevation)
// - survey.csv:  hole_id, depth, azimuth, dip
// - assay.csv:   hole_id, from, to, grade [, element]
// - lithology.csv: hole_id, from, to, lith_code, [color]
//
// Desurvey simple: interpolación lineal de azimuth/dip por tramo.
// Devuelve estructuras compatibles con DrillholeSegment del engine.
import Papa from "papaparse";

export type CollarRow = { hole_id: string; x: number; y: number; z: number };
export type SurveyRow = { hole_id: string; depth: number; azimuth: number; dip: number };
export type AssayRow = { hole_id: string; from: number; to: number; grade: number; element?: string };
export type LithRow = { hole_id: string; from: number; to: number; lith_code: string; color?: string };

export type ParsedDrillholeBundle = {
  collars: CollarRow[];
  surveys: SurveyRow[];
  assays: AssayRow[];
  lithology: LithRow[];
  errors: string[];
};

type CsvKind = "collar" | "survey" | "assay" | "lithology";

const FIELD_ALIASES: Record<string, string> = {
  hole_id: "hole_id", holeid: "hole_id", hole: "hole_id", bhid: "hole_id", id: "hole_id",
  x: "x", easting: "x", east: "x",
  y: "y", northing: "y", north: "y",
  z: "z", elevation: "z", elev: "z", rl: "z",
  depth: "depth", md: "depth", from_depth: "depth",
  azimuth: "azimuth", azi: "azimuth", az: "azimuth",
  dip: "dip", inclination: "dip", inc: "dip",
  from: "from", from_m: "from",
  to: "to", to_m: "to",
  grade: "grade", value: "grade", au: "grade", cu: "grade", ag: "grade",
  element: "element", el: "element",
  lith_code: "lith_code", lith: "lith_code", litho: "lith_code", code: "lith_code",
  color: "color",
};

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = FIELD_ALIASES[k.toLowerCase().trim().replace(/[\s-]/g, "_")] ?? k.toLowerCase();
    out[key] = v;
  }
  return out;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function parseCsvText(text: string, kind: CsvKind): { rows: Record<string, unknown>[]; errors: string[] } {
  const errors: string[] = [];
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  if (parsed.errors?.length) {
    for (const e of parsed.errors.slice(0, 3)) errors.push(`[${kind}] ${e.message}`);
  }
  return { rows: parsed.data.map(normalizeRow), errors };
}

export function buildBundle(input: {
  collarText?: string;
  surveyText?: string;
  assayText?: string;
  lithText?: string;
}): ParsedDrillholeBundle {
  const errors: string[] = [];
  const collars: CollarRow[] = [];
  const surveys: SurveyRow[] = [];
  const assays: AssayRow[] = [];
  const lithology: LithRow[] = [];

  if (input.collarText) {
    const { rows, errors: e } = parseCsvText(input.collarText, "collar");
    errors.push(...e);
    for (const r of rows) {
      const hole_id = String(r.hole_id ?? "").trim();
      const x = num(r.x), y = num(r.y), z = num(r.z);
      if (!hole_id || x == null || y == null || z == null) continue;
      collars.push({ hole_id, x, y, z });
    }
  }
  if (input.surveyText) {
    const { rows, errors: e } = parseCsvText(input.surveyText, "survey");
    errors.push(...e);
    for (const r of rows) {
      const hole_id = String(r.hole_id ?? "").trim();
      const depth = num(r.depth), azimuth = num(r.azimuth), dip = num(r.dip);
      if (!hole_id || depth == null || azimuth == null || dip == null) continue;
      surveys.push({ hole_id, depth, azimuth, dip });
    }
  }
  if (input.assayText) {
    const { rows, errors: e } = parseCsvText(input.assayText, "assay");
    errors.push(...e);
    for (const r of rows) {
      const hole_id = String(r.hole_id ?? "").trim();
      const from = num(r.from), to = num(r.to), grade = num(r.grade);
      if (!hole_id || from == null || to == null || grade == null) continue;
      assays.push({ hole_id, from, to, grade, element: r.element ? String(r.element) : undefined });
    }
  }
  if (input.lithText) {
    const { rows, errors: e } = parseCsvText(input.lithText, "lithology");
    errors.push(...e);
    for (const r of rows) {
      const hole_id = String(r.hole_id ?? "").trim();
      const from = num(r.from), to = num(r.to);
      if (!hole_id || from == null || to == null) continue;
      lithology.push({
        hole_id, from, to,
        lith_code: String(r.lith_code ?? "u"),
        color: r.color ? String(r.color) : undefined,
      });
    }
  }
  return { collars, surveys, assays, lithology, errors };
}

/** Interpola azimuth/dip linealmente a una profundidad dada para un hole. */
export function interpAzDip(
  surveys: SurveyRow[],
  holeId: string,
  depth: number,
): { azimuth: number; dip: number } {
  const list = surveys
    .filter((s) => s.hole_id === holeId)
    .sort((a, b) => a.depth - b.depth);
  if (list.length === 0) return { azimuth: 0, dip: -90 };
  if (depth <= list[0].depth) return { azimuth: list[0].azimuth, dip: list[0].dip };
  if (depth >= list[list.length - 1].depth) {
    const last = list[list.length - 1];
    return { azimuth: last.azimuth, dip: last.dip };
  }
  for (let i = 1; i < list.length; i++) {
    if (depth <= list[i].depth) {
      const a = list[i - 1];
      const b = list[i];
      const t = (depth - a.depth) / (b.depth - a.depth);
      return {
        azimuth: a.azimuth + (b.azimuth - a.azimuth) * t,
        dip: a.dip + (b.dip - a.dip) * t,
      };
    }
  }
  return { azimuth: list[0].azimuth, dip: list[0].dip };
}

/** Desurvey: convierte collar + surveys en una lista de puntos XYZ a lo largo del hole. */
export function desurveyHole(
  collar: CollarRow,
  surveys: SurveyRow[],
  totalDepth: number,
  step = 5,
): Array<{ depth: number; x: number; y: number; z: number; azimuth: number; dip: number }> {
  const out: Array<{ depth: number; x: number; y: number; z: number; azimuth: number; dip: number }> = [];
  let cx = collar.x, cy = collar.y, cz = collar.z;
  let d = 0;
  out.push({ depth: 0, x: cx, y: cy, z: cz, azimuth: 0, dip: -90 });
  while (d < totalDepth) {
    const nextD = Math.min(d + step, totalDepth);
    const mid = (d + nextD) / 2;
    const { azimuth, dip } = interpAzDip(surveys, collar.hole_id, mid);
    const dl = nextD - d;
    const azR = (azimuth * Math.PI) / 180;
    const dpR = (dip * Math.PI) / 180;
    cx += dl * Math.cos(dpR) * Math.sin(azR);
    cy += dl * Math.cos(dpR) * Math.cos(azR);
    cz += dl * Math.sin(dpR);
    out.push({ depth: nextD, x: cx, y: cy, z: cz, azimuth, dip });
    d = nextD;
  }
  return out;
}
