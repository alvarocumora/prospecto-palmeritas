// Cruce KMZ pertenencias Franco × catastro real (mining_concessions).
// El GeoJSON proviene del KMZ "FINAL_GIANFRANCO" subido por el operador.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import francoPertenencias from "@/data/geo/franco_pertenencias.geojson?raw";

export type FrancoPertenenciaMatch = {
  kmlName: string;
  concessionId: string | null;
  concessionCode: string | null;
  concessionName: string | null;
  holder: string | null;
  type: string | null;
  status: string | null;
  areaHaDb: number | null;
  commune: string | null;
  region: string | null;
  overlapHa: number;
  pctOfKml: number;
  pctOfConcession: number;
  matchKind: "EXACT" | "NAME~" | "GEOM" | "NONE";
};

export type FrancoCadastreCross = {
  projectId: string | null;
  projectName: string | null;
  totalKmlPolygons: number;
  matchedKmlPolygons: number;
  totalAreaHa: number;
  uniqueConcessions: number;
  rows: FrancoPertenenciaMatch[];
  generatedAt: string;
};

type GeoJsonFC = {
  type: "FeatureCollection";
  features: { type: "Feature"; properties: { name: string }; geometry: unknown }[];
};

export const getFrancoCadastreCross = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FrancoCadastreCross> => {
    const { supabase } = context;
    const fc = JSON.parse(francoPertenencias) as GeoJsonFC;

    // Locate the Gianfranco project (concessions GF-CONC-*)
    const { data: projRows } = await supabase
      .from("projects")
      .select("id, name")
      .ilike("name", "%Gianfranco%")
      .limit(1);
    const project = projRows?.[0] ?? null;

    const rows: FrancoPertenenciaMatch[] = [];
    const matchedNames = new Set<string>();
    const concessionIds = new Set<string>();

    for (const feat of fc.features) {
      const kmlName = (feat.properties?.name ?? "(sin nombre)").trim();
      const { data, error } = await supabase.rpc("franco_match_pertenencia", {
        p_geom: feat.geometry as never,
        p_name: kmlName,
      });
      if (error) {
        console.error("franco_match_pertenencia error", error);
        rows.push({
          kmlName, concessionId: null, concessionCode: null, concessionName: null,
          holder: null, type: null, status: null, areaHaDb: null,
          commune: null, region: null, overlapHa: 0, pctOfKml: 0, pctOfConcession: 0,
          matchKind: "NONE",
        });
        continue;
      }
      const matches = (data ?? []) as Array<{
        concession_id: string; code: string; name: string; holder: string | null;
        concession_type: string; status: string; area_ha: number | null;
        commune: string | null; region: string | null;
        overlap_ha: number; pct_of_kml: number; pct_of_concession: number;
        match_kind: "EXACT" | "NAME~" | "GEOM";
      }>;
      if (matches.length === 0) {
        rows.push({
          kmlName, concessionId: null, concessionCode: null, concessionName: null,
          holder: null, type: null, status: null, areaHaDb: null,
          commune: null, region: null, overlapHa: 0, pctOfKml: 0, pctOfConcession: 0,
          matchKind: "NONE",
        });
        continue;
      }
      for (const m of matches) {
        if (m.match_kind === "EXACT" || m.match_kind === "GEOM") matchedNames.add(kmlName);
        concessionIds.add(m.concession_id);
        rows.push({
          kmlName,
          concessionId: m.concession_id,
          concessionCode: m.code,
          concessionName: m.name,
          holder: m.holder,
          type: m.concession_type,
          status: m.status,
          areaHaDb: m.area_ha == null ? null : Number(m.area_ha),
          commune: m.commune,
          region: m.region,
          overlapHa: Number(m.overlap_ha ?? 0),
          pctOfKml: Number(m.pct_of_kml ?? 0),
          pctOfConcession: Number(m.pct_of_concession ?? 0),
          matchKind: m.match_kind,
        });
      }
    }

    const totalAreaHa = rows
      .filter((r) => r.matchKind === "EXACT")
      .reduce((a, r) => a + (r.areaHaDb ?? 0), 0);

    return {
      projectId: project?.id ?? null,
      projectName: project?.name ?? null,
      totalKmlPolygons: fc.features.length,
      matchedKmlPolygons: matchedNames.size,
      totalAreaHa: Math.round(totalAreaHa * 100) / 100,
      uniqueConcessions: concessionIds.size,
      rows,
      generatedAt: new Date().toISOString(),
    };
  });
