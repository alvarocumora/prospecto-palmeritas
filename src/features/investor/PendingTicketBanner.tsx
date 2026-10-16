import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { clearPendingTicket, readPendingTicket, type PendingTicket } from "./pendingTicket";

const NAMES = { cholqui: "Cholqui", losverdes: "Los Verdes–Tilama" } as const;

export function PendingTicketBanner() {
  const [t, setT] = useState<PendingTicket | null>(null);
  useEffect(() => setT(readPendingTicket()), []);
  if (!t) return null;
  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded border border-gold/60 bg-bg-panel p-4">
      <div>
        <div className="text-sm font-semibold">
          Tu simulación: {NAMES[t.slug]} · USD {t.amount.toLocaleString("en-US")} ·{" "}
          {t.shares.toLocaleString("es-CL")} acciones
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Completa tu perfil (3 pasos) y emite el ticket desde la ficha del proyecto.
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-mono">
          <Link to="/dashboard" className="rounded border border-border px-3 py-1.5 hover:border-gold/60">
            1 · Completar perfil
          </Link>
          <Link
            to="/terminal/$slug"
            params={{ slug: t.slug }}
            className="rounded border border-gold/60 px-3 py-1.5 hover:border-gold"
          >
            2 · Emitir ticket
          </Link>
        </div>
      </div>
      <button
        aria-label="Descartar simulación"
        onClick={() => {
          clearPendingTicket();
          setT(null);
        }}
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
