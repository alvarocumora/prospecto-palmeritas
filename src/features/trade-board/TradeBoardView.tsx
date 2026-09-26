// Vista principal del tablero de trades. Reutilizable en modo normal y
// fullscreen. Encapsula: query + realtime, filtros, drag & drop y swimlanes.
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import {
  LayoutGrid,
  Maximize2,
  Minimize2,
  Rows3,
  GanttChart,
  Download,
  AlertTriangle,
} from "lucide-react";
import { listMyTrades, setTradeStage } from "@/lib/trades.functions";
import {
  buildTradeBoard,
  boardSummary,
  filterTrades,
  commoditiesFromTrades,
  tradesToCsv,
  type BoardTrade,
  type BoardColumn,
} from "@/lib/tradeBoard";
import { TRADE_STAGES, type TradeStage } from "@/lib/tradeDocuments";
import { TradeColumnView } from "./TradeColumn";
import { TradeFilters, type BoardSearch } from "./TradeFilters";
import { TradeTimeline } from "./TradeTimeline";
import { useTradeBoardRealtime } from "./useTradeBoardRealtime";
import { Button } from "@/components/ui/button";

const STAGE_SET = new Set(TRADE_STAGES.map((s) => s.key));
const usd = (n: number | null) =>
  n != null ? `US$ ${Math.round(n).toLocaleString("es-CL")}` : "—";

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type TradeBoardViewProps = {
  search: BoardSearch & { full: boolean; group: "none" | "role"; view?: "kanban" | "timeline" };
  onSearchChange: (patch: Partial<TradeBoardViewProps["search"]>) => void;
};

