import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function client() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "search_commodity_lots",
  title: "Search commodity lots",
  description:
    "Search verified, published commodity lots (cobre, oro, plata, litio, tierras raras, etc.) on the Geocapitals marketplace. Filter by commodity, country, form, incoterm, or certification.",
  inputSchema: {
    commodity: z.string().optional().describe("Commodity code (e.g. 'cu', 'au', 'ag', 'li')."),
    country: z.string().optional().describe("Country name (e.g. 'Chile', 'Peru')."),
    form: z.string().optional().describe("Form: concentrate, cathode, dore, ore, etc."),
    incoterm: z.string().optional().describe("Incoterm: FOB, CIF, CFR, DAP…"),
    certification: z.string().optional().describe("Certification code to require."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input) => {
    const supabase = client();
    let q = supabase
      .from("commodity_lots")
      .select(
        "id,title,slug,commodity,form,grade_pct,tonnage_available_t,country,region,port_of_loading,incoterm,asking_price_usd,currency,certifications_json,summary,is_verified,created_at",
      )
      .eq("status", "published")
      .eq("is_verified", true)
      .order("created_at", { ascending: false })
      .limit(input.limit ?? 20);
    if (input.commodity) q = q.eq("commodity", input.commodity as never);
    if (input.form) q = q.eq("form", input.form as never);
    if (input.country) q = q.eq("country", input.country);
    if (input.incoterm) q = q.eq("incoterm", input.incoterm as never);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
    let rows = data ?? [];
    if (input.certification) {
      rows = rows.filter((r) =>
        Array.isArray(r.certifications_json)
          ? (r.certifications_json as string[]).includes(input.certification!)
          : false,
      );
    }
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { count: rows.length, lots: rows },
    };
  },
});
