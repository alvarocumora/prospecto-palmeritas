// Integración de pagos con MercadoPago (Checkout Pro).
//
// Flujo:
//  1. createCheckoutPreference → crea orden pending + preferencia MP, devuelve
//     init_point (URL de checkout de MercadoPago).
//  2. El usuario paga en MercadoPago.
//  3. MP notifica al webhook /api/webhooks/mercadopago → verifica el pago y
//     activa la suscripción (ver la ruta del webhook).
//
// Gated en MP_ACCESS_TOKEN: sin token, isPaymentEnabled=false y la UI cae al
// flujo concierge (requestPlanUpgrade). Configura el token en los secretos del
// servidor para habilitar el cobro real.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MP_API = "https://api.mercadopago.com";

function mpToken(): string | null {
  return process.env.MP_ACCESS_TOKEN ?? null;
}

function siteUrl(): string {
  return (
    process.env.PUBLIC_SITE_URL ??
    process.env.VITE_PUBLIC_SITE_URL ??
    "https://geocapitals.com"
  ).replace(/\/$/, "");
}

/** Tipo de cambio USD→CLP con fallback conservador (MP Chile cobra en CLP). */
async function usdToClp(): Promise<number> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(4000),
    });
    const j = (await res.json()) as { rates?: Record<string, number> };
    const clp = j.rates?.CLP;
    if (typeof clp === "number" && clp > 0) return clp;
  } catch {
    /* fallback */
  }
  return 950;
}

/** ¿Está habilitado el pago real? (para que la UI elija checkout vs concierge). */
export const getPaymentConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ provider: "mercadopago" | null; enabled: boolean }> => {
    return { provider: mpToken() ? "mercadopago" : null, enabled: !!mpToken() };
  },
);

export const createCheckoutPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planCode: z.enum(["pro", "enterprise"]),
        billing: z.enum(["monthly", "yearly"]).default("monthly"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ initPoint: string }> => {
    const token = mpToken();
    if (!token) throw new Error("PAYMENTS_DISABLED");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: plan } = await supabaseAdmin
      .from("billing_plans")
      .select("code, name, price_usd_monthly, price_usd_yearly")
      .eq("code", data.planCode)
      .maybeSingle();
    if (!plan) throw new Error("Plan no encontrado");

    const usd =
      data.billing === "yearly" ? Number(plan.price_usd_yearly) : Number(plan.price_usd_monthly);
    if (usd <= 0) throw new Error("Este plan no requiere pago.");
    const rate = await usdToClp();
    const clp = Math.round(usd * rate);

    // Orden pending: external_reference para conciliar con el webhook.
    // payment_orders aún no está en los types generados → cliente sin tipar.
    const sbUntyped = supabaseAdmin as unknown as SupabaseClient;
    const { data: order, error: orderErr } = await sbUntyped
      .from("payment_orders")
      .insert({
        user_id: context.userId,
        plan_code: data.planCode,
        billing: data.billing,
        amount_clp: clp,
        amount_usd: usd,
        status: "pending",
        provider: "mercadopago",
      })
      .select("id")
      .single();
    if (orderErr) throw new Error(orderErr.message);

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("user_id", context.userId)
      .maybeSingle();

    const base = siteUrl();
    const preference = {
      items: [
        {
          id: `${plan.code}-${data.billing}`,
          title: `Geocapitals ${plan.name} · ${data.billing === "yearly" ? "Anual" : "Mensual"}`,
          quantity: 1,
          currency_id: "CLP",
          unit_price: clp,
        },
      ],
      payer: prof?.email ? { email: prof.email } : undefined,
      external_reference: order.id,
      back_urls: {
        success: `${base}/catastro/precios?payment=success`,
        failure: `${base}/catastro/precios?payment=failure`,
        pending: `${base}/catastro/precios?payment=pending`,
      },
      auto_return: "approved",
      notification_url: `${base}/api/webhooks/mercadopago`,
      statement_descriptor: "GEOCAPITALS",
    };

    const res = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preference),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error("[mercadopago] preference failed", res.status, txt);
      throw new Error("No pudimos iniciar el pago. Intenta nuevamente.");
    }
    const pref = (await res.json()) as { id?: string; init_point?: string };
    if (!pref.init_point) throw new Error("MercadoPago no devolvió el checkout.");

    if (pref.id) {
      await sbUntyped.from("payment_orders").update({ preference_id: pref.id }).eq("id", order.id);
    }

    return { initPoint: pref.init_point };
  });
