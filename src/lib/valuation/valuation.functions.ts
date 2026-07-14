import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  consolidateMethods,
  dcfValuation,
  insituValuation,
  marketCompsValuation,
  replacementCostValuation,
  type MarketComp,
  type ValuationBundle,
} from "./methods";

type MethodsAcc = ValuationBundle["methods"];

/**
 * Calcula la valuación completa de un listing usando las 4 metodologías.
 * Lee datos verificables desde:
 *   - property_listings (asking, area, commodity, stage, project_id)
 *   - resource_models  (recurso + ley + confianza)
 *   - economic_scenarios (NPV / IRR base)
 *   - market_comparables (dataset curado público)
 */
export const computeListingValuation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { listingId: string }) => {
    if (!input?.listingId) throw new Error("listingId requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // 1. Listing base
    const { data: listing, error: lerr } = await supabase
      .from("property_listings")
      .select(
        "id,title,commodity,country,stage,area_ha,asking_price_usd,project_id,royalty_pct,modality",
      )
      .eq("id", data.listingId)
      .maybeSingle();
    if (lerr) throw new Error(lerr.message);
    if (!listing) throw new Error("Listing no encontrado o sin permiso");

    // 2. Comparables (público)
    const { data: compsRaw } = await supabase
      .from("market_comparables")
      .select(
        "id,source,source_url,project_name,country,commodity,stage,area_ha,price_usd,price_per_ha_usd,deal_date",
      )
      .limit(500);
    const comps = (compsRaw ?? []) as MarketComp[];

    // 3. Recurso (si el listing tiene project_id)
    let resourceRow: {
      commodity: string;
      cutoff_grade: number | null;
      density_t_m3: number;
      confidence?: string;
      tonnes?: number;
      grade?: number;
    } | null = null;
    if (listing.project_id) {
      const { data: rm } = await supabase
        .from("resource_models")
        .select("*")
        .eq("project_id", listing.project_id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (rm) {
        // Nota: el schema puede no tener columnas tonnes/grade explícitas; intentamos rescatarlas.
        const rmAny = rm as Record<string, unknown>;
        const tonnesGuess =
          (rmAny.total_tonnes as number | undefined) ??
          (rmAny.tonnes as number | undefined) ??
          (rmAny.resource_tonnes as number | undefined) ??
          null;
        const gradeGuess =
          (rmAny.average_grade as number | undefined) ??
          (rmAny.grade as number | undefined) ??
          (rmAny.avg_grade as number | undefined) ??
          (rm.cutoff_grade ?? null);
        const confidenceGuess =
          ((rmAny.confidence_category as string) ??
            (rmAny.category as string) ??
            "inferred") || "inferred";
        if (tonnesGuess && gradeGuess) {
          resourceRow = {
            commodity: rm.commodity,
            cutoff_grade: rm.cutoff_grade,
            density_t_m3: rm.density_t_m3,
            tonnes: Number(tonnesGuess),
            grade: Number(gradeGuess),
            confidence: String(confidenceGuess).toLowerCase(),
          };
        }
      }
    }

    // 4. Escenario económico
    let scenario: { npv_usd?: number | null; irr_pct?: number | null; name?: string | null } | null =
      null;
    if (listing.project_id) {
      const { data: sc } = await supabase
        .from("economic_scenarios")
        .select("*")
        .eq("project_id", listing.project_id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sc) {
        const scAny = sc as Record<string, unknown>;
        scenario = {
          npv_usd:
            (scAny.npv_usd as number | undefined) ??
            (scAny.npv_after_tax_usd as number | undefined) ??
            (scAny.npv as number | undefined) ??
            null,
          irr_pct:
            (scAny.irr_pct as number | undefined) ??
            (scAny.irr as number | undefined) ??
            null,
          name: (scAny.name as string | undefined) ?? (scAny.scenario_name as string | undefined) ?? null,
        };
      }
    }

    // 5. Ejecutar metodologías
    const methods: ValuationBundle["methods"] = [];
    const m1 = replacementCostValuation({ area_ha: listing.area_ha, stage: listing.stage });
    if (m1) methods.push(m1);
    const m2 = marketCompsValuation({
      area_ha: listing.area_ha,
      commodity: listing.commodity,
      stage: listing.stage,
      country: listing.country,
      comps,
    });
    if (m2) methods.push(m2);
    if (resourceRow) {
      const m3 = insituValuation({
        commodity: resourceRow.commodity,
        resource_tonnes: resourceRow.tonnes ?? null,
        grade: resourceRow.grade ?? null,
        confidence: (resourceRow.confidence as "inferred") ?? "inferred",
      });
      if (m3) methods.push(m3);
    }
    if (scenario?.npv_usd) {
      const m4 = dcfValuation({
        npv_usd: scenario.npv_usd,
        irr_pct: scenario.irr_pct ?? null,
        scenario_name: scenario.name ?? null,
      });
      if (m4) methods.push(m4);
    }

    const bundle = consolidateMethods(methods, listing.asking_price_usd);
    return { ...bundle, listing };
  });
