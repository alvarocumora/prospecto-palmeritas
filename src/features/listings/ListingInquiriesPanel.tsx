// Panel del dueño del listing: interesados que solicitaron info o firmaron NDA.
import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, ShieldCheck, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { listInquiriesForOwner, type ListingInquiryRow } from "@/lib/dataRoom.functions";

const STATUS_LABEL: Record<string, string> = {
  inquiry: "Consulta",
  nda_signed: "NDA firmado",
  in_diligence: "En due diligence",
  loi: "LOI",
  closed_won: "Cerrado — ganado",
  closed_lost: "Cerrado — perdido",
};

export function ListingInquiriesPanel({ listingId }: { listingId: string }) {
  const [rows, setRows] = useState<ListingInquiryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listInquiriesForOwner({ data: { listingId } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando interesados");
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="rounded border border-border bg-bg-panel p-4">
      <header className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">Interesados ({rows.length})</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Inversionistas que solicitaron información o firmaron el NDA.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded border border-border px-2 py-1 text-[11px] font-mono hover:border-gold/60"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Recargar
        </button>
      </header>

      {loading ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" /> Cargando…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded border border-dashed border-border bg-background/40 p-6 text-center text-xs text-muted-foreground">
          Aún no hay solicitudes. Cuando un inversionista firme el NDA o pida info desde tu ficha
          pública, aparecerá aquí.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded border border-border bg-background/40 p-3 text-xs"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">
                    {r.inquirer_name ?? r.inquirer_email ?? "Inversionista"}
                  </div>
                  {r.inquirer_email && (
                    <a
                      href={`mailto:${r.inquirer_email}`}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-gold"
                    >
                      <Mail className="w-3 h-3" /> {r.inquirer_email}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {r.nda_signed_at && (
                    <span className="inline-flex items-center gap-1 rounded border border-teal/40 bg-teal/10 px-1.5 py-0.5 text-[10px] font-mono text-teal">
                      <ShieldCheck className="w-3 h-3" /> NDA
                    </span>
                  )}
                  <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
              </div>
              {r.message && (
                <p className="mt-2 flex items-start gap-1.5 text-muted-foreground leading-relaxed">
                  <MessageCircle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span className="whitespace-pre-line">{r.message}</span>
                </p>
              )}
              <div className="mt-2 text-[10px] font-mono text-muted-foreground/70">
                {new Date(r.created_at).toLocaleString("es-CL")}
                {r.nda_signed_at &&
                  ` · NDA ${new Date(r.nda_signed_at).toLocaleDateString("es-CL")}`}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
