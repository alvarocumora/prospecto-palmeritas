// Admin de tarifas de flete. Lectura para cualquier autenticado; edición para
// super_admin (RLS aplica en el servidor, aquí escondemos los controles).
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ship, Plus, Trash2 } from "lucide-react";
import {
  listFreightRates,
  upsertFreightRate,
  deleteFreightRate,
  type FreightRate,
} from "@/lib/freight.functions";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard/fletes")({
  head: () => ({ meta: [{ title: "Tarifas de flete — Geocapitals" }] }),
  component: FreightPage,
});

function FreightPage() {
  const listFn = useServerFn(listFreightRates);
  const upsertFn = useServerFn(upsertFreightRate);
  const delFn = useServerFn(deleteFreightRate);
  const qc = useQueryClient();
  const isAdmin = useIsSuperAdmin();

  const { data, isLoading } = useQuery({ queryKey: ["freight-rates"], queryFn: () => listFn() });
  const rates = (data ?? []) as FreightRate[];

  const [draft, setDraft] = useState<Partial<FreightRate>>({
    port_origin: "",
    port_destination: "",
    container_type: "bulk_mt",
    usd_rate: 0,
    transit_days: null,
    source: "manual",
    notes: null,
  });

  const upsert = useMutation({
    mutationFn: (payload: Partial<FreightRate>) =>
      upsertFn({
        data: {
          port_origin: payload.port_origin!,
          port_destination: payload.port_destination!,
          container_type: payload.container_type as "20ft" | "40ft" | "bulk_mt",
          usd_rate: Number(payload.usd_rate),
          transit_days: payload.transit_days ?? null,
          source: payload.source ?? null,
          notes: payload.notes ?? null,
        },
      }),
    onSuccess: () => {
      toast.success("Tarifa guardada");
      qc.invalidateQueries({ queryKey: ["freight-rates"] });
      setDraft({
        port_origin: "",
        port_destination: "",
        container_type: "bulk_mt",
        usd_rate: 0,
        transit_days: null,
        source: "manual",
        notes: null,
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Eliminada");
      qc.invalidateQueries({ queryKey: ["freight-rates"] });
    },
  });

  return (
    <div className="p-4 md:p-6 space-y-4" data-theme="im-light">
      <div className="flex items-center gap-2">
        <Ship className="w-5 h-5 text-accent-brand" />
        <h1 className="text-xl font-semibold">Tarifas de flete marítimo</h1>
      </div>
      <p className="text-xs text-muted-foreground">
        Base de tarifas por ruta usada por la calculadora CIF/FOB en cada trade.
        {isAdmin ? " Como admin puedes crear, editar o eliminar." : " Sólo lectura."}
      </p>

      {isAdmin && (
        <div className="rounded-md border border-hairline bg-surface p-3">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Nueva tarifa
          </div>
          <div className="grid gap-2 md:grid-cols-6">
            <input
              placeholder="Origen"
              value={draft.port_origin ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, port_origin: e.target.value }))}
              className="rounded border border-hairline bg-transparent px-2 py-1 text-xs"
            />
            <input
              placeholder="Destino"
              value={draft.port_destination ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, port_destination: e.target.value }))}
              className="rounded border border-hairline bg-transparent px-2 py-1 text-xs"
            />
            <select
              value={draft.container_type ?? "bulk_mt"}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  container_type: e.target.value as "20ft" | "40ft" | "bulk_mt",
                }))
              }
              className="rounded border border-hairline bg-transparent px-2 py-1 text-xs"
            >
              <option value="bulk_mt">Bulk USD/MT</option>
              <option value="20ft">20ft</option>
              <option value="40ft">40ft</option>
            </select>
            <input
              type="number"
              placeholder="USD"
              value={draft.usd_rate ?? 0}
              onChange={(e) => setDraft((d) => ({ ...d, usd_rate: Number(e.target.value) }))}
              className="rounded border border-hairline bg-transparent px-2 py-1 text-xs"
            />
            <input
              type="number"
              placeholder="Días"
              value={draft.transit_days ?? ""}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  transit_days: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="rounded border border-hairline bg-transparent px-2 py-1 text-xs"
            />
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => upsert.mutate(draft)}
              disabled={
                !draft.port_origin || !draft.port_destination || !draft.usd_rate || upsert.isPending
              }
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Agregar
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border border-hairline bg-surface overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground text-left">
            <tr className="border-b border-hairline">
              <th className="p-2 font-mono font-normal">Origen</th>
              <th className="p-2 font-mono font-normal">Destino</th>
              <th className="p-2 font-mono font-normal">Modo</th>
              <th className="p-2 font-mono font-normal text-right">USD</th>
              <th className="p-2 font-mono font-normal text-right">Días</th>
              <th className="p-2 font-mono font-normal">Vigente</th>
              <th className="p-2 font-mono font-normal">Fuente</th>
              {isAdmin && <th className="p-2" />}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  Cargando…
                </td>
              </tr>
            ) : rates.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  Sin tarifas.
                </td>
              </tr>
            ) : (
              rates.map((r) => (
                <tr key={r.id} className="border-b border-hairline/50">
                  <td className="p-2">{r.port_origin}</td>
                  <td className="p-2">{r.port_destination}</td>
                  <td className="p-2 font-mono text-[10px]">{r.container_type}</td>
                  <td className="p-2 font-mono text-right">
                    {r.usd_rate.toLocaleString("es-CL")}
                  </td>
                  <td className="p-2 font-mono text-right">{r.transit_days ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">{r.valid_from}</td>
                  <td className="p-2 text-muted-foreground">{r.source ?? "—"}</td>
                  {isAdmin && (
                    <td className="p-2 text-right">
                      <button
                        onClick={() => del.mutate(r.id)}
                        className="text-destructive hover:text-destructive/80"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
