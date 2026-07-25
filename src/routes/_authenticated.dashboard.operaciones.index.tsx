import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listOperations } from "@/lib/operations/operations.functions";
import { Plus, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/operaciones/")({
  head: () => ({
    meta: [
      { title: "Operaciones · Trade Desk — Geocapitals" },
      { name: "description", content: "Workspace transaccional por operación con portales privados para comprador y vendedor." },
    ],
  }),
  component: OperationsIndex,
});

type Row = Awaited<ReturnType<typeof listOperations>>[number];

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  counterparties_invited: "Contrapartes invitadas",
  nda_in_progress: "NDA en proceso",
  doc_collection: "Recopilación documental",
  kyc_review: "KYC en revisión",
  due_diligence: "Due diligence",
  technical_eval: "Evaluación técnica",
  commercial_eval: "Evaluación comercial",
  negotiation: "Negociación",
  contract: "Contrato",
  financial_instrument: "Instrumento financiero",
  logistics: "Logística",
  in_transit: "En tránsito",
  completed: "Completada",
  suspended: "Suspendida",
  cancelled: "Cancelada",
};

function OperationsIndex() {
  const list = useServerFn(listOperations);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setRows(await list());
      setLoading(false);
    })();
  }, [list]);

  return (
    <div data-theme="im-light" className="min-h-screen bg-[hsl(var(--surface-paper))] text-[hsl(var(--content))]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-[hsl(var(--content-subtle))]">
              Trade Desk · Operaciones
            </div>
            <h1 className="mt-1 font-serif text-3xl">Workspaces por operación</h1>
            <p className="mt-2 max-w-2xl text-sm text-[hsl(var(--content-subtle))]">
              Cada pedido genera dos portales privados (comprador y vendedor) con checklist, firmas y trazabilidad
              en vivo.
            </p>
          </div>
          <Link
            to="/dashboard/operaciones/nuevo"
            className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--accent-brand))] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Nueva operación
          </Link>
        </div>

        {loading ? (
          <div className="text-sm text-[hsl(var(--content-subtle))]">Cargando…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[hsl(var(--hairline))] bg-white/50 p-12 text-center">
            <p className="text-sm text-[hsl(var(--content-subtle))]">
              Aún no hay operaciones. Crea la primera para generar los portales de comprador y vendedor.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[hsl(var(--hairline))] bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-[hsl(var(--hairline))] bg-[hsl(var(--surface-paper))]">
                <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--content-subtle))]">
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Operación</th>
                  <th className="px-4 py-3">Comprador</th>
                  <th className="px-4 py-3">Vendedor</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[hsl(var(--hairline))] last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-[hsl(var(--content-subtle))]">{r.commodity}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{r.buyer_company ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">{r.seller_company ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">{STATUS_LABEL[r.status] ?? r.status}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/dashboard/operaciones/$id"
                        params={{ id: r.id }}
                        className="inline-flex items-center gap-1 text-xs text-[hsl(var(--accent-brand))] hover:underline"
                      >
                        Abrir <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
