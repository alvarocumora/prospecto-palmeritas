import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Mail, Linkedin, Link as LinkIcon, Menu, X } from "lucide-react";
import { useLocale, type Locale } from "@/features/marketing/i18n";
import { useAuth } from "@/hooks/useAuth";
import logoMark from "@/assets/geocapitals-mark.png";

/* ============================================================
 * AppShell — única gramática visual de la plataforma.
 * Variantes:
 *   - marketing : header blanco + footer navy (sitio público)
 *   - terminal  : top utility bar oscuro + ticker (terminal investor)
 *   - workspace : top bar minimal para /dashboard/* (wrapping only)
 * Todos comparten: BrandMark, LangToggle, tokens --brand-*.
 * ============================================================ */

const NAV = [
  { to: "/proyectos", key: "nav_projects" as const },
  { to: "/inversionistas", key: "nav_investors" as const },
  { to: "/empresas", key: "nav_companies" as const },
  { to: "/recursos", key: "nav_resources" as const },
  { to: "/contacto", key: "nav_contact" as const },
] as const;

export function BrandMark({
  className = "",
  dark = false,
  size = 36,
  showText = true,
}: {
  className?: string;
  dark?: boolean;
  size?: number;
  showText?: boolean;
}) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src={logoMark}
        alt="Geocapitals"
        width={size}
        height={size}
        className="object-contain"
        style={{ width: size, height: size }}
      />
      {showText && (
        <span
          className={`font-display text-[19px] tracking-[0.14em] font-bold ${
            dark ? "text-white" : "text-[var(--brand-navy-deep)]"
          }`}
        >
          GEOCAPITALS
        </span>
      )}
    </Link>
  );
}

export function LangToggle({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { locale, setLocale } = useLocale();
  const Btn = ({ value, label }: { value: Locale; label: string }) => {
    const active = locale === value;
    const activeCls =
      tone === "dark"
        ? "bg-[var(--brand-gold)] text-[var(--brand-navy-deep)]"
        : "bg-[var(--brand-navy-deep)] text-white";
    const idleCls =
      tone === "dark"
        ? "text-white/60 hover:text-white"
        : "text-[var(--brand-mute)] hover:text-[var(--brand-navy-deep)]";
    return (
      <button
        type="button"
        onClick={() => setLocale(value)}
        aria-pressed={active}
        className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider transition ${
          active ? activeCls : idleCls
        }`}
      >
        {label}
      </button>
    );
  };
  const container =
    tone === "dark" ? "border-white/15 bg-white/5" : "border-[var(--brand-hair)] bg-white";
  return (
    <div className={`inline-flex items-center gap-0.5 border rounded-md p-0.5 ${container}`}>
      <Btn value="es" label="ES" />
      <Btn value="en" label="EN" />
    </div>
  );
}

/* -------------------- Marketing variant -------------------- */

export function MarketingHeader() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Sombra sutil al hacer scroll para separar el header del contenido.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Bloquea el scroll del body mientras el menú móvil está abierto.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Cierra el menú al cruzar al breakpoint desktop (md): de lo contrario el panel
  // queda oculto por CSS pero `open` sigue true y el body-lock no se libera.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <>
      <header
        className={`sticky top-0 z-50 bg-white/85 backdrop-blur-md transition-shadow ${
          scrolled
            ? "border-b border-[var(--brand-hair)] shadow-[0_8px_24px_-18px_rgba(11,42,91,0.45)]"
            : "border-b border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto h-16 px-5 flex items-center gap-6">
          <BrandMark />
          <nav className="hidden md:flex items-center gap-6 text-sm text-[var(--brand-ink)]/80 ml-6">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="relative py-1 hover:text-[var(--brand-blue)] transition-colors after:absolute after:left-0 after:-bottom-0.5 after:h-0.5 after:w-0 after:bg-[var(--brand-blue)] after:transition-[width] hover:after:w-full"
                activeProps={{
                  className: "text-[var(--brand-blue)] font-medium after:w-full",
                }}
              >
                {t(n.key)}
              </Link>
            ))}
          </nav>
          <div className="flex-1" />
          <LangToggle />
          <Link
            to="/auth"
            className="text-sm text-[var(--brand-ink)] hover:text-[var(--brand-blue)] hidden sm:inline"
          >
            {t("cta_login")}
          </Link>
          <Link
            to="/auth"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm bg-[var(--brand-blue)] text-white px-4 py-2 rounded-md hover:opacity-95 hover:shadow-[0_10px_24px_-12px_var(--brand-blue)] transition"
          >
            {t("cta_signup")} <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          {/* Botón hamburguesa — solo móvil */}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="md:hidden grid place-items-center w-10 h-10 -mr-2 rounded-md text-[var(--brand-navy-deep)] hover:bg-[var(--brand-blue-soft)] transition"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Panel de navegación móvil — fuera del <header> con backdrop-blur para que
          su posición `fixed` se mida contra el viewport y no contra el header. */}
      {open && (
        <div
          id="mobile-nav"
          className="md:hidden fixed inset-x-0 top-16 bottom-0 z-40 bg-white border-t border-[var(--brand-hair)] overflow-y-auto"
        >
          <nav className="px-5 py-4 flex flex-col">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="py-3.5 text-[15px] text-[var(--brand-ink)] border-b border-[var(--brand-hair)] flex items-center justify-between hover:text-[var(--brand-blue)] transition-colors"
                activeProps={{ className: "text-[var(--brand-blue)] font-medium" }}
              >
                {t(n.key)}
                <ArrowRight className="w-4 h-4 text-[var(--brand-mute)]" />
              </Link>
            ))}
            <div className="mt-6 flex flex-col gap-3">
              <Link
                to="/auth"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center gap-2 bg-[var(--brand-blue)] text-white px-5 py-3 rounded-md text-sm font-medium"
              >
                {t("cta_signup")} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/auth"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center gap-2 border border-[var(--brand-navy)] text-[var(--brand-navy)] px-5 py-3 rounded-md text-sm font-medium"
              >
                {t("cta_login")}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}

