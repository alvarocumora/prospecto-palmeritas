// Tablero (pizarra / kanban) del Trade Desk: agrupa los trades por etapa del
// pipeline en columnas, con totales por columna. Lógica pura y testeable; la
// ruta consume estas estructuras.

import { TRADE_STAGES, tradeProgress, type TradeStage } from "@/lib/tradeDocuments";

export type BoardTrade = {
  id: string;
  reference: string | null;
  commodity: string | null;
  form: string | null;
  quantity_t: number | null;
  total_value_usd: number | null;
  stage: string;
  status: string;
  role: "buyer" | "seller" | "desk";
  counterparty_name: string | null;
  counterparty_company: string | null;
  docs: Array<{ doc_type: string; status: string }>;
  updated_at?: string | null;
  created_at?: string | null;
};

/** Probabilidad de cierre por etapa para el forecast ponderado. */
export const STAGE_PROBABILITY: Record<string, number> = {
  icpo: 0.1,
  fco: 0.25,
  spa: 0.5,
  payment: 0.7,
  shipping: 0.85,
  delivered: 0.95,
  closed: 1,
};

/** SLA (días) por etapa. Superar el límite marca el trade como stuck. */
export const STAGE_SLA_DAYS: Record<string, number> = {
  icpo: 7,
  fco: 10,
  spa: 14,
  payment: 21,
  shipping: 30,
  delivered: 14,
  closed: 999,
};

export type BoardCard = BoardTrade & {
  /** Contraparte legible. */
  counterparty: string;
  /** Avance documental (0–100) del núcleo del checklist. */
  docPct: number;
  /** Días desde el último movimiento (updated_at). */
  daysInStage: number | null;
  /** Excede SLA de la etapa. */
  stuck: boolean;
};

export type BoardColumn = {
  key: TradeStage | "cancelled";
  label: string;
  cards: BoardCard[];
  /** Suma de valor de los trades en la columna. */
  totalUsd: number;
};

const STAGE_KEYS = new Set(TRADE_STAGES.map((s) => s.key));

function daysInStage(t: BoardTrade): number | null {
  const ts = t.updated_at ?? t.created_at;
  if (!ts) return null;
  const d = new Date(ts).getTime();
  if (!Number.isFinite(d)) return null;
  return Math.max(0, Math.floor((Date.now() - d) / 86_400_000));
}

function toCard(t: BoardTrade): BoardCard {
  const cp =
    t.counterparty_name && t.counterparty_company
      ? `${t.counterparty_name} · ${t.counterparty_company}`
      : (t.counterparty_name ?? t.counterparty_company ?? "Contraparte");
  const prog = tradeProgress(t.docs ?? []);
  const days = daysInStage(t);
  const sla = STAGE_SLA_DAYS[t.stage] ?? 999;
  return {
    ...t,
    counterparty: cp,
    docPct: prog.overall.pct,
    daysInStage: days,
    stuck: days != null && days > sla,
  };
}

/**
 * Construye las columnas del tablero: una por etapa del pipeline (en orden),
 * más una columna final "Cancelados". Un trade cae en la columna de su etapa;
 * si la etapa es desconocida, va a la primera (intención).
 */
export function buildTradeBoard(trades: BoardTrade[]): BoardColumn[] {
  const cols: BoardColumn[] = TRADE_STAGES.map((s) => ({
    key: s.key,
    label: s.label,
    cards: [],
    totalUsd: 0,
  }));
  const cancelled: BoardColumn = { key: "cancelled", label: "Cancelados", cards: [], totalUsd: 0 };
  const byKey = new Map(cols.map((c) => [c.key, c]));

  for (const t of trades) {
    if (t.status === "cancelled") {
      const card = toCard(t);
      cancelled.cards.push(card);
      cancelled.totalUsd += t.total_value_usd ?? 0;
      continue;
    }
    const stageKey = (STAGE_KEYS.has(t.stage as TradeStage) ? t.stage : "icpo") as TradeStage;
    const col = byKey.get(stageKey)!;
    col.cards.push(toCard(t));
    col.totalUsd += t.total_value_usd ?? 0;
  }

  return cancelled.cards.length > 0 ? [...cols, cancelled] : cols;
}

export type BoardSummary = {
  activeCount: number;
  closedCount: number;
  cancelledCount: number;
  pipelineUsd: number;
  /** Suma valor × probabilidad por etapa (solo activos). */
  forecastUsd: number;
  /** Días promedio en etapa entre trades activos. */
  avgAgingDays: number | null;
  /** Trades activos que exceden su SLA. */
  stuckCount: number;
};

