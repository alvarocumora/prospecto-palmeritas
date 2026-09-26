// Menú de acciones rápidas por tarjeta: avanzar/retroceder etapa, cerrar,
// cancelar/reabrir y copiar referencia. Sin salir del tablero.
import {
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Copy,
  ExternalLink,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { setTradeStage, setTradeStatus } from "@/lib/trades.functions";
import { TRADE_STAGES, type TradeStage } from "@/lib/tradeDocuments";
import type { BoardCard } from "@/lib/tradeBoard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STAGE_KEYS = TRADE_STAGES.map((s) => s.key) as TradeStage[];

export function TradeCardActions({ card }: { card: BoardCard }) {
  const qc = useQueryClient();
  const setStage = useServerFn(setTradeStage);
  const setStatus = useServerFn(setTradeStatus);

  const stageMut = useMutation({
    mutationFn: (stage: TradeStage) => setStage({ data: { id: card.id, stage } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-trades"] });
      toast.success("Etapa actualizada");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const statusMut = useMutation({
    mutationFn: (status: "active" | "closed" | "cancelled") =>
      setStatus({ data: { id: card.id, status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-trades"] });
      toast.success("Estado actualizado");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const idx = STAGE_KEYS.indexOf(card.stage as TradeStage);
  const prev = idx > 0 ? STAGE_KEYS[idx - 1] : null;
  const next = idx >= 0 && idx < STAGE_KEYS.length - 1 ? STAGE_KEYS[idx + 1] : null;
  const isCancelled = card.status === "cancelled";
  const isClosed = card.status === "closed" || card.stage === "closed";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
        aria-label="Acciones"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
        {prev && !isCancelled && (
          <DropdownMenuItem onClick={() => stageMut.mutate(prev)}>
            <ChevronLeft className="w-3.5 h-3.5 mr-2" /> Retroceder a {prev}
          </DropdownMenuItem>
        )}
        {next && !isCancelled && (
          <DropdownMenuItem onClick={() => stageMut.mutate(next)}>
            <ChevronRight className="w-3.5 h-3.5 mr-2" /> Avanzar a {next}
          </DropdownMenuItem>
        )}
        {!isClosed && !isCancelled && (
          <DropdownMenuItem onClick={() => stageMut.mutate("closed")}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Marcar cerrado
          </DropdownMenuItem>
        )}
        {!isCancelled ? (
          <DropdownMenuItem
            onClick={() => statusMut.mutate("cancelled")}
            className="text-destructive focus:text-destructive"
          >
            <XCircle className="w-3.5 h-3.5 mr-2" /> Cancelar
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => statusMut.mutate("active")}>
            <RotateCcw className="w-3.5 h-3.5 mr-2" /> Reabrir
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            if (card.reference) {
              navigator.clipboard
                .writeText(card.reference)
                .then(() => toast.success("Referencia copiada"));
            }
          }}
        >
          <Copy className="w-3.5 h-3.5 mr-2" /> Copiar referencia
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/dashboard/trades/$tradeId" params={{ tradeId: card.id }}>
            <ExternalLink className="w-3.5 h-3.5 mr-2" /> Abrir detalle
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
