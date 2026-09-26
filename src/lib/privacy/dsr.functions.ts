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
    const sb = context.supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, val: string) => Promise<{ data: unknown[] | null }>;
        };
      };
    };
    const email = (context.claims as { email?: string })?.email ?? null;

    const specs: Array<{ table: string; col: string; val: string }> = [
      { table: "profiles", col: "id", val: uid },
      { table: "suppliers", col: "user_id", val: uid },
      { table: "supplier_offers", col: "user_id", val: uid },
      { table: "rfqs", col: "user_id", val: uid },
      { table: "rfq_applications", col: "user_id", val: uid },
      { table: "data_subject_requests", col: "user_id", val: uid },
      { table: "privacy_consents", col: "email", val: email ?? "__none__" },
    ];

    const result: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      user_id: uid,
      email,
    };
    for (const s of specs) {
      try {
        const { data } = await sb.from(s.table).select("*").eq(s.col, s.val);
        result[s.table] = data ?? [];
      } catch {
        result[s.table] = [];
      }
    }
    return { json: JSON.stringify(result) };
  });
