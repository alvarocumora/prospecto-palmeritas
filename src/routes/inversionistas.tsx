import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  ShieldCheck,
  Database,
  LineChart,
  Lock,
  ArrowRight,
  Search,
  Calculator,
  FileSignature,
  Wallet,
} from "lucide-react";
import { z } from "zod";
import { MarketingPage } from "@/features/marketing/MarketingShell";
import { ContactForm } from "@/features/marketing/ContactForm";
import { DealFlow } from "@/features/marketing/DealFlow";
import { BrandButton, Eyebrow } from "@/components/brand";
import { FICHAS, fmtUsd0 } from "@/lib/investor/fichas";

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
    d: "Evidencias, fuentes y estado de revisión técnica por activo.",
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
      {/* Cómo invertir — el flujo en 4 pasos, sin ambigüedad */}
      <div className="mb-16">
        <Eyebrow className="mb-2">Cómo invertir</Eyebrow>
        <h2 className="brand-display text-2xl text-content mb-6">
          Un solo camino, de la ficha al cierre
        </h2>
        <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              i: Search,
              n: "1",
              t: "Explora la ficha",
              d: "Estado, valorización referencial y ticket de entrada de cada proyecto.",
            },
            {
              i: Calculator,
              n: "2",
              t: "Simula tu inversión",
              d: "Participación, ROI y TIR por escenario, con supuestos a la vista.",
            },
            {
              i: FileSignature,
              n: "3",
              t: "Firma el NDA",
              d: "Firma electrónica en minutos y acceso al data room completo.",
            },
            {
              i: Wallet,
              n: "4",
              t: "Invierte y sigue tu posición",
              d: "Cierre acompañado por el equipo y seguimiento en el dashboard.",
            },
          ].map(({ i: Icon, n, t, d }) => (
            <li key={n} className="rounded-xl border border-hairline bg-white p-5 relative">
              <span className="absolute top-4 right-5 font-mono text-3xl text-accent-brand-subtle select-none">
                {n}
              </span>
              <span className="grid place-items-center w-10 h-10 rounded-lg bg-accent-brand-subtle text-accent-brand mb-3">
                <Icon className="w-5 h-5" strokeWidth={1.75} />
              </span>
              <div className="font-display text-[15px] text-content">{t}</div>
              <p className="text-[13px] text-content-subtle mt-1.5 leading-relaxed">{d}</p>
            </li>
          ))}
        </ol>
      </div>

      <Link
        to="/inversion-colateral"
        className="mb-16 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-accent-brand bg-accent-brand-subtle p-6 hover:shadow-md transition"
      >
        <div>
          <Eyebrow className="mb-1">Nuevo · Inversión con colateral</Eyebrow>
          <div className="brand-display text-xl text-content">
            UF + 12 % anual con pago mensual y una parcela en garantía en el Maule.
          </div>
        </div>
        <span className="text-sm text-accent-brand inline-flex items-center gap-1.5 font-medium">
          Simular mi inversión <ArrowRight className="w-4 h-4" />
        </span>
      </Link>

      {/* Fichas de inversión de los proyectos showcase (fuente única: fichas.ts) */}
      <div className="mb-16">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
          <div>
            <Eyebrow className="mb-2">Empieza aquí</Eyebrow>
            <h2 className="brand-display text-2xl text-content">Fichas de inversión</h2>
          </div>
          <Link
            to="/proyectos"
            className="text-sm text-accent-brand inline-flex items-center gap-1.5 hover:gap-2 transition-all font-medium"
          >
            Ver catálogo de activos <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.values(FICHAS).map((f) => (
            <Link
              key={f.slug}
              to="/proyectos/ficha/$slug"
              params={{ slug: f.slug }}
              className="group rounded-xl border border-hairline bg-white p-5 hover:border-accent-brand hover:shadow-[0_16px_36px_-24px_rgba(11,42,91,0.35)] transition block"
            >
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider">
                <span className="text-accent-brand">{f.code}</span>
                <span className="text-content-subtle">{f.commodity}</span>
              </div>
              <div className="mt-2 font-display text-lg text-content leading-snug group-hover:text-accent-brand transition-colors">
                {f.name}
              </div>
              <div className="text-[11px] text-content-subtle mt-0.5">{f.stage}</div>
              <dl className="mt-4 pt-3 border-t border-hairline space-y-1.5 text-[12px]">
                <div className="flex items-center justify-between">
                  <dt className="text-content-subtle">Ticket desde</dt>
                  <dd className="font-mono text-content">{fmtUsd0(f.minTicketUsd)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-content-subtle">Ronda</dt>
                  <dd className="font-mono text-content">{fmtUsd0(f.roundSizeUsd)}</dd>
                </div>
              </dl>
              <div className="mt-3 text-[11px] font-mono uppercase tracking-wider text-accent-brand inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                Ficha + simulador <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Deal flow — oportunidades publicadas (datos reales) */}
      <div className="mb-16">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
          <div>
            <Eyebrow className="mb-2">Oportunidades activas</Eyebrow>
            <h2 className="brand-display text-2xl text-content">Proyectos publicados</h2>
          </div>
          <Link
            to="/auth"
            search={{ intent: "investor" } as never}
            className="text-sm text-accent-brand inline-flex items-center gap-1.5 hover:gap-2 transition-all font-medium"
          >
            Solicitar acceso institucional <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <DealFlow initialListingId={listing} />
      </div>

      {/* Beneficios + ContactForm side-by-side */}
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-12 pt-10 border-t border-hairline">
        <div>
          <Eyebrow className="mb-3">Por qué Geocapitals</Eyebrow>
          <h2 className="brand-display text-2xl text-content mb-6">
            Capital institucional para minería moderna
          </h2>
          <ul className="grid sm:grid-cols-2 gap-5">
            {BENEFITS.map(({ i: Icon, t, d }) => (
              <li key={t} className="rounded-xl border border-hairline bg-white p-5">
                <span className="grid place-items-center w-11 h-11 rounded-lg bg-accent-brand-subtle text-accent-brand mb-4">
                  <Icon className="w-5 h-5" strokeWidth={1.75} />
                </span>
                <div className="font-display text-lg text-content">{t}</div>
                <p className="text-sm text-content-subtle mt-2 leading-relaxed">{d}</p>
              </li>
            ))}
          </ul>

          <div className="mt-8 rounded-xl border border-hairline bg-accent-brand-subtle p-6">
            <Eyebrow className="mb-3">Tickets institucionales</Eyebrow>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { v: "USD 250K+", l: "Equity en juniors" },
                { v: "USD 1M+", l: "Royalties / streams" },
                { v: "USD 5M+", l: "Pre-feasibility / feasibility" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="font-mono text-2xl text-content">{s.v}</div>
                  <div className="text-[11px] uppercase tracking-wider text-content-subtle mt-1">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <BrandButton asChild>
              <Link to="/auth" search={{ intent: "investor" } as never}>
                Crear cuenta de inversionista <ArrowRight className="w-4 h-4" />
              </Link>
            </BrandButton>
            <span className="inline-flex items-center gap-2 text-[11px] font-mono text-content-subtle">
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
