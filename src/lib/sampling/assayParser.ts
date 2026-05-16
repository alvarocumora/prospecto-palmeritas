/**
 * Parser para assay sheets típicos de laboratorios (ALS, SGS, Bureau Veritas, ACME).
 * Detecta automáticamente:
 *  - Columna sample_code (SAMPLE, SAMPLE ID, SAMPLE_ID, MUESTRA, ID).
 *  - Elementos por nombre+unidad: Au_ppm/Au g/t, Ag_ppm, Cu_pct/Cu_%, As_ppm, Sb_ppm, Hg_ppm, Pb_ppm, Zn_ppm, Mo_ppm.
 *  - QA/QC por código: BLK/BLANK -> blank, STD/CRM -> standard, DUP/DUPLICATE/-D sufijo -> duplicate.
 *  - Below-detection-limit: "<0.005" -> 0.0025 (mitad), ">10000" -> 10000.
 */

export type QcType = "sample" | "blank" | "standard" | "duplicate";

export type ParsedAssay = {
  rowNum: number;
  sample_code: string;
  qc_type: QcType;
  parent_code: string | null; // for duplicates: original sample
  au_gpt: number | null;
  ag_gpt: number | null;
  cu_pct: number | null;
  as_ppm: number | null;
  sb_ppm: number | null;
  hg_ppm: number | null;
  pb_ppm: number | null;
  zn_ppm: number | null;
  mo_ppm: number | null;
  certificate: string | null;
  lab: string | null;
  errors: string[];
  warnings: string[];
};

export type AssayParseResult = {
  rows: ParsedAssay[];
  headerError: string | null;
  detectedColumns: Record<string, string>; // logical -> actual header
  qcStats: { samples: number; blanks: number; standards: number; duplicates: number };
};

function detectDelimiter(line: string): string {
  const counts = { ",": 0, ";": 0, "\t": 0 };
  for (const ch of line) if (ch in counts) (counts as Record<string, number>)[ch]++;
  if (counts["\t"] > counts[","] && counts["\t"] > counts[";"]) return "\t";
  if (counts[";"] > counts[","]) return ";";
  return ",";
}

function parseCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (c === delim && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function toNum(s: string): { value: number | null; flag: "ok" | "bdl" | "above" | "invalid" } {
  if (!s || s === "" || s === "-" || s.toUpperCase() === "NA" || s.toUpperCase() === "N/A") {
    return { value: null, flag: "ok" };
  }
  const trimmed = s.replace(/,/g, ".").trim();
  // Below detection: "<0.005" -> half of detection limit
  const ltMatch = trimmed.match(/^<\s*([\d.]+)$/);
  if (ltMatch) {
    const dl = parseFloat(ltMatch[1]);
    return Number.isFinite(dl) ? { value: dl / 2, flag: "bdl" } : { value: null, flag: "invalid" };
  }
  // Above range: ">10000" -> use the value
  const gtMatch = trimmed.match(/^>\s*([\d.]+)$/);
  if (gtMatch) {
    const v = parseFloat(gtMatch[1]);
    return Number.isFinite(v) ? { value: v, flag: "above" } : { value: null, flag: "invalid" };
  }
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? { value: n, flag: "ok" } : { value: null, flag: "invalid" };
}

/** Convert ppm -> g/t (1:1) or ppb -> g/t (÷1000). Returns same value if already gpt. */
function normalizeAuAg(value: number | null, unit: string): number | null {
  if (value == null) return null;
  const u = unit.toLowerCase();
  if (u.includes("ppb")) return value / 1000;
  return value; // ppm or g/t are equivalent (1 ppm = 1 g/t)
}

/** Convert pct -> pct, ppm -> pct (÷10000). */
function normalizeCuPct(value: number | null, unit: string): number | null {
  if (value == null) return null;
  const u = unit.toLowerCase();
  if (u.includes("ppm")) return value / 10000;
  return value;
}

/** Map common header variations to a logical field. Returns { logical, unit }. */
function classifyHeader(h: string): { logical: string; unit: string } | null {
  const norm = h.toLowerCase().replace(/[\s_\-/.]/g, "");
  // Sample code
  if (
    /^(sample|sampleid|sampleno|samplenumber|sampleidentifier|muestra|id|codigo|code)$/.test(norm)
  )
    return { logical: "sample_code", unit: "" };
  // Certificate / job
  if (/^(certificate|cert|certno|jobno|job|wo|workorder|labjob)$/.test(norm))
    return { logical: "certificate", unit: "" };
  // Lab
  if (/^(lab|laboratory|laboratorio)$/.test(norm)) return { logical: "lab", unit: "" };

  // Element_unit pattern: au_ppm, augpt, agppm, cupct, cu_, asppm
  // Try to match "<elem><unit>" where elem is 1-2 letters and unit is gpt/ppm/ppb/pct/%
  const m = norm.match(/^([a-z]{1,3})(gpt|ppm|ppb|pct|%)$/);
  if (m) {
    const elem = m[1];
    const unit = m[2] === "%" ? "pct" : m[2];
    const map: Record<string, string> = {
      au: "au",
      ag: "ag",
      cu: "cu",
      as: "as",
      sb: "sb",
      hg: "hg",
      pb: "pb",
      zn: "zn",
      mo: "mo",
    };
    if (elem in map) return { logical: map[elem], unit };
  }
  // Bare element default unit
  const bare = norm.match(/^([a-z]{1,3})$/);
  if (bare) {
    const elem = bare[1];
    const defaults: Record<string, string> = {
      au: "ppm",
      ag: "ppm",
      cu: "pct",
      as: "ppm",
      sb: "ppm",
      hg: "ppm",
      pb: "ppm",
      zn: "ppm",
      mo: "ppm",
    };
    if (elem in defaults) return { logical: elem, unit: defaults[elem] };
  }
  return null;
}

/** Detect QC type by sample code conventions. */
export function detectQcType(code: string): { type: QcType; parent: string | null } {
  const c = code.toUpperCase().trim();
  if (/^(BLK|BLANK)[\-_]?\d*$/.test(c) || c.includes("BLANK"))
    return { type: "blank", parent: null };
  if (
    /^(STD|CRM|STANDARD|REF)[\-_]?\w*$/.test(c) ||
    c.startsWith("OREAS") ||
    c.startsWith("CDN") ||
    c.startsWith("GBM")
  ) {
    return { type: "standard", parent: null };
  }
  // Duplicates: SAMPLE-D, SAMPLE_DUP, SAMPLE.DUPL, DUP-001
  const dupSuffix = c.match(/^(.+?)[\-_.](D|DUP|DUPL|DUPLICATE)$/);
  if (dupSuffix) return { type: "duplicate", parent: dupSuffix[1] };
  if (/^(DUP|DUPLICATE)[\-_]?\w+$/.test(c)) return { type: "duplicate", parent: null };
  return { type: "sample", parent: null };
}

export function parseAssayCsv(text: string): AssayParseResult {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      rows: [],
      headerError: "El archivo debe tener al menos cabecera + 1 fila",
      detectedColumns: {},
      qcStats: { samples: 0, blanks: 0, standards: 0, duplicates: 0 },
    };
  }
  const delim = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delim);

  // Build column map: logical -> { index, unit }
  const colMap: Record<string, { idx: number; unit: string; original: string }> = {};
  headers.forEach((h, idx) => {
    const cls = classifyHeader(h);
    if (cls && !(cls.logical in colMap)) {
      colMap[cls.logical] = { idx, unit: cls.unit, original: h };
    }
  });

  if (!("sample_code" in colMap)) {
    return {
      rows: [],
      headerError: `No se detectó columna de código de muestra. Esperado: SAMPLE, SAMPLE_ID, MUESTRA, ID. Encontrado: ${headers.join(", ")}`,
      detectedColumns: {},
      qcStats: { samples: 0, blanks: 0, standards: 0, duplicates: 0 },
    };
  }

  const detected: Record<string, string> = {};
  for (const k of Object.keys(colMap)) detected[k] = colMap[k].original;

  const rows: ParsedAssay[] = [];
  const stats = { samples: 0, blanks: 0, standards: 0, duplicates: 0 };
  const seenCodes = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i], delim);
    const get = (k: string): string => (k in colMap ? (cells[colMap[k].idx] ?? "") : "");
    const getNum = (k: string): { v: number | null; warn: string | null } => {
      if (!(k in colMap)) return { v: null, warn: null };
      const r = toNum(cells[colMap[k].idx] ?? "");
      if (r.flag === "invalid")
        return { v: null, warn: `${k.toUpperCase()}: valor no numérico "${cells[colMap[k].idx]}"` };
      if (r.flag === "bdl")
        return { v: r.value, warn: `${k.toUpperCase()}: bajo límite de detección` };
      if (r.flag === "above") return { v: r.value, warn: `${k.toUpperCase()}: sobre rango` };
      return { v: r.value, warn: null };
    };

    const code = get("sample_code").trim();
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!code) errors.push("sample_code vacío");
    if (code && seenCodes.has(code)) warnings.push("Código duplicado en archivo");
    if (code) seenCodes.add(code);

    const qc = code ? detectQcType(code) : { type: "sample" as QcType, parent: null };
    stats[
      qc.type === "sample"
        ? "samples"
        : qc.type === "blank"
          ? "blanks"
          : qc.type === "standard"
            ? "standards"
            : "duplicates"
    ]++;

    const auRaw = getNum("au");
    const agRaw = getNum("ag");
    const cuRaw = getNum("cu");
    const asRaw = getNum("as");
    const sbRaw = getNum("sb");
    const hgRaw = getNum("hg");
    const pbRaw = getNum("pb");
    const znRaw = getNum("zn");
    const moRaw = getNum("mo");
    [auRaw, agRaw, cuRaw, asRaw, sbRaw, hgRaw, pbRaw, znRaw, moRaw].forEach((r) => {
      if (r.warn) warnings.push(r.warn);
    });

    rows.push({
      rowNum: i + 1,
      sample_code: code,
      qc_type: qc.type,
      parent_code: qc.parent,
      au_gpt: normalizeAuAg(auRaw.v, colMap["au"]?.unit ?? "ppm"),
      ag_gpt: normalizeAuAg(agRaw.v, colMap["ag"]?.unit ?? "ppm"),
      cu_pct: normalizeCuPct(cuRaw.v, colMap["cu"]?.unit ?? "pct"),
      as_ppm: asRaw.v,
      sb_ppm: sbRaw.v,
      hg_ppm: hgRaw.v,
      pb_ppm: pbRaw.v,
      zn_ppm: znRaw.v,
      mo_ppm: moRaw.v,
      certificate: get("certificate") || null,
      lab: get("lab") || null,
      errors,
      warnings,
    });
  }

  return { rows, headerError: null, detectedColumns: detected, qcStats: stats };
}