/** Resumen ampliado del tablero: totales, forecast ponderado y aging. */
export function boardSummary(trades: BoardTrade[]): BoardSummary {
  let activeCount = 0;
  let closedCount = 0;
  let cancelledCount = 0;
  let pipelineUsd = 0;
  let forecastUsd = 0;
  let ageSum = 0;
  let ageCount = 0;
  let stuckCount = 0;
  for (const t of trades) {
    if (t.status === "cancelled") {
      cancelledCount += 1;
      continue;
    }
    if (t.stage === "closed" || t.status === "closed") {
      closedCount += 1;
      continue;
    }
    activeCount += 1;
    const v = t.total_value_usd ?? 0;
    pipelineUsd += v;
    const prob = STAGE_PROBABILITY[t.stage] ?? 0.1;
    forecastUsd += v * prob;
    const ts = t.updated_at ?? t.created_at;
    if (ts) {
      const d = new Date(ts).getTime();
      if (Number.isFinite(d)) {
        const days = Math.max(0, Math.floor((Date.now() - d) / 86_400_000));
        ageSum += days;
        ageCount += 1;
        if (days > (STAGE_SLA_DAYS[t.stage] ?? 999)) stuckCount += 1;
      }
    }
  }
  return {
    activeCount,
    closedCount,
    cancelledCount,
    pipelineUsd,
    forecastUsd,
    avgAgingDays: ageCount > 0 ? Math.round(ageSum / ageCount) : null,
    stuckCount,
  };
}

export type BoardFilters = {
  q?: string;
  role?: "all" | "buyer" | "seller" | "desk";
  commodity?: string; // "" o "all" = todos
  minUsd?: number | null;
  maxUsd?: number | null;
};

/** Filtra trades sin tocar el orden. Búsqueda case-insensitive sobre ref, contraparte y commodity. */
export function filterTrades(trades: BoardTrade[], f: BoardFilters): BoardTrade[] {
  const q = (f.q ?? "").trim().toLowerCase();
  const role = f.role && f.role !== "all" ? f.role : null;
  const commodity =
    f.commodity && f.commodity !== "all" ? f.commodity.trim().toLowerCase() : null;
  const min = typeof f.minUsd === "number" && !Number.isNaN(f.minUsd) ? f.minUsd : null;
  const max = typeof f.maxUsd === "number" && !Number.isNaN(f.maxUsd) ? f.maxUsd : null;

  return trades.filter((t) => {
    if (role && t.role !== role) return false;
    if (commodity && (t.commodity ?? "").toLowerCase() !== commodity) return false;
    const v = t.total_value_usd ?? 0;
    if (min != null && v < min) return false;
    if (max != null && v > max) return false;
    if (q) {
      const hay = [
        t.reference,
        t.commodity,
        t.counterparty_name,
        t.counterparty_company,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Lista única y ordenada de commodities para poblar el selector de filtro. */
export function commoditiesFromTrades(trades: BoardTrade[]): string[] {
  const set = new Set<string>();
  for (const t of trades) if (t.commodity) set.add(t.commodity);
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

/** Exporta los trades filtrados a CSV (BOM UTF-8, separador coma). */
export function tradesToCsv(trades: BoardTrade[]): string {
  const cols = [
    "reference",
    "commodity",
    "form",
    "quantity_t",
    "unit_price_usd",
    "total_value_usd",
    "role",
    "counterparty",
    "stage",
    "status",
    "daysInStage",
    "docPct",
    "stuck",
  ];
  const esc = (v: unknown): string => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const rows = trades.map((t) => {
    const c = {
      reference: t.reference ?? "",
      commodity: t.commodity ?? "",
      form: t.form ?? "",
      quantity_t: t.quantity_t ?? "",
      unit_price_usd:
        t.total_value_usd != null && t.quantity_t
          ? (t.total_value_usd / t.quantity_t).toFixed(2)
          : "",
      total_value_usd: t.total_value_usd ?? "",
      role: t.role,
      counterparty:
        t.counterparty_name && t.counterparty_company
          ? `${t.counterparty_name} · ${t.counterparty_company}`
          : (t.counterparty_name ?? t.counterparty_company ?? ""),
      stage: t.stage,
      status: t.status,
      daysInStage: (() => {
        const ts = t.updated_at ?? t.created_at;
        if (!ts) return "";
        const d = new Date(ts).getTime();
        if (!Number.isFinite(d)) return "";
        return Math.max(0, Math.floor((Date.now() - d) / 86_400_000));
      })(),
      docPct: (() => {
        const p = tradeProgress(t.docs ?? []).overall.pct;
        return p;
      })(),
      stuck: (() => {
        const ts = t.updated_at ?? t.created_at;
        if (!ts) return "";
        const d = new Date(ts).getTime();
        if (!Number.isFinite(d)) return "";
        const days = Math.max(0, Math.floor((Date.now() - d) / 86_400_000));
        return days > (STAGE_SLA_DAYS[t.stage] ?? 999) ? "yes" : "no";
      })(),
    };
    return cols.map((k) => esc((c as Record<string, unknown>)[k])).join(",");
  });
  return "\uFEFF" + cols.join(",") + "\n" + rows.join("\n");
}


