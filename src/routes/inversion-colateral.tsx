import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, CalendarClock, Landmark, Repeat, ShieldCheck } from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/features/marketing/MarketingShell";
import { ContactForm } from "@/features/marketing/ContactForm";
import { CollateralSimulator } from "@/features/investor/CollateralSimulator";
import {
  COLLATERAL_DISCLAIMERS,
  COLLATERAL_PROJECTS,
  COLLATERAL_STEPS,
  fmtClp,
} from "@/lib/investor/collateralProgram";
import coverImg from "@/assets/colateral/cover-maule.jpg";
import hualanePlan from "@/assets/colateral/hualane-og.png";
import velValle from "@/assets/colateral/vel-valle.jpg";

export const Route = createFileRoute("/inversion-colateral")({
  head: () => ({
    meta: [
      { title: "Inversión minera con parcela en garantía · Geocapitals" },
      {
        name: "description",
        content:
          "Invierte desde $25 MM a UF + 12 % anual con interés mensual, respaldado por una parcela en el Maule.",
      },
      { property: "og:title", content: "Inversión minera con parcela en garantía · Geocapitals" },
      {
        property: "og:description",
        content: "UF + 12 % anual, pago mensual y parcela en Hualañé o Licantén como garantía.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicCollateralPage,
});

const HIGHLIGHTS = [
  { icon: Landmark, label: "Inversión mínima", value: "$25 MM" },
  { icon: CalendarClock, label: "Tasa, pago mensual", value: "UF + 12 %" },
  { icon: ShieldCheck, label: "Garantía", value: "5.000 m² a 1 ha" },
  { icon: Repeat, label: "Renovación", value: "Cada 12 meses" },
];

function PublicCollateralPage() {
  const [sim, setSim] = useState({ amount: 25_000_000, months: 12 });
  const msg = `Me interesa el programa con colateral. Monto estimado: ${fmtClp(sim.amount)} a ${sim.months} meses. Quisiera recibir el deck y agendar una reunión.`;

  return (
    <div className="brand-light min-h-screen">
      <MarketingHeader />
      <div data-theme="im-light" className="bg-surface text-content">
        <section className="relative overflow-hidden border-b border-hairline">
          <img
            src={coverImg}
            alt="Valle rural de la Región del Maule (imagen ilustrativa)"
            className="absolute inset-0 w-full h-full object-cover opacity-25"
          />
          <div className="relative max-w-6xl mx-auto px-5 py-16 md:py-24">
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent-brand">
              Programa de inversión con colateral inmobiliario
            </p>
            <h1 className="mt-4 font-serif text-4xl md:text-6xl leading-[1.05] max-w-3xl">
              Invierte en minería chilena, respaldado por una parcela real.
            </h1>
            <p className="mt-5 max-w-2xl text-content-subtle text-lg">
              Tu capital financia el portafolio minero Geocapitals. Recibes UF + 12 % anual con
              pago mensual y una parcela con rol individual en el Maule queda en garantía.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#simulador"
                className="inline-flex items-center gap-2 h-12 px-7 bg-content text-surface text-[11px] font-semibold uppercase tracking-[0.2em] rounded-sm hover:bg-accent-brand transition-colors"
              >
                Simular mi inversión <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#contacto"
                className="inline-flex items-center gap-2 h-12 px-7 border border-content/30 text-[11px] font-semibold uppercase tracking-[0.2em] rounded-sm hover:border-accent-brand hover:text-accent-brand transition-colors"
              >
                Pedir el deck
              </a>
            </div>
            <p className="mt-6 text-[10px] font-mono text-content-subtle">
              Imagen ilustrativa de ambientación
            </p>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-5">
          <section className="grid grid-cols-2 md:grid-cols-4 gap-px bg-hairline border border-hairline -mt-px">
            {HIGHLIGHTS.map((h) => (
              <div key={h.label} className="bg-surface p-5">
                <h.icon className="w-4 h-4 text-accent-brand" />
                <div className="mt-3 font-mono text-2xl">{h.value}</div>
                <div className="text-xs text-content-subtle mt-1">{h.label}</div>
              </div>
            ))}
          </section>

          <section className="mt-16">
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent-brand">
              Cartera de garantía
            </p>
            <h2 className="font-serif text-3xl mt-2">2 proyectos · 116 parcelas · 85,75 ha</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {COLLATERAL_PROJECTS.map((p) => (
                <article key={p.key} className="border border-hairline overflow-hidden bg-surface">
                  <img
                    src={p.key === "hualane" ? hualanePlan : velValle}
                    alt={p.name}
                    loading="lazy"
                    className="w-full h-60 object-cover"
                  />
                  <div className="p-5">
                    <h3 className="font-serif text-xl">{p.name}</h3>
                    <p className="text-xs text-content-subtle mt-1">
                      {p.commune} · {p.region}
                    </p>
                    <dl className="mt-4 grid grid-cols-3 gap-px bg-hairline border border-hairline text-center">
                      <div className="bg-surface p-3">
                        <dt className="text-[10px] text-content-subtle">Superficie</dt>
                        <dd className="font-mono">{p.areaHa.toLocaleString("es-CL")} ha</dd>
                      </div>
                      <div className="bg-surface p-3">
                        <dt className="text-[10px] text-content-subtle">Parcelas</dt>
                        <dd className="font-mono">{p.lots}</dd>
                      </div>
                      <div className="bg-surface p-3">
                        <dt className="text-[10px] text-content-subtle">Tamaño</dt>
                        <dd className="font-mono text-xs">{p.lotSize}</dd>
                      </div>
                    </dl>
                    <p className="text-xs mt-3">
                      <span className="text-content-subtle">Precio lista:</span> {p.priceRange}
                    </p>
                    <p className="text-xs mt-1">
                      <span className="text-content-subtle">Registro:</span> {p.registry}
                    </p>
                  </div>
                </article>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-content-subtle">
              Precios de lista publicados, no tasaciones. Rol individual y tasación de cada parcela
              se fijan en el contrato. Fotos de Valle Escondido: imagen referencial del proyecto.
            </p>
          </section>

          <section id="simulador" className="mt-16 grid gap-6 md:grid-cols-[1.1fr_1fr] scroll-mt-20">
            <CollateralSimulator onChange={(amount, months) => setSim({ amount, months })} />
            <div className="border border-hairline p-6 bg-surface">
              <h3 className="font-serif text-2xl">Cómo funciona</h3>
              <ol className="mt-4 space-y-3">
                {COLLATERAL_STEPS.map((s) => (
                  <li key={s.title} className="border-l-2 border-accent-brand pl-3">
                    <div className="text-sm font-medium">{s.title}</div>
                    <p className="text-xs text-content-subtle mt-0.5">{s.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section id="contacto" className="mt-16 grid gap-8 md:grid-cols-[1fr_1.2fr] scroll-mt-20">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent-brand">
                Siguiente paso
              </p>
              <h2 className="font-serif text-3xl mt-2">Recibe el deck y agenda una reunión</h2>
              <p className="mt-3 text-content-subtle">
                Te enviamos el deck completo, revisamos tu perfil y te mostramos las parcelas
                disponibles. El mensaje ya incluye el monto que simulaste.
              </p>
              <Link
                to="/auth"
                search={{ intent: "investor", mode: "signup" } as never}
                className="mt-5 inline-flex items-center gap-2 text-sm text-accent-brand"
              >
                O crea tu cuenta de inversionista <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <ContactForm
              source="inversion-colateral"
              defaultRole="investor"
              defaultMessage={msg}
            />
          </section>

          <footer className="mt-16 mb-12 border-t border-hairline pt-4 text-[11px] leading-relaxed text-content-subtle space-y-1">
            {COLLATERAL_DISCLAIMERS.map((d) => (
              <p key={d}>{d}</p>
            ))}
          </footer>
        </div>
      </div>
      <MarketingFooter />
    </div>
  );
}
