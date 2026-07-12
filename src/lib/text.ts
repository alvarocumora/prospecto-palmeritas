// Utilidades de texto compartidas por los módulos de catastro/marketplace.
// Extraídas para eliminar duplicación (hash de dedupe y normalización de match).

/**
 * Hash FNV-1a de 32 bits en hexadecimal. Estable y determinista; se usa como
 * content_hash para deduplicar registros (boletines, remates) entre corridas.
 */
export function hash32(s: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return (h >>> 0).toString(16);
}

/**
 * Normaliza a MAYÚSCULAS alfanuméricas sin acentos ni signos. Se usa para el
 * match difuso de nombres/RUT/titulares y para indexar cabeceras por alias.
 */
export function normalizeAlnum(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
