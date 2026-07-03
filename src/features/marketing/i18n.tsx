import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Locale = "es" | "en";

const STORAGE_KEY = "geocapitals.locale";

type Dict = Record<string, { es: string; en: string }>;

// eslint-disable-next-line react-refresh/only-export-components
export const STRINGS: Dict = {
  nav_projects: { es: "Proyectos", en: "Projects" },
  nav_marketplace: { es: "Marketplace", en: "Marketplace" },
  nav_investors: { es: "Inversionistas", en: "Investors" },
  nav_companies: { es: "Empresas", en: "Companies" },
  nav_resources: { es: "Resources", en: "Resources" },
  nav_contact: { es: "Contacto", en: "Contact" },
  cta_login: { es: "Iniciar sesión", en: "Sign in" },
  cta_signup: { es: "Registrarse", en: "Sign up" },
  hero_eyebrow: {
    es: "Plataforma inteligente de inversión y financiamiento",
    en: "Intelligent mining investment & financing platform",
  },
  hero_title: {
    es: "Conectamos proyectos mineros con capital",
    en: "Where mining projects meet global capital",
  },
  hero_sub: {
    es: "La infraestructura digital donde proyectos de minería se encuentran con inversionistas calificados de todo el mundo — sobre catastro, satélite y NI 43-101 en vivo.",
    en: "The digital infrastructure where mining projects meet qualified investors worldwide — built on live cadastre, satellite intelligence and NI 43-101.",
  },
  cta_publish: { es: "Publica tu proyecto", en: "Publish your project" },
  cta_explore: { es: "Explorar oportunidades", en: "Explore opportunities" },
  open_terminal: { es: "Abrir en Terminal", en: "Open in Terminal" },
  map_chip_live: { es: "GEOCAPITALS · LIVE MAP · CHILE", en: "GEOCAPITALS · LIVE MAP · CHILE" },
  map_mode_listings: { es: "Listados", en: "Listings" },
  map_mode_potential: { es: "Potencial", en: "Potential" },
  map_listings_hint: {
    es: "Proyectos disponibles para inversión",
    en: "Projects open for investment",
  },
  map_potential_hint: {
    es: "Concesiones, anomalías y yacimientos",
    en: "Concessions, anomalies & deposits",
  },
  map_browse_deals: { es: "Ver oportunidades", en: "Browse opportunities" },
};

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: keyof typeof STRINGS) => string;
};

const LocaleContext = createContext<Ctx | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("es");

  // hydrate from storage on client only — avoids SSR mismatch
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "es" || saved === "en") setLocaleState(saved);
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* localStorage unavailable */
    }
  };

  const t = (key: keyof typeof STRINGS) => STRINGS[key]?.[locale] ?? String(key);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLocale(): Ctx {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    // safe fallback when used outside the provider
    return { locale: "es", setLocale: () => {}, t: (k) => STRINGS[k]?.es ?? String(k) };
  }
  return ctx;
}
