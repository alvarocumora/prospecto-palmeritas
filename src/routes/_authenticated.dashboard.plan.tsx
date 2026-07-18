import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Crown, Check, X, Gauge, ArrowUpRight, Sparkles } from "lucide-react";
import { getMyPlanOverview } from "@/lib/planOverview.functions";
import { requestPlanUpgrade } from "@/lib/plans.functions";
import {
  PLAN_META,
  FEATURE_LABELS,
  LIMIT_LABELS,
  formatLimitValue,
  nextPlanUp,
} from "@/lib/plans.meta";
import { CORE_GEOCAPITAL_FEATURES } from "@/lib/features/capabilities";

export const Route = createFileRoute("/_authenticated/dashboard/plan")({
  head: () => ({ meta: [{ title: "Plan y uso — Geocapitals" }] }),
  component: PlanPage,
});

function PlanPage() {
  const fn = useServerFn(getMyPlanOverview);
  const upgradeFn = useServerFn(requestPlanUpgrade);
  const { data, isLoading } = useQuery({
    queryKey: ["my-plan-overview"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
  });
  const [requesting, setRequesting] = useState(false);

  const plan = data?.plan ?? "free";
  const meta = PLAN_META[plan];
  const upgrade = nextPlanUp(plan);

  const onUpgrade = async () => {
    if (!upgrade || (upgrade !== "pro" && upgrade !== "enterprise")) return;
    setRequesting(true);
    try {
      await upgradeFn({ data: { planCode: upgrade, billing: "monthly" } });
      toast.success("Solicitud enviada. El equipo te contactará para activar el plan.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar la solicitud.");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1100px]">
      <div className="flex items-center gap-2">
        <Crown className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-semibold">Plan y uso</h1>
      </div>

      {/* Plan actual */}
      <section className="rounded-md border border-border bg-bg-secondary/20 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Tu plan
            </div>
            <div className="text-2xl font-bold mt-0.5">{meta.name}</div>
            <div className="text-sm text-text-secondary">{meta.tagline}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {meta.priceMonthlyUsd === null
                ? "Precio a medida"
                : meta.priceMonthlyUsd === 0
                  ? "Gratis"
                  : `US$ ${meta.priceMonthlyUsd}/mes`}
              {data?.status && data.status !== "active" ? ` · ${data.status}` : ""}
              {data?.periodEnd
                ? ` · renueva ${new Date(data.periodEnd).toLocaleDateString("es-CL")}`
                : ""}
            </div>
          </div>
          {upgrade && (
            <button
              onClick={() => void onUpgrade()}
              disabled={requesting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {requesting ? "Enviando…" : `Subir a ${PLAN_META[upgrade].name}`}
              <ArrowUpRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {/* Funcionalidades del plan */}
        <section className="rounded-md border border-border bg-bg-secondary/20 p-5">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Funcionalidades
          </div>
          {isLoading ? (
            <div className="h-40 rounded bg-muted/20 animate-pulse" />
          ) : (
            <ul className="space-y-2">
              {CORE_GEOCAPITAL_FEATURES.map((f) => {
                const on = data?.snapshot.featureDecisions[f]?.enabled ?? false;
                const info = FEATURE_LABELS[f];
                return (
                  <li key={f} className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 grid place-items-center w-4 h-4 rounded-full shrink-0 ${
                        on ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {on ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    </span>
                    <div>
                      <div className={`text-sm ${on ? "font-medium" : "text-muted-foreground"}`}>
                        {info.label}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{info.desc}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Uso vs límites */}
        <section className="rounded-md border border-border bg-bg-secondary/20 p-5">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
            <Gauge className="w-3.5 h-3.5" /> Uso y límites del plan
          </div>
          {isLoading ? (
            <div className="h-40 rounded bg-muted/20 animate-pulse" />
          ) : (
            <div className="space-y-3">
              {(data?.snapshot.usageDecisions ?? []).map((u) => {
                const info = LIMIT_LABELS[u.key];
                const pct = u.limit > 0 ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;
                const near = pct >= 80;
                return (
                  <div key={u.key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span>{info.label}</span>
                      <span className="font-mono text-muted-foreground">
                        {u.used.toLocaleString("es-CL")} / {formatLimitValue(u.limit, u.key)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full ${near ? "bg-amber-500" : "bg-primary"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <p className="text-[10px] text-muted-foreground pt-1">
                El consumo de proyectos se mide en vivo; los demás recursos se contabilizarán a
                medida que se instrumenten.
              </p>
            </div>
          )}
        </section>
      </div>

      <div className="text-xs text-text-secondary">
        ¿Necesitas más capacidad o un plan a medida? Usa el botón «Subir a…» de arriba o escríbenos
        desde{" "}
        <Link to="/contacto" className="text-primary underline">
          Contacto
        </Link>
        .
      </div>
    </div>
  );
}
