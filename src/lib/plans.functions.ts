// Planes y suscripciones: fuente de verdad única = tabla billing_plans.
//
// No hay pasarela de pago integrada (requiere credenciales Stripe/Transbank).
// El modelo es concierge: el usuario solicita un plan → lead al equipo →
// staff activa la suscripción manualmente tras el cobro. Esto es lo correcto
// para la fase pre-revenue; conectar Stripe después solo agrega el checkout.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BillingPlan = {
  code: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  maxProjects: number | null;
  maxMembers: number | null;
  maxStorageGb: number | null;
  features: string[];
  isDefault: boolean;
  displayOrder: number;
};

function toFeatures(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  return [];
}

/** Planes activos, ordenados. Público (RLS permite lectura de is_active). */
export const getPublicPlans = createServerFn({ method: "GET" }).handler(
  async (): Promise<BillingPlan[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("billing_plans")
      .select(
        "code,name,description,price_usd_monthly,price_usd_yearly,max_projects,max_members,max_storage_gb,features,is_default,display_order",
      )
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    if (error) {
      console.error("[getPublicPlans]", error);
      return [];
    }
    return (data ?? []).map((p) => ({
      code: p.code,
      name: p.name,
      description: p.description,
      priceMonthly: Number(p.price_usd_monthly),
      priceYearly: Number(p.price_usd_yearly),
      maxProjects: p.max_projects,
      maxMembers: p.max_members,
      maxStorageGb: p.max_storage_gb,
      features: toFeatures(p.features),
      isDefault: !!p.is_default,
      displayOrder: p.display_order,
    }));
  },
);

/** Suscripción actual del usuario (o free por defecto). */
export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<{ plan: string; status: string; periodEnd: string | null }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin
        .from("subscriptions")
        .select("plan, status, current_period_end")
        .eq("user_id", context.userId)
        .maybeSingle();
      return {
        plan: data?.plan ?? "free",
        status: data?.status ?? "active",
        periodEnd: data?.current_period_end ?? null,
      };
    },
  );

/**
 * Solicitud de plan (gateway concierge): registra un lead y notifica al equipo.
 * Reemplaza los CTAs "Activar Pro/Contactar ventas" que antes iban a /auth.
 */
export const requestPlanUpgrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planCode: z.enum(["pro", "enterprise"]),
        billing: z.enum(["monthly", "yearly"]).default("monthly"),
        note: z.string().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("email, display_name, organization")
      .eq("user_id", context.userId)
      .maybeSingle();

    const { data: plan } = await supabaseAdmin
      .from("billing_plans")
      .select("name, price_usd_monthly, price_usd_yearly")
      .eq("code", data.planCode)
      .maybeSingle();

    const priceLabel = plan
      ? data.billing === "yearly"
        ? `US$ ${plan.price_usd_yearly}/año`
        : `US$ ${plan.price_usd_monthly}/mes`
      : "";

    // Lead en contact_messages (misma bandeja que ve el staff)
    const { error } = await supabaseAdmin.from("contact_messages").insert({
      name: prof?.display_name || prof?.email || "Usuario",
      email: prof?.email ?? "",
      organization: prof?.organization ?? null,
      role: "investor",
      source: `plan-request:${data.planCode}`,
      message: `Solicita plan ${plan?.name ?? data.planCode} (${priceLabel}, ${data.billing}). ${
        data.note ?? ""
      } — Activar desde /dashboard/admin (Marketplace/Pagos).`,
      status: "new",
    });
    if (error) throw new Error(error.message);

    // Aviso al equipo (best-effort)
    try {
      const { sendInternalEmail } = await import("@/lib/email/send-internal.server");
      await sendInternalEmail({
        templateName: "contact-message-internal",
        recipientEmail: "team@geocapitals.com",
        idempotencyKey: `plan-request:${context.userId}:${data.planCode}:${data.billing}`,
        templateData: {
          name: prof?.display_name ?? prof?.email ?? "Usuario",
          email: prof?.email ?? "",
          role: "investor",
          source: `plan-request:${data.planCode}`,
          message: `Solicita ${plan?.name ?? data.planCode} (${priceLabel}).`,
        },
      });
    } catch (e) {
      console.error("[requestPlanUpgrade] notify failed", e);
    }

    return { ok: true as const };
  });
