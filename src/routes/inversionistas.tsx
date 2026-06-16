import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ShieldCheck, Database, LineChart, Lock, ArrowRight } from "lucide-react";
import { z } from "zod";
import { MarketingPage } from "@/features/marketing/MarketingShell";
import { ContactForm } from "@/features/marketing/ContactForm";
import { DealFlow } from "@/features/marketing/DealFlow";
import { BrandButton, Eyebrow } from "@/components/brand";

const searchSchema = z.object({
  listing: z.string().uuid().optional(),
});

export const Route = createFileRoute("/inversionistas")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Inversionistas — Geocapitals" },
      {
        name: "description",
        content:
          "Deal-flow minero verificado: oportunidades activas, due diligence acelerado y data rooms cifrados.",
      },
      { property: "og:title", content: "Inversionistas — Geocapitals" },
      {
        property: "og:description",
        content: "Acceso institucional a proyectos mineros con trazabilidad NI 43-101.",
      },
    ],
  }),
  component: InvPage,
});

const BENEFITS = [
  {
    i: CheckCircle2,
    t: "Proyectos calificados",
    d: "Activos verificados por QPs y data trazable end-to-end.",
  },
  {
    i: LineChart,
    t: "Modelo económico",
    d: "Sensibilidad de precios, NPV, IRR y escenarios listos para comité.",
  },
  {
    i: Database,
    t: "Data room cifrado",
    d: "Permisos granulares, audit-trail por documento y firmas electrónicas.",
  },
  {
    i: ShieldCheck,
    t: "KYC / AML",
    d: "Onboarding institucional con verificación de origen de fondos.",
  },
];

function InvPage() {
  const { listing } = Route.useSearch();
  return (
    <MarketingPage
      eyebrow="Inversionistas"
      title="Deal-flow minero verificado, en una sola pantalla"
      intro="Accede a oportunidades activas en venta, joint venture y royalty con due diligence acelerado y trazabilidad NI 43-101 sobre una capa de datos georreferenciada."
    >
      {/* Deal flow ARRIBA — el corazón de la página */}
      <div className="mb-16">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
          <div>
            <Eyebrow className="mb-2">Oportunidades activas</Eyebrow>
            <h2 className="brand-display text-2xl text-[var(--brand-navy-deep)]">
              Proyectos publicados
            </h2>
          </div>
          <Link
            to="/contacto"
            className="text-sm text-[var(--brand-blue)] inline-flex items-center gap-1.5 hover:gap-2 transition-all font-medium"
          >
            Solicitar acceso institucional <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <DealFlow initialListingId={listing} />
      </div>

      {/* Beneficios + ContactForm side-by-side */}
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-12 pt-10 border-t border-[var(--brand-hair)]">
        <div>
          <Eyebrow className="mb-3">Por qué Geocapitals</Eyebrow>
          <h2 className="brand-display text-2xl text-[var(--brand-navy-deep)] mb-6">
            Capital institucional para minería moderna
          </h2>
          <ul className="grid sm:grid-cols-2 gap-5">
            {BENEFITS.map(({ i: Icon, t, d }) => (
              <li key={t} className="rounded-xl border border-[var(--brand-hair)] bg-white p-5">
                <span className="grid place-items-center w-11 h-11 rounded-lg bg-[var(--brand-blue-soft)] text-[var(--brand-blue)] mb-4">
                  <Icon className="w-5 h-5" strokeWidth={1.75} />
                </span>
                <div className="font-display text-lg text-[var(--brand-navy-deep)]">{t}</div>
                <p className="text-sm text-[var(--brand-mute)] mt-2 leading-relaxed">{d}</p>
              </li>
            ))}
          </ul>

          <div className="mt-8 rounded-xl border border-[var(--brand-hair)] bg-[var(--brand-blue-soft)] p-6">
            <Eyebrow className="mb-3">Tickets institucionales</Eyebrow>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { v: "USD 250K+", l: "Equity en juniors" },
                { v: "USD 1M+", l: "Royalties / streams" },
                { v: "USD 5M+", l: "Pre-feasibility / feasibility" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="font-mono text-2xl text-[var(--brand-navy-deep)]">{s.v}</div>
                  <div className="text-[11px] uppercase tracking-wider text-[var(--brand-mute)] mt-1">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <BrandButton asChild>
              <Link to="/terminal">
                Explorar terminal en vivo <ArrowRight className="w-4 h-4" />
              </Link>
            </BrandButton>
            <span className="inline-flex items-center gap-2 text-[11px] font-mono text-[var(--brand-mute)]">
              <Lock className="w-3.5 h-3.5" /> Cifrado AES-256 · KYC / AML
            </span>
          </div>
        </div>

        <aside>
          <Eyebrow className="mb-3">Solicita acceso institucional</Eyebrow>
          <ContactForm source="inversionistas" compact />
        </aside>
      </div>
    </MarketingPage>
  );
}
