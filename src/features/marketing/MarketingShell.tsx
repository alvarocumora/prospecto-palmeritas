import { Link } from "@tanstack/react-router";
import { ArrowRight, Mail, Linkedin, Link as LinkIcon } from "lucide-react";
import { useLocale, type Locale } from "@/features/marketing/i18n";
import logoMark from "@/assets/geocapitals-mark.png";

const NAV = [
  { to: "/proyectos", key: "nav_projects" as const },
  { to: "/inversionistas", key: "nav_investors" as const },
  { to: "/empresas", key: "nav_companies" as const },
  { to: "/recursos", key: "nav_resources" as const },
  { to: "/contacto", key: "nav_contact" as const },
] as const;

export function BrandMark({ className = "", dark = false }: { className?: string; dark?: boolean }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src={logoMark}
        alt="Geocapitals"
        width={36}
        height={36}
        className="h-9 w-9 object-contain"
      />
      <span
        className={`font-display text-[19px] tracking-[0.14em] font-bold ${
          dark ? "text-white" : "text-[var(--brand-navy-deep)]"
        }`}
      >
        GEOCAPITALS
      </span>
    </Link>
  );
}

function LangToggle() {
  const { locale, setLocale } = useLocale();
  const Btn = ({ value, label }: { value: Locale; label: string }) => (
    <button
      type="button"
      onClick={() => setLocale(value)}
      aria-pressed={locale === value}
      className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider transition ${
        locale === value
          ? "bg-[var(--brand-navy-deep)] text-white"
          : "text-[var(--brand-mute)] hover:text-[var(--brand-navy-deep)]"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="inline-flex items-center gap-0.5 border border-[var(--brand-hair)] rounded-md p-0.5 bg-white">
      <Btn value="es" label="ES" />
      <Btn value="en" label="EN" />
    </div>
  );
}

export function MarketingHeader() {
  const { t } = useLocale();
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-[var(--brand-hair)]">
      <div className="max-w-7xl mx-auto h-16 px-5 flex items-center gap-6">
        <BrandMark />
        <nav className="hidden md:flex items-center gap-6 text-sm text-[var(--brand-ink)]/80 ml-6">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="hover:text-[var(--brand-blue)] transition-colors"
              activeProps={{ className: "text-[var(--brand-blue)] font-medium" }}
            >
              {t(n.key)}
            </Link>
          ))}
        </nav>
        <div className="flex-1" />
        <LangToggle />
        <Link to="/auth" className="text-sm text-[var(--brand-ink)] hover:text-[var(--brand-blue)] hidden sm:inline">
          {t("cta_login")}
        </Link>
        <Link
          to="/auth"
          className="hidden sm:inline-flex items-center gap-1.5 text-sm bg-[var(--brand-blue)] text-white px-4 py-2 rounded-md hover:opacity-95 transition"
        >
          {t("cta_signup")} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="bg-[var(--brand-navy-deep)] text-white/70">
      <div className="max-w-7xl mx-auto px-5 py-10 grid md:grid-cols-4 gap-8 text-sm">
        <div className="md:col-span-2">
          <span className="inline-flex items-center gap-2.5">
            <img src={logoMark} alt="Geocapitals" width={36} height={36} className="h-9 w-9 object-contain" />
            <span className="font-display text-[18px] tracking-[0.14em] text-white font-bold">GEOCAPITALS</span>
          </span>
          <p className="mt-3 text-white/60 max-w-md text-[13px]">
            Infraestructura digital donde la exploración minera se encuentra con el capital institucional.
            Catastro, geología 3D, monitoreo satelital, NI 43-101 y deals en una sola plataforma.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-white/70">
            <a href="mailto:info@geocapitals.com" className="inline-flex items-center gap-2 hover:text-white">
              <Mail className="w-4 h-4 text-[var(--brand-gold)]" />
              <span>info@geocapitals.com</span>
            </a>
            <a href="https://www.linkedin.com/company/geocapitals" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-white">
              <Linkedin className="w-4 h-4 text-[var(--brand-gold)]" />
              <span>/company/geocapitals</span>
            </a>
            <a href="https://geocapitals.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-white">
              <LinkIcon className="w-4 h-4 text-[var(--brand-gold)]" />
              <span>geocapitals.com</span>
            </a>
          </div>
        </div>

        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--brand-gold)] mb-3">Plataforma</div>
          <ul className="space-y-2">
            <li><Link to="/terminal" className="hover:text-white">Terminal en vivo</Link></li>
            <li><Link to="/catastro" className="hover:text-white">Catastro público</Link></li>
            <li><Link to="/auth" className="hover:text-white">Iniciar sesión</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--brand-gold)] mb-3">Compañía</div>
          <ul className="space-y-2">
            <li><Link to="/recursos" className="hover:text-white">Recursos</Link></li>
            <li><Link to="/contacto" className="hover:text-white">Contacto</Link></li>
            <li><a href="mailto:info@geocapitals.com" className="hover:text-white">info@geocapitals.com</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-5 py-4 flex flex-col md:flex-row items-center justify-between gap-2 text-[11px] font-mono tracking-wider uppercase text-white/50">
          <span>Seguro · Transparente · Eficiente</span>
          <span>© {new Date().getFullYear()} Geocapitals</span>
        </div>
      </div>
    </footer>
  );
}

export function MarketingPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="brand-light min-h-screen flex flex-col">
      <MarketingHeader />
      <section className="border-b border-[var(--brand-hair)] bg-gradient-to-b from-[var(--brand-blue-soft)]/60 to-white">
        <div className="max-w-7xl mx-auto px-5 py-14 lg:py-20">
          {eyebrow && <p className="brand-eyebrow mb-4">{eyebrow}</p>}
          <h1 className="brand-display text-4xl md:text-5xl text-[var(--brand-navy-deep)] max-w-3xl leading-tight">
            {title}
          </h1>
          {intro && <p className="mt-4 text-lg text-[var(--brand-mute)] max-w-2xl">{intro}</p>}
        </div>
      </section>
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-5 py-14 lg:py-20">{children}</div>
      </main>
      <MarketingFooter />
    </div>
  );
}
