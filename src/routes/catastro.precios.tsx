import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PublicCatastroShell } from "@/features/catastro-public/PublicCatastroShell";
import { useAuth } from "@/hooks/useAuth";
import { getPublicPlans, getMySubscription, requestPlanUpgrade } from "@/lib/plans.functions";

export const Route = createFileRoute("/catastro/precios")({
  head: () => ({
    meta: [
      { title: "Planes y precios · Catastro Geocapitals" },
      {
        name: "description",
        content:
          "Planes Free, Pro y Enterprise para acceder al catastro minero de Chile. Monitoreo, alertas, traslapes y reportes profesionales.",
      },
      { property: "og:title", content: "Planes y precios · Catastro Geocapitals" },
      {
        property: "og:description",
        content: "Desde gratis. Funciones pro para operadores mineros y consultores.",
      },
      { rel: "canonical", href: "/catastro/precios" },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [requesting, setRequesting] = useState<string | null>(null);

  const plansFn = useServerFn(getPublicPlans);
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => plansFn(),
    staleTime: 5 * 60_000,
  });

  const subFn = useServerFn(getMySubscription);
  const { data: sub } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => subFn(),
    staleTime: 60_000,
    enabled: !!user,
  });
  const currentPlan = sub?.plan ?? "free";

  const requestFn = useServerFn(requestPlanUpgrade);

  const onCta = async (code: string) => {
    if (code === "free") {
      navigate({ to: user ? "/catastro/mapa" : "/auth" });
      return;
    }
    if (!user) {
      navigate({ to: "/auth", search: { intent: "investor" } as never });
      return;
    }
    setRequesting(code);
    try {
      await requestFn({ data: { planCode: code as "pro" | "enterprise", billing } });
      toast.success("Solicitud enviada. El equipo te contactará para activar tu plan.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar la solicitud");
    } finally {
      setRequesting(null);
    }
  };

  return (
    <PublicCatastroShell>
      <section className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Planes diseñados para profesionales mineros.
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto mb-8">
            Empieza gratis. Escala cuando necesites monitoreo, AOI o reportes profesionales.
          </p>
          {/* Toggle mensual / anual */}
          <div className="inline-flex items-center rounded-md border border-border overflow-hidden">
            {(["monthly", "yearly"] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBilling(b)}
                className={`px-4 py-1.5 text-xs font-mono transition-colors ${
                  billing === b
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {b === "monthly" ? "Mensual" : "Anual · 2 meses gratis"}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        {isLoading ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-md border border-border p-6 h-96 animate-pulse bg-muted/20"
              />
            ))}
          </div>
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid sm:grid-cols-3 gap-4">
            {plans.map((p) => {
              const highlight = p.code === "pro";
              const isCurrent = currentPlan === p.code;
              const price = billing === "yearly" ? p.priceYearly : p.priceMonthly;
              const cadence =
                p.code === "free"
                  ? "por siempre"
                  : billing === "yearly"
                    ? "USD / año"
                    : "USD / mes";
              return (
                <div
                  key={p.code}
                  className={`rounded-md border p-6 flex flex-col ${
                    highlight
                      ? "border-primary bg-primary/5 shadow-lg"
                      : "border-border bg-background"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2 h-4">
                    {highlight && (
                      <span className="text-[10px] font-mono uppercase tracking-wider text-primary inline-flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Más popular
                      </span>
                    )}
                    {isCurrent && (
                      <span className="text-[10px] font-mono uppercase tracking-wider text-teal ml-auto">
                        Tu plan actual
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-sm uppercase tracking-wider text-muted-foreground mb-1">
                    {p.name}
                  </div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-4xl font-bold">US$ {price.toLocaleString("en-US")}</span>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground mb-3">{cadence}</div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground mb-4">{p.description}</p>
                  )}
                  <ul className="space-y-2 mb-6 flex-1">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs font-mono">
                        <Check className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                        <span className="text-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    disabled={isCurrent || requesting === p.code}
                    onClick={() => void onCta(p.code)}
                    className={`block w-full text-center px-4 py-2.5 rounded-md font-mono text-sm font-medium transition-colors disabled:opacity-50 ${
                      highlight
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border border-border hover:border-primary"
                    }`}
                  >
                    {requesting === p.code ? (
                      <Loader2 className="w-4 h-4 animate-spin inline" />
                    ) : isCurrent ? (
                      "Plan activo"
                    ) : p.code === "free" ? (
                      "Empezar gratis"
                    ) : user ? (
                      "Solicitar activación"
                    ) : (
                      "Crear cuenta"
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 text-center text-[10px] font-mono text-muted-foreground">
          Precios en USD. Activación asistida por el equipo tras confirmar el pago (transferencia o
          tarjeta).{" "}
          <Link to="/contacto" className="text-primary hover:underline">
            ¿Dudas? Habla con nosotros
          </Link>
        </div>
      </section>
    </PublicCatastroShell>
  );
}
