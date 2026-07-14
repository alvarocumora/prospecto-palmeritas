import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FileText,
  BookOpen,
  Compass,
  Database,
  Coins,
  Users,
  ShieldCheck,
  Layers,
  Sparkles,
  Zap,
  ArrowRight,
  Landmark,
  Gem,
  LineChart,
  Lock,
  Cpu,
} from "lucide-react";
import { MarketingPage } from "@/features/marketing/MarketingShell";
import { InvestableProjects } from "@/features/marketing/InvestableProjects";
import { BrandButton, Eyebrow, SectionHeading } from "@/components/brand";

export const Route = createFileRoute("/recursos")({
  head: () => ({
    meta: [
      { title: "Recursos e inversión — Geocapitals" },
      {
        name: "description",
        content:
          "Proyectos mineros abiertos a inversión, crowdfunding institucional, tokenización futura y guías para operar la plataforma Geocapitals.",
      },
      { property: "og:title", content: "Recursos e inversión — Geocapitals" },
      {
        property: "og:description",
        content:
          "Deal-flow verificado, modelos de participación tipo crowdfunding y roadmap de tokenización de proyectos y commodities.",
      },
    ],
  }),
  component: RecursosPage,
});

/* ————————————————————————————————————————————————
   Tiers de participación estilo crowdfunding
——————————————————————————————————————————————— */
const TIERS = [
  {
    tag: "Observer",
    amount: "USD 0",
    subtitle: "Acceso público",
    perks: [
      "Fichas técnicas resumidas",
      "Mapa satelital y catastro",
      "Alertas por proyecto",
    ],
    cta: { to: "/auth", label: "Crear cuenta" },
    highlight: false,
  },
  {
    tag: "Retail QI",
    amount: "USD 5K – 50K",
    subtitle: "Crowdfunding calificado",
    perks: [
      "Ticket fraccionable por unidades",
      "Data room con audit-trail",
      "Reporte trimestral de avance",
    ],
    cta: { to: "/inversionistas", label: "Explorar proyectos" },
    highlight: true,
  },
  {
    tag: "Institucional",
    amount: "USD 250K+",
    subtitle: "Equity · Royalty · Stream",
    perks: [
      "Modelo económico y sensibilidades",
      "Firma electrónica NDA + Term-sheet",
      "Kick-off directo con QP y operador",
    ],
    cta: { to: "/contacto", label: "Contactar deal team" },
    highlight: false,
  },
];

/* ————————————————————————————————————————————————
   Roadmap de tokenización
——————————————————————————————————————————————— */
const TOKEN_ROADMAP = [
  {
    phase: "Fase 01",
    status: "Live",
    title: "Cap-table digital",
    desc: "Registro de unidades por inversionista, KYC/AML y reporting periódico dentro de la plataforma.",
    icon: Users,
  },
  {
    phase: "Fase 02",
    status: "Beta",
    title: "Suscripción fraccionada",
    desc: "Compromisos parciales sobre un target de levantamiento con validación de mínimos y disponibilidad.",
    icon: Coins,
  },
  {
    phase: "Fase 03",
    status: "Q3 2026",
    title: "Tokenización de proyecto",
    desc: "Emisión de tokens de participación respaldados por vehículos SPV con custodia regulada.",
    icon: Gem,
  },
  {
    phase: "Fase 04",
    status: "2027",
    title: "Commodities tokenizados",
    desc: "Lotes certificados de cobre, oro y críticos con trazabilidad on-chain y settlement institucional.",
    icon: Layers,
  },
];

/* ————————————————————————————————————————————————
   Guías de uso de la plataforma
——————————————————————————————————————————————— */
const GUIDES = [
  {
    i: FileText,
    t: "NI 43-101 explicado",
    d: "Estructura del reporte técnico, gaps frecuentes y cómo Geocapitals los cubre.",
    to: "/contacto",
  },
  {
    i: Compass,
    t: "Catastro Chile en 10 min",
    d: "Cómo leer concesiones, boletín minero, vencimientos y superposiciones.",
    to: "/catastro",
  },
  {
    i: Database,
    t: "Capas satelitales",
    d: "Sentinel-2, MPC, índices HYD/IOX/CLY/STR/NDVI y su interpretación.",
    to: "/contacto",
  },
  {
    i: BookOpen,
    t: "Demo en vivo",
    d: "Recorrido guiado por el terminal: catastro, 3D, deals y data room.",
    to: "/contacto",
  },
  {
    i: Cpu,
    t: "Motor 3D geológico",
    d: "Bloques, drillholes, secciones y prospectividad IA a escala de proyecto.",
    to: "/contacto",
  },
  {
    i: LineChart,
    t: "Modelo económico",
    d: "NPV, IRR, sensibilidad de precios y escenarios listos para comité.",
    to: "/contacto",
  },
];

