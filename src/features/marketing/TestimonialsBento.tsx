import { Quote, TrendingUp, Users, Landmark } from "lucide-react";
import { Eyebrow } from "@/components/brand";
import { Reveal } from "./Reveal";
import { AnimatedCounter } from "./AnimatedCounter";

const QUOTES = [
  {
    who: "María Fernanda Rojas",
    role: "Directora de Inversiones · Andes Capital",
    initials: "MR",
    text:
      "Geocapitals nos redujo el ciclo de due diligence de 12 semanas a 18 días. La trazabilidad del catastro y el data room cifrado cambian la conversación con el comité.",
  },
  {
    who: "Carlos Uriona",
    role: "Qualified Person · NI 43-101 Perú",
    initials: "CU",
    text:
      "Los borradores automáticos con audit-trail me permiten firmar reportes técnicos con confianza total en la fuente. Es lo que faltaba en la industria.",
  },
];

export function TestimonialsBento() {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className="max-w-7xl mx-auto px-5 py-20">
        <Reveal className="max-w-2xl mb-12">
          <Eyebrow className="mb-3">Voces del ecosistema</Eyebrow>
          <h2 className="brand-display text-3xl md:text-4xl text-content leading-tight">
            La confianza institucional se construye con datos y trazabilidad
          </h2>
        </Reveal>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Testimonio grande 1 */}
          <Reveal className="lg:col-span-2">
            <article className="h-full rounded-2xl border border-hairline bg-white p-8 lg:p-10 relative">
              <Quote className="w-8 h-8 text-accent-brand/25 absolute top-6 right-6" />
              <p className="brand-display text-xl lg:text-2xl text-content leading-snug max-w-2xl">
                &ldquo;{QUOTES[0].text}&rdquo;
              </p>
              <div className="mt-8 flex items-center gap-3">
                <span className="grid place-items-center w-11 h-11 rounded-full bg-accent-brand text-white text-sm font-mono">
                  {QUOTES[0].initials}
                </span>
                <div>
                  <div className="text-sm font-semibold text-content">{QUOTES[0].who}</div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-content-subtle">
                    {QUOTES[0].role}
                  </div>
                </div>
              </div>
            </article>
          </Reveal>

          {/* Caso destacado */}
          <Reveal delay={80}>
            <article className="h-full rounded-2xl bg-surface-inverse text-white p-8 relative overflow-hidden">
              <div
                className="absolute inset-0 opacity-[0.08] pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 30% 20%, var(--accent-brand) 0, transparent 45%)",
                }}
              />
              <div className="relative">
                <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent-brand-subtle">
                  Caso · Junior chilena
                </div>
                <div className="mt-6 font-mono text-4xl lg:text-5xl text-white tracking-tight">
                  USD <AnimatedCounter value={4.2} format="compact" />M
                </div>
                <div className="text-xs text-white/60 mt-1 font-mono">levantados en 90 días</div>
                <p className="mt-6 text-sm text-white/70 leading-relaxed">
                  Publicó su data room con NI 43-101 asistido y conectó con 14 inversionistas
                  calificados en la primera semana.
                </p>
              </div>
            </article>
          </Reveal>

          {/* Stat 1 */}
          <Reveal delay={120}>
            <article className="h-full rounded-2xl border border-hairline bg-white p-6">
              <TrendingUp className="w-5 h-5 text-accent-brand" />
              <div className="mt-6 font-mono text-3xl text-content">
                <AnimatedCounter value={73} suffix="%" />
              </div>
              <div className="text-xs text-content-subtle mt-1">
                Reducción media del ciclo de due diligence
              </div>
            </article>
          </Reveal>

          {/* Stat 2 */}
          <Reveal delay={160}>
            <article className="h-full rounded-2xl border border-hairline bg-white p-6">
              <Users className="w-5 h-5 text-accent-brand" />
              <div className="mt-6 font-mono text-3xl text-content">
                <AnimatedCounter value={312} />
              </div>
              <div className="text-xs text-content-subtle mt-1">
                Inversionistas calificados en la red
              </div>
            </article>
          </Reveal>

          {/* Testimonio pequeño */}
          <Reveal delay={200}>
            <article className="h-full rounded-2xl border border-hairline bg-white p-6 flex flex-col">
              <Landmark className="w-5 h-5 text-accent-brand" />
              <p className="mt-4 text-sm text-content leading-relaxed flex-1">
                &ldquo;{QUOTES[1].text}&rdquo;
              </p>
              <div className="mt-4 pt-4 border-t border-hairline">
                <div className="text-xs font-semibold text-content">{QUOTES[1].who}</div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mt-0.5">
                  {QUOTES[1].role}
                </div>
              </div>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
