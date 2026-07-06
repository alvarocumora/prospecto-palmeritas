// Bandeja de consultas del seller por lote: ve cada interés recibido y lo
// avanza por el pipeline de negociación (nueva → contactado → muestra →
// oferta → negociación → cerrada ganada/perdida) con notas internas.
import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquare, Save } from "lucide-react";
import { toast } from "sonner";
import {
  listMyLotInquiries,
  updateMyLotInquiryStatus,
  INQUIRY_PIPELINE,
  INQUIRY_STATUS_LABELS,
  type MyLotInquiryRow,
} from "@/lib/marketplace.functions";

const STATUS_CLS: Record<string, string> = {
  new: "border-warn/40 bg-warn/10 text-warn",
  contacted: "border-border text-muted-foreground",
  sample_requested: "border-gold/40 bg-gold/10 text-gold",
  offer_sent: "border-gold/40 bg-gold/10 text-gold",
  negotiating: "border-teal/40 bg-teal/10 text-teal",
  closed_won: "border-teal/40 bg-teal/10 text-teal",
  closed_lost: "border-danger/40 bg-danger/10 text-danger",
};

export function LotInquiriesManager({ lotId }: { lotId: string }) {
  const [rows, setRows] = useState<MyLotInquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { status: string; notes: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMyLotInquiries({ data: { lotId } });
      setRows(data);
      setDrafts(
        Object.fromEntries(
          data.map((r) => [r.id, { status: r.status, notes: r.seller_notes ?? "" }]),
        ),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando consultas");
    } finally {
      setLoading(false);
    }
  }, [lotId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (r: MyLotInquiryRow) => {
    const d = drafts[r.id];
    if (!d) return;
    setSaving(r.id);
    try {
      await updateMyLotInquiryStatus({
        data: {
          inquiryId: r.id,
          status: d.status as (typeof INQUIRY_PIPELINE)[number],
          sellerNotes: d.notes || null,
        },
      });
      toast.success("Consulta actualizada");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al actualizar");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground mb-2">
        Consultas recibidas ({rows.length})
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded border border-border p-3 animate-pulse space-y-2">
              <div className="h-3 rounded bg-foreground/10 w-2/3" />
              <div className="h-3 rounded bg-foreground/10 w-1/2" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-[11px] font-mono text-muted-foreground py-2">
          Aún sin consultas para este lote.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const d = drafts[r.id] ?? { status: r.status, notes: r.seller_notes ?? "" };
            const dirty = d.status !== r.status || d.notes !== (r.seller_notes ?? "");
            return (
              <li key={r.id} className="rounded border border-border p-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-foreground">
                      <MessageSquare className="w-3 h-3 inline mr-1 -mt-0.5 text-gold" />
                      {r.buyer_email ?? "comprador"} · {r.buyer_role}
                      {r.company_name && ` · ${r.company_name}`}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                      {r.target_volume_t != null && `${r.target_volume_t} t · `}
                      {r.target_price_usd_t != null && `US$ ${r.target_price_usd_t}/t · `}
                      {new Date(r.created_at).toLocaleDateString("es-CL")}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${STATUS_CLS[r.status] ?? "border-border"}`}
                  >
                    {INQUIRY_STATUS_LABELS[r.status] ?? r.status}
                  </span>
                </div>
                {r.message && (
                  <p className="mt-2 text-xs text-foreground/80 whitespace-pre-line">{r.message}</p>
                )}
                <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                  <select
                    value={d.status}
                    onChange={(e) =>
                      setDrafts((cur) => ({ ...cur, [r.id]: { ...d, status: e.target.value } }))
                    }
                    className="rounded border border-border bg-transparent px-2 py-1 text-[11px] font-mono"
                  >
                    {INQUIRY_PIPELINE.map((s) => (
                      <option key={s} value={s}>
                        {INQUIRY_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <input
                    value={d.notes}
                    onChange={(e) =>
                      setDrafts((cur) => ({ ...cur, [r.id]: { ...d, notes: e.target.value } }))
                    }
                    placeholder="Notas internas (muestra enviada, contraoferta…)"
                    maxLength={2000}
                    className="flex-1 min-w-[160px] rounded border border-border bg-transparent px-2 py-1 text-[11px] font-mono"
                  />
                  <button
                    type="button"
                    disabled={!dirty || saving === r.id}
                    onClick={() => void save(r)}
                    className="inline-flex items-center gap-1 rounded bg-teal text-black px-2.5 py-1 text-[11px] font-mono font-semibold hover:bg-teal/90 disabled:opacity-40"
                  >
                    {saving === r.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Save className="w-3 h-3" />
                    )}
                    Guardar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
