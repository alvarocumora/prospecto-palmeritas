// Etiquetas y helpers de presentación para el marketplace de commodities.

export const COUNTRIES: Record<string, { name: string; flag: string }> = {
  CL: { name: "Chile", flag: "🇨🇱" },
  PE: { name: "Perú", flag: "🇵🇪" },
  BR: { name: "Brasil", flag: "🇧🇷" },
  CO: { name: "Colombia", flag: "🇨🇴" },
  VE: { name: "Venezuela", flag: "🇻🇪" },
  AR: { name: "Argentina", flag: "🇦🇷" },
  EC: { name: "Ecuador", flag: "🇪🇨" },
  BO: { name: "Bolivia", flag: "🇧🇴" },
  MX: { name: "México", flag: "🇲🇽" },
  ZA: { name: "Sudáfrica", flag: "🇿🇦" },
  CD: { name: "R. D. Congo", flag: "🇨🇩" },
  ZM: { name: "Zambia", flag: "🇿🇲" },
  GH: { name: "Ghana", flag: "🇬🇭" },
  MA: { name: "Marruecos", flag: "🇲🇦" },
  NA: { name: "Namibia", flag: "🇳🇦" },
};

export const COMMODITIES: Record<string, { label: string; short: string; color: string }> = {
  cu_concentrate: { label: "Concentrado de cobre", short: "Cu conc.", color: "#B87333" },
  cu_cathode: { label: "Cátodos de cobre", short: "Cu cátodos", color: "#B87333" },
  zn_concentrate: { label: "Concentrado de zinc", short: "Zn conc.", color: "#7A8B99" },
  pb_concentrate: { label: "Concentrado de plomo", short: "Pb conc.", color: "#5A6470" },
  au_dore: { label: "Doré de oro", short: "Au doré", color: "#D4AF37" },
  au_bullion: { label: "Oro refinado (bullion)", short: "Au bullion", color: "#D4AF37" },
  ag_dore: { label: "Doré de plata", short: "Ag doré", color: "#C0C0C0" },
  rare_earths: { label: "Tierras raras", short: "REE", color: "#8E44AD" },
  li_carbonate: { label: "Carbonato de litio", short: "Li₂CO₃", color: "#D46BFF" },
  li_spodumene: { label: "Espodumeno de litio", short: "Li spod.", color: "#D46BFF" },
  fe_ore: { label: "Mineral de hierro", short: "Fe ore", color: "#9B3B1F" },
  sn_concentrate: { label: "Concentrado de estaño", short: "Sn conc.", color: "#8A8A8A" },
  mo_concentrate: { label: "Concentrado de molibdeno", short: "Mo conc.", color: "#00D4FF" },
  co_hydroxide: { label: "Hidróxido de cobalto", short: "Co(OH)₂", color: "#3B6EF5" },
  ni_sulphate: { label: "Sulfato de níquel", short: "NiSO₄", color: "#9BCF8A" },
};

export const FORMS: Record<string, string> = {
  concentrate: "Concentrado",
  cathode: "Cátodo",
  dore: "Doré",
  bullion: "Bullion",
  oxide: "Óxido",
  carbonate: "Carbonato",
  sulphate: "Sulfato",
  ore: "Mineral",
  hydroxide: "Hidróxido",
};

export const INCOTERMS = ["FOB", "CIF", "CFR", "EXW", "DAP", "DDP", "FCA"] as const;

export const FREQUENCIES: Record<string, string> = {
  spot: "Spot",
  monthly: "Mensual",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual_offtake: "Offtake anual",
};

export function countryFlag(code: string | null | undefined): string {
  if (!code) return "🌐";
  return COUNTRIES[code]?.flag ?? "🌐";
}

export function countryName(code: string | null | undefined): string {
  if (!code) return "—";
  return COUNTRIES[code]?.name ?? code;
}

export function commodityLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return COMMODITIES[code]?.label ?? code;
}

export function commodityShort(code: string | null | undefined): string {
  if (!code) return "—";
  return COMMODITIES[code]?.short ?? code;
}

export function commodityColor(code: string | null | undefined): string {
  if (!code) return "#94A3B8";
  return COMMODITIES[code]?.color ?? "#94A3B8";
}

export function formLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return FORMS[code] ?? code;
}

export function formatTonnes(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v.toLocaleString("es-CL", { maximumFractionDigits: 0 })} t`;
}

export function formatUsd(v: number | null | undefined): string {
  if (v == null) return "—";
  return `USD ${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
