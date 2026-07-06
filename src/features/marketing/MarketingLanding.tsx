import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlatformStats } from "@/lib/platformStats.functions";
import { HeroLiveMap } from "@/features/marketing/HeroLiveMap";
import { FlagChip } from "@/features/marketing/FlagChip";

import { MarketingHeader, MarketingFooter } from "@/features/marketing/MarketingShell";
import { useLocale } from "@/features/marketing/i18n";
import { InvestableProjects } from "@/features/marketing/InvestableProjects";
import { InvestmentSimulator } from "@/features/marketing/InvestmentSimulator";
import { CommodityTicker } from "@/features/marketing/CommodityTicker";
import { PlatformPreview } from "@/features/marketing/PlatformPreview";
import { BrandButton, BrandCard, Eyebrow, SectionHeading, Stat } from "@/components/brand";
import { Reveal } from "@/features/marketing/Reveal";
import { AnimatedCounter } from "@/features/marketing/AnimatedCounter";
import { LogoMarquee } from "@/features/marketing/LogoMarquee";
import { TestimonialsBento } from "@/features/marketing/TestimonialsBento";
import { FaqAccordion } from "@/features/marketing/FaqAccordion";
import { HeroTopoBackground } from "@/features/marketing/HeroTopoBackground";
import heroMining from "@/assets/hero-mining.jpg";
import featureCatastro from "@/assets/feature-catastro.jpg";
import featureGeophysics from "@/assets/feature-geophysics.jpg";
import {
  Mountain,
  Users,
  Globe2,
  ShieldCheck,
  FilePlus2,
  LineChart,
  Lock,
  ArrowRight,
  CheckCircle2,
  Coins,
  Layers,
  Zap,
  Gem,
  FileText,
  Handshake,
  TrendingUp,
  Map,
  Database,
  Cpu,
  Satellite,
  Building2,
  Briefcase,
  Landmark,
  Activity,
} from "lucide-react";

const PROCESS_STEPS = [
  { icon: FilePlus2, label: "Publica" },
  { icon: Handshake, label: "Conecta" },
  { icon: TrendingUp, label: "Negocia" },
  { icon: ShieldCheck, label: "Cierra y crece" },
] as const;

