// Parser de la nómina anual de remates por patente minera impaga.
//
// La TGR/SERNAGEOMIN no publican un API JSON de morosidad: el dato
// autoritativo es la nómina anual del proceso de amparo (Excel/PDF) que se
// envía a los tribunales antes del 1° de julio. El operador convierte esa
// planilla a filas (array de objetos con las cabeceras como llaves) y las
// envía a /api/public/ingest-patent-remates; este módulo las normaliza a
// RemateRow, tolerando las variantes de nombres de columna que usa la nómina.
import { hash32, normalizeAlnum } from "@/lib/text";

export type RemateRow = {
  year: number;
  rol: string | null;
  dv_rol: string | null;
  concession_code: string | null;
  concession_name: string | null;
  holder_name: string | null;
  holder_rut: string | null;
  region: string | null;
  comuna: string | null;
  concession_type: string | null;
  years_owed: number | null;
  amount_clp: number | null;
  court: string | null;
  court_role: string | null;
  status: string;
  source: string;
  source_url: string | null;
  content_hash: string;
  raw_payload: Record<string, unknown>;
};

/** Extrae de una fila el primer campo cuya cabecera normalizada matchea un alias. */
function pick(normRow: Record<string, unknown>, aliases: string[]): unknown {
  for (const a of aliases) {
    const v = normRow[normalizeAlnum(a)];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return null;
}

function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function toInt(v: unknown): number | null {
  const s = toStr(v);
  if (!s) return null;
  const n = parseInt(s.replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

/** Parsea un monto en CLP tolerando separadores de miles y decimales chilenos. */
function toClp(v: unknown): number | null {
  const s = toStr(v);
  if (!s) return null;
  // Quitar todo salvo dígitos, coma y punto; luego eliminar separador de miles.
  const cleaned = s.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;
  // En Chile el punto es miles y la coma decimal; los montos de patente son
  // enteros, así que basta con quedarnos con los dígitos.
  const digits = cleaned.replace(/[.,]/g, "");
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

/** rol + dv → "rol-dv" (misma forma que el `code` de la ficha de concesión). */
export function normalizeConcessionCode(rol: string | null, dv: string | null): string | null {
  if (!rol) return null;
  const rolDigits = rol.replace(/[^\dkK]/g, "");
  if (!rolDigits) return null;
  const dvClean = dv ? dv.replace(/[^\dkK]/g, "") : "";
  return dvClean ? `${rolDigits}-${dvClean}` : rolDigits;
}

const TYPE_ALIASES: Record<string, string> = {
  EXPLOTACION: "explotacion",
  EXPLORACION: "exploracion",
};

function normalizeType(v: string | null): string | null {
  if (!v) return null;
  const k = normalizeAlnum(v);
  if (k.includes("EXPLOTA")) return "explotacion";
  if (k.includes("EXPLORA")) return "exploracion";
  return TYPE_ALIASES[k] ?? v.toLowerCase();
}

export type ParseRematesOptions = {
  year: number;
  source?: string;
  sourceUrl?: string | null;
};

/**
 * Normaliza filas crudas de la nómina de remates a RemateRow[].
 * Descarta filas sin rol ni nombre de concesión (encabezados, totales, vacías).
 */
export function parseRemateRows(
  rows: Array<Record<string, unknown>>,
  opts: ParseRematesOptions,
): RemateRow[] {
  const source = opts.source ?? "sernageomin-amparo";
  const sourceUrl = opts.sourceUrl ?? null;
  const out: RemateRow[] = [];

  for (const raw of rows) {
    // Reindexar por cabecera normalizada para el match por alias.
    const normRow: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) normRow[normalizeAlnum(k)] = v;

    // El rol puede venir separado (ROL + DV) o combinado ("63010070-4").
    let rol = toStr(pick(normRow, ["ROL", "NUMERO_ROL", "N ROL", "ROL CONCESION", "N_ROL"]));
    let dv = toStr(pick(normRow, ["DV", "DV_ROL", "DIGITO", "DIGITO VERIFICADOR"]));
    if (rol && !dv && /-[\dkK]$/.test(rol)) {
      const parts = rol.split("-");
      dv = parts.pop() ?? null;
      rol = parts.join("-");
    }

    const concession_name = toStr(
      pick(normRow, ["NOMBRE", "NOMBRE CONCESION", "CONCESION", "NOMBRE_CONCESION"]),
    );
    if (!rol && !concession_name) continue; // fila no útil

    const concession_code = normalizeConcessionCode(rol, dv);
    const holder_name = toStr(
      pick(normRow, [
        "TITULAR",
        "PROPIETARIO",
        "CONCESIONARIO",
        "TITULAR_NOMBRE",
        "NOMBRE TITULAR",
      ]),
    );
    const holder_rut = toStr(pick(normRow, ["RUT", "RUT TITULAR", "TITULAR_RUT", "RUT_TITULAR"]));
    const region = toStr(pick(normRow, ["REGION"]));
    const comuna = toStr(pick(normRow, ["COMUNA"]));
    const concession_type = normalizeType(
      toStr(pick(normRow, ["TIPO", "TIPO CONCESION", "TIPO_CONCESION", "CLASE"])),
    );
    const years_owed = toInt(
      pick(normRow, ["ANOS", "ANOS ADEUDADOS", "ANIOS", "N ANOS", "PERIODOS"]),
    );
    const amount_clp = toClp(
      pick(normRow, ["MONTO", "VALOR", "VALOR ADEUDADO", "MONTO ADEUDADO", "DEUDA", "PATENTE"]),
    );
    const court = toStr(pick(normRow, ["TRIBUNAL", "JUZGADO", "TRIBUNAL COMPETENTE"]));
    const court_role = toStr(
      pick(normRow, ["ROL CAUSA", "ROL TRIBUNAL", "ROL_CAUSA", "CAUSA", "ROL REMATE"]),
    );

    // El hash identifica el evento de remate: mismo rol+año+causa = misma fila.
    const content_hash = hash32(
      `${opts.year}|${concession_code ?? concession_name}|${court_role ?? ""}`,
    );

    out.push({
      year: opts.year,
      rol,
      dv_rol: dv,
      concession_code,
      concession_name,
      holder_name,
      holder_rut,
      region,
      comuna,
      concession_type,
      years_owed,
      amount_clp,
      court,
      court_role,
      status: "nomina",
      source,
      source_url: sourceUrl,
      content_hash,
      raw_payload: raw,
    });
  }

  return out;
}
