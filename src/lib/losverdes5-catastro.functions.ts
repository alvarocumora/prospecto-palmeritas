// Server function: invoca la edge function match-project-catastro
// para enlazar las concesiones del proyecto Los Verdes 5 a polígonos
// reales del catastro SERNAGEOMIN.
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TILAMA_PROJECT_ID = "7a499b02-ecdf-447b-8956-b106fe4ec087";

export type SyncCatastroResult = {
  ok: boolean;
  fetched: number;
  upserted_to_national: number;
  matched: number;
  unmatched: number;
  results: Array<{
    local_code: string;
    local_name: string;
    matched: boolean;
    matched_rol?: string | null;
    matched_name?: string | null;
    score?: number;
    reason?: string;
  }>;
  error?: string;
};

export const syncLosVerdes5Catastro = createServerFn({ method: "POST" })
  .inputValidator((input: { radiusKm?: number; dryRun?: boolean } | undefined) => input ?? {})
  .handler(async ({ data }): Promise<SyncCatastroResult> => {
    const { data: result, error } = await supabaseAdmin.functions.invoke(
      "match-project-catastro",
      {
        body: {
          projectId: TILAMA_PROJECT_ID,
          radiusKm: data.radiusKm ?? 15,
          dryRun: data.dryRun ?? false,
        },
      },
    );
    if (error) {
      return {
        ok: false,
        fetched: 0,
        upserted_to_national: 0,
        matched: 0,
        unmatched: 0,
        results: [],
        error: error.message,
      };
    }
    return result as SyncCatastroResult;
  });
