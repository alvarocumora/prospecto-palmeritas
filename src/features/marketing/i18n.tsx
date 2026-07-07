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
  nav_resources: { es: "Recursos", en: "Resources" },
  nav_contact: { es: "Contacto", en: "Contact" },
  cta_login: { es: "Iniciar sesión", en: "Sign in" },
  cta_signup: { es: "Registrarse", en: "Sign up" },
  hero_eyebrow: {
    es: "Deal-flow minero verificado · LatAm & África",
    en: "Verified mining deal-flow · LatAm & Africa",
  },
  hero_title: {
    es: "Capital inteligente para la nueva minería",
    en: "Smart capital for the new mining era",
  },
  hero_sub: {
    es: "Invierte en proyectos mineros verificados con NI 43-101, catastro trazable y modelo económico listo para comité. Deal-flow calificado en LatAm y África.",
    en: "Invest in verified mining projects with NI 43-101, traceable cadastre and committee-ready economics. Qualified deal-flow across LatAm and Africa.",
  },
  cta_publish: { es: "Ver oportunidades", en: "See opportunities" },
  cta_explore: { es: "Abrir plataforma", en: "Open platform" },

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
