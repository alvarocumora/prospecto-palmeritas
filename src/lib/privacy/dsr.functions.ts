import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CreateSchema = z.object({
  kind: z.enum(["access", "rectification", "cancellation", "opposition", "portability"]),
  details: z.string().trim().max(2000).optional(),
});

export const createDsr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string })?.email ?? "";
    const { data: row, error } = await context.supabase
      .from("data_subject_requests")
      .insert({
        user_id: context.userId,
        email,
        kind: data.kind,
        details: data.details ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listMyDsr = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("data_subject_requests")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Exportación de datos personales (derecho de acceso + portabilidad)
export const exportMyData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;
    const sb = context.supabase;
    const tables = [
      "profiles",
      "suppliers",
      "supplier_offers",
      "rfqs",
      "rfq_applications",
      "privacy_consents",
      "data_subject_requests",
      "document_signatures",
      "document_sign_requests",
    ] as const;

    const result: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      user_id: uid,
      email: (context.claims as { email?: string })?.email ?? null,
    };

    for (const t of tables) {
      const cols = t === "suppliers" ? "*" : "*";
      const filterCol = t === "privacy_consents" ? "email" : t === "profiles" ? "id" : "user_id";
      const filterVal = t === "privacy_consents"
        ? ((context.claims as { email?: string })?.email ?? "__none__")
        : uid;
      try {
        const { data } = await sb.from(t).select(cols).eq(filterCol, filterVal);
        result[t] = data ?? [];
      } catch {
        result[t] = [];
      }
    }
    return result;
  });
