import { resolveGeoLayer } from "./layerRegistry";

export type GeoLayerPreference = { visible: boolean; opacity: number };
export type GeoLayerPreferences = Record<string, GeoLayerPreference>;

export function preferenceLayerId(id: string): string {
  return resolveGeoLayer(id)?.id ?? id;
}

export function parseLayerPreferences(raw: string | null): GeoLayerPreferences {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: GeoLayerPreferences = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const entry = value as Record<string, unknown>;
      if (
        typeof entry.visible !== "boolean" ||
        typeof entry.opacity !== "number" ||
        !Number.isFinite(entry.opacity) ||
        entry.opacity < 0 || entry.opacity > 1
      ) continue;
      result[preferenceLayerId(id)] = { visible: entry.visible, opacity: entry.opacity };
    }
    return result;
  } catch {
    return {};
  }
}
