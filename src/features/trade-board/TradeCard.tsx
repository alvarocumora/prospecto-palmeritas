// Tarjeta arrastrable del tablero. Envuelve el enlace al detalle y expone el
// menú de acciones rápidas. Usa @dnd-kit para el drag & drop.
import { useDraggable } from "@dnd-kit/core";
import { Link } from "@tanstack/react-router";
import { GripVertical } from "lucide-react";
import type { BoardCard } from "@/lib/tradeBoard";
import { TradeCardActions } from "./TradeCardActions";

const usd = (n: number | null) =>
  n != null ? `US$ ${Math.round(n).toLocaleString("es-CL")}` : "—";

export function TradeCard({ card }: { card: BoardCard }) {
  const isCancelled = card.status === "cancelled";
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    disabled: isCancelled,
    data: { stage: card.stage, status: card.status },
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-md border border-hairline bg-surface p-2.5 shadow-sm ${
        isDragging ? "opacity-40 ring-2 ring-accent-brand" : "hover:border-accent-brand/50"
      } ${isCancelled ? "opacity-70" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          {...listeners}
          {...attributes}
          className={`shrink-0 p-0.5 -ml-1 rounded text-muted-foreground ${
            isCancelled ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing hover:text-foreground"
          }`}
          aria-label="Arrastrar"
          onClick={(e) => e.preventDefault()}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <Link
          to="/dashboard/trades/$tradeId"
          params={{ tradeId: card.id }}
          className="flex-1 min-w-0"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold truncate">{card.reference ?? "Trade"}</span>
            <span
              className={`text-[8px] font-mono uppercase px-1 py-0.5 rounded shrink-0 ${
                card.role === "buyer"
                  ? "bg-blue-500/15 text-blue-600"
                  : card.role === "seller"
                    ? "bg-amber-500/15 text-amber-600"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {card.role === "buyer" ? "compra" : card.role === "seller" ? "venta" : "desk"}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground truncate mt-0.5">
            {card.commodity ?? "—"}
            {card.quantity_t != null ? ` · ${card.quantity_t} t` : ""}
          </div>
          <div className="text-[10px] text-muted-foreground truncate">{card.counterparty}</div>
          <div className="mt-1 text-xs font-mono">{usd(card.total_value_usd)}</div>
          <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-accent-brand"
              style={{ width: `${card.docPct}%` }}
              title={`Avance documental ${card.docPct}%`}
            />
          </div>
        </Link>
        <TradeCardActions card={card} />
      </div>
    </div>
  );
}
