import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export default defineTool({
  name: "list_investment_opportunities",
  title: "List investment opportunities",
  description:
    "List published mining project listings open to investors on Geocapitals (deal flow across Chile, Peru, Brazil, Colombia, etc.).",
  inputSchema: {
    country: z.string().optional().describe("Filter by country name."),
    commodity: z.string().optional().describe("Filter by primary commodity."),
    stage: z.string().optional().describe("Project stage (greenfield, brownfield, production…)."),
    limit: z.number().int().min(1).max(50).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input) => {
    const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    let q = supabase
      .from("property_listings")
      .select(
        "id,title,code,commodity,country,region,area_ha,stage,modality,asking_price_usd,royalty_pct,summary,is_featured,views_count,created_at",
      )
      .eq("is_published", true)
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(input.limit ?? 25);
    if (input.country) q = q.eq("country", input.country);
    if (input.commodity) q = q.eq("commodity", input.commodity);
    if (input.stage) q = q.eq("stage", input.stage as never);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { count: (data ?? []).length, listings: data ?? [] },
    };
  },
});
