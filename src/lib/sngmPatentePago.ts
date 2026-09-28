/**
 * Consulta de pago de patente minera — endpoint público de SERNAGEOMIN
 * (portalsdnmext.sernageomin.cl/propiedadminera/consulta-pago-concesion).
 *
 * A diferencia de catastro.sernageomin.cl (legacy, caído) y del sistema
 * "Rebaja Patente 21.649" (appsngmaz.sernageomin.cl/rebpatente21649 — exige
 * login ClaveÚnica, portal personal por RUT del titular), este endpoint
 * responde HTML sin autenticación para cualquier rol de concesión. No expone
 * JSON, así que se interpreta con expresiones regulares sobre la estructura
 * de tabla observada — si SERNAGEOMIN cambia el HTML, las funciones devuelven
 * null/[] en vez de lanzar, para no romper la ficha pública.
 */

const BASE = "https://portalsdnmext.sernageomin.cl/propiedadminera/consulta-pago-query";

export type PatenteTipo = "exploracion" | "explotacion";

export type PatentePagoRow = {
  periodo: string;
  fechaPago: string | null;
  folio: string | null;
  valorPagadoClp: number | null;
  hectareas: number | null;
  pertenencias: number | null;
};

export type PatentePagoConsulta = {
  found: boolean;
  rol: string | null;
  nombreConcesion: string | null;
  tipo: string | null;
  situacion: string | null;
  titular: string | null;
  rutTitular: string | null;
  pagos: PatentePagoRow[];
  consultadoEn: string;
};

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

/** Extrae el valor de una fila <tr><th>Label</th><td>Valor</td></tr>. */
function extractRow(html: string, label: string): string | null {
  const re = new RegExp(`<th[^>]*>\\s*${label}\\s*</th>\\s*<td[^>]*>([\\s\\S]*?)</td>`, "i");
  const m = re.exec(html);
  if (!m) return null;
  const value = stripTags(m[1]);
  return value || null;
}

function parseClp(raw: string | null): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, "");
  return digits ? Number(digits) : null;
}

function parseNum(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Consulta el estado de pago de patente de una concesión por rol.
 * `rol`: solo dígitos (sin puntos ni guión ni dígito verificador), tal como
 * lo exige el formulario oficial. `tipo`: exploración o explotación — hay que
 * probar ambos si no se sabe, ya que el mismo rol numérico puede existir en
 * cualquiera de los dos padrones.
 */
export async function fetchPatentePago(
  rol: string,
  tipo: PatenteTipo,
): Promise<PatentePagoConsulta | null> {
  const rolBase = rol.split("-")[0] ?? "";
  const rolDigits = rolBase.replace(/\D/g, "");
  if (!rolDigits) return null;
  const tipoParam = tipo === "exploracion" ? "1" : "2";
  const consultadoEn = new Date().toISOString();
  const url = `${BASE}?tipo=${tipoParam}&rol=${rolDigits}`;
  try {
    let html: string | null = null;
    // Un reintento: el endpoint ha mostrado fallos intermitentes de upstream
    // (503 "connect error") en pruebas, ajenos a los parámetros de la consulta.
    for (let attempt = 0; attempt < 2 && html === null; attempt++) {
      const res = await fetch(url, { headers: { Accept: "text/html" } });
      if (res.ok) html = await res.text();
    }
    if (html === null) return null;

    // Frase específica del bloque "sin resultados"; ojo que el boilerplate
    // i18n de DataTables incluido en TODA respuesta repite "No se
    // encontraron resultados" a secas (zeroRecords), así que hay que anclar
    // el sufijo "para la búsqueda" para no dar falso negativo con datos reales.
    if (/No se encontraron resultados para la búsqueda/i.test(html)) {
      return {
        found: false,
        rol: null,
        nombreConcesion: null,
        tipo: null,
        situacion: null,
        titular: null,
        rutTitular: null,
        pagos: [],
        consultadoEn,
      };
    }

    const rolValue = extractRow(html, "Rol");
    if (!rolValue) return null; // estructura no reconocida — no fabricar datos

    const pagos: PatentePagoRow[] = [];
    const rowRe =
      /<tr>\s*<td>\s*(\d{4})\s*<\/td>\s*<td>\s*([\s\S]*?)<\/td>\s*<td>\s*([\s\S]*?)<\/td>\s*<td[^>]*>\s*([\s\S]*?)<\/td>\s*<td[^>]*>\s*([\s\S]*?)<\/td>\s*<td[^>]*>\s*([\s\S]*?)<\/td>\s*<\/tr>/g;
    let m: RegExpExecArray | null;
    while ((m = rowRe.exec(html))) {
      pagos.push({
        periodo: stripTags(m[1]),
        fechaPago: stripTags(m[2]) || null,
        folio: stripTags(m[3]) || null,
        valorPagadoClp: parseClp(stripTags(m[4])),
        hectareas: parseNum(stripTags(m[5])),
        pertenencias: parseNum(stripTags(m[6])),
      });
    }

    return {
      found: true,
      rol: rolValue,
      nombreConcesion: extractRow(html, "Concesión"),
      tipo: extractRow(html, "Tipo"),
      situacion: extractRow(html, "Situación"),
      titular: extractRow(html, "Titular"),
      rutTitular: extractRow(html, "RUT Titular"),
      pagos,
      consultadoEn,
    };
  } catch {
    return null;
  }
}

/**
 * Igual que fetchPatentePago pero prueba explotación y exploración en
 * paralelo cuando no se conoce el tipo de antemano, y devuelve el primero
 * que encuentre resultados.
 */
export async function fetchPatentePagoAuto(rol: string): Promise<PatentePagoConsulta | null> {
  const [explotacion, exploracion] = await Promise.all([
    fetchPatentePago(rol, "explotacion"),
    fetchPatentePago(rol, "exploracion"),
  ]);
  if (explotacion?.found) return explotacion;
  if (exploracion?.found) return exploracion;
  return explotacion ?? exploracion ?? null;
}
