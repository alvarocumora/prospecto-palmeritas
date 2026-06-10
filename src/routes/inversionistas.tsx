import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ShieldCheck, Database, LineChart, Lock, ArrowRight } from "lucide-react";
import { MarketingPage } from "@/features/marketing/MarketingShell";
import { ContactForm } from "@/features/marketing/ContactForm";

export const Route = createFileRoute("/inversionistas")({
  head: () => ({
    meta: [
      { title: "Inversionistas — Geocapitals" },
      { name: "description", content: "Acceso institucional a proyectos mineros verificados, due diligence acelerado y data rooms cifrados." },
      { property: "og:title", content: "Inversionistas — Geocapitals" },
      { property: "og:description", content: "Diversifica con exposición a minería bajo estándares NI 43-101." },
    ],
  }),
  component: InvPage,
});

const BENEFITS = [
  { i: CheckCircle2, t: "Proyectos calificados", d: "Activos verificados por QPs y data trazable end-to-end." },
  { i: LineChart, t: "Modelo económico", d: "Sensibilidad de precios, NPV, IRR y escenarios listos para comité." },
  { i: Database, t: "Data room cifrado", d: "Permisos granulares, audit-trail por documento y firmas electrónicas." },
  { i: ShieldCheck, t: "KYC / AML", d: "Onboarding institucional con verificación de origen de fondos." },
];

function InvPage() {
  return (
    <MarketingPage
      eyebrow="Inversionistas"
      title="Capital institucional para minería moderna"
      intro="Accede a un universo curado de proyectos mineros, con due diligence acelerado y trazabilidad NI 43-101 sobre una capa de datos georreferenciada."
    >
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-12">
        <div>
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

          <div className="mt-10 rounded-xl border border-[var(--brand-hair)] bg-[var(--brand-blue-soft)] p-6">
            <p className="brand-eyebrow mb-2">Tickets institucionales</p>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { v: "USD 250K+", l: "Equity en juniors" },
                { v: "USD 1M+", l: "Royalties / streams" },
                { v: "USD 5M+", l: "Pre-feasibility / feasibility" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="font-mono text-2xl text-[var(--brand-navy-deep)]">{s.v}</div>
                  <div className="text-[11px] uppercase tracking-wider text-[var(--brand-mute)] mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link to="/terminal" className="inline-flex items-center gap-2 bg-[var(--brand-blue)] text-white px-5 py-3 rounded-md text-sm font-medium">
              Ver el terminal <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/auth" className="inline-flex items-center gap-2 border border-[var(--brand-navy)] text-[var(--brand-navy)] px-5 py-3 rounded-md text-sm font-medium hover:bg-[var(--brand-blue-soft)]">
              Solicitar acceso
            </Link>
            <span className="inline-flex items-center gap-2 text-[11px] font-mono text-[var(--brand-mute)]">
              <Lock className="w-3.5 h-3.5" /> Cifrado AES-256
            </span>
          </div>
        </div>

        <aside>
          <p className="brand-eyebrow mb-3">Solicita acceso institucional</p>
          <ContactForm source="inversionistas" compact />
        </aside>
      </div>
    </MarketingPage>
  );
}