export function TradeBoardView({ search, onSearchChange }: TradeBoardViewProps) {
  const listFn = useServerFn(listMyTrades);
  const setStage = useServerFn(setTradeStage);
  const qc = useQueryClient();
  useTradeBoardRealtime();

  const { data, isLoading } = useQuery({
    queryKey: ["my-trades"],
    queryFn: () => listFn(),
    staleTime: 15_000,
  });
  const trades = (data ?? []) as unknown as BoardTrade[];

  const stageMut = useMutation({
    mutationFn: (v: { id: string; stage: TradeStage }) =>
      setStage({ data: { id: v.id, stage: v.stage } }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["my-trades"] });
      const prev = qc.getQueryData<BoardTrade[]>(["my-trades"]);
      if (prev) {
        qc.setQueryData<BoardTrade[]>(
          ["my-trades"],
          prev.map((t) =>
            t.id === v.id
              ? {
                  ...t,
                  stage: v.stage,
                  status: v.stage === "closed" ? "closed" : t.status,
                }
              : t,
          ),
        );
      }
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["my-trades"], ctx.prev);
      toast.error(err instanceof Error ? err.message : "No se pudo mover el trade");
    },
    onSuccess: () => toast.success("Etapa actualizada"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["my-trades"] }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const commodities = useMemo(() => commoditiesFromTrades(trades), [trades]);
  const filtered = useMemo(() => filterTrades(trades, search), [trades, search]);
  const summary = boardSummary(filtered);

  const handleDragEnd = (e: DragEndEvent) => {
    const overId = e.over?.id;
    const cardId = e.active.id;
    if (!overId || typeof overId !== "string" || typeof cardId !== "string") return;
    if (!STAGE_SET.has(overId as TradeStage)) return;
    const card = trades.find((t) => t.id === cardId);
    if (!card || card.stage === overId) return;
    stageMut.mutate({ id: cardId, stage: overId as TradeStage });
  };

  const columnsAll = buildTradeBoard(filtered);
  const grouped =
    search.group === "role"
      ? {
          buyer: buildTradeBoard(filtered.filter((t) => t.role === "buyer")),
          seller: buildTradeBoard(filtered.filter((t) => t.role === "seller")),
          desk: buildTradeBoard(filtered.filter((t) => t.role === "desk")),
        }
      : null;

  return (
    <div className={search.full ? "fixed inset-0 z-50 bg-surface overflow-auto p-4" : "space-y-4"}>
      {/* Header + KPIs + toolbar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-accent-brand" />
            <h1 className="text-xl font-semibold">Tablero de trades</h1>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() =>
                onSearchChange({ view: search.view === "timeline" ? "kanban" : "timeline" })
              }
            >
              {search.view === "timeline" ? (
                <>
                  <LayoutGrid className="w-3.5 h-3.5 mr-1" /> Kanban
                </>
              ) : (
                <>
                  <GanttChart className="w-3.5 h-3.5 mr-1" /> Timeline
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => onSearchChange({ group: search.group === "role" ? "none" : "role" })}
              disabled={search.view === "timeline"}
            >
              <Rows3 className="w-3.5 h-3.5 mr-1" />
              {search.group === "role" ? "Vista plana" : "Agrupar por rol"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => {
                const stamp = new Date().toISOString().slice(0, 10);
                downloadCsv(`trades-${stamp}.csv`, tradesToCsv(filtered));
              }}
              disabled={filtered.length === 0}
            >
              <Download className="w-3.5 h-3.5 mr-1" /> CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => onSearchChange({ full: !search.full })}
            >
              {search.full ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 mr-1" /> Salir (Esc)
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 mr-1" /> Pantalla completa
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Kpi label="Activos" value={String(summary.activeCount)} />
          <Kpi label="Pipeline" value={usd(summary.pipelineUsd)} />
          <Kpi label="Forecast" value={usd(summary.forecastUsd)} accent />
          <Kpi
            label="Aging prom."
            value={summary.avgAgingDays != null ? `${summary.avgAgingDays} d` : "—"}
          />
          <Kpi
            label="Stuck"
            value={String(summary.stuckCount)}
            tone={summary.stuckCount > 0 ? "warn" : undefined}
          />
          <Kpi label="Cerrados" value={String(summary.closedCount)} />
        </div>

        <TradeFilters
          search={search}
          commodities={commodities}
          onChange={onSearchChange}
          total={{ filtered: filtered.length, all: trades.length }}
        />
      </div>

      {isLoading ? (
        <div className="h-64 rounded bg-muted/20 animate-pulse" />
      ) : trades.length === 0 ? (
        <div className="rounded-md border border-dashed border-hairline p-10 text-center text-sm text-muted-foreground">
          Aún no hay trades. Créalos en el Trade Desk.
        </div>
      ) : search.view === "timeline" ? (
        <TradeTimeline trades={filtered} />
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          {grouped ? (
            <div className="space-y-6">
              <Swimlane label="Compras" cols={grouped.buyer} tall={search.full} />
              <Swimlane label="Ventas" cols={grouped.seller} tall={search.full} />
              {grouped.desk.some((c) => c.cards.length > 0) && (
                <Swimlane label="Desk" cols={grouped.desk} tall={search.full} />
              )}
            </div>
          ) : (
            <BoardRow cols={columnsAll} tall={search.full} />
          )}
        </DndContext>
      )}
    </div>
  );
}

function BoardRow({ cols, tall }: { cols: BoardColumn[]; tall: boolean }) {
  return (
    <div className="overflow-x-auto pb-3">
      <div className="flex gap-3 min-w-max">
        {cols.map((col) => (
          <TradeColumnView key={col.key} col={col} tall={tall} />
        ))}
      </div>
    </div>
  );
}

function Swimlane({ label, cols, tall }: { label: string; cols: BoardColumn[]; tall: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </div>
      <BoardRow cols={cols} tall={tall} />
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
  accent,
}: {
  label: string;
  value: string;
  tone?: "muted" | "warn";
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-3 ${
        accent ? "border-accent-brand bg-accent-brand/5" : "border-hairline bg-surface"
      }`}
    >
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {tone === "warn" && <AlertTriangle className="w-3 h-3 text-amber-600" />}
        {label}
      </div>
      <div
        className={`text-lg font-semibold font-mono ${
          tone === "muted"
            ? "text-muted-foreground"
            : tone === "warn"
              ? "text-amber-600"
              : accent
                ? "text-accent-brand"
                : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
