import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Banknote } from "lucide-react";
import {
  listMyAdvanceRequests,
  cancelAdvanceRequest,
  listAdvanceFundingQueue,
  setAdvanceRequestStatus,
  type AdvanceRequestRow,
} from "@/lib/advanceRequests.functions";
import { ADVANCE_STATUS_LABELS, nextStatusesFor, type AdvanceStatus } from "@/lib/advanceRequests";

export const Route = createFileRoute("/_authenticated/dashboard/anticipos")({
  head: () => ({ meta: [{ title: "Anticipos — Geocapitals" }] }),
  component: AnticiposPage,
});

const STATUS_STYLE: Record<AdvanceStatus, string> = {
  requested: "bg-sky-500/10 text-sky-600 border-sky-500/30",
  under_review: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  funded: "bg-emerald-600/15 text-emerald-700 border-emerald-600/40",
  rejected: "bg-red-500/10 text-red-600 border-red-500/30",
  cancelled: "bg-slate-500/10 text-text-secondary border-slate-400/30",
};

function StatusBadge({ status }: { status: AdvanceStatus }) {
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_STYLE[status]}`}
    >
      {ADVANCE_STATUS_LABELS[status]}
    </span>
  );
}

function AmountCell({ r }: { r: AdvanceRequestRow }) {
  return (
    <span>
      US$ {r.requested_amount_usd.toLocaleString("en-US")}
      <span className="text-text-secondary text-[11px]">
        {" "}
        / {r.max_advance_usd.toLocaleString("en-US")} máx · {r.advance_rate_pct}%
      </span>
    </span>
  );
}

function AnticiposPage() {
  const mineFn = useServerFn(listMyAdvanceRequests);
  const cancelFn = useServerFn(cancelAdvanceRequest);
  const queueFn = useServerFn(listAdvanceFundingQueue);
  const setStatusFn = useServerFn(setAdvanceRequestStatus);

  const { data: mine, refetch: refetchMine } = useQuery({
    queryKey: ["my-advance-requests"],
    queryFn: () => mineFn(),
    staleTime: 30_000,
  });

  // La cola del financista solo carga si el usuario es super admin (si no, el
  // server fn lanza y la query queda en error → no se muestra).
  const { data: queue, refetch: refetchQueue } = useQuery({
    queryKey: ["advance-funding-queue"],
    queryFn: () => queueFn(),
    retry: false,
    staleTime: 30_000,
  });

  const onCancel = async (id: string) => {
    try {
      await cancelFn({ data: { id } });
      toast.success("Solicitud cancelada.");
      refetchMine();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cancelar.");
    }
  };

  const onSetStatus = async (id: string, status: AdvanceStatus) => {
    try {
      await setStatusFn({
        data: { id, status: status as "under_review" | "approved" | "funded" | "rejected" },
      });
      toast.success(`Solicitud → ${ADVANCE_STATUS_LABELS[status]}.`);
      refetchQueue();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar.");
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Banknote className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-semibold">Anticipos</h1>
      </div>

      {/* Mis solicitudes (productor) */}
      <section className="space-y-2">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary">
          Mis solicitudes
        </h2>
        {!mine ? (
          <div className="h-16 rounded bg-muted/20 animate-pulse" />
        ) : mine.length === 0 ? (
          <div className="rounded-md border border-border bg-bg-secondary/20 p-6 text-center text-sm text-text-secondary">
            No has solicitado anticipos. Solicítalos desde la ficha de tu lote en el marketplace.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="text-left text-text-secondary uppercase tracking-wider text-[10px] bg-bg-secondary/40 border-b border-border">
                <tr>
                  <th className="py-2 px-3">Lote</th>
                  <th className="py-2 px-2">Monto</th>
                  <th className="py-2 px-2">Estado</th>
                  <th className="py-2 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {mine.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="py-2 px-3 font-medium">{r.lot_title ?? r.lot_id.slice(0, 8)}</td>
                    <td className="py-2 px-2">
                      <AmountCell r={r} />
                    </td>
                    <td className="py-2 px-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="py-2 px-3 text-right">
                      {nextStatusesFor("requester", r.status).includes("cancelled") && (
                        <button
                          onClick={() => void onCancel(r.id)}
                          className="text-red-600 hover:underline"
                        >
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Cola del financista (solo super admin) */}
      {queue && queue.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary">
            Cola de financiamiento
          </h2>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="text-left text-text-secondary uppercase tracking-wider text-[10px] bg-bg-secondary/40 border-b border-border">
                <tr>
                  <th className="py-2 px-3">Lote</th>
                  <th className="py-2 px-2">Monto</th>
                  <th className="py-2 px-2">Riesgo</th>
                  <th className="py-2 px-2">Estado</th>
                  <th className="py-2 px-3 text-right">Decisión</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((r) => {
                  const options = nextStatusesFor("funder", r.status);
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="py-2 px-3 font-medium">
                        {r.lot_title ?? r.lot_id.slice(0, 8)}
                      </td>
                      <td className="py-2 px-2">
                        <AmountCell r={r} />
                      </td>
                      <td className="py-2 px-2 text-text-secondary">{r.eligibility}</td>
                      <td className="py-2 px-2">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex gap-1.5 justify-end flex-wrap">
                          {options.map((opt) => (
                            <button
                              key={opt}
                              onClick={() => void onSetStatus(r.id, opt)}
                              className="px-2 py-0.5 rounded border border-border hover:bg-accent"
                            >
                              {ADVANCE_STATUS_LABELS[opt]}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
