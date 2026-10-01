/**
 * GEOCAPITALS WATER ASSETS — capa de datos.
 *
 * Fuente única de verdad: tablas `water_*` en Lovable Cloud.
 * La segregación público / data room la hace RLS (ficha jurídica y
 * documentos privados sólo con sesión iniciada); la UI sólo refleja
 * lo que la base entrega.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type WaterAsset = {
  id: string;
  asset_id: string;
  name: string;
  river: string;
  commune: string;
  province: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  utm_datum: string | null;
  utm_zone: string | null;
  utm_north: number | null;
  utm_east: number | null;
  right_type: string;
  nature: string;
  exercise: string;
  flow_permanent_ls: number;
  flow_eventual_ls: number | null;
  flow_notes: string | null;
  capture_system: string | null;
  dga_resolution: string | null;
  dga_resolution_date: string | null;
  unit_value_clp: number;
  reference_value_clp: number | null;
  quality_status: string;
  verification_status: string;
  status: string;
  summary: string | null;
};

export type WaterLegalRecord = {
  id: string;
  asset_uuid: string;
  attribute: string;
  value: string | null;
  verification: string;
  note: string | null;
  display_order: number;
};

export type WaterDocument = {
  id: string;
  asset_uuid: string;
  doc_type: string;
  title: string;
  institution: string | null;
  doc_date: string | null;
  status: string;
  external_url: string | null;
  is_public: boolean;
};

export type WaterQualityTest = {
  id: string;
  asset_uuid: string;
  sampling_date: string | null;
  laboratory: string | null;
  certification: string | null;
  status: string;
  parameters: Record<string, string | number> | null;
};

export type WaterHydrology = {
  id: string;
  asset_uuid: string;
  basin: string | null;
  sub_basin: string | null;
  dga_station: string | null;
  ecological_flow_ls: number | null;
  drought_risk: string | null;
  notes: string | null;
};

export type WaterPortfolio = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  color: string;
  display_order: number;
  assetUuids: string[];
};

const anyDb = supabase as unknown as {
  from: (t: string) => {
    select: (c: string) => {
      order: (c: string, o?: { ascending: boolean }) => Promise<{ data: unknown; error: unknown }>;
    } & Promise<{ data: unknown; error: unknown }>;
  };
};

async function fetchTable<T>(table: string, orderBy?: string): Promise<T[]> {
  const q = anyDb.from(table).select("*");
  const { data, error } = await (orderBy ? q.order(orderBy, { ascending: true }) : q);
  if (error) throw error;
  return (data ?? []) as T[];
}

export function useWaterAssets() {
  return useQuery({
    queryKey: ["water", "assets"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const rows = await fetchTable<WaterAsset>("water_assets", "asset_id");
      return rows.map((r) => ({
        ...r,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        flow_permanent_ls: Number(r.flow_permanent_ls),
        flow_eventual_ls: r.flow_eventual_ls == null ? null : Number(r.flow_eventual_ls),
        unit_value_clp: Number(r.unit_value_clp),
        reference_value_clp: r.reference_value_clp == null ? null : Number(r.reference_value_clp),
      }));
    },
  });
}

export function useWaterPortfolios() {
  return useQuery({
    queryKey: ["water", "portfolios"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<WaterPortfolio[]> => {
      const [ports, links] = await Promise.all([
        fetchTable<Omit<WaterPortfolio, "assetUuids">>("water_portfolios", "display_order"),
        fetchTable<{ portfolio_id: string; asset_uuid: string }>("water_portfolio_assets"),
      ]);
      return ports.map((p) => ({
        ...p,
        assetUuids: links.filter((l) => l.portfolio_id === p.id).map((l) => l.asset_uuid),
      }));
    },
  });
}

export function useWaterLegal() {
  return useQuery({
    queryKey: ["water", "legal"],
    staleTime: 5 * 60_000,
    queryFn: () => fetchTable<WaterLegalRecord>("water_legal_records", "display_order"),
  });
}

export function useWaterDocuments() {
  return useQuery({
    queryKey: ["water", "documents"],
    staleTime: 5 * 60_000,
    queryFn: () => fetchTable<WaterDocument>("water_documents"),
  });
}

export function useWaterQuality() {
  return useQuery({
    queryKey: ["water", "quality"],
    staleTime: 5 * 60_000,
    queryFn: () => fetchTable<WaterQualityTest>("water_quality_tests"),
  });
}

export function useWaterHydrology() {
  return useQuery({
    queryKey: ["water", "hydrology"],
    staleTime: 5 * 60_000,
    queryFn: () => fetchTable<WaterHydrology>("water_hydrology"),
  });
}

/* ── Formato ─────────────────────────────────────────────── */

export function fmtFlow(ls: number | null | undefined): string {
  if (ls == null) return "—";
  return `${new Intl.NumberFormat("en-US").format(ls)} L/s`;
}

export function fmtCLP(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1_000_000_000) return `CLP $${(v / 1_000_000_000).toFixed(3).replace(/\.?0+$/, "")}B`;
  if (v >= 1_000_000) return `CLP $${Math.round(v / 1_000_000)}M`;
  return `CLP $${new Intl.NumberFormat("es-CL").format(v)}`;
}

