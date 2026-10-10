import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Locale = "es" | "en" | "pt";

const STORAGE_KEY = "geocapitals.locale";
const LOCALES: Locale[] = ["es", "en", "pt"];

type Entry = { es: string; en: string; pt: string };
type Dict = Record<string, Entry>;

export const STRINGS = {
  nav_projects: { es: "Proyectos", en: "Projects", pt: "Projetos" },
  nav_marketplace: { es: "Marketplace", en: "Marketplace", pt: "Marketplace" },
  nav_catastro: { es: "Catastro", en: "Cadastre", pt: "Cadastro" },
  nav_pricing: { es: "Precios", en: "Pricing", pt: "Preços" },
  nav_investors: { es: "Inversionistas", en: "Investors", pt: "Investidores" },
  nav_companies: { es: "Empresas", en: "Companies", pt: "Empresas" },
  nav_resources: { es: "Recursos", en: "Resources", pt: "Recursos" },
  nav_suppliers: { es: "Ser proveedor", en: "Become supplier", pt: "Ser fornecedor" },
  nav_rfqs: { es: "Requerimientos", en: "RFQs", pt: "Requerimentos" },
  nav_contact: { es: "Contacto", en: "Contact", pt: "Contato" },
  cta_login: { es: "Iniciar sesión", en: "Sign in", pt: "Entrar" },
  cta_signup: { es: "Registrarse", en: "Sign up", pt: "Cadastrar-se" },
  hero_eyebrow: {
    es: "Deal-flow minero verificado · LatAm & África",
    en: "Verified mining deal-flow · LatAm & Africa",
    pt: "Deal-flow minerário verificado · LatAm & África",
  },
  hero_title: {
    es: "Capital inteligente para la nueva minería",
    en: "Smart capital for the new mining era",
    pt: "Capital inteligente para a nova mineração",
  },
  hero_sub: {
    es: "Invierte en proyectos mineros verificados con NI 43-101, catastro trazable y modelo económico listo para comité. Deal-flow calificado en LatAm y África.",
    en: "Invest in verified mining projects with NI 43-101, traceable cadastre and committee-ready economics. Qualified deal-flow across LatAm and Africa.",
    pt: "Invista em projetos minerários verificados com NI 43-101, cadastro rastreável e modelo econômico pronto para comitê. Deal-flow qualificado na LatAm e África.",
  },
  cta_publish: { es: "Ver oportunidades", en: "See opportunities", pt: "Ver oportunidades" },
  cta_explore: { es: "Abrir plataforma", en: "Open platform", pt: "Abrir plataforma" },

  open_terminal: { es: "Abrir en Terminal", en: "Open in Terminal", pt: "Abrir no Terminal" },
  map_chip_live: {
    es: "GEOCAPITALS · LIVE MAP · CHILE",
    en: "GEOCAPITALS · LIVE MAP · CHILE",
    pt: "GEOCAPITALS · LIVE MAP · CHILE",
  },
  map_mode_listings: { es: "Listados", en: "Listings", pt: "Listagens" },
  map_mode_potential: { es: "Potencial", en: "Potential", pt: "Potencial" },
  map_listings_hint: {
    es: "Proyectos disponibles para inversión",
    en: "Projects open for investment",
    pt: "Projetos disponíveis para investimento",
  },
  map_potential_hint: {
    es: "Concesiones, anomalías y yacimientos",
    en: "Concessions, anomalies & deposits",
    pt: "Concessões, anomalias e jazidas",
  },
  map_browse_deals: {
    es: "Ver oportunidades",
    en: "Browse opportunities",
    pt: "Ver oportunidades",
  },

  // --- Capa Catastral Universal (buscador multi-país) ---
  cad_universal_layer: {
    es: "Capa Catastral Universal",
    en: "Universal Cadastre Layer",
    pt: "Camada Cadastral Universal",
  },
  cad_search_button: { es: "Buscar", en: "Search", pt: "Buscar" },
  cad_source_unavailable: {
    es: "La fuente catastral no está disponible. No se pudo comprobar si existen resultados.",
    en: "The cadastre source is unavailable. Results could not be checked.",
    pt: "A fonte cadastral está indisponível. Não foi possível verificar os resultados.",
  },
  cad_retry: { es: "Reintentar", en: "Try again", pt: "Tentar novamente" },
  cad_loading: {
    es: "Consultando fuente catastral…",
    en: "Querying cadastre source…",
    pt: "Consultando fonte cadastral…",
  },
  cad_soon: { es: "pronto", en: "soon", pt: "em breve" },
  cad_results_live: {
    es: "resultado(s) · fuente {inst} en vivo",
    en: "result(s) · live from {inst}",
    pt: "resultado(s) · fonte {inst} ao vivo",
  },
  cad_no_results: {
    es: "Sin resultados para «{term}» en {country}. Prueba con otro término u otro país.",
    en: "No results for “{term}” in {country}. Try another term or country.",
    pt: "Sem resultados para «{term}» em {country}. Tente outro termo ou país.",
  },
  cad_col_concession: {
    es: "Concesión / proceso",
    en: "Concession / process",
    pt: "Concessão / processo",
  },
  cad_col_holder: { es: "Titular", en: "Holder", pt: "Titular" },
  cad_col_hectares: { es: "Hectáreas", en: "Hectares", pt: "Hectares" },
  cad_col_status: { es: "Estado", en: "Status", pt: "Situação" },
  cad_col_location: { es: "Ubicación", en: "Location", pt: "Localização" },
  cad_col_record: { es: "Ficha", en: "Record", pt: "Ficha" },
  cad_view_record: { es: "Ver ficha", en: "View record", pt: "Ver ficha" },
  cad_status_active: { es: "Vigente", en: "Active", pt: "Vigente" },
  cad_status_pending: { es: "En trámite", en: "Pending", pt: "Em tramitação" },
  cad_status_extinct: { es: "Extinta", en: "Extinct", pt: "Extinta" },
  cad_status_unknown: { es: "Sin clasificar", en: "Unclassified", pt: "Sem classificação" },
  cad_ph_cl: {
    es: "Titular, nombre de concesión o rol…",
    en: "Holder, concession name or roll number…",
    pt: "Titular, nome da concessão ou rol…",
  },
  cad_ph_pe: {
    es: "Titular, nombre de concesión o código único…",
    en: "Holder, concession name or unique code…",
    pt: "Titular, nome da concessão ou código único…",
  },
  cad_ph_zm: {
    es: "Titular, código de licencia o commodity (copper, cobalt…)…",
    en: "Holder, licence code or commodity (copper, cobalt…)…",
    pt: "Titular, código da licença ou commodity (copper, cobalt…)…",
  },
  cad_ph_br: {
    es: "Titular, sustancia (ferro, ouro…) o nº de processo…",
    en: "Holder, substance (iron, gold…) or process number…",
    pt: "Titular, substância (ferro, ouro…) ou nº do processo…",
  },
} satisfies Dict;

export type StringKey = keyof typeof STRINGS;

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: StringKey) => string;
};

const LocaleContext = createContext<Ctx | null>(null);

function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as string[]).includes(v);
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("es");

  // hydrate from storage on client only — avoids SSR mismatch
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (isLocale(saved)) setLocaleState(saved);
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

  const t = (key: StringKey) => STRINGS[key]?.[locale] ?? String(key);

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

/** Interpolación simple de plantillas: fill("hola {name}", { name: "x" }). */
// eslint-disable-next-line react-refresh/only-export-components
export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}
