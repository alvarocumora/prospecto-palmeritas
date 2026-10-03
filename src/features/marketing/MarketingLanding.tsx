import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  ShieldCheck,
  FileText,
  Globe2,
  MapPin,
  Layers,
  Coins,
  Radar,
} from "lucide-react";

import { getPlatformStats } from "@/lib/platformStats.functions";
import { HeroLiveMap } from "@/features/marketing/HeroLiveMap";
import { LandingCatastroBlock } from "@/features/marketing/LandingCatastroBlock";
import { CatastroComparison } from "@/features/marketing/CatastroComparison";
import { MarketingHeader, MarketingFooter } from "@/features/marketing/MarketingShell";
import { useLocale } from "@/features/marketing/i18n";
import { InvestableProjects } from "@/features/marketing/InvestableProjects";
import { CommodityTicker } from "@/features/marketing/CommodityTicker";
import { PublicCommodityLots } from "@/features/marketing/PublicCommodityLots";
import { AnimatedCounter } from "@/features/marketing/AnimatedCounter";
import { HeroTopoBackground } from "@/features/marketing/HeroTopoBackground";
import { Reveal } from "@/features/marketing/Reveal";
import { Eyebrow } from "@/components/brand";
import heroMining from "@/assets/hero-mining.jpg";
import colateralCover from "@/assets/colateral/cover-maule.jpg";
import { CollateralDownloadButtons } from "@/features/investor/CollateralDownloadButtons";

