import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Webhook de MercadoPago: recibe notificaciones de pago, verifica el estado
// real contra la API de MP (no confía en el payload) y activa la suscripción.
//
// MP notifica con ?type=payment&data.id=<paymentId> (o topic=payment&id=...).
// Respondemos 200 rápido siempre que podamos procesar; MP reintenta ante error.
const MP_API = "https://api.mercadopago.com";

function admin() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function handle(request: Request): Promise<Response> {
  const token = process.env.MP_ACCESS_TOKEN;
  const sb = admin();
  if (!token || !sb) {
    // Sin config: aceptar para que MP no reintente infinito.
    return new Response("ok", { status: 200 });
  }

  // paymentId puede venir por query (?data.id / ?id) o en el body JSON.
  const url = new URL(request.url);
  let paymentId = url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? null;
  const topic = url.searchParams.get("type") ?? url.searchParams.get("topic");
  if (!paymentId) {
    try {
      const body = (await request.json()) as {
        data?: { id?: string };
        type?: string;
        action?: string;
      };
      paymentId = body?.data?.id ?? null;
    } catch {
      /* sin body */
    }
  }
  if (!paymentId || (topic && topic !== "payment")) {
    return new Response("ignored", { status: 200 });
  }

  try {
    // Verificar el pago real contra MP.
    const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return new Response("payment fetch failed", { status: 200 });
    const pay = (await res.json()) as {
      status?: string;
      external_reference?: string;
    };
    if (pay.status !== "approved" || !pay.external_reference) {
      return new Response("not approved", { status: 200 });
    }

    // Conciliar con la orden (idempotente: si ya está paid, no re-activar).
    const { data: order } = await sb
      .from("payment_orders")
      .select("id, user_id, plan_code, billing, status")
      .eq("id", pay.external_reference)
      .maybeSingle();
    if (!order || order.status === "paid") {
      return new Response("ok", { status: 200 });
    }

    const months = order.billing === "yearly" ? 12 : 1;
    const periodEnd = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString();

    // Activar suscripción + marcar orden pagada.
    await sb.from("subscriptions").upsert(
      {
        user_id: order.user_id,
        plan: order.plan_code,
        status: "active",
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    await sb
      .from("payment_orders")
      .update({ status: "paid", payment_id: String(paymentId), paid_at: new Date().toISOString() })
      .eq("id", order.id);

    // Aviso al usuario (best-effort).
    try {
      const { data: prof } = await sb
        .from("profiles")
        .select("email")
        .eq("user_id", order.user_id)
        .maybeSingle();
      if (prof?.email) {
        const { sendInternalEmail } = await import("@/lib/email/send-internal.server");
        await sendInternalEmail({
          templateName: "investor-approved",
          recipientEmail: prof.email,
          idempotencyKey: `plan-activated:${order.id}`,
          templateData: {
            fullName: "",
            reviewerName: "Pago confirmado",
            notes: `Plan ${order.plan_code} activado hasta ${new Date(periodEnd).toLocaleDateString("es-CL")}.`,
          },
        });
      }
    } catch (e) {
      console.error("[mp-webhook] notify failed", e);
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("[mp-webhook] error", e);
    // 200 igualmente: evitar tormenta de reintentos por un error transitorio
    // nuestro; MP reintenta ante 5xx, y ya somos idempotentes.
    return new Response("ok", { status: 200 });
  }
}

export const Route = createFileRoute("/api/webhooks/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      // MP a veces valida el endpoint con GET.
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
