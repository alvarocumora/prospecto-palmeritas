import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { X, Pencil, Trash2, MapPin, Calendar, FileText, Search } from "lucide-react";
import {
  type MiningConcession,
  daysUntilExpiry,
  expiryStatus,
  EXPIRY_COLORS,
} from "@/hooks/useMiningConcessions";
import { ConcessionFilesPanel } from "./ConcessionFilesPanel";

const SWIPE_CLOSE_THRESHOLD = 120; // px to trigger close
const SWIPE_VELOCITY_THRESHOLD = 0.5; // px/ms

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
  allConcessions,
  onJumpTo,
}: {
  concession: MiningConcession;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  intersectsAoi?: boolean;
  allConcessions?: MiningConcession[];
  onJumpTo?: (c: MiningConcession) => void;
}) {
  const c = concession;
  const st = expiryStatus(c.expires_at);
  const days = daysUntilExpiry(c.expires_at);
  const color = EXPIRY_COLORS[st];

  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ y: number; t: number } | null>(null);
  const scrollAtStart = useRef(0);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);

  const [jumpQuery, setJumpQuery] = useState("");
  const [jumpOpen, setJumpOpen] = useState(false);
  const jumpResults = useMemo(() => {
    const q = jumpQuery.trim().toLowerCase();
    if (!q || !allConcessions) return [];
    return allConcessions
      .filter((x) => x.id !== c.id)
      .filter((x) => x.code.toLowerCase().includes(q) || x.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [jumpQuery, allConcessions, c.id]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Only respond to primary pointer (touch / mouse main button)
    if (e.pointerType === "mouse" && e.button !== 0) return;
    scrollAtStart.current = bodyRef.current?.scrollTop ?? 0;
    dragStart.current = { y: e.clientY, t: performance.now() };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    const dy = e.clientY - dragStart.current.y;
    // Only allow downward drag, and only if the body is at scroll-top
    // (otherwise the user is scrolling content, not dismissing).
    if (dy <= 0) {
      setDragY(0);
      return;
    }
    if (scrollAtStart.current > 0 && (bodyRef.current?.scrollTop ?? 0) > 0) {
      setDragY(0);
      return;
    }
    setDragY(dy);
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    const dy = Math.max(0, e.clientY - dragStart.current.y);
    const dt = Math.max(1, performance.now() - dragStart.current.t);
    const velocity = dy / dt;
    dragStart.current = null;
    setDragging(false);
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (dy > SWIPE_CLOSE_THRESHOLD || velocity > SWIPE_VELOCITY_THRESHOLD) {
      onClose();
    } else {
      setDragY(0);
    }
  };

  return (
    <div className="md:hidden fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        style={{ opacity: Math.max(0.3, 1 - dragY / 400) }}
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className="relative w-full bg-bg-panel border-t border-border rounded-t-lg animate-fade-up max-h-[85vh] flex flex-col touch-pan-y"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? "none" : "transform 200ms ease-out",
          willChange: dragging ? "transform" : undefined,
        }}
      >
        {/* Drag handle (also captures swipe) */}
        <div
          className="pt-2 pb-2 flex justify-center cursor-grab active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          aria-label="Deslizar para cerrar"
        >
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

        {/* Jump-to search */}
        {allConcessions && allConcessions.length > 1 && onJumpTo && (
          <div className="px-4 pt-2 pb-2 border-b border-border relative">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary pointer-events-none" />
              <input
                type="text"
                value={jumpQuery}
                onChange={(e) => { setJumpQuery(e.target.value); setJumpOpen(true); }}
                onFocus={() => setJumpOpen(true)}
                onBlur={() => setTimeout(() => setJumpOpen(false), 150)}
                placeholder="Saltar a otra concesión por código o nombre…"
                className="w-full h-9 pl-7 pr-2 rounded bg-bg-elevated border border-border text-xs font-mono placeholder:text-text-secondary focus:outline-none focus:border-primary"
              />
            </div>
            {jumpOpen && jumpResults.length > 0 && (
              <div className="absolute left-4 right-4 top-full mt-1 z-10 bg-bg-panel border border-border rounded shadow-lg max-h-64 overflow-y-auto">
                {jumpResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      onJumpTo(r);
                      setJumpQuery("");
                      setJumpOpen(false);
                      bodyRef.current?.scrollTo({ top: 0 });
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-bg-elevated active:bg-bg-elevated border-b border-border last:border-b-0"
                  >
                    <div className="font-mono font-semibold truncate">{r.code}</div>
                    <div className="text-text-secondary truncate">{r.name}</div>
                  </button>
                ))}
              </div>
            )}
            {jumpOpen && jumpQuery.trim() && jumpResults.length === 0 && (
              <div className="absolute left-4 right-4 top-full mt-1 z-10 bg-bg-panel border border-border rounded shadow-lg px-3 py-2 text-xs text-text-secondary">
                Sin resultados
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4 overscroll-contain">
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

          {c.project_id && (
            <ConcessionFilesPanel concessionId={c.id} projectId={c.project_id} />
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