export function MarketingLanding() {
  const { t } = useLocale();

  const statsFn = useServerFn(getPlatformStats);
  const { data: live } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: () => statsFn(),
    staleTime: 60_000,
  });

  return (
    <div className="brand-light min-h-screen">
      <MarketingHeader />

      {/* ─────────────────────────────────────────────
          1. HERO — compacto, dos CTAs claros
         ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#05070a] text-slate-200 border-b border-white/5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.32]"
          style={{ backgroundImage: `url(${heroMining})` }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(5,7,10,0.72) 0%, rgba(5,7,10,0.86) 55%, rgba(5,7,10,0.96) 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full blur-[120px]"
          style={{ background: "color-mix(in oklab, var(--accent-brand) 22%, transparent)" }}
        />
        <HeroTopoBackground />

        <div className="relative max-w-7xl mx-auto px-5 py-14 sm:py-20 lg:py-24 grid lg:grid-cols-[1fr_1.05fr] gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[10px] font-mono uppercase tracking-[0.28em] text-slate-300 mb-6 backdrop-blur">
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

            <h1 className="brand-display text-[36px] sm:text-[52px] lg:text-[60px] leading-[1.02] tracking-tight text-white">
              Inversión estructurada en minería,{" "}
              <span className="italic font-normal text-slate-400">
                respaldada por catastro y activos reales
              </span>
              .
            </h1>

            <p className="mt-5 text-base sm:text-lg text-slate-400 max-w-xl font-light leading-relaxed">
              Invierte en proyectos mineros verificados con garantía inmobiliaria, analiza
              concesiones con imágenes satelitales y comercializa mineral con procedencia
              documentada.
            </p>

            {/* 3 puertas de entrada por perfil */}
            <div className="mt-8 grid sm:grid-cols-3 gap-px bg-white/[0.08] border border-white/10">
              {[
                {
                  to: "/inversion-colateral" as const,
                  k: "Soy inversionista",
                  d: "Renta fija con colateral inmobiliario y proyectos para invertir.",
                  icon: ShieldCheck,
                },
                {
                  to: "/empresas" as const,
                  k: "Soy titular o geólogo",
                  d: "Certifica, visualiza en 3D y financia tu proyecto minero.",
                  icon: Layers,
                },
                {
                  to: "/marketplace" as const,
                  k: "Compro o vendo mineral",
                  d: "Lotes y requerimientos con procedencia trazable.",
                  icon: Coins,
                },
              ].map((door) => (
                <Link
                  key={door.k}
                  to={door.to}
                  className="group bg-[#05070a] p-4 hover:bg-white/[0.04] transition-colors"
                >
                  <door.icon className="w-4 h-4 mb-2" style={{ color: "var(--gold)" }} />
                  <div className="text-sm text-white font-medium flex items-center gap-1">
                    {door.k}
                    <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <div className="text-xs text-slate-400 mt-1 leading-snug">{door.d}</div>
                </Link>
              ))}
            </div>

            {/* Trust strip */}
            <div className="mt-8 pt-6 border-t border-white/5 flex items-center gap-6 text-[11px] font-mono uppercase tracking-widest text-slate-500 flex-wrap">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" style={{ color: "var(--accent-brand)" }} /> KYC /
                AML
              </span>
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4" style={{ color: "var(--accent-brand)" }} /> NI 43-101
              </span>
              <span className="flex items-center gap-2">
                <Globe2 className="w-4 h-4" style={{ color: "var(--accent-brand)" }} /> LATAM
              </span>
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4" style={{ color: "var(--accent-brand)" }} /> Garantía
                inmobiliaria
              </span>
            </div>

            {/* KPI live bar — solo cifras reales; se oculta si aún no cargan */}
            {(() => {
              const kpis = [
                { v: live?.projects ?? 0, l: "Proyectos" },
                { v: live?.concessionsManaged ?? 0, l: "Concesiones", compact: true },
                { v: live?.satelliteAnomalies ?? 0, l: "Anomalías sat." },
                { v: live?.mineralDeposits ?? 0, l: "Yacimientos", compact: true },
              ].filter((k) => k.v > 0);
              if (kpis.length === 0) return null;
              return (
                <div
                  className="mt-6 grid gap-px bg-white/[0.06] border border-white/10 rounded-sm overflow-hidden"
                  style={{ gridTemplateColumns: `repeat(${kpis.length}, minmax(0, 1fr))` }}
                >
                  {kpis.map((k, i) => (
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
              );
            })()}
          </div>

          {/* Live map wrapped in HUD frame */}
          <div className="relative">
            <div className="pointer-events-none absolute -top-2 -left-2 w-8 h-8 border-t-2 border-l-2 border-white/40 z-20" />
            <div className="pointer-events-none absolute -top-2 -right-2 w-8 h-8 border-t-2 border-r-2 border-white/40 z-20" />
            <div className="pointer-events-none absolute -bottom-2 -left-2 w-8 h-8 border-b-2 border-l-2 border-white/40 z-20" />
            <div className="pointer-events-none absolute -bottom-2 -right-2 w-8 h-8 border-b-2 border-r-2 border-white/40 z-20" />

            <div className="pointer-events-none absolute -top-6 left-0 z-20 font-mono text-[10px] uppercase tracking-[0.28em] text-slate-500 flex items-center gap-3">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "var(--gold)" }}
              />
              <span>SCANNING · LATAM · LIVE</span>
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

      {/* Ticker de precios spot */}
      <CommodityTicker />

      {/* ─────────────────────────────────────────────
          2. PROYECTOS DE MINERÍA
         ───────────────────────────────────────────── */}
      <section id="proyectos" className="border-b border-hairline bg-surface">
        <div className="max-w-7xl mx-auto px-5 py-16 sm:py-20">
          <Reveal>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
              <div>
                <Eyebrow className="mb-3">Marketplace de proyectos</Eyebrow>
                <h2 className="brand-display text-3xl md:text-4xl text-content leading-tight">
                  Proyectos mineros publicados
                </h2>
                <p className="mt-3 text-content-muted max-w-2xl">
                  Prospectos y activos operativos con ficha técnica, valorización automática y data
                  room público. Filtra por commodity, país o estado.
                </p>
              </div>
              <Link
                to="/oportunidades"
                className="group inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-content hover:text-accent-brand transition-colors self-start md:self-end"
              >
                Ver todos
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </Reveal>
          <InvestableProjects />
        </div>
      </section>

      {/* 2b. INVERSIÓN CON COLATERAL INMOBILIARIO */}
      <section id="colateral" className="border-b border-hairline bg-white">
        <div className="max-w-7xl mx-auto px-5 py-16 sm:py-20 grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
          <Reveal>
            <div>
              <Eyebrow className="mb-3">Inversión con colateral</Eyebrow>
              <h2 className="brand-display text-3xl md:text-4xl text-content leading-tight">
                Invierte en minería con una parcela real en garantía.
              </h2>
              <p className="mt-3 text-content-muted max-w-xl">
                Desde $25 MM, UF + 12 % anual con pago mensual. Te entregamos en garantía una
                parcela con rol individual en Hualañé o Licantén, Región del Maule.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-px bg-hairline border border-hairline rounded-sm overflow-hidden">
                {[
                  { v: "UF + 12 %", l: "Tasa anual" },
                  { v: "$250.000", l: "Interés/mes por $25 MM" },
                  { v: "116", l: "Parcelas en cartera" },
                ].map((k) => (
                  <div key={k.l} className="bg-white px-4 py-4">
                    <div className="font-mono text-xl text-content">{k.v}</div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-content-muted mt-1">
                      {k.l}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/inversion-colateral"
                  className="inline-flex items-center gap-2 h-11 px-5 bg-content text-white text-[11px] font-semibold uppercase tracking-[0.2em] rounded-sm hover:bg-accent-brand transition-colors"
                >
                  Simular y ver parcelas <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <CollateralDownloadButtons className="mt-3" />
              <p className="mt-4 text-[11px] text-content-muted">
                Tasa pactada por contrato, no proyección minera. No es oferta pública de valores.
              </p>
            </div>
          </Reveal>
          <Reveal>
            <Link
              to="/inversion-colateral"
              className="group block relative overflow-hidden border border-hairline"
            >
              <img
                src={colateralCover}
                alt="Valle rural del Maule (imagen ilustrativa)"
                loading="lazy"
                className="w-full h-80 object-cover group-hover:scale-[1.02] transition-transform duration-700"
              />
              <span className="absolute bottom-0 inset-x-0 bg-white/85 px-4 py-2 text-[11px] font-mono text-content-muted">
                Imagen ilustrativa · Hualañé 41,75 ha · Licantén 44 ha
              </span>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
          3. CATASTRO LIVE
         ───────────────────────────────────────────── */}
      <section id="catastro" className="border-b border-hairline bg-white">
        <div className="max-w-7xl mx-auto px-5 py-16 sm:py-20">
          <Reveal>
            <div className="grid lg:grid-cols-[1fr_2fr] gap-8 items-end mb-8">
              <div>
                <Eyebrow className="mb-3">Catastro georreferenciado</Eyebrow>
                <h2 className="brand-display text-3xl md:text-4xl text-content leading-tight">
                  Mapa live de concesiones y proyectos.
                </h2>
                <p className="mt-3 text-content-muted">
                  Cruzamos el catastro minero nacional con boletines oficiales, deudas de patente y
                  yacimientos indexados. Todo en tiempo real.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to="/catastro/proyecto"
                    className="inline-flex items-center gap-2 h-11 px-5 bg-content text-white text-[11px] font-semibold uppercase tracking-[0.2em] rounded-sm hover:bg-accent-brand transition-colors"
                  >
                    <MapPin className="w-4 h-4" />
                    Abrir catastro
                  </Link>
                  <Link
                    to="/terminal"
                    className="inline-flex items-center gap-2 h-11 px-5 border border-hairline text-content text-[11px] font-semibold uppercase tracking-[0.2em] rounded-sm hover:border-accent-brand hover:text-accent-brand transition-colors"
                  >
                    <Layers className="w-4 h-4" />
                    Terminal geológico
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-px bg-hairline border border-hairline rounded-sm overflow-hidden">
                {[
                  {
                    v: live?.cadastreNationalCount ?? 0,
                    l: "En catastro nacional",
                    compact: true,
                  },
                  { v: live?.concessionsManaged ?? 0, l: "Gestionadas", compact: true },
                  { v: live?.explorationTargets ?? 0, l: "Targets" },
                ].map((k, i) => (
                  <div key={i} className="bg-white px-4 py-4">
                    <div className="font-mono text-2xl text-content tracking-tight">
                      <AnimatedCounter value={k.v} format={k.compact ? "compact" : "int"} />
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-content-muted mt-1">
                      {k.l}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal>
            <LandingCatastroBlock />
          </Reveal>

          <div className="mt-8">
            <Reveal>
              <CatastroComparison />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
          4. COMMODITIES / MARKETPLACE
         ───────────────────────────────────────────── */}
      <section id="commodities" className="border-b border-hairline bg-surface">
        <div className="max-w-7xl mx-auto px-5 py-16 sm:py-20">
          <Reveal>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
              <div>
                <Eyebrow className="mb-3">Trade de commodities</Eyebrow>
                <h2 className="brand-display text-3xl md:text-4xl text-content leading-tight">
                  Lotes de metales verificados.
                </h2>
                <p className="mt-3 text-content-muted max-w-2xl">
                  Cobre, oro, plata, litio y más. Cada ficha incluye ley, tonelaje, Incoterm, país
                  de origen y ensayos certificados por QP.
                </p>
              </div>
              <Link
                to="/marketplace"
                className="group inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-content hover:text-accent-brand transition-colors self-start md:self-end"
              >
                Ver marketplace completo
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </Reveal>
          <Reveal>
            <PublicCommodityLots />
          </Reveal>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
          5. CTA final
         ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-surface-inverse text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse at center, black 0%, transparent 70%)",
          }}
        />
        <div className="relative max-w-5xl mx-auto px-5 py-20 text-center">
          <p className="brand-eyebrow text-accent-brand-subtle mb-4">Comienza hoy</p>
          <h2 className="brand-display text-4xl md:text-5xl leading-[1.05] max-w-3xl mx-auto">
            Publica tu proyecto o solicita acceso como inversionista.
          </h2>
          <p className="mt-5 text-slate-400 max-w-2xl mx-auto">
            Onboarding en horas. Verificación KYC/AML. Sin costos de listing para proyectos y lotes
            iniciales.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/auth"
              search={{ intent: "owner", mode: "signup" }}
              className="group inline-flex items-center gap-2 h-12 px-7 bg-white text-black text-[11px] font-semibold uppercase tracking-[0.22em] rounded-sm hover:bg-[color:var(--gold)] transition-colors"
            >
              Publicar proyecto
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              to="/auth"
              search={{ intent: "investor", mode: "signup" }}
              className="inline-flex items-center gap-2 h-12 px-7 border border-white/25 text-white text-[11px] font-semibold uppercase tracking-[0.22em] rounded-sm hover:bg-white/5 transition-colors"
            >
              Soy inversionista
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
