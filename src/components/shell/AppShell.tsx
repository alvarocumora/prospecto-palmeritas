import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Mail, Linkedin, Link as LinkIcon, Menu, X } from "lucide-react";
import { BrandButton, Eyebrow } from "@/components/brand";
import { useLocale, type Locale } from "@/features/marketing/i18n";
import { useAuth } from "@/hooks/useAuth";
import logoMark from "@/assets/geocapitals-mark.png";

/* ============================================================
 * AppShell — única gramática visual de la plataforma.
 * Variantes:
 *   - marketing : header blanco + footer navy (sitio público)
 *   - terminal  : top utility bar oscuro + ticker (terminal investor)
 *   - workspace : top bar minimal para /dashboard/* (wrapping only)
 * Todos comparten: BrandMark, LangToggle y la capa de tokens semánticos.
 * ============================================================ */

type NavItem = { to: string; label: string; desc: string };
const PILLARS: { label: string; items: NavItem[] }[] = [
  {
    label: "Inversión & Capital",
    items: [
      {
        to: "/proyectos",
        label: "Proyectos en explotación",
        desc: "Cholqui y Los Verdes · ronda SPV desde USD 15.000",
      },
      {
        to: "/inversionistas",
        label: "Cómo invertir",
        desc: "Ficha → simulación → KYC y firma → cartola",
      },
      {
        to: "/inversion-colateral",
        label: "Renta fija con colateral",
        desc: "UF + 12 % con parcela en garantía",
      },
    ],
  },
  {
    label: "Catastro & Inteligencia",
    items: [
      { to: "/catastro", label: "Catastro minero", desc: "Concesiones de Chile y LATAM" },
      {
        to: "/catastro/mapa",
        label: "Mapa interactivo",
        desc: "Concesiones, satélite y anomalías",
      },
      {
        to: "/terminal",
        label: "Terminal de proyectos",
        desc: "Ficha técnica, 2D y 3D por activo",
      },
    ],
  },
  {
    label: "Trade de Minerales",
    items: [
      { to: "/marketplace", label: "Lotes disponibles", desc: "Mineral y concentrados a la venta" },
      { to: "/rfqs", label: "Requerimientos", desc: "Compradores buscando mineral" },
      { to: "/inscripcion", label: "Ser proveedor", desc: "Publica tu producción" },
    ],
  },
  {
    label: "Institucional",
    items: [
      { to: "/empresas", label: "Para empresas", desc: "Titulares mineros y geólogos" },
      { to: "/catastro/precios", label: "Planes y precios", desc: "Membresías de la plataforma" },
      { to: "/recursos", label: "Recursos", desc: "Guías y documentación" },
      { to: "/contacto", label: "Contacto", desc: "Hablemos de tu proyecto" },
    ],
  },
];

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
            dark ? "text-white" : "text-content"
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
    const activeCls = tone === "dark" ? "bg-gold text-background" : "bg-surface-inverse text-white";
    const idleCls =
      tone === "dark" ? "text-white/60 hover:text-white" : "text-content-subtle hover:text-content";
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
  const container = tone === "dark" ? "border-white/15 bg-white/5" : "border-hairline bg-white";
  return (
    <div className={`inline-flex items-center gap-0.5 border rounded-md p-0.5 ${container}`}>
      <Btn value="es" label="ES" />
      <Btn value="en" label="EN" />
      <Btn value="pt" label="PT" />
    </div>
  );
}

/* -------------------- Marketing variant -------------------- */

