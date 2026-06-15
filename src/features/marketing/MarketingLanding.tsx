import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlatformStats } from "@/lib/platformStats.functions";
import { HeroLiveMap } from "@/features/marketing/HeroLiveMap";

import { MarketingHeader, MarketingFooter } from "@/features/marketing/MarketingShell";
import { useLocale } from "@/features/marketing/i18n";
import { BrandButton, BrandCard, Eyebrow, SectionHeading, Stat } from "@/components/brand";
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

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[var(--brand-hair)]">
        <div className="max-w-7xl mx-auto px-5 py-16 lg:py-24 grid lg:grid-cols-[1fr_1.1fr] gap-12 items-center">
          <div>
            <Eyebrow className="mb-5">{t("hero_eyebrow")}</Eyebrow>
            <h1 className="brand-display text-[44px] sm:text-[56px] leading-[1.05] text-[var(--brand-navy-deep)]">
              {t("hero_title")}
            </h1>
            <p className="mt-6 text-lg text-[var(--brand-mute)] max-w-xl">{t("hero_sub")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <BrandButton asChild size="lg">
                <Link to="/contacto">
                  {t("cta_publish")} <ArrowRight className="w-4 h-4" />
                </Link>
              </BrandButton>
              <BrandButton asChild variant="outline" size="lg">
                <Link to="/terminal">{t("cta_explore")}</Link>
              </BrandButton>
            </div>
            <div className="mt-10 flex items-center gap-8 text-xs font-mono text-[var(--brand-mute)] flex-wrap">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[var(--brand-blue)]" /> KYC / AML
              </span>
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--brand-blue)]" /> NI 43-101
              </span>
              <span className="flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-[var(--brand-blue)]" /> 18 países
              </span>
            </div>
          </div>

          {/* Hero LIVE MAP */}
          <HeroLiveMap />
        </div>
      </section>

      {/* Pillars band */}
      <section className="bg-[var(--brand-navy-deep)] text-white">
        <div className="max-w-7xl mx-auto px-5 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { i: Mountain, t: "Proyectos de calidad", s: "Verificados y calificados" },
            { i: Users, t: "Inversionistas globales", s: "Red de capital institucional" },
            { i: Globe2, t: "Oportunidades reales", s: "Activos auditados" },
            { i: ShieldCheck, t: "Proceso seguro", s: "Transparente y auditable" },
          ].map(({ i: Icon, t: title, s }) => (
            <div key={title} className="flex items-start gap-3">
              <Icon className="w-7 h-7 text-[var(--brand-gold)] shrink-0" strokeWidth={1.5} />
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
          <h2 className="brand-display text-3xl text-[var(--brand-navy-deep)]">
            Para propietarios de proyectos
          </h2>
          <p className="mt-3 text-[var(--brand-mute)] max-w-md">
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
                <span className="grid place-items-center w-10 h-10 rounded-full bg-[var(--brand-blue)] text-white shrink-0">
                  <Icon className="w-5 h-5" strokeWidth={2} />
                </span>
                <div>
                  <div className="font-display text-[15px] text-[var(--brand-navy-deep)]">
                    {title}
                  </div>
                  <div className="text-sm text-[var(--brand-mute)] mt-1">{s}</div>
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
              stroke="var(--brand-hair)"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
            <circle
              cx="160"
              cy="160"
              r="120"
              fill="none"
              stroke="var(--brand-blue)"
              strokeWidth="1.2"
              strokeDasharray="20 320"
              strokeDashoffset={-(activeStep * 213)}
              className="transition-[stroke-dashoffset] duration-700"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="grid place-items-center w-24 h-24 rounded-full bg-[var(--brand-blue-soft)] border border-[var(--brand-blue)]/30 brand-pulse">
              <span className="font-display text-4xl text-[var(--brand-blue)] font-bold">G</span>
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
                      ? "bg-[var(--brand-blue)] border-[var(--brand-blue)] scale-110"
                      : "bg-white border-[var(--brand-hair)]"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 transition-colors ${active ? "text-white" : "text-[var(--brand-blue)]"}`}
                  />
                </span>
                <span
                  className={`mt-1.5 text-[10px] font-mono uppercase tracking-wider text-center max-w-[80px] transition-colors ${
                    active
                      ? "text-[var(--brand-navy-deep)] font-semibold"
                      : "text-[var(--brand-mute)]"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        <div>
          <h2 className="brand-display text-3xl text-[var(--brand-navy-deep)]">
            Para inversionistas
          </h2>
          <p className="mt-3 text-[var(--brand-mute)] max-w-md">
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
              <li key={it} className="flex items-start gap-2.5 text-[15px] text-[var(--brand-ink)]">
                <CheckCircle2 className="w-5 h-5 text-[var(--brand-blue)] shrink-0 mt-0.5" />
                {it}
              </li>
            ))}
          </ul>
          <Link
            to="/inversionistas"
            className="mt-8 inline-flex items-center gap-2 text-[var(--brand-blue)] font-medium hover:underline"
          >
            Explorar oportunidades <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Types + global network */}
      <section className="bg-[var(--brand-blue-soft)] border-y border-[var(--brand-hair)]">
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
                  className="bg-white rounded-xl border border-[var(--brand-hair)] p-4 text-center"
                >
                  <Icon className="w-7 h-7 text-[var(--brand-blue)] mx-auto" strokeWidth={1.5} />
                  <div className="mt-2 text-xs font-medium text-[var(--brand-navy-deep)] leading-tight">
                    {title}
                  </div>
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
      <section className="bg-[var(--brand-navy-deep)] text-white border-y border-white/5">
        <div className="max-w-7xl mx-auto px-5 py-16">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-4">
            <div>
              <p className="brand-eyebrow text-[var(--brand-gold)] mb-3">
                Inteligencia viva del proyecto
              </p>
              <h2 className="brand-display text-3xl md:text-4xl">Prospecto Las Palmeras</h2>
              <p className="mt-2 text-white/60 font-mono text-xs tracking-wider">
                TRK-ALH-001 · ILLAPEL, REGIÓN DE COQUIMBO · CHILE · Au-Ag
              </p>
            </div>
            <Link
              to="/live/palmeras"
              className="inline-flex items-center gap-2 border border-[var(--brand-gold)]/40 text-[var(--brand-gold)] px-4 py-2 rounded-md text-xs font-mono uppercase tracking-wider hover:bg-[var(--brand-gold)]/10"
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
            ].map(({ v, l, d, i: Icon }) => (
              <div key={l} className="bg-[var(--brand-navy-deep)] p-6">
                <Icon className="w-5 h-5 text-[var(--brand-gold)] mb-4" strokeWidth={1.5} />
                <div className="font-mono text-3xl text-white tracking-tight">{v}</div>
                <div className="text-[11px] uppercase tracking-wider text-white/80 mt-2 font-display">
                  {l}
                </div>
                <div className="text-[11px] text-white/40 mt-1 font-mono">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Módulos del Terminal */}
      <section className="max-w-7xl mx-auto px-5 py-20">
        <div className="grid lg:grid-cols-[1fr_2fr] gap-10 mb-12">
          <div>
            <p className="brand-eyebrow mb-3">Módulos del Terminal</p>
            <h2 className="brand-display text-3xl md:text-4xl text-[var(--brand-navy-deep)] leading-tight">
              Una sola pantalla para evaluar, monitorear y transar activos mineros
            </h2>
          </div>
          <p className="text-[var(--brand-mute)] text-base lg:text-lg lg:pt-4">
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
            },
            {
              i: Cpu,
              t: "Visor 3D geocientífico",
              d: "DEM Copernicus + drape Sentinel, anomalías geofísicas y target generator con IA.",
            },
            {
              i: Satellite,
              t: "Monitoreo satelital",
              d: "Detección de cambios, deformación InSAR y firmas espectrales sobre tu portafolio.",
            },
            {
              i: FileText,
              t: "NI 43-101 asistido",
              d: "Borradores automáticos, recursos estimados y QA/QC con audit-trail trazable.",
            },
            {
              i: ShieldCheck,
              t: "Cumplimiento & patentes",
              d: "Vencimientos, expedientes y obligaciones legales por proyecto y por holder.",
            },
            {
              i: Landmark,
              t: "Capital raise & deals",
              d: "Data room, KYC/AML institucional y matching con inversionistas verificados.",
            },
          ].map(({ i: Icon, t: title, d }) => (
            <BrandCard key={title} interactive className="group">
              <div className="flex items-center justify-between mb-5">
                <span className="grid place-items-center w-11 h-11 rounded-lg bg-[var(--brand-blue-soft)] text-[var(--brand-blue)]">
                  <Icon className="w-5 h-5" strokeWidth={1.75} />
                </span>
                <ArrowRight className="w-4 h-4 text-[var(--brand-mute)] group-hover:text-[var(--brand-blue)] group-hover:translate-x-0.5 transition" />
              </div>
              <div className="font-display text-lg text-[var(--brand-navy-deep)]">{title}</div>
              <p className="text-sm text-[var(--brand-mute)] mt-2 leading-relaxed">{d}</p>
            </BrandCard>
          ))}
        </div>
      </section>

      {/* Casos de uso */}
      <section className="bg-[var(--brand-blue-soft)] border-y border-[var(--brand-hair)]">
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
            ].map(({ i: Icon, tag, t: title, items, to }) => (
              <div
                key={title}
                className="bg-white border border-[var(--brand-hair)] rounded-2xl p-6 flex flex-col"
              >
                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-[var(--brand-blue)] mb-5">
                  <Icon className="w-4 h-4" /> {tag}
                </div>
                <div className="font-display text-xl text-[var(--brand-navy-deep)] leading-snug">
                  {title}
                </div>
                <ul className="mt-5 space-y-2.5 flex-1">
                  {items.map((it) => (
                    <li key={it} className="flex items-start gap-2 text-sm text-[var(--brand-ink)]">
                      <CheckCircle2 className="w-4 h-4 text-[var(--brand-blue)] shrink-0 mt-0.5" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={to}
                  className="mt-6 inline-flex items-center gap-1.5 text-sm text-[var(--brand-blue)] font-medium hover:gap-2.5 transition-all"
                >
                  Ver más <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Principal */}
      <section className="relative overflow-hidden bg-[var(--brand-navy-deep)] text-white">
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(var(--brand-gold) 1px, transparent 1px), linear-gradient(90deg, var(--brand-gold) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative max-w-5xl mx-auto px-5 py-24 text-center">
          <p className="brand-eyebrow text-[var(--brand-gold)] mb-4">Comienza hoy</p>
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
