// Bandeja del buyer: sus cotizaciones de commodities con avance del pipeline
// y el hilo de mensajes con cada seller.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, MessageSquare, Package, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  listMyBuyerInquiries,
  INQUIRY_STATUS_LABELS,
  type MyBuyerInquiryRow,
} from "@/lib/marketplace.functions";
import { InquiryThread } from "@/features/commodities/InquiryThread";
import { commodityLabel, countryFlag, formLabel } from "@/lib/commodityLabels";

export const Route = createFileRoute("/_authenticated/dashboard/my-inquiries")({
  head: () => ({ meta: [{ title: "Mis cotizaciones — Geocapitals" }] }),
  component: MyInquiriesPage,
});

const STATUS_CLS: Record<string, string> = {
  new: "border-warn/40 bg-warn/10 text-warn",
  contacted: "border-border text-muted-foreground",
  sample_requested: "border-gold/40 bg-gold/10 text-gold",
  offer_sent: "border-gold/40 bg-gold/10 text-gold",
  negotiating: "border-teal/40 bg-teal/10 text-teal",
  closed_won: "border-teal/40 bg-teal/10 text-teal",
  closed_lost: "border-danger/40 bg-danger/10 text-danger",
};

// Progreso visual del pipeline (cerrada perdida no avanza la barra)
const PIPELINE_PROGRESS: Record<string, number> = {
  new: 1,
  contacted: 2,
  sample_requested: 3,
  offer_sent: 4,
  negotiating: 5,
  closed_won: 6,
  closed_lost: 0,
};

function MyInquiriesPage() {
  const [rows, setRows] = useState<MyBuyerInquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openThread, setOpenThread] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listMyBuyerInquiries());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando cotizaciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-3 h-3" /> Dashboard
          </Link>
          <h1 className="text-xl md:text-2xl font-bold mt-1 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-gold" /> Mis cotizaciones
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Sigue el avance de cada consulta y conversa con el seller sin salir de la plataforma.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded border border-border bg-bg-panel px-3 py-1.5 text-xs font-mono hover:border-gold/60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Recargar
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded border border-border bg-bg-panel p-4 animate-pulse space-y-2"
            >
              <div className="h-4 rounded bg-foreground/10 w-2/3" />
              <div className="h-3 rounded bg-foreground/10 w-1/2" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded border border-border bg-bg-panel p-8 text-center">
          <Package className="w-8 h-8 text-gold mx-auto mb-3" strokeWidth={1.5} />
          <div className="text-sm text-foreground font-medium">Aún no tienes cotizaciones</div>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
            Explora el marketplace de commodities y solicita una oferta — el avance de cada
            negociación aparecerá aquí.
          </p>
          <Link
            to="/marketplace"
            className="mt-4 inline-flex items-center gap-1.5 rounded bg-gold text-black px-4 py-2 text-xs font-mono font-semibold hover:bg-gold/90"
          >
            Ver marketplace →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const progress = PIPELINE_PROGRESS[r.status] ?? 1;
            return (
              <li key={r.id} className="rounded border border-border bg-bg-panel p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground leading-snug">
                      {r.lot ? (
                        <Link
                          to="/marketplace/$lotId"
                          params={{ lotId: r.lot.id }}
                          className="hover:text-gold transition-colors"
                        >
                          {r.lot.title}
                        </Link>
                      ) : (
                        "Lote no disponible"
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {r.lot && (
                        <>
                          {countryFlag(r.lot.country)} {commodityLabel(r.lot.commodity)} ·{" "}
                          {formLabel(r.lot.form)}
                          {r.lot.incoterm && ` · ${r.lot.incoterm}`}
                        </>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-1">
                      {r.target_volume_t != null && `${r.target_volume_t} t objetivo · `}
                      {r.target_price_usd_t != null && `US$ ${r.target_price_usd_t}/t · `}
                      Enviada {new Date(r.created_at).toLocaleDateString("es-CL")}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${STATUS_CLS[r.status] ?? "border-border"}`}
                  >
                    {INQUIRY_STATUS_LABELS[r.status] ?? r.status}
                  </span>
                </div>

                {/* Barra de avance del pipeline */}
                <div className="mt-3 flex items-center gap-1">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-1 flex-1 rounded-full ${
                        r.status === "closed_lost"
                          ? "bg-danger/30"
                          : i < progress
                            ? "bg-teal"
                            : "bg-foreground/10"
                      }`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setOpenThread((cur) => (cur === r.id ? null : r.id))}
                  className="mt-3 inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-gold transition-colors"
                >
                  <MessageSquare className="w-3 h-3" />
                  {openThread === r.id ? "Cerrar conversación" : "Conversar con el seller"}
                </button>
                {openThread === r.id && <InquiryThread inquiryId={r.id} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
