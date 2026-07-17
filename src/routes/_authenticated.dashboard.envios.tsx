import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ship, Plus, ExternalLink, AlertTriangle, Anchor, Route as RouteIcon } from "lucide-react";
import {
  listMyShipments,
  createShipment,
  advanceShipment,
  listShippableTrades,
  type ShipmentRow,
} from "@/lib/shipments.functions";
import {
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABELS,
  shipmentStatusIndex,
  nextShipmentStatus,
  isShipmentDelayed,
} from "@/lib/shipments";

export const Route = createFileRoute("/_authenticated/dashboard/envios")({
  head: () => ({ meta: [{ title: "Envíos y logística — Geocapitals" }] }),
  component: EnviosPage,
});

function StatusTimeline({ s }: { s: ShipmentRow }) {
  const idx = shipmentStatusIndex(s.status);
  return (
    <div className="flex items-center gap-1">
      {SHIPMENT_STATUSES.map((st, i) => (
        <div key={st} className="flex items-center gap-1">
          <div
            title={SHIPMENT_STATUS_LABELS[st]}
            className={`w-2.5 h-2.5 rounded-full ${i <= idx ? "bg-primary" : "bg-muted"}`}
          />
          {i < SHIPMENT_STATUSES.length - 1 && (
            <div className={`w-5 h-0.5 ${i < idx ? "bg-primary" : "bg-muted"}`} />
          )}
        </div>
      ))}
      <span className="ml-2 text-[10px] font-mono uppercase tracking-wider">
        {SHIPMENT_STATUS_LABELS[s.status]}
      </span>
    </div>
  );
}

