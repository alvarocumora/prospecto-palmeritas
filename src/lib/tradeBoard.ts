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
};

export type BoardCard = BoardTrade & {
  /** Contraparte legible. */
  counterparty: string;
  /** Avance documental (0–100) del núcleo del checklist. */
  docPct: number;
};

export type BoardColumn = {
  key: TradeStage | "cancelled";
  label: string;
  cards: BoardCard[];
  /** Suma de valor de los trades en la columna. */
  totalUsd: number;
};

const STAGE_KEYS = new Set(TRADE_STAGES.map((s) => s.key));

function toCard(t: BoardTrade): BoardCard {
  const cp =
    t.counterparty_name && t.counterparty_company
      ? `${t.counterparty_name} · ${t.counterparty_company}`
      : (t.counterparty_name ?? t.counterparty_company ?? "Contraparte");
  const prog = tradeProgress(t.docs ?? []);
  return { ...t, counterparty: cp, docPct: prog.overall.pct };
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
};

/** Resumen del tablero: activos, cerrados, cancelados y valor en pipeline. */
export function boardSummary(trades: BoardTrade[]): BoardSummary {
  let activeCount = 0;
  let closedCount = 0;
  let cancelledCount = 0;
  let pipelineUsd = 0;
  for (const t of trades) {
    if (t.status === "cancelled") {
      cancelledCount += 1;
    } else if (t.stage === "closed" || t.status === "closed") {
      closedCount += 1;
    } else {
      activeCount += 1;
      pipelineUsd += t.total_value_usd ?? 0;
    }
  }
  return { activeCount, closedCount, cancelledCount, pipelineUsd };
}