const GOLD = "oklch(0.78 0.14 82)"; // acento dorado institucional

function RecursosPage() {
  return (
    <MarketingPage
      eyebrow="Recursos · Inversión · Roadmap"
      title="Todo lo que necesitas para invertir, operar y escalar en minería"
      intro="Proyectos abiertos, modelos de participación tipo crowdfunding institucional, tokenización en roadmap y guías prácticas para usar la plataforma."
    >
      {/* ═══════════════ 1 · PROYECTOS ═══════════════ */}
      <section className="-mt-14 lg:-mt-20">
        <InvestableProjects />
      </section>

      {/* ═══════════════ 2 · CROWDFUNDING ═══════════════ */}
      <section className="py-16 border-t border-hairline">
        <SectionHeading
          eyebrow="Modelos de participación"
          title="Crowdfunding institucional por proyecto"
          description="Compromete capital por unidades fraccionables o entra como institucional con ticket completo. La plataforma gestiona KYC, cap-table y reporting."
          className="mb-10"
        />

        <div className="grid md:grid-cols-3 gap-5">
          {TIERS.map((tier) => (
            <div
              key={tier.tag}
              className={`relative rounded-2xl border p-6 flex flex-col transition ${
                tier.highlight
                  ? "border-accent-brand bg-white shadow-[0_30px_60px_-40px_rgba(43,74,203,0.45)]"
                  : "border-hairline bg-white hover:border-accent-brand/60"
              }`}
            >
              {tier.highlight && (
                <span
                  className="absolute -top-3 left-6 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.16em] text-black"
                  style={{ background: GOLD, boxShadow: `0 6px 18px -6px ${GOLD}` }}
                >
                  <Sparkles className="w-3 h-3" /> Más popular
                </span>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-content-subtle">
                  {tier.tag}
                </span>
                <span
                  className="text-[10px] font-mono uppercase tracking-wider"
                  style={{ color: GOLD }}
                >
                  {tier.subtitle}
                </span>
              </div>
              <div className="brand-display text-3xl text-content mt-3">{tier.amount}</div>
              <ul className="mt-5 space-y-2.5 flex-1">
                {tier.perks.map((p) => (
                  <li key={p} className="flex gap-2 text-sm text-content/80">
                    <span
                      className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: tier.highlight ? GOLD : "var(--accent-brand)" }}
                    />
                    {p}
                  </li>
                ))}
              </ul>
              <BrandButton
                asChild
                variant={tier.highlight ? "primary" : "outline"}
                className="mt-6 w-full justify-center"
              >
                <Link to={tier.cta.to}>
                  {tier.cta.label} <ArrowRight className="w-4 h-4" />
                </Link>
              </BrandButton>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-mono text-content-subtle">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: GOLD }} /> KYC / AML institucional
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Cifrado AES-256
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1.5">
            <Landmark className="w-3.5 h-3.5" /> Vehículos SPV supervisados
          </span>
        </div>
      </section>

      {/* ═══════════════ 3 · TOKENIZACIÓN ═══════════════ */}
      <section className="py-16 border-t border-hairline">
        <div
          className="relative overflow-hidden rounded-3xl border p-8 lg:p-12"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.18 0.04 260) 0%, oklch(0.12 0.03 260) 60%, oklch(0.08 0.02 260) 100%)",
            borderColor: "oklch(0.28 0.05 260)",
          }}
        >
          {/* Grid sutil de fondo */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "linear-gradient(oklch(0.78 0.14 82) 1px, transparent 1px), linear-gradient(90deg, oklch(0.78 0.14 82) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.2em]"
                style={{
                  background: "oklch(0.78 0.14 82 / 0.14)",
                  color: GOLD,
                  border: `1px solid oklch(0.78 0.14 82 / 0.35)`,
                }}
              >
                <Zap className="w-3 h-3" /> Roadmap disruptivo
              </span>
            </div>
            <h2
              className="brand-display text-3xl lg:text-4xl leading-tight max-w-3xl"
              style={{ color: "oklch(0.96 0.01 260)" }}
            >
              De la concesión al{" "}
              <span style={{ color: GOLD }}>token institucional</span>
            </h2>
            <p
              className="mt-3 max-w-2xl text-sm lg:text-base"
              style={{ color: "oklch(0.78 0.02 260)" }}
            >
              Estamos construyendo el puente entre exploración minera y capital fraccionado
              on-chain: mismo estándar NI 43-101, mismo custodio, liquidez programable.
            </p>

            <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {TOKEN_ROADMAP.map(({ phase, status, title, desc, icon: Icon }, idx) => {
                const isLive = status === "Live" || status === "Beta";
                return (
                  <div
                    key={phase}
                    className="relative rounded-xl p-5 flex flex-col"
                    style={{
                      background: "oklch(1 0 0 / 0.03)",
                      border: `1px solid ${isLive ? "oklch(0.78 0.14 82 / 0.35)" : "oklch(1 0 0 / 0.08)"}`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span
                        className="text-[10px] font-mono uppercase tracking-[0.2em]"
                        style={{ color: "oklch(0.6 0.02 260)" }}
                      >
                        {phase}
                      </span>
                      <span
                        className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                          background: isLive
                            ? "oklch(0.78 0.14 82 / 0.15)"
                            : "oklch(1 0 0 / 0.05)",
                          color: isLive ? GOLD : "oklch(0.7 0.02 260)",
                        }}
                      >
                        {status}
                      </span>
                    </div>
                    <Icon
                      className="w-6 h-6 mb-3"
                      style={{ color: isLive ? GOLD : "oklch(0.7 0.02 260)" }}
                      strokeWidth={1.5}
                    />
                    <div
                      className="font-display text-base leading-tight mb-2"
                      style={{ color: "oklch(0.96 0.01 260)" }}
                    >
                      {title}
                    </div>
                    <p
                      className="text-[12px] leading-relaxed"
                      style={{ color: "oklch(0.72 0.02 260)" }}
                    >
                      {desc}
                    </p>
                    {idx < TOKEN_ROADMAP.length - 1 && (
                      <div
                        aria-hidden
                        className="hidden lg:block absolute top-1/2 -right-2 w-4 h-px"
                        style={{ background: "oklch(0.78 0.14 82 / 0.4)" }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <BrandButton asChild>
                <Link to="/contacto">
                  Solicitar acceso al programa piloto <ArrowRight className="w-4 h-4" />
                </Link>
              </BrandButton>
              <span
                className="text-[11px] font-mono"
                style={{ color: "oklch(0.7 0.02 260)" }}
              >
                Cupos limitados para Q3 2026
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ 4 · GUÍAS ═══════════════ */}
      <section className="py-16 border-t border-hairline">
        <SectionHeading
          eyebrow="Usa la plataforma"
          title="Guías, documentación y demos"
          description="Material práctico para entender cómo Geocapitals levanta capital, evalúa proyectos y cumple estándares globales."
          className="mb-10"
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {GUIDES.map(({ i: Icon, t, d, to }) => (
            <Link
              key={t}
              to={to}
              className="group relative rounded-2xl border border-hairline bg-white p-6 hover:border-accent-brand hover:shadow-[0_20px_40px_-30px_rgba(43,74,203,0.35)] transition-all flex gap-4"
            >
              <span className="grid place-items-center w-12 h-12 rounded-lg bg-accent-brand-subtle text-accent-brand shrink-0 group-hover:scale-105 transition-transform">
                <Icon className="w-6 h-6" strokeWidth={1.5} />
              </span>
              <div className="flex-1">
                <div className="font-display text-lg text-content group-hover:text-accent-brand transition-colors">
                  {t}
                </div>
                <p className="text-sm text-content-subtle mt-1.5 leading-relaxed">{d}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-accent-brand opacity-0 group-hover:opacity-100 transition-opacity">
                  Abrir <ArrowRight className="w-3 h-3" />
                </span>
              </div>
              {/* barra dorada superior sutil al hover */}
              <span
                className="absolute inset-x-6 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: GOLD }}
              />
            </Link>
          ))}
        </div>
      </section>

      {/* ═══════════════ 5 · CTA final ═══════════════ */}
      <section className="mt-8">
        <div
          className="relative rounded-3xl border border-hairline bg-accent-brand-subtle p-8 lg:p-12 text-center overflow-hidden"
        >
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }}
          />
          <Eyebrow className="mb-3">¿Buscas algo específico?</Eyebrow>
          <h3 className="brand-display text-2xl lg:text-3xl text-content">
            Whitepapers, onepagers y term-sheets bajo NDA
          </h3>
          <p className="text-content-subtle mt-3 max-w-xl mx-auto">
            Preparamos material personalizado por jurisdicción, commodity o etapa para tu comité de
            inversión.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <BrandButton asChild>
              <Link to="/contacto">Solicitar documento</Link>
            </BrandButton>
            <BrandButton asChild variant="outline">
              <Link to="/inversionistas">Ver deal-flow completo</Link>
            </BrandButton>
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