function EnviosPage() {
  const listFn = useServerFn(listMyShipments);
  const tradesFn = useServerFn(listShippableTrades);
  const createFn = useServerFn(createShipment);
  const advanceFn = useServerFn(advanceShipment);

  const { data: shipments, refetch } = useQuery({
    queryKey: ["my-shipments"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });
  const { data: trades } = useQuery({
    queryKey: ["shippable-trades"],
    queryFn: () => tradesFn(),
    staleTime: 60_000,
  });

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tradeId: "",
    vesselName: "",
    blNumber: "",
    portLoading: "",
    portDischarge: "",
    eta: "",
    quantityT: "",
  });

  const onCreate = async () => {
    if (!form.tradeId) {
      toast.error("Selecciona el trade del embarque.");
      return;
    }
    setSaving(true);
    try {
      await createFn({
        data: {
          tradeId: form.tradeId,
          vesselName: form.vesselName || undefined,
          blNumber: form.blNumber || undefined,
          portLoading: form.portLoading || undefined,
          portDischarge: form.portDischarge || undefined,
          eta: form.eta || undefined,
          quantityT: form.quantityT ? Number(form.quantityT) : undefined,
        },
      });
      toast.success("Embarque creado y registrado en la trazabilidad del trade.");
      setShowForm(false);
      setForm({
        tradeId: "",
        vesselName: "",
        blNumber: "",
        portLoading: "",
        portDischarge: "",
        eta: "",
        quantityT: "",
      });
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el embarque.");
    } finally {
      setSaving(false);
    }
  };

  const onAdvance = async (s: ShipmentRow) => {
    const next = nextShipmentStatus(s.status);
    if (!next) return;
    try {
      await advanceFn({ data: { id: s.id, next } });
      toast.success(`Embarque → ${SHIPMENT_STATUS_LABELS[next]} (registrado en el trade).`);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo avanzar.");
    }
  };

  const now = new Date();

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1200px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Ship className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold">Envíos y logística</h1>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            Embarques de tus trades: nave, BL, puertos, ETA y estado. Cada cambio queda en la
            trazabilidad del trade.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Nuevo embarque
        </button>
      </div>

      {showForm && (
        <div className="rounded-md border border-border bg-bg-secondary/20 p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="text-xs sm:col-span-2">
            <span className="block text-text-secondary mb-1">Trade *</span>
            <select
              value={form.tradeId}
              onChange={(e) => setForm({ ...form, tradeId: e.target.value })}
              className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm"
            >
              <option value="">Selecciona un trade (SPA/pago/embarque)…</option>
              {(trades ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.reference ?? t.id.slice(0, 8)} · {t.commodity ?? "—"} · {t.quantity_t ?? "—"} t
                  · {t.stage}
                </option>
              ))}
            </select>
          </label>
          {(
            [
              ["vesselName", "Nave"],
              ["blNumber", "BL / Bill of Lading"],
              ["portLoading", "Puerto de carga"],
              ["portDischarge", "Puerto de descarga"],
              ["quantityT", "Toneladas"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="text-xs">
              <span className="block text-text-secondary mb-1">{label}</span>
              <input
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm"
              />
            </label>
          ))}
          <label className="text-xs">
            <span className="block text-text-secondary mb-1">ETA</span>
            <input
              type="date"
              value={form.eta}
              onChange={(e) => setForm({ ...form, eta: e.target.value })}
              className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm"
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-4">
            <button
              onClick={() => void onCreate()}
              disabled={saving}
              className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm disabled:opacity-50"
            >
              {saving ? "Creando…" : "Crear embarque"}
            </button>
          </div>
        </div>
      )}

      {!shipments ? (
        <div className="h-24 rounded bg-muted/20 animate-pulse" />
      ) : shipments.length === 0 ? (
        <div className="rounded-md border border-border p-8 text-center text-sm text-text-secondary">
          Sin embarques todavía. Crea el primero desde un trade en etapa SPA, pago o embarque — o
          inicia un trade desde el{" "}
          <Link to="/dashboard/trades" className="text-primary underline">
            Trade Desk
          </Link>
          .
        </div>
      ) : (
        <div className="space-y-3">
          {shipments.map((s) => {
            const delayed = isShipmentDelayed(s.status, s.eta, now);
            const next = nextShipmentStatus(s.status);
            return (
              <div key={s.id} className="rounded-md border border-border bg-bg-secondary/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold">
                        {s.reference ?? s.id.slice(0, 8)}
                      </span>
                      <span className="text-xs text-text-secondary">
                        Trade {s.trade?.reference ?? s.trade_id.slice(0, 8)}
                        {s.trade?.commodity ? ` · ${s.trade.commodity}` : ""}
                      </span>
                      {delayed && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider bg-red-500/15 text-red-600">
                          <AlertTriangle className="w-3 h-3" /> Atrasado
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                      {s.vessel_name && (
                        <span className="inline-flex items-center gap-1">
                          <Ship className="w-3 h-3" /> {s.vessel_name}
                        </span>
                      )}
                      {s.bl_number && <span>BL {s.bl_number}</span>}
                      {(s.port_loading || s.port_discharge) && (
                        <span className="inline-flex items-center gap-1">
                          <Anchor className="w-3 h-3" />
                          {s.port_loading ?? "—"} → {s.port_discharge ?? "—"}
                        </span>
                      )}
                      {s.quantity_t != null && <span>{s.quantity_t} t</span>}
                      {s.eta && <span>ETA {new Date(s.eta).toLocaleDateString("es-CL")}</span>}
                      {s.tracking_url && (
                        <a
                          href={s.tracking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-0.5"
                        >
                          Tracking <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <Link
                        to="/dashboard/trades/$tradeId"
                        params={{ tradeId: s.trade_id }}
                        className="text-primary hover:underline inline-flex items-center gap-0.5"
                      >
                        <RouteIcon className="w-3 h-3" /> Ver trazabilidad
                      </Link>
                    </div>
                    <div className="mt-3">
                      <StatusTimeline s={s} />
                    </div>
                  </div>
                  {next && (
                    <button
                      onClick={() => void onAdvance(s)}
                      className="shrink-0 px-3 py-1.5 rounded border border-border text-xs hover:bg-accent"
                    >
                      Marcar {SHIPMENT_STATUS_LABELS[next]} →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
