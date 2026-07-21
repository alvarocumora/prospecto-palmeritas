// Columna del kanban: zona receptora de drop + lista de tarjetas.
import { useDroppable } from "@dnd-kit/core";
import { TradeCard } from "./TradeCard";
import type { BoardColumn } from "@/lib/tradeBoard";

const usd = (n: number) => `US$ ${Math.round(n).toLocaleString("es-CL")}`;

export function TradeColumnView({ col, tall }: { col: BoardColumn; tall?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key, data: { stage: col.key } });
  return (
    <div className="w-64 shrink-0">
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          {col.label}
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">{col.cards.length}</span>
      </div>
      <div className="text-[10px] font-mono text-muted-foreground px-1 mb-2 h-3">
        {col.totalUsd > 0 ? usd(col.totalUsd) : ""}
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-2 rounded-md p-1 transition-colors ${
          isOver ? "bg-accent-brand/10 ring-1 ring-accent-brand/40" : ""
        } ${tall ? "overflow-y-auto" : "min-h-[80px]"}`}
        style={tall ? { maxHeight: "calc(100dvh - 200px)" } : undefined}
      >
        {col.cards.map((c) => (
          <TradeCard key={c.id} card={c} />
        ))}
        {col.cards.length === 0 && (
          <div className="rounded-md border border-dashed border-hairline p-3 text-[10px] text-muted-foreground text-center">
            —
          </div>
        )}
      </div>
    </div>
  );
}
