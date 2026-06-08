import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Mountain, Users, Globe2, ShieldCheck, FilePlus2, LineChart, Lock,
  ArrowRight, CheckCircle2, Mail, Linkedin, Link as LinkIcon,
  Coins, Layers, Zap, Gem, FileText, Handshake, TrendingUp,
} from "lucide-react";

type Lang = "es" | "en";

function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLang] = useState<Lang>("es");
  useEffect(() => {
    try {
      const stored = localStorage.getItem("gc:lang") as Lang | null;
      if (stored === "es" || stored === "en") setLang(stored);
    } catch {}
  }, []);
  const update = (l: Lang) => {
    setLang(l);
    try { localStorage.setItem("gc:lang", l); } catch {}
    if (typeof document !== "undefined") document.documentElement.lang = l;
  };
  return [lang, update];
}

const t = {
  es: {
    nav: ["Proyectos", "Inversionistas", "Empresas", "Recursos"],
    signin: "Iniciar sesión",
    signup: "Registrarse",
    heroEy: "Plataforma inteligente de inversión y financiamiento",
    heroH: "Conectamos proyectos mineros con capital",
    heroP: "La infraestructura digital donde proyectos de minería se encuentran con inversionistas calificados de todo el mundo.",
    ctaOwner: "Publica tu proyecto",
    ctaInv: "Explorar oportunidades",
    pillars: [
      { i: Mountain, t: "Proyectos de calidad", s: "Verificados y calificados" },
      { i: Users, t: "Inversionistas globales", s: "Red de capital institucional" },
      { i: Globe2, t: "Oportunidades reales", s: "Activos auditados" },
      { i: ShieldCheck, t: "Proceso seguro", s: "Transparente y auditable" },
    ],
    ownersH: "Para propietarios de proyectos",
    ownersP: "Publica tu proyecto y conéctate con inversionistas calificados de todo el mundo.",
    ownersItems: [
      { i: FilePlus2, t: "Publica tu proyecto", s: "Crea un perfil profesional y muestra el potencial técnico y económico." },
      { i: Users, t: "Accede a inversionistas", s: "Recibe interés de inversionistas estratégicos y fondos globales." },
      { i: LineChart, t: "Gestiona el proceso", s: "Herramientas seguras para seguimiento, comunicación y documentación." },
      { i: Lock, t: "Transparencia y seguridad", s: "Protegemos tu información y facilitamos negociaciones confiables." },
    ],
    process: ["Publica", "Conecta", "Negocia", "Cierra y crece"],
    typesH: "Tipos de proyectos",
    typesItems: [
      { i: Coins, t: "Metales preciosos" },
      { i: Layers, t: "Metales base" },
      { i: Zap, t: "Litio y minerales críticos" },
      { i: Gem, t: "Energía y otros" },
    ],
    netH: "Nuestra red global",
    stats: [
      { v: "+124", l: "Proyectos activos" },
      { v: "+312", l: "Inversionistas" },
      { v: "18", l: "Países" },
    ],
    valueH: "Creamos valor para todos",
    valueP: "Facilitamos conexiones que impulsan proyectos mineros sostenibles y generan valor a largo plazo.",
    invH: "Para inversionistas",
    invP: "Encuentra oportunidades únicas y diversifica tu portafolio con acceso a proyectos verificados.",
    invItems: [
      "Acceso a proyectos calificados",
      "Información técnica y financiera",
      "Herramientas de análisis y filtrado",
      "Comunicación directa y segura",
    ],
    joinH: "Únete a Geocapitals hoy",
    joinP: "La plataforma donde proyectos mineros y capital se encuentran.",
    footer: "Seguro · Transparente · Eficiente",
  },
  en: {
    nav: ["Projects", "Investors", "Companies", "Resources"],
    signin: "Sign in",
    signup: "Sign up",
    heroEy: "Smart investment and financing platform",
    heroH: "Connecting mining projects with capital",
    heroP: "The digital infrastructure where mining projects meet qualified investors from around the world.",
    ctaOwner: "List your project",
    ctaInv: "Explore opportunities",
    pillars: [
      { i: Mountain, t: "Quality projects", s: "Verified and qualified" },
      { i: Users, t: "Global investors", s: "Institutional capital network" },
      { i: Globe2, t: "Real opportunities", s: "Audited assets" },
      { i: ShieldCheck, t: "Secure process", s: "Transparent and auditable" },
    ],
    ownersH: "For project owners",
    ownersP: "List your project and connect with qualified investors from around the world.",
    ownersItems: [
      { i: FilePlus2, t: "List your project", s: "Create a professional profile and showcase technical and economic potential." },
      { i: Users, t: "Access investors", s: "Receive interest from strategic investors and global funds." },
      { i: LineChart, t: "Manage the process", s: "Secure tools for tracking, communication and documentation." },
      { i: Lock, t: "Transparency & security", s: "We protect your information and enable trustworthy negotiations." },
    ],
    process: ["List", "Connect", "Negotiate", "Close & grow"],
    typesH: "Types of projects",
    typesItems: [
      { i: Coins, t: "Precious metals" },
      { i: Layers, t: "Base metals" },
      { i: Zap, t: "Lithium & critical minerals" },
      { i: Gem, t: "Energy & other" },
    ],
    netH: "Our global network",
    stats: [
      { v: "+124", l: "Active projects" },
      { v: "+312", l: "Investors" },
      { v: "18", l: "Countries" },
    ],
    valueH: "We create value for everyone",
    valueP: "We facilitate connections that drive sustainable mining projects and generate long-term value.",
    invH: "For investors",
    invP: "Find unique opportunities and diversify your portfolio with access to verified projects.",
    invItems: [
      "Access to qualified projects",
      "Technical and financial information",
      "Analysis and filtering tools",
      "Direct and secure communication",
    ],
    joinH: "Join Geocapitals today",
    joinP: "The platform where mining projects and capital come together.",
    footer: "Secure · Transparent · Efficient",
  },
};

