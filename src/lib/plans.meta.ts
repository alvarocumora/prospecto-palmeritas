// Metadata de presentación de los planes SaaS (etiquetas legibles) sobre el
// modelo puro de src/lib/features + src/lib/usage. Lógica pura y testeable.

import type { PlanId, FeatureFlagKey } from "@/types/featureFlags";
import type { UsageLimitKey } from "@/types/usage";

export const PLAN_ORDER: PlanId[] = ["free", "starter", "pro", "enterprise"];

export type PlanMeta = {
  id: PlanId;
  name: string;
  tagline: string;
  /** Precio mensual referencial en USD; null = "a medida". */
  priceMonthlyUsd: number | null;
};

export const PLAN_META: Record<PlanId, PlanMeta> = {
  free: { id: "free", name: "Free", tagline: "Explora la plataforma", priceMonthlyUsd: 0 },
  starter: {
    id: "starter",
    name: "Starter",
    tagline: "Para operar tus primeros deals",
    priceMonthlyUsd: 49,
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Deal flow, IA y NI 43-101",
    priceMonthlyUsd: 199,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    tagline: "Escala, CRM de inversionistas y sync masivo",
    priceMonthlyUsd: null,
  },
};

export const FEATURE_LABELS: Record<FeatureFlagKey, { label: string; desc: string }> = {
  "geocapital.ai_copilot": {
    label: "GeoCopilot IA",
    desc: "Briefs y explicaciones de targets asistidas por IA.",
  },
  "geocapital.ni43101_export": {
    label: "Exportar NI 43-101",
    desc: "Genera informes NI 43-101 con verificación.",
  },
  "geocapital.investor_crm": {
    label: "CRM de inversionistas",
    desc: "Gestión de deal flow y pipeline de inversionistas.",
  },
  "geocapital.marketplace": {
    label: "Marketplace",
    desc: "Publica y opera lotes y proyectos en el marketplace.",
  },
  "geocapital.advanced_3d": {
    label: "Visor 3D avanzado",
    desc: "GeoScene3D con capas satelitales y modelo de bloques.",
  },
  "geocapital.bulk_sync": {
    label: "Sync masivo",
    desc: "Sincronización de catastro y boletines a gran escala.",
  },
};

export const LIMIT_LABELS: Record<
  UsageLimitKey,
  { label: string; unit: "count" | "gb" | "perMonth" | "perDay" }
> = {
  projects_per_org: { label: "Proyectos", unit: "count" },
  ai_briefs_per_month: { label: "Briefs IA", unit: "perMonth" },
  ni43101_exports_per_month: { label: "Exportes NI 43-101", unit: "perMonth" },
  storage_gb: { label: "Almacenamiento", unit: "gb" },
  heavy_sync_jobs_per_day: { label: "Sync pesados", unit: "perDay" },
};

/** Formatea un límite/valor según la unidad del recurso. */
export function formatLimitValue(n: number, key: UsageLimitKey): string {
  const unit = LIMIT_LABELS[key].unit;
  if (unit === "gb") return `${n.toLocaleString("es-CL")} GB`;
  if (unit === "perMonth") return `${n.toLocaleString("es-CL")}/mes`;
  if (unit === "perDay") return `${n.toLocaleString("es-CL")}/día`;
  return n.toLocaleString("es-CL");
}

/** Posición del plan en la escalera (para comparar / mostrar upgrade). */
export function planRank(plan: PlanId): number {
  return PLAN_ORDER.indexOf(plan);
}

/** Siguiente plan superior, o null si ya es el tope. */
export function nextPlanUp(plan: PlanId): PlanId | null {
  const i = planRank(plan);
  return i >= 0 && i < PLAN_ORDER.length - 1 ? PLAN_ORDER[i + 1] : null;
}

/** Normaliza un string arbitrario (código de billing_plans) a un PlanId conocido. */
export function normalizePlanId(value: string | null | undefined): PlanId {
  const v = (value ?? "").toLowerCase().trim();
  return (PLAN_ORDER as string[]).includes(v) ? (v as PlanId) : "free";
}
