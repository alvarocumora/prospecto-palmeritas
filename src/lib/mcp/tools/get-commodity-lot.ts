import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export default defineTool({
  name: "get_commodity_lot",
  title: "Get commodity lot detail",
  description:
    "Get full details of a single published commodity lot on the Geocapitals marketplace, including certifications.",
  inputSchema: {
    id: z.string().uuid().describe("Lot UUID (from search_commodity_lots)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }) => {
    const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: lot, error } = await supabase
      .from("commodity_lots")
      .select("*")
      .eq("id", id)
      .eq("status", "published")
      .eq("is_verified", true)
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
    if (!lot) {
      return { content: [{ type: "text", text: "Lot not found or not published." }], isError: true };
    }
    const { data: joins } = await supabase
      .from("commodity_lot_certifications")
      .select(
        "certificate_number,issued_at,expires_at,verification_url,commodity_certifications(code,name,issuer,category)",
      )
      .eq("lot_id", id);
    return {
      content: [{ type: "text", text: JSON.stringify({ lot, certifications: joins ?? [] }, null, 2) }],
      structuredContent: { lot, certifications: joins ?? [] },
    };
  },
});
