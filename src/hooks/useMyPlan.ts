import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyPlanOverview } from "@/lib/planOverview.functions";
import type { SaaSCapabilityContext } from "@/lib/features/capabilities";
import type { PlanId } from "@/types/featureFlags";

/**
 * Plan y capacidades del usuario, para gating con <FeatureGate> y la vista de
 * Plan y uso. Mientras carga, asume "free" (lo más restrictivo, sin filtrar).
 */
export function useMyPlan() {
  const fn = useServerFn(getMyPlanOverview);
  const query = useQuery({
    queryKey: ["my-plan-overview"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
  });
  const plan: PlanId = query.data?.plan ?? "free";
  const capabilityContext: SaaSCapabilityContext = {
    plan,
    usage: query.data?.usage,
  };
  return { plan, capabilityContext, overview: query.data, isLoading: query.isLoading };
}