export function MarketingHeader() {
  const { t } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-hairline">
      <div className="max-w-7xl mx-auto h-16 px-5 flex items-center gap-4">
        <BrandMark />
        <nav className="hidden xl:flex items-center gap-1 text-sm text-content/80 ml-4">
          {PILLARS.map((p) => (
            <div key={p.label} className="relative group">
              <button
                type="button"
                className="px-3 py-2 hover:text-accent-brand transition-colors whitespace-nowrap"
              >
                {p.label}
              </button>
              <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition absolute left-0 top-full pt-2 z-50">
                <div className="w-80 bg-white border border-hairline shadow-lg p-2">
                  {p.items.map((n) => (
                    <Link key={n.to} to={n.to} className="block px-3 py-2.5 hover:bg-surface">
                      <div className="text-sm text-content font-medium">{n.label}</div>
                      <div className="text-xs text-content-subtle">{n.desc}</div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </nav>
        <div className="flex-1" />
        <div className="hidden sm:inline-flex">
          <LangToggle />
        </div>
        <Link
          to="/auth"
          className="text-sm text-content hover:text-accent-brand hidden md:inline whitespace-nowrap"
        >
          Acceso clientes
        </Link>
        <BrandButton asChild size="sm" className="hidden sm:inline-flex">
          <Link to="/inversion-colateral">
            Simular inversión <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </BrandButton>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuOpen}
          className="xl:hidden inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-hairline text-content hover:border-accent-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand"
        >
          {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>
      {menuOpen && (
        <div className="xl:hidden border-t border-hairline bg-white max-h-[80vh] overflow-y-auto">
          <nav
            aria-label="Navegación móvil"
            className="max-w-7xl mx-auto px-5 py-3 flex flex-col text-sm"
          >
            {PILLARS.map((p) => (
              <div key={p.label} className="py-2 border-b border-hairline last:border-0">
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-content-subtle py-1">
                  {p.label}
                </div>
                {p.items.map((n) => (
                  <Link
                    key={n.to}
                    to={n.to}
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-11 items-center py-2 text-content hover:text-accent-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand"
                  >
                    {n.label}
                  </Link>
                ))}
              </div>
            ))}
            <div className="pt-3 flex items-center gap-3 sm:hidden">
              <LangToggle />
              <Link
                to="/auth"
                onClick={() => setMenuOpen(false)}
                className="text-sm text-content hover:text-accent-brand"
              >
                Acceso clientes
              </Link>
              <BrandButton asChild size="sm">
                <Link to="/inversion-colateral" onClick={() => setMenuOpen(false)}>
                  Simular inversión <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </BrandButton>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="bg-surface-inverse text-white/70">
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
              <Mail className="w-4 h-4 text-accent-brand-subtle" />
              <span>info@geocapitals.com</span>
            </a>
            <a
              href="https://www.linkedin.com/company/geocapitals"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 hover:text-white"
            >
              <Linkedin className="w-4 h-4 text-accent-brand-subtle" />
              <span>/company/geocapitals</span>
            </a>
            <a
              href="https://geocapitals.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 hover:text-white"
            >
              <LinkIcon className="w-4 h-4 text-accent-brand-subtle" />
              <span>geocapitals.com</span>
            </a>
          </div>
        </div>

        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-accent-brand-subtle mb-3">
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
              <Link to="/catastro/precios" className="hover:text-white">
                Planes y precios
              </Link>
            </li>
            <li>
              <Link to="/satelital" className="hover:text-white">
                Inteligencia satelital
              </Link>
            </li>
            <li>
              <Link to="/visor-3d" className="hover:text-white">
                Visor 3D
              </Link>
            </li>
            <li>
              <Link to="/marketplace" className="hover:text-white">
                Marketplace de commodities
              </Link>
            </li>
            <li>
              <Link to="/proyectos" className="hover:text-white">
                Proyectos en venta
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
          <div className="text-[11px] font-mono uppercase tracking-wider text-accent-brand-subtle mb-3">
            Compañía
          </div>
          <ul className="space-y-2">
            <li>
              <Link to="/recursos" className="hover:text-white">
                Recursos
              </Link>
            </li>
            <li>
              <Link to="/empresas" className="hover:text-white">
                Para empresas
              </Link>
            </li>
            <li>
              <Link to="/inscripcion" className="hover:text-white">
                Inscripción de proveedores
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
  subtitle = "Inversión y exploración · Chile",
  right,
}: {
  eyebrow?: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const { user } = useAuth();
  return (
    <div className="h-11 border-b border-hairline flex items-center px-4 gap-4 bg-surface/95 text-content backdrop-blur">
      <Link to="/terminal" className="inline-flex items-center gap-2">
        <BrandMark size={18} showText={false} />
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-accent-brand">
          {eyebrow}
        </span>
      </Link>
      {subtitle && (
        <span className="text-[10px] font-mono text-content-subtle hidden sm:inline">
          {subtitle}
        </span>
      )}
      <div className="flex-1" />
      {right ??
        (user ? (
          <Link
            to="/dashboard"
            className="text-[11px] font-mono text-content-muted hover:text-content"
          >
            Mi espacio →
          </Link>
        ) : (
          <Link
            to="/auth"
            className="text-[11px] font-mono px-2.5 py-1.5 rounded-brand-sm bg-accent-brand text-accent-brand-contrast hover:bg-im-cobalt-deep"
          >
            Ingresar
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
      <div
        data-theme="im-light"
        className="h-screen w-full flex flex-col bg-surface text-content overflow-hidden"
      >
        {topBar ?? <TerminalTopBar />}
        {children}
      </div>
    );
  }
  // workspace
  return (
    <div data-theme="im-light" className="min-h-screen flex flex-col bg-surface text-content">
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
      <section className="border-b border-hairline bg-gradient-to-b from-accent-brand-subtle/60 to-white">
        <div className="max-w-7xl mx-auto px-5 py-14 lg:py-20">
          {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
          <h1 className="brand-display text-4xl md:text-5xl text-content max-w-3xl leading-tight">
            {title}
          </h1>
          {intro && <p className="mt-4 text-lg text-content-subtle max-w-2xl">{intro}</p>}
        </div>
      </section>
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-5 py-14 lg:py-20">{children}</div>
      </main>
      <MarketingFooter />
    </div>
  );
}
