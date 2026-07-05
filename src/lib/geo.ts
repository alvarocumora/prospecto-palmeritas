// Utilidades geoespaciales compartidas entre server functions públicos.

/**
 * Centroide aproximado de una geometría GeoJSON (Point exacto; para el resto,
 * promedio de todos los vértices). Devuelve [lng, lat] o null si no hay
 * coordenadas válidas.
 */
export function centroidOf(geom: unknown): [number, number] | null {
  if (!geom || typeof geom !== "object") return null;
  const g = geom as { type?: string; coordinates?: unknown };
  try {
    if (g.type === "Point" && Array.isArray(g.coordinates)) {
      return [Number(g.coordinates[0]), Number(g.coordinates[1])];
    }
    let sx = 0,
      sy = 0,
      n = 0;
    const walk = (c: unknown) => {
      if (!Array.isArray(c)) return;
      if (typeof c[0] === "number") {
        sx += c[0];
        sy += c[1];
        n++;
      } else {
        for (const x of c) walk(x);
      }
    };
    walk(g.coordinates);
    if (n === 0) return null;
    return [sx / n, sy / n];
  } catch {
    return null;
  }
}
