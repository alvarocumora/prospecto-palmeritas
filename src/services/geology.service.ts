import { supabase } from "@/integrations/supabase/client";
import type {
  AlterationZone,
  GeologicalFeature,
  GeologyData,
  GeoReference,
  LithologyUnit,
  Mineral,
} from "@/types/geology";

export async function fetchGeologyData(): Promise<GeologyData> {
  const [litho, alteration, minerals, features, references] = await Promise.all([
    supabase.from("lithology_units").select("*").order("display_order"),
    supabase.from("alteration_zones").select("*").order("display_order"),
    supabase.from("mineralogy").select("*").order("display_order"),
    supabase.from("geological_features").select("*").order("feature_code"),
    supabase.from("geo_references").select("*").order("year", { ascending: false }),
  ]);

  const firstError =
    litho.error || alteration.error || minerals.error || features.error || references.error;
  if (firstError) throw firstError;

  return {
    litho: (litho.data ?? []) as LithologyUnit[],
    alteration: (alteration.data ?? []) as AlterationZone[],
    minerals: (minerals.data ?? []) as Mineral[],
    features: (features.data ?? []) as GeologicalFeature[],
    references: (references.data ?? []) as GeoReference[],
  };
}
