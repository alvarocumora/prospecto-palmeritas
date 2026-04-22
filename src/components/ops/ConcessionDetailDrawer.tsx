import { X, Pencil, Trash2, MapPin, Calendar, FileText } from "lucide-react";
import {
  type MiningConcession,
  daysUntilExpiry,
  expiryStatus,
  EXPIRY_COLORS,
} from "@/hooks/useMiningConcessions";

const TYPE_LABELS: Record<string, string> = {
  exploracion: "Exploración",
  explotacion: "Explotación",
  pertenencia: "Pertenencia",
  manifestacion: "Manifestación",
};

const STATUS_LABELS: Record<string, string> = {
  vigente: "Vigente",
  en_tramite: "En trámite",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

export function ConcessionDetailDrawer({
  concession,
  onClose,
  onEdit,
  onDelete,
  intersectsAoi,
}: {
  concession: MiningConcession;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  intersectsAoi?: boolean;
}) {
  const c = concession;
  const st = expiryStatus(c.expires_at);
  const days = daysUntilExpiry(c.expires_at);
  const color = EXPIRY_COLORS[st];

  return (
    <div className="md:hidden fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative w-full bg-bg-panel border-t border-border rounded-t-lg animate-fade-up max-h-[85vh] flex flex-col"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Drag handle */}
        <div className="pt-2 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Sticky header */}
        <div className="flex items-start justify-between gap-2 px-4 pb-3 border-b border-border">
          <div className="min-w-0 flex-1">
            <div className="font-mono font-semibold text-base truncate">{c.code}</div>
            <div className="text-sm text-text-secondary truncate">{c.name}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-text-dim active:bg-bg-elevated"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Status row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium"
              style={{ backgroundColor: `${color}20`, color }}
            >
              <Calendar className="w-3 h-3" />
              {c.expires_at ?? "Sin vencimiento"}
              {days !== null && (
                <span className="opacity-80">
                  ({days < 0 ? `${Math.abs(days)}d vencida` : `${days}d`})
                </span>
              )}
            </span>
            {intersectsAoi && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-amber-500/15 text-amber-600">
                <MapPin className="w-3 h-3" /> Intersecta AOI
              </span>
            )}
          </div>

          {/* Detail grid */}
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
            <Item label="Titular" value={c.holder ?? "—"} />
            <Item label="Tipo" value={TYPE_LABELS[c.concession_type] ?? c.concession_type} />
            <Item label="Estado" value={STATUS_LABELS[c.status] ?? c.status} />
            <Item label="Área" value={c.area_ha != null ? `${c.area_ha} ha` : "—"} />
            <Item label="Otorgada" value={c.granted_at ?? "—"} />
            <Item label="Vence" value={c.expires_at ?? "—"} />
            <Item label="Región" value={c.region ?? "—"} />
            <Item label="Comuna" value={c.commune ?? "—"} />
            <Item label="Origen" value={c.source ?? "manual"} />
          </dl>

          {c.notes && (
            <div>
              <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-secondary mb-1">
                <FileText className="w-3 h-3" /> Notas
              </div>
              <div className="text-sm text-text-mono border-l-2 border-border pl-2 whitespace-pre-wrap">
                {c.notes}
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer actions */}
        <div className="flex gap-2 px-4 py-3 border-t border-border bg-bg-panel">
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center justify-center gap-1.5 px-3 h-11 rounded border border-destructive/40 text-destructive text-sm font-medium active:scale-95 transition-transform"
          >
            <Trash2 className="w-4 h-4" /> Eliminar
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 h-11 rounded bg-primary text-primary-foreground text-sm font-medium active:scale-95 transition-transform"
          >
            <Pencil className="w-4 h-4" /> Editar
          </button>
        </div>
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-text-secondary">{label}</dt>
      <dd className="text-sm text-foreground mt-0.5 break-words">{value}</dd>
    </div>
  );
}