export function MarketingLanding() {
  const { t } = useLocale();
  // Highlight secuencial del giro del proceso
  const [activeStep, setActiveStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActiveStep((s) => (s + 1) % PROCESS_STEPS.length), 3000);
    return () => clearInterval(t);
  }, []);

  const statsFn = useServerFn(getPlatformStats);
  const { data: live } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: () => statsFn(),
    staleTime: 60_000,
  });

  const liveStats = live
    ? [
        { v: live.projects.toString(), l: "Proyectos activos" },
        { v: live.concessionsManaged.toLocaleString(), l: "Concesiones gestionadas" },
        { v: live.cadastreNationalCount.toLocaleString(), l: "Concesiones en catastro" },
        { v: live.mineralDeposits.toLocaleString(), l: "Yacimientos indexados" },
        { v: live.explorationTargets.toString(), l: "Targets generados" },
        { v: live.satelliteAnomalies.toString(), l: "Anomalías satelitales" },
      ]
    : [
        { v: "+124", l: "Proyectos activos" },
        { v: "+312", l: "Inversionistas" },
        { v: "18", l: "Países" },
      ];

  return (
    <div className="brand-light min-h-screen">
      <MarketingHeader />

      {/* Hero — cinematic industrialism */}
      <section className="relative overflow-hidden bg-[#05070a] text-slate-200 border-b border-white/5">
        {/* Photographic base layer */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.28] sm:opacity-[0.32] lg:opacity-[0.35]"
          style={{ backgroundImage: `url(${heroMining})` }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(5,7,10,0.72) 0%, rgba(5,7,10,0.82) 55%, rgba(5,7,10,0.96) 100%)",
          }}
        />
        {/* Ambient glows */}
        <div
          className="pointer-events-none absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full blur-[120px]"
          style={{ background: "color-mix(in oklab, var(--accent-brand) 22%, transparent)" }}
        />
        <div
          className="pointer-events-none absolute top-1/2 -left-40 w-[380px] h-[380px] rounded-full blur-[100px]"
          style={{ background: "color-mix(in oklab, var(--gold) 12%, transparent)" }}
        />
        {/* Grid texture + topografía animada */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at 60% 40%, black 0%, transparent 70%)",
          }}
        />
        <HeroTopoBackground />

        <div className="relative max-w-7xl mx-auto px-5 py-14 sm:py-20 lg:py-28 grid lg:grid-cols-[1fr_1.1fr] gap-10 sm:gap-12 items-center">
          <div>
            {/* Live badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[10px] font-mono uppercase tracking-[0.28em] text-slate-300 mb-6 sm:mb-8 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ background: "var(--accent-brand)" }}
                />
                <span
                  className="relative inline-flex rounded-full h-2 w-2"
                  style={{ background: "var(--accent-brand)" }}
                />
              </span>
              <span>{t("hero_eyebrow")}</span>
            </div>

            <h1 className="brand-display text-[36px] sm:text-[56px] lg:text-[76px] leading-[0.98] sm:leading-[0.95] tracking-tight text-white break-words">
              {t("hero_title").split(" ").slice(0, 2).join(" ")}{" "}
              <span className="italic font-normal text-slate-400">
                {t("hero_title").split(" ").slice(2, 4).join(" ")}
              </span>{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, #ffffff 0%, #ffffff 40%, rgba(148,163,184,0.55) 100%)",
                }}
              >
                {t("hero_title").split(" ").slice(4).join(" ")}
              </span>
            </h1>

            <p className="mt-5 sm:mt-7 text-base sm:text-lg text-slate-400 max-w-xl font-light leading-relaxed">
              {t("hero_sub")}
            </p>

            <div className="mt-7 sm:mt-9 flex flex-wrap items-center gap-4 sm:gap-5">
              <Link
                to="/contacto"
                className="group inline-flex items-center gap-2 h-12 px-7 bg-white text-black text-[11px] font-semibold uppercase tracking-[0.22em] rounded-sm hover:bg-[color:var(--gold)] transition-colors duration-300"
              >
                {t("cta_publish")}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                to="/terminal"
                className="group flex items-center gap-3 text-[11px] font-semibold tracking-[0.22em] uppercase text-slate-300 hover:text-white transition-colors"
              >
                <span className="w-11 h-11 rounded-full border border-white/15 grid place-items-center group-hover:border-white group-hover:bg-white/5 transition-all">
                  <svg className="w-3.5 h-3.5 fill-current translate-x-[1px]" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                <span>{t("cta_explore")}</span>
              </Link>
            </div>

            {/* Trust strip */}
            <div className="mt-10 sm:mt-12 pt-6 border-t border-white/5 flex items-center gap-5 sm:gap-8 text-[11px] font-mono uppercase tracking-widest text-slate-500 flex-wrap">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" style={{ color: "var(--accent-brand)" }} /> KYC /
                AML
              </span>
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4" style={{ color: "var(--accent-brand)" }} /> NI 43-101
              </span>
              <span className="flex items-center gap-2">
                <Globe2 className="w-4 h-4" style={{ color: "var(--accent-brand)" }} /> 18 países
              </span>
            </div>

            {/* KPI live bar */}
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.06] border border-white/10 rounded-sm overflow-hidden">
              {[
                { v: live?.projects ?? 124, l: "Proyectos activos" },
                { v: live?.concessionsManaged ?? 47000, l: "Concesiones", compact: true },
                { v: live?.satelliteAnomalies ?? 312, l: "Anomalías detectadas" },
                { v: 18, l: "Países" },
              ].map((k, i) => (
                <div key={i} className="bg-[#05070a] px-4 py-4">
                  <div className="font-mono text-2xl text-white tracking-tight">
                    <AnimatedCounter value={k.v} format={k.compact ? "compact" : "int"} />
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500 mt-1">
                    {k.l}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live map wrapped in HUD frame */}
          <div className="relative">
            {/* Corner brackets */}
            <div className="pointer-events-none absolute -top-2 -left-2 w-8 h-8 border-t-2 border-l-2 border-white/40 z-20" />
            <div className="pointer-events-none absolute -top-2 -right-2 w-8 h-8 border-t-2 border-r-2 border-white/40 z-20" />
            <div className="pointer-events-none absolute -bottom-2 -left-2 w-8 h-8 border-b-2 border-l-2 border-white/40 z-20" />
            <div className="pointer-events-none absolute -bottom-2 -right-2 w-8 h-8 border-b-2 border-r-2 border-white/40 z-20" />

            {/* HUD label */}
            <div className="pointer-events-none absolute -top-6 left-0 z-20 font-mono text-[10px] uppercase tracking-[0.28em] text-slate-500 flex items-center gap-3">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "var(--gold)" }}
              />
              <span>SCANNING · LATAM_S14 · CONFIDENCE 98.4%</span>
            </div>
            <div className="pointer-events-none absolute -bottom-6 right-0 z-20 font-mono text-[10px] tracking-widest text-slate-600">
              -14.2350° S / 51.9253° W
            </div>

            <div
              className="relative rounded-none overflow-hidden border border-white/10 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)]"
              style={{ background: "#0b1220" }}
            >
              <HeroLiveMap />
            </div>
          </div>
        </div>
      </section>

      {/* Commodity price ticker */}
      <CommodityTicker />

      {/* Prueba social — estándares soportados */}
      <LogoMarquee />

      {/* Dual paths: proyectos + marketplace */}
      <section className="border-b border-hairline bg-white">
        <div className="max-w-7xl mx-auto px-5 py-14">
          <Reveal className="text-center max-w-2xl mx-auto mb-10">
            <Eyebrow className="mb-3">Dos caminos, una plataforma</Eyebrow>
            <h2 className="brand-display text-3xl md:text-4xl text-content">
              Del yacimiento al mercado, con capital y trazabilidad
            </h2>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-5">
            <Reveal delay={80}>
              <Link
                to="/inversionistas"
                className="group h-full block rounded-2xl border border-hairline bg-accent-brand-subtle p-8 hover-lift hover:border-accent-brand hover:shadow-[0_18px_40px_-24px_rgba(11,42,91,0.35)] transition"
              >
                <div className="flex items-center gap-3">
                  <span className="grid place-items-center w-12 h-12 rounded-xl bg-accent-brand text-white">
                    <Landmark className="w-6 h-6" strokeWidth={1.75} />
                  </span>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-accent-brand">
                    Inversión en proyectos
                  </div>
                </div>
                <div className="mt-5 font-display text-2xl text-content leading-snug">
                  Deal-flow minero verificado — equity, royalties y offtake
                </div>
                <p className="mt-3 text-sm text-content-subtle">
                  Accede a proyectos calificados con reporte NI 43-101, catastro trazable, data room
                  cifrado y modelo económico listo para comité.
                </p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-accent-brand font-medium text-sm">
                  Ver oportunidades <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            </Reveal>
            <Reveal delay={180}>
              <Link
                to="/marketplace"
                className="group h-full block rounded-2xl border border-hairline bg-surface-inverse text-white p-8 hover-lift hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.6)] transition"
              >
                <div className="flex items-center gap-3">
                  <span className="grid place-items-center w-12 h-12 rounded-xl bg-accent-brand-subtle text-accent-brand">
                    <Gem className="w-6 h-6" strokeWidth={1.75} />
                  </span>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-accent-brand-subtle">
                    Marketplace de commodities
                  </div>
                </div>
                <div className="mt-5 font-display text-2xl leading-snug">
                  Compra & vende commodities certificados de LatAm y África
                </div>
                <p className="mt-3 text-sm text-white/70">
                  Concentrados de Cu/Zn/Pb, cátodos, doré Au/Ag, tierras raras, litio y cobalto —
                  con certificación LBMA, RJC, Fairmined, ICMM, IRMA e ISO.
                </p>
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {[
                    ["CL", "Chile"],
                    ["PE", "Perú"],
                    ["BR", "Brasil"],
                    ["CO", "Colombia"],
                    ["VE", "Venezuela"],
                    ["ZA", "Sudáfrica"],
                    ["CD", "R.D. Congo"],
                  ].map(([code, name]) => (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-white/15 bg-white/[0.06] text-[10px] font-mono uppercase tracking-wider text-white/80"
                    >
                      <span
                        aria-hidden
                        className="inline-block w-2.5 h-2.5 rounded-sm"
                        style={{
                          background:
                            code === "CL"
                              ? "#d52b1e"
                              : code === "PE"
                                ? "#d91023"
                                : code === "BR"
                                  ? "#009c3b"
                                  : code === "CO"
                                    ? "#fcd116"
                                    : code === "VE"
                                      ? "#ffcc00"
                                      : code === "ZA"
                                        ? "#007749"
                                        : "#007fff",
                        }}
                      />
                      <span className="font-semibold">{code}</span>
                      <span className="text-white/60 normal-case tracking-normal">{name}</span>
                    </span>
                  ))}
                </div>
                <span className="mt-5 inline-flex items-center gap-1.5 text-accent-brand-subtle font-medium text-sm">
                  Explorar lotes <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Inversión por región */}
      <section className="border-b border-hairline">
        <div className="max-w-7xl mx-auto px-5 py-16 lg:py-20">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
            <div className="max-w-2xl">
              <Eyebrow className="mb-3">Inversión por región</Eyebrow>
              <h2 className="brand-display text-3xl md:text-4xl text-content">
                Oportunidades geolocalizadas con retorno esperado por geografía
              </h2>
              <p className="mt-4 text-content-subtle">
                Explora proyectos publicados agrupados por región y simula el retorno según ticket,
                plazo y TIR esperada por país. Deal-flow verificado con etapas desde greenfield
                hasta producción.
              </p>
            </div>
            <BrandButton asChild variant="outline">
              <Link to="/oportunidades">
                Ver oportunidades por región <ArrowRight className="w-4 h-4" />
              </Link>
            </BrandButton>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                country: "Chile",
                codes: ["CL"],
                irr: "22%",
                focus: "Cu · Au · Ag · Li",
                note: "Franja andina · catastro Sernageomin trazable",
                trend: [12, 15, 14, 18, 17, 21, 20, 24, 26, 25, 28, 30],
                spark: "#2b4acb",
              },
              {
                country: "Perú",
                codes: ["PE"],
                irr: "24%",
                focus: "Cu · Zn · Au polimetálico",
                note: "Distritos brownfield con infraestructura",
                trend: [8, 12, 10, 14, 18, 16, 20, 22, 21, 25, 27, 30],
                spark: "#d91023",
              },
              {
                country: "Brasil · Colombia",
                codes: ["BR", "CO"],
                irr: "20–26%",
                focus: "Fe · Au · Tierras raras",
                note: "Proyectos con certificación ambiental",
                trend: [14, 13, 16, 15, 19, 18, 22, 20, 24, 23, 27, 29],
                spark: "#009c3b",
              },
            ].map((r) => {
              const max = Math.max(...r.trend);
              const min = Math.min(...r.trend);
              const pts = r.trend
                .map((v, i) => {
                  const x = (i / (r.trend.length - 1)) * 100;
                  const y = 32 - ((v - min) / (max - min || 1)) * 28;
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                })
                .join(" ");
              return (
                <Link
                  key={r.country}
                  to="/oportunidades"
                  className="group rounded-xl border border-hairline bg-white p-5 hover:border-accent-brand hover:shadow-[0_16px_36px_-24px_rgba(11,42,91,0.35)] transition relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {r.codes.map((c) => (
                        <FlagChip key={c} code={c} />
                      ))}
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-accent-brand">
                      TIR ref. {r.irr}
                    </span>
                  </div>
                  <div className="mt-3 font-display text-lg text-content">{r.country}</div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-content-subtle mt-1">
                    {r.focus}
                  </div>
                  <p className="mt-3 text-sm text-content-subtle">{r.note}</p>

                  {/* Sparkline animado */}
                  <div className="mt-4 h-9 relative">
                    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="w-full h-full">
                      <defs>
                        <linearGradient id={`sp-${r.codes[0]}`} x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor={r.spark} stopOpacity="0.35" />
                          <stop offset="100%" stopColor={r.spark} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <polyline
                        fill={`url(#sp-${r.codes[0]})`}
                        stroke="none"
                        points={`0,32 ${pts} 100,32`}
                      />
                      <polyline
                        fill="none"
                        stroke={r.spark}
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={pts}
                        style={{
                          strokeDasharray: 240,
                          strokeDashoffset: 240,
                          animation: "sp-draw 1.6s ease-out forwards",
                        }}
                      />
                    </svg>
                    <span className="absolute right-0 top-0 text-[9px] font-mono text-content-subtle uppercase tracking-wider">
                      12M
                    </span>
                  </div>

                  <span className="mt-4 inline-flex items-center gap-1.5 text-accent-brand text-sm font-medium group-hover:gap-2 transition-all">
                    Simular retorno <ArrowRight className="w-4 h-4" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pillars band */}
      <section className="bg-surface-inverse text-white">
        <div className="max-w-7xl mx-auto px-5 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { i: Mountain, t: "Proyectos de calidad", s: "Verificados y calificados" },
            { i: Users, t: "Inversionistas globales", s: "Red de capital institucional" },
            { i: Globe2, t: "Oportunidades reales", s: "Activos auditados" },
            { i: ShieldCheck, t: "Proceso seguro", s: "Transparente y auditable" },
          ].map(({ i: Icon, t: title, s }) => (
            <div key={title} className="flex items-start gap-3">
              <Icon className="w-7 h-7 text-accent-brand-subtle shrink-0" strokeWidth={1.5} />
              <div>
                <div className="font-display text-[15px] uppercase tracking-wide">{title}</div>
                <div className="text-xs text-white/60 mt-0.5">{s}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* For owners + process wheel + investors */}
      <section className="max-w-7xl mx-auto px-5 py-20 grid lg:grid-cols-[1fr_320px_1fr] gap-10 items-start">
        <div>
          <h2 className="brand-display text-3xl text-content">Para propietarios de proyectos</h2>
          <p className="mt-3 text-content-subtle max-w-md">
            Publica tu proyecto y conéctate con inversionistas calificados de todo el mundo.
          </p>
          <ul className="mt-8 space-y-6">
            {[
              {
                i: FilePlus2,
                t: "Publica tu proyecto",
                s: "Crea un perfil profesional y muestra el potencial técnico y económico.",
              },
              {
                i: Users,
                t: "Accede a inversionistas",
                s: "Recibe interés de inversionistas estratégicos y fondos globales.",
              },
              {
                i: LineChart,
                t: "Gestiona el proceso",
                s: "Herramientas seguras para seguimiento, comunicación y documentación.",
              },
              {
                i: Lock,
                t: "Transparencia y seguridad",
                s: "Protegemos tu información y facilitamos negociaciones confiables.",
              },
            ].map(({ i: Icon, t: title, s }) => (
              <li key={title} className="flex gap-4">
                <span className="grid place-items-center w-10 h-10 rounded-full bg-accent-brand text-white shrink-0">
                  <Icon className="w-5 h-5" strokeWidth={2} />
                </span>
                <div>
                  <div className="font-display text-[15px] text-content">{title}</div>
                  <div className="text-sm text-content-subtle mt-1">{s}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* GIRO animado del proceso */}
        <div className="relative hidden lg:block aspect-square">
          <svg viewBox="0 0 320 320" className="absolute inset-0 w-full h-full brand-spin-slow">
            <circle
              cx="160"
              cy="160"
              r="120"
              fill="none"
              stroke="var(--hairline)"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
            <circle
              cx="160"
              cy="160"
              r="120"
              fill="none"
              stroke="var(--accent-brand)"
              strokeWidth="1.2"
              strokeDasharray="20 320"
              strokeDashoffset={-(activeStep * 213)}
              className="transition-[stroke-dashoffset] duration-700"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="grid place-items-center w-24 h-24 rounded-full bg-accent-brand-subtle border border-accent-brand/30 brand-pulse">
              <span className="font-display text-4xl text-accent-brand font-bold">G</span>
            </div>
          </div>
          {PROCESS_STEPS.map((step, i) => {
            const angle = (i / PROCESS_STEPS.length) * 2 * Math.PI - Math.PI / 2;
            const x = 50 + 42 * Math.cos(angle);
            const y = 50 + 42 * Math.sin(angle);
            const active = i === activeStep;
            const Icon = step.icon;
            return (
              <div
                key={step.label}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-500"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <span
                  className={`grid place-items-center w-14 h-14 rounded-full border shadow-sm transition-all duration-500 ${
                    active
                      ? "bg-accent-brand border-accent-brand scale-110"
                      : "bg-white border-hairline"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 transition-colors ${active ? "text-white" : "text-accent-brand"}`}
                  />
                </span>
                <span
                  className={`mt-1.5 text-[10px] font-mono uppercase tracking-wider text-center max-w-[80px] transition-colors ${
                    active ? "text-content font-semibold" : "text-content-subtle"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        <div>
          <h2 className="brand-display text-3xl text-content">Para inversionistas</h2>
          <p className="mt-3 text-content-subtle max-w-md">
            Encuentra oportunidades únicas y diversifica tu portafolio con acceso a proyectos
            verificados.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              "Acceso a proyectos calificados",
              "Información técnica y financiera",
              "Herramientas de análisis y filtrado",
              "Comunicación directa y segura",
            ].map((it) => (
              <li key={it} className="flex items-start gap-2.5 text-[15px] text-content">
                <CheckCircle2 className="w-5 h-5 text-accent-brand shrink-0 mt-0.5" />
                {it}
              </li>
            ))}
          </ul>
          <Link
            to="/inversionistas"
            className="mt-8 inline-flex items-center gap-2 text-accent-brand font-medium hover:underline"
          >
            Explorar oportunidades <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Types + global network */}
      <section className="bg-accent-brand-subtle border-y border-hairline">
        <div className="max-w-7xl mx-auto px-5 py-16 grid lg:grid-cols-2 gap-12">
          <div>
            <p className="brand-eyebrow mb-4">Tipos de proyectos</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { i: Coins, t: "Metales preciosos" },
                { i: Layers, t: "Metales base" },
                { i: Zap, t: "Litio y minerales críticos" },
                { i: Gem, t: "Energía y otros" },
              ].map(({ i: Icon, t: title }) => (
                <div
                  key={title}
                  className="bg-white rounded-xl border border-hairline p-4 text-center"
                >
                  <Icon className="w-7 h-7 text-accent-brand mx-auto" strokeWidth={1.5} />
                  <div className="mt-2 text-xs font-medium text-content leading-tight">{title}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Eyebrow className="mb-4">Nuestra red global · datos en vivo</Eyebrow>
            <div className="grid grid-cols-3 gap-4">
              {liveStats.map((s) => (
                <Stat key={s.l} value={s.v} label={s.l} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Métricas piloto Palmeras */}
      <section className="bg-surface-inverse text-white border-y border-white/5">
        <div className="max-w-7xl mx-auto px-5 py-16">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-4">
            <div>
              <p className="brand-eyebrow text-accent-brand-subtle mb-3">
                Inteligencia viva del proyecto
              </p>
              <h2 className="brand-display text-3xl md:text-4xl">Prospecto Las Palmeras</h2>
              <p className="mt-2 text-white/60 font-mono text-xs tracking-wider">
                TRK-ALH-001 · ILLAPEL, REGIÓN DE COQUIMBO · CHILE · Au-Ag
              </p>
            </div>
            <Link
              to="/live/palmeras"
              className="inline-flex items-center gap-2 border border-accent-brand-subtle/40 text-accent-brand-subtle px-4 py-2 rounded-md text-xs font-mono uppercase tracking-wider hover:bg-accent-brand-subtle/10"
            >
              Ver vista en vivo <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 border border-white/10 rounded-xl overflow-hidden">
            {[
              { v: "74", l: "Concesiones mineras", d: "12.807,6 ha bajo control", i: Map },
              {
                v: "16",
                l: "Sondajes en campaña",
                d: "4.426 m perforados · máx 350 m",
                i: Database,
              },
              { v: "12", l: "Anomalías satelitales", d: "4 high · 6 medium · 2 low", i: Satellite },
              {
                v: "16/16",
                l: "Corridas satelitales OK",
                d: "5 índices · NDVI · IOX · HYD · CLY · STR",
                i: Activity,
              },
            ].map(({ v, l, d, i: Icon }, idx) => (
              <Reveal key={l} delay={idx * 90} className="bg-surface-inverse">
                <div className="p-6">
                  <Icon className="w-5 h-5 text-accent-brand-subtle mb-4" strokeWidth={1.5} />
                  <div className="font-mono text-3xl text-white tracking-tight">
                    {/^\d+$/.test(v) ? <AnimatedCounter value={Number(v)} format="int" /> : v}
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-white/80 mt-2 font-display">
                    {l}
                  </div>
                  <div className="text-[11px] text-white/40 mt-1 font-mono">{d}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Feature showcase — catastro + geofísica (fotográfico) */}
      <section className="border-b border-hairline bg-white">
        <div className="max-w-7xl mx-auto px-5 py-14 sm:py-20">
          <Reveal className="max-w-2xl mb-10">
            <Eyebrow className="mb-3">Capacidades diferenciales</Eyebrow>
            <h2 className="brand-display text-3xl md:text-4xl text-content leading-tight">
              Del catastro georreferenciado a la geofísica interpretada
            </h2>
            <p className="mt-4 text-content-subtle">
              Dos motores propios que sustentan cada decisión sobre un activo minero: control
              catastral trazable y firma geofísica lista para modelar.
            </p>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-6">
            <Reveal delay={80}>
              <Link
                to="/catastro/mapa"
                className="group block rounded-2xl overflow-hidden border border-hairline bg-white hover-lift hover:border-accent-brand hover:shadow-[0_18px_40px_-24px_rgba(11,42,91,0.35)] transition"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img
                    src={featureCatastro}
                    alt="Catastro minero georreferenciado sobre topografía andina"
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute left-5 top-5 inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur text-[10px] font-mono uppercase tracking-[0.22em] text-accent-brand">
                    <Map className="w-3.5 h-3.5" /> Catastro trazable
                  </div>
                  <div className="absolute left-5 bottom-5 right-5 text-white">
                    <div className="font-display text-2xl leading-snug">
                      +47.000 concesiones sobre una capa geoespacial única
                    </div>
                    <p className="mt-2 text-sm text-white/80 max-w-md">
                      SERNAGEOMIN, INGEMMET y ANM en un mismo mapa, con alertas de superposición y
                      análisis de prospectividad.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between px-6 py-4">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-content-subtle">
                    Explorar mapa catastral
                  </span>
                  <ArrowRight className="w-4 h-4 text-accent-brand group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            </Reveal>
            <Reveal delay={160}>
              <Link
                to="/visor-3d"
                className="group block rounded-2xl overflow-hidden border border-hairline bg-white hover-lift hover:border-accent-brand hover:shadow-[0_18px_40px_-24px_rgba(11,42,91,0.35)] transition"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img
                    src={featureGeophysics}
                    alt="Visualización geofísica 3D con anomalías magnéticas y satelitales"
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute left-5 top-5 inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur text-[10px] font-mono uppercase tracking-[0.22em] text-accent-brand">
                    <Satellite className="w-3.5 h-3.5" /> Geofísica + satelital
                  </div>
                  <div className="absolute left-5 bottom-5 right-5 text-white">
                    <div className="font-display text-2xl leading-snug">
                      Anomalías satelitales y firma magnética listas para modelar
                    </div>
                    <p className="mt-2 text-sm text-white/80 max-w-md">
                      DEM Copernicus + drape Sentinel + magnetometría interpretada, con target
                      generator asistido por IA.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between px-6 py-4">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-content-subtle">
                    Abrir visor 3D
                  </span>
                  <ArrowRight className="w-4 h-4 text-accent-brand group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Módulos del Terminal */}
      <section className="max-w-7xl mx-auto px-5 py-20">
        <div className="grid lg:grid-cols-[1fr_2fr] gap-10 mb-12">
          <div>
            <p className="brand-eyebrow mb-3">Módulos del Terminal</p>
            <h2 className="brand-display text-3xl md:text-4xl text-content leading-tight">
              Una sola pantalla para evaluar, monitorear y transar activos mineros
            </h2>
          </div>
          <p className="text-content-subtle text-base lg:text-lg lg:pt-4">
            Geocapitals Terminal integra catastro, geología 3D, cumplimiento y mercados secundarios
            sobre una capa de datos georreferenciada. Diseñado para Qualified Persons, fondos de
            inversión y holdings mineros que requieren trazabilidad NI 43-101 y due diligence
            acelerada.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              i: Map,
              t: "Mapa geológico",
              d: "Capas SERNAGEOMIN, concesiones, alertas de superposición y análisis de prospectividad.",
              to: "/catastro/mapa" as const,
            },
            {
              i: Satellite,
              t: "Monitoreo satelital",
              d: "Detección de cambios, deformación InSAR y firmas espectrales sobre tu portafolio.",
              to: "/satelital" as const,
            },
            {
              i: Landmark,
              t: "Capital raise & deals",
              d: "Data room, KYC/AML institucional y matching con inversionistas verificados.",
              to: "/oportunidades" as const,
            },
            {
              i: Cpu,
              t: "Visor 3D geocientífico",
              d: "DEM Copernicus + drape Sentinel, anomalías geofísicas y target generator con IA.",
              to: "/visor-3d" as const,
            },
            {
              i: FileText,
              t: "NI 43-101 asistido",
              d: "Borradores automáticos, recursos estimados y QA/QC con audit-trail trazable.",
              to: null,
            },
            {
              i: ShieldCheck,
              t: "Cumplimiento & patentes",
              d: "Vencimientos, expedientes y obligaciones legales por proyecto y por holder.",
              to: null,
            },
          ].map(({ i: Icon, t: title, d, to }, idx) => {
            const inner = (
              <>
                <div className="flex items-center justify-between mb-5">
                  <span className="grid place-items-center w-11 h-11 rounded-lg bg-accent-brand-subtle text-accent-brand">
                    <Icon className="w-5 h-5" strokeWidth={1.75} />
                  </span>
                  {to ? (
                    <ArrowRight className="w-4 h-4 text-content-subtle group-hover:text-accent-brand group-hover:translate-x-0.5 transition" />
                  ) : (
                    <span className="text-[10px] uppercase tracking-wide text-content-subtle border border-hairline rounded-full px-2 py-0.5">
                      Próximamente
                    </span>
                  )}
                </div>
                <div className="font-display text-lg text-content">{title}</div>
                <p className="text-sm text-content-subtle mt-2 leading-relaxed">{d}</p>
              </>
            );
            if (to) {
              return (
                <Reveal key={title} delay={idx * 70}>
                  <Link to={to} className="block group h-full">
                    <BrandCard
                      interactive
                      className="h-full hover-lift group-hover:border-accent-brand/40 transition"
                    >
                      {inner}
                    </BrandCard>
                  </Link>
                </Reveal>
              );
            }
            return (
              <Reveal key={title} delay={idx * 70}>
                <BrandCard className="group h-full opacity-80">{inner}</BrandCard>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Terminal preview mock */}
      <PlatformPreview />

      {/* Proyectos disponibles para invertir */}
      <InvestableProjects />

      {/* Simulador de retornos */}
      <InvestmentSimulator />

      {/* Casos de uso */}
      <section className="bg-accent-brand-subtle border-y border-hairline">
        <div className="max-w-7xl mx-auto px-5 py-20">
          <SectionHeading
            align="center"
            className="max-w-2xl mx-auto mb-14"
            eyebrow="Casos de uso"
            title="Diseñado para quienes mueven la industria minera"
            description="Flujos verticales adaptados a cada perfil del ecosistema, con permisos granulares y datos auditables."
          />

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                i: Building2,
                tag: "Holdings & junior miners",
                t: "Estructuración y tokenización",
                items: [
                  "Inventario completo de concesiones",
                  "Reportes NI 43-101 listos para inversionistas",
                  "Tokenización de regalías y royalties",
                ],
                to: "/empresas",
              },
              {
                i: Briefcase,
                tag: "Fondos & family offices",
                t: "Due diligence acelerado",
                items: [
                  "Screening sobre +47.000 concesiones",
                  "Modelo económico con sensibilidad de precios",
                  "Data room cifrado y trazable",
                ],
                to: "/inversionistas",
              },
              {
                i: Landmark,
                tag: "Reguladores & QPs",
                t: "Trazabilidad y cumplimiento",
                items: [
                  "Audit-trail por campo y por documento",
                  "Vencimientos y obligaciones de patentes",
                  "Firmas electrónicas y workflows de aprobación",
                ],
                to: "/recursos",
              },
            ].map(({ i: Icon, tag, t: title, items, to }, idx) => (
              <Reveal key={title} delay={idx * 90}>
                <div className="bg-white border border-hairline rounded-2xl p-6 flex flex-col h-full hover-lift hover:border-accent-brand/40 hover:shadow-[0_18px_40px_-24px_rgba(11,42,91,0.3)]">
                  <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-accent-brand mb-5">
                    <Icon className="w-4 h-4" /> {tag}
                  </div>
                  <div className="font-display text-xl text-content leading-snug">{title}</div>
                  <ul className="mt-5 space-y-2.5 flex-1">
                    {items.map((it) => (
                      <li key={it} className="flex items-start gap-2 text-sm text-content">
                        <CheckCircle2 className="w-4 h-4 text-accent-brand shrink-0 mt-0.5" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={to}
                    className="mt-6 inline-flex items-center gap-1.5 text-sm text-accent-brand font-medium hover:gap-2.5 transition-all"
                  >
                    Ver más <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonios & prueba social */}
      <TestimonialsBento />

      {/* FAQ */}
      <FaqAccordion />

      {/* CTA Principal */}
      <section className="relative overflow-hidden bg-surface-inverse text-white">
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(var(--accent-brand-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--accent-brand-subtle) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative max-w-5xl mx-auto px-5 py-24 text-center">
          <p className="brand-eyebrow text-accent-brand-subtle mb-4">Comienza hoy</p>
          <h2 className="brand-display text-4xl md:text-5xl leading-[1.05] max-w-3xl mx-auto">
            Eleva tu proyecto al estándar institucional
          </h2>
          <p className="mt-5 text-white/70 max-w-2xl mx-auto text-lg">
            Únete a las compañías mineras y fondos que ya operan sobre Geocapitals para estructurar
            capital, evaluar activos y cumplir con los estándares globales de reporte.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <BrandButton asChild size="lg">
              <Link to="/auth">
                Solicitar acceso institucional <ArrowRight className="w-4 h-4" />
              </Link>
            </BrandButton>
            <Link
              to="/terminal"
              className="inline-flex items-center gap-2 border border-white/30 text-white px-6 py-3.5 rounded-md font-medium text-sm hover:bg-white/10 transition"
            >
              Explorar el terminal en vivo
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[11px] font-mono uppercase tracking-wider text-white/50">
            <span className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5" /> Cifrado AES-256
            </span>
            <span className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5" /> Datos soberanos
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5" /> SOC 2 ready
            </span>
            <span className="flex items-center gap-2">
              <Globe2 className="w-3.5 h-3.5" /> Multi-jurisdicción
            </span>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