/* ------------------------------- QA/QC checks ------------------------------- */

export type QcAlert = {
  rowNum: number;
  sample_code: string;
  type: "blank_contamination" | "duplicate_mismatch" | "standard_out_of_range";
  message: string;
  severity: "warning" | "critical";
};

const BLANK_AU_THRESHOLD = 0.01; // g/t — anything above is contamination
const DUPLICATE_REL_DIFF_PCT = 20; // > 20% half-relative-difference flagged

export function runQaQc(rows: ParsedAssay[]): QcAlert[] {
  const alerts: QcAlert[] = [];
  const byCode = new Map<string, ParsedAssay>();
  for (const r of rows) if (r.qc_type === "sample") byCode.set(r.sample_code, r);

  for (const r of rows) {
    if (r.qc_type === "blank") {
      if ((r.au_gpt ?? 0) > BLANK_AU_THRESHOLD) {
        alerts.push({
          rowNum: r.rowNum,
          sample_code: r.sample_code,
          type: "blank_contamination",
          message: `Au=${r.au_gpt?.toFixed(3)} g/t en blanco (umbral ${BLANK_AU_THRESHOLD})`,
          severity: "critical",
        });
      }
    }
    if (r.qc_type === "duplicate" && r.parent_code) {
      const parent = byCode.get(r.parent_code);
      if (!parent) {
        alerts.push({
          rowNum: r.rowNum,
          sample_code: r.sample_code,
          type: "duplicate_mismatch",
          message: `Muestra original ${r.parent_code} no encontrada`,
          severity: "warning",
        });
      } else if (
        parent.au_gpt != null &&
        r.au_gpt != null &&
        Math.max(parent.au_gpt, r.au_gpt) > 0.1
      ) {
        const hrd = (Math.abs(parent.au_gpt - r.au_gpt) / ((parent.au_gpt + r.au_gpt) / 2)) * 100;
        if (hrd > DUPLICATE_REL_DIFF_PCT) {
          alerts.push({
            rowNum: r.rowNum,
            sample_code: r.sample_code,
            type: "duplicate_mismatch",
            message: `HRD=${hrd.toFixed(1)}% Au vs ${r.parent_code} (${parent.au_gpt} vs ${r.au_gpt})`,
            severity: "warning",
          });
        }
      }
    }
  }
  return alerts;
}
