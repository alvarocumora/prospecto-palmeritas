import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { APP_STATUSES, closeRfq, decideApplication, getRfqDetail } from "@/lib/rfqs/rfq.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Award, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/rfqs/$id")({
  head: () => ({
    meta: [
      { title: "Detalle de RFQ — Geocapitals" },
      {
        name: "description",
        content: "Revisa postulaciones de proveedores calificados a tu RFQ y adjudica.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DetailPage,
});

type Detail = Awaited<ReturnType<typeof getRfqDetail>>;

const APP_LABEL: Record<string, string> = {
  pending: "Postulado",
  review: "Preseleccionado",
  approved: "Adjudicado",
  rejected: "Rechazado",
};
const APP_COLOR: Record<string, string> = {
  pending: "bg-sky-100 text-sky-800",
  review: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-gray-200 text-gray-700",
};
const RISK_COLOR: Record<string, string> = {
  bajo: "bg-emerald-100 text-emerald-800",
  medio: "bg-amber-100 text-amber-800",
  alto: "bg-orange-100 text-orange-800",
  critico: "bg-red-100 text-red-800",
};

function DetailPage() {
  const { id } = Route.useParams();
  const load = useServerFn(getRfqDetail);
  const decide = useServerFn(decideApplication);
  const close = useServerFn(closeRfq);
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setData(await load({ data: { id } }));
    setLoading(false);
  }, [load, id]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading || !data)
    return <div className="p-8 text-sm text-[hsl(var(--content-subtle))]">Cargando…</div>;
  const { rfq, products, applications } = data;

  return (
    <div
      data-theme="im-light"
      className="min-h-screen bg-[hsl(var(--surface-paper))] text-[hsl(var(--content))]"
    >
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Link
          to="/dashboard/rfqs"
          className="mb-6 inline-flex items-center gap-1 text-xs text-[hsl(var(--content-subtle))]"
        >
          <ArrowLeft className="h-3 w-3" /> Mis RFQ
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--content-subtle))]">
              RFQ {rfq.public_ref} · {rfq.destination_country ?? "—"}
            </div>
            <h1 className="mt-1 font-serif text-3xl">{rfq.buyer_company ?? rfq.buyer_name}</h1>
            <p className="mt-1 text-sm text-[hsl(var(--content-subtle))]">
              {rfq.incoterm ?? "—"} · Publicado{" "}
              {new Date(rfq.created_at).toLocaleDateString("es-CL")}
              {rfq.is_public ? " · Marketplace público" : " · Privado"}
            </p>
          </div>
          <div className="flex gap-2">
            {rfq.status === "publicado" && (
              <Button
                variant="outline"
                onClick={async () => {
                  await close({ data: { id: rfq.id, status: "en_evaluacion" } });
                  await refresh();
                }}
              >
                Marcar en evaluación
              </Button>
            )}
            {rfq.status !== "cerrado" && rfq.status !== "cancelado" && (
              <Button
                variant="outline"
                onClick={async () => {
                  await close({ data: { id: rfq.id, status: "cerrado" } });
                  await refresh();
                }}
              >
                Cerrar RFQ
              </Button>
            )}
          </div>
        </div>

        <section className="mt-8">
          <h2 className="font-serif text-xl">Productos</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {products.map((p) => (
              <div key={p.id} className="rounded border border-[hsl(var(--hairline))] bg-white p-4">
                <div className="font-serif text-lg">{p.product_name}</div>
                <div className="mt-1 text-xs text-[hsl(var(--content-subtle))]">
                  {p.purity ?? "—"} · {p.packaging ?? "—"} · {p.incoterm ?? rfq.incoterm ?? "—"}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <Metric label="Mensual (t)" value={p.qty_monthly_mt ?? "—"} />
                  <Metric label="Total (t)" value={p.qty_total_mt ?? "—"} />
                  <Metric label="Precio obj. USD" value={p.target_price_usd ?? "—"} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-serif text-xl">Postulaciones ({applications.length})</h2>
          {applications.length === 0 ? (
            <p className="mt-2 text-sm text-[hsl(var(--content-subtle))]">
              Aún no hay proveedores postulados. Comparte el marketplace para atraer ofertas.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {applications.map((a) => {
                const s = a.supplier;
                const r = a.risk as {
                  risk_score: number;
                  risk_band: string;
                  mining_score: number;
                  corporate_score: number;
                  compliance_score: number;
                } | null;
                return (
                  <div
                    key={a.id}
                    className="rounded border border-[hsl(var(--hairline))] bg-white p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{s?.legal_name ?? "Proveedor"}</div>
                        <div className="text-xs text-[hsl(var(--content-subtle))]">
                          Folio {s?.folio ?? "—"} · {s?.country ?? "—"} · Postulado{" "}
                          {new Date(a.created_at).toLocaleDateString("es-CL")}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${APP_COLOR[a.status] ?? "bg-gray-100"}`}
                        >
                          {APP_LABEL[a.status] ?? a.status}
                        </span>
                        {r && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${RISK_COLOR[r.risk_band] ?? "bg-gray-100"}`}
                          >
                            Riesgo {r.risk_band} · {r.risk_score}
                          </span>
                        )}
                      </div>
                    </div>
                    {r && (
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <Metric label="Minero" value={String(r.mining_score)} />
                        <Metric label="Corporativo" value={String(r.corporate_score)} />
                        <Metric label="Compliance" value={String(r.compliance_score)} />
                      </div>
                    )}
                    {a.notes && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-[hsl(var(--content-subtle))]">
                        {a.notes}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      {APP_STATUSES.map((st) => (
                        <Button
                          key={st}
                          size="sm"
                          variant={a.status === st ? "default" : "outline"}
                          disabled={busy === a.id}
                          onClick={async () => {
                            setBusy(a.id);
                            try {
                              await decide({ data: { id: a.id, status: st } });
                              await refresh();
                            } finally {
                              setBusy(null);
                            }
                          }}
                        >
                          {st === "approved" ? (
                            <Award className="mr-1 h-3 w-3" />
                          ) : st === "rejected" ? (
                            <XCircle className="mr-1 h-3 w-3" />
                          ) : st === "review" ? (
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                          ) : null}
                          {APP_LABEL[st]}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--content-subtle))]">
        {label}
      </div>
      <div className="font-mono">{value}</div>
    </div>
  );
}