export function MarketingFooter() {
  return (
    <footer className="bg-[var(--brand-navy-deep)] text-white/70">
      <div className="max-w-7xl mx-auto px-5 py-10 grid md:grid-cols-4 gap-8 text-sm">
        <div className="md:col-span-2">
          <BrandMark dark />
          <p className="mt-3 text-white/60 max-w-md text-[13px]">
            Infraestructura digital donde la exploración minera se encuentra con el capital
            institucional. Catastro, geología 3D, monitoreo satelital, NI 43-101 y deals en una sola
            plataforma.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-white/70">
            <a
              href="mailto:info@geocapitals.com"
              className="inline-flex items-center gap-2 hover:text-white"
            >
              <Mail className="w-4 h-4 text-[var(--brand-gold)]" />
              <span>info@geocapitals.com</span>
            </a>
            <a
              href="https://www.linkedin.com/company/geocapitals"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 hover:text-white"
            >
              <Linkedin className="w-4 h-4 text-[var(--brand-gold)]" />
              <span>/company/geocapitals</span>
            </a>
            <a
              href="https://geocapitals.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 hover:text-white"
            >
              <LinkIcon className="w-4 h-4 text-[var(--brand-gold)]" />
              <span>geocapitals.com</span>
            </a>
          </div>
        </div>

        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--brand-gold)] mb-3">
            Plataforma
          </div>
          <ul className="space-y-2">
            <li>
              <Link to="/terminal" className="hover:text-white">
                Terminal en vivo
              </Link>
            </li>
            <li>
              <Link to="/catastro" className="hover:text-white">
                Catastro público
              </Link>
            </li>
            <li>
              <Link to="/auth" className="hover:text-white">
                Iniciar sesión
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--brand-gold)] mb-3">
            Compañía
          </div>
          <ul className="space-y-2">
            <li>
              <Link to="/recursos" className="hover:text-white">
                Recursos
              </Link>
            </li>
            <li>
              <Link to="/contacto" className="hover:text-white">
                Contacto
              </Link>
            </li>
            <li>
              <a href="mailto:info@geocapitals.com" className="hover:text-white">
                info@geocapitals.com
              </a>
            </li>
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

/* -------------------- Terminal variant -------------------- */

export function TerminalTopBar({
  eyebrow = "Geocapitals Terminal",
  subtitle = "Mining Investment Desk · CL",
  right,
}: {
  eyebrow?: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const { user } = useAuth();
  return (
    <div className="h-10 border-b border-border flex items-center px-3 gap-4 bg-card/40">
      <Link to="/" className="inline-flex items-center gap-2">
        <BrandMark size={18} showText={false} />
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--brand-gold)]">
          {eyebrow}
        </span>
      </Link>
      {subtitle && (
        <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">
          {subtitle}
        </span>
      )}
      <div className="flex-1" />
      {right ??
        (user ? (
          <Link
            to="/dashboard"
            className="text-[11px] font-mono text-muted-foreground hover:text-foreground"
          >
            Workspace →
          </Link>
        ) : (
          <Link
            to="/auth"
            className="text-[11px] font-mono px-2 py-1 rounded bg-[var(--brand-gold)] text-[var(--brand-navy-deep)] hover:opacity-90"
          >
            Sign in
          </Link>
        ))}
    </div>
  );
}

/* -------------------- AppShell wrapper -------------------- */

type Variant = "marketing" | "terminal" | "workspace";

export function AppShell({
  variant,
  children,
  topBar,
}: {
  variant: Variant;
  children: React.ReactNode;
  topBar?: React.ReactNode;
}) {
  if (variant === "marketing") {
    return (
      <div className="brand-light min-h-screen flex flex-col">
        <MarketingHeader />
        <main className="flex-1">{children}</main>
        <MarketingFooter />
      </div>
    );
  }
  if (variant === "terminal") {
    return (
      <div className="h-screen w-full flex flex-col bg-background text-foreground overflow-hidden">
        {topBar ?? <TerminalTopBar />}
        {children}
      </div>
    );
  }
  // workspace
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {topBar}
      <main className="flex-1 min-h-0">{children}</main>
    </div>
  );
}

/* Page helper used by marketing inner pages */
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
      <section className="relative overflow-hidden border-b border-[var(--brand-hair)] bg-gradient-to-b from-[var(--brand-blue-soft)]/60 to-white">
        {/* Grid decorativo sutil */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.5] pointer-events-none [mask-image:linear-gradient(to_bottom,black,transparent)]"
          style={{
            backgroundImage:
              "linear-gradient(var(--brand-hair) 1px, transparent 1px), linear-gradient(90deg, var(--brand-hair) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-5 py-14 lg:py-20">
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