function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="grid place-items-center w-9 h-9 rounded-full bg-[var(--brand-blue)] text-white font-display text-lg leading-none">
        G
      </span>
      <span className="font-display text-[19px] tracking-tight text-[var(--brand-navy-deep)]">
        GEOCAPITALS
      </span>
    </span>
  );
}

export function MarketingLanding() {
  const [lang, setLang] = useLang();
  const c = t[lang];

  return (
    <div className="brand-light min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-[var(--brand-hair)]">
        <div className="max-w-7xl mx-auto h-16 px-5 flex items-center gap-6">
          <BrandMark />
          <nav className="hidden md:flex items-center gap-6 text-sm text-[var(--brand-ink)]/80 ml-6">
            {c.nav.map((n, i) => (
              <a key={i} href={`#section-${i}`} className="hover:text-[var(--brand-blue)] transition-colors">
                {n}
              </a>
            ))}
          </nav>
          <div className="flex-1" />
          <div className="flex items-center gap-1 text-[11px] font-mono border border-[var(--brand-hair)] rounded-full p-0.5">
            {(["es", "en"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-2.5 py-1 rounded-full uppercase transition ${
                  lang === l ? "bg-[var(--brand-navy)] text-white" : "text-[var(--brand-mute)]"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <Link to="/auth" className="text-sm text-[var(--brand-ink)] hover:text-[var(--brand-blue)]">
            {c.signin}
          </Link>
          <Link
            to="/auth"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm bg-[var(--brand-blue)] text-white px-4 py-2 rounded-md hover:opacity-95 transition"
          >
            {c.signup} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[var(--brand-hair)]">
        <div className="max-w-7xl mx-auto px-5 py-20 lg:py-28 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="brand-eyebrow mb-5">{c.heroEy}</p>
            <h1 className="brand-display text-[44px] sm:text-[56px] leading-[1.05] text-[var(--brand-navy-deep)]">
              {c.heroH}
            </h1>
            <p className="mt-6 text-lg text-[var(--brand-mute)] max-w-xl">{c.heroP}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 bg-[var(--brand-blue)] text-white px-5 py-3 rounded-md text-sm font-medium hover:opacity-95"
              >
                {c.ctaOwner} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/terminal"
                className="inline-flex items-center gap-2 border border-[var(--brand-navy)] text-[var(--brand-navy)] px-5 py-3 rounded-md text-sm font-medium hover:bg-[var(--brand-blue-soft)]"
              >
                {c.ctaInv}
              </Link>
            </div>
            <div className="mt-10 flex items-center gap-8 text-xs font-mono text-[var(--brand-mute)]">
              <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[var(--brand-blue)]" /> KYC / AML</span>
              <span className="flex items-center gap-2"><FileText className="w-4 h-4 text-[var(--brand-blue)]" /> NI 43-101</span>
              <span className="flex items-center gap-2"><Globe2 className="w-4 h-4 text-[var(--brand-blue)]" /> 18 países</span>
            </div>
          </div>

          {/* Hero card mock */}
          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-to-br from-[var(--brand-blue-soft)] to-transparent rounded-3xl -z-10" />
            <div className="rounded-2xl border border-[var(--brand-hair)] bg-white shadow-[0_30px_60px_-30px_rgba(11,42,91,0.25)] overflow-hidden">
              <div className="h-9 bg-[var(--brand-navy-deep)] flex items-center px-3 gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                <span className="ml-3 text-[10px] font-mono text-white/60 tracking-widest">GEOCAPITALS · TERMINAL</span>
              </div>
              <div className="p-5 grid grid-cols-3 gap-3">
                {c.stats.map((s) => (
                  <div key={s.l} className="rounded-lg bg-[var(--brand-blue-soft)] p-3">
                    <div className="font-mono text-2xl text-[var(--brand-navy-deep)]">{s.v}</div>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--brand-mute)] mt-1">{s.l}</div>
                  </div>
                ))}
              </div>
              <div className="px-5 pb-5">
                <div className="rounded-lg border border-[var(--brand-hair)] divide-y divide-[var(--brand-hair)]">
                  {[
                    { code: "AND-0021", commodity: "Cu", stage: "Exploración", v: "+4.2%" },
                    { code: "LAN-0184", commodity: "Au", stage: "Pre-feasibility", v: "+1.8%" },
                    { code: "ALT-0312", commodity: "Li", stage: "Facilidad", v: "+9.1%" },
                  ].map((r) => (
                    <div key={r.code} className="flex items-center px-3 py-2.5 text-sm">
                      <span className="font-mono text-xs text-[var(--brand-navy-deep)] w-24">{r.code}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-[var(--brand-navy)] text-white font-mono">{r.commodity}</span>
                      <span className="ml-3 text-[var(--brand-mute)] flex-1">{r.stage}</span>
                      <span className="font-mono text-xs text-emerald-600">{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars band */}
      <section id="section-0" className="bg-[var(--brand-navy-deep)] text-white">
        <div className="max-w-7xl mx-auto px-5 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          {c.pillars.map(({ i: Icon, t: title, s }) => (
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

      {/* For owners + process */}
      <section id="section-1" className="max-w-7xl mx-auto px-5 py-20 grid lg:grid-cols-[1fr_320px_1fr] gap-10 items-start">
        <div>
          <h2 className="brand-display text-3xl text-[var(--brand-navy-deep)]">{c.ownersH}</h2>
          <p className="mt-3 text-[var(--brand-mute)] max-w-md">{c.ownersP}</p>
          <ul className="mt-8 space-y-6">
            {c.ownersItems.map(({ i: Icon, t: title, s }) => (
              <li key={title} className="flex gap-4">
                <span className="grid place-items-center w-10 h-10 rounded-full bg-[var(--brand-blue)] text-white shrink-0">
                  <Icon className="w-5 h-5" strokeWidth={2} />
                </span>
                <div>
                  <div className="font-display text-[15px] text-[var(--brand-navy-deep)]">{title}</div>
                  <div className="text-sm text-[var(--brand-mute)] mt-1">{s}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Process circle */}
        <div className="relative hidden lg:block aspect-square">
          <svg viewBox="0 0 320 320" className="absolute inset-0 w-full h-full">
            <circle cx="160" cy="160" r="120" fill="none" stroke="var(--brand-hair)" strokeWidth="1" strokeDasharray="4 6" />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="grid place-items-center w-24 h-24 rounded-full bg-[var(--brand-blue-soft)] border border-[var(--brand-blue)]/20">
              <span className="font-display text-4xl text-[var(--brand-blue)]">G</span>
            </div>
          </div>
          {[
            { x: "50%", y: "8%", icon: FilePlus2, label: c.process[0] },
            { x: "92%", y: "50%", icon: Handshake, label: c.process[1] },
            { x: "50%", y: "92%", icon: TrendingUp, label: c.process[2] },
            { x: "8%", y: "50%", icon: ShieldCheck, label: c.process[3] },
          ].map(({ x, y, icon: Icon, label }) => (
            <div
              key={label}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
              style={{ left: x, top: y }}
            >
              <span className="grid place-items-center w-14 h-14 rounded-full bg-white border border-[var(--brand-hair)] shadow-sm">
                <Icon className="w-5 h-5 text-[var(--brand-blue)]" />
              </span>
              <span className="mt-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--brand-mute)] text-center max-w-[80px]">
                {label}
              </span>
            </div>
          ))}
        </div>

        <div>
          <h2 className="brand-display text-3xl text-[var(--brand-navy-deep)]">{c.invH}</h2>
          <p className="mt-3 text-[var(--brand-mute)] max-w-md">{c.invP}</p>
          <ul className="mt-8 space-y-3">
            {c.invItems.map((it) => (
              <li key={it} className="flex items-start gap-2.5 text-[15px] text-[var(--brand-ink)]">
                <CheckCircle2 className="w-5 h-5 text-[var(--brand-blue)] shrink-0 mt-0.5" />
                {it}
              </li>
            ))}
          </ul>
          <Link
            to="/terminal"
            className="mt-8 inline-flex items-center gap-2 text-[var(--brand-blue)] font-medium hover:underline"
          >
            {c.ctaInv} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Types + global network */}
      <section id="section-2" className="bg-[var(--brand-blue-soft)] border-y border-[var(--brand-hair)]">
        <div className="max-w-7xl mx-auto px-5 py-16 grid lg:grid-cols-2 gap-12">
          <div>
            <p className="brand-eyebrow mb-4">{c.typesH}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {c.typesItems.map(({ i: Icon, t: title }) => (
                <div key={title} className="bg-white rounded-xl border border-[var(--brand-hair)] p-4 text-center">
                  <Icon className="w-7 h-7 text-[var(--brand-blue)] mx-auto" strokeWidth={1.5} />
                  <div className="mt-2 text-xs font-medium text-[var(--brand-navy-deep)] leading-tight">{title}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="brand-eyebrow mb-4">{c.netH}</p>
            <div className="grid grid-cols-3 gap-4">
              {c.stats.map((s) => (
                <div key={s.l} className="bg-white rounded-xl border border-[var(--brand-hair)] p-5">
                  <div className="font-mono text-3xl text-[var(--brand-navy-deep)]">{s.v}</div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--brand-mute)] mt-2">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Value band */}
      <section id="section-3" className="bg-[var(--brand-navy-deep)] text-white">
        <div className="max-w-7xl mx-auto px-5 py-14 flex flex-col md:flex-row items-start md:items-center gap-6">
          <ShieldCheck className="w-12 h-12 text-[var(--brand-gold)] shrink-0" strokeWidth={1.5} />
          <div className="flex-1">
            <h3 className="font-display text-2xl">{c.valueH}</h3>
            <p className="text-white/70 mt-2 max-w-2xl">{c.valueP}</p>
          </div>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 bg-white text-[var(--brand-navy-deep)] px-5 py-3 rounded-md text-sm font-medium hover:bg-[var(--brand-gold)] transition"
          >
            {c.ctaOwner} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Join */}
      <section className="max-w-7xl mx-auto px-5 py-16 grid md:grid-cols-[auto_1fr_auto] gap-8 items-center">
        <div className="w-28 h-28 bg-[var(--brand-navy-deep)] rounded-xl grid place-items-center">
          <div className="grid grid-cols-5 gap-px w-20 h-20">
            {Array.from({ length: 25 }).map((_, i) => (
              <span
                key={i}
                className="bg-white"
                style={{ opacity: ((i * 37) % 7) > 2 ? 1 : 0.05 }}
              />
            ))}
          </div>
        </div>
        <div>
          <h3 className="brand-display text-2xl text-[var(--brand-navy-deep)]">{c.joinH}</h3>
          <p className="text-[var(--brand-mute)] mt-2">{c.joinP}</p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--brand-ink)]">
            <span className="inline-flex items-center gap-2"><LinkIcon className="w-4 h-4 text-[var(--brand-blue)]" /> geocapitals.com</span>
            <span className="inline-flex items-center gap-2"><Mail className="w-4 h-4 text-[var(--brand-blue)]" /> info@geocapitals.com</span>
            <span className="inline-flex items-center gap-2"><Linkedin className="w-4 h-4 text-[var(--brand-blue)]" /> /company/geocapitals</span>
          </div>
        </div>
        <Link
          to="/auth"
          className="inline-flex items-center gap-2 bg-[var(--brand-blue)] text-white px-6 py-3 rounded-md font-medium"
        >
          {c.signup} <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="bg-[var(--brand-navy-deep)] text-white/70">
        <div className="max-w-7xl mx-auto px-5 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs font-mono tracking-wider uppercase">
          <BrandMark className="[&_span:last-child]:text-white" />
          <span>{c.footer}</span>
          <span>© {new Date().getFullYear()} Geocapitals</span>
        </div>
      </footer>
    </div>
  );
}