export function fmtCLPFull(v: number | null | undefined): string {
  if (v == null) return "—";
  return `CLP $${new Intl.NumberFormat("es-CL").format(v)}`;
}

export const NATURE_LABEL: Record<string, string> = {
  consuntivo: "Consuntivo / Consumptive",
  no_consuntivo: "No consuntivo / Non-consumptive",
};

export const EXERCISE_LABEL: Record<string, string> = {
  permanente_continuo: "Permanent & Continuous",
  permanente_continuo_con_eventual: "Permanent & Continuous + Eventual",
  eventual: "Eventual",
  discontinuo: "Discontinuous",
};

export const RIGHT_TYPE_LABEL: Record<string, string> = {
  surface: "Surface Water Right",
  groundwater: "Groundwater Right",
};

export const VERIFICATION_META: Record<string, { label: string; tone: string }> = {
  verified: { label: "Verified", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  document_provided: {
    label: "Document Provided",
    tone: "bg-sky-50 text-sky-700 border-sky-200",
  },
  declared: { label: "Declared", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  pending: { label: "Pending Verification", tone: "bg-slate-100 text-slate-600 border-slate-200" },
  not_available: { label: "Not Available", tone: "bg-slate-100 text-slate-500 border-slate-200" },
};

export const QUALITY_STATUS_LABEL: Record<string, string> = {
  not_tested: "Not Tested",
  historical: "Historical Analysis Available",
  lab_verified: "Laboratory Verified",
  potable_verified: "Potable Standard Verified",
  pending_verification: "Water quality documentation pending verification",
};

export type QualityStatusKey =
  "not_tested" | "historical" | "lab_verified" | "pending_verification";

export const QUALITY_STATUS_META: Record<
  QualityStatusKey,
  { label: string; description: string; tone: string }
> = {
  not_tested: {
    label: "Not Tested",
    description:
      "Sin muestreo registrado. No existen análisis físico-químicos ni microbiológicos asociados al punto de captación.",
    tone: "border-slate-200 bg-slate-50 text-slate-700",
  },
  historical: {
    label: "Historical Analysis Available",
    description:
      "Existen análisis históricos aportados por el titular. Valores referenciales: requieren remuestreo para uso en due diligence.",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
  },
  lab_verified: {
    label: "Laboratory Verified",
    description:
      "Muestreo realizado por laboratorio acreditado con certificado validado por Geocapitals.",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  pending_verification: {
    label: "Pending Verification",
    description:
      "Water quality documentation pending verification: se recibió documentación y está en revisión por Geocapitals.",
    tone: "border-sky-200 bg-sky-50 text-sky-800",
  },
};

/** Normaliza el estado del activo/ensayo a una de las 4 categorías del módulo. */
export function resolveQualityStatus(
  asset: Pick<WaterAsset, "quality_status">,
  quality: WaterQualityTest | null | undefined,
): QualityStatusKey {
  const raw = (quality?.status ?? asset.quality_status ?? "not_tested").toLowerCase();
  if (raw === "lab_verified" || raw === "potable_verified") return "lab_verified";
  if (raw === "historical") return "historical";
  if (raw === "pending" || raw === "pending_verification" || raw === "document_provided")
    return "pending_verification";
  return "not_tested";
}

/** Metadatos de parámetros habituales con límites de referencia chilenos. */
export const QUALITY_PARAM_META: Record<
  string,
  { label: string; unit?: string; reference?: string }
> = {
  ph: { label: "pH", reference: "NCh 409: 6,5 – 8,5" },
  conductivity: { label: "Conductividad", unit: "µS/cm", reference: "NCh 1333: ≤ 750" },
  turbidity: { label: "Turbiedad", unit: "NTU", reference: "NCh 409: ≤ 2" },
  tds: { label: "Sólidos disueltos totales", unit: "mg/L", reference: "NCh 409: ≤ 1.500" },
  hardness: { label: "Dureza total", unit: "mg/L CaCO₃", reference: "NCh 409: ≤ 500" },
  arsenic: { label: "Arsénico", unit: "mg/L", reference: "NCh 409: ≤ 0,01" },
  iron: { label: "Hierro", unit: "mg/L", reference: "NCh 409: ≤ 0,3" },
  manganese: { label: "Manganeso", unit: "mg/L", reference: "NCh 409: ≤ 0,1" },
  nitrates: { label: "Nitratos", unit: "mg/L", reference: "NCh 409: ≤ 50" },
  sulfates: { label: "Sulfatos", unit: "mg/L", reference: "NCh 409: ≤ 500" },
  chlorides: { label: "Cloruros", unit: "mg/L", reference: "NCh 409: ≤ 400" },
  coliforms: { label: "Coliformes totales", unit: "NMP/100 mL", reference: "NCh 409: ausencia" },
  temperature: { label: "Temperatura", unit: "°C" },
  dissolved_oxygen: { label: "Oxígeno disuelto", unit: "mg/L" },
};

export const UNIT_VALUE_CLP = 750_000;

export const VALUATION_DISCLAIMER =
  "Reference commercial valuation. Subject to legal, hydrological, environmental and market due diligence.";
