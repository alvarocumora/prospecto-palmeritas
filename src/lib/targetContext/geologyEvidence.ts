import centroid from "@turf/centroid";
import type { Feature, Geometry } from "geojson";
import type { GeoCopilotEvidenceRef } from "@/types/geoCopilot";
import { haversineMeters } from "@/hooks/useGeolocation";
import type {
  AlterationMapUnit,
  GeologicalFeatureRow,
  LithologyMapUnit,
} from "@/hooks/useProjectGeologyMap";

export type TargetGeologyInput = {
  lat: number;
  lng: number;
  features: GeologicalFeatureRow[];
  lithology: LithologyMapUnit[];
  alteration: AlterationMapUnit[];
  /** Max distance in meters between target and feature centroid. */
  radiusM?: number;
};

export type NearbyGeologyFeature = {
  feature: GeologicalFeatureRow;
  distanceM: number;
  lithology: LithologyMapUnit | null;
  alteration: AlterationMapUnit | null;
};

export type TargetGeologyEvidence = {
  nearby: NearbyGeologyFeature[];
  hostRocks: Array<{ unit: LithologyMapUnit; count: number; minDistanceM: number }>;
  alterations: Array<{ unit: AlterationMapUnit; count: number; minDistanceM: number }>;
  evidence: GeoCopilotEvidenceRef[];
};

function featureCentroid(geom: Geometry): { lat: number; lng: number } | null {
  try {
    const f = { type: "Feature", geometry: geom, properties: {} } as Feature<Geometry>;
    const c = centroid(f);
    const [lng, lat] = c.geometry.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

function confidenceFromDistance(distanceM: number, radiusM: number): "high" | "medium" | "low" {
  if (distanceM <= radiusM * 0.25) return "high";
  if (distanceM <= radiusM * 0.6) return "medium";
  return "low";
}

export function buildTargetGeologyEvidence(input: TargetGeologyInput): TargetGeologyEvidence {
  const radiusM = input.radiusM ?? 1500;
  const lithoById = new Map(input.lithology.map((u) => [u.id, u]));
  const altById = new Map(input.alteration.map((u) => [u.id, u]));

  const nearby: NearbyGeologyFeature[] = [];
  for (const f of input.features) {
    if (!f.geometry_geojson) continue;
    const c = featureCentroid(f.geometry_geojson);
    if (!c) continue;
    const distanceM = haversineMeters({ lat: input.lat, lng: input.lng }, c);
    if (distanceM > radiusM) continue;
    nearby.push({
      feature: f,
      distanceM,
      lithology: f.lithology_id ? (lithoById.get(f.lithology_id) ?? null) : null,
      alteration: f.alteration_id ? (altById.get(f.alteration_id) ?? null) : null,
    });
  }
  nearby.sort((a, b) => a.distanceM - b.distanceM);

  // Aggregate by unit
  const lithoAgg = new Map<string, { unit: LithologyMapUnit; count: number; minDistanceM: number }>();
  const altAgg = new Map<string, { unit: AlterationMapUnit; count: number; minDistanceM: number }>();

  for (const n of nearby) {
    if (n.lithology) {
      const cur = lithoAgg.get(n.lithology.id);
      if (cur) {
        cur.count += 1;
        cur.minDistanceM = Math.min(cur.minDistanceM, n.distanceM);
      } else {
        lithoAgg.set(n.lithology.id, {
          unit: n.lithology,
          count: 1,
          minDistanceM: n.distanceM,
        });
      }
    }
    if (n.alteration) {
      const cur = altAgg.get(n.alteration.id);
      if (cur) {
        cur.count += 1;
        cur.minDistanceM = Math.min(cur.minDistanceM, n.distanceM);
      } else {
        altAgg.set(n.alteration.id, {
          unit: n.alteration,
          count: 1,
          minDistanceM: n.distanceM,
        });
      }
    }
  }

  const hostRocks = [...lithoAgg.values()].sort((a, b) => a.minDistanceM - b.minDistanceM);
  const alterations = [...altAgg.values()].sort((a, b) => a.minDistanceM - b.minDistanceM);

  const evidence: GeoCopilotEvidenceRef[] = [
    ...hostRocks.map<GeoCopilotEvidenceRef>((h) => ({
      id: `lithology:${h.unit.id}`,
      category: "lithology",
      label: `Host rock ${h.unit.name}${h.unit.rock_type ? ` (${h.unit.rock_type})` : ""} · ${h.count} unidad${h.count === 1 ? "" : "es"} a ≥${Math.round(h.minDistanceM)} m`,
      confidence: confidenceFromDistance(h.minDistanceM, radiusM),
      source: "Geological mapping",
      metadata: {
        unit_code: h.unit.unit_code,
        formation: h.unit.formation,
        age: h.unit.age,
        min_distance_m: Math.round(h.minDistanceM),
        feature_count: h.count,
      },
    })),
    ...alterations.map<GeoCopilotEvidenceRef>((a) => ({
      id: `alteration:${a.unit.id}`,
      category: "alteration",
      label: `Alteración ${a.unit.name}${a.unit.assemblage ? ` · ${a.unit.assemblage}` : ""}${a.unit.intensity ? ` (${a.unit.intensity})` : ""} a ≥${Math.round(a.minDistanceM)} m`,
      confidence: confidenceFromDistance(a.minDistanceM, radiusM),
      source: "Alteration mapping",
      metadata: {
        zone_code: a.unit.zone_code,
        intensity: a.unit.intensity,
        min_distance_m: Math.round(a.minDistanceM),
        feature_count: a.count,
      },
    })),
  ];

  return { nearby, hostRocks, alterations, evidence };
}
