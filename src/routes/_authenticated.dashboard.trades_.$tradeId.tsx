import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Ship,
  FileText,
  Handshake,
  MessageSquare,
  Anchor,
  ExternalLink,
  PackageCheck,
} from "lucide-react";
import { getTradeTracking } from "@/lib/tradeTracking.functions";
import {
  JOURNEY_STEPS,
  journeyStep,
  journeyHeadline,
  normalizeEvent,
  type TimelineItem,
} from "@/lib/tradeTimeline";
import { SHIPMENT_STATUS_LABELS } from "@/lib/shipments";

// Trazabilidad unificada del trade — "Uber de los commodities": un titular de
// estado, el viaje en pasos y el timeline completo (acuerdo, documentos, pago,
// embarques) en una sola línea de tiempo.

export const Route = createFileRoute("/_authenticated/dashboard/trades_/$tradeId")({
  head: () => ({ meta: [{ title: "Trazabilidad de la operación — Geocapitals" }] }),
  component: TrackingPage,
});

const CATEGORY_ICON: Record<TimelineItem["category"], typeof Ship> = {
  trade: Handshake,
  document: FileText,
  shipment: Ship,
  message: MessageSquare,
};

const CATEGORY_COLOR: Record<TimelineItem["category"], string> = {
  trade: "text-primary",
  document: "text-signal-violet",
  shipment: "text-teal",
  message: "text-muted-foreground",
};

function TrackingPage() {
  const { tradeId } = Route.useParams();
  const fn = useServerFn(getTradeTracking);
  const { data, isLoading } = useQuery({
    queryKey: ["trade-tracking", tradeId],
    queryFn: () => fn({ data: { tradeId } }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl">
        <div className="h-40 rounded-md bg-muted/20 animate-pulse" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-6 max-w-3xl text-center py-20">
        <h1 className="text-xl font-semibold mb-2">Operación no encontrada</h1>
        <p className="text-sm text-text-secondary mb-4">
          No existe o no eres contraparte de este trade.
        </p>
        <Link to="/dashboard/trades" className="text-primary underline text-sm">
          Volver al Trade Desk
        </Link>
      </div>
    );
  }

  const { trade, shipments, events, docsCount } = data;
  const activeShipment = shipments[0] ?? null;
  const step = journeyStep(trade.stage, activeShipment?.status ?? null);
  const headline = journeyHeadline(step, {
    vessel: activeShipment?.vessel_name,
    etaIso: activeShipment?.eta,
    arrived: activeShipment?.status === "arrived",
  });
  const items = events.map(normalizeEvent).reverse(); // más reciente primero

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <Link
        to="/dashboard/trades"
        className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Trade Desk
      </Link>

      {/* Cabecera estilo tracking */}
      <div className="rounded-md border border-border bg-bg-secondary/20 p-5">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {trade.reference ?? trade.id.slice(0, 8)} · {trade.commodity ?? "commodity"}
          {trade.quantity_t ? ` · ${trade.quantity_t} t` : ""}
          {trade.incoterm ? ` · ${trade.incoterm}` : ""}
        </div>
        <h1 className="text-xl md:text-2xl font-bold mt-1">{headline}</h1>

        {/* Stepper del viaje */}
        <div className="mt-5 flex items-center">
          {JOURNEY_STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-3.5 h-3.5 rounded-full border-2 ${
                    i < step
                      ? "bg-primary border-primary"
                      : i === step
                        ? "bg-primary/30 border-primary animate-pulse"
                        : "bg-transparent border-muted"
                  }`}
                />
                <span
                  className={`mt-1.5 text-[9px] font-mono uppercase tracking-wide ${
                    i <= step ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < JOURNEY_STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 mb-4 ${i < step ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Carga activa */}
      {activeShipment && (
        <div className="rounded-md border border-border bg-bg-secondary/20 p-4">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            <PackageCheck className="w-3.5 h-3.5 text-teal" /> Carga ·{" "}
            {SHIPMENT_STATUS_LABELS[activeShipment.status]}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
            {activeShipment.vessel_name && (
              <span className="inline-flex items-center gap-1">
                <Ship className="w-3 h-3" /> {activeShipment.vessel_name}
              </span>
            )}
            {activeShipment.bl_number && <span>BL {activeShipment.bl_number}</span>}
            {(activeShipment.port_loading || activeShipment.port_discharge) && (
              <span className="inline-flex items-center gap-1">
                <Anchor className="w-3 h-3" />
                {activeShipment.port_loading ?? "—"} → {activeShipment.port_discharge ?? "—"}
              </span>
            )}
            {activeShipment.eta && (
              <span>ETA {new Date(activeShipment.eta).toLocaleDateString("es-CL")}</span>
            )}
            {activeShipment.tracking_url && (
              <a
                href={activeShipment.tracking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                Tracking naviera <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Documentos del acuerdo — generar, enviar a firma y trazar */}
      <div className="rounded-md border border-border bg-bg-secondary/20 p-4">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
          <FileText className="w-3.5 h-3.5 text-signal-violet" /> Documentos del acuerdo ·{" "}
          {docsCount} archivo(s)
        </div>
        <p className="text-xs text-text-secondary mb-3">
          Genera el documento con la contraparte precargada — al firmarse queda registrado en este
          timeline automáticamente.
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["nda", "NDA"],
              ["data-sheet", "Data Sheet"],
              ["loi", "LOI"],
              ["spa", "Contrato SPA"],
            ] as const
          ).map(([tpl, label]) => (
            <Link
              key={tpl}
              to="/dashboard/documentos/$templateId"
              params={{ templateId: tpl }}
              search={{ trade: trade.id }}
              className="px-3 py-1.5 rounded border border-border text-xs hover:bg-accent inline-flex items-center gap-1.5"
            >
              <FileText className="w-3 h-3" /> {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Timeline unificado */}
      <div>
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-3">
          Historial de la operación · {items.length} evento(s)
        </h2>
        {items.length === 0 ? (
          <div className="rounded-md border border-border p-6 text-center text-sm text-text-secondary">
            Aún no hay eventos registrados en esta operación.
          </div>
        ) : (
          <ol className="relative border-l border-border ml-2 space-y-4">
            {items.map((it) => {
              const Icon = CATEGORY_ICON[it.category];
              return (
                <li key={it.id} className="ml-5">
                  <span
                    className={`absolute -left-[9px] mt-1 flex w-4 h-4 items-center justify-center rounded-full bg-background border border-border`}
                  >
                    <Icon className={`w-2.5 h-2.5 ${CATEGORY_COLOR[it.category]}`} />
                  </span>
                  <div className="text-sm font-medium">{it.title}</div>
                  {it.detail && (
                    <div className="text-xs text-text-secondary mt-0.5">{it.detail}</div>
                  )}
                  <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    {new Date(it.at).toLocaleString("es-CL")}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
