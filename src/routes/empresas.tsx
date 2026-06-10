import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { MarketingPage } from "@/features/marketing/MarketingShell";

export const Route = createFileRoute("/empresas")({
  head: () => ({
    meta: [
      { title: "Empresas — Geocapitals" },
      { name: "description", content: "Planes institucionales para holdings mineros, juniors y consultoras. Catastro, geología 3D, satélite y NI 43-101." },
      { property: "og:title", content: "Empresas — Geocapitals" },
      { property: "og:description", content: "Despliega Geocapitals en tu equipo geocientífico y de capital markets." },
    ],
  }),
  component: EmpresasPage,
});

const PLANS = [
  {
    name: "Explorer",
    price: "Desde USD 1.490 / mes",
    tag: "Para juniors y consultoras",
    items: [
      "Hasta 5 proyectos activos",
      "Catastro Chile completo",
      "Monitoreo satelital mensual",
      "10 usuarios incluidos",
    ],
    cta: "Solicitar demo",
  },
  {
    name: "Operator",
    price: "Desde USD 4.900 / mes",
    tag: "Para holdings activos",
    items: [
      "Proyectos ilimitados",
      "Geología 3D + estimación recursos",
      "Satélite multi-índice quincenal",
      "Data room cifrado · audit-trail",
      "50 usuarios incluidos",
    ],
    cta: "Hablar con ventas",
    highlight: true,
  },
  {
    name: "Institutional",
    price: "Pricing a medida",
    tag: "Para multinacionales y fondos",
    items: [
      "SLA dedicado · soporte 24/7",
      "Despliegue privado / on-prem",
      "Integraciones ERP / GIS empresariales",
      "Compliance SOC 2 · auditoría externa",
    ],
    cta: "Contactar comercial",
  },
];

function EmpresasPage() {
  return (
    <MarketingPage
      eyebrow="Empresas"
      title="Geocapitals para tu equipo geocientífico y de capital"
      intro="Una plataforma multi-tenant que se adapta desde una junior con 5 concesiones hasta un holding con cientos de activos en múltiples jurisdicciones."
    >
      <div className="grid md:grid-cols-3 gap-5">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={`rounded-2xl border p-6 flex flex-col ${
              p.highlight
                ? "bg-[var(--brand-navy-deep)] text-white border-[var(--brand-navy-deep)]"
                : "bg-white border-[var(--brand-hair)]"
            }`}
          >
            <div className={`text-[10px] font-mono uppercase tracking-wider mb-3 ${
              p.highlight ? "text-[var(--brand-gold)]" : "text-[var(--brand-blue)]"
            }`}>
              {p.tag}
            </div>
            <div className={`font-display text-2xl ${p.highlight ? "text-white" : "text-[var(--brand-navy-deep)]"}`}>
              {p.name}
            </div>
            <div className={`mt-1 text-sm ${p.highlight ? "text-white/70" : "text-[var(--brand-mute)]"}`}>
              {p.price}
            </div>
            <ul className="mt-6 space-y-2.5 flex-1">
              {p.items.map((it) => (
                <li key={it} className={`flex items-start gap-2 text-sm ${
                  p.highlight ? "text-white/85" : "text-[var(--brand-ink)]"
                }`}>
                  <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${
                    p.highlight ? "text-[var(--brand-gold)]" : "text-[var(--brand-blue)]"
                  }`} />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/contacto"
              className={`mt-6 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium ${
                p.highlight
                  ? "bg-[var(--brand-gold)] text-[var(--brand-navy-deep)]"
                  : "bg-[var(--brand-blue)] text-white"
              }`}
            >
              {p.cta} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-[var(--brand-mute)]">
        ¿Necesitas algo distinto? <Link to="/contacto" className="text-[var(--brand-blue)] font-medium">Conversemos.</Link>
      </p>
    </MarketingPage>
  );
}
