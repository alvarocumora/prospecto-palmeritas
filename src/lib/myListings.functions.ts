// Listings del dueño de proyecto: crear borradores y ver su estado.
// La publicación es curada — solo staff puede poner is_published=true
// (setListingPublished en adminInbox.functions.ts).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateListingSchema = z.object({
  title: z.string().min(3).max(200),
  commodity: z.string().min(1).max(40),
  country: z.string().min(2).max(80),
  region: z.string().max(120).optional().nullable(),
  modality: z.enum(["sale", "jv", "royalty", "option"]),
  stage: z.enum([
    "greenfield",
    "brownfield",
    "scoping",
    "prefeasibility",
    "feasibility",
    "production",
  ]),
  area_ha: z.number().positive().max(10_000_000).optional().nullable(),
  asking_price_usd: z.number().positive().max(100_000_000_000).optional().nullable(),
  royalty_pct: z.number().positive().max(100).optional().nullable(),
  summary: z.string().max(4000).optional().nullable(),
});

export type CreateListingInput = z.infer<typeof CreateListingSchema>;

export type MyListingRow = {
  id: string;
  created_at: string;
  title: string;
  commodity: string;
  country: string;
  region: string | null;
  modality: string;
  stage: string;
  area_ha: number | null;
  asking_price_usd: number | null;
  royalty_pct: number | null;
  summary: string | null;
  is_published: boolean;
  views_count: number;
};

export const createPropertyListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateListingSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // owner_user_id viene del contexto de auth, nunca del cliente.
    const { data: row, error } = await supabaseAdmin
      .from("property_listings")
      .insert({
        owner_user_id: context.userId,
        title: data.title.trim(),
        commodity: data.commodity.trim(),
        country: data.country.trim(),
        region: data.region?.trim() || null,
        modality: data.modality,
        stage: data.stage,
        area_ha: data.area_ha ?? null,
        asking_price_usd: data.asking_price_usd ?? null,
        royalty_pct: data.royalty_pct ?? null,
        summary: data.summary?.trim() || null,
        is_published: false, // siempre borrador: la publicación es curada por staff
      })
      .select("id")
      .single();
    if (error) {
      console.error("[myListings] insert failed", error);
      throw new Error("No pudimos crear el listing. Intenta nuevamente.");
    }

    // Avisar al equipo que hay un listing nuevo esperando curaduría.
    try {
      const { sendInternalEmail } = await import("@/lib/email/send-internal.server");
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("user_id", context.userId)
        .maybeSingle();
      await sendInternalEmail({
        templateName: "contact-message-internal",
        recipientEmail: "team@geocapitals.com",
        idempotencyKey: `listing-created:${row.id}`,
        templateData: {
          name: prof?.email ?? "Dueño de proyecto",
          email: prof?.email ?? "",
          organization: undefined,
          role: "owner",
          source: `listing-draft:${row.id}`,
          message: `Nuevo listing en borrador esperando revisión: "${data.title}" (${data.commodity} · ${data.country}). Publicar desde /dashboard/admin/inbox.`,
        },
      });
    } catch (e) {
      console.error("[myListings] notify failed", e);
    }

    return { ok: true as const, id: row.id };
  });

export const listMyListings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("property_listings")
      .select(
        "id, created_at, title, commodity, country, region, modality, stage, area_ha, asking_price_usd, royalty_pct, summary, is_published, views_count",
      )
      .eq("owner_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      ...r,
      area_ha: r.area_ha != null ? Number(r.area_ha) : null,
      asking_price_usd: r.asking_price_usd != null ? Number(r.asking_price_usd) : null,
      royalty_pct: r.royalty_pct != null ? Number(r.royalty_pct) : null,
      is_published: !!r.is_published,
      views_count: r.views_count ?? 0,
    })) as MyListingRow[];
  });
