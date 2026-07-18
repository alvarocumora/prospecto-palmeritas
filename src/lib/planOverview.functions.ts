import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getMySubscription } from "@/lib/plans.functions";
import { normalizePlanId } from "@/lib/plans.meta";
import { buildCapabilitySnapshot, type SaaSCapabilitySnapshot } from "@/lib/features/capabilities";
import type { UsageSnapshot } from "@/types/usage";

// Overview del plan del usuario para la vista in-app "Plan y uso": combina la
// suscripción real (getMySubscription → billing) con el modelo puro de flags y
// límites, y un snapshot de uso medido donde ya lo tenemos (proyectos).

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

export type PlanOverview = {
  plan: SaaSCapabilitySnapshot["plan"];
  status: string;
  periodEnd: string | null;
  snapshot: SaaSCapabilitySnapshot;
  usage: UsageSnapshot;
};

export const getMyPlanOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlanOverview> => {
    // Plan real desde la suscripción (concierge); normalizado al modelo puro.
    const sub = await getMySubscription();
    const plan = normalizePlanId(sub.plan);

    // Uso medido: proyectos donde el usuario es miembro. El resto de recursos
    // aún no se contabiliza (no infla el consumo): quedan en 0 mostrando límite.
    const usage: UsageSnapshot = {};
    try {
      const { count } = await asSb(context.supabase)
        .from("projects")
        .select("id, project_members!inner(user_id)", { count: "exact", head: true })
        .eq("project_members.user_id", context.userId as string);
      usage.projects_per_org = count ?? 0;
    } catch {
      /* best-effort */
    }

    return {
      plan,
      status: sub.status,
      periodEnd: sub.periodEnd,
      snapshot: buildCapabilitySnapshot({ plan, usage }),
      usage,
    };
  });
