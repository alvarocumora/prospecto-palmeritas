import { Link } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import type { HolderWithCounts } from "@/hooks/useHolders";
import { HOLDER_TYPE_LABELS } from "@/hooks/useHolders";
import { HolderBadges } from "./HolderBadges";

export function HolderCard({ holder }: { holder: HolderWithCounts }) {
  return (
    <Link
      to="/dashboard/catastro/holders/$id"
      params={{ id: holder.id }}
      className="block border border-border rounded p-3 hover:bg-accent/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-text-secondary shrink-0" />
            <span className="font-mono text-sm font-semibold truncate">{holder.name}</span>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-text-secondary">
            <span>RUT: <span className="font-mono text-foreground">{holder.rut ?? "—"}</span></span>
            <span>Tipo: {HOLDER_TYPE_LABELS[holder.holder_type] ?? holder.holder_type}</span>
            {holder.region && <span>Región: {holder.region}</span>}
            {holder.legal_repr_name && <span>R. legal: {holder.legal_repr_name}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="font-mono text-[10px] text-text-secondary">
            {holder.concessions_count} CONCES.
          </span>
          <HolderBadges counts={{ files: holder.files_count, bulletins: holder.bulletins_count, cases: holder.cases_count }} />
        </div>
      </div>
    </Link>
  );
}
