// Resumen de geología a nivel de proyecto (no de una pertenencia puntual),
// para el export "Mapa geológico PDF". Solo lee capas ya resueltas en el
// visor; no agrega ni interpola datos.
import type { FeatureCollection } from "geojson";

const str = (v: unknown) => (v == null || v === "" ? null : String(v));

export type GeologyUnit = {
  code: string;
  nombre: string;
  edad: string | null;
  litologia: string | null;
};

export type GeologyMapSummary = {
  units: GeologyUnit[];
  faultsCount: number;
  structuresMeasured: number;
  structuresWithDip: number;
  sheets: string[];
  gaps: string[];
};

/**
 * Cruza las capas reales cargadas en el visor para armar la leyenda del mapa
 * geológico. `visibleLayers` debe ser exactamente lo que se capturó en la
 * imagen (las capas encendidas); `allLayers` es el set completo resuelto,
 * usado solo para avisar si hay carta oficial cargada pero apagada — nunca
 * para construir la leyenda, que debe coincidir con lo que la imagen muestra.
 */
export function summarizeProjectGeology(
  visibleLayers: ReadonlyArray<{ id: string; data?: FeatureCollection }>,
  allLayers: ReadonlyArray<{ id: string; data?: FeatureCollection }> = visibleLayers,
): GeologyMapSummary {
  const get = (id: string) => visibleLayers.find((l) => l.id === id)?.data?.features ?? [];
  const hasHidden = (id: string) =>
    !visibleLayers.some((l) => l.id === id) &&
    (allLayers.find((l) => l.id === id)?.data?.features.length ?? 0) > 0;

  const unitsSeen = new Map<string, GeologyUnit>();
  const sheets = new Set<string>();
  for (const f of get("geology.official_map_units")) {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const code = str(p.codigo) ?? str(p.CODIGO) ?? "—";
    if (!unitsSeen.has(code)) {
      unitsSeen.set(code, {
        code,
        nombre: str(p.nombre) ?? str(p.NOMBRE) ?? "Unidad geológica",
        edad: str(p.edad),
        litologia: str(p.litologia),
      });
    }
    const fuente = str(p.fuente);
    if (fuente) sheets.add(fuente);
  }
  const faultFeatures = get("geology.official_faults");
  for (const f of faultFeatures) {
    const fuente = str((f.properties as Record<string, unknown> | null)?.fuente);
    if (fuente) sheets.add(fuente);
  }

  const structures = get("geology.structures");
  const withDip = structures.filter((f) =>
    Number.isFinite(Number((f.properties as Record<string, unknown> | null)?.manteo ?? NaN)),
  ).length;

  const units = [...unitsSeen.values()].sort((a, b) => a.code.localeCompare(b.code, "es"));

  const gaps: string[] = [];
  if (!units.length) {
    gaps.push(
      hasHidden("geology.official_map_units")
        ? "Carta geológica (unidades) cargada pero apagada en la vista capturada — enciéndela antes de exportar para incluirla."
        : "Sin carta geológica vectorial oficial publicada para esta zona.",
    );
  }
  if (!faultFeatures.length) {
    gaps.push(
      hasHidden("geology.official_faults")
        ? "Fallas de carta oficial cargadas pero apagadas en la vista capturada — enciéndelas antes de exportar para incluirlas."
        : "Sin fallas de carta oficial dentro del área del proyecto.",
    );
  }
  if (!structures.length) gaps.push("Sin estructuras medidas en terreno cargadas.");

  return {
    units,
    faultsCount: faultFeatures.length,
    structuresMeasured: structures.length,
    structuresWithDip: withDip,
    sheets: [...sheets].sort(),
    gaps,
  };
}
