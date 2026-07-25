import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMyRfqs, closeRfq } from "@/lib/rfqs/rfq.functions";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/rfqs/")({
  head: () => ({
    meta: [
      { title: "Compradores · RFQ — Geocapitals" },
      {
        name: "description",
        content:
          "Publica y administra tus solicitudes de cotización (RFQ) de mineral. Recibe postulaciones de proveedores calificados con puntaje de riesgo.",
      },
    ],
  }),
  component: RfqIndex,
});

type Row = Awaited<ReturnType<typeof listMyRfqs>>[number];

const STATUS_LABEL: Record<string, string> = {
  borrador: "Borrador",
  publicado: "Publicado",
  en_evaluacion: "En evaluación",
  adjudicado: "Adjudicado",
  cerrado: "Cerrado",
  cancelado: "Cancelado",
};

function RfqIndex() {
  const list = useServerFn(listMyRfqs);
  const close = useServerFn(closeRfq);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    setRows(await list());
    setLoading(false);
  };
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      data-theme="im-light"
      className="min-h-screen bg-[hsl(var(--surface-paper))] text-[hsl(var(--content))]"
    >
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--content-subtle))]">
              Comprador · Solicitudes de cotización
            </div>
            <h1 className="mt-1 font-serif text-3xl">Mis RFQ</h1>
            <p className="mt-1 max-w-2xl text-sm text-[hsl(var(--content-subtle))]">
              Publica lo que necesitas comprar. Geocapitals distribuye tu RFQ entre proveedores
              verificados y te devuelve postulaciones con puntaje de riesgo.
            </p>
          </div>
          <Link to="/dashboard/rfqs/nuevo">
            <Button>
              <Plus className="mr-1 h-4 w-4" /> Nuevo RFQ
            </Button>
          </Link>
        </div>

        <div className="overflow-x-auto rounded border border-[hsl(var(--hairline))] bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-[hsl(var(--surface))] text-xs uppercase tracking-wide text-[hsl(var(--content-subtle))]">
              <tr>
                <th className="p-3 text-left">Folio</th>
                <th className="p-3 text-left">Comprador</th>
                <th className="p-3 text-left">Destino</th>
                <th className="p-3 text-left">Incoterm</th>
                <th className="p-3 text-left">Público</th>
                <th className="p-3 text-left">Estado</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[hsl(var(--content-subtle))]">
                    Aún no tienes RFQ. Crea el primero.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-[hsl(var(--hairline))]">
                    <td className="p-3 font-mono text-xs">{r.public_ref}</td>
                    <td className="p-3">
                      <div className="font-medium">{r.buyer_company ?? r.buyer_name}</div>
                      <div className="text-xs text-[hsl(var(--content-subtle))]">{r.buyer_name}</div>
                    </td>
                    <td className="p-3">{r.destination_country ?? "—"}</td>
                    <td className="p-3">{r.incoterm ?? "—"}</td>
                    <td className="p-3">{r.is_public ? "Sí" : "No"}</td>
                    <td className="p-3">
                      <span className="rounded-full bg-[hsl(var(--surface))] px-2 py-0.5 text-xs uppercase tracking-wide">
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {r.status === "publicado" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await close({ data: { id: r.id, status: "cerrado" } });
                              await refresh();
                            }}
                          >
                            Cerrar
                          </Button>
                        )}
                        <Link
                          to="/dashboard/rfqs/$id"
                          params={{ id: r.id }}
                          className="text-sm text-[hsl(var(--accent-brand))]"
                        >
                          Abrir →
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
