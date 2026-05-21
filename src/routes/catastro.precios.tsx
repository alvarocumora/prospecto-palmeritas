import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicCatastroShell } from "@/features/catastro-public/PublicCatastroShell";
import { Check, X } from "lucide-react";

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

type Plan = {
  name: string;
  price: string;
  cadence: string;
  highlight?: boolean;
  cta: string;
  features: Array<{ ok: boolean; text: string }>;
};

const PLANS: Plan[] = [
  {
    name: "Free",
    price: "$0",
    cadence: "por siempre",
    cta: "Empezar gratis",
    features: [
      { ok: true, text: "Mapa nacional SERNAGEOMIN" },
      { ok: true, text: "Búsqueda ilimitada" },
      { ok: true, text: "Ficha pública por concesión" },
      { ok: true, text: "Watchlist hasta 3 concesiones" },
      { ok: false, text: "Alertas por email" },
      { ok: false, text: "AOI y traslapes" },
      { ok: false, text: "Exportes PDF / GeoJSON" },
    ],
  },
  {
    name: "Pro",
    price: "$49",
    cadence: "USD / mes",
    highlight: true,
    cta: "Activar Pro",
    features: [
      { ok: true, text: "Todo lo de Free" },
      { ok: true, text: "Watchlist hasta 50 concesiones" },
      { ok: true, text: "Alertas email y push" },
      { ok: true, text: "AOI ilimitadas con análisis de traslapes" },
      { ok: true, text: "20 exportes PDF / GeoJSON al mes" },
      { ok: true, text: "Sin marca de agua" },
      { ok: false, text: "API y multi-usuario" },
    ],
  },
  {
    name: "Enterprise",
    price: "$299",
    cadence: "USD / mes",
    cta: "Contactar ventas",
    features: [
      { ok: true, text: "Todo lo de Pro" },
      { ok: true, text: "Watchlist ilimitado" },
      { ok: true, text: "Exportes Shapefile y API" },
      { ok: true, text: "Multi-usuario y roles" },
      { ok: true, text: "Reportes due-diligence batch" },
      { ok: true, text: "Soporte prioritario" },
      { ok: true, text: "SLA y onboarding" },
    ],
  },
];

function PricingPage() {
  return (
    <PublicCatastroShell>
      <section className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Planes diseñados para profesionales mineros.
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Empieza gratis. Escala cuando necesites monitoreo, AOI o reportes profesionales.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid sm:grid-cols-3 gap-4">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`rounded-md border p-6 flex flex-col ${
                p.highlight
                  ? "border-primary bg-primary/5 shadow-lg"
                  : "border-border bg-background"
              }`}
            >
              {p.highlight && (
                <div className="text-[10px] font-mono uppercase tracking-wider text-primary mb-2">
                  Más popular
                </div>
              )}
              <div className="font-mono text-sm uppercase tracking-wider text-muted-foreground mb-1">
                {p.name}
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-bold">{p.price}</span>
              </div>
              <div className="text-xs font-mono text-muted-foreground mb-6">{p.cadence}</div>
              <ul className="space-y-2 mb-6 flex-1">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs font-mono">
                    {f.ok ? (
                      <Check className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-muted-foreground/40 mt-0.5 shrink-0" />
                    )}
                    <span className={f.ok ? "text-foreground" : "text-muted-foreground/60"}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                to="/auth"
                className={`block text-center px-4 py-2.5 rounded-md font-mono text-sm font-medium transition-colors ${
                  p.highlight
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border border-border hover:border-primary"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 text-center text-[10px] font-mono text-muted-foreground">
          Precios referenciales en USD. Suscripción mensual cancelable. Facturación próximamente.
        </div>
      </section>
    </PublicCatastroShell>
  );
}
