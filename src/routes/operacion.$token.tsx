import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOperacionByToken } from "@/lib/tradeOps.functions";
import { publicUrl } from "@/lib/publicUrl";

export const Route = createFileRoute("/operacion/$token")({
  head: () => ({
    meta: [
      { title: "Operación · Panel de contraparte — Geocapitals" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OperacionMirror,
});

function fmtMoney(n: number | null | undefined, unit = "US$") {
  if (n == null) return "—";
  return `${unit} ${Math.round(n).toLocaleString("es-CL")}`;
}

function OperacionMirror() {
  const { token } = Route.useParams();
  const fn = useServerFn(getOperacionByToken);
  const { data, isLoading, error } = useQuery({
    queryKey: ["operacion", token],
    queryFn: () => fn({ data: { token } }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return (
    <div data-theme="im-light" className="min-h-screen bg-[hsl(var(--im-paper))] text-[hsl(var(--im-ink))]">
      <header className="border-b border-[hsl(var(--im-hairline))]">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between">
          <a href={publicUrl("/")} className="font-serif text-2xl tracking-tight">GEOCAPITALS</a>
          <span className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--im-ink-soft))]">
            Panel de contraparte
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {isLoading && <p className="text-sm text-[hsl(var(--im-ink-soft))]">Cargando operación…</p>}
        {(error || (!isLoading && !data)) && (
          <div className="rounded-lg border border-[hsl(var(--im-hairline))] p-8 bg-white">
            <h1 className="font-serif text-2xl mb-2">Enlace no válido</h1>
            <p className="text-sm text-[hsl(var(--im-ink-soft))]">
              El enlace expiró o no corresponde a una operación activa. Solicítelo nuevamente a su contraparte
              en Geocapitals.
            </p>
          </div>
        )}
        {data && (
          <>
            <section className="rounded-lg border border-[hsl(var(--im-hairline))] bg-white p-8">
              <p className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--im-accent-brand))]">
                Rol asignado: {data.role === "buyer" ? "Comprador" : "Vendedor"}
              </p>
              <h1 className="font-serif text-3xl mt-2">{data.trade.reference ?? "Operación en curso"}</h1>
              <p className="text-sm text-[hsl(var(--im-ink-soft))] mt-1">
                Contraparte registrada: {data.counterparty.company ?? data.counterparty.name ?? "—"}
              </p>

              <dl className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8 text-sm">
                <div>
                  <dt className="uppercase text-[10px] tracking-[0.2em] text-[hsl(var(--im-ink-soft))]">Commodity</dt>
                  <dd className="mt-1 font-medium">{data.trade.commodity ?? "—"}</dd>
                </div>
                <div>
                  <dt className="uppercase text-[10px] tracking-[0.2em] text-[hsl(var(--im-ink-soft))]">Cantidad</dt>
                  <dd className="mt-1 font-medium">
                    {data.trade.quantity_t != null ? `${data.trade.quantity_t.toLocaleString("es-CL")} t` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="uppercase text-[10px] tracking-[0.2em] text-[hsl(var(--im-ink-soft))]">Incoterm</dt>
                  <dd className="mt-1 font-medium">{data.trade.incoterm ?? "—"}</dd>
                </div>
                <div>
                  <dt className="uppercase text-[10px] tracking-[0.2em] text-[hsl(var(--im-ink-soft))]">Valor total</dt>
                  <dd className="mt-1 font-medium">{fmtMoney(data.trade.total_value_usd)}</dd>
                </div>
                <div>
                  <dt className="uppercase text-[10px] tracking-[0.2em] text-[hsl(var(--im-ink-soft))]">Etapa</dt>
                  <dd className="mt-1 font-medium uppercase">{data.trade.stage}</dd>
                </div>
                <div>
                  <dt className="uppercase text-[10px] tracking-[0.2em] text-[hsl(var(--im-ink-soft))]">Estado</dt>
                  <dd className="mt-1 font-medium uppercase">{data.trade.status}</dd>
                </div>
                <div>
                  <dt className="uppercase text-[10px] tracking-[0.2em] text-[hsl(var(--im-ink-soft))]">Documentos</dt>
                  <dd className="mt-1 font-medium">{data.docsCount}</dd>
                </div>
                <div>
                  <dt className="uppercase text-[10px] tracking-[0.2em] text-[hsl(var(--im-ink-soft))]">Embarques</dt>
                  <dd className="mt-1 font-medium">{data.shipments.length}</dd>
                </div>
              </dl>
            </section>

            <section className="mt-8 grid md:grid-cols-2 gap-6">
              <div className="rounded-lg border border-[hsl(var(--im-hairline))] bg-white p-6">
                <h2 className="font-serif text-xl mb-4">Bitácora de la operación</h2>
                {data.events.length === 0 && (
                  <p className="text-sm text-[hsl(var(--im-ink-soft))]">Sin eventos registrados aún.</p>
                )}
                <ol className="space-y-3 text-sm">
                  {data.events.map((e, i) => (
                    <li key={i} className="border-l-2 border-[hsl(var(--im-accent-brand))] pl-3">
                      <p className="uppercase text-[10px] tracking-[0.2em] text-[hsl(var(--im-ink-soft))]">
                        {new Date(e.created_at).toLocaleString("es-CL")} · {e.kind}
                      </p>
                      <p className="mt-0.5">{e.detail ?? "—"}</p>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-lg border border-[hsl(var(--im-hairline))] bg-white p-6">
                <h2 className="font-serif text-xl mb-4">Embarques</h2>
                {data.shipments.length === 0 && (
                  <p className="text-sm text-[hsl(var(--im-ink-soft))]">Aún no se ha registrado embarque.</p>
                )}
                <ul className="space-y-4 text-sm">
                  {data.shipments.map((s, i) => (
                    <li key={i} className="border-b border-[hsl(var(--im-hairline))] pb-3 last:border-0">
                      <p className="font-medium">{s.reference ?? s.vessel_name ?? "Embarque"}</p>
                      <p className="text-[hsl(var(--im-ink-soft))]">
                        {s.port_loading ?? "—"} → {s.port_discharge ?? "—"} · ETA {s.eta ?? "—"}
                      </p>
                      <p className="uppercase text-[10px] tracking-[0.2em] mt-1">{s.status}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <p className="mt-10 text-xs text-[hsl(var(--im-ink-soft))]">
              Este panel es un enlace privado. No lo comparta con terceros. Para dudas escriba a
              info@geocapitals.com.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
